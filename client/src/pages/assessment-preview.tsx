import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Home, 
  FileText, 
  TrendingDown, 
  AlertCircle,
  Clock,
  BookOpen,
  Target,
  CheckCircle,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Wifi,
  Info,
  Timer,
  Calendar,
  TrendingUp,
  Activity,
  Brain,
  Award,
  Lightbulb
} from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { StudyPlanSkeleton, TopicListSkeleton } from "@/components/ui/skeleton";
import { AssessmentNotFound, LoadingFailed, NoTopicsFound } from "@/components/ui/empty-state";
import { useSuccessFeedback } from "@/components/ui/success-feedback";
import { ShareButton } from "@/components/ui/share-button";
import { Progress } from "@/components/ui/progress";
import { cn, getPriorityExplanation, getGapAnalysis, calculateEnhancedStudyTime, getEnhancedResourceStatus, formatStudyTime, calculateScoreImpact, assessTopicDifficulty } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { StudyPlanErrorBoundary, SectionErrorBoundary } from "@/components/ui/error-boundary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getUserFriendlyErrorMessage, isOffline, apiRequest } from "@/lib/queryClient";

interface TopicPerformance {
  id: string;
  topic?: {
    id: string;
    name: string;
    subject?: string;
    specialty?: string;
    system?: string;
    systemCategory?: string;
  };
  score: string;
  gapScore: string;
  priority: number;
  recommendedStudyTime?: number;
}

export default function AssessmentPreview() {
  const params = useParams();
  const reportId = params.reportId;
  const [, setLocation] = useLocation();
  const [resourceAvailability, setResourceAvailability] = useState<Record<string, boolean>>({});
  const [resourceCheckError, setResourceCheckError] = useState<string | null>(null);
  const [isRefreshingResources, setIsRefreshingResources] = useState(false);
  const [lastResourceCheck, setLastResourceCheck] = useState<Date | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const { toast } = useToast();
  const successFeedback = useSuccessFeedback();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch topic performance data with enhanced error handling
  const { 
    data: topicPerformance, 
    isLoading, 
    error,
    refetch: refetchTopics 
  } = useQuery<TopicPerformance[]>({
    queryKey: ["/api/assessment-reports", reportId, "topic-performance"],
    enabled: !!reportId,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 3;
    }
  });

  // Enhanced resource availability checking
  const checkResourceAvailability = async (topicIds: string[], isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshingResources(true);
    }
    
    try {
      const response = await fetch("/api/resources/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds })
      });
      
      const data = await response.json();
      if (data.availability) {
        setResourceAvailability(data.availability);
        setLastResourceCheck(new Date());
        setResourceCheckError(null);
        
        if (isManualRefresh) {
          successFeedback.showResourceRefresh();
        }
      }
    } catch (error) {
      console.error("Error checking resource availability:", error);
      setResourceCheckError("Failed to check resource availability");
      
      if (isManualRefresh) {
        toast({
          title: "Refresh Failed",
          description: "Unable to check resource availability. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      if (isManualRefresh) {
        setIsRefreshingResources(false);
      }
    }
  };

  // Check resource availability when topics are loaded
  useEffect(() => {
    if (topicPerformance && topicPerformance.length > 0) {
      const topicIds = topicPerformance
        .filter(t => t.topic?.id)
        .map(t => t.topic!.id);
        
      if (topicIds.length > 0) {
        checkResourceAvailability(topicIds);
      }
    }
  }, [topicPerformance]);

  // Manual refresh function
  const handleManualResourceRefresh = () => {
    if (topicPerformance && topicPerformance.length > 0) {
      const topicIds = topicPerformance
        .filter(t => t.topic?.id)
        .map(t => t.topic!.id);
        
      if (topicIds.length > 0) {
        checkResourceAvailability(topicIds, true);
      }
    }
  };

  // Handle topic with no resources
  const handleNoResources = async (topicId: string, topicName: string) => {
    try {
      await fetch("/api/topics-needing-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, topicName, reportId })
      });
      
      successFeedback.showTopicQueued(topicName);
    } catch (error) {
      console.error("Error queueing topic:", error);
    }
  };

  // Group topics by priority level
  const groupTopicsByPriority = (topics: TopicPerformance[]) => {
    const highPriority = topics.filter(t => t.priority === 1 || t.priority === 2);
    const mediumPriority = topics.filter(t => t.priority === 3);
    const lowPriority = topics.filter(t => t.priority > 3);
    
    return { highPriority, mediumPriority, lowPriority };
  };

  const { highPriority = [], mediumPriority = [], lowPriority = [] } = 
    topicPerformance ? groupTopicsByPriority(topicPerformance) : {};

  // Calculate overall statistics with enhanced data validation
  const calculateStats = () => {
    if (!topicPerformance || topicPerformance.length === 0) {
      return {
        totalTopics: 0,
        averageScore: 0,
        averageGap: 0,
        estimatedStudyTime: 0
      };
    }

    const totalTopics = topicPerformance.length;
    
    // Enhanced validation for score calculations
    const validScores = topicPerformance.map(t => {
      const score = parseFloat(t.score || '0');
      return isNaN(score) ? 0 : score;
    });
    const validGaps = topicPerformance.map(t => {
      const gap = parseFloat(t.gapScore || '0');
      return isNaN(gap) ? 0 : gap;
    });
    
    const averageScore = validScores.reduce((sum, score) => sum + score, 0) / totalTopics;
    const averageGap = validGaps.reduce((sum, gap) => sum + gap, 0) / totalTopics;
    
    // Enhanced study time calculation using utility function
    const estimatedStudyTime = topicPerformance.reduce((sum, t) => {
      if (t.recommendedStudyTime) {
        return sum + t.recommendedStudyTime;
      }
      // Use enhanced calculation when recommendedStudyTime is missing
      const gapScore = parseFloat(t.gapScore || '0');
      const validGap = isNaN(gapScore) ? 0 : gapScore;
      const topicDifficulty = assessTopicDifficulty(t.topic?.name || '', t.topic?.subject);
      const enhancedTime = calculateEnhancedStudyTime(validGap, topicDifficulty);
      return sum + enhancedTime.totalTime;
    }, 0);

    return {
      totalTopics,
      averageScore: Math.round(averageScore),
      averageGap: Math.round(averageGap),
      estimatedStudyTime
    };
  };

  const stats = calculateStats();

  // Utility functions for enhanced topic display (consistent with mvp-action-plan.tsx)
  const getGapColorClass = (gapScore: number) => {
    if (gapScore >= 40) return "text-destructive"; // High gap - red
    if (gapScore >= 20) return "text-warning"; // Medium gap - yellow
    return "text-success"; // Low gap - green
  };

  const getGapProgressColor = (gapScore: number) => {
    if (gapScore >= 40) return "bg-destructive"; // High gap - red
    if (gapScore >= 20) return "bg-warning"; // Medium gap - yellow
    return "bg-success"; // Low gap - green
  };

  const calculateTargetScore = (currentScore: number, gapScore: number) => {
    return Math.min(100, Math.round(currentScore + gapScore));
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Loading Assessment..."
            description="Please wait while we fetch your assessment data"
            showHomeButton={true}
            variant="centered"
          />
          <div className="mt-8">
            <StudyPlanSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error || !topicPerformance) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Assessment Not Found"
            description="We couldn't find the assessment you're looking for"
            showHomeButton={true}
            variant="centered"
          />
          <div className="flex justify-center mt-8">
            <AssessmentNotFound
              onGoHome={() => setLocation("/")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Assessment Report Preview"
          description={`Report ID: ${reportId}`}
          showHomeButton={false}
          variant="default"
        />

        {/* Action Buttons */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <Button 
            onClick={() => setLocation("/")}
            variant="outline"
            data-testid="button-go-assessment"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Assessment Upload
          </Button>
          <Button
            onClick={() => {
              window.open(`/api/assessment-reports/${reportId}/pdf`, '_blank');
              successFeedback.showPdfDownload();
            }}
            variant="default"
            data-testid="button-download-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          {reportId && (
            <ShareButton
              reportId={reportId}
              title={`Assessment Report - ${stats.totalTopics} Topics`}
              description={`Study plan with ${stats.totalTopics} topics identified. Average score: ${stats.averageScore}%`}
            />
          )}
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTopics}</div>
              <p className="text-xs text-muted-foreground">To Review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageScore}%</div>
              <p className="text-xs text-muted-foreground">Performance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Gap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.averageGap}%</div>
              <p className="text-xs text-muted-foreground">Knowledge Gap</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Study Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor(stats.estimatedStudyTime / 60)}h {stats.estimatedStudyTime % 60}m
              </div>
              <p className="text-xs text-muted-foreground">Estimated</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced High Priority Topics */}
        {highPriority.length > 0 && (
          <TooltipProvider>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <h2 className="text-heading-3">High Priority Topics</h2>
                <Badge variant="destructive">{highPriority.length}</Badge>
                
                {/* Manual refresh button for all topics with status */}
                <div className="flex items-center gap-2 ml-auto">
                  {lastResourceCheck && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                          <Wifi className="h-3 w-3" />
                          <span>Updated: {lastResourceCheck.toLocaleTimeString()}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Last resource availability check</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleManualResourceRefresh}
                        disabled={isRefreshingResources}
                        className="h-6 w-6 p-0"
                        data-testid="button-refresh-all-resources"
                      >
                        <RefreshCw className={cn("h-4 w-4", isRefreshingResources && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh resource availability for all topics</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="space-y-3">
                {highPriority.map((topic, index) => {
                  // Enhanced data validation to prevent NaN issues
                  const rawScore = parseFloat(topic.score || '0');
                  const rawGap = parseFloat(topic.gapScore || '0');
                  const currentScore = Math.round(isNaN(rawScore) ? 0 : rawScore);
                  const gapScore = Math.round(isNaN(rawGap) ? 0 : rawGap);
                  
                  // Enhanced calculations using new utility functions
                  const priorityExplanation = getPriorityExplanation(topic.priority || 1, gapScore);
                  const gapAnalysis = getGapAnalysis(currentScore, gapScore, stats.averageScore);
                  const topicDifficulty = assessTopicDifficulty(topic.topic?.name || '', topic.topic?.subject);
                  const enhancedStudyTime = calculateEnhancedStudyTime(gapScore, topicDifficulty);
                  const enhancedResourceStatus = getEnhancedResourceStatus(topic.topic?.id || '', resourceAvailability);
                  const scoreImpact = calculateScoreImpact(gapScore);
                  
                  return (
                    <Card key={topic.id || `high-${index}`} className={cn(
                      "border-l-4 transition-all duration-200 hover:shadow-lg",
                      gapScore >= 40 ? "border-l-destructive" : gapScore >= 20 ? "border-l-warning" : "border-l-success"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Enhanced Priority Header with Tooltip */}
                            <div className="flex items-center gap-2 mb-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <Badge 
                                      variant="destructive"
                                      className={cn(priorityExplanation.color, priorityExplanation.bgColor)}
                                    >
                                      <Info className="h-3 w-3 mr-1" />
                                      {priorityExplanation.level}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      Confidence: {gapAnalysis.confidenceLevel}
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <div className="space-y-2">
                                    <p className="font-semibold">{priorityExplanation.reasoning}</p>
                                    <p className="text-xs">{priorityExplanation.actionText}</p>
                                    <div className="pt-2 border-t">
                                      <p className="text-xs"><strong>Impact:</strong> {scoreImpact.description}</p>
                                      <p className="text-xs"><strong>Difficulty:</strong> {topicDifficulty} complexity</p>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              
                              {/* Score Impact Badge */}
                              <Badge 
                                variant={scoreImpact.impactLevel === "High" ? "destructive" : 
                                        scoreImpact.impactLevel === "Medium" ? "default" : "outline"}
                                className="text-xs"
                              >
                                <TrendingUp className="h-3 w-3 mr-1" />
                                +{scoreImpact.potentialGain}pt impact
                              </Badge>
                            </div>

                            {/* Enhanced Topic Name with Difficulty Indicator */}
                            <div className="flex items-start gap-2 mb-2">
                              <h3 className="font-semibold text-body flex-1" data-testid={`preview-topic-${topic.topic?.id}`}>
                                {topic.topic?.name || 'Topic Name Not Available'} 
                                <span className={cn("ml-2 text-sm font-medium", getGapColorClass(gapScore))} data-testid={`gap-score-high-${topic.topic?.id}`}>
                                  ({gapScore}% gap)
                                </span>
                              </h3>
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs">
                                    <Brain className="h-3 w-3 mr-1" />
                                    {topicDifficulty.charAt(0).toUpperCase() + topicDifficulty.slice(1)}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Topic complexity level affects study time estimates</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            
                            <p className="text-body-small text-muted-foreground mb-3 flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {topic.topic?.subject || topic.topic?.specialty || 'General'} → {topic.topic?.system || topic.topic?.systemCategory || 'System'}
                            </p>

                            {/* Enhanced Gap Analysis with Performance Comparison */}
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center justify-between text-body-small">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="font-medium cursor-help flex items-center gap-1">
                                      <Activity className="h-3 w-3" />
                                      Knowledge Gap Analysis
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p><strong>Gap Score:</strong> How much improvement is needed</p>
                                      <p><strong>Current:</strong> Your performance level</p>
                                      <p><strong>Target:</strong> Expected proficiency level</p>
                                      <p><strong>{gapAnalysis.impactText}</strong></p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <span className={cn("font-semibold flex items-center gap-1", getGapColorClass(gapScore))}>
                                  <AlertTriangle className="h-3 w-3" />
                                  {gapScore}% gap
                                </span>
                              </div>
                              
                              <div className="relative">
                                <Progress value={gapScore} className="h-3" />
                                <div 
                                  className={cn("absolute inset-0 h-3 rounded-full transition-all", getGapProgressColor(gapScore))}
                                  style={{ width: `${Math.min(gapScore, 100)}%` }}
                                />
                              </div>

                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" />
                                  Current: {gapAnalysis.currentScore}%
                                </span>
                                <span className="flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Target: {gapAnalysis.targetScore}%
                                </span>
                              </div>
                              
                              {/* Performance comparison */}
                              {gapAnalysis.scoreComparison && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <BarChart3 className="h-3 w-3" />
                                    Performance: {gapAnalysis.scoreComparison}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Enhanced Study Time Breakdown */}
                            <div className="space-y-2 mb-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-sm font-medium cursor-help">
                                    <Timer className="h-4 w-4 text-info" />
                                    <span>Recommended Study Plan</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <div className="space-y-2">
                                    <p className="font-semibold">Study Time Breakdown:</p>
                                    <p className="text-xs">• Review concepts: {enhancedStudyTime.breakdown.review} min</p>
                                    <p className="text-xs">• Practice questions: {enhancedStudyTime.breakdown.practice} min</p>
                                    <p className="text-xs">• Estimated sessions: {enhancedStudyTime.sessions}</p>
                                    <p className="text-xs">• Time to mastery: {enhancedStudyTime.timeToMastery}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="text-center p-2 bg-info/10 rounded">
                                  <div className="font-semibold text-info">{formatStudyTime(enhancedStudyTime.totalTime)}</div>
                                  <div className="text-muted-foreground">Total Time</div>
                                </div>
                                <div className="text-center p-2 bg-warning/10 rounded">
                                  <div className="font-semibold text-warning">{enhancedStudyTime.sessions}</div>
                                  <div className="text-muted-foreground">Sessions</div>
                                </div>
                                <div className="text-center p-2 bg-success/10 rounded">
                                  <div className="font-semibold text-success">{enhancedStudyTime.timeToMastery}</div>
                                  <div className="text-muted-foreground">To Master</div>
                                </div>
                              </div>
                            </div>

                            {/* Enhanced Resource Status Display */}
                            <div className={cn("p-3 rounded-lg border", enhancedResourceStatus.bgClassName)}>
                              <div className="flex items-start gap-3">
                                <div className={cn("mt-0.5", enhancedResourceStatus.className)}>
                                  {enhancedResourceStatus.icon === "CheckCircle" ? (
                                    <CheckCircle className="h-5 w-5" />
                                  ) : (
                                    <Clock className="h-5 w-5" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className={cn("font-semibold text-sm", enhancedResourceStatus.className)}>
                                    {enhancedResourceStatus.text}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {enhancedResourceStatus.subtext}
                                  </div>
                                  
                                  {/* Resource type badges for available resources */}
                                  {enhancedResourceStatus.status === "available" && (
                                    <div className="flex gap-1 mt-2">
                                      <Badge variant="outline" className="text-xs">
                                        <FileText className="h-3 w-3 mr-1" />
                                        Study Guides
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        <Activity className="h-3 w-3 mr-1" />
                                        Practice Qs
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        <BookOpen className="h-3 w-3 mr-1" />
                                        Video Lessons
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Target className="h-5 w-5 text-muted-foreground ml-4" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TooltipProvider>
        )}

        {/* Medium Priority Topics */}
        {mediumPriority.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <h2 className="text-heading-3">Medium Priority Topics</h2>
              <Badge variant="secondary">{mediumPriority.length}</Badge>
            </div>
            <div className="space-y-3">
              {mediumPriority.map((topic, index) => {
                // Enhanced data validation to prevent NaN issues
                const rawScore = parseFloat(topic.score || '0');
                const rawGap = parseFloat(topic.gapScore || '0');
                const currentScore = Math.round(isNaN(rawScore) ? 0 : rawScore);
                const gapScore = Math.round(isNaN(rawGap) ? 0 : rawGap);
                const targetScore = calculateTargetScore(currentScore, gapScore);
                
                // Use enhanced resource status from centralized utility
                const topicDifficulty = assessTopicDifficulty(topic.topic?.name || '', topic.topic?.subject);
                const enhancedStudyTime = calculateEnhancedStudyTime(gapScore, topicDifficulty);
                const enhancedResourceStatus = getEnhancedResourceStatus(topic.topic?.id || '', resourceAvailability);
                const ResourceIcon = enhancedResourceStatus.icon === "CheckCircle" ? CheckCircle : Clock;
                
                return (
                  <Card key={topic.id || `medium-${index}`} className={cn(
                    "border-l-4 transition-all duration-200",
                    gapScore >= 40 ? "border-l-destructive" : gapScore >= 20 ? "border-l-warning" : "border-l-success"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              Priority {topic.priority}
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                                  <Timer className="h-3 w-3" /> {formatStudyTime(enhancedStudyTime.totalTime)} study time
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1 text-xs">
                                  <p>• Review: {formatStudyTime(enhancedStudyTime.breakdown.review)}</p>
                                  <p>• Practice: {formatStudyTime(enhancedStudyTime.breakdown.practice)}</p>
                                  <p>• Sessions: {enhancedStudyTime.sessions}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          
                          <h3 className="font-semibold text-body mb-1" data-testid={`preview-medium-topic-${topic.topic?.id}`}>
                            {topic.topic?.name || 'Topic Name Not Available'} 
                            <span className={cn("ml-2 text-sm font-medium", getGapColorClass(gapScore))} data-testid={`gap-score-medium-${topic.topic?.id}`}>
                              ({gapScore}% gap)
                            </span>
                          </h3>
                          
                          <p className="text-body-small text-muted-foreground mb-3">
                            {topic.topic?.subject || topic.topic?.specialty || 'General'} → {' '}
                            {topic.topic?.system || topic.topic?.systemCategory || 'System'}
                          </p>

                          {/* Gap analysis */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between text-body-small">
                              <span className="font-medium">Knowledge Gap:</span>
                              <span className={cn("font-semibold", getGapColorClass(gapScore))}>
                                {gapScore}% gap
                              </span>
                            </div>
                            
                            <div className="relative">
                              <Progress value={gapScore} className="h-2" />
                              <div 
                                className={cn("absolute inset-0 h-2 rounded-full transition-all", getGapProgressColor(gapScore))}
                                style={{ width: `${Math.min(gapScore, 100)}%` }}
                              />
                            </div>

                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Current: {currentScore}%</span>
                              <span>Target: {targetScore}%</span>
                            </div>
                          </div>

                          {/* Enhanced resource availability with consistent display */}
                          <div className={cn("p-2 rounded border", enhancedResourceStatus.bgClassName)}>
                            <div className="flex items-center gap-2 text-sm">
                              <ResourceIcon className={cn("h-4 w-4", enhancedResourceStatus.className)} />
                              <div className="flex-1">
                                <div className={cn("font-medium", enhancedResourceStatus.className)}>
                                  {enhancedResourceStatus.text}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {enhancedResourceStatus.subtext}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <BookOpen className="h-5 w-5 text-muted-foreground ml-4" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Low Priority Topics */}
        {lowPriority.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-success" />
              <h2 className="text-heading-3">Review Topics</h2>
              <Badge variant="outline">{lowPriority.length}</Badge>
            </div>
            <div className="space-y-3">
              {lowPriority.map((topic, index) => {
                // Enhanced data validation to prevent NaN issues
                const rawScore = parseFloat(topic.score || '0');
                const rawGap = parseFloat(topic.gapScore || '0');
                const currentScore = Math.round(isNaN(rawScore) ? 0 : rawScore);
                const gapScore = Math.round(isNaN(rawGap) ? 0 : rawGap);
                const targetScore = calculateTargetScore(currentScore, gapScore);
                
                // Use enhanced resource status from centralized utility
                const topicDifficulty = assessTopicDifficulty(topic.topic?.name || '', topic.topic?.subject);
                const enhancedStudyTime = calculateEnhancedStudyTime(gapScore, topicDifficulty);
                const enhancedResourceStatus = getEnhancedResourceStatus(topic.topic?.id || '', resourceAvailability);
                const ResourceIcon = enhancedResourceStatus.icon === "CheckCircle" ? CheckCircle : Clock;
                
                return (
                  <Card key={topic.id || `low-${index}`} className={cn(
                    "border-l-4 transition-all duration-200",
                    gapScore >= 40 ? "border-l-destructive" : gapScore >= 20 ? "border-l-warning" : "border-l-success"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              Priority {topic.priority}
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                                  <Timer className="h-3 w-3" /> {formatStudyTime(enhancedStudyTime.totalTime)} study time
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1 text-xs">
                                  <p>• Review: {formatStudyTime(enhancedStudyTime.breakdown.review)}</p>
                                  <p>• Practice: {formatStudyTime(enhancedStudyTime.breakdown.practice)}</p>
                                  <p>• Sessions: {enhancedStudyTime.sessions}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          
                          <h3 className="font-semibold text-body mb-1" data-testid={`preview-low-topic-${topic.topic?.id}`}>
                            {topic.topic?.name || 'Topic Name Not Available'} 
                            <span className={cn("ml-2 text-sm font-medium", getGapColorClass(gapScore))} data-testid={`gap-score-low-${topic.topic?.id}`}>
                              ({gapScore}% gap)
                            </span>
                          </h3>
                          
                          <p className="text-body-small text-muted-foreground mb-3">
                            {topic.topic?.subject || topic.topic?.specialty || 'General'} → {' '}
                            {topic.topic?.system || topic.topic?.systemCategory || 'System'}
                          </p>

                          {/* Gap analysis */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between text-body-small">
                              <span className="font-medium">Knowledge Gap:</span>
                              <span className={cn("font-semibold", getGapColorClass(gapScore))}>
                                {gapScore}% gap
                              </span>
                            </div>
                            
                            <div className="relative">
                              <Progress value={gapScore} className="h-2" />
                              <div 
                                className={cn("absolute inset-0 h-2 rounded-full transition-all", getGapProgressColor(gapScore))}
                                style={{ width: `${Math.min(gapScore, 100)}%` }}
                              />
                            </div>

                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Current: {currentScore}%</span>
                              <span>Target: {targetScore}%</span>
                            </div>
                          </div>

                          {/* Enhanced resource availability with consistent display */}
                          <div className={cn("p-2 rounded border", enhancedResourceStatus.bgClassName)}>
                            <div className="flex items-center gap-2 text-sm">
                              <ResourceIcon className={cn("h-4 w-4", enhancedResourceStatus.className)} />
                              <div className="flex-1">
                                <div className={cn("font-medium", enhancedResourceStatus.className)}>
                                  {enhancedResourceStatus.text}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {enhancedResourceStatus.subtext}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <BookOpen className="h-5 w-5 text-muted-foreground ml-4" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No Topics Message */}
        {topicPerformance.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No topics found in this assessment report.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}