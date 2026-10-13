// Topic relationship analyzer for identifying high-impact study areas
import { db } from "./db";

// Medical terms and diagnoses that indicate high-impact relationships
const HIGH_IMPACT_KEYWORDS = {
  // Critical body systems
  systems: [
    "cardiac", "cardiovascular", "heart", "respiratory", "lung", "renal", "kidney", 
    "neurological", "brain", "gastrointestinal", "endocrine", "musculoskeletal"
  ],
  
  // Common diagnoses that span multiple topics
  diagnoses: [
    "diabetes", "hypertension", "copd", "pneumonia", "sepsis", "stroke", "mi", "myocardial",
    "heart failure", "chf", "infection", "dehydration", "electrolyte", "pain", "wound",
    "pressure ulcer", "fall", "confusion", "dementia", "depression", "anxiety"
  ],
  
  // Critical interventions
  interventions: [
    "medication", "assessment", "monitoring", "education", "safety", "prevention",
    "documentation", "communication", "collaboration", "delegation"
  ],
  
  // High-risk populations
  populations: [
    "elderly", "pediatric", "infant", "postoperative", "icu", "emergency", "trauma"
  ]
};

interface TopicRelationship {
  topicA: string;
  topicB: string;
  sharedKeywords: string[];
  relationshipType: 'system' | 'diagnosis' | 'intervention' | 'population';
  impactScore: number;
}

interface HighImpactTopic {
  topicName: string;
  impactScore: number;
  relatedTopics: string[];
  sharedConcepts: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  reasonForImpact: string;
}

interface TopicCluster {
  name: string;
  topics: string[];
  sharedConcepts: string[];
  totalImpactScore: number;
  studyPriority: number;
}

// Analyze relationships between review topics based on shared content
export async function analyzeTopicRelationships(): Promise<{
  relationships: TopicRelationship[];
  highImpactTopics: HighImpactTopic[];
  topicClusters: TopicCluster[];
}> {
  
  // Get all review topics
  const reviewTopicsResult = await db.execute(`
    SELECT name, 
           CASE 
             WHEN keywords IS NOT NULL THEN keywords::text 
             ELSE '[]' 
           END as keywords,
           description, 
           nclex_category, 
           body_system
    FROM review_topics 
    WHERE is_active = true 
    ORDER BY name
  `);
  
  const reviewTopics = reviewTopicsResult.rows;
  const relationships: TopicRelationship[] = [];
  const topicImpactScores: { [topic: string]: number } = {};
  
  // Analyze pairwise relationships between topics
  for (let i = 0; i < reviewTopics.length; i++) {
    for (let j = i + 1; j < reviewTopics.length; j++) {
      const topicA = reviewTopics[i];
      const topicB = reviewTopics[j];
      
      const relationship = findTopicRelationship(topicA, topicB);
      if (relationship && relationship.impactScore > 0) {
        relationships.push(relationship);
        
        // Accumulate impact scores
        topicImpactScores[topicA.name as string] = (topicImpactScores[topicA.name as string] || 0) + relationship.impactScore;
        topicImpactScores[topicB.name as string] = (topicImpactScores[topicB.name as string] || 0) + relationship.impactScore;
      }
    }
  }
  
  // Get content-based relationships from actual uploaded content
  const contentRelationships = await analyzeContentBasedRelationships();
  relationships.push(...contentRelationships);
  
  // Calculate high-impact topics
  const highImpactTopics = calculateHighImpactTopics(topicImpactScores, relationships, reviewTopics);
  
  // Create topic clusters
  const topicClusters = createTopicClusters(relationships, highImpactTopics);
  
  return {
    relationships,
    highImpactTopics,
    topicClusters
  };
}

// Find relationship between two topics based on keywords and content
function findTopicRelationship(topicA: any, topicB: any): TopicRelationship | null {
  let keywordsA: string[] = [];
  let keywordsB: string[] = [];
  
  try {
    keywordsA = topicA.keywords ? JSON.parse(topicA.keywords) : [];
  } catch (e) {
    console.log(`Warning: Invalid keywords JSON for topic ${topicA.name}:`, topicA.keywords);
    keywordsA = [];
  }
  
  try {
    keywordsB = topicB.keywords ? JSON.parse(topicB.keywords) : [];
  } catch (e) {
    console.log(`Warning: Invalid keywords JSON for topic ${topicB.name}:`, topicB.keywords);
    keywordsB = [];
  }
  
  const descA = (topicA.description || '').toLowerCase();
  const descB = (topicB.description || '').toLowerCase();
  
  const sharedKeywords: string[] = [];
  let relationshipType: 'system' | 'diagnosis' | 'intervention' | 'population' = 'intervention';
  let impactScore = 0;
  
  // Check for shared high-impact keywords
  for (const [category, keywords] of Object.entries(HIGH_IMPACT_KEYWORDS)) {
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      
      // Check if both topics mention this keyword
      const aHasKeyword = keywordsA.some((k: string) => k.toLowerCase().includes(keywordLower)) ||
                         descA.includes(keywordLower);
      const bHasKeyword = keywordsB.some((k: string) => k.toLowerCase().includes(keywordLower)) ||
                         descB.includes(keywordLower);
      
      if (aHasKeyword && bHasKeyword) {
        sharedKeywords.push(keyword);
        relationshipType = category as any;
        
        // Score based on category importance
        switch (category) {
          case 'diagnoses': impactScore += 3; break;
          case 'systems': impactScore += 2; break;
          case 'interventions': impactScore += 1; break;
          case 'populations': impactScore += 2; break;
        }
      }
    }
  }
  
  // Check for same body system
  if (topicA.body_system && topicB.body_system && topicA.body_system === topicB.body_system) {
    sharedKeywords.push(topicA.body_system);
    impactScore += 2;
    relationshipType = 'system';
  }
  
  // Check for same NCLEX category
  if (topicA.nclex_category && topicB.nclex_category && topicA.nclex_category === topicB.nclex_category) {
    impactScore += 1;
  }
  
  if (sharedKeywords.length === 0) {
    return null;
  }
  
  return {
    topicA: topicA.name,
    topicB: topicB.name,
    sharedKeywords,
    relationshipType,
    impactScore
  };
}

// Analyze relationships based on actual uploaded content
async function analyzeContentBasedRelationships(): Promise<TopicRelationship[]> {
  const relationships: TopicRelationship[] = [];
  
  try {
    // Get content blocks grouped by category (topic)
    const contentResult = await db.execute(`
      SELECT category, COUNT(*) as content_count, 
             GROUP_CONCAT(DISTINCT tags) as all_tags
      FROM content_blocks 
      WHERE category IS NOT NULL
      GROUP BY category
      HAVING content_count > 1
    `);
    
    const contentGroups = contentResult.rows;
    
    // Find content-based relationships
    for (let i = 0; i < contentGroups.length; i++) {
      for (let j = i + 1; j < contentGroups.length; j++) {
        const groupA = contentGroups[i];
        const groupB = contentGroups[j];
        
        const tagsA = groupA.all_tags ? (groupA.all_tags as string).split(',') : [];
        const tagsB = groupB.all_tags ? (groupB.all_tags as string).split(',') : [];

        const sharedTags = tagsA.filter((tag: string) =>
          tagsB.some((t: string) => t.toLowerCase().trim() === tag.toLowerCase().trim())
        );

        if (sharedTags.length >= 2) {
          relationships.push({
            topicA: groupA.category as string,
            topicB: groupB.category as string,
            sharedKeywords: sharedTags.slice(0, 5),
            relationshipType: 'intervention',
            impactScore: Math.min(sharedTags.length, 5)
          });
        }
      }
    }
  } catch (error) {
    console.log("Content-based relationship analysis skipped:", (error as Error).message);
  }
  
  return relationships;
}

// Calculate high-impact topics based on relationships and content
function calculateHighImpactTopics(
  impactScores: { [topic: string]: number },
  relationships: TopicRelationship[],
  reviewTopics: any[]
): HighImpactTopic[] {
  
  const highImpactTopics: HighImpactTopic[] = [];
  
  for (const [topicName, score] of Object.entries(impactScores)) {
    const topicRelationships = relationships.filter(r => 
      r.topicA === topicName || r.topicB === topicName
    );
    
    const relatedTopics = topicRelationships.map(r => 
      r.topicA === topicName ? r.topicB : r.topicA
    );
    
    const sharedConcepts = [...new Set(
      topicRelationships.flatMap(r => r.sharedKeywords)
    )];
    
    let priority: 'critical' | 'high' | 'medium' | 'low';
    let reasonForImpact = '';
    
    if (score >= 8) {
      priority = 'critical';
      reasonForImpact = 'High cross-topic relevance with critical diagnoses/systems';
    } else if (score >= 5) {
      priority = 'high';
      reasonForImpact = 'Multiple topic connections with important concepts';
    } else if (score >= 3) {
      priority = 'medium';
      reasonForImpact = 'Some topic overlap with key nursing concepts';
    } else {
      priority = 'low';
      reasonForImpact = 'Limited cross-topic connections';
    }
    
    highImpactTopics.push({
      topicName,
      impactScore: score,
      relatedTopics,
      sharedConcepts,
      priority,
      reasonForImpact
    });
  }
  
  return highImpactTopics.sort((a, b) => b.impactScore - a.impactScore);
}

// Create topic clusters for study guide organization
function createTopicClusters(
  relationships: TopicRelationship[],
  highImpactTopics: HighImpactTopic[]
): TopicCluster[] {
  
  const clusters: TopicCluster[] = [];
  const processedTopics = new Set<string>();
  
  // Create clusters around highest impact topics
  for (const highImpactTopic of highImpactTopics.slice(0, 4)) { // Top 4 clusters
    if (processedTopics.has(highImpactTopic.topicName)) continue;
    
    const clusterTopics = [highImpactTopic.topicName];
    const clusterConcepts = [...highImpactTopic.sharedConcepts];
    let totalScore = highImpactTopic.impactScore;
    
    // Add related topics to cluster
    for (const relatedTopic of highImpactTopic.relatedTopics) {
      if (!processedTopics.has(relatedTopic)) {
        clusterTopics.push(relatedTopic);
        processedTopics.add(relatedTopic);
        
        const relatedImpact = highImpactTopics.find(t => t.topicName === relatedTopic);
        if (relatedImpact) {
          totalScore += relatedImpact.impactScore * 0.5; // Weighted addition
          clusterConcepts.push(...relatedImpact.sharedConcepts);
        }
      }
    }
    
    processedTopics.add(highImpactTopic.topicName);
    
    // Determine cluster name based on shared concepts
    const clusterName = determineClusterName(clusterConcepts, clusterTopics);
    
    clusters.push({
      name: clusterName,
      topics: clusterTopics,
      sharedConcepts: [...new Set(clusterConcepts)],
      totalImpactScore: totalScore,
      studyPriority: clusters.length + 1
    });
  }
  
  return clusters.sort((a, b) => b.totalImpactScore - a.totalImpactScore);
}

// Determine cluster name based on most frequent shared concepts
function determineClusterName(concepts: string[], topics: string[]): string {
  const conceptCounts: { [concept: string]: number } = {};
  
  for (const concept of concepts) {
    conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
  }
  
  const sortedConcepts = Object.entries(conceptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([concept]) => concept);
  
  if (sortedConcepts.length > 0) {
    const primaryConcept = sortedConcepts[0];
    
    // Create meaningful cluster names
    if (primaryConcept.includes('cardiac') || primaryConcept.includes('heart')) {
      return 'Cardiovascular Care';
    } else if (primaryConcept.includes('medication') || primaryConcept.includes('drug')) {
      return 'Medication Management';
    } else if (primaryConcept.includes('assessment') || primaryConcept.includes('monitor')) {
      return 'Patient Assessment & Monitoring';
    } else if (primaryConcept.includes('safety') || primaryConcept.includes('infection')) {
      return 'Safety & Infection Control';
    } else {
      return `${primaryConcept.charAt(0).toUpperCase() + primaryConcept.slice(1)} Focus Area`;
    }
  }
  
  return `${topics[0]} Cluster`;
}

// Generate study guide priority recommendations
export async function generateStudyGuidePriorities(): Promise<{
  prioritizedClusters: TopicCluster[];
  studySequence: string[];
  focusAreas: { name: string; topics: string[]; rationale: string; }[];
}> {
  
  const analysis = await analyzeTopicRelationships();
  const clusters = analysis.topicClusters;
  
  // Create study sequence based on cluster priorities
  const studySequence: string[] = [];
  const focusAreas: { name: string; topics: string[]; rationale: string; }[] = [];
  
  for (const cluster of clusters) {
    studySequence.push(...cluster.topics);
    
    focusAreas.push({
      name: cluster.name,
      topics: cluster.topics,
      rationale: `High-impact area with ${cluster.sharedConcepts.length} interconnected concepts including: ${cluster.sharedConcepts.slice(0, 3).join(', ')}`
    });
  }
  
  return {
    prioritizedClusters: clusters,
    studySequence: [...new Set(studySequence)], // Remove duplicates
    focusAreas
  };
}