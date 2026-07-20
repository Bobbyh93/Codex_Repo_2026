import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

interface NursingContentAnalysis {
  title?: string;
  category?: string;
  nursingSpecialty?: string;
  bodySystem?: string;
  diagnoses?: string[];
  interventions?: string[];
  patientProblems?: string[];
  concepts?: string[];
  keywords?: string[];
  priority?: 'high' | 'medium' | 'low';
  clinicalJudgmentPhase?: string[];
}

function uniqueMatches(text: string, terms: string[]): string[] {
  const lowerText = text.toLowerCase();
  return terms.filter((term) => lowerText.includes(term.toLowerCase()));
}

function heuristicAnalyzeNursingContent(content: string): NursingContentAnalysis {
  const lowerContent = content.toLowerCase();
  const concepts = uniqueMatches(content, [
    "Safety",
    "Infection Control",
    "Pain Management",
    "Medication Administration",
    "Patient Education",
    "Therapeutic Communication",
    "Clinical Judgment",
    "Evidence-Based Practice",
  ]);
  const bodySystems = [
    "Cardiovascular",
    "Respiratory",
    "Neurological",
    "Gastrointestinal",
    "Renal/Urinary",
    "Endocrine",
    "Musculoskeletal",
    "Integumentary",
    "Immune/Hematologic",
    "Reproductive",
  ];
  const bodySystem = bodySystems.find((system) => {
    const normalized = system.toLowerCase().split("/")[0];
    return lowerContent.includes(normalized) || lowerContent.includes(normalized.replace("cardio", "cardiac"));
  });
  const keywords = uniqueMatches(content, [
    "assessment",
    "intervention",
    "evaluation",
    "priority",
    "medication",
    "oxygen",
    "pain",
    "infection",
    "safety",
    "teaching",
    "delegation",
    "vital signs",
  ]);

  return {
    title: content.split(/[.\n]/).find((line) => line.trim().length > 10)?.trim().slice(0, 90) || "Mapped nursing content",
    category: concepts[0] || "Clinical Judgment",
    nursingSpecialty: lowerContent.includes("pediatric") || lowerContent.includes("child")
      ? "Pediatrics"
      : lowerContent.includes("maternal") || lowerContent.includes("newborn")
        ? "Maternal-Newborn"
        : "Medical-Surgical",
    bodySystem,
    diagnoses: uniqueMatches(content, ["asthma", "diabetes", "hypertension", "heart failure", "pneumonia", "copd"]),
    interventions: uniqueMatches(content, ["assessment", "monitoring", "teaching", "medication administration", "oxygen therapy"]),
    patientProblems: uniqueMatches(content, ["pain", "dyspnea", "infection", "hypoxia", "anxiety"]),
    concepts,
    keywords,
    priority: lowerContent.includes("priority") || lowerContent.includes("emergency") ? "high" : "medium",
    clinicalJudgmentPhase: ["Recognize Cues", "Analyze Cues", "Take Action"],
  };
}

// Analyze nursing content and extract relevant taxonomy
export async function analyzeNursingContent(content: string): Promise<NursingContentAnalysis> {
  try {
    if (!openai) {
      return heuristicAnalyzeNursingContent(content);
    }

    const prompt = `Analyze the following nursing/medical content and extract relevant information in JSON format.

Content to analyze:
${content.substring(0, 2000)} // Limit to prevent token overflow

Please provide a JSON response with the following fields:
{
  "title": "Brief descriptive title for this content",
  "category": "Main category (e.g., Clinical Judgment, Pharmacology, Assessment, Patient Safety)",
  "nursingSpecialty": "Primary nursing specialty (Medical-Surgical, Critical Care, Emergency, Pediatrics, Maternal-Newborn, Mental Health, Community Health, Geriatrics)",
  "bodySystem": "Primary body system if applicable (Cardiovascular, Respiratory, Neurological, Gastrointestinal, Renal/Urinary, Endocrine, Musculoskeletal, Integumentary, Immune/Hematologic, Reproductive)",
  "diagnoses": ["List of medical diagnoses mentioned"],
  "interventions": ["List of nursing interventions"],
  "patientProblems": ["List of patient problems or nursing diagnoses"],
  "concepts": ["Core nursing concepts (Safety, Infection Control, Pain Management, Medication Administration, Patient Education, Cultural Competence, Therapeutic Communication, Clinical Judgment, Evidence-Based Practice)"],
  "keywords": ["Important medical/nursing terms"],
  "priority": "high/medium/low based on NCLEX importance",
  "clinicalJudgmentPhase": ["Recognize Cues, Analyze Cues, Prioritize Hypotheses, Generate Solutions, Take Action, Evaluate Outcomes"]
}

Focus on extracting information relevant to nursing education and NCLEX preparation.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a nursing education expert specializing in NCLEX content categorization and nursing curriculum development."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      title: result.title || undefined,
      category: result.category || undefined,
      nursingSpecialty: result.nursingSpecialty || undefined,
      bodySystem: result.bodySystem || undefined,
      diagnoses: Array.isArray(result.diagnoses) ? result.diagnoses : [],
      interventions: Array.isArray(result.interventions) ? result.interventions : [],
      patientProblems: Array.isArray(result.patientProblems) ? result.patientProblems : [],
      concepts: Array.isArray(result.concepts) ? result.concepts : [],
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
      priority: result.priority || 'medium',
      clinicalJudgmentPhase: Array.isArray(result.clinicalJudgmentPhase) ? result.clinicalJudgmentPhase : []
    };
  } catch (error) {
    console.error("AI analysis error:", error);
    // Return empty analysis on error
    return {
      category: 'uncategorized',
      diagnoses: [],
      interventions: [],
      patientProblems: [],
      concepts: [],
      keywords: []
    };
  }
}

// Batch analyze multiple content blocks
export async function batchAnalyzeContent(
  contentBlocks: Array<{ id: string; content: string }>,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, NursingContentAnalysis>> {
  const results = new Map<string, NursingContentAnalysis>();
  
  for (let i = 0; i < contentBlocks.length; i++) {
    const block = contentBlocks[i];
    
    // Add delay to respect rate limits
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const analysis = await analyzeNursingContent(block.content);
    results.set(block.id, analysis);
    
    if (onProgress) {
      onProgress(i + 1, contentBlocks.length);
    }
  }
  
  return results;
}

// Generate a comprehensive summary of content
export async function generateContentSummary(content: string): Promise<string> {
  try {
    if (!openai) {
      const compact = content.replace(/\s+/g, " ").trim();
      return compact.length > 260 ? `${compact.slice(0, 260)}...` : compact || "Summary unavailable";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a nursing educator. Provide concise, educational summaries focused on key nursing concepts."
        },
        {
          role: "user",
          content: `Summarize this nursing content in 2-3 sentences, focusing on the main concept and clinical relevance:\n\n${content.substring(0, 1000)}`
        }
      ],
      max_completion_tokens: 150
    });

    return response.choices[0].message.content || "Summary unavailable";
  } catch (error) {
    console.error("Summary generation error:", error);
    return "Summary generation failed";
  }
}

// Extract learning objectives from content
export async function extractLearningObjectives(content: string): Promise<string[]> {
  try {
    if (!openai) {
      const analysis = heuristicAnalyzeNursingContent(content);
      return [
        `Identify priority cues related to ${analysis.category || "the nursing concept"}.`,
        "Select safe nursing interventions based on the available evidence.",
        "Evaluate whether the expected patient outcome was achieved.",
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Extract 3-5 specific, measurable learning objectives from nursing content."
        },
        {
          role: "user",
          content: `Based on this nursing content, identify the key learning objectives a student should achieve. Provide as a JSON array of strings:\n\n${content.substring(0, 1000)}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"objectives":[]}');
    return result.objectives || [];
  } catch (error) {
    console.error("Learning objectives extraction error:", error);
    return [];
  }
}

// Suggest related topics for comprehensive study
export async function suggestRelatedTopics(content: string): Promise<string[]> {
  try {
    if (!openai) {
      const analysis = heuristicAnalyzeNursingContent(content);
      return Array.from(new Set([
        analysis.category,
        analysis.bodySystem,
        ...(analysis.concepts || []),
        ...(analysis.keywords || []),
      ].filter(Boolean) as string[])).slice(0, 7);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Suggest related nursing topics that students should study alongside this content for comprehensive understanding."
        },
        {
          role: "user",
          content: `Based on this nursing content, suggest 5-7 related topics for comprehensive study. Format as JSON array:\n\n${content.substring(0, 1000)}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || '{"topics":[]}');
    return result.topics || [];
  } catch (error) {
    console.error("Related topics suggestion error:", error);
    return [];
  }
}
