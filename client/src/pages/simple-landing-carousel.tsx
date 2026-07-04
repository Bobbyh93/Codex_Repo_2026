import { useState } from "react";
import { CarouselCard } from "@/components/ui/carousel-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useScrollToTop } from "@/hooks/use-scroll-to-top";
import { useLocation } from "wouter";
import { 
  GraduationCap, 
  Upload, 
  Target, 
  TrendingUp, 
  BookOpen, 
  BarChart3,
  ChevronRight,
  ArrowRight,
  Shield,
  Brain,
  CheckCircle,
  Star,
  Users,
  Award,
  FileText,
  AlertCircle
} from "lucide-react";
import { useDropzone } from 'react-dropzone';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { rememberLastUploadedReport } from "@/lib/student-session";

export default function SimpleLandingCarousel() {
  useScrollToTop();
  
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMode, setSelectedMode] = useState<'assessment' | 'syllabus' | null>(null); // Start with no mode selected
  const [currentCardIndex, setCurrentCardIndex] = useState(0); // Start with mode selection card
  const [uploading, setUploading] = useState(false);

  const handleAssessmentUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file first",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      const response = await fetch("/api/assessment-reports", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Analysis failed");
      
      const data = await response.json();
      
      rememberLastUploadedReport(data);
      
      toast({
        title: "Analysis Complete",
        description: `Identified ${data.topicsFound || 0} topics to review`,
      });
      
      navigate(data.nextStep || `/professional-study-guide/${data.reportId}`);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Please try again with a valid assessment PDF",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSyllabusUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file first",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", "syllabus");
      
      const response = await fetch("/api/syllabus/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      
      toast({
        title: "Syllabus Analyzed!",
        description: `Identified ${data.weeksFound || 0} weeks of content and ${data.objectivesFound || 0} learning objectives`,
      });
      
      // Navigate to the pre-test-prep page with syllabusId
      navigate(`/pre-test-prep?syllabusId=${data.syllabusId}`);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Please try again with a valid syllabus file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const featureCards = [
    {
      id: "mode-selection",
      title: "Choose Your Path to NCLEX Success",
      description: "Select how you want to boost your nursing exam performance",
      icon: <FileText className="h-6 w-6 text-primary" />,
      color: "bg-primary/10",
      content: (
        <div className="space-y-4">
          <p className="text-center text-gray-600 mb-6">
            Maximize your study efficiency with AI-powered analysis
          </p>
          
          <div className="space-y-4">
            <Card 
              className={`cursor-pointer transition-all ${
                selectedMode === 'assessment' 
                  ? 'ring-2 ring-info bg-info/5' 
                  : 'hover:shadow-lg hover:scale-105'
              }`}
              onClick={() => {
                setSelectedMode('assessment');
                setCurrentCardIndex(1); // Move to upload card
              }}
              data-testid="mode-assessment"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-info/10 rounded-lg">
                    <Target className="h-5 w-5 text-info" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-heading-4 mb-1">🎯 Score Improvement Mode</h3>
                    <p className="text-caption text-muted-foreground">
                      Turn your assessment results into a personalized action plan for NCLEX success
                    </p>
                  </div>
                  {selectedMode === 'assessment' && (
                    <CheckCircle className="h-4 w-4 text-info mt-1" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${
                selectedMode === 'syllabus' 
                  ? 'ring-2 ring-success bg-success/5' 
                  : 'hover:shadow-lg hover:scale-105'
              }`}
              onClick={() => {
                setSelectedMode('syllabus');
                setCurrentCardIndex(1); // Move to upload card
              }}
              data-testid="mode-syllabus"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <BookOpen className="h-5 w-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-heading-4 mb-1">📚 Strategic Prep Mode</h3>
                    <p className="text-caption text-muted-foreground">
                      Get ahead of your next exam with targeted study from your syllabus
                    </p>
                  </div>
                  {selectedMode === 'syllabus' && (
                    <CheckCircle className="h-4 w-4 text-success mt-1" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedMode && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 text-center">
                Selected: <span className="font-semibold">
                  {selectedMode === 'assessment' ? 'Score Improvement Mode' : 'Strategic Prep Mode'}
                </span>
              </p>
            </div>
          )}
        </div>
      )
    },
    {
      id: "upload",
      title: "Upload Assessment Report",
      description: "Get your personalized NCLEX study plan in minutes",
      icon: <Upload className="h-6 w-6 text-blue-600" />,
      color: "bg-blue-100",
      content: (
        <div className="space-y-4" id="upload-card">
          {/* Mode Switcher */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-lg border bg-muted p-1">
              <button
                onClick={() => setSelectedMode('assessment')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  selectedMode === 'assessment' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="mode-assessment"
              >
                🎯 Assessment Analysis
              </button>
              <button
                onClick={() => setSelectedMode('syllabus')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  selectedMode === 'syllabus' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="mode-syllabus"
              >
                📚 Course Prep
              </button>
            </div>
          </div>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragActive ? 'border-primary bg-primary/5 scale-105' : 'border-gray-300 hover:border-gray-400'
                }`}
                data-testid="dropzone-main"
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2">
                  {selectedFile ? selectedFile.name : `Drop your ${selectedMode === 'assessment' ? 'assessment' : 'syllabus'} PDF here`}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedMode === 'assessment' 
                    ? 'Upload your nursing assessment results for analysis' 
                    : 'Upload course syllabus for strategic preparation'
                  }
                </p>
              </div>
              
              {selectedFile && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">File ready for analysis!</span>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center">
                {selectedMode === 'assessment' ? (
                  <Button 
                    onClick={handleAssessmentUpload}
                    data-testid="button-post-test"
                    disabled={!selectedFile || uploading}
                    className="w-full max-w-xs"
                  >
                    {uploading ? 'Analyzing...' : '🎯 Analyze Results'}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSyllabusUpload}
                    data-testid="button-pre-test"
                    disabled={!selectedFile || uploading}
                    className="w-full max-w-xs"
                  >
                    {uploading ? 'Analyzing...' : '📖 Generate Study Plan'}
                  </Button>
                )}
              </div>
        </div>
      )
    },
    {
      id: "features",
      title: "Key Features",
      description: "Everything you need to succeed",
      icon: <Star className="h-6 w-6 text-purple-600" />,
      color: "bg-purple-100",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <Target className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm font-medium">Gap Analysis</p>
              <p className="text-xs text-gray-500">Identify knowledge gaps</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
              <BookOpen className="h-5 w-5 text-emerald-600 mb-2" />
              <p className="text-sm font-medium">Study Plans</p>
              <p className="text-xs text-gray-500">Personalized guides</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm font-medium">Progress Tracking</p>
              <p className="text-xs text-gray-500">Visual analytics</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-600 mb-2" />
              <p className="text-sm font-medium">Performance</p>
              <p className="text-xs text-gray-500">Track improvement</p>
            </div>
          </div>
          
          <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">NCLEX-Ready</p>
                  <p className="text-lg font-bold">Content Mapping</p>
                </div>
                <Award className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      id: "testimonials",
      title: "Student Success Stories",
      description: "Join thousands of successful nurses",
      icon: <Users className="h-6 w-6 text-orange-600" />,
      color: "bg-orange-100",
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm italic">"This tool helped me identify exactly where I needed to focus. Passed NCLEX on first try!"</p>
              <p className="text-xs text-gray-500 mt-2">- Sarah M., RN</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm italic">"The personalized study plans saved me so much time. Highly recommend!"</p>
              <p className="text-xs text-gray-500 mt-2">- Michael T., BSN</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold">92%</div>
              <div className="text-xs text-gray-500">Pass Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">30hrs</div>
              <div className="text-xs text-gray-500">Avg. Saved</div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-emerald-50">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="font-bold text-xl">NursePrep</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            data-testid="button-admin"
          >
            <Shield className="h-4 w-4 mr-1" />
            Admin
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mobile-p-4 py-8">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <Badge className="mb-4" variant="secondary">
            AI-Powered Analysis
          </Badge>
          <h1 className="text-display mb-4 bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            Master Your Nursing Assessments
          </h1>
          <p className="text-body-large text-muted-foreground">
            Upload your PDF report and get instant personalized study recommendations
          </p>
        </div>
        
        {/* Main Feature Carousel */}
        <CarouselCard
          cards={featureCards}
          showIndicators={true}
          autoSwipe={false}
          defaultIndex={currentCardIndex}
          onIndexChange={setCurrentCardIndex}
          className="mb-12"
        />
      </section>

      {/* Quick Actions */}
      <section className="px-4 py-8 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-heading-2 text-center mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 mobile-gap-4">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 touch-target-large"
              onClick={() => navigate('/pre-test-prep')}
            >
              <CardContent className="mobile-p-4 text-center">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-info" />
                <p className="text-body-small font-medium">Pre-Test Prep</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate('/mvp-action-plan')}
            >
              <CardContent className="p-4 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                <p className="text-sm font-medium">Gap Analysis</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate('/study-guide')}
            >
              <CardContent className="p-4 text-center">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <p className="text-sm font-medium">Study Guide</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate('/progress')}
            >
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <p className="text-sm font-medium">Progress</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Excel?</h3>
              <p className="mb-6 opacity-90">
                Join thousands of nursing students who've improved their scores
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => document.getElementById('upload-card')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-start-now"
              >
                Start Your Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-6 text-center text-sm text-gray-500">
        <p>© 2025 NursePrep Analytics • Empowering Future Nurses</p>
      </footer>
    </div>
  );
}
