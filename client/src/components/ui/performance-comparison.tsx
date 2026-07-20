import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Users, User, School } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopicPerformance {
  topic: string;
  studentScore: number;
  nationalAvg: number;
  programAvg: number;
  cohortAvg: number;
  percentileRank: number;
}

interface PerformanceComparisonProps {
  assessmentId: string;
  studentName?: string;
  topicScores?: { topic: string; score: number }[];
}

export function PerformanceComparison({
  assessmentId,
  studentName = "Student",
  topicScores = []
}: PerformanceComparisonProps) {
  // Fetch comparison data from database
  const { data: comparisons, isLoading } = useQuery<TopicPerformance[]>({
    queryKey: ['/api/admin/performance-comparison', assessmentId],
    enabled: !!assessmentId,
  });

  const getPerformanceIndicator = (studentScore: number, avgScore: number) => {
    const diff = studentScore - avgScore;
    if (diff > 5) return { icon: TrendingUp, color: 'text-green-600', label: 'Above' };
    if (diff < -5) return { icon: TrendingDown, color: 'text-red-600', label: 'Below' };
    return { icon: Minus, color: 'text-gray-600', label: 'Average' };
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'bg-green-100 text-green-800';
    if (percentile >= 50) return 'bg-blue-100 text-blue-800';
    if (percentile >= 25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const performanceData = comparisons || topicScores.map(ts => ({
    topic: ts.topic,
    studentScore: ts.score,
    nationalAvg: 72, // Default values - would come from database
    programAvg: 74,
    cohortAvg: 73,
    percentileRank: Math.round((ts.score / 100) * 100)
  }));

  return (
    <div className="space-y-4">
      {/* Overall Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">vs National</span>
                <Badge variant="outline" className="text-xs">
                  {performanceData.length > 0 && 
                    Math.round(performanceData.reduce((acc, p) => acc + (p.studentScore - p.nationalAvg), 0) / performanceData.length)}%
                </Badge>
              </div>
              <Progress 
                value={performanceData.length > 0 ? 
                  Math.max(0, Math.min(100, 50 + (performanceData.reduce((acc, p) => acc + (p.studentScore - p.nationalAvg), 0) / performanceData.length))) : 
                  50} 
                className="h-2" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">vs Program</span>
                <Badge variant="outline" className="text-xs">
                  {performanceData.length > 0 && 
                    Math.round(performanceData.reduce((acc, p) => acc + (p.studentScore - p.programAvg), 0) / performanceData.length)}%
                </Badge>
              </div>
              <Progress 
                value={performanceData.length > 0 ? 
                  Math.max(0, Math.min(100, 50 + (performanceData.reduce((acc, p) => acc + (p.studentScore - p.programAvg), 0) / performanceData.length))) : 
                  50} 
                className="h-2" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">vs Cohort</span>
                <Badge variant="outline" className="text-xs">
                  {performanceData.length > 0 && 
                    Math.round(performanceData.reduce((acc, p) => acc + (p.studentScore - p.cohortAvg), 0) / performanceData.length)}%
                </Badge>
              </div>
              <Progress 
                value={performanceData.length > 0 ? 
                  Math.max(0, Math.min(100, 50 + (performanceData.reduce((acc, p) => acc + (p.studentScore - p.cohortAvg), 0) / performanceData.length))) : 
                  50} 
                className="h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Topic-by-Topic Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Topic Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performanceData.slice(0, 5).map((perf, index) => {
              const vsNational = getPerformanceIndicator(perf.studentScore, perf.nationalAvg);
              const vsProgram = getPerformanceIndicator(perf.studentScore, perf.programAvg);
              
              return (
                <div 
                  key={index} 
                  className="p-3 bg-gray-50 rounded-lg"
                  data-testid={`topic-comparison-${index}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{perf.topic}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Score: <span className="font-semibold">{Math.round(perf.studentScore)}%</span>
                      </p>
                    </div>
                    <Badge 
                      className={cn("text-xs", getPercentileColor(perf.percentileRank))}
                    >
                      {perf.percentileRank}th Percentile
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <vsNational.icon className={cn("h-3 w-3", vsNational.color)} />
                      <span className="text-xs text-gray-600">
                        National: {Math.round(perf.nationalAvg)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <vsProgram.icon className={cn("h-3 w-3", vsProgram.color)} />
                      <span className="text-xs text-gray-600">
                        Program: {Math.round(perf.programAvg)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <School className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        Cohort: {Math.round(perf.cohortAvg)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}