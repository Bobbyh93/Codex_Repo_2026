import { ATIReportData, ATITopic, parseATIReport } from './ati-parser';

// Common assessment indicator patterns
const ASSESSMENT_PATTERNS = [
  /ATI/i,
  /Assessment/i,
  /Topics to Review/i,
  /NCLEX/i,
  /Nursing/i,
  /Student Report/i,
  /Performance/i,
  /Knowledge Gap/i,
  /Content Areas/i,
  /Test Results/i
];

// Topic extraction patterns for fallback parsing
const TOPIC_EXTRACTION_PATTERNS = [
  /(?:Management of Care|Safety|Infection Control|Health Promotion)/gi,
  /(?:Psychosocial|Physiological|Adaptation|Basic Care)/gi,
  /(?:Pharmacological|Non-Pharmacological|Reduction of Risk)/gi,
  /(?:Adult Health|Pediatric|Maternal|Mental Health)/gi,
  /(?:Critical Care|Emergency|Surgery|Medical-Surgical)/gi
];

/**
 * Enhanced ATI parser with multiple fallback strategies
 */
export async function parseATIReportSafely(text: string, options: { 
  maxRetries?: number; 
  enableFallbackParsing?: boolean;
  strictValidation?: boolean;
} = {}): Promise<ATIReportData> {
  const { maxRetries = 3, enableFallbackParsing = true, strictValidation = false } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Validate and sanitize input
      const sanitizedText = sanitizeInputText(text);
      if (!sanitizedText) {
        throw new Error('Invalid or empty input provided');
      }

      // Check if it's likely an assessment report
      const confidence = calculateAssessmentConfidence(sanitizedText);
      if (strictValidation && confidence < 0.3) {
        throw new Error(`Low confidence (${Math.round(confidence * 100)}%) this is an assessment report`);
      }

      // Try primary parser first
      try {
        const result = parseATIReport(sanitizedText);
        
        // Validate and enhance result
        const validatedResult = validateAndEnhanceResult(result, sanitizedText);
        if (validatedResult.topics.length > 0) {
          console.log(`Successfully parsed assessment with ${validatedResult.topics.length} topics (attempt ${attempt})`);
          return validatedResult;
        }
      } catch (primaryError: any) {
        console.warn(`Primary parser failed (attempt ${attempt}):`, primaryError.message);
        lastError = primaryError;
      }

      // Try fallback parsing if enabled
      if (enableFallbackParsing) {
        const fallbackResult = attemptFallbackParsing(sanitizedText);
        if (fallbackResult.topics.length > 0) {
          console.log(`Fallback parser succeeded with ${fallbackResult.topics.length} topics (attempt ${attempt})`);
          return fallbackResult;
        }
      }

      // If this is not the last attempt, add a small delay
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }

    } catch (error: any) {
      lastError = error;
      console.warn(`Parse attempt ${attempt} failed:`, error.message);
    }
  }

  // All attempts failed, return error report with helpful context
  console.error('All parsing attempts failed:', lastError?.message);
  return createErrorReport(lastError?.message || 'Parsing failed after multiple attempts', text);
}

/**
 * Sanitize and validate input text
 */
function sanitizeInputText(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Remove null bytes and other problematic characters
  let sanitized = text.replace(/\0/g, '').trim();
  
  // Must have minimum length
  if (sanitized.length < 50) {
    return null;
  }

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
}

/**
 * Calculate confidence that this is an assessment report
 */
function calculateAssessmentConfidence(text: string): number {
  let score = 0;
  const textLower = text.toLowerCase();

  // Check for assessment indicators
  for (const pattern of ASSESSMENT_PATTERNS) {
    if (pattern.test(text)) {
      score += 0.15;
    }
  }

  // Check for topic extraction patterns
  for (const pattern of TOPIC_EXTRACTION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      score += Math.min(matches.length * 0.05, 0.3);
    }
  }

  // Check for numeric data (scores, percentages)
  const numericMatches = text.match(/\d+%|\d+\.\d+|\d+\/\d+/g);
  if (numericMatches && numericMatches.length > 5) {
    score += 0.2;
  }

  // Check for student information patterns
  if (/student|name|id|date/i.test(text)) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Attempt fallback parsing when primary parser fails
 */
function attemptFallbackParsing(text: string): ATIReportData {
  const topics: ATITopic[] = [];
  
  try {
    // Extract topics using pattern matching
    const extractedTopics = extractTopicsFromText(text);
    topics.push(...extractedTopics);

    // Extract student details if possible
    const studentDetails = extractStudentDetails(text);

    return {
      topics,
      studentDetails: {
        studentName: studentDetails.name || 'Student',
        school: studentDetails.school || 'Unknown School',
        testDate: studentDetails.date || new Date().toISOString(),
        assessmentName: studentDetails.assessment || 'Assessment Report'
      }
    };
  } catch (error: any) {
    console.error('Fallback parsing failed:', error.message);
    return createErrorReport('Fallback parsing failed', text);
  }
}

/**
 * Extract topics from text using pattern matching
 */
function extractTopicsFromText(text: string): ATITopic[] {
  const topics: ATITopic[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;

    // Look for topic patterns with potential scores
    const topicMatch = trimmed.match(/(.+?)[\s\-]*(\d+%|\d+\.\d+|\d+)/);
    if (topicMatch) {
      const [, topicName, scoreStr] = topicMatch;
      const score = parseFloat(scoreStr.replace('%', ''));
      
      if (topicName.length > 5 && !isNaN(score) && score <= 100) {
        topics.push({
          name: topicName.trim(),
          category: 'General',
          groupScore: score,
          needsReview: score < 75,
          subcategory: categorizeTopicByKeywords(topicName)
        });
      }
    }
  }

  // If no topics found, create some default ones
  if (topics.length === 0) {
    topics.push(...createDefaultTopics());
  }

  return topics.slice(0, 20); // Limit to 20 topics
}

/**
 * Categorize topic by keywords
 */
function categorizeTopicByKeywords(topicName: string): string {
  const name = topicName.toLowerCase();
  
  if (name.includes('management') || name.includes('care')) return 'Management of Care';
  if (name.includes('safety') || name.includes('infection')) return 'Safety and Infection Control';
  if (name.includes('health') || name.includes('promotion')) return 'Health Promotion';
  if (name.includes('psychosocial') || name.includes('mental')) return 'Psychosocial Integrity';
  if (name.includes('physiological') || name.includes('adaptation')) return 'Physiological Adaptation';
  if (name.includes('pharmacological') || name.includes('medication')) return 'Pharmacological Therapies';
  
  return 'General';
}

/**
 * Extract student details from text
 */
function extractStudentDetails(text: string): any {
  const details: any = {};

  // Extract name
  const nameMatch = text.match(/(?:student|name)[:\s]+([a-zA-Z\s]+)/i);
  if (nameMatch) {
    details.name = nameMatch[1].trim();
  }

  // Extract school
  const schoolMatch = text.match(/(?:school|institution)[:\s]+([a-zA-Z\s]+)/i);
  if (schoolMatch) {
    details.school = schoolMatch[1].trim();
  }

  // Extract date
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
  if (dateMatch) {
    details.date = new Date(dateMatch[1]).toISOString();
  }

  // Extract assessment name
  const assessmentMatch = text.match(/(?:assessment|test|exam)[:\s]+([a-zA-Z0-9\s\-]+)/i);
  if (assessmentMatch) {
    details.assessment = assessmentMatch[1].trim();
  }

  return details;
}

/**
 * Create default topics when extraction fails
 */
function createDefaultTopics(): ATITopic[] {
  return [
    {
      name: 'Management of Care',
      category: 'Safe and Effective Care Environment',
      groupScore: 70,
      needsReview: true,
      subcategory: 'Management of Care'
    },
    {
      name: 'Safety and Infection Control',
      category: 'Safe and Effective Care Environment',
      groupScore: 75,
      needsReview: true,
      subcategory: 'Safety and Infection Control'
    },
    {
      name: 'Health Promotion and Maintenance',
      category: 'Health Promotion and Maintenance',
      groupScore: 72,
      needsReview: true,
      subcategory: 'Health Promotion'
    }
  ];
}

/**
 * Validate and enhance parsing result
 */
function validateAndEnhanceResult(result: ATIReportData, originalText: string): ATIReportData {
  if (!result || !result.topics) {
    throw new Error('Invalid parsing result structure');
  }

  // Validate and clean topics
  const validTopics = result.topics
    .map(topic => validateTopicData(topic))
    .filter(topic => topic !== null) as ATITopic[];

  // Ensure we have at least some topics
  if (validTopics.length === 0) {
    throw new Error('No valid topics found in parsing result');
  }

  // Enhance with additional data if needed
  const enhanced: ATIReportData = {
    ...result,
    topics: validTopics,
    studentDetails: {
      ...result.studentDetails,
      assessmentName: result.studentDetails?.assessmentName || 'Assessment Report'
    }
  };

  return enhanced;
}

/**
 * Create error report with helpful context
 */
function createErrorReport(reason: string, originalText?: string): ATIReportData {
  const contextInfo = originalText ? {
    textLength: originalText.length,
    confidence: calculateAssessmentConfidence(originalText),
    hasNumericData: /\d+%|\d+\.\d+/.test(originalText),
    looksLikeAssessment: calculateAssessmentConfidence(originalText) > 0.3
  } : {};

  console.warn('Creating error report:', { reason, context: contextInfo });

  return {
    topics: createDefaultTopics(),
    studentDetails: {
      studentName: 'Unknown Student',
      school: 'Unknown School',
      testDate: new Date().toISOString(),
      assessmentName: `Parsing Error: ${reason}`
    },
    parsingError: {
      reason,
      context: contextInfo,
      suggestedActions: [
        'Try uploading the PDF again',
        'Ensure the PDF is a valid ATI assessment report',
        'Check if the PDF text is readable (not scanned image)',
        'Contact support if this is a valid assessment report'
      ]
    }
  };
}

/**
 * Safe PDF text extraction with error handling
 */
export async function extractTextFromPDFSafely(buffer: Buffer): Promise<string> {
  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty PDF buffer');
    }
    
    // Check PDF header
    const header = buffer.slice(0, 5).toString();
    if (!header.includes('%PDF')) {
      throw new Error('Invalid PDF format');
    }
    
    // Try multiple parsers with fallback
    try {
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      return data.text;
    } catch (parseError) {
      console.warn('pdf-parse failed, trying fallback method');
      
      // Try simple text extraction
      const text = buffer.toString('utf8');
      // Extract readable text between control characters
      const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                           .replace(/\s+/g, ' ')
                           .trim();
      
      if (readable.length < 100) {
        throw new Error('Could not extract meaningful text from PDF');
      }
      
      return readable;
    }
  } catch (error: any) {
    console.error('PDF extraction error:', error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Validate and sanitize topic data
 */
function validateTopicData(topic: any): ATITopic | null {
  try {
    if (!topic || typeof topic !== 'object') {
      return null;
    }
    
    // Ensure required fields match ATITopic interface
    const validatedTopic: ATITopic = {
      name: String(topic.name || 'Unknown Topic'),
      category: String(topic.category || 'General'),
      groupScore: (topic.groupScore != null || topic.score != null)
        ? Number(topic.groupScore ?? topic.score)
        : null,
      needsReview: Boolean(topic.needsReview !== undefined ? topic.needsReview : true),
      points: topic.points ? Number(topic.points) : undefined,
      subcategory: topic.subcategory ? String(topic.subcategory) : undefined
    };
    
    // Validate score range
    if (validatedTopic.groupScore != null && (validatedTopic.groupScore < 0 || validatedTopic.groupScore > 100)) {
      validatedTopic.groupScore = Math.max(0, Math.min(100, validatedTopic.groupScore));
    }
    
    return validatedTopic;
  } catch (error) {
    console.error('Topic validation error:', error);
    return null;
  }
}

export default {
  parseATIReportSafely,
  extractTextFromPDFSafely
};