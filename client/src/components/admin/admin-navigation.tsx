import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { adminNavigationSections } from "@/lib/mvp-navigation";
import { Home, Shield, Menu, X } from "lucide-react";

interface AdminNavigationProps {
  currentPage?: string;
  className?: string;
}

export function AdminNavigation({ currentPage, className }: AdminNavigationProps) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => location === href;
  const isAdminHome = location === "/admin" || location === "/admin/dashboard";

  return (
    <nav className={cn("sticky top-0 z-50 border-b bg-white", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex min-w-0 items-center">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mr-3 shrink-0"
              data-testid="nav-home"
            >
              <Home className="mr-2 h-5 w-5" />
              <span className="font-semibold">NurseStudy</span>
            </Button>

            <div className="hidden items-center md:flex">
              <span className="mx-2 text-gray-400">/</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/dashboard")}
                className={cn("text-sm", isAdminHome && "bg-gray-100")}
                data-testid="nav-admin"
              >
                <Shield className="mr-1 h-4 w-4" />
                Admin Dashboard
              </Button>
            </div>

            <div className="ml-6 hidden items-center lg:flex">
              <NavigationMenu>
                <NavigationMenuList>
                  {adminNavigationSections.map((section) => (
                    <NavigationMenuItem key={section.title}>
                      <NavigationMenuTrigger className="h-9 px-3">
                        {section.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[420px] gap-3 p-4 md:w-[520px] md:grid-cols-2">
                          {section.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <li key={item.href}>
                                <NavigationMenuLink asChild>
                                  <a
                                    href={item.href}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      navigate(item.href);
                                    }}
                                    aria-current={isActive(item.href) ? "page" : undefined}
                                    className={cn(
                                      "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                      isActive(item.href) && "bg-accent"
                                    )}
                                    data-testid={`nav-${item.testId}`}
                                  >
                                    <div className="flex items-center gap-2 text-sm font-medium leading-none">
                                      <Icon className="h-4 w-4" />
                                      {item.title}
                                    </div>
                                    <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                      {item.description}
                                    </p>
                                  </a>
                                </NavigationMenuLink>
                              </li>
                            );
                          })}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          {currentPage && (
            <div className="hidden items-center md:flex">
              <span className="mr-2 text-sm text-gray-500">Current:</span>
              <span className="text-sm font-medium text-gray-900">{currentPage}</span>
            </div>
          )}

          <div className="flex items-center lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-button"
              aria-label={mobileMenuOpen ? "Close admin navigation" : "Open admin navigation"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t bg-white lg:hidden">
          <div className="space-y-4 px-2 pb-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                navigate("/admin/dashboard");
                setMobileMenuOpen(false);
              }}
              className={cn(
                "w-full justify-start px-3 py-2 text-sm font-medium",
                isAdminHome && "bg-gray-100 text-primary"
              )}
              data-testid="mobile-nav-dashboard"
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin Dashboard
            </Button>

            {adminNavigationSections.map((section) => (
              <div key={section.title}>
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(item.href);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100",
                        isActive(item.href) && "bg-gray-100 text-primary"
                      )}
                      data-testid={`mobile-nav-${item.testId}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="ml-2">{item.title}</span>
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
