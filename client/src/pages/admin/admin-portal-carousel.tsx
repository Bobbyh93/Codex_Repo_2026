import { useState, useEffect } from "react";
import { CarouselCard } from "@/components/ui/carousel-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { 
  Database, Settings, BookOpen, BarChart3, Users, 
  Home, Shield, Activity, Package, Map, Import,
  FileSpreadsheet, GraduationCap, Plus, TrendingUp,
  ArrowRight, ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getAnalyticsSummary } from "@/lib/analytics";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { useAdminAuth } from "@/lib/admin-auth";

export default function AdminPortalCarousel() {
  useScrollToTop();
  
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { getAdminHeaders } = useAdminAuth();
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [stats, setStats] = useState<any>({});
  const [analytics, setAnalytics] = useState<any>({});

  useEffect(() => {
    loadSystemStatus();
    loadStatistics();
    loadAnalytics();
  }, []);

  const loadSystemStatus = async () => {
    try {
      const dbResponse = await fetch('/api/admin/system/database-status', {
        headers: { ...getAdminHeaders() }
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
      const response = await fetch('/api/admin/resources/stats', {
        headers: { ...getAdminHeaders() }
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

  const adminCards = [
    {
      id: "assessment",
      title: "Assessment Manager",
      description: "Upload and manage student assessments",
      icon: <GraduationCap className="h-6 w-6 text-emerald-600" />,
      color: "bg-emerald-100",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-sm text-emerald-600 font-medium">Recent Uploads</p>
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-600 font-medium">Study Guides</p>
              <p className="text-2xl font-bold">8</p>
              <p className="text-xs text-gray-500">Sent this week</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Key Features:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Upload student PDF assessments
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Customize study guides with notes
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Email personalized PDFs to students
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full" 
            onClick={() => navigate("/admin/assessment-manager")}
            data-testid="button-assessment-manager"
          >
            Open Assessment Manager
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      actions: (
        <Badge className="bg-emerald-100 text-emerald-700">Featured</Badge>
      )
    },
    {
      id: "content",
      title: "Content Workflow",
      description: "Import and categorize nursing content",
      icon: <FileSpreadsheet className="h-6 w-6 text-indigo-600" />,
      color: "bg-indigo-100",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-lg p-3">
              <p className="text-sm text-indigo-600 font-medium">Topics</p>
              <p className="text-2xl font-bold">{stats.totalResources || 0}</p>
              <p className="text-xs text-gray-500">Imported</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-sm text-purple-600 font-medium">Categories</p>
              <p className="text-2xl font-bold">15</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Workflow Steps:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Import content from various formats
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                AI-powered categorization
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Map to NCLEX categories
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full" 
            onClick={() => navigate("/admin/content-workflow")}
            variant="secondary"
            data-testid="button-content-workflow"
          >
            Open Content Workflow
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      actions: (
        <Badge variant="outline">Pipeline</Badge>
      )
    },
    {
      id: "database",
      title: "Database Manager",
      description: "Browse and manage database tables",
      icon: <Database className="h-6 w-6 text-blue-600" />,
      color: "bg-blue-100",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-600 font-medium">Tables</p>
              <p className="text-2xl font-bold">{systemStatus.tableCount || 0}</p>
              <p className="text-xs text-gray-500">Available</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm text-green-600 font-medium">Status</p>
              <p className="text-lg font-bold">
                {systemStatus.connected ? 'Connected' : 'Checking...'}
              </p>
              <p className="text-xs text-gray-500">PostgreSQL</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Database Tools:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Browse table data
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Execute SQL queries
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Import/export data
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full" 
            onClick={() => navigate("/admin/database")}
            variant="secondary"
            data-testid="button-database-manager"
          >
            Open Database Manager
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    {
      id: "analytics",
      title: "Analytics Dashboard",
      description: "View system metrics and usage",
      icon: <BarChart3 className="h-6 w-6 text-orange-600" />,
      color: "bg-orange-100",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-sm text-orange-600 font-medium">Opt-in Rate</p>
              <p className="text-2xl font-bold">{analytics.optInRate || 0}%</p>
              <p className="text-xs text-gray-500">Users</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-sm text-yellow-600 font-medium">Sessions</p>
              <p className="text-2xl font-bold">{analytics.totalSessions || 0}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Metrics Available:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                User engagement tracking
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Feature usage statistics
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Performance metrics
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full" 
            variant="secondary"
            disabled
            data-testid="button-analytics"
          >
            Analytics Coming Soon
          </Button>
        </div>
      )
    },
    {
      id: "settings",
      title: "System Settings",
      description: "Configure application settings",
      icon: <Settings className="h-6 w-6 text-gray-600" />,
      color: "bg-gray-100",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Development Mode</span>
              <Badge className="bg-green-100 text-green-700">Active</Badge>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">API Status</span>
              <Badge className="bg-green-100 text-green-700">Operational</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache</span>
              <Badge variant="outline">Enabled</Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Configuration:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Environment variables
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                API configurations
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Feature toggles
              </li>
            </ul>
          </div>
          
          <Button 
            className="w-full" 
            variant="secondary"
            disabled
            data-testid="button-settings"
          >
            Settings Coming Soon
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <AdminNavigation currentPage="Admin Portal" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
        <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-slate-100 rounded-full">
              <Shield className="h-8 w-8 text-slate-700" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Portal</h1>
          <p className="text-gray-600 mt-2">Backend development and management center</p>
        </div>

        {/* System Status Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-around flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">System:</span>
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
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Active:</span>
                <Badge variant="outline">{analytics.optInRate || 0}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Carousel */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-center">Swipe to Navigate Admin Tools</h2>
          <CarouselCard
            cards={adminCards}
            showIndicators={true}
            className="max-w-2xl mx-auto"
          />
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-4 mt-8">
          <Button
            onClick={() => navigate("/admin/assessment-manager")}
            data-testid="button-quick-assessment"
          >
            <GraduationCap className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/content-workflow")}
            data-testid="button-quick-import"
          >
            <Import className="mr-2 h-4 w-4" />
            Import Content
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/assessments")}
            data-testid="button-view-assessments"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            View All Assessments
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}