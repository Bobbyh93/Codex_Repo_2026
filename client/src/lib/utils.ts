import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Enhanced study plan utility functions
export interface TopicPerformance {
  id: string;
  topic?: {
    id: string;
    name: string;
    subject?: string;
    specialty?: string;
    system?: string;
    systemCategory?: string;
  };
  score: string;
  gapScore: string;
  priority: number;
  recommendedStudyTime?: number;
}

// Priority reasoning and explanations
export const getPriorityExplanation = (priority: number, gapScore: number) => {
  if (priority <= 2) {
    if (gapScore >= 40) {
      return {
        level: "Critical Priority",
        reasoning: "Immediate attention needed - large knowledge gap detected",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        actionText: "Study this topic first to maximize score improvement"
      };
    } else if (gapScore >= 20) {
      return {
        level: "High Priority",
        reasoning: "Important gap that can significantly impact your score",
        color: "text-warning",
        bgColor: "bg-warning/10",
        actionText: "Focus on this after critical priorities"
      };
    }
  }
  
  if (priority === 3) {
    return {
      level: "Medium Priority",
      reasoning: "Moderate gap - good opportunity for improvement",
      color: "text-info",
      bgColor: "bg-info/10",
      actionText: "Review after completing high priority topics"
    };
  }
  
  return {
    level: "Review Priority",
    reasoning: "Small gap - reinforce existing knowledge",
    color: "text-success",
    bgColor: "bg-success/10",
    actionText: "Light review to maintain proficiency"
  };
};

// Enhanced gap score analysis
export const getGapAnalysis = (currentScore: number, gapScore: number, averageScore?: number) => {
  const targetScore = Math.min(100, Math.round(currentScore + gapScore));
  const scoreComparison = averageScore ? 
    (currentScore > averageScore ? 
      `${Math.round(currentScore - averageScore)}% above average` : 
      `${Math.round(averageScore - currentScore)}% below average`) : null;
  
  const impactText = gapScore >= 40 ? "High impact on overall score" :
                    gapScore >= 20 ? "Moderate impact on overall score" :
                    "Low impact on overall score";
  
  return {
    currentScore: Math.round(currentScore),
    targetScore,
    gapScore: Math.round(gapScore),
    scoreComparison,
    impactText,
    confidenceLevel: gapScore >= 20 ? "High" : gapScore >= 10 ? "Medium" : "Low"
  };
};

// Enhanced study time calculations
export const calculateEnhancedStudyTime = (gapScore: number, topicComplexity: 'low' | 'medium' | 'high' = 'medium') => {
  let baseTime: number;
  
  // Base time calculation based on gap score (1-3 hours per topic)
  if (gapScore >= 40) {
    baseTime = 180; // 180 minutes (3 hours) for large gaps
  } else if (gapScore >= 20) {
    baseTime = 120; // 120 minutes (2 hours) for medium gaps
  } else {
    baseTime = 60; // 60 minutes (1 hour) for small gaps
  }
  
  // Adjust for topic complexity
  const complexityMultiplier = {
    low: 0.8,
    medium: 1.0,
    high: 1.3
  };
  
  const totalTime = Math.round(baseTime * complexityMultiplier[topicComplexity]);
  
  // Break down by activity type
  const reviewTime = Math.round(totalTime * 0.6);
  const practiceTime = Math.round(totalTime * 0.4);
  
  return {
    totalTime,
    breakdown: {
      review: reviewTime,
      practice: practiceTime
    },
    sessions: Math.ceil(totalTime / 45), // 45-min study sessions
    timeToMastery: gapScore >= 40 ? "6-8 sessions" : gapScore >= 20 ? "4-5 sessions" : "2-3 sessions"
  };
};

// Resource status enhancement
export const getEnhancedResourceStatus = (topicId: string, resourceAvailability: Record<string, boolean>) => {
  const hasResources = resourceAvailability[topicId];
  
  if (hasResources) {
    return {
      status: "available",
      text: "Ready to Study",
      subtext: "Video lessons, practice questions & study guides available",
      icon: "CheckCircle",
      className: "text-success",
      bgClassName: "bg-success/10",
      buttonVariant: "default" as const,
      buttonText: "Start Studying",
      disabled: false
    };
  }
  
  return {
    status: "coming_soon",
    text: "In Development",
    subtext: "Resources being created - estimated completion by end of month",
    icon: "Clock",
    className: "text-warning",
    bgClassName: "bg-warning/10",
    buttonVariant: "outline" as const,
    buttonText: "Notify Me",
    disabled: true
  };
};

// Format study time for display
export const formatStudyTime = (minutes: number, includeBreakdown = false) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  let formatted = "";
  if (hours > 0) {
    formatted += `${hours}h`;
    if (mins > 0) formatted += ` ${mins}m`;
  } else {
    formatted = `${mins}m`;
  }
  
  return formatted;
};

// Calculate score impact
export const calculateScoreImpact = (gapScore: number, topicWeight: number = 1) => {
  // Estimate how much closing this gap could improve overall score
  const potentialGain = Math.round(gapScore * 0.6 * topicWeight); // 60% gap closure assumption
  
  return {
    potentialGain,
    impactLevel: potentialGain >= 8 ? "High" : potentialGain >= 4 ? "Medium" : "Low",
    description: `Closing this gap could add +${potentialGain} points to your overall score`
  };
};

// Topic difficulty assessment
export const assessTopicDifficulty = (topicName: string, subject?: string): 'low' | 'medium' | 'high' => {
  // Simple heuristic based on topic name and subject
  const highDifficultyKeywords = ['pathophysiology', 'pharmacology', 'critical care', 'advanced', 'complex'];
  const lowDifficultyKeywords = ['fundamentals', 'basic', 'introduction', 'overview'];
  
  const lowerName = topicName.toLowerCase();
  const lowerSubject = subject?.toLowerCase() || '';
  
  if (highDifficultyKeywords.some(keyword => lowerName.includes(keyword) || lowerSubject.includes(keyword))) {
    return 'high';
  }
  
  if (lowDifficultyKeywords.some(keyword => lowerName.includes(keyword) || lowerSubject.includes(keyword))) {
    return 'low';
  }
  
  return 'medium';
};
