import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Sparkles,
  Brain,
  Hash,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  ExternalLink,
  Loader2,
  Settings,
  Upload,
  AlertCircle,
} from "lucide-react";
import { useSearchQuery, useGenerateAnswerMutation } from "@/hooks/use-knowledge-base";
import { ChunkViewer } from "./chunk-viewer";

// Removed custom debounce implementation - no longer needed for manual search triggering

interface SearchInterfaceProps {
  documents: any[];
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  documentId: string;
  documentTitle: string;
  pageStart?: number;
  pageEnd?: number;
  metadata?: any;
  highlighted?: string;
}

interface RagAnswer {
  answer: string;
  citations: Array<{
    text: string;
    source: {
      documentId: string;
      title: string;
      pageStart?: number;
      pageEnd?: number;
      chunkId: string;
    };
    relevance: number;
  }>;
  confidence: number;
  relatedTopics: string[];
  processingTime: number;
}

export function SearchInterface({ documents }: SearchInterfaceProps) {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"semantic" | "keyword" | "hybrid">("hybrid");
  const [hybridAlpha, setHybridAlpha] = useState([0.7]);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [ragAnswer, setRagAnswer] = useState<RagAnswer | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if we have any documents available
  const hasDocuments = documents && documents.length > 0;
  const isSearchDisabled = !hasDocuments;

  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchQueryError,
    refetch: performSearch,
  } = useSearchQuery(query, {
    mode: searchMode,
    alpha: hybridAlpha[0],
    documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
    enabled: false, // Always disabled - searches are manually triggered only
  });

  // Handle search errors
  useEffect(() => {
    if (searchQueryError) {
      setSearchError((searchQueryError as Error).message || "Search failed");
      toast({
        title: "Search Error",
        description: (searchQueryError as Error).message || "Failed to perform search. Please try again.",
        variant: "destructive",
      });
    } else {
      setSearchError(null);
    }
  }, [searchQueryError, toast]);

  const generateAnswer = useGenerateAnswerMutation();

  // No auto-triggering useEffect - searches are manually triggered via handleSearch only

  const handleSearch = () => {
    // Check if documents exist
    if (isSearchDisabled) {
      toast({
        title: "No documents available",
        description: "Please upload documents before testing the search functionality",
        variant: "destructive",
      });
      return;
    }

    if (!query.trim()) {
      toast({
        title: "Empty query",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }

    // Clear previous errors
    setSearchError(null);
    performSearch();
  };

  const handleGenerateAnswer = async () => {
    if (!searchResults || searchResults.length === 0) {
      toast({
        title: "No results",
        description: "Please perform a search first",
        variant: "destructive",
      });
      return;
    }

    try {
      const answer = await generateAnswer.mutateAsync({
        query,
        chunks: searchResults.slice(0, 5), // Top 5 results
      });
      setRagAnswer(answer);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate answer",
        variant: "destructive",
      });
    }
  };

  const toggleChunkExpansion = (chunkId: string) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId);
    } else {
      newExpanded.add(chunkId);
    }
    setExpandedChunks(newExpanded);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Text copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text",
        variant: "destructive",
      });
    }
  };

  const highlightQuery = (text: string, query: string): string => {
    if (!query) return text;
    const regex = new RegExp(`(${query.split(" ").join("|")})`, "gi");
    return text.replace(regex, "<mark class='bg-yellow-200 dark:bg-yellow-800'>$1</mark>");
  };

  // Show empty state when no documents exist
  if (isSearchDisabled) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2" data-testid="text-no-documents-title">
            No Documents Available
          </h3>
          <p className="text-muted-foreground mb-4" data-testid="text-no-documents-description">
            Upload documents to the knowledge base before testing the search functionality.
          </p>
          <p className="text-sm text-muted-foreground">
            Go to the <strong>Upload</strong> tab to add documents, or the <strong>Documents</strong> tab to manage existing ones.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {searchError && (
        <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Search Error</span>
          </div>
          <p className="text-sm text-destructive mt-1" data-testid="text-search-error">
            {searchError}
          </p>
        </Card>
      )}

      {/* Search Input */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder={isSearchDisabled ? "Upload documents first to enable search..." : "Ask a question or search for information..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !isSearchDisabled && handleSearch()}
                className="pl-10 pr-4"
                disabled={isSearchDisabled}
                data-testid="input-search-query"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || isSearchDisabled} 
              data-testid="button-search"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={isSearchDisabled}
              data-testid="button-advanced"
            >
              <Settings className="h-4 w-4 mr-2" />
              Advanced
            </Button>
          </div>

          {/* Document Count Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span data-testid="text-document-count">
              {documents.length} document{documents.length !== 1 ? 's' : ''} available for search
            </span>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t">
              {/* Search Mode */}
              <div className="space-y-2">
                <Label>Search Mode</Label>
                <RadioGroup value={searchMode} onValueChange={(v: any) => setSearchMode(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="semantic" id="semantic" />
                    <Label htmlFor="semantic" className="flex items-center cursor-pointer">
                      <Brain className="h-4 w-4 mr-2" />
                      Semantic (AI-powered)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="keyword" id="keyword" />
                    <Label htmlFor="keyword" className="flex items-center cursor-pointer">
                      <Hash className="h-4 w-4 mr-2" />
                      Keyword (exact match)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hybrid" id="hybrid" />
                    <Label htmlFor="hybrid" className="flex items-center cursor-pointer">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Hybrid (best of both)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Hybrid Alpha Slider */}
              {searchMode === "hybrid" && (
                <div className="space-y-2">
                  <Label>
                    Hybrid Balance (α = {hybridAlpha[0].toFixed(1)})
                  </Label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Keyword</span>
                    <Slider
                      value={hybridAlpha}
                      onValueChange={setHybridAlpha}
                      min={0}
                      max={1}
                      step={0.1}
                      className="flex-1"
                      data-testid="slider-hybrid-alpha"
                    />
                    <span className="text-sm text-muted-foreground">Semantic</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {hybridAlpha[0] >= 0.7
                      ? "Prioritizing semantic understanding"
                      : hybridAlpha[0] <= 0.3
                      ? "Prioritizing exact matches"
                      : "Balanced search"}
                  </p>
                </div>
              )}

              {/* Document Filter */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <Label>Filter by Documents</Label>
                  <div className="flex flex-wrap gap-2">
                    {documents.slice(0, 5).map((doc) => (
                      <Badge
                        key={doc.id}
                        variant={selectedDocumentIds.includes(doc.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          if (selectedDocumentIds.includes(doc.id)) {
                            setSelectedDocumentIds(selectedDocumentIds.filter((id) => id !== doc.id));
                          } else {
                            setSelectedDocumentIds([...selectedDocumentIds, doc.id]);
                          }
                        }}
                      >
                        {doc.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Results Tabs */}
      {(searchResults || ragAnswer) && (
        <Tabs defaultValue="results" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="results" data-testid="tab-search-results">
              Search Results {searchResults && `(${searchResults.length})`}
            </TabsTrigger>
            <TabsTrigger value="answer" data-testid="tab-rag-answer">
              RAG Answer
            </TabsTrigger>
          </TabsList>

          {/* Search Results Tab */}
          <TabsContent value="results" className="space-y-4">
            {searchResults && searchResults.length > 0 && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Found {searchResults.length} relevant chunks
                </p>
                <Button
                  onClick={handleGenerateAnswer}
                  disabled={generateAnswer.isPending}
                  size="sm"
                  data-testid="button-generate-answer"
                >
                  {generateAnswer.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Answer
                </Button>
              </div>
            )}

            {isSearching ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-2/3" />
                  </Card>
                ))}
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((result) => (
                  <Card key={result.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{result.documentTitle || 'Untitled'}</span>
                            {result.pageStart && (
                              <Badge variant="outline" className="text-xs">
                                Pages {result.pageStart}-{result.pageEnd || result.pageStart}
                              </Badge>
                            )}
                          </div>
                          <div className="prose prose-sm max-w-none">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: highlightQuery(
                                  expandedChunks.has(result.id)
                                    ? result.content
                                    : result.content.slice(0, 200) + "...",
                                  query
                                ),
                              }}
                              className="text-sm text-foreground"
                            />
                          </div>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {result.score ? (result.score * 100).toFixed(0) : '0'}%
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleChunkExpansion(result.id)}
                          data-testid={`button-expand-${result.id}`}
                        >
                          {expandedChunks.has(result.id) ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show more
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(result.content)}
                          data-testid={`button-copy-${result.id}`}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedChunk(result.id)}
                          data-testid={`button-view-${result.id}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : searchResults ? (
              <Card className="p-8 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No results found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your search query or filters
                </p>
              </Card>
            ) : null}
          </TabsContent>

          {/* RAG Answer Tab */}
          <TabsContent value="answer" className="space-y-4">
            {ragAnswer ? (
              <Card className="p-6">
                <div className="space-y-4">
                  {/* Confidence Score */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Generated Answer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Confidence: {(ragAnswer.confidence * 100).toFixed(0)}%
                      </Badge>
                      <Badge variant="outline">
                        {ragAnswer.processingTime}ms
                      </Badge>
                    </div>
                  </div>

                  {/* Answer Text */}
                  <div className="prose prose-sm max-w-none">
                    <div className="text-foreground whitespace-pre-wrap">
                      {ragAnswer.answer}
                    </div>
                  </div>

                  {/* Citations */}
                  {ragAnswer.citations.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <h4 className="font-semibold text-sm">Sources</h4>
                      <div className="space-y-2">
                        {ragAnswer.citations.map((citation, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Badge variant="outline" className="shrink-0">
                              [{index + 1}]
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium">{citation.source.title}</p>
                              {citation.source.pageStart && (
                                <p className="text-xs text-muted-foreground">
                                  Pages {citation.source.pageStart}-
                                  {citation.source.pageEnd || citation.source.pageStart}
                                </p>
                              )}
                              {citation.text && (
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  "{citation.text}"
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Topics */}
                  {ragAnswer.relatedTopics.length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <h4 className="font-semibold text-sm">Related Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {ragAnswer.relatedTopics.map((topic) => (
                          <Badge key={topic} variant="secondary">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(ragAnswer.answer)}
                      data-testid="button-copy-answer"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Answer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const fullText = `${ragAnswer.answer}\n\nSources:\n${ragAnswer.citations
                          .map((c, i) => `[${i + 1}] ${c.source.title}`)
                          .join("\n")}`;
                        copyToClipboard(fullText);
                      }}
                      data-testid="button-copy-with-citations"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy with Citations
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No answer generated yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Perform a search and click "Generate Answer" to test RAG
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Chunk Viewer */}
      {selectedChunk && (
        <ChunkViewer
          chunkId={selectedChunk}
          onClose={() => setSelectedChunk(null)}
        />
      )}
    </div>
  );
}