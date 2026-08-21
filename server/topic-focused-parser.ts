// Topic-focused content parser that extracts and maps content to review topics
const pdfParse = async (buffer: Buffer) => {
  const pdfParseModule = await import("pdf-parse");
  return pdfParseModule.default(buffer);
};

// Review topic keyword mappings based on the 9 core topics
const REVIEW_TOPIC_KEYWORDS = {
  "Basic Care and Comfort": [
    "hygiene", "elimination", "comfort", "adl", "nutrition", "feeding", "bathing", 
    "positioning", "mobility", "rest", "sleep", "pain management", "personal care",
    "bowel", "bladder", "catheter", "bedpan", "oral care", "skin care"
  ],
  "Clinical Decision Making": [
    "clinical judgment", "critical thinking", "decision making", "priorities", 
    "management", "delegation", "nursing process", "assessment", "planning",
    "implementation", "evaluation", "collaboration", "leadership", "supervision"
  ],
  "Health Promotion and Maintenance": [
    "health promotion", "prevention", "education", "wellness", "screening",
    "immunization", "health teaching", "lifestyle", "preventive care",
    "developmental", "growth", "maintenance", "health behaviors"
  ],
  "Infection Control and Safety": [
    "infection control", "safety", "hazardous materials", "ppe", "prevention",
    "sterile", "aseptic", "isolation", "precautions", "handwashing", "gloves",
    "mask", "contamination", "sterilization", "disinfection"
  ],
  "Medication Administration and Safety": [
    "medication", "adverse effects", "contraindications", "pharmacology", "safety",
    "dosage", "calculation", "administration", "side effects", "drug", "therapeutic",
    "toxic", "allergy", "interaction", "compliance", "monitoring"
  ],
  "Mental Health and Coping": [
    "mental health", "coping", "stress", "psychological", "wellness", "anxiety",
    "depression", "therapeutic communication", "suicide", "crisis", "support",
    "behavioral", "psychiatric", "mood", "therapy"
  ],
  "Pathophysiology and Disease Management": [
    "pathophysiology", "disease", "alterations", "body systems", "adaptation",
    "dysfunction", "etiology", "manifestations", "complications", "prognosis",
    "acute", "chronic", "exacerbation", "remission"
  ],
  "Patient Assessment and Monitoring": [
    "assessment", "physical exam", "monitoring", "vital signs", "systems",
    "inspection", "palpation", "percussion", "auscultation", "observation",
    "documentation", "baseline", "trending", "abnormal findings"
  ],
  "Patient Rights and Advocacy": [
    "patient rights", "advocacy", "ethics", "consent", "legal", "confidentiality",
    "privacy", "autonomy", "dignity", "informed consent", "advance directives",
    "cultural", "diversity", "respect", "self-determination"
  ]
};

interface TopicExtractionResult {
  topicId?: string;
  topicName: string;
  confidence: number;
  extractedContent: string;
  keywordMatches: string[];
  isRelevant: boolean;
}

interface ParsedTopicContent {
  reviewTopics: TopicExtractionResult[];
  rawText: string;
  totalRelevantSections: number;
  processingMetadata: {
    totalSections: number;
    topicMappings: { [topicName: string]: number };
    confidence: number;
  };
}

// Extract content sections that relate to specific review topics
export async function parseContentForReviewTopics(buffer: Buffer): Promise<ParsedTopicContent> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text content found in document");
    }

    // Split content into sections for analysis
    const sections = splitIntoMeaningfulSections(text);
    const topicExtractions: TopicExtractionResult[] = [];
    const topicMappings: { [topicName: string]: number } = {};
    
    // Analyze each section for topic relevance
    for (const section of sections) {
      const extraction = analyzeContentForReviewTopics(section);
      if (extraction.isRelevant) {
        topicExtractions.push(extraction);
        topicMappings[extraction.topicName] = (topicMappings[extraction.topicName] || 0) + 1;
      }
    }

    // Calculate overall confidence
    const totalSections = sections.length;
    const relevantSections = topicExtractions.length;
    const confidence = relevantSections / Math.max(totalSections, 1);

    return {
      reviewTopics: topicExtractions,
      rawText: text,
      totalRelevantSections: relevantSections,
      processingMetadata: {
        totalSections,
        topicMappings,
        confidence
      }
    };
    
  } catch (error) {
    console.error("Topic-focused parsing error:", error);
    throw new Error(`Failed to parse content for review topics: ${(error as Error).message}`);
  }
}

// Split content into meaningful sections for topic analysis
function splitIntoMeaningfulSections(text: string): string[] {
  // Split by multiple criteria to get meaningful sections
  const sections: string[] = [];
  
  // First, try to split by clear section indicators
  const sectionPatterns = [
    /\n\s*\d+\.\s+/g,  // Numbered sections
    /\n\s*[A-Z][^.]+:\s*/g,  // Topic headers
    /\n\s*[A-Z]{2,}[^a-z]*\n/g,  // ALL CAPS headers
    /\n\s*Question\s*\d+/gi,  // Question numbers
    /\n\s*Topic\s*\d*/gi,  // Topic sections
  ];

  let workingText = text;
  
  // Try each pattern to find sections
  for (const pattern of sectionPatterns) {
    const matches = workingText.split(pattern);
    if (matches.length > 1) {
      sections.push(...matches.filter(s => s.trim().length > 50));
      break;
    }
  }
  
  // If no clear sections found, chunk by paragraphs
  if (sections.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    sections.push(...paragraphs);
  }
  
  // If still no sections, chunk by sentences
  if (sections.length === 0) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= 500) {
        currentChunk += sentence + ' ';
      } else {
        if (currentChunk.trim().length > 50) {
          sections.push(currentChunk.trim());
        }
        currentChunk = sentence + ' ';
      }
    }
    
    if (currentChunk.trim().length > 50) {
      sections.push(currentChunk.trim());
    }
  }
  
  return sections.filter(s => s.trim().length > 50);
}

// Analyze a content section to determine which review topic it relates to
function analyzeContentForReviewTopics(content: string): TopicExtractionResult {
  const lowerContent = content.toLowerCase();
  let bestMatch: TopicExtractionResult = {
    topicName: "Clinical Decision Making", // default
    confidence: 0,
    extractedContent: content,
    keywordMatches: [],
    isRelevant: false
  };

  // Check each review topic for keyword matches
  for (const [topicName, keywords] of Object.entries(REVIEW_TOPIC_KEYWORDS)) {
    const matches: string[] = [];
    let score = 0;
    
    // Count keyword matches with different weights
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
      const keywordMatches = lowerContent.match(regex);
      
      if (keywordMatches) {
        matches.push(keyword);
        // Weight by keyword frequency and importance
        score += keywordMatches.length * getKeywordWeight(keyword);
      }
    }
    
    // Calculate confidence based on matches and content length
    const confidence = Math.min(score / Math.max(content.length / 100, 1), 1);
    
    if (confidence > bestMatch.confidence && matches.length > 0) {
      bestMatch = {
        topicName,
        confidence,
        extractedContent: content,
        keywordMatches: matches,
        isRelevant: confidence > 0.1 // Threshold for relevance
      };
    }
  }

  return bestMatch;
}

// Assign weights to different types of keywords
function getKeywordWeight(keyword: string): number {
  // Higher weight for more specific/important terms
  const highWeight = [
    "medication", "assessment", "safety", "infection control", "pathophysiology",
    "clinical judgment", "patient rights", "mental health"
  ];
  
  const mediumWeight = [
    "nursing process", "vital signs", "hygiene", "comfort", "prevention"
  ];
  
  if (highWeight.some(hw => keyword.includes(hw) || hw.includes(keyword))) {
    return 3;
  } else if (mediumWeight.some(mw => keyword.includes(mw) || mw.includes(keyword))) {
    return 2;
  }
  
  return 1; // Default weight
}

// Generate a clean title from content
export function generateTopicTitle(content: string, topicName: string): string {
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10);
  
  if (sentences.length > 0) {
    let title = sentences[0].trim();
    // Limit title length
    if (title.length > 80) {
      title = title.substring(0, 77) + "...";
    }
    return title;
  }
  
  return `${topicName} Content`;
}

// Generate description from content
export function generateTopicDescription(content: string): string {
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 20);
  
  if (sentences.length >= 2) {
    let description = sentences.slice(0, 2).join('. ') + '.';
    if (description.length > 200) {
      description = description.substring(0, 197) + "...";
    }
    return description;
  }
  
  return content.substring(0, 197) + "...";
}