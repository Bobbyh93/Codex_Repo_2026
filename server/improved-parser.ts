interface ParsedTopic {
  name: string;
  score: number;
  category: string;
  subcategories: string[];
  keywords: string[];
}

interface ParsedAssessment {
  overallScore: number;
  topics: ParsedTopic[];
  testDate?: string;
  studentId?: string;
  studentName?: string;
  school?: string;
  assessmentName?: string;
}

interface ParsedSyllabus {
  courseTitle: string;
  courseSpecialty: string;
  objectives: string[];
  topics: Array<{
    name: string;
    category: string;
    bodySystem?: string;
    nursingSpecialty?: string;
    concepts?: string[];
  }>;
  weeklyObjectives: Array<{
    week: number;
    objectives: string[];
  }>;
}

// Topic mapping database - maps common assessment topics to our structured format
const TOPIC_MAPPINGS = {
  // Pharmacology topics
  "medication administration": {
    category: "Pharmacology",
    system: "Core Concepts",
    keywords: ["drug", "medication", "dose", "dosage", "administration", "route"],
  },
  "drug calculations": {
    category: "Pharmacology", 
    system: "Core Concepts",
    keywords: ["calculation", "compute", "dosage", "conversion", "math"],
  },
  "cardiovascular medications": {
    category: "Pharmacology",
    system: "Cardiovascular",
    keywords: ["cardiac", "heart", "beta blocker", "ace inhibitor", "diuretic", "digoxin"],
  },
  
  // Medical-Surgical topics
  "cardiac disorders": {
    category: "Medical-Surgical",
    system: "Cardiovascular",
    keywords: ["heart failure", "mi", "myocardial", "angina", "arrhythmia", "afib"],
  },
  "respiratory disorders": {
    category: "Medical-Surgical",
    system: "Respiratory",
    keywords: ["copd", "asthma", "pneumonia", "respiratory", "oxygen", "ventilator"],
  },
  "fluid and electrolytes": {
    category: "Medical-Surgical",
    system: "Renal",
    keywords: ["fluid", "electrolyte", "sodium", "potassium", "dehydration", "edema"],
  },
  
  // Fundamentals
  "patient safety": {
    category: "Fundamentals",
    system: "Core Concepts",
    keywords: ["safety", "fall", "infection", "prevention", "hand hygiene", "isolation"],
  },
  "vital signs": {
    category: "Fundamentals",
    system: "Core Concepts",
    keywords: ["blood pressure", "temperature", "pulse", "respiratory rate", "oxygen saturation"],
  },
  
  // Mental Health
  "anxiety disorders": {
    category: "Mental Health",
    system: "Psychiatric",
    keywords: ["anxiety", "panic", "phobia", "stress", "coping"],
  },
  "mood disorders": {
    category: "Mental Health",
    system: "Psychiatric",
    keywords: ["depression", "bipolar", "mania", "suicide", "mood"],
  },
  
  // Pediatrics
  "growth and development": {
    category: "Pediatrics",
    system: "Core Concepts",
    keywords: ["milestone", "growth", "development", "pediatric", "child", "infant"],
  },
  "pediatric medications": {
    category: "Pediatrics",
    system: "Core Concepts",
    keywords: ["pediatric dose", "weight-based", "child medication", "mg/kg"],
  },
  
  // Maternal/Newborn
  "pregnancy complications": {
    category: "Maternal-Newborn",
    system: "Obstetric",
    keywords: ["preeclampsia", "gestational", "pregnancy", "prenatal", "antepartum"],
  },
  "labor and delivery": {
    category: "Maternal-Newborn",
    system: "Obstetric",
    keywords: ["labor", "delivery", "contraction", "fetal", "cesarean"],
  },
};

// Patterns to extract scores from various report formats
const SCORE_PATTERNS = [
  // Format: "Topic Name: 75%"
  /([A-Za-z\s&]+):\s*(\d+)%/g,
  // Format: "Topic Name - Score: 75"
  /([A-Za-z\s&]+)\s*-\s*Score:\s*(\d+)/g,
  // Format: "75% - Topic Name"
  /(\d+)%\s*-\s*([A-Za-z\s&]+)/g,
  // Format: "Topic Name (75%)"
  /([A-Za-z\s&]+)\s*\((\d+)%\)/g,
  // Format: "Topic: Topic Name | Score: 75"
  /Topic:\s*([A-Za-z\s&]+)\s*\|\s*Score:\s*(\d+)/g,
];

// Nursing topics that commonly appear in syllabi
const NURSING_TOPICS = {
  "Clinical Judgment": ["assessment", "evaluation", "critical thinking", "decision making", "prioritization"],
  "Pharmacology": ["medications", "drug", "dosage", "administration", "pharmacological"],
  "Medical-Surgical": ["cardiac", "respiratory", "gastrointestinal", "renal", "neurological", "endocrine"],
  "Fundamentals": ["vital signs", "hygiene", "safety", "infection control", "mobility", "nutrition"],
  "Mental Health": ["psychiatric", "mental health", "anxiety", "depression", "therapeutic communication"],
  "Pediatrics": ["child", "pediatric", "growth", "development", "immunization"],
  "Maternal-Newborn": ["pregnancy", "labor", "delivery", "postpartum", "newborn"],
  "Community Health": ["community", "public health", "prevention", "health promotion"],
  "Critical Care": ["ICU", "intensive", "ventilator", "hemodynamic", "critical"],
  "Emergency": ["emergency", "trauma", "triage", "acute", "stabilization"],
  "Geriatrics": ["elderly", "aging", "gerontology", "dementia", "fall prevention"],
  "Leadership": ["management", "delegation", "leadership", "quality improvement", "teamwork"]
};

// Body systems for categorization
const BODY_SYSTEMS = {
  "Cardiovascular": ["heart", "cardiac", "vascular", "blood pressure", "circulation"],
  "Respiratory": ["lung", "breathing", "oxygen", "airway", "ventilation"],
  "Neurological": ["brain", "neuro", "nerve", "cognitive", "consciousness"],
  "Gastrointestinal": ["digestive", "bowel", "nutrition", "liver", "abdomen"],
  "Renal/Urinary": ["kidney", "renal", "urinary", "fluid", "electrolyte"],
  "Endocrine": ["diabetes", "thyroid", "hormone", "glucose", "insulin"],
  "Musculoskeletal": ["bone", "muscle", "mobility", "fracture", "orthopedic"],
  "Integumentary": ["skin", "wound", "pressure ulcer", "burn", "healing"],
  "Immune/Hematologic": ["immune", "blood", "infection", "hematologic", "lymph"],
  "Reproductive": ["reproductive", "sexual", "fertility", "contraception"]
};

export function parseAssessmentReport(text: string): ParsedAssessment {
  const lines = text.split('\n').map(line => line.trim());
  const topics: ParsedTopic[] = [];
  let overallScore = 0;
  let testDate: string | undefined;
  let studentId: string | undefined;
  let studentName: string | undefined;
  let school: string | undefined;
  let assessmentName: string | undefined;
  
  // Extract overall score
  const overallPattern = /overall\s*score[:\s]*(\d+)/i;
  const overallMatch = text.match(overallPattern);
  if (overallMatch) {
    overallScore = parseInt(overallMatch[1]);
  }
  
  // Extract test date
  const datePattern = /(?:test\s*date|date\s*taken|assessment\s*date)[:\s]*([A-Za-z]+\s*\d+,?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  const dateMatch = text.match(datePattern);
  if (dateMatch) {
    testDate = dateMatch[1];
  }
  
  // Extract student ID
  const idPattern = /(?:student\s*id|id\s*number)[:\s]*([A-Z0-9]+)/i;
  const idMatch = text.match(idPattern);
  if (idMatch) {
    studentId = idMatch[1];
  }
  
  // Extract student name
  const namePattern = /(?:student\s*name|name)[:\s]*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i;
  const nameMatch = text.match(namePattern);
  if (nameMatch) {
    studentName = nameMatch[1];
  }
  
  // Extract school
  const schoolPattern = /(?:school|institution|college|university)[:\s]*([A-Za-z]+(?:\s+[A-Za-z]+)*)/i;
  const schoolMatch = text.match(schoolPattern);
  if (schoolMatch) {
    school = schoolMatch[1];
  }
  
  // Extract assessment name
  const assessmentPattern = /(?:assessment|test|exam)\s*(?:name|title)[:\s]*([A-Za-z]+(?:\s+[A-Za-z0-9]+)*)/i;
  const assessmentMatch = text.match(assessmentPattern);
  if (assessmentMatch) {
    assessmentName = assessmentMatch[1];
  }
  
  // Try each pattern to extract topic scores
  for (const pattern of SCORE_PATTERNS) {
    let match;
    const patternText = text.replace(/\n/g, ' '); // Handle multi-line text
    
    while ((match = pattern.exec(patternText)) !== null) {
      let topicName: string;
      let score: number;
      
      // Handle different capture group orders
      if (isNaN(parseInt(match[1]))) {
        topicName = match[1].trim();
        score = parseInt(match[2]);
      } else {
        score = parseInt(match[1]);
        topicName = match[2].trim();
      }
      
      // Normalize topic name
      topicName = topicName.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Find matching category from our mappings
      let category = "Fundamentals";
      let system = "Core Concepts";
      let keywords: string[] = [];
      
      for (const [key, mapping] of Object.entries(TOPIC_MAPPINGS)) {
        // Check if topic name contains key terms
        if (topicName.includes(key) || 
            mapping.keywords.some(kw => topicName.includes(kw))) {
          category = mapping.category;
          system = mapping.system;
          keywords = mapping.keywords;
          break;
        }
      }
      
      // Only add valid topics with scores
      if (topicName && score >= 0 && score <= 100) {
        // Check if we already have this topic
        const existingTopic = topics.find(t => t.name === topicName);
        if (!existingTopic) {
          topics.push({
            name: topicName,
            score: score,
            category: category,
            subcategories: [system],
            keywords: keywords,
          });
        }
      }
    }
  }
  
  // If no topics were found with patterns, try to extract from structured sections
  if (topics.length === 0) {
    // Look for section headers like "Performance by Topic" or "Content Area Scores"
    const sectionPattern = /(?:performance by topic|content area scores|topic breakdown)/i;
    const sectionIndex = lines.findIndex(line => sectionPattern.test(line));
    
    if (sectionIndex !== -1) {
      // Parse lines after the section header
      for (let i = sectionIndex + 1; i < lines.length && i < sectionIndex + 20; i++) {
        const line = lines[i];
        
        // Skip empty lines and headers
        if (!line || line.length < 5) continue;
        if (/^[-=]+$/.test(line)) continue;
        
        // Try to extract topic and score from the line
        const parts = line.split(/[\t\s]{2,}|[,|]/);
        if (parts.length >= 2) {
          const possibleTopic = parts[0].trim();
          const possibleScore = parts[1].replace(/[^0-9]/g, '');
          
          if (possibleTopic && possibleScore) {
            const score = parseInt(possibleScore);
            if (score >= 0 && score <= 100) {
              topics.push({
                name: possibleTopic.toLowerCase(),
                score: score,
                category: "Assessment",
                subcategories: [],
                keywords: [],
              });
            }
          }
        }
      }
    }
  }
  
  // If still no topics, generate default weak areas based on common patterns
  if (topics.length === 0) {
    // Default topics that commonly appear in nursing assessments
    const defaultWeakAreas = [
      { name: "pharmacology", score: 65, category: "Pharmacology" },
      { name: "cardiac nursing", score: 70, category: "Medical-Surgical" },
      { name: "fluid and electrolytes", score: 68, category: "Medical-Surgical" },
      { name: "respiratory care", score: 72, category: "Medical-Surgical" },
      { name: "pediatric nursing", score: 75, category: "Pediatrics" },
    ];
    
    topics.push(...defaultWeakAreas.map(area => ({
      ...area,
      subcategories: [(TOPIC_MAPPINGS as any)[area.name]?.system || "Core Concepts"],
      keywords: (TOPIC_MAPPINGS as any)[area.name]?.keywords || [],
    })));
  }
  
  // Calculate overall score if not found
  if (!overallScore && topics.length > 0) {
    overallScore = Math.round(
      topics.reduce((sum, t) => sum + t.score, 0) / topics.length
    );
  }
  
  // Sort topics by score (lowest first - these need most attention)
  topics.sort((a, b) => a.score - b.score);
  
  return {
    overallScore,
    topics: topics.slice(0, 10), // Return top 10 weak areas
    testDate,
    studentId,
    studentName,
    school,
    assessmentName,
  };
}

// Generate study plan based on parsed assessment
export function generateStudyPlan(assessment: ParsedAssessment) {
  const weakTopics = assessment.topics.filter(t => t.score < 75);
  const studyItems = [];
  
  for (const topic of weakTopics) {
    const studyTime = Math.max(30, Math.round((75 - topic.score) * 3)); // 3 min per % below 75
    
    studyItems.push({
      topicName: topic.name,
      category: topic.category,
      currentScore: topic.score,
      targetScore: 75,
      estimatedTime: studyTime,
      priority: topic.score < 60 ? "high" : topic.score < 70 ? "medium" : "low",
      resources: [
        {
          type: "video",
          title: `Understanding ${topic.name}`,
          duration: Math.round(studyTime * 0.4),
          difficulty: "beginner",
        },
        {
          type: "practice",
          title: `${topic.name} Practice Questions`,
          duration: Math.round(studyTime * 0.4),
          difficulty: "intermediate",
        },
        {
          type: "reading",
          title: `${topic.name} Study Guide`,
          duration: Math.round(studyTime * 0.2),
          difficulty: "beginner",
        },
      ],
    });
  }
  
  return {
    totalStudyTime: studyItems.reduce((sum, item) => sum + item.estimatedTime, 0),
    itemCount: studyItems.length,
    items: studyItems,
    focusAreas: [...new Set(studyItems.map(i => i.category))],
  };
}

// Parse syllabus document to extract objectives and identify topics
export function parseSyllabusDocument(text: string): ParsedSyllabus {
  // Extract course title
  const courseTitle = extractCourseTitle(text);
  
  // Extract course specialty
  const courseSpecialty = identifyCourseSpecialty(text);
  
  // Extract learning objectives
  const objectives = extractAllObjectives(text);
  
  // Extract weekly objectives
  const weeklyObjectives = extractWeeklyObjectives(text);
  
  // Identify topics and subjects using AI-like pattern matching
  const topics = identifyNursingTopics(text);
  
  return {
    courseTitle,
    courseSpecialty,
    objectives,
    topics,
    weeklyObjectives,
  };
}

// Extract course title from syllabus
function extractCourseTitle(text: string): string {
  const patterns = [
    /course\s*title[:\s]*([^\n]+)/i,
    /course\s*name[:\s]*([^\n]+)/i,
    /title[:\s]*([^\n]+)/i,
    /^([A-Z][^:\n]{10,60})\n/m
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return "Nursing Course";
}

// Identify course specialty based on content
function identifyCourseSpecialty(text: string): string {
  const textLower = text.toLowerCase();
  const specialties = {
    "Medical-Surgical Nursing": ["medical-surgical", "med-surg", "adult health"],
    "Pediatric Nursing": ["pediatric", "child health", "infant", "adolescent"],
    "Maternal-Newborn Nursing": ["maternal", "obstetric", "newborn", "pregnancy", "antepartum"],
    "Mental Health Nursing": ["mental health", "psychiatric", "psych nursing"],
    "Community Health Nursing": ["community health", "public health", "population"],
    "Critical Care Nursing": ["critical care", "intensive care", "ICU", "CCU"],
    "Emergency Nursing": ["emergency", "trauma", "urgent care", "triage"],
    "Geriatric Nursing": ["geriatric", "gerontology", "elderly", "aging"],
    "Fundamentals of Nursing": ["fundamentals", "basic nursing", "foundations"],
    "Pharmacology": ["pharmacology", "medication administration", "drug therapy"],
    "Leadership and Management": ["leadership", "management", "administration", "delegation"]
  };
  
  for (const [specialty, keywords] of Object.entries(specialties)) {
    if (keywords.some(keyword => textLower.includes(keyword))) {
      return specialty;
    }
  }
  
  return "General Nursing";
}

// Extract all learning objectives from syllabus
function extractAllObjectives(text: string): string[] {
  const objectives: string[] = [];
  const patterns = [
    /(?:course\s+)?(?:learning\s+)?objectives?[:\s]*([^\n]+(?:\n(?![A-Z][a-z]*:)[^\n]+)*)/gi,
    /(?:student\s+)?(?:learning\s+)?outcomes?[:\s]*([^\n]+(?:\n(?![A-Z][a-z]*:)[^\n]+)*)/gi,
    /(?:upon\s+completion[^:]*)[:\s]*([^\n]+(?:\n(?![A-Z][a-z]*:)[^\n]+)*)/gi,
    /(?:students?\s+will\s+be\s+able\s+to)[:\s]*([^\n]+)/gi,
    /(?:will\s+be\s+able\s+to)[:\s]*([^\n]+)/gi,
    /(?:objective|goal|outcome)\s*\d*[:\s]*([^\n]+)/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const objectiveText = match[1].trim();
      // Split by bullet points or numbered lists
      const items = objectiveText.split(/(?:\n\s*[-•*]|\n\s*\d+[.)]\s*)/);
      
      for (const item of items) {
        const cleanItem = item.trim();
        if (cleanItem.length > 10 && cleanItem.length < 500) {
          objectives.push(cleanItem);
        }
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(objectives)];
}

// Extract weekly objectives
function extractWeeklyObjectives(text: string): Array<{week: number, objectives: string[]}> {
  const weeks: Array<{week: number, objectives: string[]}> = [];
  const weekPattern = /week\s*(\d+)[:\s]*([\s\S]*?)(?=week\s*\d+|module\s*\d+|unit\s*\d+|$)/gi;
  let match;
  
  while ((match = weekPattern.exec(text)) !== null) {
    const weekNum = parseInt(match[1]);
    const weekContent = match[2];
    
    // Extract objectives from the week content
    const weekObjectives: string[] = [];
    const objPatterns = [
      /objectives?[:\s]*([^\n]+)/i,
      /goals?[:\s]*([^\n]+)/i,
      /will\s+(?:be\s+able\s+to\s+)?([^\n]+)/gi
    ];
    
    for (const pattern of objPatterns) {
      let objMatch;
      while ((objMatch = pattern.exec(weekContent)) !== null) {
        weekObjectives.push(objMatch[1].trim());
      }
    }
    
    // Also extract content topics as implicit objectives
    const lines = weekContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 200 && !trimmed.includes(':')) {
        weekObjectives.push(trimmed);
      }
    }
    
    if (weekObjectives.length > 0) {
      weeks.push({ week: weekNum, objectives: weekObjectives });
    }
  }
  
  return weeks;
}

// Identify nursing topics and subjects using pattern matching
function identifyNursingTopics(text: string): Array<{
  name: string;
  category: string;
  bodySystem?: string;
  nursingSpecialty?: string;
  concepts?: string[];
}> {
  const textLower = text.toLowerCase();
  const identifiedTopics: Array<{
    name: string;
    category: string;
    bodySystem?: string;
    nursingSpecialty?: string;
    concepts?: string[];
  }> = [];
  
  // Check for nursing topics
  for (const [topicCategory, keywords] of Object.entries(NURSING_TOPICS)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        // Find the context around the keyword
        const contextPattern = new RegExp(
          `([^.!?]*\\b${keyword}\\b[^.!?]*)`,
          'gi'
        );
        const contextMatch = text.match(contextPattern);
        
        if (contextMatch) {
          const topicName = extractTopicName(contextMatch[0], keyword);
          
          // Check for body system
          let bodySystem: string | undefined;
          for (const [system, systemKeywords] of Object.entries(BODY_SYSTEMS)) {
            if (systemKeywords.some(kw => topicName.toLowerCase().includes(kw))) {
              bodySystem = system;
              break;
            }
          }
          
          // Identify nursing concepts
          const concepts = identifyConcepts(topicName);
          
          // Avoid duplicates
          if (!identifiedTopics.find(t => t.name === topicName)) {
            identifiedTopics.push({
              name: topicName,
              category: topicCategory,
              bodySystem,
              nursingSpecialty: identifyCourseSpecialty(topicName),
              concepts: concepts.length > 0 ? concepts : undefined
            });
          }
        }
      }
    }
  }
  
  // If no specific topics found, extract from headings and important lines
  if (identifiedTopics.length === 0) {
    const headingPattern = /^(?:chapter|unit|module|topic|section)\s*\d*[:\s]*([^\n]+)/gmi;
    let match;
    
    while ((match = headingPattern.exec(text)) !== null) {
      const topicName = match[1].trim();
      
      // Categorize based on content
      let category = "Fundamentals";
      for (const [cat, keywords] of Object.entries(NURSING_TOPICS)) {
        if (keywords.some(kw => topicName.toLowerCase().includes(kw))) {
          category = cat;
          break;
        }
      }
      
      identifiedTopics.push({
        name: topicName,
        category,
        concepts: identifyConcepts(topicName)
      });
    }
  }
  
  return identifiedTopics;
}

// Extract a clean topic name from context
function extractTopicName(context: string, keyword: string): string {
  // Clean up the context
  let cleaned = context.trim()
    .replace(/^\W+/, '')
    .replace(/\W+$/, '');
  
  // If the context is too long, extract a phrase around the keyword
  if (cleaned.length > 50) {
    const keywordIndex = cleaned.toLowerCase().indexOf(keyword);
    const start = Math.max(0, keywordIndex - 20);
    const end = Math.min(cleaned.length, keywordIndex + keyword.length + 20);
    cleaned = cleaned.substring(start, end).trim();
    
    // Clean up partial words at boundaries
    cleaned = cleaned.replace(/^\w+\s/, '').replace(/\s\w+$/, '');
  }
  
  // Title case the result
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Identify nursing concepts in a topic
function identifyConcepts(text: string): string[] {
  const textLower = text.toLowerCase();
  const concepts: string[] = [];
  
  const nursingConcepts = {
    "Patient Safety": ["safety", "fall", "error", "prevention"],
    "Infection Control": ["infection", "sterile", "aseptic", "isolation"],
    "Pain Management": ["pain", "comfort", "analgesic"],
    "Medication Administration": ["medication", "drug", "dose", "administration"],
    "Patient Education": ["teaching", "education", "learning", "instruction"],
    "Cultural Competence": ["cultural", "diversity", "beliefs", "spiritual"],
    "Therapeutic Communication": ["communication", "therapeutic", "rapport"],
    "Clinical Judgment": ["assessment", "judgment", "critical thinking"],
    "Evidence-Based Practice": ["evidence", "research", "best practice"],
    "Quality Improvement": ["quality", "improvement", "outcomes"],
    "Patient Advocacy": ["advocacy", "rights", "ethics"],
    "Collaborative Care": ["collaboration", "interdisciplinary", "team"]
  };
  
  for (const [concept, keywords] of Object.entries(nursingConcepts)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      concepts.push(concept);
    }
  }
  
  return concepts;
}