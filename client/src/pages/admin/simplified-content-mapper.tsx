import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, ChevronLeft, ChevronRight, Brain, 
  Loader2, Sparkles, ArrowLeft, RotateCcw
} from "lucide-react";

interface ContentBlock {
  id: string;
  title?: string;
  description?: string;
  content: string;
  category?: string;
  tags?: string[];
  nursingSpecialty?: string;
  bodySystem?: string;
  concepts?: string[];
  keywords?: string[];
  isProcessed: boolean;
  reviewTopicId?: string;
}

interface ReviewTopic {
  id: string;
  name: string;
  description?: string;
  nclexCategory?: string;
  nclexSubcategory?: string;
  nursingSpecialty?: string;
  bodySystem?: string;
  difficulty?: string;
  keywords?: string[];
}

const nursingSpecialties = [
  "Medical-Surgical", "Critical Care", "Pediatrics", "Obstetrics", 
  "Mental Health", "Community Health", "Emergency", "Geriatrics",
  "Oncology", "Cardiac", "Respiratory", "Nephrology", "Neurology"
];

const bodySystems = [
  "Cardiovascular", "Respiratory", "Neurological", "Musculoskeletal",
  "Gastrointestinal", "Genitourinary", "Endocrine", "Integumentary",
  "Immune/Hematologic", "Reproductive", "Sensory"
];

export default function SimplifiedContentMapper() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editedBlock, setEditedBlock] = useState<ContentBlock | null>(null);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['/api/admin/content/blocks'],
    queryFn: async () => {
      const response = await fetch('/api/admin/content/blocks?limit=100&unprocessed=true');
      if (!response.ok) throw new Error('Failed to fetch content blocks');
      return response.json();
    }
  });

  const { data: reviewTopics = [] } = useQuery<ReviewTopic[]>({
    queryKey: ['/api/review-topics'],
    queryFn: async () => {
      const response = await fetch('/api/review-topics');
      if (!response.ok) throw new Error('Failed to fetch review topics');
      return response.json();
    }
  });

  const updateBlockMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ContentBlock> }) => {
      const response = await fetch(`/api/admin/content/blocks/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates)
      });
      if (!response.ok) throw new Error('Failed to update content block');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Content saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content/blocks'] });
      if (currentIndex < blocks.length - 1) {
        nextBlock();
      }
    },
    onError: (error) => {
      toast({ 
        title: "Failed to save content", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const currentBlock = blocks[currentIndex] || null;

  useEffect(() => {
    if (currentBlock) {
      setEditedBlock({ ...currentBlock });
      // Auto-trigger AI mapping when block loads
      if (!currentBlock.isProcessed) {
        autoMapWithAI(currentBlock);
      }
    }
  }, [currentBlock]);

  const autoMapWithAI = async (block: ContentBlock) => {
    setIsAutoMapping(true);
    try {
      // Smart topic mapping based on content analysis
      const contentText = (block.title + ' ' + block.content).toLowerCase();
      let bestMatch = null;
      let bestScore = 0;

      for (const topic of reviewTopics) {
        let score = 0;
        const keywords = topic.keywords || [];
        
        // Check keyword matches
        for (const keyword of keywords) {
          if (contentText.includes(keyword.toLowerCase())) {
            score += 2; // Higher weight for keyword matches
          }
        }
        
        // Check topic name matches
        const topicWords = topic.name.toLowerCase().split(' ');
        for (const word of topicWords) {
          if (word.length > 3 && contentText.includes(word)) {
            score += 1;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = topic;
        }
      }

      // Default to Clinical Decision Making if no clear match
      if (!bestMatch || bestScore === 0) {
        bestMatch = reviewTopics.find(t => t.name === "Clinical Decision Making") || reviewTopics[0];
      }

      // Auto-apply mapping
      const mappedBlock = {
        ...block,
        title: block.title || generateTitleFromContent(block.content),
        description: generateDescriptionFromContent(block.content),
        reviewTopicId: bestMatch?.id,
        category: bestMatch?.name || '',
        nursingSpecialty: bestMatch?.nursingSpecialty || '',
        bodySystem: bestMatch?.bodySystem || '',
        tags: bestMatch?.keywords?.slice(0, 5) || []
      };
      
      setEditedBlock(mappedBlock);
      
      toast({ 
        title: "Auto-mapped to topic", 
        description: `Mapped to: ${bestMatch?.name || 'Unknown'} (Score: ${bestScore})`
      });
      
    } catch (error) {
      toast({ 
        title: "Auto-mapping failed", 
        description: "Please select topic manually",
        variant: "destructive"
      });
      // Fallback to basic mapping
      setEditedBlock(prev => ({
        ...prev!,
        title: prev!.title || generateTitleFromContent(block.content),
        description: prev!.description || generateDescriptionFromContent(block.content)
      }));
    } finally {
      setIsAutoMapping(false);
    }
  };

  const generateTitleFromContent = (content: string): string => {
    // Extract first meaningful sentence or first 50 chars
    const firstSentence = content.split(/[.!?]/)[0];
    return firstSentence.length > 50 ? 
      firstSentence.substring(0, 50) + "..." : 
      firstSentence;
  };

  const generateDescriptionFromContent = (content: string): string => {
    // Extract key topics and create a description
    const words = content.toLowerCase().match(/\b\w+\b/g) || [];
    const nursingTerms = words.filter(word => 
      ['patient', 'nursing', 'medication', 'assessment', 'care', 'treatment', 'diagnosis'].includes(word)
    );
    
    if (nursingTerms.length > 0) {
      return `Content about ${nursingTerms.slice(0, 3).join(', ')} and related nursing concepts.`;
    }
    
    return content.substring(0, 100) + "...";
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

  const saveAndContinue = async () => {
    if (!editedBlock || !currentBlock) return;

    try {
      // If a review topic is selected, also save to the simplified topic content
      if (editedBlock.reviewTopicId) {
        const mapResponse = await fetch('/api/admin/map-content-to-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editedBlock.content,
            title: editedBlock.title,
            source: currentBlock.source || 'Content Mapper'
          })
        });
        
        if (!mapResponse.ok) {
          throw new Error('Failed to map content to review topic');
        }
      }

      // Update the original content block
      const updates: Partial<ContentBlock> = {
        title: editedBlock.title,
        description: editedBlock.description,
        category: editedBlock.category,
        tags: editedBlock.tags || [],
        nursingSpecialty: editedBlock.nursingSpecialty,
        bodySystem: editedBlock.bodySystem,
        isProcessed: true
      };

      updateBlockMutation.mutate({ id: currentBlock.id, updates });
      
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const reMapWithAI = () => {
    if (currentBlock) {
      autoMapWithAI(currentBlock);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!blocks.length) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Content to Map</h2>
          <p className="text-gray-600 mb-6">Import content first to begin mapping.</p>
          <Button onClick={() => window.location.href = '/admin/content-workflow'}>
            Import Content
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content Mapping</h1>
          <p className="text-gray-600">
            Block {currentIndex + 1} of {blocks.length} • AI-powered categorization
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/admin'}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
      </div>

      {/* Auto-mapping Status */}
      {isAutoMapping && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">AI is analyzing this content...</p>
                <p className="text-sm text-blue-700">Auto-mapping title, description, and categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                <Label>Original Content</Label>
                <Textarea 
                  value={currentBlock.content}
                  readOnly
                  className="min-h-[400px] bg-gray-50 text-sm"
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

          {/* Unified Mapping Interface */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Content Mapping</CardTitle>
                <CardDescription>AI-generated mapping (editable)</CardDescription>
              </div>
              <Button size="sm" onClick={reMapWithAI} variant="outline" disabled={isAutoMapping}>
                {isAutoMapping ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Re-map
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Info */}
              <div>
                <Label>Title</Label>
                <Input 
                  value={editedBlock.title || ''}
                  onChange={(e) => setEditedBlock(prev => ({ ...prev!, title: e.target.value }))}
                  placeholder="Auto-generated title..."
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea 
                  value={editedBlock.description || ''}
                  onChange={(e) => setEditedBlock(prev => ({ ...prev!, description: e.target.value }))}
                  placeholder="Auto-generated description..."
                  rows={3}
                />
              </div>

              {/* Taxonomy */}
              <div>
                <Label>Review Topic</Label>
                <Select 
                  value={editedBlock.reviewTopicId || ''}
                  onValueChange={(value) => {
                    const selectedTopic = reviewTopics.find(t => t.id === value);
                    setEditedBlock(prev => ({ 
                      ...prev!, 
                      reviewTopicId: value,
                      category: selectedTopic?.name || '',
                      nursingSpecialty: selectedTopic?.nursingSpecialty || '',
                      bodySystem: selectedTopic?.bodySystem || ''
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select review topic..." />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewTopics.map(topic => (
                      <SelectItem key={topic.id} value={topic.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{topic.name}</span>
                          <span className="text-xs text-gray-500">{topic.nclexCategory}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editedBlock.reviewTopicId && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  {(() => {
                    const selectedTopic = reviewTopics.find(t => t.id === editedBlock.reviewTopicId);
                    return selectedTopic ? (
                      <div className="text-sm">
                        <p className="font-medium text-blue-900">{selectedTopic.name}</p>
                        <p className="text-blue-700">{selectedTopic.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{selectedTopic.nclexCategory}</Badge>
                          {selectedTopic.nclexSubcategory && (
                            <Badge variant="outline">{selectedTopic.nclexSubcategory}</Badge>
                          )}
                          <Badge variant="secondary">{selectedTopic.difficulty}</Badge>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* AI-Generated Tags */}
              {editedBlock.tags && editedBlock.tags.length > 0 && (
                <div>
                  <Label>AI-Generated Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editedBlock.tags.map((tag, idx) => (
                      <Badge key={idx} variant="default">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Concepts */}
              {editedBlock.concepts && editedBlock.concepts.length > 0 && (
                <div>
                  <Label>Key Concepts</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editedBlock.concepts.map((concept, idx) => (
                      <Badge key={idx} variant="outline">{concept}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
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
          <Button 
            variant="outline" 
            onClick={nextBlock}
            disabled={currentIndex === blocks.length - 1}
          >
            Skip
          </Button>
          <Button 
            onClick={saveAndContinue} 
            disabled={updateBlockMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}