import { db } from "./db";
import { reviewTopics } from "@shared/simplified-schema";

export const ATI_EXCEL_TOPICS = [
  { name: "Basic Care and Comfort", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Safety and Infection Control", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Management of Care", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Health Promotion and Maintenance", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Reduction of Risk Potential", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Accident/Error/Injury Prevention", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Pharmacological and Parenteral Therapies", nclexCategory: "Physiological Integrity", nclexSubcategory: "Pharmacological and Parenteral Therapies", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Psychosocial Integrity", nclexCategory: "Psychosocial Integrity", nclexSubcategory: "Psychosocial Integrity", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Medication Administration", nclexCategory: "Physiological Integrity", nclexSubcategory: "Pharmacological and Parenteral Therapies", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Physiological Adaptation", nclexCategory: "Physiological Integrity", nclexSubcategory: "Physiological Adaptation", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Information Technology", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Standard Precautions/Transmission-Based Precautions/Surgical Asepsis", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Alterations in Body Systems", nclexCategory: "Physiological Integrity", nclexSubcategory: "Physiological Adaptation", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Mobility/Immobility", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Health Promotion/Disease Prevention", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Non-Pharmacological Comfort Interventions", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Potential for Complications of Diagnostic Tests/Treatments/Procedures", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Continuity of Care", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Nutrition and Oral Hydration", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Coping Mechanisms", nclexCategory: "Psychosocial Integrity", nclexSubcategory: "Psychosocial Integrity", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Techniques of Physical Assessment", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Parenteral/Intravenous Therapies", nclexCategory: "Physiological Integrity", nclexSubcategory: "Pharmacological and Parenteral Therapies", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Establishing Priorities", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Aging Process", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Therapeutic Procedures", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Legal Rights and Responsibilities", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Health Screening", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Advocacy", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "End-of-Life Care", nclexCategory: "Psychosocial Integrity", nclexSubcategory: "Psychosocial Integrity", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Rest and Sleep", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Safe Use of Equipment", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Changes/Abnormalities in Vital Signs", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "System Specific Assessments", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Therapeutic Communication", nclexCategory: "Psychosocial Integrity", nclexSubcategory: "Psychosocial Integrity", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Reporting of Incident/Event/Irregular Occurrence/Variance", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Assistive Devices", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Pharmacological Pain Management", nclexCategory: "Physiological Integrity", nclexSubcategory: "Pharmacological and Parenteral Therapies", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Client Rights", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Use of Restraints/Safety Devices", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Elimination", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Informed Consent", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Potential for Alterations in Body Systems", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Clinical Judgment", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Analyze Cues", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Grief and Loss", nclexCategory: "Psychosocial Integrity", nclexSubcategory: "Psychosocial Integrity", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Concepts of Management", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Pathophysiology", nclexCategory: "Physiological Integrity", nclexSubcategory: "Physiological Adaptation", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Referrals", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Assignment, Delegation and Supervision", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Developmental Stages and Transitions", nclexCategory: "Health Promotion and Maintenance", nclexSubcategory: "Health Promotion and Maintenance", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Diagnostic Tests", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Advanced", estimatedStudyTime: 45 },
  { name: "Handling Hazardous and Infectious Materials", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Dosage Calculation", nclexCategory: "Physiological Integrity", nclexSubcategory: "Pharmacological and Parenteral Therapies", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Personal Hygiene", nclexCategory: "Physiological Integrity", nclexSubcategory: "Basic Care and Comfort", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Laboratory Values", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Fluid and Electrolyte Imbalances", nclexCategory: "Physiological Integrity", nclexSubcategory: "Reduction of Risk Potential", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Stress Management", nclexCategory: "Psychosocial Integrity", nclexSubcategory: "Psychosocial Integrity", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Home Safety", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Ergonomic Principles", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Safety and Infection Control", difficulty: "Basic", estimatedStudyTime: 25 },
  { name: "Advance Directives/Self-Determination/Life Planning", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Ethical Practice", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Intermediate", estimatedStudyTime: 35 },
  { name: "Confidentiality/Information Security", nclexCategory: "Safe and Effective Care Environment", nclexSubcategory: "Management of Care", difficulty: "Basic", estimatedStudyTime: 25 },
];

export async function seedATIExcelTopics(): Promise<{ inserted: number; skipped: number }> {
  const existingRows = await db
    .select({ name: reviewTopics.name })
    .from(reviewTopics);

  const existingNames = new Set(existingRows.map((r) => r.name.toLowerCase()));

  const toInsert = ATI_EXCEL_TOPICS.filter(
    (t) => !existingNames.has(t.name.toLowerCase()),
  );

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: ATI_EXCEL_TOPICS.length };
  }

  await db.insert(reviewTopics).values(
    toInsert.map((t) => ({
      name: t.name,
      nclexCategory: t.nclexCategory,
      nclexSubcategory: t.nclexSubcategory,
      difficulty: t.difficulty,
      estimatedStudyTime: t.estimatedStudyTime,
      isActive: true,
    })),
  );

  return { inserted: toInsert.length, skipped: ATI_EXCEL_TOPICS.length - toInsert.length };
}
