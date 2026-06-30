import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, Target, Clock, CheckCircle, 
  AlertCircle, Award, Calendar, BarChart3,
  ArrowUp, ArrowDown, Minus, Home, LogIn, UserPlus
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { LearningHeatmap } from "@/components/learning-heatmap";

interface StudyProgress {
  topicId: string;
  topicName: string;
  startScore: number;
  currentScore: number;
  targetScore: number;
  completedResources: number;
  totalResources: number;
  timeSpent: number;
  lastStudied: string;
}

interface PerformanceMetric {
  metric: string;
  value: number;
  change: number;
  trend: "up" | "down" | "stable";
}

export default function ProgressDashboard() {
  const [, navigate] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("week");
  const { isAuthenticated, user } = useAuth();

  // Fetch user dashboard stats
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/user/dashboard-stats"],
    enabled: isAuthenticated,
  });

  // Fetch user progress by topic
  const { data: userProgress, isLoading: isLoadingProgress } = useQuery({
    queryKey: ["/api/progress/topics"],
    enabled: isAuthenticated,
  });

  // Fetch user assessment reports for progress tracking
  const { data: assessmentReports, isLoading: isLoadingReports } = useQuery({
    queryKey: ["/api/assessment-reports"],
    enabled: isAuthenticated,
  });

  // Calculate progress data from real user data
  const calculateProgressFromData = () => {
    if (!userProgress || !assessmentReports) return [];
    
    return userProgress.map((progress: any) => ({
      topicId: progress.topicId,
      topicName: progress.topic?.name || "Unknown Topic",
      startScore: 60, // Could calculate from first assessment
      currentScore: Math.round(progress.averageScore || 70),
      targetScore: 85,
      completedResources: Math.round((progress.totalStudyTime || 0) / 30), // Estimate from study time
      totalResources: 6, // Could be calculated from available resources
      timeSpent: progress.totalStudyTime || 0,
      lastStudied: progress.lastStudiedAt ? new Date(progress.lastStudiedAt).toLocaleDateString() : "Never"
    }));
  };

  // Calculate metrics from real user data
  const calculateMetricsFromData = () => {
    if (!dashboardStats) {
      return [
        { metric: "Overall Progress", value: 0, change: 0, trend: "stable" as const },
        { metric: "Study Streak", value: 0, change: 0, trend: "stable" as const },
        { metric: "Topics Mastered", value: 0, change: 0, trend: "stable" as const },
        { metric: "Hours Studied", value: 0, change: 0, trend: "stable" as const }
      ];
    }

    return [
      { 
        metric: "Overall Progress", 
        value: Math.round(dashboardStats.averageScore || 0), 
        change: 12, // Could calculate from historical data
        trend: "up" as const 
      },
      { 
        metric: "Study Streak", 
        value: dashboardStats.currentStreak || 0, 
        change: 2, 
        trend: "up" as const 
      },
      { 
        metric: "Topics Mastered", 
        value: dashboardStats.topicsMastered || 0, 
        change: 1, 
        trend: "up" as const 
      },
      { 
        metric: "Hours Studied", 
        value: Math.round((dashboardStats.totalStudyTime || 0) / 60 * 10) / 10, 
        change: -0.5, 
        trend: "down" as const 
      }
    ];
  };

  const progress = calculateProgressFromData();
  const metrics = calculateMetricsFromData();

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Progress Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please log in to view your progress dashboard and track your learning journey.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/login")} className="flex-1">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
              <Button onClick={() => navigate("/register")} variant="outline" className="flex-1">
                <UserPlus className="h-4 w-4 mr-2" />
                Register
              </Button>
            </div>
            <Button onClick={() => navigate("/")} variant="ghost" className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = isLoadingStats || isLoadingProgress || isLoadingReports;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "down": return <ArrowDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getProgressColor = (current: number, start: number) => {
    const improvement = current - start;
    if (improvement >= 15) return "bg-green-500";
    if (improvement >= 10) return "bg-blue-500";
    if (improvement >= 5) return "bg-yellow-500";
    return "bg-gray-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Study
              </Button>
              <Button variant="outline" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Your Learning Progress</h1>
          <p className="text-gray-600">Track your improvement and stay on target</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm text-gray-600">{metric.metric}</span>
                  {getTrendIcon(metric.trend)}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">
                    {metric.metric === "Hours Studied" ? metric.value.toFixed(1) : metric.value}
                    {metric.metric === "Overall Progress" && "%"}
                  </span>
                  <span className={`text-xs ${
                    metric.trend === "up" ? "text-green-600" : 
                    metric.trend === "down" ? "text-red-600" : "text-gray-600"
                  }`}>
                    {metric.change > 0 ? "+" : ""}{metric.change}
                    {metric.metric === "Overall Progress" && "%"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress Tabs */}
        <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedPeriod}>
            {/* Learning Heatmap */}
            <div className="mb-6">
              <LearningHeatmap 
                onCellClick={(activity) => {
                  // Handle cell click - could show detailed modal
                  console.log("Clicked activity:", activity);
                }}
              />
            </div>
            
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Topic Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Topic Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {progress.map((topic) => (
                    <div key={topic.topicId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{topic.topicName}</p>
                          <p className="text-xs text-gray-500">Last studied: {topic.lastStudied}</p>
                        </div>
                        <Badge 
                          className={getProgressColor(topic.currentScore, topic.startScore)}
                        >
                          +{topic.currentScore - topic.startScore}%
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Progress: {topic.currentScore}%</span>
                          <span>Target: {topic.targetScore}%</span>
                        </div>
                        <Progress 
                          value={(topic.currentScore / topic.targetScore) * 100} 
                          className="h-2"
                        />
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {topic.completedResources}/{topic.totalResources} resources
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {topic.timeSpent} min
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Achievement & Milestones */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Quick Learner</p>
                        <p className="text-xs text-gray-600">Improved 10%+ in Pharmacology</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Consistent Study</p>
                        <p className="text-xs text-gray-600">5-day study streak</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                      <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Resource Complete</p>
                        <p className="text-xs text-gray-600">Finished all Cardiac videos</p>
                      </div>
                    </div>
                  </div>

                  {/* Next Milestone */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Next Milestone</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Complete Pharmacology Module</span>
                      <span className="text-xs font-medium">67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Study Recommendations */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="font-medium text-sm mb-1">Review Fluid & Electrolytes</p>
                    <p className="text-xs text-gray-600">Haven't studied in 3 days</p>
                    <Button size="sm" className="mt-2 w-full">Start Review</Button>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="font-medium text-sm mb-1">Complete Cardiac Quiz</p>
                    <p className="text-xs text-gray-600">Test your knowledge</p>
                    <Button size="sm" variant="outline" className="mt-2 w-full">Take Quiz</Button>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="font-medium text-sm mb-1">Keep Momentum!</p>
                    <p className="text-xs text-gray-600">Study 30 min to maintain streak</p>
                    <Button size="sm" variant="outline" className="mt-2 w-full">Continue</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}