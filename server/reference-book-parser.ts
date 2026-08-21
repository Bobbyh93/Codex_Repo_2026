// Reference Book Content Parser - Extract and map content to review topics
import { db } from "./db";
import { reviewTopics } from "@shared/simplified-schema";
import { eq } from "drizzle-orm";

interface BookSection {
  title: string;
  content: string;
  pageRange: string;
  topics: string[];
  nclexCategories: string[];
  difficulty: string;
  keywordMatches: string[];
}

interface ContentMapping {
  topicName: string;
  relevantSections: BookSection[];
  confidence: number;
  contentType: 'reference' | 'procedure' | 'assessment' | 'concept';
}

interface BookParsingResult {
  sectionsFound: number;
  topicsMapped: number;
  contentMappings: ContentMapping[];
  unmappedSections: BookSection[];
  processingNotes: string[];
}

// Main function to parse reference book and map to topics
export async function parseReferenceBook(bookText: string, bookTitle: string = "Nursing Reference"): Promise<BookParsingResult> {
  const sections = extractBookSections(bookText);
  const existingTopics = await getExistingTopics();
  
  const result: BookParsingResult = {
    sectionsFound: sections.length,
    topicsMapped: 0,
    contentMappings: [],
    unmappedSections: [],
    processingNotes: []
  };

  result.processingNotes.push(`Found ${sections.length} sections in ${bookTitle}`);

  // Map each section to relevant topics
  for (const section of sections) {
    const mappings = findTopicMappings(section, existingTopics);
    
    if (mappings.length > 0) {
      result.contentMappings.push(...mappings);
      result.topicsMapped += mappings.length;
      
      // Store content mappings in database
      for (const mapping of mappings) {
        await storeContentMapping(mapping, section, bookTitle);
      }
    } else {
      result.unmappedSections.push(section);
    }
  }

  result.processingNotes.push(`Mapped content to ${result.topicsMapped} topics`);
  result.processingNotes.push(`${result.unmappedSections.length} sections could not be mapped`);

  return result;
}

// Extract sections from the reference book
function extractBookSections(bookText: string): BookSection[] {
  const sections: BookSection[] = [];
  const lines = bookText.split('\n');
  
  let currentSection: Partial<BookSection> = {};
  let contentBuffer: string[] = [];
  let inTableOfContents = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip copyright and legal text
    if (line.includes('©') || line.includes('copyright') || line.includes('LLC') || 
        line.includes('illegal') || line.includes('prohibited')) {
      continue;
    }
    
    // Detect table of contents
    if (line.includes('TABLE OF CONTENTS')) {
      inTableOfContents = true;
      continue;
    }
    
    // End of table of contents
    if (inTableOfContents && line.length > 50) {
      inTableOfContents = false;
    }
    
    // Skip table of contents lines
    if (inTableOfContents) {
      continue;
    }
    
    // Detect major section headers
    if (isMajorSectionHeader(line)) {
      // Save previous section if it has content
      if (currentSection.title && contentBuffer.length > 5) {
        sections.push(createSection(currentSection, contentBuffer));
      }
      
      // Start new section
      currentSection = {
        title: cleanSectionTitle(line),
        pageRange: extractPageRange(line)
      };
      contentBuffer = [];
    }
    
    // Detect subsection headers
    else if (isSubsectionHeader(line)) {
      // Save previous subsection as separate section
      if (currentSection.title && contentBuffer.length > 3) {
        sections.push(createSection(currentSection, contentBuffer));
        contentBuffer = [];
      }
      
      // Update current section title to include subsection
      if (currentSection.title) {
        currentSection.title = `${currentSection.title} - ${cleanSectionTitle(line)}`;
      } else {
        currentSection.title = cleanSectionTitle(line);
      }
    }
    
    // Collect content
    else if (line.length > 3 && !isPageNumber(line) && !isHeaderFooter(line)) {
      contentBuffer.push(line);
    }
  }
  
  // Add final section
  if (currentSection.title && contentBuffer.length > 5) {
    sections.push(createSection(currentSection, contentBuffer));
  }
  
  return sections.filter(section => section.content.length > 100); // Filter out very short sections
}

// Check if line is a major section header
function isMajorSectionHeader(line: string): boolean {
  const majorHeaders = [
    'head-to-toe assessment',
    'dosage calculation',
    'lab value',
    'electrolyte imbalances',
    'fundamentals',
    'mental health',
    'mother baby',
    'pediatrics',
    'med-surg',
    'renal',
    'cardiac',
    'endocrine',
    'respiratory',
    'hematology',
    'gastrointestinal',
    'neurological',
    'critical care',
    'burns',
    'shock',
    'abgs',
    'musculoskeletal',
    'pharmacology'
  ];
  
  const lowerLine = line.toLowerCase();
  return majorHeaders.some(header => lowerLine.includes(header)) &&
         (line.length < 50 || line.includes('ASSESSMENT') || line.includes('SYSTEM'));
}

// Check if line is a subsection header
function isSubsectionHeader(line: string): boolean {
  return (line.length < 80 &&
          (line.includes(':') ||
           line.match(/^[A-Z\s]+$/) !== null ||
           (line.split(' ').length < 8 && line.charAt(0) === line.charAt(0).toUpperCase())));
}

// Check if line is a page number
function isPageNumber(line: string): boolean {
  return /^\d+$/.test(line) || line.includes('© 2021');
}

// Check if line is header/footer
function isHeaderFooter(line: string): boolean {
  return line.includes('NurseInTheMaking') || 
         line.includes('www.') ||
         line.includes('@') ||
         line.length < 3;
}

// Clean section title
function cleanSectionTitle(line: string): string {
  return line.replace(/[.]{2,}/g, '')
             .replace(/\s+/g, ' ')
             .replace(/^\d+/, '')
             .trim();
}

// Extract page range from line
function extractPageRange(line: string): string {
  const match = line.match(/(\d+)(?:[-–](\d+))?/);
  return match ? (match[2] ? `${match[1]}-${match[2]}` : match[1]) : '';
}

// Create section object
function createSection(sectionData: Partial<BookSection>, contentBuffer: string[]): BookSection {
  const content = contentBuffer.join('\n');
  const topics = extractTopicsFromContent(content);
  const nclexCategories = identifyNclexCategories(sectionData.title || '', content);
  
  return {
    title: sectionData.title || 'Untitled Section',
    content,
    pageRange: sectionData.pageRange || '',
    topics,
    nclexCategories,
    difficulty: assessDifficulty(content),
    keywordMatches: extractKeywords(content)
  };
}

// Extract potential topics from content
function extractTopicsFromContent(content: string): string[] {
  const topics: string[] = [];
  
  // Look for assessment-related topics
  const assessmentTerms = ['assessment', 'inspection', 'palpation', 'percussion', 'auscultation'];
  assessmentTerms.forEach(term => {
    if (content.toLowerCase().includes(term)) {
      topics.push(`${term.charAt(0).toUpperCase() + term.slice(1)} Skills`);
    }
  });
  
  // Look for procedure-related topics
  const procedureMatches = content.match(/✸\s*([^✸\n]+)/g);
  if (procedureMatches) {
    procedureMatches.slice(0, 5).forEach(match => {
      const procedure = match.replace('✸', '').trim();
      if (procedure.length > 5 && procedure.length < 80) {
        topics.push(procedure);
      }
    });
  }
  
  // Look for medication/treatment topics
  const medTopics = ['medication', 'drug', 'therapy', 'treatment', 'intervention'];
  medTopics.forEach(topic => {
    if (content.toLowerCase().includes(topic)) {
      topics.push(`${topic.charAt(0).toUpperCase() + topic.slice(1)} Administration`);
    }
  });
  
  return topics.slice(0, 10); // Limit to 10 topics per section
}

// Identify NCLEX categories
function identifyNclexCategories(title: string, content: string): string[] {
  const categories: string[] = [];
  const text = (title + ' ' + content).toLowerCase();
  
  const categoryKeywords = {
    'Management of Care': ['delegation', 'supervision', 'care coordination', 'collaboration'],
    'Safety and Infection Control': ['safety', 'infection', 'precautions', 'sterile', 'asepsis'],
    'Health Promotion and Maintenance': ['prevention', 'health education', 'screening', 'wellness'],
    'Psychosocial Integrity': ['mental health', 'anxiety', 'depression', 'coping', 'grief'],
    'Basic Care and Comfort': ['comfort', 'hygiene', 'nutrition', 'elimination', 'mobility'],
    'Pharmacological and Parenteral Therapies': ['medication', 'drug', 'pharmacology', 'dosage'],
    'Reduction of Risk Potential': ['risk', 'complication', 'monitoring', 'assessment'],
    'Physiological Adaptation': ['adaptation', 'pathophysiology', 'disorder', 'disease'],
    'Clinical Judgment': ['assessment', 'analysis', 'planning', 'evaluation', 'critical thinking']
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      categories.push(category);
    }
  }
  
  return categories.length > 0 ? categories : ['Basic Care and Comfort']; // Default category
}

// Assess content difficulty
function assessDifficulty(content: string): string {
  const advancedTerms = ['pathophysiology', 'critical care', 'emergency', 'complex', 'advanced'];
  const intermediateTerms = ['assessment', 'medication', 'procedure', 'intervention'];
  
  const text = content.toLowerCase();
  
  if (advancedTerms.some(term => text.includes(term))) return 'Advanced';
  if (intermediateTerms.some(term => text.includes(term))) return 'Intermediate';
  return 'Basic';
}

// Extract keywords
function extractKeywords(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const commonWords = new Set(['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other']);
  
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    if (!commonWords.has(word)) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
  });
  
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// Get existing topics from database
async function getExistingTopics(): Promise<any[]> {
  try {
    return await db.select({
      id: reviewTopics.id,
      name: reviewTopics.name,
      description: reviewTopics.description,
      nclexCategory: reviewTopics.nclexCategory,
      keywords: reviewTopics.keywords
    })
    .from(reviewTopics)
    .where(eq(reviewTopics.isActive, true));
  } catch (error) {
    console.error('Error fetching existing topics:', error);
    return [];
  }
}

// Find topic mappings for a section
function findTopicMappings(section: BookSection, existingTopics: any[]): ContentMapping[] {
  const mappings: ContentMapping[] = [];
  
  for (const topic of existingTopics) {
    const confidence = calculateMappingConfidence(section, topic);
    
    if (confidence > 0.3) { // Threshold for mapping
      mappings.push({
        topicName: topic.name,
        relevantSections: [section],
        confidence,
        contentType: determineContentType(section)
      });
    }
  }
  
  return mappings.sort((a, b) => b.confidence - a.confidence);
}

// Calculate mapping confidence between section and topic
function calculateMappingConfidence(section: BookSection, topic: any): number {
  let confidence = 0;
  
  const sectionText = (section.title + ' ' + section.content).toLowerCase();
  const topicName = topic.name.toLowerCase();
  const topicKeywords = topic.keywords ? JSON.parse(topic.keywords) : [];
  
  // Exact title match
  if (sectionText.includes(topicName)) {
    confidence += 0.8;
  }
  
  // Keyword matching
  const keywordMatches = topicKeywords.filter((keyword: string) => 
    sectionText.includes(keyword.toLowerCase())
  );
  confidence += (keywordMatches.length / Math.max(topicKeywords.length, 1)) * 0.4;
  
  // NCLEX category matching
  if (section.nclexCategories.includes(topic.nclexCategory)) {
    confidence += 0.3;
  }
  
  // Content similarity
  const commonWords = findCommonWords(sectionText, topicName);
  confidence += Math.min(commonWords.length * 0.1, 0.2);
  
  return Math.min(confidence, 1.0);
}

// Find common words between texts
function findCommonWords(text1: string, text2: string): string[] {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
  
  return Array.from(words1).filter(word => words2.has(word));
}

// Determine content type
function determineContentType(section: BookSection): 'reference' | 'procedure' | 'assessment' | 'concept' {
  const title = section.title.toLowerCase();
  const content = section.content.toLowerCase();
  
  if (title.includes('assessment') || content.includes('inspect') || content.includes('auscultate')) {
    return 'assessment';
  }
  if (content.includes('procedure') || content.includes('steps') || content.includes('✸')) {
    return 'procedure';
  }
  if (title.includes('concept') || content.includes('definition') || content.includes('theory')) {
    return 'concept';
  }
  
  return 'reference';
}

// Store content mapping in database
async function storeContentMapping(mapping: ContentMapping, section: BookSection, bookTitle: string): Promise<void> {
  try {
    // Simple tracking of content mapping
    const { trackSimpleTopicReview } = await import('./simple-topic-tracker');
    await trackSimpleTopicReview(mapping.topicName, 'reference_book');
    
    console.log(`Mapped "${section.title}" to topic "${mapping.topicName}" (confidence: ${(mapping.confidence * 100).toFixed(1)}%)`);
  } catch (error) {
    console.error('Error storing content mapping:', error);
  }
}

// Get statistics about reference book parsing
export async function getReferenceBookStats(): Promise<{
  totalSectionsParsed: number;
  totalTopicsMapped: number;
  topContentTypes: { type: string; count: number }[];
  recentMappings: number;
}> {
  try {
    // This would ideally come from a content_mappings table
    // For now, return basic stats
    return {
      totalSectionsParsed: 0,
      totalTopicsMapped: 0,
      topContentTypes: [
        { type: 'reference', count: 0 },
        { type: 'procedure', count: 0 },
        { type: 'assessment', count: 0 },
        { type: 'concept', count: 0 }
      ],
      recentMappings: 0
    };
  } catch (error) {
    console.error('Error getting reference book stats:', error);
    return {
      totalSectionsParsed: 0,
      totalTopicsMapped: 0,
      topContentTypes: [],
      recentMappings: 0
    };
  }
}