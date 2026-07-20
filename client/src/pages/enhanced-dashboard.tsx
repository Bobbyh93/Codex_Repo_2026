import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
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
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  BookOpen, 
  Award,
  Calendar,
  Activity,
  Users,
  FileText,
  ChevronRight,
  Brain,
  Trophy
} from 'lucide-react';
import { Link } from 'wouter';

interface DashboardStats {
  totalStudyTime: number;
  averageScore: number;
  topicsStudied: number;
  topicsMastered: number;
  questionsAnswered: number;
  correctAnswers: number;
  currentStreak: number;
  assessmentsCompleted: number;
}

interface PerformanceTrend {
  date: string;
  score: number;
  studyTime: number;
}

interface TopicProgress {
  topic: string;
  currentScore: number;
  targetScore: number;
  progressPercentage: number;
  masteryLevel: string;
}

export function EnhancedDashboard() {
  const { user } = useAuth();
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');

  // Fetch dashboard statistics (fallback to sample data if endpoints don't exist)
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', user?.id],
    enabled: !!user,
    retry: false, // Don't retry missing endpoints
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch performance trends (fallback to sample data if endpoints don't exist)
  const { data: trends, isLoading: trendsLoading, error: trendsError } = useQuery<PerformanceTrend[]>({
    queryKey: ['/api/dashboard/trends', selectedTimeRange],
    enabled: !!user,
    retry: false, // Don't retry missing endpoints
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch topic progress (fallback to sample data if endpoints don't exist)
  const { data: topicProgress, isLoading: progressLoading, error: progressError } = useQuery<TopicProgress[]>({
    queryKey: ['/api/dashboard/topic-progress'],
    enabled: !!user,
    retry: false, // Don't retry missing endpoints
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch upcoming study sessions (fallback to sample data if endpoints don't exist)
  const { data: upcomingSessions, error: sessionsError } = useQuery({
    queryKey: ['/api/dashboard/upcoming-sessions'],
    enabled: !!user,
    retry: false, // Don't retry missing endpoints
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Sample data for demonstration
  const sampleStats: DashboardStats = {
    totalStudyTime: 1250,
    averageScore: 78.5,
    topicsStudied: 24,
    topicsMastered: 8,
    questionsAnswered: 342,
    correctAnswers: 268,
    currentStreak: 5,
    assessmentsCompleted: 3,
  };

  const sampleTrends: PerformanceTrend[] = [
    { date: 'Mon', score: 72, studyTime: 120 },
    { date: 'Tue', score: 75, studyTime: 90 },
    { date: 'Wed', score: 73, studyTime: 150 },
    { date: 'Thu', score: 78, studyTime: 180 },
    { date: 'Fri', score: 82, studyTime: 200 },
    { date: 'Sat', score: 80, studyTime: 160 },
    { date: 'Sun', score: 85, studyTime: 140 },
  ];

  const sampleTopicProgress: TopicProgress[] = [
    { topic: 'Cardiovascular', currentScore: 82, targetScore: 85, progressPercentage: 96, masteryLevel: 'proficient' },
    { topic: 'Respiratory', currentScore: 78, targetScore: 85, progressPercentage: 91, masteryLevel: 'intermediate' },
    { topic: 'Pharmacology', currentScore: 70, targetScore: 85, progressPercentage: 82, masteryLevel: 'intermediate' },
    { topic: 'Pediatrics', currentScore: 65, targetScore: 85, progressPercentage: 76, masteryLevel: 'beginner' },
    { topic: 'Mental Health', currentScore: 88, targetScore: 85, progressPercentage: 100, masteryLevel: 'mastered' },
  ];

  const pieData = [
    { name: 'Mastered', value: 8, color: '#10b981' },
    { name: 'Proficient', value: 6, color: '#3b82f6' },
    { name: 'Intermediate', value: 7, color: '#f59e0b' },
    { name: 'Beginner', value: 3, color: '#ef4444' },
  ];

  const displayStats: DashboardStats = stats || sampleStats;
  const displayTrends: PerformanceTrend[] = trends || sampleTrends;
  const displayProgress: TopicProgress[] = topicProgress || sampleTopicProgress;

  // Show loading only if we're actually loading and haven't errored out
  const isActuallyLoading = (statsLoading && !statsError) || (trendsLoading && !trendsError) || (progressLoading && !progressError);
  
  if (isActuallyLoading) {
    return <LoadingState message="Loading your dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Your Study Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Track your NCLEX preparation progress and performance
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/study-guide">
              <Button variant="outline" data-testid="button-study-guide">
                <BookOpen className="mr-2 h-4 w-4" />
                Study Guide
              </Button>
            </Link>
            <Link href="/practice">
              <Button data-testid="button-practice">
                <Brain className="mr-2 h-4 w-4" />
                Practice Questions
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.currentStreak} days</div>
              <p className="text-xs text-muted-foreground">Keep it up!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{displayStats.averageScore}%</div>
              <div className="flex items-center text-xs">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500">+5.2% from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Study Time</CardTitle>
              <Clock className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.floor(displayStats.totalStudyTime / 60)}h</div>
              <p className="text-xs text-muted-foreground">Total this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round((displayStats.correctAnswers / displayStats.questionsAnswered) * 100)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {displayStats.correctAnswers}/{displayStats.questionsAnswered} correct
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="progress">Topic Progress</TabsTrigger>
            <TabsTrigger value="trends">Performance Trends</TabsTrigger>
            <TabsTrigger value="schedule">Study Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Performance</CardTitle>
                  <CardDescription>Your score progression over the past week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={displayTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Topic Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Topic Mastery Distribution</CardTitle>
                  <CardDescription>Your progress across all topics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recent Assessments */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Assessments</CardTitle>
                <CardDescription>Your latest assessment results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Nursing Assessment {i}</p>
                          <p className="text-sm text-muted-foreground">
                            Completed {i * 3} days ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={i === 1 ? "default" : "secondary"}>
                          {75 + i * 3}% Score
                        </Badge>
                        <Link href={`/analysis?id=${i}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-${i}`}>
                            View
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Topic-by-Topic Progress</CardTitle>
                <CardDescription>Track your mastery level for each nursing topic</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {displayProgress.map((topic, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{topic.topic}</span>
                          <Badge 
                            variant={
                              topic.masteryLevel === 'mastered' ? 'default' :
                              topic.masteryLevel === 'proficient' ? 'secondary' :
                              topic.masteryLevel === 'intermediate' ? 'outline' :
                              'destructive'
                            }
                          >
                            {topic.masteryLevel}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {topic.currentScore}% / {topic.targetScore}%
                        </span>
                      </div>
                      <Progress value={topic.progressPercentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Study Time vs Performance</CardTitle>
                <CardDescription>Correlation between study time and scores</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="score" fill="#3b82f6" name="Score (%)" />
                    <Bar yAxisId="right" dataKey="studyTime" fill="#10b981" name="Study Time (min)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Study Sessions</CardTitle>
                <CardDescription>Your scheduled study plan for the week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Today', 'Tomorrow', 'Wednesday'].map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{day} - Cardiovascular System</p>
                          <p className="text-sm text-muted-foreground">
                            2:00 PM - 4:00 PM (2 hours)
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-start-${index}`}>
                        Start Session
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}