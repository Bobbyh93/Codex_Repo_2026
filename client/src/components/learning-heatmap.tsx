import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, Clock, Target, Info } from "lucide-react";

interface StudyActivity {
  date: string;
  topic: string;
  minutesStudied: number;
  resourcesCompleted: number;
  scoreImprovement: number;
  intensity: number; // 0-4 scale for color intensity
}

interface HeatmapProps {
  data?: StudyActivity[];
  onCellClick?: (activity: StudyActivity) => void;
}

export function LearningHeatmap({ data: propData, onCellClick }: HeatmapProps) {
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<StudyActivity[]>([]);

  // Generate sample data if none provided
  const generateSampleData = (): StudyActivity[] => {
    const topics = ["Pharmacology", "Cardiac", "Respiratory", "Fluid & Electrolytes", "Mental Health"];
    const activities: StudyActivity[] = [];
    const today = new Date();
    
    // Generate data for last 365 days
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Random chance of having study activity (60% chance)
      if (Math.random() < 0.6) {
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const minutesStudied = Math.floor(Math.random() * 120) + 10;
        const intensity = Math.min(4, Math.floor(minutesStudied / 30));
        
        activities.push({
          date: date.toISOString().split('T')[0],
          topic,
          minutesStudied,
          resourcesCompleted: Math.floor(Math.random() * 5) + 1,
          scoreImprovement: Math.floor(Math.random() * 15),
          intensity
        });
      }
    }
    
    return activities;
  };

  // Fetch data from API on mount
  useEffect(() => {
    if (!propData) {
      fetchStudyActivity();
    }
  }, [propData]);

  const fetchStudyActivity = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/study-activity/demo");
      if (response.ok) {
        const activities = await response.json();
        // Transform API data to component format
        const transformedData = activities.flatMap((day: any) => 
          day.sessions?.map((session: any) => ({
            date: day.date,
            topic: session.topic,
            minutesStudied: session.minutesStudied,
            resourcesCompleted: session.resourcesCompleted?.length || 0,
            scoreImprovement: session.endScore ? session.endScore - session.startScore : 0,
            intensity: Math.min(4, Math.floor(session.minutesStudied / 30))
          })) || []
        );
        setApiData(transformedData);
      }
    } catch (error) {
      console.error("Failed to fetch study activity:", error);
      // Fall back to sample data
      setApiData(generateSampleData());
    } finally {
      setLoading(false);
    }
  };

  const data = propData || apiData || generateSampleData();

  // Get unique topics for filter
  const topics = useMemo(() => {
    const topicSet = new Set(data.map(d => d.topic));
    return ["all", ...Array.from(topicSet)];
  }, [data]);

  // Filter data based on selected topic
  const filteredData = useMemo(() => {
    if (selectedTopic === "all") return data;
    return data.filter(d => d.topic === selectedTopic);
  }, [data, selectedTopic]);

  // Group data by date for easy lookup
  const dataByDate = useMemo(() => {
    const map = new Map<string, StudyActivity[]>();
    filteredData.forEach(activity => {
      const existing = map.get(activity.date) || [];
      map.set(activity.date, [...existing, activity]);
    });
    return map;
  }, [filteredData]);

  // Generate calendar grid
  const generateCalendarGrid = () => {
    const today = new Date();
    const grid = [];
    
    if (viewMode === "month") {
      // Show last 5 weeks
      const weeks = 5;
      const daysPerWeek = 7;
      
      for (let week = 0; week < weeks; week++) {
        const weekRow = [];
        for (let day = 0; day < daysPerWeek; day++) {
          const date = new Date(today);
          date.setDate(date.getDate() - (week * 7 + day));
          const dateStr = date.toISOString().split('T')[0];
          const activities = dataByDate.get(dateStr) || [];
          
          weekRow.push({
            date: dateStr,
            day: date.getDate(),
            month: date.getMonth(),
            activities,
            intensity: activities.reduce((sum, a) => sum + a.intensity, 0) / Math.max(1, activities.length),
            isMonthView: true
          });
        }
        grid.push(weekRow);
      }
    } else {
      // Year view - show 52 weeks
      const weeks = 52;
      const daysPerWeek = 7;
      
      for (let week = 0; week < weeks; week++) {
        const weekRow = [];
        for (let day = 0; day < daysPerWeek; day++) {
          const date = new Date(today);
          date.setDate(date.getDate() - (week * 7 + day));
          const dateStr = date.toISOString().split('T')[0];
          const activities = dataByDate.get(dateStr) || [];
          
          weekRow.push({
            date: dateStr,
            activities,
            intensity: activities.reduce((sum, a) => sum + a.intensity, 0) / Math.max(1, activities.length),
            isMonthView: false
          });
        }
        grid.push(weekRow);
      }
    }
    
    return grid;
  };

  const calendarGrid = generateCalendarGrid();

  // Color intensity mapping
  const getColorClass = (intensity: number) => {
    if (intensity === 0) return "bg-gray-100 hover:bg-gray-200";
    if (intensity <= 1) return "bg-green-200 hover:bg-green-300";
    if (intensity <= 2) return "bg-green-400 hover:bg-green-500";
    if (intensity <= 3) return "bg-green-600 hover:bg-green-700";
    return "bg-green-800 hover:bg-green-900";
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDays = new Set(filteredData.map(d => d.date)).size;
    const totalMinutes = filteredData.reduce((sum, d) => sum + d.minutesStudied, 0);
    const totalResources = filteredData.reduce((sum, d) => sum + d.resourcesCompleted, 0);
    const avgImprovement = filteredData.length > 0 
      ? filteredData.reduce((sum, d) => sum + d.scoreImprovement, 0) / filteredData.length
      : 0;
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (dataByDate.has(dateStr)) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }
    
    return {
      totalDays,
      totalHours: Math.round(totalMinutes / 60),
      totalResources,
      avgImprovement: avgImprovement.toFixed(1),
      currentStreak
    };
  }, [filteredData, dataByDate]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Learning Activity Heatmap
          </CardTitle>
          <div className="flex gap-2">
            <Select value={selectedTopic} onValueChange={setSelectedTopic}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topics.map(topic => (
                  <SelectItem key={topic} value={topic}>
                    {topic === "all" ? "All Topics" : topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "year")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month View</SelectItem>
                <SelectItem value="year">Year View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.currentStreak}</p>
            <p className="text-xs text-gray-600">Day Streak</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.totalDays}</p>
            <p className="text-xs text-gray-600">Study Days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.totalHours}h</p>
            <p className="text-xs text-gray-600">Total Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.totalResources}</p>
            <p className="text-xs text-gray-600">Resources</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">+{stats.avgImprovement}%</p>
            <p className="text-xs text-gray-600">Avg Gain</p>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Day labels for month view */}
            {viewMode === "month" && (
              <div className="flex gap-1 mb-2 ml-8">
                {weekDays.map(day => (
                  <div key={day} className="w-6 text-xs text-gray-600 text-center">
                    {day[0]}
                  </div>
                ))}
              </div>
            )}
            
            {/* Calendar grid */}
            <div className="flex flex-col gap-1">
              <TooltipProvider>
                {calendarGrid.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex gap-1 items-center">
                    {/* Week label */}
                    {viewMode === "month" && (
                      <div className="w-8 text-xs text-gray-600 text-right pr-2">
                        W{calendarGrid.length - weekIndex}
                      </div>
                    )}
                    
                    {/* Day cells */}
                    {week.map((day, dayIndex) => {
                      const hasActivity = day.activities.length > 0;
                      const totalMinutes = day.activities.reduce((sum, a) => sum + a.minutesStudied, 0);
                      const totalResources = day.activities.reduce((sum, a) => sum + a.resourcesCompleted, 0);
                      
                      return (
                        <Tooltip key={`${weekIndex}-${dayIndex}`}>
                          <TooltipTrigger asChild>
                            <button
                              className={`
                                ${viewMode === "month" ? "w-6 h-6" : "w-3 h-3"}
                                rounded-sm transition-colors
                                ${getColorClass(day.intensity)}
                              `}
                              onClick={() => hasActivity && onCellClick?.(day.activities[0])}
                            >
                              {viewMode === "month" && 'day' in day && day.day && (
                                <span className="text-xs">{day.day}</span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p className="font-semibold">{day.date}</p>
                              {hasActivity ? (
                                <>
                                  <p>{totalMinutes} minutes studied</p>
                                  <p>{totalResources} resources completed</p>
                                  <p>Topics: {Array.from(new Set(day.activities.map(a => a.topic))).join(", ")}</p>
                                </>
                              ) : (
                                <p className="text-gray-500">No activity</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </TooltipProvider>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-6">
              <span className="text-xs text-gray-600">Less</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map(level => (
                  <div
                    key={level}
                    className={`w-4 h-4 rounded-sm ${getColorClass(level)}`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-600">More</span>
              <div className="ml-auto flex items-center gap-1">
                <Info className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">Click cells for details</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}