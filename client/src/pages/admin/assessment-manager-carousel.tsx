import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { CarouselCard } from "@/components/ui/carousel-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { 
  Upload, 
  Download, 
  Mail, 
  FileText,
  Trash2,
  Send,
  UserPlus,
  Edit3,
  Save,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  Home,
  ArrowLeft,
  Shield,
  Database,
  ArrowRight
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResourceSelector } from "@/components/ui/resource-selector";
import { StudyPlanSelector } from "@/components/ui/study-plan-selector";
import { PerformanceComparison } from "@/components/ui/performance-comparison";
import { PriorityReorderer } from "@/components/ui/priority-reorderer";
import { StudyGuidePreview } from "@/components/ui/study-guide-preview";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { UserSearch } from "@/components/admin/user-search";

interface ExtractedInfo {
  name: string | null;
  email: string | null;
  programCohort: string | null;
  testDate: string | null;
  assessmentName: string | null;
  institutionProgram: string | null;
}

interface StudentAssessment {
  id: string;
  studentName: string;
  studentEmail: string;
  fileName: string;
  uploadDate: Date;
  overallScore: number;
  topicsCount: number;
  extractedInfo?: ExtractedInfo;
  customizations?: {
    additionalNotes?: string;
    recommendedResources?: string[];
    weeklyPlan?: string;
    instructorComments?: string;
  };
}

export default function AssessmentManagerCarousel() {
  useScrollToTop();
  
  const [, navigate] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentInfo, setStudentInfo] = useState({
    name: "",
    email: "",
    instructorNotes: ""
  });
  const [selectedAssessment, setSelectedAssessment] = useState<StudentAssessment | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [customizations, setCustomizations] = useState({
    additionalNotes: "",
    recommendedResources: [] as string[],
    studyPlanId: "",
    instructorComments: ""
  });
  const [emailSubject, setEmailSubject] = useState("Your Personalized Study Guide");
  const [emailMessage, setEmailMessage] = useState("Please find your personalized study guide attached. Review the topics carefully and follow the recommended study plan.");
  const [showPreview, setShowPreview] = useState(false);
  
  const { toast } = useToast();

  // Fetch recent assessments
  const { data: recentAssessments, refetch: refetchAssessments } = useQuery<StudentAssessment[]>({
    queryKey: ["/api/admin/assessments"],
  });

  // Upload and process assessment
  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; studentInfo: typeof studentInfo }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      if (data.studentInfo.name) formData.append("studentName", data.studentInfo.name);
      if (data.studentInfo.email) formData.append("studentEmail", data.studentInfo.email);
      if (data.studentInfo.instructorNotes) formData.append("instructorNotes", data.studentInfo.instructorNotes);
      
      const response = await fetch("/api/admin/upload-assessment", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Assessment Uploaded",
        description: `Successfully processed assessment${data.studentName ? ` for ${data.studentName}` : ''}`,
      });
      setSelectedFile(null);
      
      // Auto-populate student info from extracted data
      if (data.extractedInfo) {
        setExtractedInfo(data.extractedInfo);
        setStudentInfo({
          name: data.extractedInfo.name || "",
          email: data.extractedInfo.email || "",
          instructorNotes: ""
        });
      } else {
        setStudentInfo({ name: "", email: "", instructorNotes: "" });
      }
      
      refetchAssessments();
      setSelectedAssessment(data);
      
      // Automatically advance to customize page after successful upload
      setTimeout(() => {
        setCurrentCardIndex(1); // Move to customize card
      }, 1500);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Save customizations
  const saveCustomizationsMutation = useMutation({
    mutationFn: async (data: { assessmentId: string; customizations: typeof customizations }) => {
      const response = await fetch(`/api/admin/assessments/${data.assessmentId}/customize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.customizations),
      });
      
      if (!response.ok) throw new Error("Save failed");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Customizations Saved",
        description: "Study guide customizations have been saved",
      });
    },
  });

  // Send email with PDF
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { 
      assessmentId: string; 
      email: string; 
      subject: string; 
      message: string 
    }) => {
      const response = await fetch(`/api/admin/assessments/${data.assessmentId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: data.email,
          subject: data.subject,
          message: data.message,
        }),
      });
      
      if (!response.ok) throw new Error("Email failed");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Study guide has been emailed to the student",
      });
    },
    onError: () => {
      toast({
        title: "Email Failed",
        description: "Please check the email address and try again",
        variant: "destructive",
      });
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate({ file: selectedFile, studentInfo });
    } else {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file to upload",
        variant: "destructive",
      });
    }
  };

  const handleSaveCustomizations = () => {
    if (selectedAssessment) {
      saveCustomizationsMutation.mutate({
        assessmentId: selectedAssessment.id,
        customizations,
      });
    }
  };

  const handleSendEmail = () => {
    if (selectedAssessment) {
      sendEmailMutation.mutate({
        assessmentId: selectedAssessment.id,
        email: selectedAssessment.studentEmail,
        subject: emailSubject,
        message: emailMessage,
      });
    }
  };

  const handleDownloadPDF = async (assessmentId: string) => {
    window.open(`/api/admin/assessments/${assessmentId}/pdf?customized=true`, '_blank');
  };

  // Create carousel cards for the workflow
  const workflowCards = [
    {
      id: "upload",
      title: "Upload Assessment",
      description: "Upload and process student PDF reports",
      icon: <Upload className="h-5 w-5 text-blue-600" />,
      color: "bg-blue-100",
      content: (
        <div className="space-y-6">
          {/* File Upload */}
          <div>
            {!selectedFile ? (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-sm font-medium">Drop PDF here or tap to browse</p>
                <p className="text-xs text-gray-500 mt-1">Assessment reports only</p>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedFile(null)}
                    data-testid="button-remove-file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Search Section */}
          <UserSearch 
            onSelectUser={(user) => {
              setStudentInfo({
                ...studentInfo,
                name: user.name || '',
                email: user.email
              });
            }}
          />

          {/* Student Information - Auto-populated from PDF */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <UserPlus className="h-4 w-4" />
              <span>Student Information {extractedInfo ? '(Auto-populated from PDF)' : '(Manual Entry)'}</span>
            </div>
            
            {extractedInfo && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Information extracted from PDF. You can edit if needed.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">Enter student details manually:</p>
              <Input
                placeholder="Student Name (optional)"
                value={studentInfo.name}
                onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
                data-testid="input-student-name"
                className={extractedInfo?.name ? "bg-blue-50" : ""}
              />
              <Input
                type="email"
                placeholder="Student Email (optional)"
                value={studentInfo.email}
                onChange={(e) => setStudentInfo({ ...studentInfo, email: e.target.value })}
                data-testid="input-student-email"
                className={extractedInfo?.email ? "bg-blue-50" : ""}
              />
              <Textarea
                placeholder="Instructor notes (optional)"
                value={studentInfo.instructorNotes}
                onChange={(e) => setStudentInfo({ ...studentInfo, instructorNotes: e.target.value })}
                rows={2}
                className="resize-none"
                data-testid="textarea-instructor-notes"
              />
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-upload-assessment"
          >
            {uploadMutation.isPending ? (
              <>Processing...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Assessment
              </>
            )}
          </Button>
        </div>
      )
    },
    {
      id: "customize",
      title: "Customize Study Guide",
      description: "Add personalized content and recommendations",
      icon: <Edit3 className="h-5 w-5 text-purple-600" />,
      color: "bg-purple-100",
      content: selectedAssessment ? (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Student:</strong> {selectedAssessment.studentName}
              <br /><strong>Score:</strong> {selectedAssessment.overallScore}% • {selectedAssessment.topicsCount} topics
              {selectedAssessment.extractedInfo?.programCohort && (
                <><br /><strong>Program:</strong> {selectedAssessment.extractedInfo.programCohort}</>
              )}
              {selectedAssessment.extractedInfo?.testDate && (
                <><br /><strong>Test Date:</strong> {selectedAssessment.extractedInfo.testDate}</>
              )}
              {selectedAssessment.extractedInfo?.assessmentName && (
                <><br /><strong>Assessment:</strong> {selectedAssessment.extractedInfo.assessmentName}</>
              )}
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="resources" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="priorities">Priorities</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="study-plan">Study Plan</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="priorities" className="mt-4">
              <Label>Topic Priority Order</Label>
              <p className="text-xs text-gray-600 mb-3">Drag topics to customize their priority in the study plan</p>
              <PriorityReorderer
                topics={(selectedAssessment as any).topicPerformance?.map((tp: any, index: number) => ({
                  id: `topic-${index}`,
                  name: tp.topic?.name || tp.topicName || '',
                  score: parseFloat(tp.score || '0'),
                  priority: parseFloat(tp.score || '0') < 60 ? 'High' : parseFloat(tp.score || '0') < 75 ? 'Medium' : 'Low',
                  system: tp.topic?.contentArea?.name || tp.contentAreaName || '',
                  gap: 100 - parseFloat(tp.score || '0')
                })) || []}
                onReorder={(reordered) => {
                  console.log('Topics reordered:', reordered);
                }}
                showScores={true}
                maxItems={10}
              />
            </TabsContent>

            <TabsContent value="resources" className="space-y-4 mt-4">
              <div>
                <Label>Recommended Resources</Label>
                <p className="text-xs text-gray-600 mb-2">Select resources based on identified topics</p>
                <ResourceSelector
                  selectedResources={customizations.recommendedResources}
                  onResourcesChange={(resources) => 
                    setCustomizations({ ...customizations, recommendedResources: resources })
                  }
                  placeholder="Select learning resources..."
                />
              </div>

              <div>
                <Label>Instructor Comments</Label>
                <Textarea
                  value={customizations.instructorComments}
                  onChange={(e) => setCustomizations({ ...customizations, instructorComments: e.target.value })}
                  placeholder="Personal message to the student..."
                  rows={3}
                  className="mt-1 resize-none"
                  data-testid="textarea-instructor-comments"
                />
              </div>
            </TabsContent>

            <TabsContent value="study-plan" className="mt-4">
              <Label>Personalized Study Plan</Label>
              <p className="text-xs text-gray-600 mb-3">Select or customize a study plan template</p>
              <StudyPlanSelector
                selectedPlan={customizations.studyPlanId}
                onPlanChange={(planId) => 
                  setCustomizations({ ...customizations, studyPlanId: planId })
                }
                studentScore={selectedAssessment.overallScore || 0}
                topicsCount={selectedAssessment.topicsCount}
              />
            </TabsContent>

            <TabsContent value="performance" className="mt-4">
              <PerformanceComparison
                assessmentId={selectedAssessment.id}
                studentName={selectedAssessment.studentName}
                topicScores={(selectedAssessment as any).topicPerformance?.map((tp: any) => ({
                  topic: tp.topic?.name || '',
                  score: parseFloat(tp.score || '0')
                })) || []}
              />
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveCustomizations}
              className="flex-1"
              data-testid="button-save-customizations"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Customizations
            </Button>
            <Button
              onClick={() => setShowPreview(true)}
              variant="outline"
              className="flex-1"
              data-testid="button-preview-html"
            >
              <Download className="mr-2 h-4 w-4" />
              Preview Study Guide
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Upload an assessment first</p>
          <p className="text-sm mt-1">Then customize the study guide</p>
        </div>
      )
    },
    {
      id: "send",
      title: "Send to Student",
      description: "Email the customized study guide",
      icon: <Mail className="h-5 w-5 text-green-600" />,
      color: "bg-green-100",
      content: selectedAssessment ? (
        <div className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <Send className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              Ready to send to: <strong>{selectedAssessment.studentEmail || 'No email provided'}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label>Email Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject line..."
                className="mt-1"
                data-testid="input-email-subject"
              />
            </div>

            <div>
              <Label>Email Message</Label>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Dear student..."
                rows={6}
                className="mt-1 resize-none"
                data-testid="textarea-email-message"
              />
            </div>
          </div>

          <Button
            onClick={handleSendEmail}
            disabled={!selectedAssessment.studentEmail || sendEmailMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-send-email"
          >
            {sendEmailMutation.isPending ? (
              <>Sending...</>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Study Guide
              </>
            )}
          </Button>

          {!selectedAssessment.studentEmail && (
            <p className="text-sm text-center text-amber-600">
              ⚠️ No email address provided for this student
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No assessment selected</p>
          <p className="text-sm mt-1">Complete previous steps first</p>
        </div>
      )
    },
    {
      id: "recent",
      title: "Recent Assessments",
      description: "View and manage uploaded assessments",
      icon: <FileText className="h-5 w-5 text-indigo-600" />,
      color: "bg-indigo-100",
      content: (
        <div className="space-y-3">
          {recentAssessments && recentAssessments.length > 0 ? (
            recentAssessments.slice(0, 5).map((assessment) => (
              <div
                key={assessment.id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setSelectedAssessment(assessment)}
                data-testid={`assessment-${assessment.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{assessment.studentName}</p>
                    <p className="text-xs text-gray-500">{assessment.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {assessment.uploadDate && !isNaN(new Date(assessment.uploadDate).getTime()) ? new Date(assessment.uploadDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{assessment.overallScore}%</Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {assessment.topicsCount} topics
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No assessments uploaded yet</p>
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      {selectedAssessment && (
        <StudyGuidePreview
          open={showPreview}
          onClose={() => setShowPreview(false)}
          assessment={selectedAssessment}
          customizations={customizations}
          resources={[]}
          studyPlan={null}
        />
      )}
      <AdminNavigation currentPage="Assessment Manager" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-3 bg-emerald-100 rounded-full">
                <GraduationCap className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Assessment Manager</h1>
            <p className="text-gray-600 mt-2">Upload, customize, and send personalized study guides</p>
          </div>
        </div>

        {/* Success Status */}
        {selectedAssessment && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Assessment processed successfully for <strong>{selectedAssessment.studentName}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Carousel */}
        <CarouselCard
          cards={workflowCards}
          showIndicators={true}
          className="mb-8"
          defaultIndex={currentCardIndex}
          onIndexChange={setCurrentCardIndex}
        />

        {/* Quick Actions */}
        <div className="flex justify-center gap-4 mt-8">
          {selectedAssessment && (
            <Button
              onClick={() => {
                setSelectedAssessment(null);
                setCustomizations({
                  additionalNotes: "",
                  recommendedResources: [],
                  studyPlanId: "",
                  instructorComments: ""
                });
              }}
              data-testid="button-new-assessment"
            >
              <Upload className="mr-2 h-4 w-4" />
              New Assessment
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate("/admin/batch-upload")}
            data-testid="button-batch-upload"
          >
            <Upload className="mr-2 h-4 w-4" />
            Batch Upload
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/assessments")}
            data-testid="button-view-all"
          >
            <FileText className="mr-2 h-4 w-4" />
            View All Assessments
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}