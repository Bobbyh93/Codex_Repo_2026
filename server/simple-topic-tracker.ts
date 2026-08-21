// Simplified topic frequency tracker without complex SQL queries
import { db } from "./db";
import { sql } from "drizzle-orm";

interface SimpleTopicStats {
  topicName: string;
  frequency: number;
  lastSeen: string | null;
  priority: 'high' | 'medium' | 'low';
}

// Simple topic tracking without complex joins
export async function trackSimpleTopicReview(topicName: string, source: string = 'analysis'): Promise<void> {
  try {
    // Simple insert for tracking
    await db.execute(sql`
      INSERT INTO topic_review_instances
      (review_topic_name, source, confidence_score, created_at)
      VALUES (${topicName}, ${source}, 1.0, CURRENT_TIMESTAMP)
    `);

    // Update simple counter
    await db.execute(sql`
      UPDATE review_topics
      SET review_frequency = review_frequency + 1,
          last_reviewed_at = CURRENT_TIMESTAMP
      WHERE name = ${topicName}
    `);
    
  } catch (error) {
    console.error(`Simple tracking error for ${topicName}:`, error);
  }
}

// Get simple topic statistics
export async function getSimpleTopicStats(): Promise<SimpleTopicStats[]> {
  try {
    const result = await db.execute(`
      SELECT name, review_frequency, last_reviewed_at
      FROM review_topics 
      WHERE is_active = true
      ORDER BY review_frequency DESC, name
    `);

    return result.rows.map((row: any) => {
      const frequency = parseInt(row.review_frequency) || 0;
      
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (frequency >= 10) priority = 'high';
      else if (frequency >= 5) priority = 'medium';

      return {
        topicName: row.name,
        frequency,
        lastSeen: row.last_reviewed_at,
        priority
      };
    });
    
  } catch (error) {
    console.error("Error getting simple topic stats:", error);
    return [];
  }
}

// Get simple metrics for dashboard
export async function getSimpleMetrics(): Promise<{
  totalReviews: number;
  activeTopics: number;
  highPriorityTopics: number;
  topTopics: { name: string; frequency: number }[];
}> {
  try {
    const stats = await getSimpleTopicStats();
    const totalReviews = stats.reduce((sum, s) => sum + s.frequency, 0);
    const highPriorityTopics = stats.filter(s => s.priority === 'high').length;
    const topTopics = stats.slice(0, 5).map(s => ({ name: s.topicName, frequency: s.frequency }));
    
    return {
      totalReviews,
      activeTopics: stats.length,
      highPriorityTopics,
      topTopics
    };
    
  } catch (error) {
    console.error("Error getting simple metrics:", error);
    return {
      totalReviews: 0,
      activeTopics: 0,
      highPriorityTopics: 0,
      topTopics: []
    };
  }
}