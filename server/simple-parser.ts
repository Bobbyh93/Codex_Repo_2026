// Dynamic import to avoid initialization issues
const pdfParse = async (buffer: Buffer) => {
  const pdfParseModule = await import("pdf-parse");
  return pdfParseModule.default(buffer);
};

// Common nursing topics to look for in assessments
const TOPIC_KEYWORDS = {
  pharmacology: [
    "medication", "drug", "dose", "dosage", "calculation", "pharmacology",
    "administration", "side effects", "adverse", "therapeutic"
  ],
  cardiac: [
    "cardiac", "heart", "EKG", "ECG", "rhythm", "dysrhythmia", "arrhythmia",
    "myocardial", "coronary", "hypertension", "blood pressure"
  ],
  respiratory: [
    "respiratory", "breathing", "oxygen", "ventilation", "lung", "pneumonia",
    "COPD", "asthma", "airway", "ABG"
  ],
  fluids: [
    "fluid", "electrolyte", "sodium", "potassium", "dehydration", "edema",
    "IV", "balance", "kidney", "renal"
  ],
  pediatric: [
    "pediatric", "child", "infant", "growth", "development", "immunization",
    "newborn", "adolescent", "milestone"
  ],
  maternity: [
    "pregnancy", "labor", "delivery", "postpartum", "prenatal", "fetal",
    "obstetric", "maternal", "newborn care"
  ],
  mental_health: [
    "mental", "psychiatric", "anxiety", "depression", "bipolar", "schizophrenia",
    "therapeutic communication", "suicide", "therapy"
  ],
  fundamentals: [
    "vital signs", "assessment", "nursing process", "safety", "infection control",
    "hygiene", "mobility", "nutrition", "documentation"
  ]
};

export async function parseAssessmentReport(buffer: Buffer): Promise<{
  weakTopics: string[];
  scores: { [key: string]: number };
  rawText: string;
}> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text.toLowerCase();
    
    // Count occurrences of topic keywords
    const topicScores: { [key: string]: number } = {};
    
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        // Count how many times keyword appears
        const regex = new RegExp(keyword, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      
      // Look for percentage scores (e.g., "Pharmacology: 65%")
      const scoreRegex = new RegExp(`${topic}[:\\s]+(\\d+)%`, 'i');
      const scoreMatch = text.match(scoreRegex);
      if (scoreMatch) {
        const percentScore = parseInt(scoreMatch[1]);
        // Lower scores = weaker areas
        if (percentScore < 70) {
          score += (70 - percentScore); // Add more weight to lower scores
        }
      }
      
      topicScores[topic] = score;
    }
    
    // Sort topics by score (higher score = more problematic/mentioned)
    const sortedTopics = Object.entries(topicScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3) // Top 3 weak areas
      .map(([topic]) => topic);
    
    return {
      weakTopics: sortedTopics.length > 0 ? sortedTopics : ['pharmacology', 'cardiac', 'fluids'],
      scores: topicScores,
      rawText: text.substring(0, 500) // First 500 chars for debugging
    };
  } catch (error) {
    console.error("PDF parsing error:", error);
    // Return default topics if parsing fails
    return {
      weakTopics: ['pharmacology', 'cardiac', 'fluids'],
      scores: {},
      rawText: ''
    };
  }
}

// Map topics to actual YouTube resources
export const TOPIC_RESOURCES = {
  pharmacology: {
    title: "Drug Calculations Made Easy",
    url: "https://www.youtube.com/watch?v=WJqmcH8B_0c",
    duration: "20 min",
    source: "RegisteredNurseRN"
  },
  cardiac: {
    title: "EKG Rhythm Interpretation",
    url: "https://www.youtube.com/watch?v=0zPrpPR9nHU", 
    duration: "18 min",
    source: "Simple Nursing"
  },
  respiratory: {
    title: "ABGs Made Easy",
    url: "https://www.youtube.com/watch?v=iJe3T_MSr80",
    duration: "15 min",
    source: "RegisteredNurseRN"
  },
  fluids: {
    title: "Fluid & Electrolytes Explained",
    url: "https://www.youtube.com/watch?v=odAh0ysKqSE",
    duration: "22 min",
    source: "Nurse Sarah"
  },
  pediatric: {
    title: "Pediatric Milestones & Growth",
    url: "https://www.youtube.com/watch?v=xCHJHoXXwAI",
    duration: "19 min",
    source: "Simple Nursing"
  },
  maternity: {
    title: "Labor & Delivery Overview",
    url: "https://www.youtube.com/watch?v=CJyJ7p_E6lE",
    duration: "21 min",
    source: "RegisteredNurseRN"
  },
  mental_health: {
    title: "Therapeutic Communication",
    url: "https://www.youtube.com/watch?v=9Gp2vD2O1fY",
    duration: "17 min",
    source: "Nurse Sarah"
  },
  fundamentals: {
    title: "Head to Toe Assessment",
    url: "https://www.youtube.com/watch?v=xF69LJP5VHQ",
    duration: "24 min",
    source: "RegisteredNurseRN"
  }
};