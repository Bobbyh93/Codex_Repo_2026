import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  Users, FileText, TrendingUp, AlertCircle, BookOpen, 
  Activity, Download, Brain, Target, Clock, CheckCircle,
  Upload, Sparkles, PlusCircle
} from "lucide-react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/admin/admin-layout";
import { useAdminAuth } from "@/lib/admin-auth";
import { AdminTopicCard } from "@/components/admin/admin-topic-card";
import { queryClient } from "@/lib/queryClient";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [timeRange, setTimeRange] = useState("7d");
  const { makeAdminRequest } = useAdminAuth();

  // Fetch admin statistics
  const { data: adminStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await makeAdminRequest("/api/admin/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    }
  });

  const { data: topicsQueue } = useQuery({
    queryKey: ["/api/admin/topics-queue"],
    queryFn: async () => {
      const response = await makeAdminRequest("/api/admin/topics-queue");
      if (!response.ok) throw new Error("Failed to fetch topics queue");
      return response.json();
    }
  });

  const { data: analytics } = useQuery({
    queryKey: ["/api/admin/analytics", timeRange],
    queryFn: async () => {
      const response = await makeAdminRequest(`/api/admin/analytics?timeRange=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    }
  });

  // Sample data for charts (would come from API)
  const mostMissedTopics = [
    { topic: "Pharmacology Calculations", missRate: 82, students: 1543 },
    { topic: "Acid-Base Balance", missRate: 78, students: 1421 },
    { topic: "Cardiac Dysrhythmias", missRate: 75, students: 1389 },
    { topic: "Fluid & Electrolytes", missRate: 71, students: 1298 },
    { topic: "Neurological Assessment", missRate: 68, students: 1176 },
  ];

  const weeklyUsage = [
    { day: "Mon", uploads: 45, users: 320 },
    { day: "Tue", uploads: 52, users: 380 },
    { day: "Wed", uploads: 48, users: 350 },
    { day: "Thu", uploads: 61, users: 420 },
    { day: "Fri", uploads: 55, users: 390 },
    { day: "Sat", uploads: 32, users: 280 },
    { day: "Sun", uploads: 28, users: 240 },
  ];

  const performanceBySpecialty = [
    { name: "Med-Surg", value: 35, avgScore: 72 },
    { name: "Pediatrics", value: 20, avgScore: 68 },
    { name: "Maternal", value: 15, avgScore: 70 },
    { name: "Mental Health", value: 18, avgScore: 75 },
    { name: "Critical Care", value: 12, avgScore: 65 },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Dashboard Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor platform performance and manage content</p>
        </div>

        <Alert className="border-blue-200 bg-blue-50 text-blue-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            MVP focus: Knowledge Base intake, Lesson Builder generation/review/publish, learner lesson view, and Database Manager export. Analytics, Resources, Topics Queue, and generic Content Mapper are post-MVP surfaces.
          </AlertDescription>
        </Alert>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : adminStats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {adminStats?.totalUsers > 0 ? (
                  <><span className="text-green-600">+12%</span> from last month</>
                ) : (
                  "No users yet • Upload assessments to start"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reports Processed</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : adminStats?.totalReports || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {adminStats?.totalReports > 0 ? (
                  <><span className="text-green-600">+8%</span> from last month</>
                ) : (
                  "Ready to process assessment reports"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Topics</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : adminStats?.totalTopics || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {adminStats?.totalTopics > 0 ? (
                  "Nursing topics tracked"
                ) : (
                  "Extract topics from assessments"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : adminStats?.totalResources || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {adminStats?.totalResources > 0 ? (
                  "Learning materials"
                ) : (
                  "Add resources to topics"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Topics Need Resources</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {statsLoading ? "..." : adminStats?.topicsNeedingResources || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {adminStats?.topicsNeedingResources > 0 ? (
                  "Pending content creation"
                ) : (
                  adminStats?.totalTopics > 0 ? (
                    "All topics have resources ✅"
                  ) : (
                    "Extract topics first"
                  )
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="topics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="topics">Topic Analysis</TabsTrigger>
            <TabsTrigger value="usage">Usage Patterns</TabsTrigger>
            <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
            <TabsTrigger value="resources">Resource Management</TabsTrigger>
          </TabsList>

          <TabsContent value="topics" className="space-y-4">
            {/* Check if we have any data to display */}
            {adminStats?.totalTopics === 0 || !adminStats ? (
              <EmptyState
                icon={Brain}
                title="No Topics Data Yet"
                description="Start by uploading assessment reports and extracting topics to see analytics here. The system will automatically track which topics students struggle with most."
                action={{
                  label: "Go to AI Analyzer",
                  onClick: () => navigate("/admin/ai-analyzer"),
                  testId: "button-go-to-ai-analyzer"
                }}
                secondaryAction={{
                  label: "Upload Assessment",
                  onClick: () => navigate("/admin/assessment-manager"),
                  variant: "outline",
                  testId: "button-upload-assessment"
                }}
              />
            ) : (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Most Missed Topics */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Challenging Topics</CardTitle>
                  <CardDescription>Topics students struggle with most</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mostMissedTopics.map((topic, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{topic.topic}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={topic.missRate > 75 ? "destructive" : "secondary"}>
                              {topic.missRate}% miss
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {topic.students} students
                            </span>
                          </div>
                        </div>
                        <Progress value={topic.missRate} className="h-2" />
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    <Brain className="h-4 w-4 mr-2" />
                    Add Study Resources for These Topics
                  </Button>
                </CardContent>
              </Card>

              {/* Performance by Specialty */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance by Course Specialty</CardTitle>
                  <CardDescription>Average scores across different nursing specialties</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={performanceBySpecialty}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.avgScore}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {performanceBySpecialty.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations Engine */}
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Recommendations</CardTitle>
                <CardDescription>System-generated insights based on aggregate data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <Target className="h-4 w-4" />
                    <AlertDescription>
                      <strong>High Priority:</strong> 82% of students miss Pharmacology Calculations. 
                      Consider creating additional practice modules with step-by-step solutions.
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Pattern Detected:</strong> Students who struggle with Acid-Base Balance 
                      also tend to miss Fluid & Electrolytes (78% correlation). Create linked study paths.
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <BookOpen className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Resource Gap:</strong> Mental Health topics have 40% fewer study resources 
                      but show 18% of total usage. Consider expanding this content area.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
            </>
            )}
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            {adminStats?.totalUsers === 0 || !adminStats ? (
              <EmptyState
                icon={Activity}
                title="No Usage Data Available"
                description="Once students start using the platform and uploading assessments, you'll see detailed usage patterns and trends here."
                action={{
                  label: "Learn About Analytics",
                  onClick: () => navigate("/admin/demand-analytics"),
                  testId: "button-learn-analytics"
                }}
              />
            ) : (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Weekly Usage Patterns</CardTitle>
                <CardDescription>User activity and upload trends over the past week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="uploads" stroke="#8884d8" name="Uploads" />
                    <Line yAxisId="right" type="monotone" dataKey="users" stroke="#82ca9d" name="Active Users" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Peak Usage Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Weekdays 7-9 PM</span>
                      <Badge>45% of traffic</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Sunday 2-5 PM</span>
                      <Badge>28% of traffic</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Saturday 10 AM-12 PM</span>
                      <Badge>18% of traffic</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upload Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">ATI Reports</span>
                      <div className="flex items-center gap-2">
                        <Progress value={68} className="w-20 h-2" />
                        <span className="text-sm">68%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Syllabi</span>
                      <div className="flex items-center gap-2">
                        <Progress value={32} className="w-20 h-2" />
                        <span className="text-sm">32%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Student Success Metrics</CardTitle>
                <CardDescription>Track improvement rates and study plan effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Avg. Score Improvement</p>
                    <p className="text-2xl font-bold text-green-600">+15.3%</p>
                    <p className="text-xs text-muted-foreground">After using study plans</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Study Plan Completion</p>
                    <p className="text-2xl font-bold">62%</p>
                    <Progress value={62} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Return Users</p>
                    <p className="text-2xl font-bold">78%</p>
                    <p className="text-xs text-muted-foreground">Upload multiple reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Resource Library Management</CardTitle>
                    <CardDescription>Manage study materials and learning resources</CardDescription>
                  </div>
                  <Button>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Total Resources</p>
                        <p className="text-2xl font-bold">1,847</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Topics Covered</p>
                        <p className="text-2xl font-bold">243</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Avg. Rating</p>
                        <p className="text-2xl font-bold">4.3/5</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Resource Gaps (Topics Needing Content)</h4>
                    <div className="space-y-3">
                      {["Pediatric Emergencies", "Geriatric Care", "Cultural Competency", "Legal/Ethical Issues"].map((topicName, index) => (
                        <AdminTopicCard
                          key={topicName}
                          topic={{
                            id: `gap-${index}`,
                            topicName,
                            missRate: 65 + index * 5,
                            students: 850 + index * 100
                          }}
                          variant="gaps"
                          onUpdate={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Latest assessment uploads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(adminStats?.recentReports) && adminStats.recentReports.slice(0, 5).map((report: any) => (
                  <div key={report.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{report.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.uploadDate && !isNaN(new Date(report.uploadDate).getTime()) ? new Date(report.uploadDate).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <Badge variant="outline">{report.processingStatus}</Badge>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No recent reports</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topics Queue</CardTitle>
              <CardDescription>High priority topics needing resources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(topicsQueue) && topicsQueue.length > 0 ? (
                  topicsQueue.slice(0, 3).map((topic: any) => (
                    <AdminTopicCard
                      key={topic.id}
                      topic={topic}
                      variant="queue"
                      onUpdate={() => {
                        // Refetch data when resource is added
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue"] });
                      }}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No topics in queue</p>
                )}
              </div>
              {Array.isArray(topicsQueue) && topicsQueue.length > 3 && (
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => navigate("/admin/topics-queue")}
                >
                  View All Topics ({topicsQueue.length})
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
