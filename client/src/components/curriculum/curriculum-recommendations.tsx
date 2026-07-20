/**
 * Component for displaying curriculum recommendations for weak topics
 * Integrates with external curriculum API to show relevant chapters
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, ChevronRight, AlertCircle, Sparkles, 
  Clock, Target, FileText, ExternalLink, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Chapter {
  chapter_id: string;
  chapter_name: string;
  subject: string;
  topic_count?: number;
}

interface TopicRecommendation {
  topic: string;
  score: number;
  chapters: Chapter[];
}

interface CurriculumRecommendationsProps {
  reportId: string;
  threshold?: number;
  onChapterSelect?: (chapterId: string) => void;
}

export default function CurriculumRecommendations({ 
  reportId, 
  threshold = 70,
  onChapterSelect 
}: CurriculumRecommendationsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<TopicRecommendation[]>([]);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if curriculum service is available
  useEffect(() => {
    checkCurriculumService();
  }, []);

  // Fetch recommendations when service is available
  useEffect(() => {
    if (serviceAvailable && reportId) {
      fetchRecommendations();
    }
  }, [serviceAvailable, reportId, threshold]);

  const checkCurriculumService = async () => {
    try {
      const response = await fetch('/api/curriculum/health');
      const data = await response.json();
      setServiceAvailable(response.ok);
      
      if (!response.ok) {
        setError("Curriculum service is currently unavailable");
      }
    } catch (err) {
      console.error("Failed to check curriculum service:", err);
      setServiceAvailable(false);
      setError("Unable to connect to curriculum service");
    }
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/curriculum/recommendations/${reportId}?threshold=${threshold}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch curriculum recommendations');
      }

      const data = await response.json();
      
      if (data.recommendations && Array.isArray(data.recommendations)) {
        setRecommendations(data.recommendations);
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError("Failed to load curriculum recommendations");
      toast({
        title: "Connection Error",
        description: "Curriculum content is temporarily unavailable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    checkCurriculumService();
    if (serviceAvailable) {
      fetchRecommendations();
    }
  };

  const handleChapterClick = (chapterId: string) => {
    if (onChapterSelect) {
      onChapterSelect(chapterId);
    } else {
      // Default behavior - could open in new tab or modal
      window.open(`/curriculum/chapter/${chapterId}`, '_blank');
    }
  };

  // Don't show component if service is unavailable and no cached data
  if (!serviceAvailable && recommendations.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Loading Curriculum Content...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && recommendations.length === 0) {
    return (
      <Alert variant="default" className="border-warning">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Curriculum content temporarily unavailable</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Recommended Curriculum Chapters
          </CardTitle>
          {!serviceAvailable && (
            <Badge variant="secondary" className="text-xs">
              Cached
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Structured learning materials aligned with your weak topics
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div 
                key={`${rec.topic}-${index}`}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedTopic(
                    expandedTopic === rec.topic ? null : rec.topic
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{rec.topic}</h4>
                      <Badge 
                        variant={rec.score < 50 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {Math.round(rec.score)}% score
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rec.chapters.length} relevant {rec.chapters.length === 1 ? 'chapter' : 'chapters'} available
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform ${
                    expandedTopic === rec.topic ? 'rotate-90' : ''
                  }`} />
                </div>

                {expandedTopic === rec.topic && rec.chapters.length > 0 && (
                  <div className="mt-3 pl-4 space-y-2 border-l-2 border-primary/20">
                    {rec.chapters.map((chapter) => (
                      <div 
                        key={chapter.chapter_id}
                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-background cursor-pointer"
                        onClick={() => handleChapterClick(chapter.chapter_id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {chapter.chapter_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {chapter.subject}
                            </span>
                            {chapter.topic_count && (
                              <span className="text-xs text-muted-foreground">
                                {chapter.topic_count} topics
                              </span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>Based on topics scoring below {threshold}%</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/curriculum/browse', '_blank')}
          >
            Browse All Chapters
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}