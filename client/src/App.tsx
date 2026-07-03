import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { useAuth } from "@/contexts/auth-context";
import { PrivacyBanner } from "@/components/privacy/privacy-banner";
import { ErrorBoundary, SectionErrorBoundary } from "@/components/ui/error-boundary";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { Login } from "@/pages/login";
import { VerifyMagicLink } from "@/pages/verify-magic-link";
import { EnhancedDashboard } from "@/pages/enhanced-dashboard";
import { PrivacySettings } from "@/pages/privacy-settings";
import { PrivacyPolicy } from "@/pages/privacy-policy";
import SimpleLandingCarousel from "@/pages/simple-landing-carousel";
import PreTestPrep from "@/pages/pre-test-prep";
import SequentialDashboard from "@/pages/sequential-dashboard";
import ExamRecoveryBlueprint from "@/pages/mvp-action-plan";
import AdminLogin from "@/pages/admin/admin-login";
import AdminDashboard from "@/pages/admin/admin-dashboard";
import ResourceManagementPage from "@/pages/admin/resource-management";
import TopicsQueuePage from "@/pages/admin/topics-queue";
import AIAnalyzerPage from "@/pages/admin/ai-analyzer";
import DataMappingPage from "@/pages/admin/data-mapping";
import DetailedAnalysis from "@/pages/detailed-analysis";
import ProgressDashboard from "@/pages/progress-dashboard";
import ResourceManager from "@/pages/admin/resource-manager";
import AdminPortalCarousel from "@/pages/admin/admin-portal-carousel";
import DatabaseManager from "@/pages/admin/database-manager";
import SQLConsole from "@/pages/admin/sql-console";
import ContentMapper from "@/pages/admin/content-mapper";
import ImportExport from "@/pages/admin/import-export";
import ContentImport from "@/pages/admin/content-import";
import ContentWorkflow from "@/pages/admin/content-workflow";
import SimplifiedContentMapper from "@/pages/admin/simplified-content-mapper";
import StudyGuideAnalyzer from "@/pages/admin/study-guide-analyzer";
import ContentPriorities from "@/pages/admin/content-priorities";
import ATITopicExtractor from "@/pages/admin/ati-topic-extractor";
import ContentExport from "@/pages/admin/content-export";
import AssessmentManagerCarousel from "@/pages/admin/assessment-manager-carousel";
import AssessmentManager from "@/pages/admin/assessment-manager";
import CrosswalkManager from "@/pages/admin/crosswalk-manager";
import StudyGuide from "@/pages/study-guide";
import ProfessionalStudyGuidePage from "@/pages/professional-study-guide-page";
import AssessmentPreview from "@/pages/assessment-preview";
import TopicsNeedingResources from "@/pages/admin/topics-needing-resources";
import ResourceMapperPage from "@/pages/admin/resource-mapper";
import DemandAnalyticsPage from "@/pages/admin/demand-analytics";
import CallBookingsPage from "@/pages/admin/call-bookings";
import PilotRequestsPage from "@/pages/admin/pilot-requests";
import KnowledgeBase from "@/pages/admin/knowledge-base";
import LessonBuilder from "@/pages/admin/lesson-builder";
import NotFound from "@/pages/not-found";
import CurriculumBrowser from "@/pages/curriculum-browser";
import CurriculumChapter from "@/pages/curriculum-chapter";
import CurriculumCatalog from "@/pages/admin/curriculum-catalog";
import ReferencesPage from "@/pages/references";
import LessonPackage from "@/pages/lesson-package";
import LearnerAssignment from "@/pages/learner-assignment";
import PublicLaunch from "@/pages/public-launch";
import StudentHome from "@/pages/student-home";

function AdminProtectedRoute({ component: Component, ...props }: { component: any; [key: string]: any }) {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "denied">("checking");
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const verifyAdminSession = async () => {
      try {
        const response = await fetch("/api/admin/session", {
          credentials: "include",
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (cancelled) return;
        if (data?.authenticated === true) {
          setAuthState("authenticated");
          return;
        }
        setAuthState("denied");
        navigate("/admin/login");
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        setAuthState("denied");
        navigate("/admin/login");
      }
    };

    verifyAdminSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [navigate]);

  if (authState !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-md border bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-medium text-slate-900">
            {authState === "denied" ? "Redirecting to admin login..." : "Checking admin session..."}
          </div>
          <p className="mt-2 text-sm text-slate-600">Admin tools require an active administrator session.</p>
        </div>
      </div>
    );
  }

  return <Component {...props} />;
}

function withAdminProtection(Component: any) {
  return function ProtectedAdminComponent(props: any) {
    return <AdminProtectedRoute component={Component} {...props} />;
  };
}

function LearnerProtectedRoute({ component: Component, ...props }: { component: any; [key: string]: any }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-md border bg-white p-6 text-center shadow-sm">
          <div className="text-sm font-medium text-slate-900">Checking learner session...</div>
          <p className="mt-2 text-sm text-slate-600">You will be sent to sign in if this page needs an account.</p>
        </div>
      </div>
    );
  }

  return <Component {...props} />;
}

function ProtectedDashboardRoute(props: any) {
  return <LearnerProtectedRoute component={EnhancedDashboard} {...props} />;
}

function ProtectedProgressDashboardRoute(props: any) {
  return <LearnerProtectedRoute component={ProgressDashboard} {...props} />;
}

function ProtectedStudyGuideRoute(props: any) {
  return <LearnerProtectedRoute component={StudyGuide} {...props} />;
}

function ProtectedProfessionalStudyGuideRoute(props: any) {
  return <LearnerProtectedRoute component={ProfessionalStudyGuidePage} {...props} />;
}

const ProtectedAdminDashboard = withAdminProtection(AdminDashboard);
const ProtectedCallBookingsPage = withAdminProtection(CallBookingsPage);
const ProtectedPilotRequestsPage = withAdminProtection(PilotRequestsPage);
const ProtectedKnowledgeBase = withAdminProtection(KnowledgeBase);
const ProtectedLessonBuilder = withAdminProtection(LessonBuilder);
const ProtectedResourceManagementPage = withAdminProtection(ResourceManagementPage);
const ProtectedResourceMapperPage = withAdminProtection(ResourceMapperPage);
const ProtectedTopicsQueuePage = withAdminProtection(TopicsQueuePage);
const ProtectedAIAnalyzerPage = withAdminProtection(AIAnalyzerPage);
const ProtectedContentImport = withAdminProtection(ContentImport);
const ProtectedContentMapper = withAdminProtection(ContentMapper);
const ProtectedDemandAnalyticsPage = withAdminProtection(DemandAnalyticsPage);
const ProtectedAssessmentManager = withAdminProtection(AssessmentManager);
const ProtectedContentWorkflow = withAdminProtection(ContentWorkflow);
const ProtectedDatabaseManager = withAdminProtection(DatabaseManager);
const ProtectedCurriculumCatalog = withAdminProtection(CurriculumCatalog);
const ProtectedAssessmentPreview = withAdminProtection(AssessmentPreview);
const ProtectedTopicsNeedingResources = withAdminProtection(TopicsNeedingResources);

function Router() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Router Error Boundary caught an error:', error, errorInfo);
        // Track error in analytics if available
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'exception', {
            description: error.message,
            fatal: false
          });
        }
      }}
    >
      <Switch>
        <Route path="/" component={StudentHome} />
        <Route path="/student" component={StudentHome} />
        <Route path="/pilot-request" component={PublicLaunch} />
        <Route path="/public-launch" component={PublicLaunch} />
        <Route path="/mvp-action-plan/:reportId" component={ExamRecoveryBlueprint} />
        
        {/* Auth Routes */}
        <Route path="/login" component={Login} />
        <Route path="/verify-magic-link" component={VerifyMagicLink} />
        <Route path="/auth/verify" component={VerifyMagicLink} />
        <Route path="/login-old" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />

        {/* Learner Routes */}
        <Route path="/dashboard" component={ProtectedDashboardRoute} />
        <Route path="/progress-dashboard" component={ProtectedProgressDashboardRoute} />
        <Route path="/study-guide" component={ProtectedStudyGuideRoute} />
        <Route path="/professional-study-guide/:reportId" component={ProtectedProfessionalStudyGuideRoute} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard" component={ProtectedAdminDashboard} />
        <Route path="/admin/call-bookings" component={ProtectedCallBookingsPage} />
        <Route path="/admin/pilot-requests" component={ProtectedPilotRequestsPage} />
        <Route path="/admin/knowledge-base" component={ProtectedKnowledgeBase} />
        <Route path="/admin/lesson-builder" component={ProtectedLessonBuilder} />
        <Route path="/admin/resources" component={ProtectedResourceManagementPage} />
        <Route path="/admin/resource-mapper" component={ProtectedResourceMapperPage} />
        <Route path="/admin/topics-queue" component={ProtectedTopicsQueuePage} />
        <Route path="/admin/ai-analyzer" component={ProtectedAIAnalyzerPage} />
        <Route path="/admin/data-processing" component={ProtectedAIAnalyzerPage} />
        <Route path="/admin/content-import" component={ProtectedContentImport} />
        <Route path="/admin/content-mapper" component={ProtectedContentMapper} />
        <Route path="/admin/demand-analytics" component={ProtectedDemandAnalyticsPage} />
        <Route path="/admin/assessment-manager" component={ProtectedAssessmentManager} />
        <Route path="/admin/content-workflow" component={ProtectedContentWorkflow} />
        <Route path="/admin/database" component={ProtectedDatabaseManager} />
        <Route path="/admin/curriculum-catalog" component={ProtectedCurriculumCatalog} />
        <Route path="/admin" component={ProtectedAdminDashboard} />
        
        {/* Legacy Admin Routes */}
        <Route path="/admin/assessment-preview/:reportId" component={ProtectedAssessmentPreview} />
        <Route path="/admin/topics-needing-resources" component={ProtectedTopicsNeedingResources} />
        
        {/* Curriculum Routes */}
        <Route path="/curriculum/browse" component={CurriculumBrowser} />
        <Route path="/curriculum/search" component={CurriculumBrowser} />
        <Route path="/curriculum/topic/:chapterId" component={CurriculumChapter} />
        <Route path="/curriculum/chapter/:chapterId" component={CurriculumChapter} />

        <Route path="/lessons/:id" component={LessonPackage} />
        <Route path="/lesson-assignments/:assignmentId/learner/:learnerId" component={LearnerAssignment} />
        <Route path="/references" component={ReferencesPage} />
        
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('App Error Boundary caught an error:', error, errorInfo);
        // Track critical app errors
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'exception', {
            description: `App Crash: ${error.message}`,
            fatal: true
          });
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <SectionErrorBoundary 
              title="Notification System Error"
              description="Notifications are temporarily unavailable."
            >
              <Toaster />
            </SectionErrorBoundary>
            <Router />
            <SectionErrorBoundary 
              title="Privacy Banner Error"
              description="Privacy banner is temporarily unavailable."
            >
              <PrivacyBanner />
            </SectionErrorBoundary>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
