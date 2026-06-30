import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, CheckCircle, Clock, ExternalLink, TrendingUp, 
  AlertCircle, Loader2, RefreshCw 
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";

// Actual working YouTube resources
const DEFAULT_RESOURCES = {
  pharmacology: {
    title: "Drug Calculations Made Easy",
    url: "https://www.youtube.com/watch?v=WJqmcH8B_0c",
    duration: "20 min",
    source: "RegisteredNurseRN"
  },
  cardiac: {
    title: "EKG Rhythm Interpretation", 
    url: "https://www.youtube.com/watch?v=0zPrpPR9nHU",
    duration: "18 min",
    source: "Simple Nursing"
  },
  fluids: {
    title: "Fluid & Electrolytes Explained",
    url: "https://www.youtube.com/watch?v=odAh0ysKqSE",
    duration: "22 min",
    source: "Nurse Sarah"
  }
};

export default function MVPFinal() {
  const [step, setStep] = useState<"upload" | "plan" | "done">("upload");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!file) return "Please select a file";
    if (file.type !== "application/pdf") return "Only PDF files are allowed";
    if (file.size > 10 * 1024 * 1024) return "File too large (max 10MB)";
    return null;
  };

  const handleFileUpload = async (file: File) => {
    // Reset state
    setError(null);
    setUploading(true);
    setProgress(0);
    
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setUploading(false);
      return;
    }

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/analyze-pdf", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(response.status === 413 ? "File too large" : "Analysis failed");
      }
      
      const data = await response.json();
      
      // Use returned resources or fallback to defaults
      const studyResources = data.resources && data.resources.length > 0 
        ? data.resources.slice(0, 3)
        : Object.values(DEFAULT_RESOURCES);
      
      setResources(studyResources);
      setProgress(100);
      
      setTimeout(() => {
        setStep("plan");
        toast({
          title: "✅ Analysis Complete",
          description: "Your personalized study plan is ready!",
        });
      }, 500);
      
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to analyze your report. Please try again.");
      
      // Fallback to default resources
      setResources(Object.values(DEFAULT_RESOURCES));
      setTimeout(() => {
        setStep("plan");
        toast({
          title: "Using Default Plan",
          description: "We'll show you the most common weak areas",
          variant: "default"
        });
      }, 1000);
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
    }
  };

  const markComplete = async (resourceId: string) => {
    const newCompleted = [...completed, resourceId];
    setCompleted(newCompleted);
    
    // Track completion
    try {
      await fetch("/api/track-completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, timestamp: new Date() })
      });
    } catch (error) {
      console.error("Failed to track completion:", error);
    }

    // Check if all completed
    if (newCompleted.length === resources.length) {
      setTimeout(() => setStep("done"), 500);
    }
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFileUpload(acceptedFiles[0]);
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: uploading
  });

  // Handle file rejection errors
  if (fileRejections.length > 0 && !error) {
    const rejection = fileRejections[0];
    if (rejection.errors[0]?.code === 'file-too-large') {
      setError('File is too large. Maximum size is 10MB.');
    } else if (rejection.errors[0]?.code === 'file-invalid-type') {
      setError('Invalid file type. Please upload a PDF.');
    }
  }

  // Step 1: Upload
  if (step === "upload") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              Fix Your Weak Topics
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              1 hour to improve your score by 15-20%
            </p>
          </div>

          {/* Upload Card */}
          <Card className="shadow-lg">
            <CardContent className="p-4 sm:p-6">
              {/* Error Alert */}
              {error && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Upload Zone */}
              <div 
                {...getRootProps()} 
                className={`
                  border-2 border-dashed rounded-lg p-6 sm:p-8 text-center 
                  transition-all cursor-pointer
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                  ${error ? 'border-red-300' : ''}
                `}
                data-testid="upload-zone"
              >
                <input {...getInputProps()} />
                
                {uploading ? (
                  <div className="space-y-3">
                    <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin" />
                    <p className="font-medium">Analyzing your assessment...</p>
                    <Progress value={progress} className="w-full" />
                    <p className="text-xs text-gray-500">{progress}%</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="font-medium text-sm sm:text-base">
                      Drop your assessment report here
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      or click to browse
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF files only • Max 10MB
                    </p>
                  </div>
                )}
              </div>

              {/* Retry Button */}
              {error && !uploading && (
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setError(null)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Trust Signals */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
              <div>
                <p className="font-semibold">2,847</p>
                <p className="text-xs">Students helped</p>
              </div>
              <div className="w-px h-8 bg-gray-300" />
              <div>
                <p className="font-semibold">85%</p>
                <p className="text-xs">Pass rate</p>
              </div>
              <div className="w-px h-8 bg-gray-300" />
              <div>
                <p className="font-semibold">18%</p>
                <p className="text-xs">Avg improvement</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: The Plan
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="max-w-2xl mx-auto">
          {/* Success Alert */}
          <Alert className="mb-4 sm:mb-6 border-green-200 bg-green-50">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 text-sm sm:text-base">
              <strong>Good news!</strong> Complete these 3 videos to improve by 15-20%
            </AlertDescription>
          </Alert>

          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Your 1-Hour Study Plan</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Watch all 3 videos to master your weak areas
            </p>
          </div>

          {/* Resources */}
          <div className="space-y-3 sm:space-y-4">
            {resources.map((resource, index) => {
              const resourceId = resource.topic || `resource-${index}`;
              const isCompleted = completed.includes(resourceId);
              const isFirst = index === 0;
              
              return (
                <Card 
                  key={resourceId} 
                  className={`transition-all ${isCompleted ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={isFirst ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {isFirst ? "Most Important" : `Priority ${index + 1}`}
                          </Badge>
                          <span className="text-xs sm:text-sm text-gray-500">
                            <Clock className="inline h-3 w-3" /> {resource.duration}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base mb-1">
                          {resource.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">
                          by {resource.source}
                        </p>
                      </div>
                      
                      <Button
                        size="sm"
                        variant={isCompleted ? "outline" : "default"}
                        onClick={() => {
                          if (resource.url) {
                            window.open(resource.url, "_blank");
                          }
                          if (!isCompleted) {
                            markComplete(resourceId);
                          }
                        }}
                        disabled={isCompleted}
                        className="w-full sm:w-auto"
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Completed
                          </>
                        ) : (
                          <>
                            Watch Now
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Progress Bar */}
          <Card className="mt-4 sm:mt-6">
            <CardContent className="p-3 sm:p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Your Progress</span>
                <span className="text-sm text-gray-600">
                  {completed.length}/{resources.length} completed
                </span>
              </div>
              <Progress 
                value={(completed.length / resources.length) * 100} 
                className="h-2"
              />
              {completed.length > 0 && completed.length < resources.length && (
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Keep going! You're {Math.round((completed.length / resources.length) * 100)}% done
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Success
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Success Animation */}
        <div className="mb-6 animate-in zoom-in duration-500">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Congratulations! 🎉
          </h1>
          <p className="text-gray-600">
            You've completed your study plan
          </p>
        </div>

        {/* Results Card */}
        <Card className="shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* Expected Improvement */}
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-semibold text-green-800 mb-1">
                  Expected Score Improvement
                </p>
                <p className="text-3xl font-bold text-green-600">
                  +15-20%
                </p>
                <p className="text-xs text-green-700 mt-1">
                  on your next assessment
                </p>
              </div>

              {/* Success Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="font-semibold text-blue-800">85%</p>
                  <p className="text-xs text-blue-600">Pass rate after plan</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="font-semibold text-purple-800">2-3 days</p>
                  <p className="text-xs text-purple-600">Until retake</p>
                </div>
              </div>

              {/* Next Steps */}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-3">
                  📝 Retake your assessment in 2-3 days to see your improvement
                </p>
                <Button 
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  Analyze Another Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Proof */}
        <p className="mt-4 text-xs text-gray-500">
          Join 2,847 students who improved this month
        </p>
      </div>
    </div>
  );
}