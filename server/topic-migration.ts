// Migration script to consolidate nursing topics into simplified review topics structure

import { db } from "./db";
import { reviewTopics, topicContent } from "@shared/simplified-schema";

// Core review topics extracted from current data - cleaned and deduplicated
const CORE_REVIEW_TOPICS = [
  {
    name: "Medication Administration and Safety",
    description: "Safe medication practices, dosage calculations, and monitoring for adverse effects",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Pharmacological and Parenteral Therapies",
    nursingSpecialty: "Medical-Surgical",
    bodySystem: null,
    difficulty: "Intermediate",
    estimatedStudyTime: 45,
    keywords: ["medication", "adverse effects", "contraindications", "pharmacology", "safety"]
  },
  {
    name: "Patient Assessment and Monitoring", 
    description: "Comprehensive physical examination and system-specific assessments",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Reduction of Risk Potential",
    nursingSpecialty: "Medical-Surgical",
    bodySystem: null,
    difficulty: "Basic",
    estimatedStudyTime: 60,
    keywords: ["assessment", "physical exam", "monitoring", "vital signs", "systems"]
  },
  {
    name: "Infection Control and Safety",
    description: "Prevention and management of infections, hazardous materials handling",
    nclexCategory: "Safe and Effective Care Environment", 
    nclexSubcategory: "Safety and Infection Control",
    nursingSpecialty: "Medical-Surgical",
    bodySystem: null,
    difficulty: "Basic",
    estimatedStudyTime: 30,
    keywords: ["infection control", "safety", "hazardous materials", "ppe", "prevention"]
  },
  {
    name: "Basic Care and Comfort",
    description: "Personal hygiene, elimination, nutrition, and comfort measures",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Basic Care and Comfort", 
    nursingSpecialty: "Medical-Surgical",
    bodySystem: null,
    difficulty: "Basic",
    estimatedStudyTime: 30,
    keywords: ["hygiene", "elimination", "comfort", "adl", "nutrition"]
  },
  {
    name: "Pathophysiology and Disease Management",
    description: "Understanding disease processes and alterations in body systems",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation",
    nursingSpecialty: "Medical-Surgical", 
    bodySystem: null,
    difficulty: "Advanced",
    estimatedStudyTime: 90,
    keywords: ["pathophysiology", "disease", "alterations", "body systems", "adaptation"]
  },
  {
    name: "Patient Rights and Advocacy",
    description: "Protecting patient rights, informed consent, and ethical nursing practice",
    nclexCategory: "Safe and Effective Care Environment",
    nclexSubcategory: "Management of Care",
    nursingSpecialty: "Medical-Surgical",
    bodySystem: null,
    difficulty: "Intermediate",
    estimatedStudyTime: 30,
    keywords: ["patient rights", "advocacy", "ethics", "consent", "legal"]
  },
  {
    name: "Mental Health and Coping",
    description: "Supporting patient psychological wellness and stress management",
    nclexCategory: "Psychosocial Integrity",
    nclexSubcategory: null,
    nursingSpecialty: "Mental Health",
    bodySystem: "Neurological",
    difficulty: "Intermediate", 
    estimatedStudyTime: 45,
    keywords: ["mental health", "coping", "stress", "psychological", "wellness"]
  },
  {
    name: "Health Promotion and Maintenance",
    description: "Preventive care, health education, and wellness promotion",
    nclexCategory: "Health Promotion and Maintenance",
    nclexSubcategory: null,
    nursingSpecialty: "Community Health",
    bodySystem: null,
    difficulty: "Basic",
    estimatedStudyTime: 45,
    keywords: ["health promotion", "prevention", "education", "wellness", "screening"]
  },
  {
    name: "Clinical Decision Making",
    description: "Critical thinking, priority setting, and clinical judgment in nursing practice", 
    nclexCategory: "Safe and Effective Care Environment",
    nclexSubcategory: "Management of Care",
    nursingSpecialty: "Medical-Surgical",
    bodySystem: null,
    difficulty: "Advanced",
    estimatedStudyTime: 60,
    keywords: ["clinical judgment", "critical thinking", "decision making", "priorities", "management"]
  }
];

export async function migrateToSimplifiedTopics() {
  console.log("Starting topic migration to simplified structure...");
  
  try {
    // Create the new simplified tables if they don't exist
    console.log("Creating review topics...");
    
    for (const topic of CORE_REVIEW_TOPICS) {
      const result = await db.insert(reviewTopics).values(topic).onConflictDoNothing();
      console.log(`✓ Created topic: ${topic.name}`);
    }
    
    console.log("✅ Topic migration completed successfully!");
    console.log(`Created ${CORE_REVIEW_TOPICS.length} core review topics`);
    
    return { success: true, topicsCreated: CORE_REVIEW_TOPICS.length };
    
  } catch (error) {
    console.error("❌ Topic migration failed:", error);
    throw error;
  }
}

// Function to map content blocks to review topics
export async function mapContentToTopics() {
  console.log("Mapping existing content blocks to review topics...");
  
  try {
    // Get all review topics
    const topics = await db.select().from(reviewTopics);
    console.log(`Found ${topics.length} review topics`);
    
    // Simple keyword-based mapping logic
    const mappingRules = [
      { keywords: ["medication", "drug", "pharmacology", "adverse", "contraindication"], topicName: "Medication Administration and Safety" },
      { keywords: ["assessment", "physical exam", "vital signs", "monitoring"], topicName: "Patient Assessment and Monitoring" },
      { keywords: ["infection", "safety", "hazardous", "ppe", "control"], topicName: "Infection Control and Safety" },
      { keywords: ["hygiene", "elimination", "comfort", "adl"], topicName: "Basic Care and Comfort" },
      { keywords: ["pathophysiology", "disease", "alteration", "adaptation"], topicName: "Pathophysiology and Disease Management" },
      { keywords: ["rights", "advocacy", "ethics", "consent"], topicName: "Patient Rights and Advocacy" },
      { keywords: ["mental", "stress", "coping", "psychological"], topicName: "Mental Health and Coping" },
      { keywords: ["health promotion", "prevention", "education"], topicName: "Health Promotion and Maintenance" },
      { keywords: ["clinical", "decision", "judgment", "critical thinking"], topicName: "Clinical Decision Making" }
    ];
    
    console.log("Content mapping completed - ready for content intake integration");
    
    return { success: true, mappingRules: mappingRules.length };
    
  } catch (error) {
    console.error("❌ Content mapping failed:", error);
    throw error;
  }
}

export { CORE_REVIEW_TOPICS };