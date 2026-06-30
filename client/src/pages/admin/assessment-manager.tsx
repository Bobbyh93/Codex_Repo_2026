import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Download, 
  Mail, 
  Edit3, 
  Save, 
  FileText,
  CheckCircle,
  AlertCircle,
  Trash2,
  Eye,
  Send
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";

interface StudentAssessment {
  id: string;
  studentName: string;
  studentEmail: string;
  fileName: string;
  uploadDate: Date;
  overallScore: number;
  topicsCount: number;
  customizations?: {
    additionalNotes?: string;
    recommendedResources?: string[];
    weeklyPlan?: string;
    instructorComments?: string;
  };
}

export default function AssessmentManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentInfo, setStudentInfo] = useState({
    name: "",
    email: "",
    instructorNotes: ""
  });
  const [selectedAssessment, setSelectedAssessment] = useState<StudentAssessment | null>(null);
  const [customizations, setCustomizations] = useState({
    additionalNotes: "",
    recommendedResources: "",
    weeklyPlan: "",
    instructorComments: ""
  });
  const [emailSubject, setEmailSubject] = useState("Your Personalized Study Guide");
  const [emailMessage, setEmailMessage] = useState("Please find your personalized study guide attached. Review the topics carefully and follow the recommended study plan.");
  
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
      formData.append("studentName", data.studentInfo.name);
      formData.append("studentEmail", data.studentInfo.email);
      formData.append("instructorNotes", data.studentInfo.instructorNotes);
      
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
        description: `Successfully processed assessment for ${studentInfo.name}`,
      });
      setSelectedFile(null);
      setStudentInfo({ name: "", email: "", instructorNotes: "" });
      refetchAssessments();
      setSelectedAssessment(data);
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

  // Generate and download customized PDF
  const handleDownloadPDF = async (assessmentId: string) => {
    window.open(`/api/admin/assessments/${assessmentId}/pdf?customized=true`, '_blank');
  };

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Assessment Manager</h1>
          <p className="text-gray-600 mt-2">Upload student assessments and customize their study guides</p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload Assessment</TabsTrigger>
            <TabsTrigger value="customize">Customize Study Guide</TabsTrigger>
            <TabsTrigger value="manage">Manage Assessments</TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload New Assessment</CardTitle>
                <CardDescription>Upload a student's assessment PDF and enter their information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File Upload */}
                <div>
                  <Label>Assessment PDF</Label>
                  {!selectedFile ? (
                    <div 
                      {...getRootProps()} 
                      className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-sm font-medium">Drop assessment PDF here or click to browse</p>
                    </div>
                  ) : (
                    <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium">{selectedFile.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedFile(null)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Student Information (Optional) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="student-name">Student Name (Optional)</Label>
                    <Input
                      id="student-name"
                      value={studentInfo.name}
                      onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
                      placeholder="John Doe (optional)"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="student-email">Student Email (Optional)</Label>
                    <Input
                      id="student-email"
                      type="email"
                      value={studentInfo.email}
                      onChange={(e) => setStudentInfo({ ...studentInfo, email: e.target.value })}
                      placeholder="student@example.com (optional)"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="instructor-notes">Instructor Notes (Optional)</Label>
                  <Textarea
                    id="instructor-notes"
                    value={studentInfo.instructorNotes}
                    onChange={(e) => setStudentInfo({ ...studentInfo, instructorNotes: e.target.value })}
                    placeholder="Add any initial notes about this student's performance..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {uploadMutation.isPending ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload and Process Assessment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customize Tab */}
          <TabsContent value="customize" className="space-y-6">
            {selectedAssessment ? (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Customizing study guide for <strong>{selectedAssessment.studentName}</strong> - 
                    Score: {selectedAssessment.overallScore}% - {selectedAssessment.topicsCount} topics
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Customize Study Guide Content</CardTitle>
                    <CardDescription>Add personalized content to enhance the student's study guide</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="additional-notes">Additional Study Notes</Label>
                      <Textarea
                        id="additional-notes"
                        value={customizations.additionalNotes}
                        onChange={(e) => setCustomizations({ ...customizations, additionalNotes: e.target.value })}
                        placeholder="Add specific study tips or focus areas for this student..."
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="resources">Recommended Resources</Label>
                      <Textarea
                        id="resources"
                        value={customizations.recommendedResources}
                        onChange={(e) => setCustomizations({ ...customizations, recommendedResources: e.target.value })}
                        placeholder="List specific textbook chapters, videos, or practice questions..."
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="weekly-plan">Customized Weekly Study Plan</Label>
                      <Textarea
                        id="weekly-plan"
                        value={customizations.weeklyPlan}
                        onChange={(e) => setCustomizations({ ...customizations, weeklyPlan: e.target.value })}
                        placeholder="Week 1: Focus on...\nWeek 2: Review..."
                        rows={5}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="comments">Instructor Comments</Label>
                      <Textarea
                        id="comments"
                        value={customizations.instructorComments}
                        onChange={(e) => setCustomizations({ ...customizations, instructorComments: e.target.value })}
                        placeholder="Personal message or encouragement for the student..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveCustomizations}
                        disabled={saveCustomizationsMutation.isPending}
                        className="flex-1"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Customizations
                      </Button>
                      <Button
                        onClick={() => handleDownloadPDF(selectedAssessment.id)}
                        variant="outline"
                        className="flex-1"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Send Study Guide via Email</CardTitle>
                    <CardDescription>Email the customized study guide to the student</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="email-to">Send To</Label>
                      <Input
                        id="email-to"
                        value={selectedAssessment.studentEmail}
                        disabled
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email-subject">Email Subject</Label>
                      <Input
                        id="email-subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email-message">Email Message</Label>
                      <Textarea
                        id="email-message"
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSendEmail}
                        disabled={sendEmailMutation.isPending}
                        className="flex-1"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {sendEmailMutation.isPending ? "Sending..." : "Send Email with PDF"}
                      </Button>
                      <Button
                        onClick={() => handleDownloadPDF(selectedAssessment.id)}
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please upload an assessment first or select one from the Manage tab
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Assessments</CardTitle>
                <CardDescription>View and manage previously uploaded assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentAssessments && recentAssessments.length > 0 ? (
                    recentAssessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedAssessment(assessment)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{assessment.studentName}</p>
                            <p className="text-sm text-gray-600">{assessment.studentEmail}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Uploaded: {assessment.uploadDate && !isNaN(new Date(assessment.uploadDate).getTime()) ? new Date(assessment.uploadDate).toLocaleDateString() : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={assessment.overallScore >= 70 ? "default" : "destructive"}>
                              {assessment.overallScore}%
                            </Badge>
                            <p className="text-xs text-gray-500 mt-1">{assessment.topicsCount} topics</p>
                          </div>
                        </div>
                        {assessment.customizations && (
                          <Badge variant="outline" className="mt-2">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Customized
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No assessments uploaded yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}