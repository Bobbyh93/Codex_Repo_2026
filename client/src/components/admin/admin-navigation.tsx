<<<<<<< HEAD
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
=======
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
<<<<<<< HEAD
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import {
  Home,
  Shield,
  Database,
  FileText,
  GraduationCap,
  Users,
  BarChart,
  FolderOpen,
  BookOpen,
  Menu,
  X,
  Map,
  Library,
  Phone,
  Brain,
  TrendingUp,
  BookOpenCheck,
  Rocket,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: 'Assessment',
    items: [
      {
        title: 'Assessment Manager',
        href: '/admin/assessment-manager',
        icon: <GraduationCap className="h-4 w-4" />,
        description: 'Upload and process student assessments'
      },
      {
        title: 'AI Analyzer',
        href: '/admin/ai-analyzer',
        icon: <Brain className="h-4 w-4" />,
        description: 'AI-powered topic extraction and analysis'
      },
      {
        title: 'Topics Queue (post-MVP)',
        href: '/admin/topics-queue',
        icon: <FileText className="h-4 w-4" />,
        description: 'Post-MVP review queue for topics needing resources'
      }
    ]
  },
  {
    title: 'Content',
    items: [
      {
        title: 'Content Workflow',
        href: '/admin/content-workflow',
        icon: <FolderOpen className="h-4 w-4" />,
        description: 'Manage nursing topics and categories'
      },
      {
        title: 'Resources (post-MVP)',
        href: '/admin/resources',
        icon: <BookOpen className="h-4 w-4" />,
        description: 'Post-MVP learning resource management'
      },
      {
        title: 'Resource Mapper (post-MVP)',
        href: '/admin/resource-mapper',
        icon: <Map className="h-4 w-4" />,
        description: 'Post-MVP mapping between resources and topics'
      },
      {
        title: 'Curriculum Catalog',
        href: '/admin/curriculum-catalog',
        icon: <Library className="h-4 w-4" />,
        description: 'Manage textbooks, chapters, and topic mappings'
      },
      {
        title: 'Lesson Builder',
        href: '/admin/lesson-builder',
        icon: <BookOpenCheck className="h-4 w-4" />,
        description: 'Generate cited learner decks from approved source truth'
      }
    ]
  },
  {
    title: 'Analytics',
    items: [
      {
        title: 'Demand Analytics (post-MVP)',
        href: '/admin/demand-analytics',
        icon: <TrendingUp className="h-4 w-4" />,
        description: 'Post-MVP demand and content-gap analytics'
      },
      {
        title: 'Call Bookings',
        href: '/admin/call-bookings',
        icon: <Phone className="h-4 w-4" />,
        description: 'Manage consultation bookings and leads'
      },
      {
        title: 'Pilot Requests',
        href: '/admin/pilot-requests',
        icon: <Rocket className="h-4 w-4" />,
        description: 'Review public launch interest and next actions'
      },
      {
        title: 'Knowledge Base',
        href: '/admin/knowledge-base',
        icon: <Database className="h-4 w-4" />,
        description: 'RAG-powered knowledge base management'
      },
      {
        title: 'Database Manager',
        href: '/admin/database',
        icon: <Database className="h-4 w-4" />,
        description: 'Manage database tables and content'
      }
    ]
  }
];
=======
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { adminNavigationSections } from "@/lib/mvp-navigation";
import { Home, Shield, Menu, X } from "lucide-react";
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277

interface AdminNavigationProps {
  currentPage?: string;
  className?: string;
}

export function AdminNavigation({ currentPage, className }: AdminNavigationProps) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => location === href;
<<<<<<< HEAD

  return (
    <nav className={cn("bg-white border-b sticky top-0 z-50", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Home */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="mr-4"
              data-testid="nav-home"
            >
              <Home className="h-5 w-5 mr-2" />
              <span className="font-semibold">NursePrep</span>
            </Button>

            <div className="hidden md:flex items-center space-x-1">
              <span className="text-gray-400 mx-2">/</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className={cn(
                  "text-sm",
                  location === '/admin' && "bg-gray-100"
                )}
                data-testid="nav-admin"
              >
                <Shield className="h-4 w-4 mr-1" />
=======
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
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
                Admin Dashboard
              </Button>
            </div>

<<<<<<< HEAD
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center ml-6">
              <NavigationMenu>
                <NavigationMenuList>
                  {navigationSections.map((section) => (
=======
            <div className="ml-6 hidden items-center lg:flex">
              <NavigationMenu>
                <NavigationMenuList>
                  {adminNavigationSections.map((section) => (
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
                    <NavigationMenuItem key={section.title}>
                      <NavigationMenuTrigger className="h-9 px-3">
                        {section.title}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
<<<<<<< HEAD
                        <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                          {section.items.map((item) => (
                            <li key={item.href}>
                              <NavigationMenuLink asChild>
                                <a
                                  href={item.href}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigate(item.href);
                                  }}
                                  className={cn(
                                    "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                    isActive(item.href) && "bg-accent"
                                  )}
                                  data-testid={`nav-${item.href.split('/').pop()}`}
                                >
                                  <div className="flex items-center gap-2 text-sm font-medium leading-none">
                                    {item.icon}
                                    {item.title}
                                  </div>
                                  {item.description && (
                                    <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                                      {item.description}
                                    </p>
                                  )}
                                </a>
                              </NavigationMenuLink>
                            </li>
                          ))}
=======
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
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

<<<<<<< HEAD
          {/* Current Page Indicator */}
          {currentPage && (
            <div className="hidden md:flex items-center">
              <span className="text-sm text-gray-500 mr-2">Current:</span>
=======
          {currentPage && (
            <div className="hidden items-center md:flex">
              <span className="mr-2 text-sm text-gray-500">Current:</span>
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
              <span className="text-sm font-medium text-gray-900">{currentPage}</span>
            </div>
          )}

<<<<<<< HEAD
          {/* Mobile Menu Button */}
=======
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
          <div className="flex items-center lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-button"
<<<<<<< HEAD
=======
              aria-label={mobileMenuOpen ? "Close admin navigation" : "Open admin navigation"}
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

<<<<<<< HEAD
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigationSections.map((section) => (
              <div key={section.title} className="mb-4">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </div>
                {section.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.href);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100",
                      isActive(item.href) && "bg-gray-100 text-primary"
                    )}
                    data-testid={`mobile-nav-${item.href.split('/').pop()}`}
                  >
                    {item.icon}
                    <span className="ml-2">{item.title}</span>
                  </a>
                ))}
=======
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
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
