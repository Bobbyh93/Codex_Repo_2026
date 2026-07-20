import { db } from "./db";
import { 
  topicDemand, 
  resourceAllocation, 
  nursingTopics, 
  learningResources,
  resourceMappings,
  topicsNeedingResources,
  assessmentReports,
  topicPerformance,
  type InsertTopicDemand,
  type InsertResourceAllocation,
  type TopicDemand,
  type ResourceAllocation
} from "@shared/schema";
import { eq, desc, asc, and, sql, gte, lte, between, count, avg } from "drizzle-orm";
import { AIProcessor } from "./ai-processor";

export interface DemandMetrics {
  topicId: string;
  topicName: string;
  demandCount: number;
  uniqueUsers: number;
  avgPriority: number;
  lastRequested: Date;
  sources: { source: string; count: number }[];
  trend: 'increasing' | 'stable' | 'decreasing';
  resourceCoverage: number; // percentage
}

export interface ResourceGap {
  topicId: string;
  topicName: string;
  demandScore: number;
  resourceCount: number;
  gapScore: number; // 0-100, higher = bigger gap
  suggestedResourceTypes: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AllocationPlan {
  topicId: string;
  topicName: string;
  recommendations: {
    resourceType: string;
    quantity: number;
    priority: number;
    reasoning: string;
  }[];
  allocationScore: number;
  estimatedTimeToComplete: number; // hours
  cost: 'low' | 'medium' | 'high';
}

export interface DemandTrend {
  date: string;
  demandCount: number;
  uniqueTopics: number;
  avgPriority: number;
}

export class DemandAnalytics {
  // Track when a topic is requested or needed
  static async trackTopicDemand(
    topicId: string,
    source: 'assessment' | 'search' | 'direct' | 'study_plan',
    userId?: string,
    priority: number = 1,
    metadata?: {
      assessmentId?: string;
      searchQuery?: string;
      referrer?: string;
      context?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      const demandRecord: any = {
        topicId,
        userId,
        source,
        priority,
        sessionId: metadata?.sessionId,
        metadata: metadata ? {
          assessmentId: metadata.assessmentId,
          searchQuery: metadata.searchQuery,
          referrer: metadata.referrer,
          context: metadata.context
        } : {}
      };

      await db.insert(topicDemand).values([demandRecord]);

      // Also update topicsNeedingResources if resources are lacking
      const resourceCount = await db
        .select({ count: sql`count(*)` })
        .from(resourceMappings)
        .where(and(
          eq(resourceMappings.topicId, topicId),
          eq(resourceMappings.isActive, true)
        ));

      if (Number(resourceCount[0].count) === 0) {
        // Track in topicsNeedingResources
        const existing = await db
          .select()
          .from(topicsNeedingResources)
          .where(eq(topicsNeedingResources.topicId, topicId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(topicsNeedingResources)
            .set({
              requestCount: sql`${topicsNeedingResources.requestCount} + 1`,
              lastRequested: new Date(),
              priority: Math.max(existing[0].priority || 0, priority)
            })
            .where(eq(topicsNeedingResources.topicId, topicId));
        } else {
          const topic = await db
            .select()
            .from(nursingTopics)
            .where(eq(nursingTopics.id, topicId))
            .limit(1);

          if (topic.length > 0) {
            await db.insert(topicsNeedingResources).values([{
              topicId,
              topicName: topic[0].name,
              requestCount: 1,
              priority
            }]);
          }
        }
      }
    } catch (error) {
      console.error("Error tracking topic demand:", error);
    }
  }

  // Get comprehensive demand metrics for topics
  static async getTopicDemandMetrics(
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<DemandMetrics[]> {
    try {
      const baseQuery = db
        .select({
          topicId: topicDemand.topicId,
          topicName: nursingTopics.name,
          demandCount: sql<number>`count(*)`,
          uniqueUsers: sql<number>`count(distinct ${topicDemand.userId})`,
          avgPriority: sql<number>`avg(${topicDemand.priority})`,
          lastRequested: sql<Date>`max(${topicDemand.requestedAt})`,
        })
        .from(topicDemand)
        .leftJoin(nursingTopics, eq(topicDemand.topicId, nursingTopics.id));

      const query = startDate && endDate 
        ? baseQuery.where(between(topicDemand.requestedAt, startDate, endDate)).groupBy(topicDemand.topicId, nursingTopics.name)
        : baseQuery.groupBy(topicDemand.topicId, nursingTopics.name);

      const results = await query
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      // Get source breakdown and resource coverage for each topic
      const metrics: DemandMetrics[] = [];
      
      for (const result of results) {
        if (!result.topicId) continue;

        // Get source breakdown
        const sources = await db
          .select({
            source: topicDemand.source,
            count: sql<number>`count(*)`
          })
          .from(topicDemand)
          .where(eq(topicDemand.topicId, result.topicId))
          .groupBy(topicDemand.source);

        // Get resource coverage
        const resourceCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(resourceMappings)
          .where(and(
            eq(resourceMappings.topicId, result.topicId),
            eq(resourceMappings.isActive, true)
          ));

        // Calculate trend (simple: compare last 7 days to previous 7 days)
        const trend = await this.calculateTrend(result.topicId);

        metrics.push({
          topicId: result.topicId,
          topicName: result.topicName || 'Unknown Topic',
          demandCount: result.demandCount,
          uniqueUsers: result.uniqueUsers,
          avgPriority: result.avgPriority,
          lastRequested: result.lastRequested,
          sources: sources.map(s => ({ source: s.source, count: s.count })),
          trend,
          resourceCoverage: Math.min(100, Number(resourceCount[0].count) * 20) // Assume 5 resources = 100% coverage
        });
      }

      return metrics;
    } catch (error) {
      console.error("Error getting demand metrics:", error);
      return [];
    }
  }

  // Calculate resource gaps - topics with high demand but low resources
  static async calculateResourceGaps(
    minDemandThreshold: number = 5
  ): Promise<ResourceGap[]> {
    try {
      // Get all topics with demand above threshold
      const topicsWithDemand = await db
        .select({
          topicId: topicDemand.topicId,
          topicName: nursingTopics.name,
          demandCount: sql<number>`count(*)`,
          avgPriority: sql<number>`avg(${topicDemand.priority})`
        })
        .from(topicDemand)
        .leftJoin(nursingTopics, eq(topicDemand.topicId, nursingTopics.id))
        .groupBy(topicDemand.topicId, nursingTopics.name)
        .having(sql`count(*) >= ${minDemandThreshold}`);

      const gaps: ResourceGap[] = [];

      for (const topic of topicsWithDemand) {
        if (!topic.topicId) continue;

        // Get resource count
        const resources = await db
          .select({ 
            count: sql<number>`count(*)`,
            types: sql<string[]>`array_agg(distinct ${learningResources.type})`
          })
          .from(resourceMappings)
          .leftJoin(learningResources, eq(resourceMappings.resourceId, learningResources.id))
          .where(and(
            eq(resourceMappings.topicId, topic.topicId),
            eq(resourceMappings.isActive, true)
          ));

        const resourceCount = Number(resources[0]?.count || 0);
        const existingTypes = resources[0]?.types || [];
        
        // Calculate gap score (0-100)
        const demandScore = Math.min(100, topic.demandCount * topic.avgPriority * 2);
        const resourceScore = Math.min(100, resourceCount * 20);
        const gapScore = Math.max(0, demandScore - resourceScore);

        // Determine suggested resource types
        const allTypes = ['video', 'article', 'practice', 'quiz', 'simulation'];
        const suggestedTypes = allTypes.filter(t => !existingTypes.includes(t));

        // Determine priority
        let priority: 'low' | 'medium' | 'high' | 'critical';
        if (gapScore >= 75) priority = 'critical';
        else if (gapScore >= 50) priority = 'high';
        else if (gapScore >= 25) priority = 'medium';
        else priority = 'low';

        gaps.push({
          topicId: topic.topicId,
          topicName: topic.topicName || 'Unknown Topic',
          demandScore,
          resourceCount,
          gapScore,
          suggestedResourceTypes: suggestedTypes,
          priority
        });
      }

      return gaps.sort((a, b) => b.gapScore - a.gapScore);
    } catch (error) {
      console.error("Error calculating resource gaps:", error);
      return [];
    }
  }

  // Generate AI-powered resource allocation recommendations
  static async generateAllocationPlan(
    topicIds?: string[],
    budget?: 'low' | 'medium' | 'high'
  ): Promise<AllocationPlan[]> {
    try {
      // Get gaps for specified topics or top gaps
      let gaps: ResourceGap[];
      if (topicIds && topicIds.length > 0) {
        gaps = await this.calculateResourceGaps(1);
        gaps = gaps.filter(g => topicIds.includes(g.topicId));
      } else {
        gaps = await this.calculateResourceGaps(5);
        gaps = gaps.slice(0, 10); // Top 10 gaps
      }

      const plans: AllocationPlan[] = [];

      for (const gap of gaps) {
        // Use AI to generate specific recommendations
        const aiRecommendations = await AIProcessor.generateResourceRecommendations(
          gap.topicName,
          gap.suggestedResourceTypes,
          gap.priority
        );

        // Calculate allocation score and time estimate
        const allocationScore = gap.gapScore * 0.8 + gap.demandScore * 0.2;
        
        // Estimate time based on resource types and quantity
        const timePerResource: Record<string, number> = {
          'video': 4,
          'article': 2,
          'practice': 3,
          'quiz': 2,
          'simulation': 6,
          'textbook': 1
        };

        let totalTime = 0;
        const recommendations = aiRecommendations.map(rec => {
          totalTime += (timePerResource[rec.type] || 3) * rec.quantity;
          return {
            resourceType: rec.type,
            quantity: rec.quantity,
            priority: rec.priority,
            reasoning: rec.reasoning
          };
        });

        // Determine cost based on resource types and quantity
        let cost: 'low' | 'medium' | 'high';
        if (totalTime <= 10) cost = 'low';
        else if (totalTime <= 25) cost = 'medium';
        else cost = 'high';

        // Filter by budget if specified
        if (budget && cost !== budget) continue;

        plans.push({
          topicId: gap.topicId,
          topicName: gap.topicName,
          recommendations,
          allocationScore,
          estimatedTimeToComplete: totalTime,
          cost
        });

        // Store the allocation plan in database
        await db.insert(resourceAllocation).values([{
          topicId: gap.topicId,
          recommendedResources: recommendations,
          allocationScore: allocationScore.toString(),
          demandLevel: gap.priority,
          resourceGap: gap.gapScore.toString(),
          status: 'pending'
        }]);
      }

      return plans.sort((a, b) => b.allocationScore - a.allocationScore);
    } catch (error) {
      console.error("Error generating allocation plan:", error);
      return [];
    }
  }

  // Get demand trends over time
  static async getDemandTrends(
    days: number = 30,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<DemandTrend[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let dateFormat: string;
      switch (groupBy) {
        case 'week':
          dateFormat = "date_trunc('week', requested_at)";
          break;
        case 'month':
          dateFormat = "date_trunc('month', requested_at)";
          break;
        default:
          dateFormat = "date_trunc('day', requested_at)";
      }

      const trends = await db
        .select({
          date: sql<string>`${sql.raw(dateFormat)}`,
          demandCount: sql<number>`count(*)`,
          uniqueTopics: sql<number>`count(distinct topic_id)`,
          avgPriority: sql<number>`avg(priority)`
        })
        .from(topicDemand)
        .where(gte(topicDemand.requestedAt, startDate))
        .groupBy(sql`${sql.raw(dateFormat)}`)
        .orderBy(asc(sql`${sql.raw(dateFormat)}`));

      return trends.map(t => ({
        date: new Date(t.date).toISOString().split('T')[0],
        demandCount: t.demandCount,
        uniqueTopics: t.uniqueTopics,
        avgPriority: t.avgPriority
      }));
    } catch (error) {
      console.error("Error getting demand trends:", error);
      return [];
    }
  }

  // Predict future demand based on historical trends
  static async predictFutureDemand(
    topicId: string,
    daysAhead: number = 7
  ): Promise<{ predictedDemand: number; confidence: number }> {
    try {
      // Get historical demand for the topic
      const historicalDemand = await db
        .select({
          date: sql<string>`date_trunc('day', requested_at)`,
          count: sql<number>`count(*)`
        })
        .from(topicDemand)
        .where(eq(topicDemand.topicId, topicId))
        .groupBy(sql`date_trunc('day', requested_at)`)
        .orderBy(desc(sql`date_trunc('day', requested_at)`))
        .limit(30);

      if (historicalDemand.length < 7) {
        // Not enough data for prediction
        return { predictedDemand: 0, confidence: 0 };
      }

      // Simple moving average prediction
      const recentAvg = historicalDemand.slice(0, 7).reduce((sum, d) => sum + d.count, 0) / 7;
      const overallAvg = historicalDemand.reduce((sum, d) => sum + d.count, 0) / historicalDemand.length;
      
      // Weight recent data more heavily
      const predictedDemand = Math.round(recentAvg * 0.7 + overallAvg * 0.3) * daysAhead;
      
      // Calculate confidence based on data consistency
      const variance = historicalDemand.reduce((sum, d) => sum + Math.pow(d.count - overallAvg, 2), 0) / historicalDemand.length;
      const stdDev = Math.sqrt(variance);
      const confidence = Math.max(0, Math.min(100, 100 - (stdDev / overallAvg) * 50));

      return { predictedDemand, confidence };
    } catch (error) {
      console.error("Error predicting demand:", error);
      return { predictedDemand: 0, confidence: 0 };
    }
  }

  // Private helper to calculate trend
  private static async calculateTrend(topicId: string): Promise<'increasing' | 'stable' | 'decreasing'> {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const [recentCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(topicDemand)
        .where(and(
          eq(topicDemand.topicId, topicId),
          gte(topicDemand.requestedAt, lastWeek)
        ));

      const [previousCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(topicDemand)
        .where(and(
          eq(topicDemand.topicId, topicId),
          between(topicDemand.requestedAt, twoWeeksAgo, lastWeek)
        ));

      const recent = Number(recentCount.count);
      const previous = Number(previousCount.count);

      if (recent > previous * 1.2) return 'increasing';
      if (recent < previous * 0.8) return 'decreasing';
      return 'stable';
    } catch (error) {
      console.error("Error calculating trend:", error);
      return 'stable';
    }
  }
}