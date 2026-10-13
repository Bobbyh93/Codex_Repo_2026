import { db } from "./db";
import {
  learningObjectives,
  nclexTopicCrosswalk,
  topicObjectivesCrosswalk,
  performancePathCrosswalk,
  studyPathTemplates
} from "@shared/crosswalk-schema";
import { assessmentReports, topicPerformance, nursingTopics, contentAreas } from "@shared/schema";
import { eq, desc, asc, avg, count, and, or, sql } from "drizzle-orm";

// Enhanced recommendation parameters for production
export interface RecommendationParameters {
  gapThreshold: number; // Score below which a topic is considered a gap (default: 75)
  priorityWeights: {
    gapScore: number;      // Weight for gap score (default: 0.4)
    frequency: number;     // Weight for topic frequency (default: 0.3)
    difficulty: number;    // Weight for topic difficulty (default: 0.2)
    timeToMastery: number; // Weight for estimated time (default: 0.1)
  };
  studyTimeMultipliers: {
    critical: number;   // Time multiplier for critical gaps (default: 1.5)
    high: number;       // Time multiplier for high priority (default: 1.2)
    medium: number;     // Time multiplier for medium priority (default: 1.0)
    low: number;        // Time multiplier for low priority (default: 0.8)
  };
  adaptiveLearning: {
    masteryThreshold: number;     // Score above which topic is mastered (default: 85)
    strugglingThreshold: number;  // Score below which needs intensive help (default: 60)
    retentionFactor: number;      // How much to weight previous assessments (default: 0.7)
  };
  pathCustomization: {
    maxStudyHours: number;        // Maximum hours for a study path (default: 120)
    minModulesPerPath: number;    // Minimum modules in a path (default: 3)
    maxModulesPerPath: number;    // Maximum modules in a path (default: 12)
    balanceFactors: {
      theory: number;             // Weight for theoretical content (default: 0.4)
      application: number;        // Weight for application content (default: 0.4)
      evaluation: number;         // Weight for evaluation content (default: 0.2)
    };
  };
}

// Default production parameters
export const DEFAULT_RECOMMENDATION_PARAMS: RecommendationParameters = {
  gapThreshold: 75,
  priorityWeights: {
    gapScore: 0.4,
    frequency: 0.3,
    difficulty: 0.2,
    timeToMastery: 0.1
  },
  studyTimeMultipliers: {
    critical: 1.5,
    high: 1.2,
    medium: 1.0,
    low: 0.8
  },
  adaptiveLearning: {
    masteryThreshold: 85,
    strugglingThreshold: 60,
    retentionFactor: 0.7
  },
  pathCustomization: {
    maxStudyHours: 120,
    minModulesPerPath: 3,
    maxModulesPerPath: 12,
    balanceFactors: {
      theory: 0.4,
      application: 0.4,
      evaluation: 0.2
    }
  }
};

export interface EnhancedGapAnalysis {
  topicId: string;
  topicName: string;
  nclexCategory: string;
  currentScore: number;
  nationalAverage: number;
  gapScore: number;
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  priorityScore: number;
  estimatedStudyTime: number;
  difficultyLevel: 'basic' | 'intermediate' | 'advanced';
  bloomsLevels: string[];
  masteryPrediction: {
    estimatedTimeToMastery: number;
    confidenceLevel: number;
    successProbability: number;
  };
  adaptiveFactors: {
    learningStyle: string;
    priorKnowledge: number;
    retentionRate: number;
  };
  recommendedResources: Array<{
    type: 'video' | 'textbook' | 'simulation' | 'practice' | 'case_study';
    priority: number;
    estimatedTime: number;
    difficulty: string;
  }>;
}

export interface PersonalizedRecommendation {
  studentId: string;
  assessmentId: string;
  generatedAt: Date;
  overallAssessment: {
    currentLevel: 'struggling' | 'developing' | 'proficient' | 'advanced';
    readinessScore: number;
    estimatedPassProbability: number;
  };
  prioritizedGaps: EnhancedGapAnalysis[];
  recommendedPath: {
    pathType: 'remedial' | 'standard' | 'accelerated' | 'mastery';
    totalHours: number;
    estimatedCompletion: Date;
    modules: Array<{
      moduleId: string;
      name: string;
      topics: string[];
      estimatedTime: number;
      prerequisites: string[];
      learningObjectives: string[];
      assessmentCriteria: string[];
    }>;
  };
  adaptiveSettings: {
    pacing: 'slow' | 'normal' | 'fast';
    contentTypes: string[];
    difficultyProgression: 'gradual' | 'standard' | 'accelerated';
  };
  nextSteps: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export class EnhancedRecommendationEngine {
  private parameters: RecommendationParameters;

  constructor(customParams?: Partial<RecommendationParameters>) {
    this.parameters = { ...DEFAULT_RECOMMENDATION_PARAMS, ...customParams };
  }

  /**
   * Generate comprehensive personalized recommendations
   */
  async generatePersonalizedRecommendations(
    reportId: string,
    customParams?: Partial<RecommendationParameters>
  ): Promise<PersonalizedRecommendation> {
    // Merge custom parameters if provided
    const params = customParams ? { ...this.parameters, ...customParams } : this.parameters;

    // Get assessment and performance data
    const report = await this.getAssessmentData(reportId);
    const performanceData = await this.getPerformanceData(reportId);
    const nationalAverages = await this.getNationalAverages();

    // Calculate enhanced gap analysis
    const gapAnalysis = await this.calculateEnhancedGaps(
      performanceData,
      nationalAverages,
      params
    );

    // Assess overall student level
    const overallAssessment = this.assessOverallLevel(gapAnalysis, params);

    // Generate personalized study path
    const recommendedPath = await this.generatePersonalizedPath(
      gapAnalysis,
      overallAssessment,
      params
    );

    // Determine adaptive settings
    const adaptiveSettings = this.determineAdaptiveSettings(overallAssessment, gapAnalysis);

    // Generate next steps
    const nextSteps = this.generateNextSteps(gapAnalysis, overallAssessment);

    return {
      studentId: report.userId || '',
      assessmentId: reportId,
      generatedAt: new Date(),
      overallAssessment,
      prioritizedGaps: gapAnalysis,
      recommendedPath,
      adaptiveSettings,
      nextSteps
    };
  }

  /**
   * Calculate enhanced gap analysis with machine learning factors
   */
  private async calculateEnhancedGaps(
    performanceData: any[],
    nationalAverages: Map<string, number>,
    params: RecommendationParameters
  ): Promise<EnhancedGapAnalysis[]> {
    const gaps: EnhancedGapAnalysis[] = [];

    for (const perf of performanceData) {
      const nationalAvg = nationalAverages.get(perf.topicId) || 75;
      const currentScore = parseFloat(perf.score || '0');
      
      // Skip if already mastered
      if (currentScore >= params.adaptiveLearning.masteryThreshold) continue;

      const rawGapScore = Math.max(0, nationalAvg - currentScore);
      
      // Apply frequency weighting
      const frequencyWeight = 1 + (perf.frequency || 1) * 0.1;
      const weightedGapScore = rawGapScore * frequencyWeight;

      // Get topic difficulty and Bloom's levels
      const topicData = await this.getTopicData(perf.topicId);
      const difficultyLevel = this.mapDifficultyLevel(topicData.difficulty);
      const bloomsLevels = await this.getBloomsLevels(perf.topicId);

      // Calculate priority score
      const priorityScore = this.calculatePriorityScore(
        weightedGapScore,
        perf.frequency || 1,
        this.mapDifficultyToNumber(difficultyLevel),
        perf.recommendedStudyTime || 30,
        params.priorityWeights
      );

      // Determine priority level
      const priorityLevel = this.mapPriorityLevel(priorityScore);

      // Calculate mastery prediction
      const masteryPrediction = this.predictMastery(
        currentScore,
        rawGapScore,
        difficultyLevel,
        perf.frequency || 1
      );

      // Determine adaptive factors
      const adaptiveFactors = this.calculateAdaptiveFactors(
        currentScore,
        nationalAvg,
        difficultyLevel
      );

      // Get recommended resources
      const recommendedResources = await this.getRecommendedResources(
        perf.topicId,
        priorityLevel,
        difficultyLevel
      );

      // Calculate estimated study time with multipliers
      const baseStudyTime = perf.recommendedStudyTime || 30;
      const timeMultiplier = params.studyTimeMultipliers[priorityLevel];
      const estimatedStudyTime = Math.round(baseStudyTime * timeMultiplier);

      gaps.push({
        topicId: perf.topicId,
        topicName: perf.topic?.name || 'Unknown Topic',
        nclexCategory: topicData.nclexCategory || 'General',
        currentScore,
        nationalAverage: nationalAvg,
        gapScore: weightedGapScore,
        priorityLevel,
        priorityScore,
        estimatedStudyTime,
        difficultyLevel,
        bloomsLevels,
        masteryPrediction,
        adaptiveFactors,
        recommendedResources
      });
    }

    // Sort by priority score (highest first)
    return gaps.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Calculate advanced priority score using machine learning factors
   */
  private calculatePriorityScore(
    gapScore: number,
    frequency: number,
    difficulty: number,
    timeToMastery: number,
    weights: RecommendationParameters['priorityWeights']
  ): number {
    // Normalize inputs
    const normalizedGap = Math.min(100, gapScore * 2); // Scale gap score
    const normalizedFrequency = Math.min(100, frequency * 10); // Scale frequency
    const normalizedDifficulty = difficulty * 20; // Scale difficulty (1-5 → 20-100)
    const urgency = Math.max(1, 100 - (timeToMastery / 180) * 100); // Inverse time urgency

    // Calculate weighted score
    const score = (
      normalizedGap * weights.gapScore +
      normalizedFrequency * weights.frequency +
      normalizedDifficulty * weights.difficulty +
      urgency * weights.timeToMastery
    );

    return Math.round(score);
  }

  /**
   * Assess overall student performance level
   */
  private assessOverallLevel(
    gaps: EnhancedGapAnalysis[],
    params: RecommendationParameters
  ): PersonalizedRecommendation['overallAssessment'] {
    if (gaps.length === 0) {
      return {
        currentLevel: 'advanced',
        readinessScore: 95,
        estimatedPassProbability: 0.95
      };
    }

    const averageScore = gaps.reduce((sum, gap) => sum + gap.currentScore, 0) / gaps.length;
    const criticalGaps = gaps.filter(g => g.priorityLevel === 'critical').length;
    const highGaps = gaps.filter(g => g.priorityLevel === 'high').length;

    let currentLevel: 'struggling' | 'developing' | 'proficient' | 'advanced';
    let readinessScore: number;
    let estimatedPassProbability: number;

    if (averageScore < params.adaptiveLearning.strugglingThreshold || criticalGaps > 5) {
      currentLevel = 'struggling';
      readinessScore = averageScore * 0.8;
      estimatedPassProbability = 0.3 + (averageScore / 100) * 0.4;
    } else if (averageScore < 75 || highGaps > 3) {
      currentLevel = 'developing';
      readinessScore = averageScore * 0.9;
      estimatedPassProbability = 0.5 + (averageScore / 100) * 0.3;
    } else if (averageScore < params.adaptiveLearning.masteryThreshold) {
      currentLevel = 'proficient';
      readinessScore = averageScore * 0.95;
      estimatedPassProbability = 0.7 + (averageScore / 100) * 0.2;
    } else {
      currentLevel = 'advanced';
      readinessScore = averageScore;
      estimatedPassProbability = 0.85 + (averageScore / 100) * 0.15;
    }

    return {
      currentLevel,
      readinessScore: Math.round(readinessScore),
      estimatedPassProbability: Math.min(0.98, estimatedPassProbability)
    };
  }

  /**
   * Generate personalized study path based on gaps and level
   */
  private async generatePersonalizedPath(
    gaps: EnhancedGapAnalysis[],
    overallAssessment: PersonalizedRecommendation['overallAssessment'],
    params: RecommendationParameters
  ): Promise<PersonalizedRecommendation['recommendedPath']> {
    // Select appropriate path type
    const pathType = this.selectPathType(overallAssessment.currentLevel);
    
    // Get relevant path template
    const template = await this.getPathTemplate(pathType);
    
    // Prioritize gaps for inclusion
    const prioritizedGaps = gaps
      .filter(gap => gap.priorityLevel !== 'low')
      .slice(0, params.pathCustomization.maxModulesPerPath);

    // Calculate total study time
    const totalHours = Math.min(
      params.pathCustomization.maxStudyHours,
      prioritizedGaps.reduce((sum, gap) => sum + (gap.estimatedStudyTime / 60), 0)
    );

    // Generate modules
    const modules = await this.generateModules(prioritizedGaps, params);

    // Calculate estimated completion
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + Math.ceil(totalHours / 2)); // Assume 2 hours/day

    return {
      pathType,
      totalHours: Math.round(totalHours),
      estimatedCompletion,
      modules
    };
  }

  /**
   * Determine adaptive settings based on student performance
   */
  private determineAdaptiveSettings(
    overallAssessment: PersonalizedRecommendation['overallAssessment'],
    gaps: EnhancedGapAnalysis[]
  ): PersonalizedRecommendation['adaptiveSettings'] {
    const { currentLevel, readinessScore } = overallAssessment;
    
    // Determine pacing
    let pacing: 'slow' | 'normal' | 'fast';
    if (currentLevel === 'struggling' || readinessScore < 60) {
      pacing = 'slow';
    } else if (currentLevel === 'advanced' || readinessScore > 85) {
      pacing = 'fast';
    } else {
      pacing = 'normal';
    }

    // Determine content types based on gaps
    const contentTypes: string[] = [];
    if (gaps.some(g => g.bloomsLevels.includes('Remember') || g.bloomsLevels.includes('Understand'))) {
      contentTypes.push('foundational_content', 'video_lectures');
    }
    if (gaps.some(g => g.bloomsLevels.includes('Apply'))) {
      contentTypes.push('practice_questions', 'case_studies');
    }
    if (gaps.some(g => g.bloomsLevels.includes('Analyze') || g.bloomsLevels.includes('Evaluate'))) {
      contentTypes.push('simulations', 'critical_thinking_exercises');
    }

    // Determine difficulty progression
    let difficultyProgression: 'gradual' | 'standard' | 'accelerated';
    if (currentLevel === 'struggling') {
      difficultyProgression = 'gradual';
    } else if (currentLevel === 'advanced') {
      difficultyProgression = 'accelerated';
    } else {
      difficultyProgression = 'standard';
    }

    return {
      pacing,
      contentTypes,
      difficultyProgression
    };
  }

  /**
   * Generate actionable next steps
   */
  private generateNextSteps(
    gaps: EnhancedGapAnalysis[],
    overallAssessment: PersonalizedRecommendation['overallAssessment']
  ): PersonalizedRecommendation['nextSteps'] {
    const criticalGaps = gaps.filter(g => g.priorityLevel === 'critical');
    const highGaps = gaps.filter(g => g.priorityLevel === 'high');

    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions (today/tomorrow)
    if (criticalGaps.length > 0) {
      immediate.push(`Focus on critical gap: ${criticalGaps[0].topicName}`);
      immediate.push(`Complete ${criticalGaps[0].recommendedResources[0]?.type || 'video'} review`);
      immediate.push('Take targeted practice questions on weak areas');
    } else if (highGaps.length > 0) {
      immediate.push(`Begin studying: ${highGaps[0].topicName}`);
      immediate.push('Review fundamental concepts');
    } else {
      immediate.push('Continue current study schedule');
      immediate.push('Focus on maintaining strengths');
    }

    // Short-term actions (this week)
    if (overallAssessment.currentLevel === 'struggling') {
      shortTerm.push('Complete intensive remedial modules');
      shortTerm.push('Schedule additional study time');
      shortTerm.push('Consider tutoring or study group');
    } else {
      shortTerm.push('Work through personalized study modules');
      shortTerm.push('Complete practice assessments');
      shortTerm.push('Track progress on gap areas');
    }

    // Long-term actions (next 2-4 weeks)
    longTerm.push('Complete full study path');
    longTerm.push('Take comprehensive practice exam');
    longTerm.push('Review and adjust study plan based on progress');
    
    if (overallAssessment.estimatedPassProbability < 0.7) {
      longTerm.push('Consider scheduling exam after additional preparation');
    } else {
      longTerm.push('Schedule NCLEX-RN examination');
    }

    return { immediate, shortTerm, longTerm };
  }

  // Helper methods
  private async getAssessmentData(reportId: string) {
    const [report] = await db
      .select()
      .from(assessmentReports)
      .where(eq(assessmentReports.id, reportId));
    return report;
  }

  private async getPerformanceData(reportId: string) {
    return await db
      .select()
      .from(topicPerformance)
      .where(eq(topicPerformance.reportId, reportId));
  }

  private async getNationalAverages(): Promise<Map<string, number>> {
    // In production, this would come from aggregated data
    // For now, return realistic national averages
    const averages = new Map<string, number>();
    
    // Sample averages for common nursing topics
    averages.set('medication-admin', 78);
    averages.set('infection-control', 82);
    averages.set('patient-safety', 80);
    averages.set('assessment-skills', 76);
    averages.set('cardiac-care', 74);
    averages.set('respiratory-care', 77);
    
    return averages;
  }

  private async getTopicData(topicId: string): Promise<{ difficulty?: string; nclexCategory?: string }> {
    // nursingTopics has no difficulty/nclexCategory columns; callers fall
    // back to these defaults when a topic isn't found or lacks them.
    const [topic] = await db
      .select()
      .from(nursingTopics)
      .where(eq(nursingTopics.id, topicId));

    return topic
      ? { difficulty: undefined, nclexCategory: undefined }
      : { difficulty: 'intermediate', nclexCategory: 'General' };
  }

  private async getBloomsLevels(topicId: string): Promise<string[]> {
    const objectives = await db
      .select()
      .from(topicObjectivesCrosswalk)
      .where(eq(topicObjectivesCrosswalk.topicId, topicId));
    
    return [...new Set(objectives.map(obj => obj.bloomsLevel).filter((level): level is string => Boolean(level)))];
  }

  private mapDifficultyLevel(difficulty: any): 'basic' | 'intermediate' | 'advanced' {
    if (typeof difficulty === 'string') {
      const lower = difficulty.toLowerCase();
      if (lower.includes('basic') || lower.includes('easy')) return 'basic';
      if (lower.includes('advanced') || lower.includes('hard')) return 'advanced';
    }
    return 'intermediate';
  }

  private mapDifficultyToNumber(difficulty: 'basic' | 'intermediate' | 'advanced'): number {
    switch (difficulty) {
      case 'basic': return 1;
      case 'intermediate': return 3;
      case 'advanced': return 5;
      default: return 3;
    }
  }

  private mapPriorityLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private predictMastery(
    currentScore: number,
    gapScore: number,
    difficulty: 'basic' | 'intermediate' | 'advanced',
    frequency: number
  ) {
    // Simple mastery prediction model
    const difficultyFactor = difficulty === 'basic' ? 1 : difficulty === 'intermediate' ? 1.2 : 1.5;
    const frequencyFactor = Math.min(2, 1 + frequency * 0.1);
    
    const estimatedTimeToMastery = Math.round(gapScore * difficultyFactor * frequencyFactor * 2);
    const confidenceLevel = Math.max(0.5, 1 - (gapScore / 100));
    const successProbability = Math.max(0.3, (currentScore / 100) * 0.8 + 0.2);

    return {
      estimatedTimeToMastery,
      confidenceLevel,
      successProbability
    };
  }

  private calculateAdaptiveFactors(
    currentScore: number,
    nationalAverage: number,
    difficulty: 'basic' | 'intermediate' | 'advanced'
  ) {
    // Simplified adaptive factors
    const learningStyle = currentScore > nationalAverage ? 'visual' : 'kinesthetic';
    const priorKnowledge = Math.round(currentScore * 0.8);
    const retentionRate = Math.max(0.6, currentScore / 100);

    return {
      learningStyle,
      priorKnowledge,
      retentionRate
    };
  }

  private async getRecommendedResources(
    topicId: string,
    priority: 'critical' | 'high' | 'medium' | 'low',
    difficulty: 'basic' | 'intermediate' | 'advanced'
  ) {
    // In production, this would query the resource crosswalk
    const resources = [];
    
    if (priority === 'critical' || difficulty === 'basic') {
      resources.push({ type: 'video' as const, priority: 1, estimatedTime: 30, difficulty: 'basic' });
      resources.push({ type: 'textbook' as const, priority: 2, estimatedTime: 45, difficulty: 'basic' });
    }
    
    if (priority === 'high' || difficulty === 'intermediate') {
      resources.push({ type: 'practice' as const, priority: 1, estimatedTime: 20, difficulty: 'intermediate' });
      resources.push({ type: 'case_study' as const, priority: 2, estimatedTime: 40, difficulty: 'intermediate' });
    }
    
    if (difficulty === 'advanced') {
      resources.push({ type: 'simulation' as const, priority: 1, estimatedTime: 60, difficulty: 'advanced' });
    }

    return resources;
  }

  private selectPathType(currentLevel: string): 'remedial' | 'standard' | 'accelerated' | 'mastery' {
    switch (currentLevel) {
      case 'struggling': return 'remedial';
      case 'developing': return 'standard';
      case 'proficient': return 'accelerated';
      case 'advanced': return 'mastery';
      default: return 'standard';
    }
  }

  private async getPathTemplate(pathType: string) {
    const [template] = await db
      .select()
      .from(studyPathTemplates)
      .where(eq(studyPathTemplates.pathType, pathType))
      .limit(1);
    
    return template;
  }

  private async generateModules(
    gaps: EnhancedGapAnalysis[],
    params: RecommendationParameters
  ) {
    const modules = [];
    
    for (let i = 0; i < Math.min(gaps.length, params.pathCustomization.maxModulesPerPath); i++) {
      const gap = gaps[i];
      
      modules.push({
        moduleId: `module-${gap.topicId}`,
        name: `Master ${gap.topicName}`,
        topics: [gap.topicName],
        estimatedTime: gap.estimatedStudyTime,
        prerequisites: i > 0 ? [`module-${gaps[i-1].topicId}`] : [],
        learningObjectives: gap.bloomsLevels,
        assessmentCriteria: [`Score ≥${params.adaptiveLearning.masteryThreshold}% on ${gap.topicName}`]
      });
    }
    
    return modules;
  }
}

// Export default instance
export const recommendationEngine = new EnhancedRecommendationEngine();