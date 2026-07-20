// ATI Assessment Topic Extractor - Parse and add new unique topics to database
import { db } from "./db";
import { reviewTopics } from "@shared/simplified-schema";
import { sql, eq } from "drizzle-orm";

interface ExtractedTopic {
  name: string;
  bodySystem?: string;
  diagnosis?: string;
  setting?: string;
  population?: string;
  nclexCategory: string;
  description: string;
  source: string;
  confidence: number;
}

interface TopicExtractionResult {
  newTopicsAdded: ExtractedTopic[];
  existingTopicsFound: string[];
  totalExtracted: number;
  processingNotes: string[];
}

// Extract topics from ATI assessment report text
export async function extractAndAddATITopics(reportText: string, reportId?: string): Promise<TopicExtractionResult> {
  const extractedTopics = parseATITopicsFromText(reportText);
  const result: TopicExtractionResult = {
    newTopicsAdded: [],
    existingTopicsFound: [],
    totalExtracted: extractedTopics.length,
    processingNotes: []
  };

  // Get existing topics from database
  const existingTopicsResult = await db.select({ name: reviewTopics.name })
    .from(reviewTopics)
    .where(eq(reviewTopics.isActive, true));
  const existingTopics = new Set(existingTopicsResult.map(row => row.name.toLowerCase()));

  for (const topic of extractedTopics) {
    try {
      // Check if topic already exists (case-insensitive)
      if (existingTopics.has(topic.name.toLowerCase())) {
        result.existingTopicsFound.push(topic.name);
        
        // Track that this existing topic was identified for review
        await trackExistingTopicReview(topic.name, reportId);
        continue;
      }

      // Add new unique topic to database
      await addNewReviewTopic(topic);
      result.newTopicsAdded.push(topic);
      result.processingNotes.push(`Added new topic: ${topic.name}`);
      
      // Track the new topic review
      await trackNewTopicReview(topic.name, reportId);
      
    } catch (error) {
      result.processingNotes.push(`Error processing topic ${topic.name}: ${error.message}`);
    }
  }

  return result;
}

// Parse topics from ATI report text
function parseATITopicsFromText(text: string): ExtractedTopic[] {
  const topics: ExtractedTopic[] = [];
  const lines = text.split('\n');
  
  let currentNclexCategory = '';
  let currentSubcategory = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and headers
    if (!line || line.includes('Topics To Review') || line.includes('Page ') || line.includes('Report Created')) {
      continue;
    }
    
    // Identify NCLEX categories (main sections)
    if (isNclexCategory(line)) {
      currentNclexCategory = cleanCategoryName(line);
      continue;
    }
    
    // Identify subcategories
    if (isSubcategory(line)) {
      currentSubcategory = cleanSubcategoryName(line);
      continue;
    }
    
    // Extract specific topics (usually have "Active Learning Template" or specific content)
    if (isSpecificTopic(line)) {
      const topicName = extractTopicName(line);
      if (topicName && topicName.length > 5) { // Filter out very short names
        const details = extractTopicDetails(topicName);
        const topic: ExtractedTopic = {
          name: topicName,
          bodySystem: details.bodySystem,
          diagnosis: details.diagnosis,
          setting: details.setting,
          population: details.population,
          nclexCategory: currentNclexCategory,
          description: generatePracticalDescription(topicName, details),
          source: 'ATI Assessment Report',
          confidence: calculateTopicConfidence(line, topicName)
        };
        topics.push(topic);
      }
    }
  }
  
  return deduplicateTopics(topics);
}

// Check if line represents an NCLEX category
function isNclexCategory(line: string): boolean {
  const nclexCategories = [
    'Management of Care',
    'Safety and Infection Control', 
    'Health Promotion and Maintenance',
    'Psychosocial Integrity',
    'Basic Care and Comfort',
    'Pharmacological and Parenteral Therapies',
    'Reduction of Risk Potential',
    'Physiological Adaptation',
    'Clinical Judgment'
  ];
  
  return nclexCategories.some(category => 
    line.toLowerCase().includes(category.toLowerCase()) && 
    (line.includes('(') && line.includes('item'))
  );
}

// Check if line represents a subcategory
function isSubcategory(line: string): boolean {
  return line.includes('(') && line.includes('item') && 
         !isNclexCategory(line) && 
         !line.includes('Active Learning Template');
}

// Check if line represents a specific topic
function isSpecificTopic(line: string): boolean {
  return line.includes('Active Learning Template') || 
         (line.length > 20 && !line.includes('(') && !line.includes('item'));
}

// Clean category name
function cleanCategoryName(line: string): string {
  return line.replace(/\(\d+\s+items?\)/, '').trim();
}

// Clean subcategory name  
function cleanSubcategoryName(line: string): string {
  return line.replace(/\(\d+\s+items?\)/, '').trim();
}

// Extract topic name from line and identify key components
function extractTopicName(line: string): string {
  // Remove Active Learning Template parts
  let name = line.replace(/\(Active Learning Template[^)]*\)/, '').trim();
  
  // Clean up common patterns
  name = name.replace(/^[•\-\s]+/, ''); // Remove bullets/dashes
  name = name.replace(/\s+/g, ' '); // Normalize spaces
  
  return name;
}

// Extract practical details from topic name
function extractTopicDetails(topicName: string): {
  bodySystem?: string;
  diagnosis?: string;
  setting?: string;
  population?: string;
} {
  const details: any = {};
  const lowerName = topicName.toLowerCase();
  
  // Body systems
  const bodySystems = [
    'respiratory', 'cardiac', 'cardiovascular', 'gastrointestinal', 'renal', 'urinary',
    'neurological', 'musculoskeletal', 'integumentary', 'endocrine', 'reproductive',
    'immune', 'hematologic', 'sensory'
  ];
  
  bodySystems.forEach(system => {
    if (lowerName.includes(system)) {
      details.bodySystem = system.charAt(0).toUpperCase() + system.slice(1);
    }
  });
  
  // Common diagnoses/disorders
  const diagnoses = [
    'diabetes', 'hypertension', 'pneumonia', 'copd', 'asthma', 'heart failure',
    'stroke', 'seizure', 'depression', 'anxiety', 'infection', 'sepsis',
    'cancer', 'fracture', 'burn', 'wound', 'dehydration', 'fever',
    'hemophilia', 'pertussis', 'rsv', 'adhd', 'cerebral palsy', 'cystic fibrosis',
    'nephrotic syndrome', 'pyloric stenosis', 'reflux', 'arthritis'
  ];
  
  diagnoses.forEach(diagnosis => {
    if (lowerName.includes(diagnosis)) {
      details.diagnosis = diagnosis.charAt(0).toUpperCase() + diagnosis.slice(1);
    }
  });
  
  // Care settings
  const settings = [
    'home care', 'discharge', 'emergency', 'icu', 'outpatient', 'inpatient',
    'school', 'community', 'long-term care', 'acute care'
  ];
  
  settings.forEach(setting => {
    if (lowerName.includes(setting.toLowerCase())) {
      details.setting = setting;
    }
  });
  
  // Population groups
  const populations = [
    'infant', 'toddler', 'child', 'adolescent', 'adult', 'elderly',
    'pediatric', 'geriatric', 'maternal', 'newborn', 'school-age'
  ];
  
  populations.forEach(population => {
    if (lowerName.includes(population)) {
      details.population = population.charAt(0).toUpperCase() + population.slice(1);
    }
  });
  
  return details;
}

// Generate practical description focused on student needs
function generatePracticalDescription(topicName: string, details: any): string {
  let description = topicName;
  
  // Add practical context
  const contextParts = [];
  if (details.population) contextParts.push(`${details.population} population`);
  if (details.diagnosis) contextParts.push(`${details.diagnosis} condition`);
  if (details.bodySystem) contextParts.push(`${details.bodySystem} system`);
  if (details.setting) contextParts.push(`${details.setting} setting`);
  
  if (contextParts.length > 0) {
    description += ` - Focus: ${contextParts.join(', ')}`;
  }
  
  return description;
}

// Calculate confidence score
function calculateTopicConfidence(line: string, topicName: string): number {
  let confidence = 0.7; // Base confidence
  
  if (line.includes('Active Learning Template')) confidence += 0.2;
  if (topicName.length > 30) confidence += 0.1; // More specific topics
  if (line.includes('System Disorder')) confidence += 0.1;
  if (line.includes('Nursing Skill')) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

// Remove duplicate topics
function deduplicateTopics(topics: ExtractedTopic[]): ExtractedTopic[] {
  const seen = new Set<string>();
  return topics.filter(topic => {
    const key = topic.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Add new topic to review_topics table
async function addNewReviewTopic(topic: ExtractedTopic): Promise<void> {
  // Map to standard difficulty and time estimates
  const difficulty = mapToStandardDifficulty(topic.nclexCategory);
  const estimatedTime = estimateStudyTime(topic.name, difficulty);
  const keywords = generatePracticalKeywords(topic);
  
  await db.insert(reviewTopics).values({
    name: topic.name,
    description: topic.description,
    nclexCategory: topic.nclexCategory,
    nclexSubcategory: topic.diagnosis || null,
    bodySystem: topic.bodySystem || null,
    nursingSpecialty: determineNursingSpecialty(topic),
    difficulty,
    estimatedStudyTime: estimatedTime,
    keywords: JSON.stringify(keywords),
    isActive: true,
    createdAt: new Date()
  });
}

// Map NCLEX category to difficulty
function mapToStandardDifficulty(nclexCategory: string): string {
  const difficultyMap = {
    'Clinical Judgment': 'Advanced',
    'Physiological Adaptation': 'Advanced', 
    'Pharmacological and Parenteral Therapies': 'Intermediate',
    'Reduction of Risk Potential': 'Intermediate',
    'Management of Care': 'Intermediate',
    'Safety and Infection Control': 'Basic',
    'Basic Care and Comfort': 'Basic',
    'Health Promotion and Maintenance': 'Basic',
    'Psychosocial Integrity': 'Intermediate'
  };
  
  return difficultyMap[nclexCategory] || 'Intermediate';
}

// Estimate study time
function estimateStudyTime(topicName: string, difficulty: string): number {
  const baseTime = {
    'Basic': 30,
    'Intermediate': 45,
    'Advanced': 60
  };
  
  let time = baseTime[difficulty] || 45;
  
  // Adjust for topic complexity
  if (topicName.includes('Management') || topicName.includes('Care Plan')) time += 15;
  if (topicName.includes('Emergency') || topicName.includes('Critical')) time += 15;
  if (topicName.includes('Teaching') || topicName.includes('Education')) time += 10;
  
  return Math.min(time, 90); // Cap at 90 minutes
}

// Generate practical keywords focused on student needs
function generatePracticalKeywords(topic: ExtractedTopic): string[] {
  const keywords: string[] = [];
  
  // Core topic words
  const topicWords = topic.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  keywords.push(...topicWords);
  
  // Add practical components
  if (topic.bodySystem) keywords.push(topic.bodySystem.toLowerCase());
  if (topic.diagnosis) keywords.push(topic.diagnosis.toLowerCase());
  if (topic.setting) keywords.push(...topic.setting.toLowerCase().split(/\s+/));
  if (topic.population) keywords.push(topic.population.toLowerCase());
  
  // Add action-oriented keywords
  const actionKeywords = [];
  if (topic.name.toLowerCase().includes('assessment')) actionKeywords.push('assess', 'evaluate', 'monitor');
  if (topic.name.toLowerCase().includes('teaching')) actionKeywords.push('teach', 'educate', 'instruct');
  if (topic.name.toLowerCase().includes('care')) actionKeywords.push('care', 'manage', 'treat');
  if (topic.name.toLowerCase().includes('intervention')) actionKeywords.push('intervene', 'act', 'respond');
  if (topic.name.toLowerCase().includes('administration')) actionKeywords.push('administer', 'give', 'provide');
  
  keywords.push(...actionKeywords);
  
  // Remove duplicates and limit to 8 most relevant
  return [...new Set(keywords)].slice(0, 8);
}

// Determine nursing specialty based on topic details
function determineNursingSpecialty(topic: ExtractedTopic): string {
  if (topic.population) {
    if (['infant', 'toddler', 'child', 'adolescent', 'pediatric', 'school-age'].includes(topic.population.toLowerCase())) {
      return 'Pediatric';
    }
    if (['elderly', 'geriatric'].includes(topic.population.toLowerCase())) {
      return 'Geriatric';
    }
    if (['maternal', 'newborn'].includes(topic.population.toLowerCase())) {
      return 'Maternal-Child';
    }
  }
  
  if (topic.bodySystem) {
    if (['cardiac', 'cardiovascular'].includes(topic.bodySystem.toLowerCase())) {
      return 'Cardiac';
    }
    if (['respiratory'].includes(topic.bodySystem.toLowerCase())) {
      return 'Respiratory';
    }
    if (['neurological'].includes(topic.bodySystem.toLowerCase())) {
      return 'Neurological';
    }
  }
  
  if (topic.nclexCategory === 'Psychosocial Integrity') {
    return 'Mental Health';
  }
  
  return 'Medical-Surgical'; // Default
}

// Track existing topic review
async function trackExistingTopicReview(topicName: string, reportId?: string): Promise<void> {
  try {
    const { trackSimpleTopicReview } = await import('./simple-topic-tracker');
    await trackSimpleTopicReview(topicName, 'ati_assessment');
  } catch (error) {
    console.log('Topic tracking skipped:', error.message);
  }
}

// Track new topic review
async function trackNewTopicReview(topicName: string, reportId?: string): Promise<void> {
  try {
    const { trackSimpleTopicReview } = await import('./simple-topic-tracker');
    await trackSimpleTopicReview(topicName, 'ati_assessment');
  } catch (error) {
    console.log('New topic tracking skipped:', error.message);
  }
}

// Get statistics about topic extraction
export async function getTopicExtractionStats(): Promise<{
  totalReviewTopics: number;
  recentlyAdded: number;
  topSources: { source: string; count: number }[];
}> {
  try {
    const [totalResult, recentResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(reviewTopics)
        .where(eq(reviewTopics.isActive, true)),
      db.select({ count: sql<number>`count(*)` })
        .from(reviewTopics)
        .where(sql`created_at > NOW() - INTERVAL '7 days'`)
    ]);
    
    return {
      totalReviewTopics: totalResult[0]?.count || 0,
      recentlyAdded: recentResult[0]?.count || 0,
      topSources: [
        { source: 'ATI Assessment Reports', count: recentResult[0]?.count || 0 },
        { source: 'Manual Entry', count: 0 },
        { source: 'Content Analysis', count: 0 }
      ]
    };
  } catch (error) {
    console.error('Error getting extraction stats:', error);
    return {
      totalReviewTopics: 0,
      recentlyAdded: 0,
      topSources: []
    };
  }
}