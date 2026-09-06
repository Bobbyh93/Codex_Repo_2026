import { db } from "./db";
import { 
  topicsToReview, 
  topicPerformance, 
  assessmentReports, 
  groupAnalytics,
  topicRelationships,
  studyPlans,
  studyPlanItems 
} from "@shared/topics-schema";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";

interface AdminStudyBlueprintInput {
  reportId: string;
  isGroupAssessment: boolean;
  customizationOptions?: {
    includeRelatedTopics: boolean;
    compareToNational: boolean;
    compareToCohort: boolean;
    maxStudyHours: number;
    focusAreas?: string[]; // Specific subjects to focus on
  };
}

interface TopicComparison {
  topic: string;
  subject: string;
  system: string | null;
  individualScore: number;
  gapScore: number;
  nationalMean: number | null;
  programMean: number | null;
  cohortMean: number | null;
  percentileBelowNational: number | null;
  percentileBelowProgram: number | null;
  relatedTopics: string[];
  adjustedStudyTime: number;
  priority: number;
  rationale: string;
}

interface GroupStatistics {
  sampleSize: number;
  meanScore: number;
  medianScore: number;
  standardDeviation: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

interface AdminStudyBlueprint {
  reportId: string;
  isGroup: boolean;
  generatedAt: Date;
  
  // Overview
  overview: {
    totalTopics: number;
    highPriorityTopics: number;
    estimatedTotalTime: number; // minutes
    adjustedTotalTime: number; // with related topics
    performanceLevel: string; // "Below Average", "Average", "Above Average"
    keyStrengths: string[];
    criticalGaps: string[];
  };
  
  // Subject-based organization
  subjectAnalysis: {
    subject: string;
    systemBreakdown: {
      system: string | null;
      topics: TopicComparison[];
      groupStats?: GroupStatistics;
    }[];
    subjectMeanScore: number;
    subjectGapScore: number;
    recommendedFocusTime: number; // minutes
  }[];
  
  // Comparative analytics
  comparativeAnalytics: {
    performanceVsNational: number | null;
    performanceVsProgram: number | null;
    performanceVsCohort: number | null;
    topicsBelowNational: string[];
    topicsBelowProgram: string[];
    uniqueStrengths: string[]; // Topics where student/group excels
    commonWeaknesses: string[]; // Topics where most struggle
  };
  
  // Smart recommendations
  smartRecommendations: {
    immediateActionItems: {
      topic: string;
      reason: string;
      estimatedImpact: string; // "High", "Medium", "Low"
      relatedTopics: string[];
    }[];
    
    studySequence: {
      week: number;
      focus: string; // Subject or system
      topics: string[];
      hours: number;
      rationale: string;
    }[];
    
    resourceAllocation: {
      subject: string;
      percentageOfTime: number;
      priority: string; // "Critical", "High", "Medium", "Low"
    }[];
  };
  
  // Group-specific insights (if applicable)
  groupInsights?: {
    topPerformers: string[]; // Top topics for the group
    bottomPerformers: string[]; // Weakest topics for the group
    variability: {
      highVariabilityTopics: string[]; // Topics with high score variance
      consistentTopics: string[]; // Topics with consistent performance
    };
    recommendations: string[];
  };
}

export async function generateAdminStudyBlueprint(
  input: AdminStudyBlueprintInput
): Promise<AdminStudyBlueprint> {
  
  // Fetch the assessment report
  const report = await db.query.assessmentReports.findFirst({
    where: eq(assessmentReports.id, input.reportId)
  });
  
  if (!report) {
    throw new Error("Assessment report not found");
  }
  
  // Fetch topic performance data for this report
  const performanceData = await db.query.topicPerformance.findMany({
    where: eq(topicPerformance.reportId, input.reportId),
    with: {
      topic: true
    },
    orderBy: [desc(topicPerformance.priority), desc(topicPerformance.gapScore)]
  });
  
  const performanceTopicIds = performanceData
    .map(p => p.topicId)
    .filter((id): id is string => id !== null);

  // Fetch comparison data if needed
  const comparisons = await fetchComparativeData(
    performanceTopicIds,
    input.customizationOptions
  );

  // Fetch related topics
  const relatedTopicsMap = await fetchRelatedTopics(
    performanceTopicIds
  );
  
  // Build topic comparisons with all analytics
  const topicComparisons = await buildTopicComparisons(
    performanceData,
    comparisons,
    relatedTopicsMap,
    input.customizationOptions
  );
  
  // Organize by subject and system
  const subjectAnalysis = organizeBySubjectAndSystem(topicComparisons);
  
  // Calculate comparative analytics
  const comparativeAnalytics = calculateComparativeAnalytics(
    topicComparisons,
    report
  );
  
  // Generate smart recommendations
  const smartRecommendations = generateSmartRecommendations(
    topicComparisons,
    subjectAnalysis,
    input.customizationOptions
  );
  
  // Generate group insights if applicable
  const groupInsights = input.isGroupAssessment ? 
    await generateGroupInsights(topicComparisons, input.reportId) : 
    undefined;
  
  // Calculate overview statistics
  const overview = calculateOverview(
    topicComparisons,
    subjectAnalysis,
    comparativeAnalytics
  );
  
  return {
    reportId: input.reportId,
    isGroup: input.isGroupAssessment,
    generatedAt: new Date(),
    overview,
    subjectAnalysis,
    comparativeAnalytics,
    smartRecommendations,
    groupInsights
  };
}

async function fetchComparativeData(
  topicIds: string[],
  options?: any
): Promise<Map<string, any>> {
  const comparisons = new Map();
  
  if (!options?.compareToNational && !options?.compareToCohort) {
    return comparisons;
  }
  
  // Fetch group analytics for each topic
  // NOTE: groupAnalytics has no table in the schema yet -- this branch is
  // unreachable today since nothing sets compareToNational/compareToCohort,
  // but the cast documents that gap rather than papering over a type error.
  const analytics = await (db.query as any).groupAnalytics.findMany({
    where: and(
      sql`topic_id = ANY(${topicIds})`,
      sql`group_type IN ('national', 'program', 'cohort')`
    )
  });
  
  // Organize by topic and group type
  for (const analytic of analytics) {
    if (!comparisons.has(analytic.topicId)) {
      comparisons.set(analytic.topicId, {});
    }
    comparisons.get(analytic.topicId)[analytic.groupType] = analytic;
  }
  
  return comparisons;
}

async function fetchRelatedTopics(
  topicIds: string[]
): Promise<Map<string, string[]>> {
  const relatedMap = new Map();
  
  // Fetch all relationships for these topics
  const relationships = await db.query.topicRelationships.findMany({
    where: sql`primary_topic_id = ANY(${topicIds}) OR related_topic_id = ANY(${topicIds})`
  });
  
  // Build the map
  for (const topicId of topicIds) {
    const related = relationships
      .filter(r => r.primaryTopicId === topicId || r.relatedTopicId === topicId)
      .map(r => r.primaryTopicId === topicId ? r.relatedTopicId : r.primaryTopicId)
      .filter(id => id !== topicId);
    
    relatedMap.set(topicId, [...new Set(related)]);
  }
  
  return relatedMap;
}

async function buildTopicComparisons(
  performanceData: any[],
  comparisons: Map<string, any>,
  relatedTopicsMap: Map<string, string[]>,
  options?: any
): Promise<TopicComparison[]> {
  
  const topicComparisons: TopicComparison[] = [];
  
  for (const perf of performanceData) {
    if (!perf.topic) continue;
    
    const comparison = comparisons.get(perf.topicId) || {};
    const relatedTopics = relatedTopicsMap.get(perf.topicId) || [];
    
    // Calculate adjusted study time based on related topics
    const baseTime = perf.recommendedStudyTime || 30;
    const adjustedTime = options?.includeRelatedTopics ?
      Math.ceil(baseTime * (1 + (relatedTopics.length * 0.2))) : // 20% more time per related topic
      baseTime;
    
    // Determine rationale for priority
    let rationale = "";
    if (perf.gapScore > 30) {
      rationale = "Critical knowledge gap requiring immediate attention";
    } else if (comparison.national && perf.score < comparison.national.meanScore) {
      rationale = "Performance below national average";
    } else if (relatedTopics.length > 3) {
      rationale = "Central topic with many related concepts";
    } else {
      rationale = "Standard review recommended";
    }
    
    topicComparisons.push({
      topic: perf.topic.name,
      subject: perf.topic.subject || "Fundamentals",
      system: perf.topic.system,
      individualScore: parseFloat(perf.score || "0"),
      gapScore: parseFloat(perf.gapScore || "0"),
      nationalMean: comparison.national?.meanScore || null,
      programMean: comparison.program?.meanScore || null,
      cohortMean: comparison.cohort?.meanScore || null,
      percentileBelowNational: comparison.national ? 
        calculatePercentileBelow(perf.score, comparison.national) : null,
      percentileBelowProgram: comparison.program ?
        calculatePercentileBelow(perf.score, comparison.program) : null,
      relatedTopics: relatedTopics.slice(0, 5), // Limit to top 5
      adjustedStudyTime: adjustedTime,
      priority: perf.priority || 3,
      rationale
    });
  }
  
  // Sort by priority and gap score
  return topicComparisons.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.gapScore - a.gapScore;
  });
}

function calculatePercentileBelow(
  score: string,
  groupStats: any
): number {
  if (!groupStats.percentileScores) return 50;
  
  const percentiles = groupStats.percentileScores;
  const scoreNum = parseFloat(score);
  
  if (scoreNum <= percentiles["25"]) return 25;
  if (scoreNum <= percentiles["50"]) return 50;
  if (scoreNum <= percentiles["75"]) return 75;
  if (scoreNum <= percentiles["90"]) return 90;
  return 95;
}

function organizeBySubjectAndSystem(
  topicComparisons: TopicComparison[]
) {
  const subjectMap = new Map<string, Map<string, TopicComparison[]>>();
  
  // Group topics by subject and system
  for (const topic of topicComparisons) {
    if (!subjectMap.has(topic.subject)) {
      subjectMap.set(topic.subject, new Map());
    }
    
    const systemMap = subjectMap.get(topic.subject)!;
    const system = topic.system || "Core Concepts";
    
    if (!systemMap.has(system)) {
      systemMap.set(system, []);
    }
    
    systemMap.get(system)!.push(topic);
  }
  
  // Convert to structured format
  const subjectAnalysis = [];
  for (const [subject, systemMap] of subjectMap) {
    const systemBreakdown = [];
    let totalScore = 0;
    let totalGap = 0;
    let totalTime = 0;
    let topicCount = 0;
    
    for (const [system, topics] of systemMap) {
      systemBreakdown.push({
        system,
        topics,
        groupStats: calculateGroupStats(topics)
      });
      
      topics.forEach(t => {
        totalScore += t.individualScore;
        totalGap += t.gapScore;
        totalTime += t.adjustedStudyTime;
        topicCount++;
      });
    }
    
    subjectAnalysis.push({
      subject,
      systemBreakdown,
      subjectMeanScore: topicCount > 0 ? totalScore / topicCount : 0,
      subjectGapScore: topicCount > 0 ? totalGap / topicCount : 0,
      recommendedFocusTime: totalTime
    });
  }
  
  // Sort subjects by gap score (highest gaps first)
  return subjectAnalysis.sort((a, b) => b.subjectGapScore - a.subjectGapScore);
}

function calculateGroupStats(topics: TopicComparison[]): GroupStatistics {
  const scores = topics.map(t => t.individualScore).sort((a, b) => a - b);
  const n = scores.length;
  
  if (n === 0) {
    return {
      sampleSize: 0,
      meanScore: 0,
      medianScore: 0,
      standardDeviation: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 }
    };
  }
  
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 ? 
    (scores[n/2 - 1] + scores[n/2]) / 2 : 
    scores[Math.floor(n/2)];
  
  const variance = scores.reduce((sum, score) => 
    sum + Math.pow(score - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  return {
    sampleSize: n,
    meanScore: mean,
    medianScore: median,
    standardDeviation: stdDev,
    percentiles: {
      p25: scores[Math.floor(n * 0.25)],
      p50: median,
      p75: scores[Math.floor(n * 0.75)],
      p90: scores[Math.floor(n * 0.90)]
    }
  };
}

function calculateComparativeAnalytics(
  topicComparisons: TopicComparison[],
  report: any
) {
  const belowNational = topicComparisons
    .filter(t => t.nationalMean && t.individualScore < t.nationalMean)
    .map(t => t.topic);
  
  const belowProgram = topicComparisons
    .filter(t => t.programMean && t.individualScore < t.programMean)
    .map(t => t.topic);
  
  const uniqueStrengths = topicComparisons
    .filter(t => t.nationalMean && t.individualScore > t.nationalMean + 10)
    .map(t => t.topic)
    .slice(0, 5);
  
  const commonWeaknesses = topicComparisons
    .filter(t => t.percentileBelowNational && t.percentileBelowNational <= 25)
    .map(t => t.topic)
    .slice(0, 5);
  
  return {
    performanceVsNational: report.nationalMean ? 
      parseFloat(report.overallScore) - parseFloat(report.nationalMean) : null,
    performanceVsProgram: report.programMean ?
      parseFloat(report.overallScore) - parseFloat(report.programMean) : null,
    performanceVsCohort: null, // Would need cohort data
    topicsBelowNational: belowNational,
    topicsBelowProgram: belowProgram,
    uniqueStrengths,
    commonWeaknesses
  };
}

function generateSmartRecommendations(
  topicComparisons: TopicComparison[],
  subjectAnalysis: any[],
  options?: any
) {
  // Identify immediate action items (high priority, high gap)
  const immediateActionItems = topicComparisons
    .filter(t => t.priority <= 2 && t.gapScore > 30)
    .slice(0, 5)
    .map(t => ({
      topic: t.topic,
      reason: t.rationale,
      estimatedImpact: t.gapScore > 50 ? "High" : "Medium",
      relatedTopics: t.relatedTopics
    }));
  
  // Generate study sequence based on subject priorities
  const maxHours = options?.maxStudyHours || 20;
  let remainingHours = maxHours;
  const studySequence = [];
  let week = 1;
  
  for (const subject of subjectAnalysis) {
    if (remainingHours <= 0) break;
    
    const hoursForSubject = Math.min(
      Math.ceil(subject.recommendedFocusTime / 60),
      remainingHours
    );
    
    // Get top topics for this subject
    const topTopics = subject.systemBreakdown
      .flatMap((s: any) => s.topics)
      .slice(0, 10)
      .map((t: any) => t.topic);
    
    studySequence.push({
      week,
      focus: subject.subject,
      topics: topTopics,
      hours: hoursForSubject,
      rationale: `Focus on ${subject.subject} due to average gap score of ${subject.subjectGapScore.toFixed(1)}%`
    });
    
    remainingHours -= hoursForSubject;
    week++;
  }
  
  // Calculate resource allocation
  const totalTime = subjectAnalysis.reduce((sum, s) => sum + s.recommendedFocusTime, 0);
  const resourceAllocation = subjectAnalysis.map(s => ({
    subject: s.subject,
    percentageOfTime: Math.round((s.recommendedFocusTime / totalTime) * 100),
    priority: s.subjectGapScore > 40 ? "Critical" : 
             s.subjectGapScore > 25 ? "High" : 
             s.subjectGapScore > 15 ? "Medium" : "Low"
  }));
  
  return {
    immediateActionItems,
    studySequence,
    resourceAllocation
  };
}

async function generateGroupInsights(
  topicComparisons: TopicComparison[],
  reportId: string
) {
  // Identify top and bottom performers
  const sortedByScore = [...topicComparisons].sort((a, b) => b.individualScore - a.individualScore);
  const topPerformers = sortedByScore.slice(0, 5).map(t => t.topic);
  const bottomPerformers = sortedByScore.slice(-5).map(t => t.topic);
  
  // Calculate variability
  const highVariabilityTopics = topicComparisons
    .filter(t => t.nationalMean && Math.abs(t.individualScore - t.nationalMean) > 15)
    .map(t => t.topic);
  
  const consistentTopics = topicComparisons
    .filter(t => t.nationalMean && Math.abs(t.individualScore - t.nationalMean) < 5)
    .map(t => t.topic);
  
  // Generate recommendations
  const recommendations = [];
  
  if (bottomPerformers.length > 0) {
    recommendations.push(
      `Focus group study sessions on: ${bottomPerformers.slice(0, 3).join(", ")}`
    );
  }
  
  if (highVariabilityTopics.length > 3) {
    recommendations.push(
      "High variability in performance suggests need for differentiated instruction"
    );
  }
  
  if (topPerformers.length > 0) {
    recommendations.push(
      `Leverage peer tutoring for strong areas: ${topPerformers.slice(0, 3).join(", ")}`
    );
  }
  
  return {
    topPerformers,
    bottomPerformers,
    variability: {
      highVariabilityTopics,
      consistentTopics
    },
    recommendations
  };
}

function calculateOverview(
  topicComparisons: TopicComparison[],
  subjectAnalysis: any[],
  comparativeAnalytics: any
) {
  const highPriorityCount = topicComparisons.filter(t => t.priority <= 2).length;
  const totalTime = topicComparisons.reduce((sum, t) => sum + t.adjustedStudyTime, 0);
  
  // Determine performance level
  let performanceLevel = "Average";
  if (comparativeAnalytics.performanceVsNational) {
    if (comparativeAnalytics.performanceVsNational > 10) {
      performanceLevel = "Above Average";
    } else if (comparativeAnalytics.performanceVsNational < -10) {
      performanceLevel = "Below Average";
    }
  }
  
  // Identify key strengths (topics with scores > 85)
  const keyStrengths = topicComparisons
    .filter(t => t.individualScore > 85)
    .map(t => t.topic)
    .slice(0, 5);
  
  // Identify critical gaps (topics with gap > 40)
  const criticalGaps = topicComparisons
    .filter(t => t.gapScore > 40)
    .map(t => t.topic)
    .slice(0, 5);
  
  return {
    totalTopics: topicComparisons.length,
    highPriorityTopics: highPriorityCount,
    estimatedTotalTime: Math.ceil(totalTime / (1 + (topicComparisons.length * 0.1))), // Base time
    adjustedTotalTime: totalTime, // With related topics
    performanceLevel,
    keyStrengths,
    criticalGaps
  };
}