import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  BookOpen,
  Users,
  Target,
  BarChart3,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  Brain,
  Lightbulb,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DemandMetric {
  topicId: string;
  topicName: string;
  demandCount: number;
  uniqueUsers: number;
  avgPriority: number;
  lastRequested: Date;
  sources: { source: string; count: number }[];
  trend: 'increasing' | 'stable' | 'decreasing';
  resourceCoverage: number;
}

interface ResourceGap {
  topicId: string;
  topicName: string;
  demandScore: number;
  resourceCount: number;
  gapScore: number;
  suggestedResourceTypes: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AllocationPlan {
  topicId: string;
  topicName: string;
  recommendations: {
    resourceType: string;
    quantity: number;
    priority: number;
    reasoning: string;
  }[];
  allocationScore: number;
  estimatedTimeToComplete: number;
  cost: 'low' | 'medium' | 'high';
}

interface DemandTrend {
  date: string;
  demandCount: number;
  uniqueTopics: number;
  avgPriority: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function DemandAnalyticsPage() {
  const { toast } = useToast();
  const [selectedDateRange, setSelectedDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedBudget, setSelectedBudget] = useState<string>('medium');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // Fetch demand metrics
  const { data: demandMetrics = [], isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery<DemandMetric[]>({
    queryKey: ['/api/admin/analytics/demand', selectedDateRange],
    enabled: true,
    refetchInterval: refreshInterval,
  });

  // Fetch resource gaps
  const { data: resourceGaps = [], isLoading: loadingGaps } = useQuery<ResourceGap[]>({
    queryKey: ['/api/admin/analytics/gaps'],
    enabled: true,
    refetchInterval: refreshInterval,
  });

  // Fetch demand trends
  const { data: demandTrends = [], isLoading: loadingTrends } = useQuery<DemandTrend[]>({
    queryKey: ['/api/admin/analytics/trends'],
    enabled: true,
    refetchInterval: refreshInterval,
  });

  // Fetch resource allocations
  const { data: allocations = [], isLoading: loadingAllocations } = useQuery<AllocationPlan[]>({
    queryKey: ['/api/admin/analytics/allocations'],
    enabled: true,
  });

  // Generate allocation plan mutation
  const generateAllocationPlan = useMutation({
    mutationFn: async (data: { topicIds?: string[]; budget?: string }) => {
      return await apiRequest('POST', '/api/admin/analytics/allocation-plan', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Allocation plan generated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/allocations'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate allocation plan",
        variant: "destructive",
      });
    },
  });

  // Update allocation status
  const updateAllocationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest('PATCH', `/api/admin/analytics/allocations/${id}`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Allocation status updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/allocations'] });
    },
  });

  // Calculate summary statistics
  const summaryStats = {
    totalDemand: Array.isArray(demandMetrics) ? demandMetrics.reduce((sum: number, m: DemandMetric) => sum + m.demandCount, 0) : 0,
    uniqueTopics: Array.isArray(demandMetrics) ? demandMetrics.length : 0,
    avgCoverage: Array.isArray(demandMetrics) && demandMetrics.length > 0 ? demandMetrics.reduce((sum: number, m: DemandMetric) => sum + m.resourceCoverage, 0) / demandMetrics.length : 0,
    criticalGaps: Array.isArray(resourceGaps) ? resourceGaps.filter((g: ResourceGap) => g.priority === 'critical').length : 0,
  };

  // Auto-refresh toggle
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        refetchMetrics();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, refetchMetrics]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Demand Analytics & Resource Allocation</h1>
          <p className="text-muted-foreground mt-1">
            Real-time insights into topic demand and resource allocation optimization
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetchMetrics()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Demand</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-demand">
              {summaryStats.totalDemand.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Topic requests this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Topics</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unique-topics">
              {summaryStats.uniqueTopics}
            </div>
            <p className="text-xs text-muted-foreground">
              Topics with demand
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Coverage</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-coverage">
              {summaryStats.avgCoverage.toFixed(1)}%
            </div>
            <Progress value={summaryStats.avgCoverage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Gaps</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-critical-gaps">
              {summaryStats.criticalGaps}
            </div>
            <p className="text-xs text-muted-foreground">
              Need immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="demand" className="space-y-4">
        <TabsList>
          <TabsTrigger value="demand" data-testid="tab-demand">
            <BarChart3 className="h-4 w-4 mr-2" />
            Demand Metrics
          </TabsTrigger>
          <TabsTrigger value="gaps" data-testid="tab-gaps">
            <AlertCircle className="h-4 w-4 mr-2" />
            Resource Gaps
          </TabsTrigger>
          <TabsTrigger value="allocation" data-testid="tab-allocation">
            <Brain className="h-4 w-4 mr-2" />
            AI Allocation
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Demand Metrics Tab */}
        <TabsContent value="demand" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Demand Overview</CardTitle>
              <CardDescription>
                Most requested topics sorted by demand count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMetrics ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(demandMetrics) && demandMetrics.slice(0, 10).map((metric: DemandMetric) => (
                    <div
                      key={metric.topicId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      data-testid={`demand-item-${metric.topicId}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{metric.topicName}</h4>
                          {getTrendIcon(metric.trend)}
                        </div>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Requests: {metric.demandCount}</span>
                          <span>Users: {metric.uniqueUsers}</span>
                          <span>Priority: {metric.avgPriority.toFixed(1)}</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {metric.sources.map((source) => (
                            <Badge key={source.source} variant="secondary">
                              {source.source}: {source.count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Coverage</div>
                        <div className="text-2xl font-bold">{metric.resourceCoverage}%</div>
                        <Progress value={metric.resourceCoverage} className="w-24 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Demand by Source Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Demand by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Array.isArray(demandMetrics) ? demandMetrics.reduce((acc: any[], metric: DemandMetric) => {
                      metric.sources.forEach(source => {
                        const existing = acc.find(a => a.name === source.source);
                        if (existing) {
                          existing.value += source.count;
                        } else {
                          acc.push({ name: source.source, value: source.count });
                        }
                      });
                      return acc;
                    }, []) : []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(Array.isArray(demandMetrics) ? demandMetrics.reduce((acc: any[], metric: DemandMetric) => {
                      metric.sources.forEach(source => {
                        const existing = acc.find(a => a.name === source.source);
                        if (existing) {
                          existing.value += source.count;
                        } else {
                          acc.push({ name: source.source, value: source.count });
                        }
                      });
                      return acc;
                    }, []) : []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resource Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Gap Analysis</CardTitle>
              <CardDescription>
                Topics with highest resource gaps requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGaps ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(resourceGaps) && resourceGaps.map((gap: ResourceGap) => (
                    <div
                      key={gap.topicId}
                      className="p-4 border rounded-lg"
                      data-testid={`gap-item-${gap.topicId}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{gap.topicName}</h4>
                            <Badge className={cn("", getPriorityColor(gap.priority))}>
                              {gap.priority}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mt-2">
                            <div>
                              <div className="text-sm text-muted-foreground">Demand Score</div>
                              <div className="text-xl font-semibold">{gap.demandScore.toFixed(0)}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Resources</div>
                              <div className="text-xl font-semibold">{gap.resourceCount}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Gap Score</div>
                              <div className="text-xl font-semibold text-red-600">
                                {gap.gapScore.toFixed(0)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="text-sm text-muted-foreground mb-1">
                              Suggested Resource Types
                            </div>
                            <div className="flex gap-2">
                              {gap.suggestedResourceTypes.map((type) => (
                                <Badge key={type} variant="outline">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setSelectedTopics([gap.topicId])}
                          data-testid={`button-allocate-${gap.topicId}`}
                        >
                          <Lightbulb className="h-4 w-4 mr-1" />
                          Allocate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gap Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Coverage Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Array.isArray(resourceGaps) ? resourceGaps.slice(0, 15) : []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="topicName" 
                    angle={-45} 
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="demandScore" fill="#8884d8" name="Demand" />
                  <Bar dataKey="resourceCount" fill="#82ca9d" name="Resources" />
                  <Bar dataKey="gapScore" fill="#ff7c7c" name="Gap" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Allocation Tab */}
        <TabsContent value="allocation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Resource Allocation</CardTitle>
              <CardDescription>
                Generate intelligent resource allocation plans based on demand and gaps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                    <SelectTrigger className="w-[180px]" data-testid="select-budget">
                      <SelectValue placeholder="Select budget" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Budget</SelectItem>
                      <SelectItem value="medium">Medium Budget</SelectItem>
                      <SelectItem value="high">High Budget</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => generateAllocationPlan.mutate({
                      topicIds: selectedTopics.length > 0 ? selectedTopics : undefined,
                      budget: selectedBudget
                    })}
                    disabled={generateAllocationPlan.isPending}
                    data-testid="button-generate-plan"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Allocation Plan
                  </Button>
                </div>

                {generateAllocationPlan.isPending && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Generating...</AlertTitle>
                    <AlertDescription>
                      AI is analyzing demand patterns and creating an optimal allocation plan...
                    </AlertDescription>
                  </Alert>
                )}

                {/* Allocation Plans */}
                <div className="space-y-4">
                  {Array.isArray(allocations) && allocations.filter((a: any) => a.status === 'pending').map((allocation: any) => (
                    <div
                      key={allocation.id}
                      className="p-4 border rounded-lg"
                      data-testid={`allocation-${allocation.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold">Topic: {allocation.topicId}</h4>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            Score: {allocation.allocationScore}
                          </Badge>
                          <Badge className={cn("", 
                            allocation.demandLevel === 'critical' ? 'bg-red-100' :
                            allocation.demandLevel === 'high' ? 'bg-orange-100' :
                            allocation.demandLevel === 'medium' ? 'bg-yellow-100' :
                            'bg-green-100'
                          )}>
                            {allocation.demandLevel}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {allocation.recommendedResources?.map((rec: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span>{rec.resourceType}</span>
                            <span>Qty: {rec.quantity}</span>
                            <span>Priority: {rec.priority}/5</span>
                            <span className="text-muted-foreground">{rec.reasoning}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => updateAllocationStatus.mutate({
                            id: allocation.id,
                            status: 'approved'
                          })}
                          data-testid={`button-approve-${allocation.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAllocationStatus.mutate({
                            id: allocation.id,
                            status: 'rejected'
                          })}
                          data-testid={`button-reject-${allocation.id}`}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demand Trends Over Time</CardTitle>
              <CardDescription>
                Track how topic demand changes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={Array.isArray(demandTrends) ? demandTrends : []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="demandCount"
                    stroke="#8884d8"
                    fill="#8884d8"
                    name="Total Demand"
                  />
                  <Area
                    type="monotone"
                    dataKey="uniqueTopics"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    name="Unique Topics"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Priority Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={Array.isArray(demandTrends) ? demandTrends : []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgPriority"
                    stroke="#ff7300"
                    name="Average Priority"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-refresh control */}
      <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">Auto-refresh:</span>
          <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-refresh">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Disabled</SelectItem>
              <SelectItem value="10000">10 seconds</SelectItem>
              <SelectItem value="30000">30 seconds</SelectItem>
              <SelectItem value="60000">1 minute</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}