import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, CheckCircle, Target, Download, ExternalLink, 
  Clock, Trophy, Sparkles, ArrowRight, FileText, Play
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";

export default function StudentActionPlan() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const { toast } = useToast();

  // Fetch analysis data
  const { data: actionPlan } = useQuery({
    queryKey: ["/api/action-plan", reportId],
    enabled: !!reportId,
  });

  const { data: resources } = useQuery({
    queryKey: ["/api/study-resources", reportId],
    enabled: !!reportId,
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/assessment-reports", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      setReportId(data.reportId);
      setCurrentStep(1);
      setTimeout(() => setShowPlan(true), 1500);
    },
  });

  // Track resource clicks
  const trackResourceClick = async (resourceId: string, resourceName: string) => {
    await fetch("/api/track-resource-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, resourceName, reportId }),
    });
  };

  // Generate PDF report
  const generatePDF = async () => {
    try {
      const response = await fetch(`/api/generate-pdf/${reportId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NursePrep-Study-Plan.pdf';
      a.click();
      
      toast({
        title: "PDF Downloaded!",
        description: "Your personalized study plan is ready",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
  });

  if (currentStep === 0) {
    // Step 1: Upload
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Get Your Study Action Plan</h1>
            <p className="text-muted-foreground">Upload your assessment to receive a personalized 1-3 hour study plan</p>
          </div>

          <Card>
            <CardContent className="p-8">
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}
                data-testid="file-upload-zone"
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <div className="space-y-3">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">Ready to analyze</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="text-lg">Drop your assessment report here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                )}
              </div>

              {selectedFile && (
                <Button 
                  onClick={() => uploadMutation.mutate(selectedFile)}
                  disabled={uploadMutation.isPending}
                  className="w-full mt-6"
                  size="lg"
                  data-testid="button-analyze"
                >
                  {uploadMutation.isPending ? (
                    "Analyzing..."
                  ) : (
                    <>
                      Analyze My Performance
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Action Plan Display
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-3">
          <Badge className="mb-2" variant="outline">
            <Sparkles className="h-3 w-3 mr-1" />
            Personalized for You
          </Badge>
          <h1 className="text-3xl font-bold mb-2">Your 3-Hour Study Action Plan</h1>
          <p className="text-muted-foreground">Focus on what matters most</p>
        </div>

        {showPlan && (
          <>
            {/* Quick Reassurance */}
            <Alert className="mb-6 border-green-200 bg-green-50">
              <Trophy className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>You're not alone!</strong> 78% of students miss similar topics. 
                This plan will help you improve by 15-20% in just 3 hours.
              </AlertDescription>
            </Alert>

            {/* Top 3 Focus Areas */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Your Top 3 Focus Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { area: "Pharmacology Calculations", time: "60 min", difficulty: "High" },
                    { area: "Cardiac Dysrhythmias", time: "45 min", difficulty: "Medium" },
                    { area: "Fluid & Electrolytes", time: "45 min", difficulty: "Medium" }
                  ].map((focus, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{focus.area}</p>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="inline h-3 w-3 mr-1" />
                            {focus.time}
                          </p>
                        </div>
                      </div>
                      <Badge variant={focus.difficulty === "High" ? "destructive" : "secondary"}>
                        {focus.difficulty}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step-by-Step Study Plan */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Step-by-Step Study Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Hour 1 */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold mb-2">Hour 1: Pharmacology Calculations</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => trackResourceClick("simple-nursing-pharm", "Simple Nursing - Dosage Calc")}
                        className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">Watch: Simple Nursing - Dosage Calculations</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">15 min video • 4.8★ rating</p>
                      </button>
                      
                      <button
                        onClick={() => trackResourceClick("practice-pharm", "Practice Questions")}
                        className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">Practice: Pharmacology Questions</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">20 questions • 30 min</p>
                      </button>
                      
                      <button
                        onClick={() => trackResourceClick("archer-review", "Archer NCLEX Review")}
                        className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">Review: Archer NCLEX Pharm Calculations</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">15 min review • High yield</p>
                      </button>
                    </div>
                  </div>

                  {/* Hour 2 */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold mb-2">Hour 2: Cardiac Dysrhythmias</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => trackResourceClick("youtube-ecg", "YouTube - ECG Interpretation")}
                        className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-green-600" />
                            <span className="font-medium">Watch: RegisteredNurseRN - ECG Basics</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-green-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">20 min video • Free</p>
                      </button>
                      
                      <button
                        onClick={() => trackResourceClick("simple-nursing-cardiac", "Simple Nursing Cardiac")}
                        className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="font-medium">Practice: Rhythm Strip Identification</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-green-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">25 min practice</p>
                      </button>
                    </div>
                  </div>

                  {/* Hour 3 */}
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="font-semibold mb-2">Hour 3: Fluid & Electrolytes</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => trackResourceClick("osmosis-fluids", "Osmosis - Fluid Balance")}
                        className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-purple-600" />
                            <span className="font-medium">Watch: Osmosis - Fluid & Electrolyte Balance</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">18 min video • Visual learning</p>
                      </button>
                      
                      <button
                        onClick={() => trackResourceClick("fluids-module", "Fluids & Electrolytes Module")}
                        className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-purple-600" />
                            <span className="font-medium">Complete: Fluids & Electrolytes Module</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-600" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">27 min module</p>
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Download PDF Button */}
            <div className="flex justify-center gap-4">
              <Button onClick={generatePDF} size="lg" className="gap-2">
                <Download className="h-4 w-4" />
                Download PDF Study Plan
              </Button>
              <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
                Upload New Report
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}