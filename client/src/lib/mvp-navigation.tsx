import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Brain,
  Database,
  FileText,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Library,
  Map,
  Package,
  Phone,
  Rocket,
  TrendingUp,
  Upload,
} from "lucide-react";

export type NavRouteStatus =
  | "keep_mvp"
  | "hide_from_nav"
  | "legacy_redirect"
  | "remove_candidate"
  | "needs_manual_review";

export type NavAudience = "student" | "admin" | "advanced";

export interface MvpNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  status: NavRouteStatus;
  audience: NavAudience;
  testId: string;
}

export interface MvpNavSection {
  title: string;
  items: readonly MvpNavItem[];
}

export const studentMvpNavigation = [
  {
    title: "Home",
    href: "/student",
    icon: BookOpen,
    description: "Learner entry point with featured lessons and current study path.",
    status: "keep_mvp",
    audience: "student",
    testId: "student-home",
  },
  {
    title: "Study Pack",
    href: "/student/study-pack",
    icon: Package,
    description: "Learner-safe notes, citations, and practice support.",
    status: "keep_mvp",
    audience: "student",
    testId: "student-study-pack",
  },
  {
    title: "Progress",
    href: "/student/progress",
    icon: TrendingUp,
    description: "Session-safe progress and recommended next lessons.",
    status: "keep_mvp",
    audience: "student",
    testId: "student-progress",
  },
] as const satisfies readonly MvpNavItem[];

export const adminMvpNavigation = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    description: "Educator/admin launch surface and production status.",
    status: "keep_mvp",
    audience: "admin",
    testId: "dashboard",
  },
  {
    title: "Lesson Builder",
    href: "/admin/lesson-builder",
    icon: Package,
    description: "Build cited learner lesson packages from approved source truth.",
    status: "keep_mvp",
    audience: "admin",
    testId: "lesson-builder",
  },
  {
    title: "Topic Production",
    href: "/admin/topic-production",
    icon: GitBranch,
    description: "Review the production matrix, source status, and asset gaps.",
    status: "keep_mvp",
    audience: "admin",
    testId: "topic-production",
  },
  {
    title: "Knowledge Base",
    href: "/admin/knowledge-base",
    icon: Database,
    description: "Manage the reviewed nursing source library for lesson grounding.",
    status: "keep_mvp",
    audience: "admin",
    testId: "knowledge-base",
  },
  {
    title: "Content Mapper",
    href: "/admin/content-mapper",
    icon: Map,
    description: "Map content blocks and taxonomy evidence for educator review.",
    status: "keep_mvp",
    audience: "admin",
    testId: "content-mapper",
  },
  {
    title: "Assessment Manager",
    href: "/admin/assessment-manager",
    icon: GraduationCap,
    description: "Manage assessment intake and weak-topic evidence for learners.",
    status: "keep_mvp",
    audience: "admin",
    testId: "assessment-manager",
  },
  {
    title: "Pilot Requests",
    href: "/admin/pilot-requests",
    icon: Rocket,
    description: "Review educator interest and pilot handoff actions.",
    status: "keep_mvp",
    audience: "admin",
    testId: "pilot-requests",
  },
] as const satisfies readonly MvpNavItem[];

export const adminNavigationSections = [
  {
    title: "Production",
    items: [adminMvpNavigation[1], adminMvpNavigation[2]],
  },
  {
    title: "Content",
    items: [adminMvpNavigation[3], adminMvpNavigation[4], adminMvpNavigation[5]],
  },
  {
    title: "Pilot",
    items: [adminMvpNavigation[6]],
  },
] as const satisfies readonly MvpNavSection[];

export const hiddenAdminNavigation = [
  {
    title: "Call Bookings",
    href: "/admin/call-bookings",
    icon: Phone,
    description: "Lead-management surface retained as a protected deep link.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "call-bookings",
  },
  {
    title: "Content Import",
    href: "/admin/content-import",
    icon: Upload,
    description: "Import workflow retained for admin-only deep-link use.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "content-import",
  },
  {
    title: "Content Workflow",
    href: "/admin/content-workflow",
    icon: FileText,
    description: "Legacy workflow surface hidden from the MVP menu.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "content-workflow",
  },
  {
    title: "Resources",
    href: "/admin/resources",
    icon: BookOpen,
    description: "Resource management surface retained for post-MVP review.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "resources",
  },
  {
    title: "Resource Mapper",
    href: "/admin/resource-mapper",
    icon: Map,
    description: "Resource-to-topic mapping surface retained for post-MVP review.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "resource-mapper",
  },
  {
    title: "Topics Queue",
    href: "/admin/topics-queue",
    icon: Brain,
    description: "Post-MVP queue hidden until the review workflow is complete.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "topics-queue",
  },
  {
    title: "AI Analyzer",
    href: "/admin/ai-analyzer",
    icon: Brain,
    description: "Analysis surface hidden to avoid unapproved AI/spend paths in MVP navigation.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "ai-analyzer",
  },
  {
    title: "Demand Analytics",
    href: "/admin/demand-analytics",
    icon: TrendingUp,
    description: "Analytics surface retained as a protected deep link.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "demand-analytics",
  },
  {
    title: "Database Manager",
    href: "/admin/database",
    icon: Database,
    description: "Owner-only utility retained as a protected deep link.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "database",
  },
  {
    title: "Curriculum Catalog",
    href: "/admin/curriculum-catalog",
    icon: Library,
    description: "Catalog management surface retained outside primary MVP navigation.",
    status: "hide_from_nav",
    audience: "advanced",
    testId: "curriculum-catalog",
  },
] as const satisfies readonly MvpNavItem[];
