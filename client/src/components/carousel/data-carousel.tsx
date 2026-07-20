import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Clock, TrendingUp, Award, Target } from "lucide-react";

interface TopicData {
  id: string;
  topic: {
    name: string;
    description?: string;
    specialty?: string;
    diagnoses?: string[];
    systemCategory?: string;
    clinicalConcepts?: string[];
    contentArea: {
      name: string;
    };
  };
  score: number;
  gapScore: number;
  priority: number;
  recommendedStudyTime: number;
}

interface DataCarouselProps {
  data: TopicData[];
  reportName?: string;
}

export default function DataCarousel({ data, reportName }: DataCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: 'start',
    skipSnaps: false,
    dragFree: false
  });
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    
    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (!data || !data.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Assessment Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-12">
            No data available. Upload a PDF assessment report to see results.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group data by specialty or system category for more granular organization
  const groupedData = data.reduce((acc, item) => {
    const groupKey = item.topic.specialty || item.topic.systemCategory || 'General Nursing';
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, TopicData[]>);

  // Calculate summary stats
  const totalTopics = data.length;
  const averageScore = data.reduce((sum, item) => sum + Number(item.score || 0), 0) / totalTopics;
  const highPriorityCount = data.filter(item => item.priority <= 2).length;
  const totalStudyTime = data.reduce((sum, item) => sum + (item.recommendedStudyTime || 0), 0);

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return "bg-red-500 text-white";
    if (priority === 2) return "bg-yellow-500 text-white";
    if (priority === 3) return "bg-blue-500 text-white";
    return "bg-gray-400 text-white";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Topics</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalTopics}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Average Score</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{averageScore.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">High Priority</p>
                <p className="text-3xl font-bold text-red-900 dark:text-red-100">{highPriorityCount}</p>
              </div>
              <Award className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Study Time</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                  {Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topic Cards Carousel */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Extracted Assessment Topics</CardTitle>
              {reportName && <p className="text-sm text-muted-foreground mt-1">{reportName}</p>}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={scrollPrev}
                className="h-8 w-8"
                data-testid="carousel-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={scrollNext}
                className="h-8 w-8"
                data-testid="carousel-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {data.map((item, index) => (
                <div 
                  key={item.id} 
                  className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] px-2"
                  data-testid={`carousel-item-${index}`}
                >
                  <Card className="h-full bg-gradient-to-b from-background to-muted/20 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={getPriorityColor(item.priority)}>
                          Priority {item.priority}
                        </Badge>
                        {item.topic.specialty && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {item.topic.specialty}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg line-clamp-2">
                        {item.topic.name}
                      </h3>
                      
                      {/* Display specific diagnoses if available */}
                      {item.topic.diagnoses && item.topic.diagnoses.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Key Diagnoses:</p>
                          <div className="flex flex-wrap gap-1">
                            {item.topic.diagnoses.slice(0, 3).map((dx, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-purple-50 text-purple-700">
                                {dx}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Display clinical concepts */}
                      {item.topic.clinicalConcepts && item.topic.clinicalConcepts.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Clinical Focus:</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.topic.clinicalConcepts.join(", ")}
                          </p>
                        </div>
                      )}
                      
                      {item.topic.systemCategory && (
                        <Badge variant="outline" className="text-xs mt-2">
                          {item.topic.systemCategory}
                        </Badge>
                      )}
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Score Display */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Performance</span>
                          <span className={`text-lg font-bold ${getScoreColor(Number(item.score || 0))}`}>
                            {Number(item.score || 0).toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={Number(item.score || 0)} 
                          className="h-2"
                        />
                      </div>

                      {/* Gap Score */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Knowledge Gap</span>
                          <span className="text-sm font-semibold">
                            {Number(item.gapScore || 0).toFixed(0)}%
                          </span>
                        </div>
                        <Progress 
                          value={Number(item.gapScore || 0)} 
                          className="h-2 bg-red-100"
                        />
                      </div>

                      {/* Study Time */}
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 mr-1" />
                            Study Time
                          </div>
                          <span className="font-medium">
                            {item.recommendedStudyTime} min
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Carousel Dots Indicator */}
          <div className="flex justify-center space-x-2 mt-6">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === selectedIndex 
                    ? 'bg-primary w-6' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                onClick={() => scrollTo(index)}
                data-testid={`carousel-dot-${index}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Specialty/System Summary Cards - Focused on Granular Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groupedData).map(([specialtyName, topics]) => {
          const areaAvg = topics.reduce((sum, t) => sum + Number(t.score || 0), 0) / topics.length;
          const allDiagnoses = topics.flatMap(t => t.topic.diagnoses || []);
          const uniqueDiagnoses = Array.from(new Set(allDiagnoses));
          
          return (
            <Card key={specialtyName} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{specialtyName}</CardTitle>
                <p className="text-sm text-muted-foreground">{topics.length} specific topics</p>
                {uniqueDiagnoses.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Covers {uniqueDiagnoses.length} diagnoses
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Average Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(areaAvg)}`}>
                      {areaAvg.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">Priority Topics</p>
                    <p className="text-2xl font-bold text-destructive">
                      {topics.filter(t => t.priority <= 2).length}
                    </p>
                  </div>
                </div>
                <Progress value={areaAvg} className="mt-3 h-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}