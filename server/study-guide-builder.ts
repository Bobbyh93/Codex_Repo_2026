// Study guide template builder based on topic relationships and priorities
import { analyzeTopicRelationships, generateStudyGuidePriorities } from "./topic-relationship-analyzer";
import { db } from "./db";
import { sql } from "drizzle-orm";

interface StudyGuideSection {
  title: string;
  topics: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedStudyTime: number;
  keyAreas: string[];
  resources: StudyResource[];
  relatedConcepts: string[];
}

interface StudyResource {
  type: 'content' | 'video' | 'practice' | 'assessment';
  title: string;
  description: string;
  source: string;
  topicRelevance: number;
}

interface StudyGuideTemplate {
  title: string;
  overview: string;
  totalEstimatedTime: number;
  sections: StudyGuideSection[];
  studySequence: string[];
  priorityMatrix: {
    critical: string[];
    high: string[];
    medium: string[];
    low: string[];
  };
  customization: {
    freeAnalysisTopics: string[]; // Top 2 gaps for free analysis
    premiumTopics: string[];      // Additional topics for paid blueprint
  };
}

// Build comprehensive study guide template around topic relationships
export async function buildStudyGuideTemplate(): Promise<StudyGuideTemplate> {
  
  // Get topic relationship analysis
  const analysis = await analyzeTopicRelationships();
  const priorities = await generateStudyGuidePriorities();
  
  // Build sections around topic clusters
  const sections: StudyGuideSection[] = [];
  let totalTime = 0;
  
  for (const cluster of priorities.prioritizedClusters) {
    const section = await buildStudySection(cluster, analysis.highImpactTopics);
    sections.push(section);
    totalTime += section.estimatedStudyTime;
  }
  
  // Add any remaining topics as lower priority sections
  const coveredTopics = new Set(sections.flatMap(s => s.topics));
  const remainingTopics = analysis.highImpactTopics
    .filter(t => !coveredTopics.has(t.topicName))
    .slice(0, 3); // Limit to prevent bloat
  
  if (remainingTopics.length > 0) {
    const additionalSection: StudyGuideSection = {
      title: "Additional Focus Areas",
      topics: remainingTopics.map(t => t.topicName),
      priority: 'medium',
      estimatedStudyTime: remainingTopics.length * 30,
      keyAreas: remainingTopics.flatMap(t => t.sharedConcepts.slice(0, 2)),
      resources: await getResourcesForTopics(remainingTopics.map(t => t.topicName)),
      relatedConcepts: [...new Set(remainingTopics.flatMap(t => t.sharedConcepts))]
    };
    sections.push(additionalSection);
    totalTime += additionalSection.estimatedStudyTime;
  }
  
  // Organize priority matrix
  const priorityMatrix = organizePriorityMatrix(analysis.highImpactTopics);
  
  // Determine free vs premium topics for business model
  const customization = determineCustomizationTiers(analysis.highImpactTopics, priorities.prioritizedClusters);
  
  return {
    title: "1-Hour Nursing Exam Recovery Blueprint",
    overview: `Personalized study plan focusing on ${priorities.prioritizedClusters.length} high-impact topic clusters with ${analysis.relationships.length} identified knowledge connections. Prioritized based on topic relationships and cross-cutting concepts.`,
    totalEstimatedTime: Math.min(totalTime, 240), // Cap at 4 hours
    sections,
    studySequence: priorities.studySequence,
    priorityMatrix,
    customization
  };
}

// Build individual study section for a topic cluster
async function buildStudySection(cluster: any, highImpactTopics: any[]): Promise<StudyGuideSection> {
  
  // Get cluster priority based on impact scores
  const clusterTopicImpacts = highImpactTopics.filter(t => cluster.topics.includes(t.topicName));
  const avgImpact = clusterTopicImpacts.reduce((sum, t) => sum + t.impactScore, 0) / clusterTopicImpacts.length;
  
  let priority: 'critical' | 'high' | 'medium' | 'low';
  if (avgImpact >= 8) priority = 'critical';
  else if (avgImpact >= 5) priority = 'high';
  else if (avgImpact >= 3) priority = 'medium';
  else priority = 'low';
  
  // Calculate study time based on priority and topic count
  const baseTime = cluster.topics.length * 20; // 20 minutes per topic
  const priorityMultiplier = { critical: 1.5, high: 1.2, medium: 1.0, low: 0.8 };
  const estimatedTime = Math.round(baseTime * priorityMultiplier[priority]);
  
  // Get resources for this cluster
  const resources = await getResourcesForTopics(cluster.topics);
  
  // Extract key areas from shared concepts
  const keyAreas = cluster.sharedConcepts
    .filter((concept: string) => concept.length > 3)
    .slice(0, 5);
  
  return {
    title: cluster.name,
    topics: cluster.topics,
    priority,
    estimatedStudyTime: estimatedTime,
    keyAreas,
    resources,
    relatedConcepts: cluster.sharedConcepts
  };
}

// Get available study resources for topics
async function getResourcesForTopics(topics: string[]): Promise<StudyResource[]> {
  const resources: StudyResource[] = [];
  
  try {
    // Get content blocks for these topics
    const contentResult = await db.execute(sql`
      SELECT title, description, content, category, metadata
      FROM content_blocks
      WHERE category = ANY(${topics})
      AND title IS NOT NULL
      ORDER BY
        CASE
          WHEN metadata->>'confidence' IS NOT NULL
          THEN (metadata->>'confidence')::float
          ELSE 0.5
        END DESC
      LIMIT 20
    `);

    for (const content of contentResult.rows) {
      const metadata = content.metadata as { confidence?: number } | string | null;
      const confidence = metadata
        ? (typeof metadata === 'string' ? JSON.parse(metadata)?.confidence : metadata.confidence) || 0.5
        : 0.5;

      resources.push({
        type: 'content',
        title: content.title as string,
        description: (content.description as string) || 'Study content',
        source: 'Uploaded Content',
        topicRelevance: confidence
      });
    }
  } catch (error) {
    console.log("Resource gathering skipped:", (error as Error).message);
  }
  
  // Add placeholder resources if no content available
  if (resources.length === 0) {
    for (const topic of topics.slice(0, 2)) {
      resources.push({
        type: 'content',
        title: `${topic} Review Guide`,
        description: `Comprehensive review of ${topic} concepts and applications`,
        source: 'Study Template',
        topicRelevance: 0.8
      });
    }
  }
  
  return resources.slice(0, 10); // Limit resources per section
}

// Organize topics into priority matrix
function organizePriorityMatrix(highImpactTopics: any[]): {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
} {
  const matrix = {
    critical: [] as string[],
    high: [] as string[],
    medium: [] as string[],
    low: [] as string[]
  };
  
  for (const topic of highImpactTopics) {
    matrix[topic.priority as keyof typeof matrix].push(topic.topicName);
  }
  
  return matrix;
}

// Determine which topics are free vs premium for business model
function determineCustomizationTiers(highImpactTopics: any[], clusters: any[]): {
  freeAnalysisTopics: string[];
  premiumTopics: string[];
} {
  // Free tier: Top 2 highest impact topics (the "gaps")
  const freeTopics = highImpactTopics
    .slice(0, 2)
    .map(t => t.topicName);
  
  // Premium tier: All other high-impact topics and complete clusters
  const premiumTopics = highImpactTopics
    .slice(2)
    .map(t => t.topicName);
  
  return {
    freeAnalysisTopics: freeTopics,
    premiumTopics
  };
}

// Generate study guide for specific assessment gaps
export async function generatePersonalizedStudyGuide(weakTopics: string[]): Promise<{
  template: StudyGuideTemplate;
  personalizedSections: StudyGuideSection[];
  freePreview: {
    topGaps: string[];
    quickWins: string[];
    estimatedImprovementTime: number;
  };
  premiumUpgrade: {
    additionalTopics: string[];
    completeBlueprint: boolean;
    estimatedTotalTime: number;
  };
}> {
  
  const template = await buildStudyGuideTemplate();
  
  // Create personalized sections focusing on weak topics
  const personalizedSections: StudyGuideSection[] = [];
  
  for (const section of template.sections) {
    const relevantTopics = section.topics.filter(topic => 
      weakTopics.some(weak => 
        weak.toLowerCase().includes(topic.toLowerCase()) ||
        topic.toLowerCase().includes(weak.toLowerCase())
      )
    );
    
    if (relevantTopics.length > 0) {
      // Customize section for this student's needs
      const personalizedSection: StudyGuideSection = {
        ...section,
        topics: relevantTopics,
        title: `${section.title} - Your Focus Areas`,
        estimatedStudyTime: Math.round(section.estimatedStudyTime * (relevantTopics.length / section.topics.length))
      };
      personalizedSections.push(personalizedSection);
    }
  }
  
  // Free preview: show top 2 gaps
  const freePreview = {
    topGaps: template.customization.freeAnalysisTopics,
    quickWins: personalizedSections.slice(0, 1).flatMap(s => s.keyAreas.slice(0, 3)),
    estimatedImprovementTime: 60 // 1 hour promise
  };
  
  // Premium upgrade details
  const premiumUpgrade = {
    additionalTopics: template.customization.premiumTopics,
    completeBlueprint: true,
    estimatedTotalTime: template.totalEstimatedTime
  };
  
  return {
    template,
    personalizedSections,
    freePreview,
    premiumUpgrade
  };
}