import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BookOpen, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Clock
} from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TopicNeedingResources {
  id: string;
  topicId: string;
  topicName: string;
  reportId?: string;
  requestCount: number;
  priority: number;
  firstRequested: string;
  lastRequested: string;
  resolved: boolean;
  resolvedAt?: string;
}

export default function TopicsNeedingResources() {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch topics needing resources
  const { data: topics, isLoading, error, refetch } = useQuery<TopicNeedingResources[]>({
    queryKey: ["/api/admin/topics-needing-resources"],
  });

  // Mark topic as resolved mutation
  const markResolvedMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/topics-needing-resources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-needing-resources"] });
      toast({
        title: "Topic marked as resolved",
        description: "The topic has been marked as having resources available.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark topic as resolved. Please try again.",
        variant: "destructive",
      });
      console.error("Error marking topic as resolved:", error);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleMarkResolved = (id: string) => {
    markResolvedMutation.mutate(id);
  };

  // Calculate statistics
  const stats = {
    total: topics?.length || 0,
    highPriority: topics?.filter(t => t.priority >= 5).length || 0,
    totalRequests: topics?.reduce((sum, t) => sum + t.requestCount, 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Topics Needing Resources"
          description="Manage topics that students have requested resources for"
        />
        <LoadingState
          size="lg"
          variant="default"
          message="Loading topics..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader
          title="Topics Needing Resources"
          description="Manage topics that students have requested resources for"
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load topics needing resources. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Topics Needing Resources"
        description="Manage topics that students have requested resources for"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Topics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Needing resources</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.highPriority}</div>
            <p className="text-xs text-muted-foreground">Priority ≥ 5</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">From all students</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Topics Queue</h2>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Topics List */}
      {topics && topics.length > 0 ? (
        <div className="space-y-4">
          {topics.map((topic) => (
            <Card key={topic.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{topic.topicName}</h3>
                      <Badge 
                        variant={topic.priority >= 5 ? "destructive" : topic.priority >= 3 ? "default" : "secondary"}
                      >
                        Priority: {topic.priority}
                      </Badge>
                      <Badge variant="outline">
                        {topic.requestCount} {topic.requestCount === 1 ? 'request' : 'requests'}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          First requested: {topic.firstRequested && !isNaN(new Date(topic.firstRequested).getTime()) ? format(new Date(topic.firstRequested), 'MMM d, yyyy') : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Last requested: {topic.lastRequested && !isNaN(new Date(topic.lastRequested).getTime()) ? format(new Date(topic.lastRequested), 'MMM d, yyyy') : "—"}
                        </span>
                      </div>
                      {topic.reportId && (
                        <div>
                          Report ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{topic.reportId}</code>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        // Navigate to resource manager with this topic
                        const topicName = encodeURIComponent(topic.topicName);
                        window.location.href = `/admin/resources?topic=${topicName}`;
                      }}
                      variant="outline"
                      size="sm"
                      data-testid={`button-manage-resources-${topic.id}`}
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      Manage Resources
                    </Button>
                    <Button
                      onClick={() => handleMarkResolved(topic.id)}
                      variant="default"
                      size="sm"
                      disabled={markResolvedMutation.isPending}
                      data-testid={`button-mark-resolved-${topic.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h3 className="font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No topics are currently waiting for resources.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}