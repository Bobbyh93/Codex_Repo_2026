import { db } from "./db";
import {
  nclexTopicCrosswalk,
  topicObjectivesCrosswalk,
  objectiveResourcesCrosswalk,
  performancePathCrosswalk,
  studyPathTemplates,
  contentCoverageMatrix,
  learningObjectives,
  type NclexTopicCrosswalk,
  type TopicObjectivesCrosswalk,
  type ObjectiveResourcesCrosswalk,
  type StudyPathTemplate,
  type PerformancePathCrosswalk
} from "@shared/crosswalk-schema";
import {
  topicPerformance,
  assessmentReports,
  studyPlans,
  studyPlanItems,
  nursingTopics,
  type TopicPerformance
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";

interface StudentPerformanceData {
  reportId: string;
  userId?: string;
  overallScore: number;
  topicScores: Array<{
    topicId: string;
    topicName: string;
    score: number;
    gapScore: number;
  }>;
}

interface GeneratedStudyPath {
  pathName: string;
  pathType: string;
  totalHours: number;
  modules: Array<{
    moduleId: string;
    moduleName: string;
    topics: string[];
    objectives: Array<{
      id: string;
      text: string;
      bloomsLevel: string;
    }>;
    resources: Array<{
      id: string;
      title: string;
      type: string;
      url?: string;
      duration?: number;
    }>;
    estimatedTime: number;
    priority: number;
  }>;
  personalizedRecommendations: string[];
  expectedOutcome: {
    targetScore: number;
    estimatedImprovement: number;
    timeToCompletion: number;
  };
}

export class ContentGenerationEngine {
  /**
   * Generate a personalized study path based on student performance and crosswalk mappings
   */
  async generatePersonalizedStudyPath(
    reportId: string,
    options: {
      maxHours?: number;
      focusAreas?: string[];
      pathType?: 'remedial' | 'standard' | 'accelerated' | 'mastery';
    } = {}
  ): Promise<GeneratedStudyPath> {
    // 1. Fetch student performance data
    const performanceData = await this.getStudentPerformance(reportId);
    
    // 2. Determine appropriate path type based on performance
    const pathType = options.pathType || await this.determinePathType(performanceData.overallScore);
    
    // 3. Get matching path template from crosswalk
    const pathTemplate = await this.getPathTemplate(performanceData.overallScore, pathType);
    
    // 4. Identify learning gaps using NCLEX crosswalk
    const learningGaps = await this.identifyLearningGaps(performanceData.topicScores);
    
    // 5. Map gaps to learning objectives
    const targetObjectives = await this.mapGapsToObjectives(learningGaps);
    
    // 6. Find resources for objectives
    const resources = await this.findResourcesForObjectives(targetObjectives);
    
    // 7. Build personalized modules
    const modules = await this.buildPersonalizedModules(
      learningGaps,
      targetObjectives,
      resources,
      options.maxHours || 40,
      options.focusAreas || []
    );
    
    // 8. Generate recommendations
    const recommendations = this.generateRecommendations(performanceData, modules);
    
    // 9. Calculate expected outcomes
    const expectedOutcome = this.calculateExpectedOutcome(
      performanceData.overallScore,
      pathTemplate,
      modules
    );
    
    return {
      pathName: pathTemplate?.name || `Personalized ${pathType} Study Path`,
      pathType,
      totalHours: modules.reduce((sum, m) => sum + m.estimatedTime, 0) / 60,
      modules,
      personalizedRecommendations: recommendations,
      expectedOutcome
    };
  }

  /**
   * Get student performance data from assessment report
   */
  private async getStudentPerformance(reportId: string): Promise<StudentPerformanceData> {
    // Get assessment report
    const [report] = await db
      .select()
      .from(assessmentReports)
      .where(eq(assessmentReports.id, reportId))
      .limit(1);
    
    if (!report) {
      throw new Error('Assessment report not found');
    }
    
    // Get topic performance scores
    const topicScores = await db
      .select({
        topicId: topicPerformance.topicId,
        topicName: nursingTopics.name,
        score: topicPerformance.score,
        gapScore: sql<number>`100 - ${topicPerformance.score}`
      })
      .from(topicPerformance)
      .leftJoin(nursingTopics, eq(topicPerformance.topicId, nursingTopics.id))
      .where(eq(topicPerformance.reportId, reportId))
      .orderBy(desc(sql`100 - ${topicPerformance.score}`));

    return {
      reportId,
      userId: report.userId || undefined,
      overallScore: parseFloat(report.overallScore || '75'),
      topicScores: topicScores
        .filter((t): t is typeof t & { topicId: string } => t.topicId !== null)
        .map(t => ({
          topicId: t.topicId,
          topicName: t.topicName || 'Unknown Topic',
          score: parseFloat(t.score || '0'),
          gapScore: parseFloat(t.gapScore?.toString() || '0')
        }))
    };
  }

  /**
   * Determine appropriate path type based on performance
   */
  private async determinePathType(
    overallScore: number
  ): Promise<'remedial' | 'standard' | 'accelerated' | 'mastery'> {
    if (overallScore < 60) return 'remedial';
    if (overallScore < 75) return 'standard';
    if (overallScore < 90) return 'accelerated';
    return 'mastery';
  }

  /**
   * Get path template from performance-path crosswalk
   */
  private async getPathTemplate(
    score: number,
    pathType: string
  ): Promise<StudyPathTemplate | null> {
    // Find matching performance-path crosswalk
    const [crosswalk] = await db
      .select()
      .from(performancePathCrosswalk)
      .where(and(
        eq(performancePathCrosswalk.pathType, pathType),
        lte(sql`CAST(${performancePathCrosswalk.scoreRange}->>'min' AS FLOAT)`, score),
        gte(sql`CAST(${performancePathCrosswalk.scoreRange}->>'max' AS FLOAT)`, score)
      ))
      .limit(1);
    
    if (!crosswalk) return null;
    
    // Get the associated path template
    const [template] = await db
      .select()
      .from(studyPathTemplates)
      .where(eq(studyPathTemplates.id, crosswalk.pathTemplateId))
      .limit(1);
    
    return template || null;
  }

  /**
   * Identify learning gaps using NCLEX topic crosswalk
   */
  private async identifyLearningGaps(
    topicScores: Array<{ topicId: string; topicName: string; score: number; gapScore: number }>
  ): Promise<Array<{
    topicId: string;
    topicName: string;
    nclexCategory?: string;
    gapScore: number;
    priority: number;
  }>> {
    // Get top gaps (scores below 75%)
    const gaps = topicScores
      .filter(t => t.score < 75)
      .slice(0, 10); // Focus on top 10 gaps
    
    // Enhance with NCLEX crosswalk data
    const enhancedGaps = await Promise.all(
      gaps.map(async (gap, index) => {
        const [crosswalk] = await db
          .select()
          .from(nclexTopicCrosswalk)
          .where(eq(nclexTopicCrosswalk.topicId, gap.topicId))
          .limit(1);
        
        return {
          topicId: gap.topicId,
          topicName: gap.topicName,
          nclexCategory: crosswalk?.nclexCategory,
          gapScore: gap.gapScore,
          priority: index + 1 // Priority based on gap severity
        };
      })
    );
    
    return enhancedGaps;
  }

  /**
   * Map learning gaps to specific objectives using crosswalk
   */
  private async mapGapsToObjectives(
    gaps: Array<{ topicId: string; topicName: string; priority: number }>
  ): Promise<Array<{
    objectiveId: string;
    objectiveText: string;
    bloomsLevel: string;
    topicId: string;
    isCore: boolean;
  }>> {
    const objectives: Array<{
      objectiveId: string;
      objectiveText: string;
      bloomsLevel: string;
      topicId: string;
      isCore: boolean;
    }> = [];
    
    for (const gap of gaps) {
      // Get objectives for this topic from crosswalk
      const topicObjectives = await db
        .select()
        .from(topicObjectivesCrosswalk)
        .where(eq(topicObjectivesCrosswalk.topicId, gap.topicId))
        .orderBy(
          desc(topicObjectivesCrosswalk.isCore),
          asc(topicObjectivesCrosswalk.orderIndex)
        )
        .limit(5); // Max 5 objectives per topic
      
      objectives.push(...topicObjectives.map(obj => ({
        objectiveId: obj.objectiveId,
        objectiveText: obj.objectiveText,
        bloomsLevel: obj.bloomsLevel || 'Apply',
        topicId: obj.topicId,
        isCore: obj.isCore || false
      })));
    }
    
    return objectives;
  }

  /**
   * Find resources for learning objectives using crosswalk
   */
  private async findResourcesForObjectives(
    objectives: Array<{ objectiveId: string; objectiveText: string }>
  ): Promise<Map<string, Array<{
    resourceId: string;
    resourceTitle: string;
    resourceType: string;
    url?: string;
    relevanceScore: number;
  }>>> {
    const resourceMap = new Map();
    
    for (const objective of objectives) {
      // Get resources from objective-resources crosswalk
      const resources = await db
        .select()
        .from(objectiveResourcesCrosswalk)
        .where(eq(objectiveResourcesCrosswalk.objectiveId, objective.objectiveId))
        .orderBy(desc(objectiveResourcesCrosswalk.relevanceScore))
        .limit(3); // Top 3 resources per objective
      
      resourceMap.set(objective.objectiveId, resources.map(r => ({
        resourceId: r.resourceId,
        resourceTitle: r.resourceTitle,
        resourceType: r.resourceType,
        url: undefined, // Would need to join with actual resource table
        relevanceScore: r.relevanceScore || 1.0
      })));
    }
    
    return resourceMap;
  }

  /**
   * Build personalized study modules
   */
  private async buildPersonalizedModules(
    gaps: Array<{ topicId: string; topicName: string; priority: number }>,
    objectives: Array<{ objectiveId: string; objectiveText: string; bloomsLevel: string; topicId: string }>,
    resourceMap: Map<string, any[]>,
    maxHours: number,
    focusAreas: string[]
  ): Promise<Array<{
    moduleId: string;
    moduleName: string;
    topics: string[];
    objectives: Array<{ id: string; text: string; bloomsLevel: string }>;
    resources: Array<{ id: string; title: string; type: string; url?: string; duration?: number }>;
    estimatedTime: number;
    priority: number;
  }>> {
    const modules = [];
    let totalTime = 0;
    
    // Group objectives by topic
    const topicObjectives = new Map<string, typeof objectives>();
    objectives.forEach(obj => {
      if (!topicObjectives.has(obj.topicId)) {
        topicObjectives.set(obj.topicId, []);
      }
      topicObjectives.get(obj.topicId)?.push(obj);
    });
    
    // Create modules for each gap topic
    for (const gap of gaps) {
      if (totalTime >= maxHours * 60) break; // Stop if we've reached max hours
      
      const topicObjs = topicObjectives.get(gap.topicId) || [];
      const moduleResources: any[] = [];
      
      // Collect resources for all objectives in this topic
      topicObjs.forEach(obj => {
        const objResources = resourceMap.get(obj.objectiveId) || [];
        moduleResources.push(...objResources);
      });
      
      // Estimate time based on number of objectives and resources
      const estimatedTime = Math.min(
        120, // Max 2 hours per module
        topicObjs.length * 20 + moduleResources.length * 15
      );
      
      if (totalTime + estimatedTime > maxHours * 60) continue;
      
      modules.push({
        moduleId: `module-${gap.topicId}`,
        moduleName: `Master ${gap.topicName}`,
        topics: [gap.topicName],
        objectives: topicObjs.map(obj => ({
          id: obj.objectiveId,
          text: obj.objectiveText,
          bloomsLevel: obj.bloomsLevel
        })),
        resources: moduleResources.slice(0, 5).map(r => ({
          id: r.resourceId,
          title: r.resourceTitle,
          type: r.resourceType,
          url: r.url,
          duration: r.resourceType === 'video' ? 30 : 15
        })),
        estimatedTime,
        priority: gap.priority
      });
      
      totalTime += estimatedTime;
    }
    
    return modules;
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    performance: StudentPerformanceData,
    modules: any[]
  ): string[] {
    const recommendations = [];
    
    // Performance-based recommendations
    if (performance.overallScore < 60) {
      recommendations.push(
        "Focus on foundational concepts before moving to advanced topics",
        "Consider scheduling daily study sessions of 1-2 hours",
        "Review basic nursing fundamentals alongside topic-specific content"
      );
    } else if (performance.overallScore < 75) {
      recommendations.push(
        "Concentrate on your top 5 gap areas first",
        "Mix content review with practice questions",
        "Aim for 2-3 hours of focused study daily"
      );
    } else {
      recommendations.push(
        "Focus on application and analysis-level questions",
        "Practice NCLEX-style questions in your weak areas",
        "Consider peer study groups for collaborative learning"
      );
    }
    
    // Module-based recommendations
    if (modules.length > 5) {
      recommendations.push(
        "Break your study plan into weekly goals to avoid overwhelm",
        "Complete one module fully before moving to the next"
      );
    }
    
    // Time-based recommendations
    const totalHours = modules.reduce((sum, m) => sum + m.estimatedTime, 0) / 60;
    if (totalHours > 40) {
      recommendations.push(
        `Your study plan spans ${Math.ceil(totalHours)} hours - consider spreading over ${Math.ceil(totalHours / 10)} weeks`
      );
    }
    
    return recommendations;
  }

  /**
   * Calculate expected outcomes
   */
  private calculateExpectedOutcome(
    currentScore: number,
    pathTemplate: StudyPathTemplate | null,
    modules: any[]
  ): {
    targetScore: number;
    estimatedImprovement: number;
    timeToCompletion: number;
  } {
    // Base improvement on current score and effort
    const totalHours = modules.reduce((sum, m) => sum + m.estimatedTime, 0) / 60;
    const baseImprovement = Math.min(25, totalHours * 0.5); // ~0.5% per hour studied
    
    // Adjust based on current performance
    const performanceMultiplier = currentScore < 60 ? 1.2 : currentScore < 75 ? 1.0 : 0.8;
    const estimatedImprovement = Math.round(baseImprovement * performanceMultiplier);
    
    return {
      targetScore: Math.min(95, currentScore + estimatedImprovement),
      estimatedImprovement,
      timeToCompletion: Math.ceil(totalHours)
    };
  }

  /**
   * Generate study content based on crosswalk mappings
   */
  async generateStudyContent(
    topicId: string,
    contentType: 'explanation' | 'example' | 'practice' | 'summary'
  ): Promise<{
    title: string;
    content: string;
    relatedObjectives: string[];
    suggestedResources: Array<{ title: string; type: string; url?: string }>;
  }> {
    // Get topic objectives from crosswalk
    const objectives = await db
      .select()
      .from(topicObjectivesCrosswalk)
      .where(eq(topicObjectivesCrosswalk.topicId, topicId))
      .orderBy(asc(topicObjectivesCrosswalk.orderIndex));
    
    // Get NCLEX category from crosswalk
    const [nclexCrosswalk] = await db
      .select()
      .from(nclexTopicCrosswalk)
      .where(eq(nclexTopicCrosswalk.topicId, topicId))
      .limit(1);
    
    // Generate content based on type
    let content = '';
    let title = '';
    
    switch (contentType) {
      case 'explanation':
        title = `Understanding ${nclexCrosswalk?.topicName || 'This Topic'}`;
        content = this.generateExplanationContent(objectives, nclexCrosswalk);
        break;
      
      case 'example':
        title = `Clinical Examples: ${nclexCrosswalk?.topicName || 'This Topic'}`;
        content = this.generateExampleContent(objectives, nclexCrosswalk);
        break;
      
      case 'practice':
        title = `Practice Questions: ${nclexCrosswalk?.topicName || 'This Topic'}`;
        content = this.generatePracticeContent(objectives, nclexCrosswalk);
        break;
      
      case 'summary':
        title = `Quick Review: ${nclexCrosswalk?.topicName || 'This Topic'}`;
        content = this.generateSummaryContent(objectives, nclexCrosswalk);
        break;
    }
    
    // Get suggested resources
    const resources = await this.getSuggestedResources(topicId, objectives.map(o => o.objectiveId));
    
    return {
      title,
      content,
      relatedObjectives: objectives.map(o => o.objectiveText),
      suggestedResources: resources
    };
  }

  /**
   * Generate explanation content
   */
  private generateExplanationContent(
    objectives: any[],
    nclexCrosswalk: any
  ): string {
    let content = `## Overview\n\n`;
    
    if (nclexCrosswalk) {
      content += `This topic falls under the NCLEX category: **${nclexCrosswalk.nclexCategory}**`;
      if (nclexCrosswalk.nclexSubcategory) {
        content += ` (${nclexCrosswalk.nclexSubcategory})`;
      }
      content += `\n\n`;
    }
    
    content += `## Key Learning Objectives\n\n`;
    
    objectives.forEach((obj, index) => {
      content += `${index + 1}. **${obj.objectiveText}**\n`;
      if (obj.bloomsLevel) {
        content += `   - Cognitive Level: ${obj.bloomsLevel}\n`;
      }
      if (obj.isCore) {
        content += `   - *Core Objective*\n`;
      }
      content += `\n`;
    });
    
    content += `## Clinical Significance\n\n`;
    content += `Understanding this topic is essential for:\n`;
    content += `- Safe and effective patient care\n`;
    content += `- Clinical decision making\n`;
    content += `- NCLEX exam preparation\n`;
    
    return content;
  }

  /**
   * Generate example content
   */
  private generateExampleContent(
    objectives: any[],
    nclexCrosswalk: any
  ): string {
    let content = `## Clinical Scenarios\n\n`;
    
    content += `### Scenario 1: Application in Practice\n\n`;
    content += `Consider a patient presenting with the following:\n`;
    content += `- [Clinical presentation related to ${nclexCrosswalk?.topicName || 'this topic'}]\n`;
    content += `- [Relevant symptoms and findings]\n\n`;
    
    content += `**Critical Thinking Questions:**\n`;
    objectives.slice(0, 3).forEach((obj, index) => {
      content += `${index + 1}. How would you ${obj.objectiveText.toLowerCase()}?\n`;
    });
    
    content += `\n### Key Takeaways\n\n`;
    content += `- Priority nursing interventions\n`;
    content += `- Assessment considerations\n`;
    content += `- Patient teaching points\n`;
    
    return content;
  }

  /**
   * Generate practice content
   */
  private generatePracticeContent(
    objectives: any[],
    nclexCrosswalk: any
  ): string {
    let content = `## Practice Questions\n\n`;
    
    content += `### Question 1\n`;
    content += `A nurse is caring for a patient with [condition related to ${nclexCrosswalk?.topicName || 'this topic'}]. `;
    content += `Which intervention should the nurse prioritize?\n\n`;
    content += `A. [Option A]\n`;
    content += `B. [Option B]\n`;
    content += `C. [Option C]\n`;
    content += `D. [Option D]\n\n`;
    
    content += `**Rationale:** [Explanation based on objectives]\n\n`;
    
    content += `### Self-Assessment Checklist\n\n`;
    content += `Can you:\n`;
    objectives.forEach(obj => {
      content += `- [ ] ${obj.objectiveText}\n`;
    });
    
    return content;
  }

  /**
   * Generate summary content
   */
  private generateSummaryContent(
    objectives: any[],
    nclexCrosswalk: any
  ): string {
    let content = `## Quick Review Summary\n\n`;
    
    content += `### Must-Know Points\n\n`;
    objectives.filter(o => o.isCore).forEach(obj => {
      content += `- **${obj.objectiveText}**\n`;
    });
    
    if (nclexCrosswalk) {
      content += `\n### NCLEX Focus\n\n`;
      content += `- Category: ${nclexCrosswalk.nclexCategory}\n`;
      content += `- Priority Level: ${nclexCrosswalk.mappingType === 'primary' ? 'High' : 'Medium'}\n`;
      content += `- Testing Weight: Approximately ${(nclexCrosswalk.nclexWeight || 10)}% of exam\n`;
    }
    
    content += `\n### Memory Aids\n\n`;
    content += `- [Mnemonic or memory device for this topic]\n`;
    content += `- [Key associations to remember]\n`;
    
    return content;
  }

  /**
   * Get suggested resources for a topic
   */
  private async getSuggestedResources(
    topicId: string,
    objectiveIds: string[]
  ): Promise<Array<{ title: string; type: string; url?: string }>> {
    if (objectiveIds.length === 0) return [];
    
    const resources = await db
      .select({
        title: objectiveResourcesCrosswalk.resourceTitle,
        type: objectiveResourcesCrosswalk.resourceType,
        relevance: objectiveResourcesCrosswalk.relevanceScore
      })
      .from(objectiveResourcesCrosswalk)
      .where(inArray(objectiveResourcesCrosswalk.objectiveId, objectiveIds))
      .orderBy(desc(objectiveResourcesCrosswalk.relevanceScore))
      .limit(5);
    
    return resources.map(r => ({
      title: r.title,
      type: r.type,
      url: undefined // Would need to join with actual resource table
    }));
  }

  /**
   * Analyze content coverage for a topic
   */
  async analyzeContentCoverage(topicId: string): Promise<{
    overallCoverage: number;
    objectiveCoverage: number;
    resourceAvailability: number;
    gaps: string[];
    recommendations: string[];
  }> {
    // Get objectives for the topic
    const objectives = await db
      .select()
      .from(topicObjectivesCrosswalk)
      .where(eq(topicObjectivesCrosswalk.topicId, topicId));
    
    // Get resources for each objective
    const resourceCounts = await Promise.all(
      objectives.map(async (obj) => {
        const resources = await db
          .select({ count: sql<number>`count(*)` })
          .from(objectiveResourcesCrosswalk)
          .where(eq(objectiveResourcesCrosswalk.objectiveId, obj.objectiveId));
        return resources[0]?.count || 0;
      })
    );
    
    // Calculate coverage metrics
    const objectiveCoverage = objectives.length > 0 ? 100 : 0;
    const avgResourcesPerObjective = resourceCounts.reduce((a, b) => a + b, 0) / Math.max(objectives.length, 1);
    const resourceAvailability = Math.min(100, avgResourcesPerObjective * 20); // 5 resources = 100%
    
    // Get content coverage from matrix
    const [coverage] = await db
      .select({ avg: sql<number>`avg(coverage_percent)` })
      .from(contentCoverageMatrix)
      .where(eq(contentCoverageMatrix.topicId, topicId));
    
    const overallCoverage = coverage?.avg || (objectiveCoverage + resourceAvailability) / 2;
    
    // Identify gaps
    const gaps = [];
    if (objectives.length === 0) gaps.push("No learning objectives defined");
    if (avgResourcesPerObjective < 2) gaps.push("Insufficient resources per objective");
    if (!objectives.some(o => o.bloomsLevel === 'Apply')) gaps.push("Missing application-level objectives");
    if (!objectives.some(o => o.isCore)) gaps.push("No core objectives identified");
    
    // Generate recommendations
    const recommendations = [];
    if (objectives.length < 3) {
      recommendations.push("Add more learning objectives to comprehensively cover the topic");
    }
    if (avgResourcesPerObjective < 3) {
      recommendations.push("Link additional resources to learning objectives");
    }
    if (overallCoverage < 70) {
      recommendations.push("Improve content coverage by adding explanations and examples");
    }
    
    return {
      overallCoverage,
      objectiveCoverage,
      resourceAvailability,
      gaps,
      recommendations
    };
  }
}

// Export singleton instance
export const contentGenerationEngine = new ContentGenerationEngine();