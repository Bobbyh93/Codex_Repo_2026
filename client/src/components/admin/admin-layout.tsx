import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { setCsrfToken, useAdminAuth } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Database,
  FileText,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Activity,
  Package,
  Upload,
  GitBranch,
  Search,
  Bot,
  Map,
  BarChart3,
  Shield,
  Phone
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Call Bookings", href: "/admin/call-bookings", icon: Phone },
  { name: "Knowledge Base", href: "/admin/knowledge-base", icon: Database },
  { name: "Content Import", href: "/admin/content-import", icon: Upload },
  { name: "Lesson Builder", href: "/admin/lesson-builder", icon: Package },
  { name: "Database Manager", href: "/admin/database", icon: Database },
  { name: "Content Mapper (post-MVP)", href: "/admin/content-mapper", icon: Map },
  { name: "Resources (post-MVP)", href: "/admin/resources", icon: BookOpen },
  { name: "Topics Queue (post-MVP)", href: "/admin/topics-queue", icon: Brain },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authCheckError, setAuthCheckError] = useState("");
  const { logout } = useAdminAuth();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const checkAuthentication = async () => {
      try {
        const response = await fetch("/api/admin/session", {
          credentials: "include",
          signal: controller.signal,
        });

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (data.csrfToken) {
            setCsrfToken(data.csrfToken);
          }
          if (data.authenticated === true) {
            setIsAuthenticated(true);
            setAuthCheckError("");
            return;
          }
        }

        if (response.status === 401 || response.status === 403 || response.ok) {
          navigate("/admin/login");
          return;
        }

        setAuthCheckError("Admin session could not be verified. Refresh when the server is available.");
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        console.warn("Session check unavailable:", error);
        setAuthCheckError("Admin session could not be verified. Refresh when the server is available.");
      }
    };
    
    checkAuthentication();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [navigate]);

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      navigate("/admin/login");
    } else {
      console.error("Logout failed");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-md border bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-medium text-slate-900">
            {authCheckError ? "Admin session check paused" : "Checking admin session..."}
          </div>
          {authCheckError ? (
            <p className="mt-2 text-sm text-slate-600">{authCheckError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col bg-slate-900 text-white transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Admin Portal</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-slate-800"
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Button
                  key={item.name}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-white hover:bg-slate-800",
                    isActive && "bg-slate-800",
                    !sidebarOpen && "justify-center px-2"
                  )}
                  onClick={() => navigate(item.href)}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className={cn("h-4 w-4", sidebarOpen && "mr-3")} />
                  {sidebarOpen && <span>{item.name}</span>}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-slate-800"
            onClick={handleLogout}
            data-testid="button-admin-logout"
          >
            <LogOut className={cn("h-4 w-4", sidebarOpen && "mr-3")} />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">NursePrep Analytics Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              System Status: Healthy
            </Button>
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Quick Search
            </Button>
          </div>
        </div>

        {/* Page Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
