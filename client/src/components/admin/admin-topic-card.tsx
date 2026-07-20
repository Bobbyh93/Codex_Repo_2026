import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAdminAuth } from "@/lib/admin-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Brain, Link2, Paperclip, MoreVertical, Eye, Edit, CheckCircle, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { UploadResourceModal } from "@/components/admin/upload-resource-modal";
import { GenerateContentModal } from "@/components/admin/generate-content-modal";
import { LinkResourceModal } from "@/components/admin/link-resource-modal";
import { AttachExternalModal } from "@/components/admin/attach-external-modal";
import { ViewDetailsModal } from "@/components/admin/view-details-modal";
import { EditTopicModal } from "@/components/admin/edit-topic-modal";

interface AdminTopicCardProps {
  topic: {
    id: string;
    topicId?: string;
    topicName: string;
    requestCount?: number;
    priority?: number;
    lastRequested?: string;
    missRate?: number;
    students?: number;
    resolved?: boolean;
  };
  variant?: "queue" | "gaps";
  onUpdate?: () => void;
}

export function AdminTopicCard({ topic, variant = "queue", onUpdate }: AdminTopicCardProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [editTopicModalOpen, setEditTopicModalOpen] = useState(false);
  
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  // Mark as resolved mutation
  const markResolvedMutation = useMutation({
    mutationFn: async () => {
      const response = await makeAdminRequest(`/api/admin/topics-queue/${topic.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resolved: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark topic as resolved");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic marked as resolved",
        description: `"${topic.topicName}" has been marked as resolved and will be removed from the queue`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue"] });
      if (onUpdate) onUpdate();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark as resolved",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleModalSuccess = () => {
    // Refresh the data if needed
    if (onUpdate) {
      onUpdate();
    }
  };

  const handleMarkResolved = () => {
    if (confirm(`Are you sure you want to mark "${topic.topicName}" as resolved? This will remove it from the development queue.`)) {
      markResolvedMutation.mutate();
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold" data-testid={`topic-title-${topic.id}`}>
                {topic.topicName}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                {variant === "queue" && topic.requestCount && (
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {topic.requestCount} requests
                    </Badge>
                    {topic.priority && (
                      <Badge 
                        variant={topic.priority > 5 ? "destructive" : "outline"} 
                        className="text-xs"
                      >
                        Priority: {topic.priority}
                      </Badge>
                    )}
                  </>
                )}
                {variant === "gaps" && topic.missRate && (
                  <>
                    <Badge 
                      variant={topic.missRate > 75 ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {topic.missRate}% miss rate
                    </Badge>
                    {topic.students && (
                      <span className="text-xs text-muted-foreground">
                        {topic.students} students
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  data-testid={`topic-menu-${topic.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setViewDetailsModalOpen(true)}
                  data-testid={`action-view-details-${topic.id}`}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setEditTopicModalOpen(true)}
                  data-testid={`action-edit-topic-${topic.id}`}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Topic
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleMarkResolved}
                  disabled={markResolvedMutation.isPending || topic.resolved}
                  data-testid={`action-mark-resolved-${topic.id}`}
                  className={topic.resolved ? "opacity-50" : ""}
                >
                  {markResolvedMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {topic.resolved ? "Already Resolved" : "Mark as Resolved"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {topic.lastRequested && (
            <p className="text-xs text-muted-foreground mb-3">
              Last requested: {!isNaN(new Date(topic.lastRequested).getTime()) ? new Date(topic.lastRequested).toLocaleDateString() : "—"}
            </p>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setUploadModalOpen(true)}
              data-testid={`button-upload-${topic.id}`}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setGenerateModalOpen(true)}
              data-testid={`button-generate-${topic.id}`}
            >
              <Brain className="h-4 w-4 mr-2" />
              Generate
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLinkModalOpen(true)}
              data-testid={`button-link-${topic.id}`}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Link
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setAttachModalOpen(true)}
              data-testid={`button-attach-${topic.id}`}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Attach
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Creation Modals */}
      <UploadResourceModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        topicId={topic.topicId || topic.id}
        topicName={topic.topicName}
        onSuccess={handleModalSuccess}
      />
      
      <GenerateContentModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        topicId={topic.topicId || topic.id}
        topicName={topic.topicName}
        onSuccess={handleModalSuccess}
      />
      
      <LinkResourceModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        topicId={topic.topicId || topic.id}
        topicName={topic.topicName}
        onSuccess={handleModalSuccess}
      />
      
      <AttachExternalModal
        open={attachModalOpen}
        onOpenChange={setAttachModalOpen}
        topicId={topic.topicId || topic.id}
        topicName={topic.topicName}
        onSuccess={handleModalSuccess}
      />

      {/* Management Modals */}
      <ViewDetailsModal
        open={viewDetailsModalOpen}
        onOpenChange={setViewDetailsModalOpen}
        topicId={topic.id}
        topicName={topic.topicName}
      />
      
      <EditTopicModal
        open={editTopicModalOpen}
        onOpenChange={setEditTopicModalOpen}
        topicId={topic.id}
        topicName={topic.topicName}
        currentPriority={topic.priority || 0}
        currentResolved={topic.resolved || false}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}