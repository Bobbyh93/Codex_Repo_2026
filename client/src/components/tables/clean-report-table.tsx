import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Clock, 
  Filter, 
  Search, 
  SortAsc, 
  SortDesc,
  Eye,
  Target,
  BookOpen,
  BarChart3,
  Timer,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractedData {
  id: string;
  topic: {
    name: string;
    contentArea: {
      name: string;
    };
    subject?: string;
    system?: string;
    specialty?: string;
    systemCategory?: string;
  };
  score: number;
  gapScore: number;
  priority: number;
  recommendedStudyTime: number;
}

interface CleanReportTableProps {
  data: ExtractedData[];
  reportName?: string;
  onTopicClick?: (topicName: string) => void;
  className?: string;
}

type SortField = 'topic' | 'score' | 'gapScore' | 'priority' | 'studyTime';
type SortDirection = 'asc' | 'desc';

export default function CleanReportTable({ data, reportName, onTopicClick, className = "" }: CleanReportTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Enhanced empty state
  if (!data || !data.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Assessment Report Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="bg-gray-100 rounded-full p-4">
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium text-muted-foreground">No assessment data available</p>
              <p className="text-sm text-muted-foreground">Upload a PDF assessment report to see detailed topic analysis</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get unique subjects for filtering
  const uniqueSubjects = useMemo(() => {
    const subjects = data.map(item => item.topic.subject || item.topic.specialty || 'Fundamentals');
    return Array.from(new Set(subjects)).sort();
  }, [data]);

  // Enhanced data filtering and sorting
  const processedData = useMemo(() => {
    let filteredData = data.filter(item => {
      const matchesSearch = searchTerm === "" || 
        item.topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.topic.subject || item.topic.specialty || 'Fundamentals').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.topic.system || item.topic.systemCategory || 'Core Concepts').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSubject = subjectFilter === "all" || 
        (item.topic.subject || item.topic.specialty || 'Fundamentals') === subjectFilter;
      
      const matchesPriority = priorityFilter === "all" || 
        (priorityFilter === "high" && item.priority <= 2) ||
        (priorityFilter === "medium" && item.priority === 3) ||
        (priorityFilter === "low" && item.priority >= 4);
      
      return matchesSearch && matchesSubject && matchesPriority;
    });

    // Sort the filtered data
    filteredData.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortField) {
        case 'topic':
          valueA = a.topic.name.toLowerCase();
          valueB = b.topic.name.toLowerCase();
          break;
        case 'score':
          valueA = a.score;
          valueB = b.score;
          break;
        case 'gapScore':
          valueA = a.gapScore;
          valueB = b.gapScore;
          break;
        case 'priority':
          valueA = a.priority;
          valueB = b.priority;
          break;
        case 'studyTime':
          valueA = a.recommendedStudyTime;
          valueB = b.recommendedStudyTime;
          break;
        default:
          valueA = a.priority;
          valueB = b.priority;
      }
      
      if (sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    return filteredData;
  }, [data, searchTerm, subjectFilter, priorityFilter, sortField, sortDirection]);

  // Group processed data by Subject → System → Topics for better organization
  const groupedData = useMemo(() => {
    return processedData.reduce((acc, item) => {
      const subject = item.topic.subject || item.topic.specialty || 'Fundamentals';
      const system = item.topic.system || item.topic.systemCategory || 'Core Concepts';
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
    }, {} as Record<string, { subject: string; system: string; topics: ExtractedData[] }>);
  }, [processedData]);

  // Calculate enhanced summary statistics
  const stats = useMemo(() => {
    const originalStats = {
      totalTopics: data.length,
      averageScore: data.reduce((sum, item) => sum + item.score, 0) / data.length,
      highPriorityCount: data.filter(item => item.priority <= 2).length,
      totalStudyTime: data.reduce((sum, item) => sum + item.recommendedStudyTime, 0),
      criticalTopics: data.filter(item => item.gapScore >= 40).length,
      averageGap: data.reduce((sum, item) => sum + item.gapScore, 0) / data.length
    };

    const filteredStats = {
      totalTopics: processedData.length,
      averageScore: processedData.length > 0 ? processedData.reduce((sum, item) => sum + item.score, 0) / processedData.length : 0,
      highPriorityCount: processedData.filter(item => item.priority <= 2).length,
      totalStudyTime: processedData.reduce((sum, item) => sum + item.recommendedStudyTime, 0),
      criticalTopics: processedData.filter(item => item.gapScore >= 40).length,
      averageGap: processedData.length > 0 ? processedData.reduce((sum, item) => sum + item.gapScore, 0) / processedData.length : 0
    };

    return { original: originalStats, filtered: filteredStats };
  }, [data, processedData]);

  // Sort grouped data by subject and system
  const sortedGroups = useMemo(() => {
    return Object.entries(groupedData)
      .sort((a, b) => {
        if (a[1].subject !== b[1].subject) {
          return a[1].subject.localeCompare(b[1].subject);
        }
        return a[1].system.localeCompare(b[1].system);
      });
  }, [groupedData]);

  // Enhanced sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Enhanced priority level function
  const getPriorityInfo = (priority: number, gapScore: number) => {
    if (priority === 1 || gapScore >= 40) {
      return { 
        level: 'Critical', 
        color: 'bg-red-100 text-red-700 border-red-200', 
        icon: '🔴',
        description: 'Immediate attention needed'
      };
    }
    if (priority === 2 || gapScore >= 25) {
      return { 
        level: 'High', 
        color: 'bg-orange-100 text-orange-700 border-orange-200', 
        icon: '🟠',
        description: 'High priority review'
      };
    }
    if (priority === 3 || gapScore >= 15) {
      return { 
        level: 'Medium', 
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
        icon: '🟡',
        description: 'Moderate focus needed'
      };
    }
    return { 
      level: 'Low', 
      color: 'bg-green-100 text-green-700 border-green-200', 
      icon: '🟢',
      description: 'Maintenance review'
    };
  };

  const { totalTopics, averageScore, highPriorityCount, totalStudyTime } = stats.filtered;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Report Summary</CardTitle>
          {reportName && <p className="text-sm text-muted-foreground">{reportName}</p>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Topics</p>
              <p className="text-2xl font-bold">{totalTopics}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-2xl font-bold">{averageScore.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">High Priority</p>
              <p className="text-2xl font-bold text-destructive">{highPriorityCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Study Time</p>
              <p className="text-2xl font-bold">{Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clean Data Table organized by Subject → System → Topic */}
      <Card>
        <CardHeader>
          <CardTitle>Topics to Review - Organized by Subject and System</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">Subject / System</th>
                  <th className="text-left p-4 font-medium text-sm">Topic to Review</th>
                  <th className="text-center p-4 font-medium text-sm">Score</th>
                  <th className="text-center p-4 font-medium text-sm">Gap</th>
                  <th className="text-center p-4 font-medium text-sm">Priority</th>
                  <th className="text-center p-4 font-medium text-sm">Study Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedGroups.map(([key, group]) => (
                  <>
                    {/* Subject and System Header */}
                    <tr key={`header-${key}`} className="bg-muted/20">
                      <td colSpan={6} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-sm">{group.subject}</span>
                            <span className="text-muted-foreground text-sm ml-2">→</span>
                            <span className="text-sm text-muted-foreground ml-2">{group.system}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {group.topics.length} topics
                          </Badge>
                        </div>
                      </td>
                    </tr>
                    {/* Topics in this subject/system */}
                    {group.topics
                      .sort((a, b) => a.priority - b.priority)
                      .map((item) => (
                      <tr key={item.id} className="hover:bg-accent/50" data-testid={`row-${item.id}`}>
                        <td className="p-4 text-sm text-muted-foreground pl-8">
                          {/* Indented for hierarchy */}
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-sm">{item.topic.name}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-medium text-sm ${
                            item.score >= 80 ? 'text-green-600' :
                            item.score >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.score.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-sm">
                            {item.gapScore.toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                            item.priority === 1 ? 'bg-red-100 text-red-700' :
                            item.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                            item.priority === 3 ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-4 text-center text-sm">
                          {item.recommendedStudyTime} min
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Subject Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Subject Area</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Group by subject for summary */}
            {Object.entries(
              sortedGroups.reduce((acc, [_, group]) => {
                if (!acc[group.subject]) {
                  acc[group.subject] = [];
                }
                acc[group.subject].push(...group.topics);
                return acc;
              }, {} as Record<string, ExtractedData[]>)
            ).map(([subject, topics]) => {
              const subjectAvg = topics.reduce((sum, t) => sum + t.score, 0) / topics.length;
              const systems = new Set(topics.map(t => t.topic.system || t.topic.systemCategory || 'Core Concepts')).size;
              
              return (
                <div key={subject} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {topics.length} topics across {systems} system{systems !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      subjectAvg >= 80 ? 'text-green-600' :
                      subjectAvg >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {subjectAvg.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Average Score</p>
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