/**
 * Curriculum Progress Component
 * Displays and manages user progress through curriculum chapters
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, CheckCircle, Clock, PlayCircle, 
  TrendingUp, Award, Target, Timer 
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CurriculumProgress {
  id: string;
  userId: string;
  chapterId: string;
  chapterName?: string;
  subject?: string;
  topicId?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progressPercentage: number;
  timeSpent: number;
  startedAt?: Date;
  completedAt?: Date;
  lastAccessedAt?: Date;
}

interface ProgressStatistics {
  totalChaptersStarted: number;
  totalChaptersCompleted: number;
  totalTimeSpent: number;
  averageProgress: number;
  recentChapters: CurriculumProgress[];
}

interface CurriculumProgressProps {
  chapterId?: string;
  chapterName?: string;
  subject?: string;
  topicId?: string;
  onProgressUpdate?: (progress: CurriculumProgress) => void;
  showStatistics?: boolean;
  compact?: boolean;
}

export function CurriculumProgress({
  chapterId,
  chapterName,
  subject,
  topicId,
  onProgressUpdate,
  showStatistics = false,
  compact = false
}: CurriculumProgressProps) {
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);

  // Fetch progress for specific chapter
  const { data: chapterProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['/api/curriculum/progress', chapterId],
    queryFn: async () => {
      if (!chapterId) return null;
      const response = await fetch(`/api/curriculum/progress/${chapterId}`);
      if (!response.ok) {
        if (response.status === 401) {
          // User not logged in
          return null;
        }
        throw new Error('Failed to fetch progress');
      }
      return response.json();
    },
    enabled: !!chapterId,
  });

  // Fetch overall statistics
  const { data: statistics, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/curriculum/statistics'],
    queryFn: async () => {
      const response = await fetch('/api/curriculum/statistics');
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch statistics');
      }
      return response.json();
    },
    enabled: showStatistics,
  });

  // Start chapter mutation
  const startChapterMutation = useMutation({
    mutationFn: async () => {
      if (!chapterId) throw new Error('Chapter ID required');
      
      return apiRequest('POST', `/api/curriculum/progress/${chapterId}/start`, {
        chapterName,
        subject,
        topicId
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/curriculum/progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/curriculum/statistics'] });
      setIsTracking(true);
      onProgressUpdate?.(data);
      toast({
        title: "Chapter Started",
        description: "Your progress is being tracked",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start tracking progress",
        variant: "destructive",
      });
    }
  });

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ progressPercentage, timeSpentMinutes }: { 
      progressPercentage: number; 
      timeSpentMinutes?: number;
    }) => {
      if (!chapterId) throw new Error('Chapter ID required');
      
      return apiRequest('POST', `/api/curriculum/progress/${chapterId}/update`, {
        progressPercentage,
        timeSpentMinutes
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/curriculum/progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/curriculum/statistics'] });
      onProgressUpdate?.(data);
    }
  });

  // Complete chapter mutation
  const completeChapterMutation = useMutation({
    mutationFn: async () => {
      if (!chapterId) throw new Error('Chapter ID required');
      
      const timeSpentMinutes = Math.round(sessionTime / 60);
      return apiRequest('POST', `/api/curriculum/progress/${chapterId}/complete`, {
        timeSpentMinutes
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/curriculum/progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/curriculum/statistics'] });
      setIsTracking(false);
      onProgressUpdate?.(data);
      toast({
        title: "Chapter Completed!",
        description: "Great job on completing this chapter",
      });
    }
  });

  // Track time spent
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTracking]);

  // Auto-save progress every 5 minutes
  useEffect(() => {
    if (!isTracking || sessionTime === 0 || sessionTime % 300 !== 0) return;

    const progressPercentage = Math.min(
      chapterProgress?.progressPercentage + 10 || 10,
      90
    );
    
    updateProgressMutation.mutate({
      progressPercentage,
      timeSpentMinutes: 5
    });
  }, [sessionTime]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (compact && chapterId) {
    // Compact view for individual chapter progress
    return (
      <div className="flex items-center gap-3">
        {loadingProgress ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" />
            Loading...
          </div>
        ) : chapterProgress?.status === 'completed' ? (
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        ) : chapterProgress?.status === 'in_progress' ? (
          <div className="flex items-center gap-2">
            <Progress 
              value={chapterProgress.progressPercentage} 
              className="w-20 h-2"
            />
            <span className="text-xs text-muted-foreground">
              {chapterProgress.progressPercentage}%
            </span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => startChapterMutation.mutate()}
            disabled={startChapterMutation.isPending}
            data-testid="button-start-chapter"
          >
            <PlayCircle className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}
      </div>
    );
  }

  if (showStatistics && statistics) {
    // Statistics view
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Curriculum Progress Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Chapters Started</p>
              <p className="text-2xl font-bold" data-testid="stat-chapters-started">
                {statistics.totalChaptersStarted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-success" data-testid="stat-chapters-completed">
                {statistics.totalChaptersCompleted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Study Time</p>
              <p className="text-2xl font-bold" data-testid="stat-total-time">
                {formatMinutes(statistics.totalTimeSpent)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg Progress</p>
              <p className="text-2xl font-bold" data-testid="stat-avg-progress">
                {statistics.averageProgress}%
              </p>
            </div>
          </div>

          {statistics.recentChapters.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Recent Chapters</h4>
              {statistics.recentChapters.map((chapter: CurriculumProgress) => (
                <div key={chapter.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{chapter.chapterName || `Chapter ${chapter.chapterId}`}</p>
                    {chapter.subject && (
                      <p className="text-xs text-muted-foreground">{chapter.subject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {chapter.status === 'completed' ? (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Complete
                      </Badge>
                    ) : (
                      <>
                        <Progress 
                          value={chapter.progressPercentage} 
                          className="w-20 h-2"
                        />
                        <span className="text-xs text-muted-foreground">
                          {chapter.progressPercentage}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!chapterId) {
    return null;
  }

  // Full chapter progress view
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Chapter Progress
            </CardTitle>
            {chapterName && (
              <p className="text-sm text-muted-foreground mt-1">{chapterName}</p>
            )}
          </div>
          {chapterProgress?.status === 'completed' && (
            <Badge variant="default" className="gap-1">
              <Award className="h-3 w-3" />
              Completed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingProgress ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading progress...
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{chapterProgress?.progressPercentage || 0}%</span>
              </div>
              <Progress 
                value={chapterProgress?.progressPercentage || 0} 
                className="h-3"
              />
            </div>

            {/* Time Tracking */}
            {(chapterProgress?.timeSpent || sessionTime > 0) && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span>Total: {formatMinutes(chapterProgress?.timeSpent || 0)}</span>
                </div>
                {isTracking && (
                  <div className="flex items-center gap-2 text-primary">
                    <Clock className="h-4 w-4" />
                    <span>Session: {formatTime(sessionTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!chapterProgress || chapterProgress.status === 'not_started' ? (
                <Button
                  onClick={() => startChapterMutation.mutate()}
                  disabled={startChapterMutation.isPending}
                  className="flex-1"
                  data-testid="button-start-tracking"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Chapter
                </Button>
              ) : chapterProgress.status === 'in_progress' ? (
                <>
                  <Button
                    onClick={() => completeChapterMutation.mutate()}
                    disabled={completeChapterMutation.isPending}
                    className="flex-1"
                    data-testid="button-complete-chapter"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                  {!isTracking && (
                    <Button
                      variant="outline"
                      onClick={() => setIsTracking(true)}
                      data-testid="button-resume-tracking"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center w-full py-2 text-sm text-muted-foreground">
                  You completed this chapter!
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}