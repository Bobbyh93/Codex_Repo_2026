import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "overlay" | "inline";
  message?: string;
  submessage?: string;
  progress?: number;
  className?: string;
}

export function LoadingState({
  size = "md",
  variant = "default",
  message,
  submessage,
  progress,
  className
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  const textSizeClasses = {
    sm: "text-body-small",
    md: "text-body",
    lg: "text-body-large"
  };

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
        {message && (
          <span className={cn(textSizeClasses[size], "text-muted-foreground")}>
            {message}
          </span>
        )}
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div className={cn(
        "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center",
        className
      )}>
        <div className="bg-card border rounded-lg p-6 shadow-lg">
          <div className="flex flex-col items-center text-center space-y-4">
            <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
            {message && (
              <p className={cn(textSizeClasses[size], "font-medium text-foreground")}>
                {message}
              </p>
            )}
            {submessage && (
              <p className="text-body-small text-muted-foreground">
                {submessage}
              </p>
            )}
            {typeof progress === "number" && (
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-caption text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn(
      "border-2 border-primary/20 bg-primary/5 rounded-lg p-8 text-center",
      className
    )}>
      <Loader2 className={cn(sizeClasses[size], "mx-auto text-primary mb-4 animate-spin")} />
      {message && (
        <p className={cn(textSizeClasses[size], "font-medium mb-2 text-primary")}>
          {message}
        </p>
      )}
      {submessage && (
        <p className="text-body-small text-muted-foreground mb-4">
          {submessage}
        </p>
      )}
      {typeof progress === "number" && (
        <div className="mt-4 w-full max-w-xs mx-auto">
          <div className="flex justify-between text-caption text-muted-foreground mb-1">
            <span>Processing</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Quick loading states for common use cases
export function AnalyzingLoader({ progress }: { progress?: number }) {
  return (
    <LoadingState
      size="lg"
      message="Analyzing your assessment..."
      submessage="This may take a few moments"
      progress={progress}
    />
  );
}

export function UploadingLoader({ progress }: { progress?: number }) {
  return (
    <LoadingState
      size="lg"
      message="Uploading your file..."
      submessage="Please wait while we process your document"
      progress={progress}
    />
  );
}

export function ProcessingLoader({ progress }: { progress?: number }) {
  return (
    <LoadingState
      size="lg"
      message="Processing data..."
      submessage="Generating your personalized study plan"
      progress={progress}
    />
  );
}