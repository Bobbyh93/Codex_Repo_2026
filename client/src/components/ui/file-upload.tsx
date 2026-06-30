import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, CheckCircle, AlertCircle, Loader2, Eye, FileCheck, Zap } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUploadSuccess?: (reportId: string, uploadData?: any) => void;
}

type UploadStage = 'idle' | 'validating' | 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error';

interface UploadState {
  stage: UploadStage;
  progress: number;
  message: string;
  subMessage?: string;
  estimatedTime?: string;
}

// Guest session management
const getGuestSessionId = () => {
  let guestId = localStorage.getItem('guestSessionId');
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('guestSessionId', guestId);
  }
  return guestId;
};

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to upload',
    subMessage: 'Drop your PDF here or click to browse'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, token } = useAuth();

  // Enhanced upload function with real-time progress and multi-stage tracking
  const uploadFileWithProgress = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      
      // Store xhr instance for cancellation
      xhrRef.current = xhr;
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const uploadProgress = Math.round((event.loaded / event.total) * 70); // Upload is 70% of total
          setUploadState({
            stage: 'uploading',
            progress: uploadProgress,
            message: 'Uploading PDF...',
            subMessage: `${Math.round((event.loaded / 1024 / 1024) * 10) / 10}MB of ${Math.round((event.total / 1024 / 1024) * 10) / 10}MB`,
            estimatedTime: uploadProgress > 20 ? `${Math.round((100 - uploadProgress) / 5)}s remaining` : undefined
          });
        }
      });
      
      // Handle upload completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadState({
            stage: 'processing',
            progress: 75,
            message: 'Processing PDF...',
            subMessage: 'Extracting text and identifying topics',
            estimatedTime: '15-30s remaining'
          });
          
          setTimeout(() => {
            setUploadState({
              stage: 'analyzing',
              progress: 90,
              message: 'Analyzing content...',
              subMessage: 'Generating personalized study plan',
              estimatedTime: '5-10s remaining'
            });
          }, 1000);
          
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred during upload'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });
      
      // Start upload (must be called before setting headers)
      xhr.open('POST', '/api/assessment-reports');
      
      // Set request headers (after xhr.open())
      if (isAuthenticated && token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      } else {
        xhr.setRequestHeader('x-session-id', getGuestSessionId());
      }
      xhr.send(formData);
    });
  };

  const uploadMutation = useMutation({
    mutationFn: uploadFileWithProgress,
    onSuccess: (data) => {
      setUploadState({
        stage: 'complete',
        progress: 100,
        message: 'Upload Complete!',
        subMessage: `Found ${data.topicsFound} topics to review`
      });

      // Store guest ID if user is not authenticated
      if (!isAuthenticated && data.guestId) {
        localStorage.setItem('guestSessionId', data.guestId);
      }

      toast({
        title: "Analysis Complete",
        description: `Your assessment has been processed successfully. Found ${data.topicsFound} topics to review.`,
      });
      
      // Invalidate queries to refresh data
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/assessment-reports"] });
      }
      
      // Reset states
      setTimeout(() => {
        setIsUploading(false);
        setSelectedFile(null);
        setUploadState({
          stage: 'idle',
          progress: 0,
          message: 'Ready to upload',
          subMessage: 'Drop your PDF here or click to browse'
        });
        onUploadSuccess?.(data.reportId, data);
      }, 2000);
    },
    onError: (error: any) => {
      setUploadState({
        stage: 'error',
        progress: 0,
        message: 'Upload Failed',
        subMessage: error.message || 'Please check your connection and try again'
      });

      let errorMessage = "Failed to process assessment report. Please try again.";
      let actionableGuidance = "";

      // Provide specific error guidance
      if (error.message?.includes('Network error')) {
        errorMessage = "Network connection issue detected.";
        actionableGuidance = "Please check your internet connection and try again.";
      } else if (error.message?.includes('status 413')) {
        errorMessage = "File too large for upload.";
        actionableGuidance = "Please use a PDF file smaller than 10MB.";
      } else if (error.message?.includes('status 415')) {
        errorMessage = "Invalid file format detected.";
        actionableGuidance = "Please upload a valid PDF assessment report.";
      }

      toast({
        title: errorMessage,
        description: actionableGuidance,
        variant: "destructive",
      });

      setTimeout(() => {
        setIsUploading(false);
        setSelectedFile(null);
        setUploadState({
          stage: 'idle',
          progress: 0,
          message: 'Ready to upload',
          subMessage: 'Drop your PDF here or click to browse'
        });
      }, 3000);
    },
  });

  // Enhanced validation and file handling
  const validateFile = (file: File): { isValid: boolean; error?: string; guidance?: string } => {
    if (file.type !== "application/pdf") {
      return {
        isValid: false,
        error: "Invalid File Type",
        guidance: "Please upload a PDF assessment report. Other file types are not supported."
      };
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return {
        isValid: false,
        error: "File Too Large",
        guidance: "Please use a PDF file smaller than 10MB. Try compressing your PDF if needed."
      };
    }

    if (file.size < 1000) { // 1KB - likely not a real PDF
      return {
        isValid: false,
        error: "File Too Small",
        guidance: "This doesn't appear to be a valid assessment PDF. Please check your file."
      };
    }

    return { isValid: true };
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setIsUploading(false);
    setUploadState({
      stage: 'idle',
      progress: 0,
      message: 'Upload cancelled',
      subMessage: 'Ready to try again'
    });
    setTimeout(() => {
      setUploadState({
        stage: 'idle',
        progress: 0,
        message: 'Ready to upload',
        subMessage: 'Drop your PDF here or click to browse'
      });
    }, 2000);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && !isUploading) {
      // Enhanced validation with better error messages
      setUploadState({
        stage: 'validating',
        progress: 5,
        message: 'Validating file...',
        subMessage: 'Checking file format and size'
      });

      const validation = validateFile(file);
      if (!validation.isValid) {
        setUploadState({
          stage: 'error',
          progress: 0,
          message: validation.error!,
          subMessage: validation.guidance
        });

        toast({
          title: validation.error!,
          description: validation.guidance,
          variant: "destructive",
        });

        // Reset after showing error
        setTimeout(() => {
          setUploadState({
            stage: 'idle',
            progress: 0,
            message: 'Ready to upload',
            subMessage: 'Drop your PDF here or click to browse'
          });
        }, 3000);
        return;
      }

      // File is valid, proceed with upload
      setSelectedFile(file);
      setIsUploading(true);
      setUploadState({
        stage: 'validating',
        progress: 10,
        message: 'File validated successfully',
        subMessage: 'Starting upload process...'
      });

      // Small delay for better UX
      setTimeout(() => {
        uploadMutation.mutate(file);
      }, 500);
    }
  }, [uploadMutation, toast, isUploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false,
    disabled: isUploading
  });

  // Get stage-specific icon and styling
  const getStageIcon = () => {
    switch (uploadState.stage) {
      case 'validating':
        return <FileCheck className="mx-auto h-12 w-12 text-blue-500 mb-2 animate-pulse" />;
      case 'uploading':
        return <Upload className="mx-auto h-12 w-12 text-blue-500 mb-2" />;
      case 'processing':
        return <Eye className="mx-auto h-12 w-12 text-purple-500 mb-2" />;
      case 'analyzing':
        return <Zap className="mx-auto h-12 w-12 text-orange-500 mb-2" />;
      case 'complete':
        return <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />;
      case 'error':
        return <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-2" />;
      default:
        return <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />;
    }
  };

  const getStageColor = () => {
    switch (uploadState.stage) {
      case 'validating':
        return 'text-blue-600';
      case 'uploading':
        return 'text-blue-600';
      case 'processing':
        return 'text-purple-600';
      case 'analyzing':
        return 'text-orange-600';
      case 'complete':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-foreground';
    }
  };

  const getDropzoneStyles = () => {
    if (isUploading) {
      return "border-2 border-dashed rounded-lg p-8 text-center cursor-not-allowed bg-muted/20 border-muted";
    }
    
    if (isDragActive) {
      return "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 border-primary bg-primary/10 shadow-md";
    }
    
    if (uploadState.stage === 'error') {
      return "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-red-300 bg-red-50 hover:border-red-400";
    }
    
    if (uploadState.stage === 'complete') {
      return "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors border-green-300 bg-green-50 hover:border-green-400";
    }
    
    return "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 border-border hover:border-primary hover:bg-primary/5";
  };

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={getDropzoneStyles()}
        data-testid="file-upload-dropzone"
      >
        <input {...getInputProps()} />
        
        <div className="mb-4">
          {getStageIcon()}
          
          <div className="space-y-1">
            <p className={cn("text-lg font-medium mb-1", getStageColor())}>
              {uploadState.message}
            </p>
            <p className="text-sm text-muted-foreground">
              {uploadState.subMessage}
            </p>
            {uploadState.estimatedTime && (
              <p className="text-xs text-muted-foreground font-medium">
                {uploadState.estimatedTime}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!isUploading && uploadState.stage !== 'complete' && (
          <Button 
            variant="default" 
            data-testid="button-choose-file"
            disabled={isUploading}
            className="transition-all duration-200"
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Assessment PDF
          </Button>
        )}

        {isUploading && uploadState.stage !== 'complete' && (
          <Button 
            variant="outline" 
            onClick={cancelUpload}
            data-testid="button-cancel-upload"
            className="transition-all duration-200"
          >
            Cancel Upload
          </Button>
        )}
        
        <p className="text-xs text-muted-foreground mt-3">
          {selectedFile ? (
            <span className="flex items-center justify-center gap-2">
              <span>Selected: {selectedFile.name}</span>
              <span>({Math.round(selectedFile.size / 1024)}KB)</span>
            </span>
          ) : (
            "Supports PDF assessment reports up to 10MB"
          )}
        </p>
      </div>

      {/* Enhanced progress bar with stage indicators */}
      {(isUploading || uploadState.stage === 'complete') && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">Progress</span>
              <span className="text-sm text-muted-foreground">{uploadState.progress}%</span>
            </div>
            <Progress 
              value={uploadState.progress} 
              className="w-full h-2"
              data-testid="upload-progress-bar" 
            />
          </div>

          {/* Stage indicators */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className={cn(
              "text-center p-2 rounded",
              uploadState.stage === 'validating' || uploadState.progress >= 10 
                ? "bg-blue-100 text-blue-700" 
                : "bg-muted text-muted-foreground"
            )}>
              <FileCheck className="h-4 w-4 mx-auto mb-1" />
              Validate
            </div>
            <div className={cn(
              "text-center p-2 rounded",
              uploadState.stage === 'uploading' || uploadState.progress >= 30 
                ? "bg-blue-100 text-blue-700" 
                : "bg-muted text-muted-foreground"
            )}>
              <Upload className="h-4 w-4 mx-auto mb-1" />
              Upload
            </div>
            <div className={cn(
              "text-center p-2 rounded",
              uploadState.stage === 'processing' || uploadState.progress >= 75 
                ? "bg-purple-100 text-purple-700" 
                : "bg-muted text-muted-foreground"
            )}>
              <Eye className="h-4 w-4 mx-auto mb-1" />
              Process
            </div>
            <div className={cn(
              "text-center p-2 rounded",
              uploadState.stage === 'analyzing' || uploadState.stage === 'complete' || uploadState.progress >= 90 
                ? "bg-green-100 text-green-700" 
                : "bg-muted text-muted-foreground"
            )}>
              <Zap className="h-4 w-4 mx-auto mb-1" />
              Analyze
            </div>
          </div>

          {/* Loading spinner for active stages */}
          {isUploading && uploadState.stage !== 'complete' && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                {uploadState.stage === 'uploading' && 'Uploading file to server...'}
                {uploadState.stage === 'processing' && 'Extracting and parsing content...'}
                {uploadState.stage === 'analyzing' && 'Analyzing topics and generating insights...'}
                {uploadState.stage === 'validating' && 'Checking file format and size...'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
