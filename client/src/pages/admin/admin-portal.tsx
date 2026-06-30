import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Database, Settings, BookOpen, BarChart3, Users, 
  Home, Shield, Activity, Package, Map, Import,
  Table, Code, Search, Plus, Download, RefreshCw,
  FileSpreadsheet, TrendingUp, GraduationCap, GitBranch
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getAnalyticsSummary } from "@/lib/analytics";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { useAuth } from "@/contexts/auth-context";

export default function AdminPortal() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [analytics, setAnalytics] = useState<any>({});

  useEffect(() => {
    if (token) {
      loadSystemStatus();
      loadStatistics();
      loadAnalytics();
    }
  }, [token]);

  const loadSystemStatus = async () => {
    try {
      if (!token) return;
      
      // Check database status
      const dbResponse = await fetch('/api/admin/system/database-status', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (dbResponse.ok) {
        const status = await dbResponse.json();
        setSystemStatus(status);
      }
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      if (!token) return;
      
      const response = await fetch('/api/admin/resources/stats', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const loadAnalytics = () => {
    const summary = getAnalyticsSummary();
    setAnalytics(summary);
  };

  const adminSections = [
    {
      title: "Crosswalk Manager",
      description: "Map relationships between content areas, topics, and learning paths",
      icon: <GitBranch className="h-5 w-5" />,
      path: "/admin/crosswalk",
      color: "bg-purple-600",
      stats: "New System"
    },
    {
      title: "Assessment Manager",
      description: "Upload student assessments and customize study guides",
      icon: <GraduationCap className="h-5 w-5" />,
      path: "/admin/assessment-manager",
      color: "bg-emerald-500",
      stats: "New Feature"
    },
    {
      title: "Content Workflow",
      description: "Streamlined import and categorization pipeline",
      icon: <FileSpreadsheet className="h-5 w-5" />,
      path: "/admin/content-workflow",
      color: "bg-indigo-500",
      stats: "Full Pipeline"
    },
    {
      title: "Content Import",
      description: "Import nursing content from various formats",
      icon: <Import className="h-5 w-5" />,
      path: "/admin/content-import",
      color: "bg-blue-500",
      stats: "Legacy Mode"
    },
    {
      title: "Content Mapping",
      description: "AI-powered categorization and tagging",
      icon: <Map className="h-5 w-5" />,
      path: "/admin/content-mapper",
      color: "bg-purple-500",
      stats: "Auto-AI Mode"
    },
    {
      title: "Database Manager",
      description: "Browse and edit database tables",
      icon: <Database className="h-5 w-5" />,
      path: "/admin/database",
      color: "bg-blue-500",
      stats: systemStatus.tableCount ? `${systemStatus.tableCount} tables` : "Loading..."
    }
  ];

  const quickActions = [
    { label: "Import Workflow", icon: <Plus className="h-4 w-4" />, action: () => navigate("/admin/content-workflow") },
    { label: "Map Content", icon: <Map className="h-4 w-4" />, action: () => navigate("/admin/content-mapper") },
    { label: "Refresh", icon: <RefreshCw className="h-4 w-4" />, action: () => { loadSystemStatus(); loadStatistics(); } }
  ];

  return (
    <>
      <AdminNavigation currentPage="Admin Dashboard" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header */}
          <div className="mb-8 pt-4">
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-slate-700" />
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                  <p className="text-slate-600">Backend development and management center</p>
                </div>
              </div>
            </div>

          {/* System Status Bar */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">System Status:</span>
                    <Badge className="bg-green-100 text-green-700">Operational</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Database:</span>
                    <Badge variant="outline">
                      {systemStatus.connected ? 'Connected' : 'Checking...'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Resources:</span>
                    <Badge variant="outline">{stats.totalResources || 0}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Opt-in:</span>
                    <Badge variant="outline">{analytics.optInRate || 0}%</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Upsell:</span>
                    <Badge variant="outline">{analytics.upsellRate || 0}%</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      size="sm"
                      variant="ghost"
                      onClick={action.action}
                      data-testid={`button-${action.label.toLowerCase().replace(' ', '-')}`}
                    >
                      {action.icon}
                      <span className="ml-2 hidden md:inline">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Navigation Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {adminSections.map((section) => (
            <Card 
              key={section.path}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(section.path)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg text-white ${section.color}`}>
                    {section.icon}
                  </div>
                  <Badge variant="secondary">{section.stats}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold text-lg mb-1">{section.title}</h3>
                <p className="text-sm text-gray-600">{section.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">
                  {stats.totalResources || 0}
                </p>
                <p className="text-sm text-blue-600">Total Resources</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">
                  {stats.topicsCount || 0}
                </p>
                <p className="text-sm text-green-600">Topics Mapped</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-700">
                  {stats.diagnosesCount || 0}
                </p>
                <p className="text-sm text-purple-600">Diagnoses</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-700">
                  {stats.avgRelevanceScore || 0}%
                </p>
                <p className="text-sm text-orange-600">Avg Relevance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
