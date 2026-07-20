import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/lib/admin-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock, 
  Link2, 
  ExternalLink,
  BookOpen,
  Video,
  Brain,
  Upload,
  Loader2
} from "lucide-react";

interface ViewDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
}

interface TopicDetails {
  id: string;
  topicId: string;
  topicName: string;
  requestCount: number;
  priority: number;
  firstRequested: string;
  lastRequested: string;
  resolved: boolean;
  resolvedAt?: string;
  linkedResources?: Array<{
    id: string;
    title: string;
    type: string;
    difficulty?: string;
    url?: string;
    provider?: string;
    tags?: string[];
    createdAt: string;
  }>;
  requestHistory?: Array<{
    date: string;
    count: number;
    source: string;
  }>;
  analytics?: {
    totalStudentsAffected: number;
    averageGapScore: number;
    mostCommonSource: string;
    trendDirection: "up" | "down" | "stable";
  };
}

export function ViewDetailsModal({
  open,
  onOpenChange,
  topicId,
  topicName,
}: ViewDetailsModalProps) {
  const { makeAdminRequest } = useAdminAuth();

  // Fetch detailed topic information
  const { data: topicDetails, isLoading } = useQuery({
    queryKey: ["/api/admin/topics-queue/details", topicId],
    queryFn: async () => {
      const response = await makeAdminRequest(`/api/admin/topics-queue/${topicId}/details`);
      if (!response.ok) throw new Error("Failed to fetch topic details");
      return response.json() as Promise<TopicDetails>;
    },
    enabled: open && !!topicId,
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />;
      case "textbook": return <BookOpen className="h-4 w-4" />;
      case "article": return <FileText className="h-4 w-4" />;
      case "practice": return <Brain className="h-4 w-4" />;
      case "upload": return <Upload className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Date not available";
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return <Badge variant="destructive">Critical ({priority})</Badge>;
    if (priority >= 5) return <Badge variant="default">High ({priority})</Badge>;
    if (priority >= 3) return <Badge variant="secondary">Medium ({priority})</Badge>;
    return <Badge variant="outline">Low ({priority})</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Topic Details: {topicName}
          </DialogTitle>
          <DialogDescription>
            Comprehensive information about this topic's development queue status and resources.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : topicDetails ? (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Overview Section */}
              <Card data-testid="topic-overview">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600" data-testid="detail-request-count">
                        {topicDetails.requestCount}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Requests</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" data-testid="detail-priority">
                        {getPriorityBadge(topicDetails.priority)}
                      </div>
                      <div className="text-sm text-muted-foreground">Priority Level</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium" data-testid="detail-status">
                        <Badge variant={topicDetails.resolved ? "default" : "secondary"}>
                          {topicDetails.resolved ? "Resolved" : "Pending"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">Status</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium" data-testid="detail-resources-count">
                        {topicDetails.linkedResources?.length || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Linked Resources</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Section */}
              <Card data-testid="topic-timeline">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>First Requested:</strong> {formatDate(topicDetails.firstRequested)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Last Requested:</strong> {formatDate(topicDetails.lastRequested)}
                    </span>
                  </div>
                  {topicDetails.resolved && topicDetails.resolvedAt && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="text-sm">
                        <strong>Resolved:</strong> {formatDate(topicDetails.resolvedAt)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Analytics Section */}
              {topicDetails.analytics && (
                <Card data-testid="topic-analytics">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold" data-testid="detail-students-affected">
                          {topicDetails.analytics.totalStudentsAffected}
                        </div>
                        <div className="text-sm text-muted-foreground">Students Affected</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold" data-testid="detail-avg-gap-score">
                          {topicDetails.analytics.averageGapScore.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Avg. Gap Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium" data-testid="detail-trend">
                          <Badge 
                            variant={
                              topicDetails.analytics.trendDirection === "up" ? "destructive" :
                              topicDetails.analytics.trendDirection === "down" ? "default" : "secondary"
                            }
                          >
                            {topicDetails.analytics.trendDirection === "up" ? "↗ Increasing" :
                             topicDetails.analytics.trendDirection === "down" ? "↘ Decreasing" : "→ Stable"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">Trend</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Linked Resources Section */}
              <Card data-testid="topic-resources">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Linked Resources ({topicDetails.linkedResources?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topicDetails.linkedResources && topicDetails.linkedResources.length > 0 ? (
                    <div className="space-y-3">
                      {topicDetails.linkedResources.map((resource) => (
                        <div
                          key={resource.id}
                          className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50"
                          data-testid={`linked-resource-${resource.id}`}
                        >
                          <div className="flex-shrink-0">
                            {getResourceIcon(resource.type)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{resource.title}</span>
                              {resource.url && (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  data-testid={`resource-link-${resource.id}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
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
                              {resource.provider && (
                                <span>{resource.provider}</span>
                              )}
                              <span>Added {formatDate(resource.createdAt || null)}</span>
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
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No resources linked to this topic yet</p>
                      <p className="text-sm">Use the Upload, Generate, Link, or Attach actions to add resources</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Request History Section */}
              {topicDetails.requestHistory && topicDetails.requestHistory.length > 0 && (
                <Card data-testid="topic-request-history">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Request History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {topicDetails.requestHistory.map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 border-b last:border-b-0"
                          data-testid={`request-history-${index}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{formatDate(entry.date)}</span>
                            <Badge variant="outline" className="text-xs">
                              {entry.source}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium">
                            {entry.count} request{entry.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Topic details not found</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-close-details"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}