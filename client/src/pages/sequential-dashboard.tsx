import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import useEmblaCarousel from "embla-carousel-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, Upload, FileText, Check, Menu, Home, AlertCircle, TrendingUp, Brain, Heart, Download } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";

export default function SequentialDashboard() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    startIndex: 0,
    watchDrag: true,
    align: 'center'
  });
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedReportId, setUploadedReportId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const { toast } = useToast();

  // Fetch report data
  const { data: topicPerformance } = useQuery<any[]>({
    queryKey: ["/api/assessment-reports", uploadedReportId, "topic-performance"],
    enabled: !!uploadedReportId,
  });

  const { data: peerComparison } = useQuery<any>({
    queryKey: ["/api/assessment-reports", uploadedReportId, "peer-comparison"],
    enabled: !!uploadedReportId,
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
      setUploadedReportId(data.reportId);
      toast({
        title: "Success!",
        description: `Extracted ${data.topicsFound} topics from your report`,
      });
      // Move to next slide
      setTimeout(() => {
        emblaApi?.scrollNext();
      }, 500);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Please try again with a valid PDF file",
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
      'application/pdf': ['.pdf']
    },
    multiple: false,
  });

  const handleSubmit = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleDownloadPDF = () => {
    if (uploadedReportId) {
      window.open(`/api/assessment-reports/${uploadedReportId}/pdf`, '_blank');
    }
  };

  const navigateToSlide = (index: number) => {
    emblaApi?.scrollTo(index);
    setShowMenu(false);
  };

  // Update current slide when carousel moves
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

  // Group topics by Subject → System
  const getOrganizedTopics = () => {
    if (!topicPerformance || !Array.isArray(topicPerformance)) return {};
    
    return topicPerformance.reduce((acc: any, item: any) => {
      const subject = item.topic?.subject || item.topic?.specialty || 'General Nursing';
      const system = item.topic?.system || item.topic?.systemCategory || 'Core Concepts';
      const key = `${subject}::${system}`;
      
      if (!acc[key]) {
        acc[key] = {
          subject,
          system,
          topics: []
        };
      }
      acc[key].topics.push(item);
      return acc;
    }, {});
  };

  const organizedTopics = getOrganizedTopics();

  // Calculate statistics
  const calculateStats = () => {
    if (!topicPerformance || !Array.isArray(topicPerformance)) {
      return { total: 0, average: 0, highPriority: 0, studyHours: 0 };
    }
    
    const total = topicPerformance.length;
    const average = total > 0 ? 
      topicPerformance.reduce((sum, t) => sum + (parseFloat(t.score) || 0), 0) / total : 0;
    const highPriority = topicPerformance.filter((t: any) => t.priority <= 2).length;
    const studyMinutes = topicPerformance.reduce((sum, t) => sum + (t.recommendedStudyTime || 30), 0);
    
    return {
      total,
      average: average.toFixed(1),
      highPriority,
      studyHours: Math.round(studyMinutes / 60)
    };
  };

  const stats = calculateStats();

  const slides = [
    // Slide 1: Upload
    {
      id: 'upload',
      title: 'Upload Assessment Report',
      content: (
        <div className="max-w-md mx-auto space-y-6">
          {!selectedFile ? (
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="text-sm text-gray-600 mt-1">or click to browse</p>
            </div>
          ) : (
            <div className="border-2 border-green-200 bg-green-50 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium text-green-900">File ready to analyze</p>
                    <p className="text-sm text-green-700 mt-1">{selectedFile.name}</p>
                    <p className="text-xs text-green-600 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
          
          {selectedFile && (
            <div className="space-y-2">
              <Button 
                onClick={handleSubmit}
                disabled={uploadMutation.isPending}
                className="w-full"
                size="lg"
              >
                {uploadMutation.isPending ? "Processing..." : "Analyze Report"}
              </Button>
              {!uploadMutation.isPending && (
                <Button 
                  onClick={handleRemoveFile}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Cancel & Choose Different File
                </Button>
              )}
            </div>
          )}
        </div>
      )
    },
    
    // Slide 2: Summary
    {
      id: 'summary',
      title: 'Your Results Summary',
      content: uploadedReportId && topicPerformance ? (
        <div className="space-y-6 max-w-md mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              We've analyzed your assessment and identified {stats.total} topics for review
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">{stats.average}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Topics</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                  <p className="text-2xl font-bold text-red-600">{stats.highPriority}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Study Time</p>
                  <p className="text-2xl font-bold">{stats.studyHours}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            onClick={() => emblaApi?.scrollNext()}
            className="w-full"
            size="lg"
          >
            View Topics by Subject
          </Button>
        </div>
      ) : null
    },
    
    // Slide 3: Topics by Subject and System
    {
      id: 'organized-topics',
      title: 'Topics Organized by Subject & System',
      content: uploadedReportId && topicPerformance ? (
        <div className="space-y-4 max-w-md mx-auto max-h-[500px] overflow-y-auto">
          {Object.entries(organizedTopics)
            .sort((a: any, b: any) => {
              if (a[1].subject !== b[1].subject) {
                return a[1].subject.localeCompare(b[1].subject);
              }
              return a[1].system.localeCompare(b[1].system);
            })
            .map(([key, group]: [string, any]) => (
              <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-sm font-semibold">{group.subject}</CardTitle>
                      <CardDescription className="text-xs">{group.system}</CardDescription>
                    </div>
                    <Badge variant="secondary">{group.topics.length} topics</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.topics
                      .sort((a: any, b: any) => (a.priority || 3) - (b.priority || 3))
                      .slice(0, 3)
                      .map((topic: any) => (
                        <div key={topic.id} className="flex justify-between items-center text-sm">
                          <span className="truncate flex-1">{topic.topic?.name || 'Unknown'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {parseFloat(topic.score).toFixed(0)}%
                            </span>
                            <Badge 
                              variant={topic.priority === 1 ? "destructive" : 
                                      topic.priority === 2 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              P{topic.priority || 3}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    {group.topics.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{group.topics.length - 3} more</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          
          <Button 
            onClick={() => emblaApi?.scrollNext()}
            className="w-full sticky bottom-0 bg-background"
            variant="outline"
          >
            View Priority Topics
          </Button>
        </div>
      ) : null
    },
    
    // Slide 4: High Priority Topics
    {
      id: 'priorities',
      title: 'High Priority Focus Areas',
      content: uploadedReportId && topicPerformance ? (
        <div className="space-y-4 max-w-md mx-auto">
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Focus on these topics first - they have the biggest knowledge gaps
            </AlertDescription>
          </Alert>
          
          {(topicPerformance && Array.isArray(topicPerformance) ? topicPerformance : [])
            .filter((t: any) => t.priority <= 2)
            .sort((a: any, b: any) => (a.priority || 3) - (b.priority || 3))
            .slice(0, 5)
            .map((topic: any, index: number) => (
              <Card key={topic.id} className={topic.priority === 1 ? "border-red-200" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-base">{topic.topic?.name || 'Unknown Topic'}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {topic.topic?.subject || topic.topic?.specialty || 'Fundamentals'} → {topic.topic?.system || topic.topic?.systemCategory || 'Core Concepts'}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={topic.priority === 1 ? "destructive" : "default"}
                      className="ml-2"
                    >
                      Priority {topic.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex justify-between text-sm">
                    <span>Score: {parseFloat(topic.score).toFixed(1)}%</span>
                    <span>Gap: {parseFloat(topic.gapScore).toFixed(0)}%</span>
                    <span>Study: {topic.recommendedStudyTime || 30}min</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          
          <Button 
            onClick={() => emblaApi?.scrollNext()}
            className="w-full"
            size="lg"
          >
            Download Study Guide
          </Button>
        </div>
      ) : null
    },
    
    // Slide 5: Download Study Guide
    {
      id: 'download',
      title: 'Your Personalized Study Guide',
      content: uploadedReportId ? (
        <div className="space-y-6 max-w-md mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <CardTitle>Study Guide Ready!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your personalized study guide has been prepared based on your assessment results.
              </p>
              
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Your guide includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Topics organized by Subject & System</li>
                  <li>• Priority rankings for each topic</li>
                  <li>• Performance scores and knowledge gaps</li>
                  <li>• Recommended study times</li>
                  <li>• Week-by-week study plan</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleDownloadPDF}
                className="w-full"
                size="lg"
                variant="default"
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF Study Guide
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Save this guide and follow the study plan to improve your performance
              </p>
            </CardContent>
          </Card>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => navigateToSlide(0)}
              className="flex-1"
              variant="outline"
            >
              Upload New Report
            </Button>
            <Button 
              onClick={() => navigateToSlide(2)}
              className="flex-1"
              variant="outline"
            >
              Review Topics
            </Button>
          </div>
        </div>
      ) : null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      {/* Navigation Menu */}
      <div className="fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowMenu(!showMenu)}
        >
          <Menu className="h-4 w-4" />
        </Button>
        
        {showMenu && (
          <Card className="absolute top-12 left-0 w-64 shadow-lg">
            <CardContent className="p-2">
              {slides.map((slide, index) => (
                <Button
                  key={slide.id}
                  variant={currentSlide === index ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => navigateToSlide(index)}
                >
                  {index === 0 && <Upload className="mr-2 h-4 w-4" />}
                  {slide.title}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex justify-center gap-1">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 transition-all duration-300 ${
                index === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-gray-300'
              } rounded-full`}
            />
          ))}
        </div>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide) => (
            <div key={slide.id} className="flex-[0_0_100%] min-w-0">
              <div className="px-4">
                <h2 className="text-2xl font-bold text-center mb-6">{slide.title}</h2>
                {slide.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      <div className="flex justify-center gap-4 mt-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={currentSlide === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => emblaApi?.scrollNext()}
          disabled={currentSlide === slides.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}