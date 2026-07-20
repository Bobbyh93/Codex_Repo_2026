import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/admin-layout";
import { AdminTopicCard } from "@/components/admin/admin-topic-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/admin-auth";
import { 
  Search,
  Download
} from "lucide-react";

export default function TopicsQueue() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  // Fetch topics queue
  const { data: topicsQueue, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/topics-queue"],
    queryFn: async () => {
      const response = await makeAdminRequest("/api/admin/topics-queue");
      
      if (!response.ok) throw new Error("Failed to fetch topics queue");
      return response.json();
    },
  });

  // Filter topics
  const filteredTopics = topicsQueue?.filter((topic: any) => {
    const matchesSearch = topic.topicName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || 
                          (filterStatus === "pending" && !topic.resolved) ||
                          (filterStatus === "resolved" && topic.resolved);
    const matchesPriority = filterPriority === "all" ||
                            (filterPriority === "critical" && topic.priority >= 8) ||
                            (filterPriority === "high" && topic.priority >= 5 && topic.priority < 8) ||
                            (filterPriority === "medium" && topic.priority >= 3 && topic.priority < 5) ||
                            (filterPriority === "low" && topic.priority < 3);
    
    return matchesSearch && matchesStatus && matchesPriority;
  }) || [];

  // Calculate statistics
  const totalPending = topicsQueue?.filter((t: any) => !t.resolved).length || 0;
  const criticalCount = topicsQueue?.filter((t: any) => !t.resolved && t.priority >= 8).length || 0;
  const averageRequests = totalPending > 0 
    ? Math.round(topicsQueue?.filter((t: any) => !t.resolved)
        .reduce((sum: number, t: any) => sum + t.requestCount, 0) / totalPending)
    : 0;
  const thisWeekCount = topicsQueue?.filter((t: any) => {
    const lastRequested = new Date(t.lastRequested);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return lastRequested > weekAgo && !t.resolved;
  }).length || 0;

  const handleExport = async () => {
    try {
      const response = await makeAdminRequest("/api/admin/topics-queue/export");
      if (!response.ok) throw new Error("Failed to export queue");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'topics-queue.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Topics queue has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export topics queue",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = () => {
    refetch();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics Development Queue</h1>
          <p className="text-muted-foreground">Manage topics that need learning resources</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="stat-card-pending">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-value-pending">{totalPending}</div>
              <p className="text-xs text-muted-foreground">Need resources</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-card-critical">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Critical Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="stat-value-critical">{criticalCount}</div>
              <p className="text-xs text-muted-foreground">Urgent attention needed</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-card-avg-requests">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg. Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-value-avg-requests">{averageRequests}</div>
              <p className="text-xs text-muted-foreground">Per topic</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-card-this-week">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-value-this-week">{thisWeekCount}</div>
              <p className="text-xs text-muted-foreground">Recent requests</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search topics..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-topics"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[150px]" data-testid="select-priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="critical">Critical (8-10)</SelectItem>
                    <SelectItem value="high">High (5-7)</SelectItem>
                    <SelectItem value="medium">Medium (3-4)</SelectItem>
                    <SelectItem value="low">Low (0-2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={handleExport}
                data-testid="button-export-queue"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Queue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Topics Queue Grid */}
        <div data-testid="topics-grid">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">Loading topics...</div>
              </CardContent>
            </Card>
          ) : filteredTopics.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground" data-testid="no-topics-message">
                  No topics found matching your filters
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTopics.map((topic: any) => (
                <div key={topic.id} data-testid={`topic-card-${topic.id}`}>
                  <AdminTopicCard 
                    topic={{
                      id: topic.id,
                      topicId: topic.topicId,
                      topicName: topic.topicName,
                      requestCount: topic.requestCount,
                      priority: topic.priority,
                      lastRequested: topic.lastRequested,
                    }}
                    variant="queue"
                    onUpdate={handleUpdate}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}