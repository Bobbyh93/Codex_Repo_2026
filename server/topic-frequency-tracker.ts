// Topic frequency tracker for identifying high-priority content development areas
import { db } from "./db";

interface TopicReviewEvent {
  topicName: string;
  source: 'pdf_analysis' | 'manual_selection' | 'ai_recommendation' | 'study_plan';
  confidenceScore?: number;
  assessmentReportId?: string;
  userIdentifier?: string;
}

interface TopicFrequencyData {
  topicName: string;
  reviewFrequency: number;
  lastReviewedAt: string | null;
  contentPriorityScore: number;
  recentInstances: number; // Last 30 days
  trend: 'increasing' | 'stable' | 'decreasing';
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
}

interface ContentDevelopmentPriorities {
  highPriorityTopics: TopicFrequencyData[];
  emergingNeeds: TopicFrequencyData[];
  contentGaps: {
    topicName: string;
    demandScore: number;
    resourceGap: number;
  }[];
  developmentRecommendations: {
    topic: string;
    recommendedContent: string[];
    businessImpact: 'high' | 'medium' | 'low';
    estimatedEffort: 'small' | 'medium' | 'large';
  }[];
}

// Track when a topic is identified as needing review
export async function trackTopicReview(events: TopicReviewEvent[]): Promise<void> {
  for (const event of events) {
    try {
      // Record the review instance
      await db.execute(`
        INSERT INTO topic_review_instances 
        (review_topic_name, assessment_report_id, user_identifier, source, confidence_score, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        event.topicName,
        event.assessmentReportId || null,
        event.userIdentifier || null,
        event.source,
        event.confidenceScore || 0.5
      ]);

      // Update frequency counters
      await updateTopicFrequency(event.topicName);
      
    } catch (error) {
      console.error(`Error tracking topic review for ${event.topicName}:`, error);
    }
  }
}

// Update frequency counters for a topic
async function updateTopicFrequency(topicName: string): Promise<void> {
  try {
    // Update review frequency and last reviewed timestamp
    await db.execute(`
      UPDATE review_topics 
      SET 
        review_frequency = review_frequency + 1,
        last_reviewed_at = CURRENT_TIMESTAMP,
        content_priority_score = (
          SELECT COUNT(*) * 1.0 + 
                 COUNT(CASE WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) * 2.0 +
                 AVG(confidence_score) * 10.0
          FROM topic_review_instances 
          WHERE review_topic_name = ?
        )
      WHERE name = ?
    `, [topicName, topicName]);
    
  } catch (error) {
    console.error(`Error updating frequency for ${topicName}:`, error);
  }
}

// Get topic frequency data for content development planning
export async function getTopicFrequencyData(): Promise<TopicFrequencyData[]> {
  try {
    const result = await db.execute(`
      SELECT 
        rt.name as topic_name,
        rt.review_frequency,
        rt.last_reviewed_at,
        rt.content_priority_score,
        COUNT(CASE WHEN tri.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as recent_instances,
        COUNT(CASE WHEN tri.created_at > CURRENT_TIMESTAMP - INTERVAL '60 days' AND tri.created_at <= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as previous_instances
      FROM review_topics rt
      LEFT JOIN topic_review_instances tri ON rt.name = tri.review_topic_name
      WHERE rt.is_active = true
      GROUP BY rt.name, rt.review_frequency, rt.last_reviewed_at, rt.content_priority_score
      ORDER BY rt.content_priority_score DESC, rt.review_frequency DESC
    `);

    return result.rows.map((row: any) => {
      const recentCount = parseInt(row.recent_instances) || 0;
      const previousCount = parseInt(row.previous_instances) || 0;
      
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      if (recentCount > previousCount * 1.2) trend = 'increasing';
      else if (recentCount < previousCount * 0.8) trend = 'decreasing';
      
      let priorityLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
      const score = parseFloat(row.content_priority_score) || 0;
      if (score >= 50) priorityLevel = 'critical';
      else if (score >= 25) priorityLevel = 'high';
      else if (score >= 10) priorityLevel = 'medium';

      return {
        topicName: row.topic_name,
        reviewFrequency: parseInt(row.review_frequency) || 0,
        lastReviewedAt: row.last_reviewed_at,
        contentPriorityScore: score,
        recentInstances: recentCount,
        trend,
        priorityLevel
      };
    });
    
  } catch (error) {
    console.error("Error getting topic frequency data:", error);
    return [];
  }
}

// Generate content development priorities based on frequency data
export async function generateContentDevelopmentPriorities(): Promise<ContentDevelopmentPriorities> {
  const frequencyData = await getTopicFrequencyData();
  
  // High priority topics (frequently reviewed)
  const highPriorityTopics = frequencyData
    .filter(t => t.priorityLevel === 'critical' || t.priorityLevel === 'high')
    .sort((a, b) => b.contentPriorityScore - a.contentPriorityScore)
    .slice(0, 5);

  // Emerging needs (increasing trend)
  const emergingNeeds = frequencyData
    .filter(t => t.trend === 'increasing' && t.recentInstances >= 3)
    .sort((a, b) => b.recentInstances - a.recentInstances)
    .slice(0, 3);

  // Content gaps (high demand, potentially low resources)
  const contentGaps = await identifyContentGaps(frequencyData);

  // Development recommendations
  const developmentRecommendations = generateDevelopmentRecommendations(
    highPriorityTopics, 
    emergingNeeds
  );

  return {
    highPriorityTopics,
    emergingNeeds,
    contentGaps,
    developmentRecommendations
  };
}

// Identify content gaps by comparing demand to available resources
async function identifyContentGaps(frequencyData: TopicFrequencyData[]): Promise<{
  topicName: string;
  demandScore: number;
  resourceGap: number;
}[]> {
  const gaps = [];
  
  for (const topic of frequencyData) {
    try {
      // Count available content for this topic
      const contentResult = await db.execute(`
        SELECT COUNT(*) as content_count
        FROM content_blocks 
        WHERE category = $1 OR 
              title LIKE $2 OR 
              content LIKE $3
      `, [topic.topicName, `%${topic.topicName}%`, `%${topic.topicName}%`]);
      
      const contentCount = parseInt(contentResult.rows[0]?.content_count) || 0;
      const demandScore = topic.contentPriorityScore;
      
      // Calculate resource gap (high demand, low content)
      const expectedContent = Math.max(demandScore / 5, 1); // Expect ~1 content per 5 priority points
      const resourceGap = Math.max(0, expectedContent - contentCount);
      
      if (resourceGap > 0 && demandScore > 5) {
        gaps.push({
          topicName: topic.topicName,
          demandScore,
          resourceGap
        });
      }
      
    } catch (error) {
      console.error(`Error calculating content gap for ${topic.topicName}:`, error);
    }
  }
  
  return gaps.sort((a, b) => b.resourceGap - a.resourceGap).slice(0, 5);
}

// Generate specific development recommendations
function generateDevelopmentRecommendations(
  highPriorityTopics: TopicFrequencyData[],
  emergingNeeds: TopicFrequencyData[]
): {
  topic: string;
  recommendedContent: string[];
  businessImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'small' | 'medium' | 'large';
}[] {
  const recommendations = [];
  
  // High priority topics need comprehensive content
  for (const topic of highPriorityTopics.slice(0, 3)) {
    recommendations.push({
      topic: topic.topicName,
      recommendedContent: [
        'Comprehensive video tutorials',
        'Interactive practice questions',
        'Case study scenarios',
        'Quick reference guides',
        'Assessment tools'
      ],
      businessImpact: 'high' as const,
      estimatedEffort: 'large' as const
    });
  }
  
  // Emerging needs require targeted content
  for (const topic of emergingNeeds) {
    recommendations.push({
      topic: topic.topicName,
      recommendedContent: [
        'Focused video series',
        'Practice question sets',
        'Study guides'
      ],
      businessImpact: 'medium' as const,
      estimatedEffort: 'medium' as const
    });
  }
  
  return recommendations;
}

// Track topic reviews from assessment analysis
export async function trackAssessmentTopics(
  assessmentReportId: string,
  identifiedTopics: { name: string; confidence: number }[],
  userIdentifier?: string
): Promise<void> {
  const events: TopicReviewEvent[] = identifiedTopics.map(topic => ({
    topicName: topic.name,
    source: 'pdf_analysis',
    confidenceScore: topic.confidence,
    assessmentReportId,
    userIdentifier
  }));
  
  await trackTopicReview(events);
}

// Get priority metrics for admin dashboard
export async function getPriorityMetrics(): Promise<{
  totalReviews: number;
  activeTopics: number;
  criticalTopics: number;
  contentGapsCount: number;
  topDemandTopics: { name: string; score: number }[];
}> {
  try {
    const [totalResult, activeResult, priorityData, gaps] = await Promise.all([
      db.execute('SELECT COUNT(*) as total FROM topic_review_instances'),
      db.execute('SELECT COUNT(*) as active FROM review_topics WHERE is_active = true'),
      getTopicFrequencyData(),
      generateContentDevelopmentPriorities()
    ]);
    
    const criticalTopics = priorityData.filter(t => t.priorityLevel === 'critical').length;
    const topDemandTopics = priorityData
      .slice(0, 5)
      .map(t => ({ name: t.topicName, score: t.contentPriorityScore }));
    
    return {
      totalReviews: parseInt(totalResult.rows[0]?.total) || 0,
      activeTopics: parseInt(activeResult.rows[0]?.active) || 0,
      criticalTopics,
      contentGapsCount: gaps.contentGaps.length,
      topDemandTopics
    };
    
  } catch (error) {
    console.error("Error getting priority metrics:", error);
    return {
      totalReviews: 0,
      activeTopics: 0,
      criticalTopics: 0,
      contentGapsCount: 0,
      topDemandTopics: []
    };
  }
}