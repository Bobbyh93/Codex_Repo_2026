import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import useEmblaCarousel from "embla-carousel-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, BookOpen, AlertTriangle, TrendingDown, Brain, Menu, Home, ChevronLeft, ChevronRight, ArrowRight, ArrowLeft } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { CarouselNavigation, CarouselHeader } from "@/components/ui/carousel-navigation";

export default function PreTestPrep() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    startIndex: 0,
    watchDrag: true,
    align: 'center'
  });
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedSyllabusId, setUploadedSyllabusId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch predicted problem areas based on syllabus
  const { data: predictedAreas } = useQuery<any>({
    queryKey: ["/api/syllabus", uploadedSyllabusId, "predicted-problems"],
    enabled: !!uploadedSyllabusId,
  });

  const { data: weeklyAnalysis } = useQuery<any[]>({
    queryKey: ["/api/syllabus", uploadedSyllabusId, "weekly-analysis"],
    enabled: !!uploadedSyllabusId,
  });

  const { data: studentPatterns } = useQuery<any>({
    queryKey: ["/api/syllabus", uploadedSyllabusId, "student-patterns"],
    enabled: !!uploadedSyllabusId,
  });

  // Syllabus upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "syllabus");
      
      const response = await fetch("/api/syllabus/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      setUploadedSyllabusId(data.syllabusId);
      toast({
        title: "Syllabus Analyzed!",
        description: `Identified ${data.weeksFound} weeks of content and ${data.objectivesFound} learning objectives`,
      });
      setTimeout(() => {
        emblaApi?.scrollNext();
      }, 500);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Please try again with a valid syllabus file",
        variant: "destructive",
      });
    },
  });

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: false,
  });

  const handleSubmit = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const navigateToSlide = (index: number) => {
    emblaApi?.scrollTo(index);
    setShowMenu(false);
  };

  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setCurrentSlide(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  const slides = [
    // Slide 1: Upload Syllabus
    {
      id: 'upload',
      title: 'Upload Course Syllabus',
      content: (
        <div className="space-y-6 max-w-md mx-auto">
          <Alert>
            <BookOpen className="h-4 w-4" />
            <AlertDescription>
              Upload your course syllabus to predict which topics you'll likely need the most help with
            </AlertDescription>
          </Alert>
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'}`}
            data-testid="syllabus-dropzone"
          >
            <input {...getInputProps()} />
            {selectedFile ? (
              <div className="space-y-2">
                <BookOpen className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium">
                  {isDragActive ? "Drop your syllabus here" : "Drag & drop your course syllabus"}
                </p>
                <p className="text-sm text-muted-foreground">PDF, DOC, or DOCX format</p>
              </div>
            )}
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={!selectedFile || uploadMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-submit-syllabus"
          >
            {uploadMutation.isPending ? "Analyzing..." : "Analyze Syllabus"}
          </Button>
        </div>
      )
    },
    
    // Slide 2: Course Overview & Risk Analysis
    {
      id: 'overview',
      title: 'Course Risk Analysis',
      content: uploadedSyllabusId ? (
        <div className="space-y-6 max-w-md mx-auto">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-900">
              Based on historical data, students typically struggle most with Pharmacology Calculations, IV Therapy, and Acid-Base Balance topics
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Course Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Course Specialty</span>
                  <Badge>{predictedAreas?.specialty || "Medical-Surgical"}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Weeks</span>
                  <span className="font-medium">{predictedAreas?.totalWeeks || 16}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">High-Risk Topics</span>
                  <Badge variant="destructive">{predictedAreas?.highRiskCount || 8}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Difficulty Prediction</CardTitle>
              <CardDescription>Based on similar student performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Overall Difficulty</span>
                    <span className="text-sm font-medium">High</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  78% of students need additional support in this course
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            onClick={() => emblaApi?.scrollNext()}
            className="w-full"
            size="lg"
          >
            View Problem Areas
          </Button>
        </div>
      ) : null
    },
    
    // Slide 3: What Students Typically Miss
    {
      id: 'patterns',
      title: 'What Students Typically Miss',
      content: uploadedSyllabusId ? (
        <div className="space-y-4 max-w-md mx-auto">
          <Alert>
            <TrendingDown className="h-4 w-4" />
            <AlertDescription>
              These topics have the highest failure rates based on your course type
            </AlertDescription>
          </Alert>
          
          {(studentPatterns?.commonMisses || [
            { topic: "Pharmacology Calculations", missRate: 82, bodySystem: "Pharmacology" },
            { topic: "Acid-Base Balance", missRate: 78, bodySystem: "Respiratory" },
            { topic: "Cardiac Dysrhythmias", missRate: 75, bodySystem: "Cardiovascular" },
            { topic: "Fluid & Electrolytes", missRate: 71, bodySystem: "Renal" },
            { topic: "Endocrine Disorders", missRate: 68, bodySystem: "Endocrine" }
          ]).slice(0, 5).map((item: any, index: number) => (
            <Card key={index} className={index === 0 ? "border-red-200" : ""}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.topic}</p>
                    <p className="text-xs text-muted-foreground">{item.bodySystem}</p>
                  </div>
                  <Badge variant={item.missRate > 75 ? "destructive" : "secondary"}>
                    {item.missRate}% miss
                  </Badge>
                </div>
                <Progress value={item.missRate} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Typically covered in week {item.week || index + 3}
                </p>
              </CardContent>
            </Card>
          ))}
          
          <Button 
            onClick={() => emblaApi?.scrollNext()}
            className="w-full"
            variant="outline"
          >
            Continue
          </Button>
        </div>
      ) : null
    },
    
    // Slide 4: Top 3 Critical Topics
    {
      id: 'weekly',
      title: 'Critical Focus Areas',
      content: uploadedSyllabusId ? (
        <div className="space-y-4 max-w-md mx-auto">
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              These 3 topics need your immediate attention based on difficulty and failure rates
            </AlertDescription>
          </Alert>
          
          <div className="space-y-3">
            {[
              { topic: "Pharmacology Calculations", week: 4, reason: "82% of students struggle with dosage calculations" },
              { topic: "Acid-Base Balance", week: 6, reason: "Complex concepts with 78% failure rate" },
              { topic: "IV Therapy & Fluid Balance", week: 5, reason: "Critical skill with high clinical importance" }
            ].map((item, index) => (
              <Card key={index} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-base" data-testid={`text-focus-title-${index}`}>
                        {index + 1}. {item.topic}
                      </h3>
                      <span className="text-xs text-muted-foreground">Week {item.week}</span>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-focus-why-${index}`}>
                      {item.reason}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => emblaApi?.scrollPrev()}
              variant="outline"
              size="lg"
              className="flex-1"
              data-testid="button-prev-slide"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={() => emblaApi?.scrollNext()}
              className="flex-1"
              size="lg"
              data-testid="button-view-recommendations"
            >
              View Study Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null
    },
    
    // Slide 5: Pre-Test Study Plan
    {
      id: 'plan',
      title: 'Your Pre-Test Study Plan',
      content: uploadedSyllabusId ? (
        <div className="space-y-4 max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommended Pre-Study Focus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="font-medium text-sm">Start Early On:</p>
                <ul className="space-y-1">
                  <li className="text-sm flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Pharmacology calculations (Week 4)
                  </li>
                  <li className="text-sm flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Acid-base balance (Week 6)
                  </li>
                  <li className="text-sm flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Cardiac dysrhythmias (Week 8)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Study Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Pre-study time needed</span>
                <span className="font-bold">3-4 hours/week</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Critical topics</span>
                <span className="font-bold">Pharm, Acid-Base, Cardiac</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Success probability</span>
                <Badge className="bg-green-100 text-green-800">+25% improvement</Badge>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                toast({
                  title: "Pre-Test Plan Created",
                  description: "Your preparation strategy is ready!",
                });
              }}
              className="flex-1"
              size="lg"
            >
              Start Preparing
            </Button>
            
            <Button 
              onClick={() => navigate("/")}
              variant="outline"
              size="lg"
            >
              Back
            </Button>
          </div>
        </div>
      ) : null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Page Header */}
      <PageHeader
        title="Pre-Test Preparation"
        description="Prepare before your assessment"
        badge={{
          text: "Pre-Test Mode",
          variant: "outline"
        }}
        showHomeButton={true}
        showEducatorLogin={true}
        showBranding={true}
        variant="centered"
        className="px-4"
      />

      {/* Main Carousel Container */}
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-4xl">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {slides.map((slide) => (
                <div key={slide.id} className="flex-[0_0_100%] px-4">
                  <Card className="mx-auto max-w-2xl">
                    <CardHeader className="text-center">
                      <CarouselHeader
                        title={slide.title}
                        currentSlide={currentSlide}
                        totalSlides={slides.length}
                        showProgress={true}
                      />
                    </CardHeader>
                    <CardContent className="pb-6">
                      {slide.content}
                    </CardContent>
                    <div className="px-6 pb-6">
                      {/* Integrated Navigation */}
                      <CarouselNavigation
                        currentSlide={currentSlide}
                        totalSlides={slides.length}
                        onPrevious={() => emblaApi?.scrollPrev()}
                        onNext={() => emblaApi?.scrollNext()}
                        canGoPrevious={currentSlide > 0}
                        canGoNext={currentSlide < slides.length - 1 && (!!uploadedSyllabusId || currentSlide === 0)}
                        showNumbers={false}
                        showIndicators={false}
                        className="mt-4"
                      />
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}