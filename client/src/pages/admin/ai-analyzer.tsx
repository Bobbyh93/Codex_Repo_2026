import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/admin-auth";
import { 
  Bot, 
  Upload,
  FileText,
  Brain,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Search,
  RefreshCw,
  Download,
  Loader2
} from "lucide-react";

interface ExtractedTopic {
  name: string;
  category: string;
  system?: string;
  subject?: string;
  concepts: string[];
  difficulty: string;
  keywords: string[];
  description?: string;
}

export default function AIAnalyzer() {
  const [textInput, setTextInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractedTopics, setExtractedTopics] = useState<ExtractedTopic[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<any[]>([]);
  const [processingStatus, setProcessingStatus] = useState<"idle" | "processing" | "complete">("idle");
  const [activeTab, setActiveTab] = useState("extract");
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  // Extract topics mutation
  const extractTopicsMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await makeAdminRequest("/api/admin/ai/extract-topics", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) throw new Error("Failed to extract topics");
      return response.json();
    },
    onSuccess: (data) => {
      const topics = data.topics || [];
      setExtractedTopics(topics);
      setProcessingStatus("complete");
      
      // Provide immediate, prominent feedback
      toast({
        title: "✅ Topics Extracted Successfully!",
        description: `Found ${topics.length} topic${topics.length !== 1 ? 's' : ''} in your content. ${topics.length > 0 ? 'Scroll down to see the results.' : 'Try pasting a different assessment report.'}`,
      });
      
      // Scroll to results if topics were found
      if (topics.length > 0) {
        setTimeout(() => {
          const extractedTopicsSection = document.querySelector('[data-testid="extracted-topics-section"]');
          if (extractedTopicsSection) {
            extractedTopicsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    },
    onError: (error) => {
      setProcessingStatus("idle");
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Identify gaps mutation
  const identifyGapsMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await makeAdminRequest("/api/admin/ai/identify-gaps", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) throw new Error("Failed to identify gaps");
      return response.json();
    },
    onSuccess: (data) => {
      // Ensure gaps is always an array of strings or objects with proper structure
      const gaps = Array.isArray(data.gaps) ? data.gaps : [];
      const normalizedGaps = gaps.map((gap: any) => {
        if (typeof gap === 'string') return gap;
        if (gap && typeof gap === 'object') {
          return gap.description || gap.name || JSON.stringify(gap);
        }
        return String(gap);
      });
      
      setKnowledgeGaps(normalizedGaps);
      setProcessingStatus("complete");
      
      toast({
        title: "✅ Gap Analysis Complete!",
        description: `Identified ${normalizedGaps.length} knowledge gap${normalizedGaps.length !== 1 ? 's' : ''}. ${normalizedGaps.length > 0 ? 'Scroll down to see recommendations.' : 'No gaps detected in this content.'}`,
      });
      
      // Scroll to results if gaps were found
      if (normalizedGaps.length > 0) {
        setTimeout(() => {
          const gapsSection = document.querySelector('[data-testid="identified-gaps-section"]');
          if (gapsSection) {
            gapsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    },
    onError: (error) => {
      setProcessingStatus("idle");
      console.error('Gap identification error:', error);
      toast({
        title: "Analysis failed",
        description: error.message || "Unable to identify gaps. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Normalize topics mutation
  const normalizeTopicsMutation = useMutation({
    mutationFn: async (topics: string[]) => {
      const response = await fetch("/api/admin/ai/normalize-topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify({ topics }),
      });
      
      if (!response.ok) throw new Error("Failed to normalize topics");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Topics normalized",
        description: "Topic names have been standardized",
      });
    },
  });

  const handleTextAnalysis = () => {
    if (!textInput.trim()) {
      toast({
        title: "No content",
        description: "Please enter text to analyze",
        variant: "destructive",
      });
      return;
    }
    
    setProcessingStatus("processing");
    
    if (activeTab === "extract") {
      extractTopicsMutation.mutate(textInput);
    } else if (activeTab === "gaps") {
      identifyGapsMutation.mutate(textInput);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(files);
    
    // Process files
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setTextInput(prev => prev + "\n\n" + content);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleBulkProcess = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files",
        description: "Please upload files to process",
        variant: "destructive",
      });
      return;
    }
    
    setProcessingStatus("processing");
    
    // Create FormData for file upload
    const formData = new FormData();
    uploadedFiles.forEach(file => {
      formData.append("files", file);
    });
    
    try {
      const response = await fetch("/api/admin/ai/bulk-process", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error("Bulk processing failed");
      
      const result = await response.json();
      setExtractedTopics(result.topics || []);
      setProcessingStatus("complete");
      
      toast({
        title: "Bulk processing complete",
        description: `Processed ${uploadedFiles.length} files successfully`,
      });
    } catch (error: any) {
      setProcessingStatus("idle");
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Content Analyzer</h1>
          <p className="text-muted-foreground">Use AI to extract and analyze nursing education content</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Topics Extracted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{extractedTopics.length}</div>
              <p className="text-xs text-muted-foreground">This session</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Knowledge Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{knowledgeGaps.length}</div>
              <p className="text-xs text-muted-foreground">Identified</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Files Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uploadedFiles.length}</div>
              <p className="text-xs text-muted-foreground">Ready</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">AI Model</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">GPT-5</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Processing Area */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="extract">Topic Extraction</TabsTrigger>
            <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
            <TabsTrigger value="normalize">Normalization</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Processing</TabsTrigger>
          </TabsList>

          <TabsContent value="extract" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Extract Topics from Text</CardTitle>
                <CardDescription>
                  Paste assessment text or upload PDFs to automatically extract nursing topics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste assessment report text here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-ai-input"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleTextAnalysis}
                    disabled={processingStatus === "processing"}
                    data-testid="button-extract-topics"
                  >
                    {processingStatus === "processing" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4 mr-2" />
                    )}
                    Extract Topics
                  </Button>
                  <Button variant="outline" onClick={() => setTextInput("")}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {extractedTopics.length > 0 && (
              <Card data-testid="extracted-topics-section">
                <CardHeader>
                  <CardTitle>Extracted Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {extractedTopics.map((topic, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{topic.name}</h4>
                          <div className="flex gap-2">
                            <Badge>{topic.category}</Badge>
                            <Badge variant="outline">{topic.difficulty}</Badge>
                          </div>
                        </div>
                        {topic.description && (
                          <p className="text-sm text-muted-foreground">{topic.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {topic.keywords?.map((keyword, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Topics
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="gaps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Gap Analysis</CardTitle>
                <CardDescription>
                  Identify areas where students need additional support
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste assessment report to analyze for knowledge gaps..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={handleTextAnalysis}
                  disabled={processingStatus === "processing"}
                >
                  {processingStatus === "processing" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Identify Gaps
                </Button>
              </CardContent>
            </Card>

            {knowledgeGaps.length > 0 && (
              <Card data-testid="identified-gaps-section">
                <CardHeader>
                  <CardTitle>Identified Knowledge Gaps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {knowledgeGaps.map((gap, index) => (
                      <Alert key={index}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{gap}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="normalize" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Topic Name Normalization</CardTitle>
                <CardDescription>
                  Standardize topic names to match NCLEX taxonomy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter topic names (one per line)..."
                  rows={10}
                  className="font-mono text-sm"
                />
                <Button>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Normalize Topics
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bulk PDF Processing</CardTitle>
                <CardDescription>
                  Upload multiple PDF files for batch processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop PDF files here, or click to browse
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button asChild>
                      <span>Select Files</span>
                    </Button>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Files ready for processing:</h4>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4" />
                        <span>{file.name}</span>
                        <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                      </div>
                    ))}
                    <Button 
                      onClick={handleBulkProcess}
                      disabled={processingStatus === "processing"}
                      className="w-full"
                    >
                      {processingStatus === "processing" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing... This may take a few minutes
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4 mr-2" />
                          Process All Files
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {processingStatus === "processing" && (
                  <Progress value={66} className="w-full" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Insights */}
        {processingStatus === "complete" && (
          <Card>
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>Recommendations based on analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Pattern Detected:</strong> Multiple topics related to pharmacology were extracted. 
                    Consider creating a focused pharmacology study module.
                  </AlertDescription>
                </Alert>
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Opportunity:</strong> 5 topics lack associated learning resources. 
                    Priority content creation recommended.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}