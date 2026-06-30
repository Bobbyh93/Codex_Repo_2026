import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/lib/admin-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link2, Search, Loader2, BookOpen, Video, FileText, Brain } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Resource {
  id: string;
  title: string;
  type: string;
  difficulty?: string;
  url?: string;
  duration?: number;
  topicId?: string;
  tags?: string[];
}

interface LinkResourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
  onSuccess?: () => void;
}

export function LinkResourceModal({
  open,
  onOpenChange,
  topicId,
  topicName,
  onSuccess,
}: LinkResourceModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setSearchQuery("");
      setSelectedResources(new Set());
      onOpenChange(false);
    }
  };

  // Fetch available resources
  const { data: resources, isLoading } = useQuery({
    queryKey: ["/api/admin/resources", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      params.append("excludeTopicId", topicId);
      
      const response = await makeAdminRequest(`/api/admin/resources?${params}`);
      if (!response.ok) throw new Error("Failed to fetch resources");
      return response.json() as Promise<Resource[]>;
    },
    enabled: open,
  });

  // Fetch already linked resources
  const { data: linkedResources } = useQuery({
    queryKey: ["/api/admin/resources/linked", topicId],
    queryFn: async () => {
      const response = await makeAdminRequest(`/api/admin/resources/linked/${topicId}`);
      if (!response.ok) throw new Error("Failed to fetch linked resources");
      return response.json() as Promise<Resource[]>;
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (resourceIds: string[]) => {
      const response = await makeAdminRequest("/api/admin/resources/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicId,
          resourceIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to link resources");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Resources linked successfully",
        description: `${selectedResources.size} resource(s) have been linked to ${topicName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resources"] });
      setSelectedResources(new Set());
      setSearchQuery("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Linking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleResource = (resourceId: string) => {
    const newSelected = new Set(selectedResources);
    if (newSelected.has(resourceId)) {
      newSelected.delete(resourceId);
    } else {
      newSelected.add(resourceId);
    }
    setSelectedResources(newSelected);
  };

  const handleLinkResources = () => {
    if (selectedResources.size === 0) {
      toast({
        title: "No resources selected",
        description: "Please select at least one resource to link",
        variant: "destructive",
      });
      return;
    }
    linkMutation.mutate(Array.from(selectedResources));
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />;
      case "textbook": return <BookOpen className="h-4 w-4" />;
      case "article": return <FileText className="h-4 w-4" />;
      case "quiz":
      case "practice": return <Brain className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const isLinked = (resourceId: string) => {
    return linkedResources?.some((r) => r.id === resourceId) || false;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Link Existing Resources to {topicName}</DialogTitle>
          <DialogDescription>
            Select resources from the database to link to this topic. Already linked resources are marked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resources by title, type, or tags..."
              className="pl-10"
              data-testid="input-search-resources"
            />
          </div>

          {/* Selected Count */}
          {selectedResources.size > 0 && (
            <Alert>
              <AlertDescription>
                {selectedResources.size} resource(s) selected for linking
              </AlertDescription>
            </Alert>
          )}

          {/* Resources List */}
          <ScrollArea className="h-[400px] border rounded-lg p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : resources && resources.length > 0 ? (
              <div className="space-y-3">
                {resources.map((resource) => {
                  const linked = isLinked(resource.id);
                  return (
                    <div
                      key={resource.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border ${
                        linked
                          ? "bg-gray-50 border-gray-200"
                          : selectedResources.has(resource.id)
                          ? "bg-blue-50 border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                      data-testid={`resource-item-${resource.id}`}
                    >
                      <Checkbox
                        checked={selectedResources.has(resource.id)}
                        onCheckedChange={() => handleToggleResource(resource.id)}
                        disabled={linked}
                        data-testid={`checkbox-resource-${resource.id}`}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getResourceIcon(resource.type)}
                          <span className="font-medium text-sm">
                            {resource.title}
                          </span>
                          {linked && (
                            <Badge variant="secondary" className="text-xs">
                              Already Linked
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {resource.type}
                          </Badge>
                          {resource.difficulty && (
                            <Badge variant="outline" className="text-xs">
                              {resource.difficulty}
                            </Badge>
                          )}
                          {resource.duration && (
                            <span>{resource.duration} min</span>
                          )}
                        </div>
                        {resource.tags && resource.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {resource.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {resource.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{resource.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        {resource.url && (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Resource →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <FileText className="h-8 w-8 mb-2" />
                <p className="text-sm">No resources found</p>
                <p className="text-xs">Try adjusting your search</p>
              </div>
            )}
          </ScrollArea>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={linkMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLinkResources}
              disabled={selectedResources.size === 0 || linkMutation.isPending}
              data-testid="button-link-submit"
            >
              {linkMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Link {selectedResources.size > 0 && `(${selectedResources.size})`} Resources
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}