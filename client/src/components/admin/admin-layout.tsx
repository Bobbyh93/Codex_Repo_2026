import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { setCsrfToken, useAdminAuth } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { adminMvpNavigation } from "@/lib/mvp-navigation";
import { Shield, LogOut, ChevronLeft, Menu } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

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

  const activeItem = adminMvpNavigation.find((item) => {
    return location === item.href || (location === "/admin" && item.href === "/admin/dashboard");
  });

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
      <div
        className={cn(
          "flex flex-col bg-slate-950 text-white transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          {sidebarOpen && (
            <div className="flex min-w-0 items-center gap-2">
              <Shield className="h-6 w-6 shrink-0 text-primary" />
              <span className="truncate text-lg font-bold">NurseStudy Admin</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-slate-800"
            data-testid="button-toggle-sidebar"
            aria-label={sidebarOpen ? "Collapse admin sidebar" : "Expand admin sidebar"}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2" aria-label="Admin MVP navigation">
            {adminMvpNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (location === "/admin" && item.href === "/admin/dashboard");
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-white hover:bg-slate-800",
                    isActive && "bg-slate-800",
                    !sidebarOpen && "justify-center px-2"
                  )}
                  onClick={() => navigate(item.href)}
                  data-testid={`nav-${item.testId}`}
                  aria-current={isActive ? "page" : undefined}
                  title={!sidebarOpen ? item.title : undefined}
                >
                  <Icon className={cn("h-4 w-4", sidebarOpen && "mr-3")} />
                  {sidebarOpen && <span className="truncate">{item.title}</span>}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-slate-800 p-4">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-white hover:bg-slate-800",
              !sidebarOpen && "justify-center px-2"
            )}
            onClick={handleLogout}
            data-testid="button-admin-logout"
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <LogOut className={cn("h-4 w-4", sidebarOpen && "mr-3")} />
            {sidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">NurseStudy Admin</h1>
            <p className="text-sm text-slate-500">
              {activeItem?.title || "MVP workspace"}
            </p>
          </div>
          <div className="hidden items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 sm:flex">
            MVP navigation
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
