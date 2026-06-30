import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  FileSearch,
  Database,
  Hash,
  Brain,
  FileText,
  Upload,
} from "lucide-react";
import { useJobQuery } from "@/hooks/use-knowledge-base";

interface JobStatusCardProps {
  jobId: string;
  compact?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const stageIcons: Record<string, React.ReactNode> = {
  validating: <FileSearch className="h-4 w-4" />,
  storing: <Database className="h-4 w-4" />,
  extracting: <FileText className="h-4 w-4" />,
  structuring: <Hash className="h-4 w-4" />,
  chunking: <Hash className="h-4 w-4" />,
  embedding: <Brain className="h-4 w-4" />,
  persisting: <Database className="h-4 w-4" />,
  tagging: <Hash className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
};

const stageDescriptions: Record<string, string> = {
  validating: "Validating file format and size",
  storing: "Storing file to disk",
  extracting: "Extracting text content",
  structuring: "Analyzing document structure",
  chunking: "Splitting into chunks",
  embedding: "Generating embeddings",
  persisting: "Saving to database",
  tagging: "Tagging with topics",
  completed: "Processing complete",
  failed: "Processing failed",
};

export function JobStatusCard({ jobId, compact = false, onComplete, onError }: JobStatusCardProps) {
  const [hasCompleted, setHasCompleted] = useState(false);
  const { toast } = useToast();

  const { data: job, isLoading, refetch } = useJobQuery(jobId, {
    refetchInterval: job?.status === "processing" ? 2000 : false,
  });

  useEffect(() => {
    if (job?.status === "completed" && !hasCompleted) {
      setHasCompleted(true);
      if (onComplete) onComplete();
    } else if (job?.status === "failed" && job.error) {
      if (onError) onError(job.error);
    }
  }, [job, hasCompleted, onComplete, onError]);

  const handleRetry = async () => {
    try {
      const response = await fetch(`/api/documents/jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to retry job");
      }
      toast({
        title: "Retry started",
        description: "The job is being retried",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retry job",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className={compact ? "p-3" : "p-4"}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </Card>
    );
  }

  if (!job) {
    return (
      <Card className={compact ? "p-3" : "p-4"}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Job not found</p>
        </div>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (job.status) {
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{job.status}</Badge>;
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stageIcons[job.stage || job.status] || getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {stageDescriptions[job.stage || job.status] || job.stage}
            </span>
          </div>
          {job.progress > 0 && <span className="text-xs font-medium">{job.progress}%</span>}
        </div>
        {job.status === "processing" && <Progress value={job.progress} className="h-1" />}
        {job.error && (
          <p className="text-xs text-destructive line-clamp-2">{job.error}</p>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <p className="font-medium">Processing Job</p>
              <p className="text-xs text-muted-foreground">ID: {jobId.slice(0, 8)}...</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Progress */}
        {job.status === "processing" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {stageDescriptions[job.stage] || job.stage}
              </span>
              <span className="font-medium">{job.progress}%</span>
            </div>
            <Progress value={job.progress} />
          </div>
        )}

        {/* Stage Details */}
        {job.stage && job.status === "processing" && (
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(stageIcons).slice(0, 8).map(([stage, icon]) => {
              const isPast = job.progress > (Object.keys(stageIcons).indexOf(stage) + 1) * 12.5;
              const isCurrent = job.stage === stage;
              
              return (
                <div
                  key={stage}
                  className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                    isPast
                      ? "bg-green-100 dark:bg-green-900/20"
                      : isCurrent
                      ? "bg-primary/10 border border-primary"
                      : "bg-muted"
                  }`}
                >
                  <div
                    className={`${
                      isPast
                        ? "text-green-600 dark:text-green-400"
                        : isCurrent
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Timing Information */}
        {(job.startedAt || job.completedAt) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {job.startedAt && (
              <span>Started: {!isNaN(new Date(job.startedAt).getTime()) ? new Date(job.startedAt).toLocaleTimeString() : "—"}</span>
            )}
            {job.completedAt && (
              <span>Completed: {!isNaN(new Date(job.completedAt).getTime()) ? new Date(job.completedAt).toLocaleTimeString() : "—"}</span>
            )}
            {job.processingTime && (
              <span>Duration: {(job.processingTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}

        {/* Error Details */}
        {job.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-xs text-destructive/80 mt-1">{job.error}</p>
                {job.errorDetails && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-destructive/60">
                      View details
                    </summary>
                    <pre className="text-xs mt-2 p-2 bg-background rounded overflow-auto">
                      {JSON.stringify(job.errorDetails, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {job.status === "failed" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={job.retryCount >= 3}
              data-testid="button-retry-job"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry {job.retryCount > 0 && `(${job.retryCount}/3)`}
            </Button>
          </div>
        )}

        {/* Success Message */}
        {job.status === "completed" && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Document processed successfully
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}