// ATI Report Parser for extracting detailed topics with scores
export interface ATITopic {
  name: string;
  category: string;
  points?: number;
  groupScore: number | null;
  needsReview: boolean;
  subcategory?: string;
  altType?: string; // e.g. "System Disorder", "Nursing Skill", "Medication", "Basic Concept"
}

export interface ATIReportData {
  topics: ATITopic[];
  studentDetails: {
    studentName?: string;
    school?: string;
    testDate?: string;
    assessmentName?: string;
    overallScore?: string;
  };
}

export function parseATIReport(text: string): ATIReportData {
  // Handle null or invalid input gracefully
  if (!text || typeof text !== 'string') {
    return {
      topics: [],
      studentDetails: {
        studentName: 'Unknown',
        school: 'Unknown',
        testDate: new Date().toISOString(),
        assessmentName: 'Invalid Input'
      }
    };
  }
  
  let topics: ATITopic[] = [];
  const scoreMap = new Map<string, number>(); // Store scores by topic name
  const topicFrequency = new Map<string, number>(); // Track frequency of topics for group detection
  const lines = text.split('\n');
  
  // Student details extraction
  let studentName: string | undefined;
  let school: string | undefined;
  let testDate: string | undefined;
  let assessmentName: string | undefined;
  let overallScore: string | undefined;
  
  // Extract student details from the beginning of the report
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i].trim();
    
    // Debug: Check first few lines for context
    if (i < 10 && (line.includes('Individual') || line.includes('STEPHANIE'))) {
      console.log(`DEBUG Line ${i}: "${line}"`);
    }
    
    // Extract student name - check "Individual Name:" pattern FIRST
    if (!studentName) {
      // Priority 1: Check for explicit "Individual Name:" pattern (ATI reports)
      // This pattern must be checked BEFORE generic patterns to avoid false positives
      if (line.includes('Individual Name:')) {
        // Match everything after "Individual Name:" until end of line or another field
        const specificMatch = line.match(/Individual Name[:\s]*([A-Z][A-Z\s-]+?)(?:Individual Score|Student Number|Institution|$)/i);
        if (specificMatch) {
          studentName = specificMatch[1].trim();
          // Clean up any extra spaces from the student name (normalize multiple spaces to single space)
          studentName = studentName.replace(/\s+/g, ' ').trim();
          console.log(`DEBUG: Found student name via Individual Name pattern: "${studentName}"`);
        }
      }
      // Priority 2: Only check generic patterns if NOT a header/title line
      else if (!line.includes('Performance Profile') && !line.includes('Report') && !line.includes('Assessment')) {
        const genericPatterns = [
          /^(?:Student|Name)[:\s]*([A-Za-z]+(?:\s+[A-Za-z-]+)+)/i,
          /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/,  // Full name on its own line
          /^Candidate[:\s]*([A-Za-z]+(?:\s+[A-Za-z-]+)+)/i
        ];
        
        for (const pattern of genericPatterns) {
          const match = line.match(pattern);
          if (match) {
            studentName = match[1].trim();
            // Clean up any extra spaces from the student name
            studentName = studentName.replace(/\s+/g, ' ').trim();
            console.log(`DEBUG: Found student name via generic pattern: "${studentName}"`);
            break;
          }
        }
      }
    }
    
    // Extract overall score from the same line if present (e.g., "Individual Score: 71.7%")
    if (!overallScore && line.includes('Individual Score')) {
      const scoreMatch = line.match(/Individual Score[:\s]*(\d+\.?\d*)%/i);
      if (scoreMatch) {
        overallScore = scoreMatch[1].trim();
        console.log(`DEBUG: Found overall score: "${overallScore}"`);
      }
    }
    
    // Extract school/institution
    if (!school) {
      const schoolPatterns = [
        /(?:School|Institution|College|University)[:\s]*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
        /(?:Program|Nursing School)[:\s]*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i
      ];
      
      for (const pattern of schoolPatterns) {
        const match = line.match(pattern);
        if (match) {
          school = match[1].trim();
          break;
        }
      }
    }
    
    // Extract test date
    if (!testDate) {
      const datePatterns = [
        /(?:Test Date|Date Taken|Assessment Date|Date)[:\s]*([A-Za-z]+\s+\d+,?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
        /(?:Completed|Taken)[:\s]*([A-Za-z]+\s+\d+,?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
      ];
      
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          testDate = match[1].trim();
          break;
        }
      }
    }
    
    // Extract assessment name
    if (!assessmentName) {
      const assessmentPatterns = [
        /^(ATI\s+[A-Za-z\s]+(?:Proctored|Practice))/i,
        /^(HESI\s+[A-Za-z\s]+)/i,
        /(?:Assessment|Test|Exam)[:\s]*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i,
        /^([A-Za-z\s]+(?:Comprehensive|Content\s+Mastery|Fundamentals|Medical-Surgical|Pediatrics|Mental\s+Health|Maternal\s+Newborn))/i
      ];
      
      for (const pattern of assessmentPatterns) {
        const match = line.match(pattern);
        if (match) {
          assessmentName = match[1].trim();
          break;
        }
      }
    }
  }
  
  let currentCategory = '';
  let currentSubcategory = '';
  let currentCategoryScore: number | undefined = undefined; // Score for the current NCLEX category in Topics to Review
  let inScoresSection = false;
  let inTopicsToReviewSection = false;
  let topicsToReviewSeen = false; // True once we enter the first Topics to Review boundary
  let isGroupReport = false;

  // NCLEX category name → normalised key used for scoreMap lookup
  const NCLEX_CATEGORY_NAMES = [
    'Management of Care',
    'Safety and Infection Control',
    'Health Promotion and Maintenance',
    'Psychosocial Integrity',
    'Basic Care and Comfort',
    'Pharmacological and Parenteral Therapies',
    'Reduction of Risk Potential',
    'Physiological Adaptation',
    'Clinical Judgment',
  ];
  
  // First pass - collect all scores from Group Scores section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (line.includes('Group Scores')) {
      inScoresSection = true;
      continue;
    }
    
    if (inScoresSection) {
      // Parse score lines: "Topic Name    Points    Score%"
      const scoreMatch = trimmedLine.match(/^([A-Za-z][A-Za-z\s\/\-\(\)]+?)\s+\d+\s+(\d+\.?\d*)%$/);
      if (scoreMatch) {
        const topicName = scoreMatch[1].trim();
        const score = parseFloat(scoreMatch[2]);
        scoreMap.set(topicName, score);
      }
      // Also capture bare "Category    Score%" lines (no point count)
      const bareScoreMatch = trimmedLine.match(/^([A-Za-z][A-Za-z\s\/\-]+?)\s+(\d+\.?\d*)%$/);
      if (bareScoreMatch) {
        scoreMap.set(bareScoreMatch[1].trim(), parseFloat(bareScoreMatch[2]));
      }
    }
  }
  
  // Pre-process: join lines where an ALT parenthetical wraps onto the next line.
  // ATI PDF extraction sometimes emits the closing ")" on a separate line.
  const processedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    // Heuristic: ALT marker present but no closing paren on same line → try to join
    if (
      cur.includes('Active Learning Template') &&
      !cur.includes(')') &&
      i + 1 < lines.length
    ) {
      processedLines.push(cur + ' ' + lines[i + 1].trim());
      i++;
    } else {
      processedLines.push(cur);
    }
  }

  // Second pass - extract ALT topics from Topics to Review sections (can span multiple pages)
  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const trimmedLine = line.trim();
    
    // Look for "Topics to Review" section - case insensitive
    if (line.toLowerCase().includes('topics to review')) {
      inTopicsToReviewSection = true;
      topicsToReviewSeen = true;
      continue;
    }
    
    // Continue extracting topics even across pages
    if (inTopicsToReviewSection) {
      // STOP when we hit "Outcomes" as a standalone section header (anchored exact match)
      if (/^Outcomes\s*$/i.test(trimmedLine)) {
        inTopicsToReviewSection = false;
        console.log("Reached 'Outcomes' section - ending Topics to Review extraction");
        break; // Stop processing entirely as we've extracted all topics
      }
      
      // Skip page markers and headers but continue extraction
      if (line.includes('Page') || line.includes('Report Created') || line.includes('Please see')) {
        continue; // Don't stop extraction, just skip these lines
      }
      
      // Skip non-ALT lines that are just section headers/metadata
      if (trimmedLine.includes('Active Learning Template')) {
        // Handled below — fall through
      } else {
        // Strictly match known NCLEX category names to set currentCategory
        const matchedNCLEX = NCLEX_CATEGORY_NAMES.find(n =>
          trimmedLine.toLowerCase().startsWith(n.toLowerCase())
        );
        if (matchedNCLEX) {
          currentCategory = matchedNCLEX;
          // Priority 1: Extract an inline percentage from the header line itself.
          // ATI reports often render "Physiological Adaptation    71%" as the
          // category header inside the Topics-to-Review section.
          const inlineScoreMatch = trimmedLine.match(/(\d+\.?\d*)\s*%\s*$/);
          let catScore: number | undefined;
          if (inlineScoreMatch) {
            catScore = parseFloat(inlineScoreMatch[1]);
          } else {
            // Priority 2: Fall back to the Group Scores table built in pass 1.
            catScore = scoreMap.get(matchedNCLEX);
          }
          // Use undefined when no source is found — callers receive null groupScore instead of a misleading 75 default.
          currentCategoryScore = catScore !== undefined
            ? Math.min(100, Math.max(0, catScore))
            : undefined;
          currentSubcategory = '';
          continue;
        }

        // Any other line with "(N item[s])" is a subcategory header
        // Allow optional space before the opening paren
        const subcatMatch = trimmedLine.match(/^([A-Za-z][A-Za-z\s\/\-]*?)\s*\(\d+\s*items?\)\s*$/);
        if (subcatMatch) {
          currentSubcategory = subcatMatch[1].trim();
          continue;
        }

        // ATI individual performance format 2: "Subject > Subcategory: Topic Name"
        // e.g. "Medical-Surgical > Cardiovascular: Complications for a Client..."
        const subjectTopicMatch = trimmedLine.match(
          /^([A-Za-z][A-Za-z\s\-\/]+?)\s*>\s*([A-Za-z][A-Za-z\s\-\/]+?):\s*(.+)$/
        );
        if (subjectTopicMatch) {
          const subjectLabel = subjectTopicMatch[1].trim();
          const subCat = subjectTopicMatch[2].trim();
          const topicName = subjectTopicMatch[3].trim();
          if (topicName.length >= 5) {
            const subjectScore = scoreMap.get(subjectLabel) ?? currentCategoryScore ?? null;
            const key = `${topicName}|${subjectLabel}`;
            topicFrequency.set(key, (topicFrequency.get(key) || 0) + 1);
            topics.push({
              name: topicName,
              category: subjectLabel,
              subcategory: subCat,
              groupScore: subjectScore,
              needsReview: true,
              altType: undefined,
            });
          }
          continue;
        }

        // All other non-ALT lines inside the boundary are metadata/noise — skip
        continue;
      }
      
      // Only extract true ALT items — lines that contain the Active Learning Template marker
      if (!trimmedLine.includes('Active Learning Template')) continue;

      // Extract ALT type — supports both formats found in ATI reports:
      //   (Active Learning Template - System Disorder)   ← hyphen (most common)
      //   (Active Learning Template: System Disorder)    ← colon (less common)
      const altTypeMatch = trimmedLine.match(
        /\(Active\s+Learning\s+Template\s*[-:]\s*([^)]+)\)/i
      );
      const altType = altTypeMatch ? altTypeMatch[1].trim() : undefined;

      // Strip the entire ALT parenthetical to get a clean display name
      const templateMatch = trimmedLine.match(/\s*\(Active\s+Learning\s+Template[^)]*\)/i);
      const templateInfo = templateMatch ? templateMatch[0] : '';

      let fullTopic = trimmedLine;
      if (templateInfo) {
        fullTopic = trimmedLine.replace(templateInfo, '').replace(/\s{2,}/g, ' ').trim();
      }
      // Remove trailing colon or punctuation left over
      fullTopic = fullTopic.replace(/[:\s]+$/, '').trim();

      if (!fullTopic || fullTopic.length < 3) continue;

      // Use the category score from Group Scores when available; null when no score is found.
      const itemScore = currentCategoryScore ?? null;

      // Track topic frequency for group report detection
      const topicKey = `${fullTopic}|${currentCategory || 'Fundamentals'}`;
      topicFrequency.set(topicKey, (topicFrequency.get(topicKey) || 0) + 1);

      topics.push({
        name: fullTopic,
        category: currentCategory || 'Fundamentals',
        groupScore: itemScore,
        needsReview: true,
        // Always carry the subcategory from context — indentation is not reliable in
        // extracted PDF text, so we use the last-seen subcategory header regardless
        subcategory: currentSubcategory || undefined,
        altType
      });
    }
    
    // Check if we're in the Group Scores section
    if (line.includes('Group Scores')) {
      inScoresSection = true;
      inTopicsToReviewSection = false;
      continue;
    }

    // Once we have entered the Topics to Review boundary, all topic data comes
    // exclusively from within that boundary.  Do NOT inject topics from any other
    // part of the document (NCLEX category headers, Group Scores rows, etc.).
    if (topicsToReviewSeen) continue;

    // Main nursing subjects (not NCLEX categories)
    const mainSubjects = [
      'Fundamentals',
      'Medical-Surgical', 
      'Pediatrics',
      'Maternal and Newborn',
      'Mental Health',
      'Pharmacology',
      'Community Health',
      'Leadership'
    ];
    
    // Map old NCLEX categories to our Subject-based system
    const categoryToSubjectMap: {[key: string]: string} = {
      'Management of Care': 'Fundamentals',
      'Safety and Infection Control': 'Fundamentals',
      'Health Promotion and Maintenance': 'Community Health',
      'Psychosocial Integrity': 'Mental Health',
      'Basic Care and Comfort': 'Fundamentals',
      'Pharmacological and Parenteral Therapies': 'Pharmacology',
      'Reduction of Risk Potential': 'Medical-Surgical',
      'Physiological Adaptation': 'Medical-Surgical'
    };
    
    // Track category context for pre-boundary sections (no topic injection —
    // topics come exclusively from within the Topics-to-Review boundary above).
    for (const [nclexCategory, subject] of Object.entries(categoryToSubjectMap)) {
      if (trimmedLine.startsWith(nclexCategory)) {
        currentCategory = subject;
        break;
      }
    }
  }
  
  // Check if this is a group report (multiple students with same topics)
  const duplicateCount = Array.from(topicFrequency.values()).filter(count => count > 1).length;
  if (duplicateCount > topics.length * 0.3) { // If >30% of topics appear multiple times
    isGroupReport = true;
    console.log('Group report detected - analyzing frequency and removing duplicates');
    
    // Log frequency analysis
    const frequencyAnalysis = Array.from(topicFrequency.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 most frequent topics
    
    console.log('Most frequently missed topics in group:');
    frequencyAnalysis.forEach(([topic, count]) => {
      const [name, category] = topic.split('|');
      console.log(`  - ${name} (${category}): appeared ${count} times`);
    });
    
    // Deduplicate topics while preserving the lowest score for each
    const deduplicatedMap = new Map<string, ATITopic>();
    topics.forEach(topic => {
      const key = `${topic.name}|${topic.category}`;
      const existing = deduplicatedMap.get(key);
      const topicScore = topic.groupScore ?? Infinity;
      const existingScore = existing?.groupScore ?? Infinity;
      if (!existing || topicScore < existingScore) {
        deduplicatedMap.set(key, topic);
      }
    });
    
    topics = Array.from(deduplicatedMap.values());
  }
  
  return {
    topics,
    studentDetails: {
      studentName,
      school,
      testDate,
      assessmentName,
      overallScore
    }
  };
}

// Extract topics that need review (score < 80%)
export function getTopicsForReview(reportData: ATIReportData): ATITopic[] {
  if (!reportData || !reportData.topics || !Array.isArray(reportData.topics)) {
    console.log('Warning: No topics found in report data');
    return [];
  }
  
  return reportData.topics
    .filter(t => t && t.needsReview)
    .sort((a, b) => (a.groupScore ?? Infinity) - (b.groupScore ?? Infinity)); // Sort by lowest score first; null scores go last
}

// Group topics by category for organized display
export function groupTopicsByCategory(topics: ATITopic[]): Map<string, ATITopic[]> {
  const grouped = new Map<string, ATITopic[]>();
  
  topics.forEach(topic => {
    const category = topic.category || 'Uncategorized';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(topic);
  });
  
  return grouped;
}

// Calculate statistics for reporting with baseline comparison
export function calculateTopicStatistics(topics: ATITopic[], nationalMean: number = 71.8, programMean: number = 72.1) {
  if (!topics || !Array.isArray(topics)) {
    return {
      totalTopics: 0,
      topicsNeedingReview: 0,
      averageScore: 0,
      scoreRanges: { excellent: 0, good: 0, needsImprovement: 0, critical: 0 },
      performanceVsNational: 0,
      performanceVsProgram: 0
    };
  }
  
  const totalTopics = topics.length;
  const topicsNeedingReview = topics.filter(t => t && t.needsReview).length;
  // Only include topics with a known score; null scores are excluded from the average.
  const scoredTopics = topics.filter(t => t && t.groupScore != null);
  const validScores = scoredTopics.map(t => Math.min(100, Math.max(0, t.groupScore as number)));
  const averageScore = validScores.length > 0
    ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
    : 0;
  
  // Group by score ranges (topics with null scores are counted in no range)
  const scoreRanges = {
    excellent: topics.filter(t => t && t.groupScore != null && t.groupScore >= 90).length,
    good: topics.filter(t => t && t.groupScore != null && t.groupScore >= 80 && t.groupScore < 90).length,
    needsImprovement: topics.filter(t => t && t.groupScore != null && t.groupScore >= 70 && t.groupScore < 80).length,
    critical: topics.filter(t => t && t.groupScore != null && t.groupScore < 70).length
  };
  
  // Compare against baselines
  const performanceVsNational = averageScore - nationalMean;
  const performanceVsProgram = averageScore - programMean;
  const aboveNationalCount = topics.filter(t => t.groupScore != null && t.groupScore > nationalMean).length;
  const aboveProgramCount = topics.filter(t => t.groupScore != null && t.groupScore > programMean).length;
  
  return {
    totalTopics,
    topicsNeedingReview,
    averageScore,
    scoreRanges,
    reviewPercentage: (topicsNeedingReview / totalTopics) * 100,
    baseline: {
      nationalMean,
      programMean,
      performanceVsNational,
      performanceVsProgram,
      aboveNationalPercentage: (aboveNationalCount / totalTopics) * 100,
      aboveProgramPercentage: (aboveProgramCount / totalTopics) * 100
    }
  };
}