// Simplified study guide builder that works with the current topic structure
import { db } from "./db";
import { sql } from "drizzle-orm";

interface SimpleStudySection {
  title: string;
  topics: string[];
  priority: 'critical' | 'high' | 'medium';
  estimatedTime: number;
  description: string;
}

interface SimpleStudyGuide {
  title: string;
  overview: string;
  totalTime: number;
  sections: SimpleStudySection[];
  freePreview: {
    topGaps: string[];
    description: string;
  };
  premiumUpgrade: {
    additionalSections: number;
    totalTopics: number;
  };
}

// Build a simple but effective study guide based on the review topics
export async function buildSimpleStudyGuide(): Promise<SimpleStudyGuide> {
  try {
    // Get all review topics
    const topicsResult = await db.execute(sql`
      SELECT name, description, difficulty, estimated_study_time, nclex_category
      FROM review_topics 
      WHERE is_active = true 
      ORDER BY 
        CASE difficulty 
          WHEN 'Advanced' THEN 1
          WHEN 'Intermediate' THEN 2  
          WHEN 'Basic' THEN 3
          ELSE 4
        END,
        estimated_study_time DESC
    `);
    
    const topics = topicsResult.rows;
    
    // Group topics into logical study sections
    const sections: SimpleStudySection[] = [
      {
        title: "Critical Care & Safety",
        topics: topics
          .filter((t: any) => 
            t.name.includes('Safety') || 
            t.name.includes('Clinical Decision') ||
            t.name.includes('Medication')
          )
          .map((t: any) => t.name),
        priority: 'critical',
        estimatedTime: 90,
        description: "High-impact topics that affect patient safety and clinical outcomes"
      },
      {
        title: "Assessment & Monitoring", 
        topics: topics
          .filter((t: any) => 
            t.name.includes('Assessment') ||
            t.name.includes('Pathophysiology')
          )
          .map((t: any) => t.name),
        priority: 'high',
        estimatedTime: 75,
        description: "Essential skills for patient evaluation and disease understanding"
      },
      {
        title: "Care & Advocacy",
        topics: topics
          .filter((t: any) => 
            t.name.includes('Basic Care') ||
            t.name.includes('Rights') ||
            t.name.includes('Mental Health')
          )
          .map((t: any) => t.name),
        priority: 'high', 
        estimatedTime: 60,
        description: "Fundamental nursing care and patient advocacy"
      },
      {
        title: "Health Promotion",
        topics: topics
          .filter((t: any) => 
            t.name.includes('Health Promotion')
          )
          .map((t: any) => t.name),
        priority: 'medium',
        estimatedTime: 45,
        description: "Preventive care and wellness education"
      }
    ];
    
    // Remove empty sections and ensure all topics are included
    const nonEmptySections = sections.filter(s => s.topics.length > 0);
    const coveredTopics = new Set(nonEmptySections.flatMap(s => s.topics));
    const uncoveredTopics = topics
      .filter((t: any) => !coveredTopics.has(t.name))
      .map((t: any) => t.name);
    
    // Add uncovered topics to a catch-all section
    if (uncoveredTopics.length > 0) {
      nonEmptySections.push({
        title: "Additional Focus Areas",
        topics: uncoveredTopics,
        priority: 'medium',
        estimatedTime: uncoveredTopics.length * 20,
        description: "Additional important nursing topics"
      });
    }
    
    const totalTime = nonEmptySections.reduce((sum, s) => sum + s.estimatedTime, 0);
    
    return {
      title: "1-Hour Nursing Exam Recovery Blueprint",
      overview: `Structured study plan targeting ${topics.length} core nursing topics organized into ${nonEmptySections.length} prioritized focus areas. Based on NCLEX categories and topic difficulty analysis.`,
      totalTime: Math.min(totalTime, 240), // Cap at 4 hours
      sections: nonEmptySections,
      freePreview: {
        topGaps: nonEmptySections
          .filter(s => s.priority === 'critical')
          .flatMap(s => s.topics)
          .slice(0, 2),
        description: "Free analysis identifies your top 2 knowledge gaps with targeted study focus"
      },
      premiumUpgrade: {
        additionalSections: nonEmptySections.length - 1,
        totalTopics: topics.length
      }
    };
    
  } catch (error) {
    console.error("Error building simple study guide:", error);
    throw new Error("Failed to build study guide");
  }
}

// Generate personalized recommendations based on weak topics
export async function generateSimpleRecommendations(weakTopics: string[] = []): Promise<{
  recommendations: SimpleStudySection[];
  focusAreas: string[];
  estimatedImprovementTime: number;
}> {
  
  const studyGuide = await buildSimpleStudyGuide();
  
  // Find sections that match weak topics
  const relevantSections = studyGuide.sections.filter(section =>
    section.topics.some(topic =>
      weakTopics.some(weak => 
        topic.toLowerCase().includes(weak.toLowerCase()) ||
        weak.toLowerCase().includes(topic.toLowerCase())
      )
    )
  );
  
  // If no matches, default to critical sections
  const recommendations = relevantSections.length > 0 
    ? relevantSections 
    : studyGuide.sections.filter(s => s.priority === 'critical');
  
  const focusAreas = recommendations.flatMap(r => r.topics);
  const estimatedTime = Math.min(
    recommendations.reduce((sum, r) => sum + r.estimatedTime, 0),
    120 // Cap at 2 hours for personalized plan
  );
  
  return {
    recommendations,
    focusAreas,
    estimatedImprovementTime: estimatedTime
  };
}