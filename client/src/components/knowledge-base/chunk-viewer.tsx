import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  FileText,
  Hash,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { useChunkQuery, useDocumentChunksQuery } from "@/hooks/use-knowledge-base";

interface ChunkViewerProps {
  chunkId?: string;
  documentId?: string;
  onClose: () => void;
}

export function ChunkViewer({ chunkId, documentId, onClose }: ChunkViewerProps) {
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const { toast } = useToast();

  // Fetch single chunk if chunkId is provided
  const { data: singleChunk, isLoading: isLoadingChunk } = useChunkQuery(chunkId || "", {
    enabled: !!chunkId,
  });

  // Fetch all chunks for a document if documentId is provided
  const { data: documentChunks, isLoading: isLoadingChunks } = useDocumentChunksQuery(
    documentId || "",
    { enabled: !!documentId }
  );

  const chunks = documentId && documentChunks ? documentChunks : chunkId && singleChunk ? [singleChunk] : [];
  const currentChunk = chunks[currentChunkIndex];
  const isLoading = isLoadingChunk || isLoadingChunks;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Chunk text copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy text",
        variant: "destructive",
      });
    }
  };

  const navigateChunk = (direction: "prev" | "next") => {
    if (direction === "prev" && currentChunkIndex > 0) {
      setCurrentChunkIndex(currentChunkIndex - 1);
    } else if (direction === "next" && currentChunkIndex < chunks.length - 1) {
      setCurrentChunkIndex(currentChunkIndex + 1);
    }
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;
    
    return Object.entries(metadata)
      .filter(([key]) => !["headingPath", "pageNumber"].includes(key))
      .map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="font-medium text-sm capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}:
          </span>
          <span className="text-sm text-muted-foreground">
            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
          </span>
        </div>
      ));
  };

  const getHeadingPath = (chunk: any) => {
    if (!chunk?.metadata?.headingPath) return null;
    return chunk.metadata.headingPath.join(" > ");
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Chunk Viewer</span>
            {chunks.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateChunk("prev")}
                  disabled={currentChunkIndex === 0}
                  data-testid="button-prev-chunk"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {currentChunkIndex + 1} / {chunks.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateChunk("next")}
                  disabled={currentChunkIndex === chunks.length - 1}
                  data-testid="button-next-chunk"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            Detailed view of document chunk with metadata and context
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : currentChunk ? (
            <div className="space-y-4">
              {/* Metadata Header */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {currentChunk.documentTitle && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{currentChunk.documentTitle}</span>
                      </div>
                    )}
                    {currentChunk.pageStart && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Pages {currentChunk.pageStart}
                          {currentChunk.pageEnd && currentChunk.pageEnd !== currentChunk.pageStart
                            ? `-${currentChunk.pageEnd}`
                            : ""}
                        </span>
                      </div>
                    )}
                    {getHeadingPath(currentChunk) && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-sm">{getHeadingPath(currentChunk)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {currentChunk.chunkIndex !== undefined && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Chunk Index: {currentChunk.chunkIndex}</span>
                      </div>
                    )}
                    {currentChunk.tokenCount && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Tokens: {currentChunk.tokenCount}</span>
                      </div>
                    )}
                    {currentChunk.createdAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {currentChunk.createdAt && !isNaN(new Date(currentChunk.createdAt).getTime()) ? format(new Date(currentChunk.createdAt), "MMM dd, yyyy HH:mm") : "—"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Chunk Content */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Content</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(currentChunk.cleanText || currentChunk.content)}
                    data-testid="button-copy-chunk"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap text-sm">
                    {currentChunk.cleanText || currentChunk.content}
                  </p>
                </div>
              </Card>

              {/* Topics and Tags */}
              {(currentChunk.topicIds?.length > 0 || currentChunk.tags?.length > 0) && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-3">Classification</h4>
                  <div className="space-y-3">
                    {currentChunk.topicIds?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Topics</p>
                        <div className="flex flex-wrap gap-2">
                          {currentChunk.topicIds.map((topicId: string) => (
                            <Badge key={topicId} variant="secondary">
                              {topicId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {currentChunk.tags?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {currentChunk.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Additional Metadata */}
              {currentChunk.metadata && Object.keys(currentChunk.metadata).length > 0 && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-3">Additional Metadata</h4>
                  <div className="space-y-2">{formatMetadata(currentChunk.metadata)}</div>
                </Card>
              )}

              {/* Embeddings Info */}
              {currentChunk.embedding && (
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Vector Embedding</p>
                      <p className="text-xs text-muted-foreground">
                        {currentChunk.embedding.length} dimensions
                      </p>
                    </div>
                    <Badge variant="outline">
                      {currentChunk.contentHash ? `Hash: ${currentChunk.contentHash.slice(0, 8)}...` : "No hash"}
                    </Badge>
                  </div>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {currentChunk.documentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Open document viewer
                      toast({
                        title: "Opening document",
                        description: "Document viewer will open in a new tab",
                      });
                    }}
                    data-testid="button-view-document"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Document
                  </Button>
                )}
                {chunks.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allText = chunks
                        .map((c: any) => c.cleanText || c.content)
                        .join("\n\n---\n\n");
                      copyToClipboard(allText);
                    }}
                    data-testid="button-copy-all"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All Chunks
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No chunk data available</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}