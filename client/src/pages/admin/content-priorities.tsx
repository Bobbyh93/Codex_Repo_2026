import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Minus, Target, BookOpen, AlertTriangle } from "lucide-react";

export default function ContentPriorities() {
  // Fetch topic frequency data
  const { data: frequencyData, isLoading: frequencyLoading } = useQuery({
    queryKey: ['/api/admin/topic-frequency'],
    queryFn: async () => {
      const response = await fetch('/api/admin/topic-frequency');
      if (!response.ok) throw new Error('Failed to fetch frequency data');
      return response.json();
    }
  });

  // Fetch content development priorities
  const { data: priorities, isLoading: prioritiesLoading } = useQuery({
    queryKey: ['/api/admin/content-development-priorities'],
    queryFn: async () => {
      const response = await fetch('/api/admin/content-development-priorities');
      if (!response.ok) throw new Error('Failed to fetch priorities');
      return response.json();
    }
  });

  // Fetch priority metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/priority-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/priority-metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    }
  });

  if (frequencyLoading || prioritiesLoading || metricsLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="content-priorities">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="title-content-priorities">Content Development Priorities</h1>
          <p className="text-gray-600">Topic frequency tracking and resource allocation guidance</p>
        </div>
      </div>

      {/* Overview Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reviews</p>
                  <p className="text-2xl font-bold" data-testid="metric-total-reviews">{metrics.totalReviews}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Topics</p>
                  <p className="text-2xl font-bold" data-testid="metric-active-topics">{metrics.activeTopics}</p>
                </div>
                <BookOpen className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Critical Topics</p>
                  <p className="text-2xl font-bold" data-testid="metric-critical-topics">{metrics.criticalTopics}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Content Gaps</p>
                  <p className="text-2xl font-bold" data-testid="metric-content-gaps">{metrics.contentGapsCount}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="frequency" className="space-y-4">
        <TabsList>
          <TabsTrigger value="frequency" data-testid="tab-frequency">Topic Frequency</TabsTrigger>
          <TabsTrigger value="priorities" data-testid="tab-priorities">Development Priorities</TabsTrigger>
          <TabsTrigger value="gaps" data-testid="tab-gaps">Content Gaps</TabsTrigger>
        </TabsList>

        <TabsContent value="frequency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Review Frequency</CardTitle>
              <CardDescription>
                How often each topic is identified as needing review from assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {frequencyData && (
                <div className="space-y-4">
                  {frequencyData.slice(0, 10).map((topic: any, index: number) => (
                    <div key={topic.topicName} className="border rounded-lg p-4" data-testid={`frequency-topic-${index}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{topic.topicName}</h3>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(topic.trend)}
                          <Badge variant={getPriorityColor(topic.priorityLevel)}>
                            {topic.priorityLevel}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <span className="text-sm text-gray-600">Total Reviews: </span>
                          <span className="font-medium">{topic.reviewFrequency}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Recent (30d): </span>
                          <span className="font-medium">{topic.recentInstances}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Priority Score: </span>
                          <span className="font-medium">{topic.contentPriorityScore?.toFixed?.(1) || topic.frequency || 0}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Priority Score</span>
                          <span>{(topic.contentPriorityScore || topic.frequency || 0)}/100</span>
                        </div>
                        <Progress value={Math.min(topic.contentPriorityScore || topic.frequency || 0, 100)} className="w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="priorities" className="space-y-4">
          {priorities && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>High Priority Topics</CardTitle>
                  <CardDescription>Topics requiring immediate content development</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {priorities.highPriorityTopics?.map((topic: any, index: number) => (
                      <div key={topic.topicName} className="border rounded-lg p-3" data-testid={`high-priority-${index}`}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{topic.topicName}</h4>
                          <Badge variant="destructive">Score: {(topic.contentPriorityScore || topic.frequency || 0)}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {topic.reviewFrequency} total reviews, {topic.recentInstances} recent
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Emerging Needs</CardTitle>
                  <CardDescription>Topics with increasing demand trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {priorities.emergingNeeds?.map((topic: any, index: number) => (
                      <div key={topic.topicName} className="border rounded-lg p-3" data-testid={`emerging-need-${index}`}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{topic.topicName}</h4>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-gray-600">{topic.recentInstances} recent</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Development Recommendations</CardTitle>
                  <CardDescription>Specific content creation suggestions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {priorities.developmentRecommendations?.map((rec: any, index: number) => (
                      <div key={rec.topic} className="border rounded-lg p-4" data-testid={`recommendation-${index}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{rec.topic}</h4>
                          <div className="flex gap-2">
                            <Badge variant="outline">{rec.businessImpact} impact</Badge>
                            <Badge variant="secondary">{rec.estimatedEffort} effort</Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Recommended content:</p>
                          <ul className="text-sm space-y-1">
                            {rec.recommendedContent.map((content: string, i: number) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                                {content}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Gaps Analysis</CardTitle>
              <CardDescription>Topics with high demand but insufficient content resources</CardDescription>
            </CardHeader>
            <CardContent>
              {priorities?.contentGaps && priorities.contentGaps.length > 0 ? (
                <div className="space-y-3">
                  {priorities.contentGaps.map((gap: any, index: number) => (
                    <div key={gap.topicName} className="border rounded-lg p-4" data-testid={`content-gap-${index}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{gap.topicName}</h4>
                        <Badge variant="destructive">Gap Score: {gap.resourceGap.toFixed(1)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Demand Score: </span>
                          <span className="font-medium">{gap.demandScore.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Resource Gap: </span>
                          <span className="font-medium">{gap.resourceGap.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No significant content gaps identified. All high-demand topics have adequate content coverage.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}