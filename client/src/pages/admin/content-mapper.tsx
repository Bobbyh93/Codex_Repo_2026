import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/admin-layout";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, Tag, Brain, Heart, Stethoscope, 
  Pill, AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Save, X, Plus, Search, Filter, Sparkles, Loader2,
  ArrowLeft, Upload
} from "lucide-react";
import { Link } from "wouter";

interface ContentBlock {
  id: string;
  content: string;
  title: string;
  description?: string;
  contentType: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  nursingSpecialty?: string;
  bodySystem?: string;
  diagnoses?: string[];
  interventions?: string[];
  patientProblems?: string[];
  concepts?: string[];
  isProcessed?: boolean;
  createdAt?: string;
}

const nursingSpecialties = [
  "Medical-Surgical",
  "Critical Care",
  "Emergency",
  "Pediatrics",
  "Maternal-Newborn",
  "Mental Health",
  "Community Health",
  "Geriatrics"
];

const bodySystems = [
  "Cardiovascular",
  "Respiratory",
  "Neurological",
  "Gastrointestinal",
  "Renal/Urinary",
  "Endocrine",
  "Musculoskeletal",
  "Integumentary",
  "Immune/Hematologic",
  "Reproductive"
];

const nursingConcepts = [
  "Safety",
  "Infection Control",
  "Pain Management",
  "Medication Administration",
  "Patient Education",
  "Cultural Competence",
  "Therapeutic Communication",
  "Clinical Judgment",
  "Evidence-Based Practice",
  "Quality Improvement"
];

export default function ContentMapper() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showOnlyUnprocessed, setShowOnlyUnprocessed] = useState(true);
  const [editedBlock, setEditedBlock] = useState<ContentBlock | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch content blocks
  const { data: blocks = [], isLoading, error } = useQuery<ContentBlock[]>({
    queryKey: ['/api/admin/content/blocks', showOnlyUnprocessed, filterCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showOnlyUnprocessed) params.append('unprocessed', 'true');
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await apiRequest('GET', `/api/admin/content/blocks?${params}`, undefined, { retries: 1 });
      if (!response.ok) throw new Error('Failed to fetch content blocks');
      return response.json();
    }
  });

  // Update content block mutation
  const updateBlockMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ContentBlock> }) => {
      const response = await apiRequest('PUT', `/api/admin/content/blocks/${data.id}`, data.updates);
      if (!response.ok) throw new Error('Failed to update content block');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Content block updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content/blocks'] });
      nextBlock();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update content block", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const currentBlock = blocks[currentIndex] || null;

  useEffect(() => {
    if (currentBlock) {
      setEditedBlock({ ...currentBlock });
      setAiSuggestions(null); // Clear AI suggestions when changing blocks
    }
  }, [currentBlock]);

  useEffect(() => {
    if (blocks.length > 0 && currentIndex >= blocks.length) {
      setCurrentIndex(0);
    }
  }, [blocks.length, currentIndex]);

  // Function to analyze current block with AI
  const analyzeWithAI = async () => {
    if (!currentBlock) return;
    
    setIsAnalyzing(true);
    try {
      const response = await apiRequest('GET', `/api/admin/content/blocks/${currentBlock.id}/ai-suggestions`, undefined, { retries: 1 });
      if (!response.ok) throw new Error('Failed to get AI suggestions');
      const data = await response.json();
      setAiSuggestions(data.suggestions);
      toast({ title: "AI analysis complete", description: "Suggestions are ready to apply" });
    } catch (error) {
      toast({ 
        title: "AI analysis failed", 
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to apply AI suggestions to the current block
  const applySuggestions = () => {
    if (!aiSuggestions || !editedBlock) return;
    
    setEditedBlock({
      ...editedBlock,
      title: aiSuggestions.title || editedBlock.title,
      category: aiSuggestions.category || editedBlock.category,
      nursingSpecialty: aiSuggestions.nursingSpecialty || editedBlock.nursingSpecialty,
      bodySystem: aiSuggestions.bodySystem || editedBlock.bodySystem,
      diagnoses: aiSuggestions.diagnoses || editedBlock.diagnoses,
      interventions: aiSuggestions.interventions || editedBlock.interventions,
      patientProblems: aiSuggestions.patientProblems || editedBlock.patientProblems,
      concepts: aiSuggestions.concepts || editedBlock.concepts,
      keywords: aiSuggestions.keywords || editedBlock.keywords,
      tags: [...(aiSuggestions.concepts || []), ...(aiSuggestions.keywords || [])].slice(0, 10)
    });
    
    toast({ 
      title: "AI suggestions applied", 
      description: "Review and save the changes"
    });
  };

  // Batch analyze all unprocessed blocks
  const batchAnalyzeBlocks = async () => {
    setIsBatchAnalyzing(true);
    try {
      const response = await apiRequest('POST', '/api/admin/content/analyze-with-ai', { analyzeAll: true });
      
      if (!response.ok) throw new Error('Failed to analyze content blocks');
      const data = await response.json();
      
      toast({ 
        title: "Batch analysis complete", 
        description: `Successfully analyzed ${data.processed} blocks`
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content/blocks'] });
    } catch (error) {
      toast({ 
        title: "Batch analysis failed", 
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsBatchAnalyzing(false);
    }
  };

  const nextBlock = () => {
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevBlock = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const saveMapping = () => {
    if (!editedBlock || !currentBlock) return;

    const updates: Partial<ContentBlock> = {
      title: editedBlock.title,
      description: editedBlock.description,
      category: editedBlock.category,
      tags: editedBlock.tags || [],
      nursingSpecialty: editedBlock.nursingSpecialty,
      bodySystem: editedBlock.bodySystem,
      diagnoses: editedBlock.diagnoses || [],
      interventions: editedBlock.interventions || [],
      patientProblems: editedBlock.patientProblems || [],
      concepts: editedBlock.concepts || []
    };

    updateBlockMutation.mutate({ id: currentBlock.id, updates });
  };

  const skipBlock = () => {
    nextBlock();
  };

  const addTag = (type: 'tags' | 'diagnoses' | 'interventions' | 'patientProblems', value: string) => {
    if (!editedBlock || !value.trim()) return;
    
    const currentValues = editedBlock[type] || [];
    if (!currentValues.includes(value)) {
      setEditedBlock({
        ...editedBlock,
        [type]: [...currentValues, value]
      });
    }
  };

  const removeTag = (type: 'tags' | 'diagnoses' | 'interventions' | 'patientProblems', value: string) => {
    if (!editedBlock) return;
    
    const currentValues = editedBlock[type] || [];
    setEditedBlock({
      ...editedBlock,
      [type]: currentValues.filter(v => v !== value)
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load content blocks</AlertDescription>
        </Alert>
      </AdminLayout>
    );
  }

  if (blocks.length === 0) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto p-6">
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No content blocks to map</p>
              <p className="text-sm text-gray-500 mt-2">Import content first or adjust filters</p>
              <div className="mt-4">
                <Link href="/admin/content-import">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Content
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Navigation */}
      <div className="flex gap-2">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <Link href="/admin/content-import">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Content Import
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Content Mapper</h1>
          <p className="text-gray-600 mt-2">Categorize and tag imported content with AI assistance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={batchAnalyzeBlocks}
            disabled={isBatchAnalyzing}
            variant="outline"
          >
            {isBatchAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze All with AI
              </>
            )}
          </Button>
          <Badge variant="outline">
            {currentIndex + 1} / {blocks.length}
          </Badge>
          <Badge variant={showOnlyUnprocessed ? "default" : "secondary"}>
            {showOnlyUnprocessed ? "Unprocessed Only" : "All Content"}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex gap-4 items-center pt-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              <SelectItem value="medical-surgical">Medical-Surgical</SelectItem>
              <SelectItem value="pediatrics">Pediatrics</SelectItem>
              <SelectItem value="critical-care">Critical Care</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showOnlyUnprocessed ? "default" : "outline"}
            onClick={() => setShowOnlyUnprocessed(!showOnlyUnprocessed)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showOnlyUnprocessed ? "Unprocessed" : "All"}
          </Button>
        </CardContent>
      </Card>

      {/* Main Content */}
      {currentBlock && editedBlock && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Content Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Content Preview</CardTitle>
              <CardDescription>Original imported content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input 
                  value={editedBlock.title || ''}
                  onChange={(e) => setEditedBlock({ ...editedBlock, title: e.target.value })}
                  placeholder="Enter a descriptive title..."
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={editedBlock.description || ''}
                  onChange={(e) => setEditedBlock({ ...editedBlock, description: e.target.value })}
                  placeholder="Brief description of this content..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea 
                  value={currentBlock.content}
                  readOnly
                  className="min-h-[300px] bg-gray-50"
                />
              </div>
              {currentBlock.keywords && currentBlock.keywords.length > 0 && (
                <div>
                  <Label>Extracted Keywords</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {currentBlock.keywords.map((keyword: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mapping Controls */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Taxonomy Mapping</CardTitle>
                <CardDescription>Categorize and tag this content</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={analyzeWithAI}
                  disabled={isAnalyzing}
                  variant="outline"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      AI Analyze
                    </>
                  )}
                </Button>
                {aiSuggestions && (
                  <Button 
                    size="sm"
                    onClick={applySuggestions}
                    variant="default"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Apply AI Suggestions
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AI Suggestions Panel */}
              {aiSuggestions && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    <strong>AI Suggestions Available:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      {aiSuggestions.title && <li>• Title: {aiSuggestions.title}</li>}
                      {aiSuggestions.category && <li>• Category: {aiSuggestions.category}</li>}
                      {aiSuggestions.nursingSpecialty && <li>• Specialty: {aiSuggestions.nursingSpecialty}</li>}
                      {aiSuggestions.bodySystem && <li>• Body System: {aiSuggestions.bodySystem}</li>}
                      {aiSuggestions.concepts && aiSuggestions.concepts.length > 0 && (
                        <li>• Concepts: {aiSuggestions.concepts.slice(0, 3).join(", ")}...</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <Tabs defaultValue="basic">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="clinical">Clinical</TabsTrigger>
                  <TabsTrigger value="concepts">Concepts</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={editedBlock.category || ''}
                      onChange={(e) => setEditedBlock({ ...editedBlock, category: e.target.value })}
                      placeholder="e.g., Pharmacology, Assessment..."
                    />
                  </div>

                  <div>
                    <Label>Nursing Specialty</Label>
                    <Select 
                      value={editedBlock.nursingSpecialty || ''}
                      onValueChange={(value) => setEditedBlock({ ...editedBlock, nursingSpecialty: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select specialty..." />
                      </SelectTrigger>
                      <SelectContent>
                        {nursingSpecialties.map(specialty => (
                          <SelectItem key={specialty} value={specialty.toLowerCase().replace(/\s+/g, '-')}>
                            {specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tags</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Add a tag..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTag('tags', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const input = document.querySelector('input[placeholder="Add a tag..."]') as HTMLInputElement;
                          if (input?.value) {
                            addTag('tags', input.value);
                            input.value = '';
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(editedBlock.tags || []).map((tag, idx) => (
                        <Badge key={idx} variant="default">
                          {tag}
                          <X
                            className="h-3 w-3 ml-1 cursor-pointer"
                            onClick={() => removeTag('tags', tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="clinical" className="space-y-4">
                  <div>
                    <Label>Body System</Label>
                    <Select 
                      value={editedBlock.bodySystem || ''}
                      onValueChange={(value) => setEditedBlock({ ...editedBlock, bodySystem: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select body system..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bodySystems.map(system => (
                          <SelectItem key={system} value={system.toLowerCase()}>
                            {system}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Related Diagnoses</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Add diagnosis..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTag('diagnoses', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(editedBlock.diagnoses || []).map((diagnosis, idx) => (
                        <Badge key={idx} variant="outline">
                          {diagnosis}
                          <X
                            className="h-3 w-3 ml-1 cursor-pointer"
                            onClick={() => removeTag('diagnoses', diagnosis)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Interventions</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Add intervention..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTag('interventions', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(editedBlock.interventions || []).map((intervention, idx) => (
                        <Badge key={idx} variant="outline">
                          {intervention}
                          <X
                            className="h-3 w-3 ml-1 cursor-pointer"
                            onClick={() => removeTag('interventions', intervention)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="concepts" className="space-y-4">
                  <div>
                    <Label>Nursing Concepts</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {nursingConcepts.map(concept => (
                        <label key={concept} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(editedBlock.concepts || []).includes(concept)}
                            onChange={(e) => {
                              const concepts = editedBlock.concepts || [];
                              if (e.target.checked) {
                                setEditedBlock({ ...editedBlock, concepts: [...concepts, concept] });
                              } else {
                                setEditedBlock({ ...editedBlock, concepts: concepts.filter(c => c !== concept) });
                              }
                            }}
                          />
                          <span className="text-sm">{concept}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Patient Problems</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Add patient problem..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTag('patientProblems', (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(editedBlock.patientProblems || []).map((problem, idx) => (
                        <Badge key={idx} variant="outline">
                          {problem}
                          <X
                            className="h-3 w-3 ml-1 cursor-pointer"
                            onClick={() => removeTag('patientProblems', problem)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={prevBlock}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={nextBlock}
            disabled={currentIndex === blocks.length - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={skipBlock}>
            Skip
          </Button>
          <Button onClick={saveMapping} disabled={updateBlockMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save & Next
          </Button>
        </div>
      </div>
    </div>
    </AdminLayout>
  );
}
