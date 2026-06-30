import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, Upload, CheckCircle, AlertCircle, RefreshCw, Home, FileText, TrendingUp } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
    testId?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
    testId?: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  secondaryAction,
  className
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed border-2", className)}>
      <CardContent className="flex flex-col items-center justify-center text-center p-8">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
        
        <div className="flex gap-3 flex-wrap justify-center">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
              data-testid={action.testId}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || "outline"}
              data-testid={secondaryAction.testId}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Specific empty state components
export function NoAssessmentUploaded({ onUpload }: { onUpload: () => void }) {
  return (
    <EmptyState
      icon={Upload}
      title="Upload Your First Assessment"
      description="Get started by uploading an assessment PDF to see your personalized study plan with specific topics to review."
      action={{
        label: "Upload Assessment",
        onClick: onUpload,
        testId: "button-upload-first-assessment"
      }}
    />
  );
}

export function NoTopicsFound({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={CheckCircle}
      title="No Topics Need Attention"
      description="Great job! Your assessment shows strong performance across all areas. Consider uploading a new assessment to continue tracking your progress."
      action={onRetry ? {
        label: "Refresh Analysis",
        onClick: onRetry,
        testId: "button-retry-analysis"
      } : undefined}
      secondaryAction={{
        label: "Upload New Assessment",
        onClick: () => window.location.href = "/",
        variant: "outline",
        testId: "button-upload-new-assessment"
      }}
    />
  );
}

export function ResourcesUnavailable({ onRetry, onGoHome }: { 
  onRetry: () => void;
  onGoHome: () => void;
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Unable to Check Resources"
      description="We're having trouble checking resource availability right now. This might be a temporary connection issue."
      action={{
        label: "Try Again",
        onClick: onRetry,
        testId: "button-retry-resources"
      }}
      secondaryAction={{
        label: "Go Home",
        onClick: onGoHome,
        variant: "outline",
        testId: "button-go-home"
      }}
    />
  );
}

export function AssessmentNotFound({ onGoHome }: { onGoHome: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Assessment Not Found"
      description="This assessment report may have expired or does not exist. Please upload a new assessment to create a fresh study plan."
      action={{
        label: "Upload New Assessment",
        onClick: onGoHome,
        testId: "button-go-home-from-error"
      }}
    />
  );
}

export function LoadingFailed({ 
  onRetry, 
  onGoHome,
  error = "Something went wrong while loading your data. Please try again or contact support if the problem persists."
}: { 
  onRetry: () => void;
  onGoHome: () => void;
  error?: string;
}) {
  return (
    <EmptyState
      icon={RefreshCw}
      title="Loading Failed"
      description={error}
      action={{
        label: "Try Again",
        onClick: onRetry,
        testId: "button-retry-loading"
      }}
      secondaryAction={{
        label: "Go Home",
        onClick: onGoHome,
        variant: "outline",
        testId: "button-go-home-from-error"
      }}
    />
  );
}