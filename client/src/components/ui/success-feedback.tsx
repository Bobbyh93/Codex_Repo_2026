import { useEffect, useState } from "react";
import { CheckCircle, Check, Upload, RefreshCw, Share2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { track, EVENTS } from "@/lib/analytics";

interface SuccessFeedbackProps {
  message: string;
  description?: string;
  icon?: "check" | "upload" | "refresh" | "share" | "download";
  duration?: number;
  className?: string;
  onComplete?: () => void;
}

export function SuccessFeedback({
  message,
  description,
  icon = "check",
  duration = 3000,
  className,
  onComplete
}: SuccessFeedbackProps) {
  const [visible, setVisible] = useState(true);

  const iconComponents = {
    check: CheckCircle,
    upload: Upload,
    refresh: RefreshCw,
    share: Share2,
    download: Download
  };

  const IconComponent = iconComponents[icon];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onComplete) {
        setTimeout(onComplete, 300); // Wait for fade out animation
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!visible) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-lg",
      "animate-fade-in",
      className
    )}>
      <IconComponent className="h-5 w-5 text-success animate-success-pulse" />
      <div className="flex-1">
        <p className="font-medium text-success">{message}</p>
        {description && (
          <p className="text-sm text-success/80 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

// Success feedback hooks for common scenarios
export function useSuccessFeedback() {
  const { toast } = useToast();

  const showUploadSuccess = (topicsCount?: number) => {
    const message = topicsCount 
      ? `Assessment uploaded successfully! Found ${topicsCount} topics to review.`
      : "Assessment uploaded and analyzed successfully!";
    
    toast({
      title: "Upload Complete",
      description: message,
      className: "border-success bg-success/10"
    });
    
    track(EVENTS.UPLOAD_COMPLETE, { topicsFound: topicsCount });
  };

  const showTopicCompleted = (topicName: string) => {
    toast({
      title: "Topic Marked Complete",
      description: `Great job studying ${topicName}!`,
      className: "border-success bg-success/10"
    });
    
    track(EVENTS.TOPIC_MARKED_COMPLETE, { topicName });
  };

  const showResourceRefresh = () => {
    toast({
      title: "Resources Updated",
      description: "Resource availability has been refreshed successfully.",
      className: "border-success bg-success/10"
    });
  };

  const showLinkCopied = () => {
    toast({
      title: "Link Copied!",
      description: "Share link has been copied to your clipboard.",
      className: "border-success bg-success/10"
    });
    
    track(EVENTS.SHARE_LINK_COPIED, { method: 'clipboard' });
  };

  const showShareSuccess = (platform: string) => {
    toast({
      title: "Shared Successfully",
      description: `Your study plan has been shared via ${platform}.`,
      className: "border-success bg-success/10"
    });
    
    track(EVENTS.SHARE_LINK_CLICKED, { platform });
  };

  const showPdfDownload = () => {
    toast({
      title: "PDF Downloaded",
      description: "Your study plan PDF has been downloaded successfully.",
      className: "border-success bg-success/10"
    });
  };

  const showStudyPlanGenerated = (topicsCount?: number) => {
    const message = topicsCount 
      ? `Study plan generated with ${topicsCount} prioritized topics!`
      : "Your personalized study plan is ready!";
    
    toast({
      title: "Study Plan Ready",
      description: message,
      className: "border-success bg-success/10"
    });
  };

  const showTopicQueued = (topicName: string) => {
    toast({
      title: "Request Noted",
      description: `We'll prioritize adding resources for ${topicName}. You'll be notified when available.`,
      className: "border-info bg-info/10"
    });
  };

  const showRetryAction = (action: string) => {
    toast({
      title: "Retrying...",
      description: `Attempting to ${action} again. Please wait.`,
      className: "border-warning bg-warning/10"
    });
  };

  const showNetworkError = () => {
    toast({
      title: "Connection Issue",
      description: "Please check your internet connection and try again.",
      variant: "destructive"
    });
  };

  return {
    showUploadSuccess,
    showTopicCompleted,
    showResourceRefresh,
    showLinkCopied,
    showShareSuccess,
    showPdfDownload,
    showStudyPlanGenerated,
    showTopicQueued,
    showRetryAction,
    showNetworkError
  };
}