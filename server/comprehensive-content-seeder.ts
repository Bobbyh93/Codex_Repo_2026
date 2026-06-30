import { db } from "./db";
import { contentAreas, nursingTopics, learningResources } from "@shared/schema";
import { 
  nclexTopicCrosswalk,
  topicObjectivesCrosswalk,
  objectiveResourcesCrosswalk,
  atiNclexCrosswalk,
  performancePathCrosswalk,
  studyPathTemplates,
  learningObjectives,
  contentCoverageMatrix
} from "@shared/crosswalk-schema";
import { eq, sql } from "drizzle-orm";

// Comprehensive NCLEX Content Areas with official weights
const NCLEX_CONTENT_AREAS = [
  {
    name: "Management of Care",
    description: "Providing integrated, cost-effective care to clients by coordinating, supervising and/or collaborating with members of the multidisciplinary health care team",
    nclexCategory: "Safe and Effective Care Environment",
    weight: 17, // 17-23% of NCLEX-RN
    subcategories: [
      "Client Rights",
      "Advocacy",
      "Case Management", 
      "Client Care Assignments",
      "Collaboration with Interdisciplinary Team",
      "Concepts of Management",
      "Consultation",
      "Continuity of Care",
      "Delegation",
      "Establishing Priorities",
      "Ethical Practice",
      "Informed Consent",
      "Information Technology",
      "Legal Rights and Responsibilities",
      "Performance Improvement",
      "Referrals",
      "Resource Management",
      "Staff Education",
      "Supervision"
    ]
  },
  {
    name: "Safety and Infection Control", 
    description: "Protecting clients and health care personnel from health and environmental hazards",
    nclexCategory: "Safe and Effective Care Environment",
    weight: 9, // 9-15% of NCLEX-RN
    subcategories: [
      "Accident/Error/Injury Prevention",
      "Emergency Response Plan",
      "Ergonomic Principles",
      "Handling Hazardous and Infectious Materials",
      "Home Safety",
      "Reporting of Incident/Event/Irregular Occurrence/Variance",
      "Safe Use of Equipment",
      "Security Plan",
      "Standard Precautions/Transmission-Based Precautions/Surgical Asepsis",
      "Use of Restraints/Safety Devices"
    ]
  },
  {
    name: "Health Promotion and Maintenance",
    description: "Providing care and education to promote health and prevent disease",
    nclexCategory: "Health Promotion and Maintenance", 
    weight: 6, // 6-12% of NCLEX-RN
    subcategories: [
      "Aging Process",
      "Ante/Intra/Postpartum and Newborn Care",
      "Data Collection Techniques",
      "Developmental Stages and Transitions",
      "Health and Wellness", 
      "Health Promotion/Disease Prevention",
      "Health Screening",
      "High Risk Behaviors",
      "Immunizations",
      "Lifestyle Choices",
      "Self-Care",
      "Techniques of Physical Assessment"
    ]
  },
  {
    name: "Psychosocial Integrity",
    description: "Promoting psychosocial health and adaptation",
    nclexCategory: "Psychosocial Integrity",
    weight: 6, // 6-12% of NCLEX-RN  
    subcategories: [
      "Abuse/Neglect",
      "Behavioral Interventions", 
      "Chemical and Other Dependencies",
      "Coping Mechanisms",
      "Crisis Intervention",
      "Cultural Awareness/Cultural Influences on Health",
      "End of Life Care",
      "Family Dynamics",
      "Grief and Loss",
      "Mental Health Concepts",
      "Religious and Spiritual Influences on Health",
      "Sensory/Perceptual Alterations",
      "Stress Management",
      "Support Systems",
      "Therapeutic Communication",
      "Therapeutic Environment"
    ]
  },
  {
    name: "Basic Care and Comfort",
    description: "Providing comfort and assistance in the performance of activities of daily living",
    nclexCategory: "Physiological Integrity",
    weight: 6, // 6-12% of NCLEX-RN
    subcategories: [
      "Assistive Devices",
      "Elimination",
      "Mobility/Immobility", 
      "Non-pharmacological Comfort Interventions",
      "Nutrition and Oral Hydration",
      "Personal Hygiene",
      "Rest and Sleep"
    ]
  },
  {
    name: "Pharmacological and Parenteral Therapies",
    description: "Providing care related to the administration of medications and parenteral therapies",
    nclexCategory: "Physiological Integrity",
    weight: 12, // 12-18% of NCLEX-RN
    subcategories: [
      "Adverse Effects/Contraindications/Side Effects/Interactions",
      "Blood and Blood Products",
      "Central Venous Access Devices",
      "Dosage Calculation",
      "Expected Actions/Outcomes",
      "Medication Administration",
      "Parenteral/Intravenous Therapies",
      "Pharmacological Pain Management",
      "Total Parenteral Nutrition"
    ]
  },
  {
    name: "Reduction of Risk Potential",
    description: "Reducing the likelihood that clients will develop complications or health problems related to existing conditions, treatments or procedures",
    nclexCategory: "Physiological Integrity", 
    weight: 9, // 9-15% of NCLEX-RN
    subcategories: [
      "Changes/Abnormalities in Vital Signs",
      "Diagnostic Tests",
      "Laboratory Values",
      "Potential for Alterations in Body Systems",
      "Potential for Complications of Diagnostic Tests/Treatments/Procedures",
      "Potential for Complications from Surgical Procedures and Health Alterations",
      "System Specific Assessments",
      "Therapeutic Procedures"
    ]
  },
  {
    name: "Physiological Adaptation",
    description: "Managing care of clients with acute, chronic or life-threatening physical health conditions",
    nclexCategory: "Physiological Integrity",
    weight: 11, // 11-17% of NCLEX-RN
    subcategories: [
      "Alterations in Body Systems",
      "Fluid and Electrolyte Imbalances",
      "Hemodynamics",
      "Illness Management",
      "Infectious Diseases", 
      "Medical Emergencies",
      "Pathophysiology",
      "Unexpected Response to Therapies"
    ]
  }
];

// Comprehensive Learning Objectives with Bloom's Taxonomy
const CORE_LEARNING_OBJECTIVES = [
  // Management of Care Objectives
  {
    objectiveText: "Recognize the legal and ethical responsibilities when delegating nursing tasks",
    bloomsLevel: "Apply",
    practiceArea: "Management of Care",
    clinicalContext: "Leadership and delegation in nursing practice",
    measurable: true,
    assessmentMethod: "case_study"
  },
  {
    objectiveText: "Evaluate the effectiveness of collaborative care plans with interdisciplinary teams",
    bloomsLevel: "Evaluate", 
    practiceArea: "Management of Care",
    clinicalContext: "Team-based healthcare delivery",
    measurable: true,
    assessmentMethod: "simulation"
  },
  {
    objectiveText: "Apply principles of informed consent in patient care situations",
    bloomsLevel: "Apply",
    practiceArea: "Management of Care", 
    clinicalContext: "Patient rights and ethical practice",
    measurable: true,
    assessmentMethod: "mcq"
  },

  // Safety and Infection Control Objectives
  {
    objectiveText: "Demonstrate proper use of standard and transmission-based precautions",
    bloomsLevel: "Apply",
    practiceArea: "Safety and Infection Control",
    clinicalContext: "Prevention of healthcare-associated infections",
    measurable: true,
    assessmentMethod: "demonstration"
  },
  {
    objectiveText: "Analyze potential safety hazards in the healthcare environment",
    bloomsLevel: "Analyze",
    practiceArea: "Safety and Infection Control",
    clinicalContext: "Environmental safety assessment",
    measurable: true,
    assessmentMethod: "case_study"
  },
  {
    objectiveText: "Evaluate the effectiveness of error prevention strategies",
    bloomsLevel: "Evaluate",
    practiceArea: "Safety and Infection Control", 
    clinicalContext: "Quality improvement and patient safety",
    measurable: true,
    assessmentMethod: "simulation"
  },

  // Health Promotion and Maintenance Objectives
  {
    objectiveText: "Assess clients for health promotion and disease prevention needs",
    bloomsLevel: "Analyze",
    practiceArea: "Health Promotion and Maintenance",
    clinicalContext: "Preventive healthcare across the lifespan",
    measurable: true,
    assessmentMethod: "case_study"
  },
  {
    objectiveText: "Create individualized health education plans for diverse populations",
    bloomsLevel: "Create",
    practiceArea: "Health Promotion and Maintenance",
    clinicalContext: "Patient education and health literacy",
    measurable: true,
    assessmentMethod: "case_study"
  },

  // Psychosocial Integrity Objectives
  {
    objectiveText: "Apply therapeutic communication techniques in patient interactions",
    bloomsLevel: "Apply",
    practiceArea: "Psychosocial Integrity",
    clinicalContext: "Nurse-patient therapeutic relationship",
    measurable: true,
    assessmentMethod: "simulation"
  },
  {
    objectiveText: "Evaluate the effectiveness of coping strategies for patients experiencing grief",
    bloomsLevel: "Evaluate",
    practiceArea: "Psychosocial Integrity",
    clinicalContext: "End-of-life and grief counseling",
    measurable: true,
    assessmentMethod: "case_study"
  },

  // Basic Care and Comfort Objectives
  {
    objectiveText: "Implement evidence-based comfort measures for patients in pain",
    bloomsLevel: "Apply",
    practiceArea: "Basic Care and Comfort",
    clinicalContext: "Non-pharmacological pain management",
    measurable: true,
    assessmentMethod: "demonstration"
  },
  {
    objectiveText: "Assess and manage alterations in nutrition and hydration",
    bloomsLevel: "Analyze",
    practiceArea: "Basic Care and Comfort",
    clinicalContext: "Nutritional assessment and intervention",
    measurable: true,
    assessmentMethod: "case_study"
  },

  // Pharmacological and Parenteral Therapies Objectives
  {
    objectiveText: "Calculate medication dosages accurately using dimensional analysis",
    bloomsLevel: "Apply",
    practiceArea: "Pharmacological and Parenteral Therapies",
    clinicalContext: "Safe medication administration",
    measurable: true,
    assessmentMethod: "mcq"
  },
  {
    objectiveText: "Evaluate patient responses to pharmacological interventions", 
    bloomsLevel: "Evaluate",
    practiceArea: "Pharmacological and Parenteral Therapies",
    clinicalContext: "Medication monitoring and effectiveness",
    measurable: true,
    assessmentMethod: "case_study"
  },
  {
    objectiveText: "Analyze potential drug interactions and contraindications",
    bloomsLevel: "Analyze",
    practiceArea: "Pharmacological and Parenteral Therapies",
    clinicalContext: "Medication safety and adverse effects",
    measurable: true,
    assessmentMethod: "mcq"
  },

  // Reduction of Risk Potential Objectives
  {
    objectiveText: "Interpret laboratory values and their clinical significance",
    bloomsLevel: "Analyze",
    practiceArea: "Reduction of Risk Potential",
    clinicalContext: "Laboratory data interpretation",
    measurable: true,
    assessmentMethod: "mcq"
  },
  {
    objectiveText: "Recognize early signs of complications from medical procedures",
    bloomsLevel: "Analyze",
    practiceArea: "Reduction of Risk Potential", 
    clinicalContext: "Post-procedure monitoring",
    measurable: true,
    assessmentMethod: "simulation"
  },

  // Physiological Adaptation Objectives
  {
    objectiveText: "Apply pathophysiological principles to understand disease processes",
    bloomsLevel: "Apply",
    practiceArea: "Physiological Adaptation",
    clinicalContext: "Understanding disease mechanisms",
    measurable: true,
    assessmentMethod: "case_study"
  },
  {
    objectiveText: "Evaluate the effectiveness of interventions for fluid and electrolyte imbalances",
    bloomsLevel: "Evaluate",
    practiceArea: "Physiological Adaptation",
    clinicalContext: "Fluid and electrolyte management",
    measurable: true,
    assessmentMethod: "case_study"
  },
  {
    objectiveText: "Analyze hemodynamic parameters and their clinical implications",
    bloomsLevel: "Analyze",
    practiceArea: "Physiological Adaptation",
    clinicalContext: "Critical care monitoring",
    measurable: true,
    assessmentMethod: "simulation"
  }
];

// ATI to NCLEX Category Mappings
const ATI_NCLEX_MAPPINGS = [
  // ATI Adult Medical Surgical Nursing
  {
    atiCategory: "Adult Medical Surgical Nursing",
    atiSubcategory: "Cardiovascular System",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Adult Medical Surgical Nursing", 
    atiSubcategory: "Respiratory System",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Adult Medical Surgical Nursing",
    atiSubcategory: "Neurological System",
    nclexCategory: "Physiological Integrity", 
    nclexSubcategory: "Physiological Adaptation",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Adult Medical Surgical Nursing",
    atiSubcategory: "Gastrointestinal System",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation", 
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Adult Medical Surgical Nursing",
    atiSubcategory: "Genitourinary System",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation",
    mappingConfidence: 1.0,
    mappingSource: "official", 
    isOfficial: true
  },
  {
    atiCategory: "Adult Medical Surgical Nursing",
    atiSubcategory: "Musculoskeletal System",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Adult Medical Surgical Nursing",
    atiSubcategory: "Endocrine System",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Physiological Adaptation",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },

  // ATI Pharmacology 
  {
    atiCategory: "Pharmacology for Nursing",
    atiSubcategory: "Medication Administration",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Pharmacological and Parenteral Therapies",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Pharmacology for Nursing",
    atiSubcategory: "Dosage Calculation",
    nclexCategory: "Physiological Integrity", 
    nclexSubcategory: "Pharmacological and Parenteral Therapies",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Pharmacology for Nursing",
    atiSubcategory: "Adverse Effects",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Pharmacological and Parenteral Therapies",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },

  // ATI Fundamentals
  {
    atiCategory: "Fundamentals for Nursing",
    atiSubcategory: "Infection Control",
    nclexCategory: "Safe and Effective Care Environment",
    nclexSubcategory: "Safety and Infection Control",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Fundamentals for Nursing",
    atiSubcategory: "Safety",
    nclexCategory: "Safe and Effective Care Environment",
    nclexSubcategory: "Safety and Infection Control", 
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Fundamentals for Nursing",
    atiSubcategory: "Basic Care and Comfort",
    nclexCategory: "Physiological Integrity",
    nclexSubcategory: "Basic Care and Comfort",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },

  // ATI Leadership
  {
    atiCategory: "Leadership and Management",
    atiSubcategory: "Delegation",
    nclexCategory: "Safe and Effective Care Environment",
    nclexSubcategory: "Management of Care",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Leadership and Management",
    atiSubcategory: "Quality Improvement",
    nclexCategory: "Safe and Effective Care Environment",
    nclexSubcategory: "Management of Care",
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },

  // ATI Mental Health
  {
    atiCategory: "Mental Health Nursing",
    atiSubcategory: "Therapeutic Communication",
    nclexCategory: "Psychosocial Integrity",
    nclexSubcategory: null,
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Mental Health Nursing",
    atiSubcategory: "Crisis Intervention", 
    nclexCategory: "Psychosocial Integrity",
    nclexSubcategory: null,
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },

  // ATI Community Health
  {
    atiCategory: "Community Health Nursing",
    atiSubcategory: "Health Promotion",
    nclexCategory: "Health Promotion and Maintenance",
    nclexSubcategory: null,
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  },
  {
    atiCategory: "Community Health Nursing",
    atiSubcategory: "Disease Prevention",
    nclexCategory: "Health Promotion and Maintenance", 
    nclexSubcategory: null,
    mappingConfidence: 1.0,
    mappingSource: "official",
    isOfficial: true
  }
];

// Performance Path Crosswalk Data
const PERFORMANCE_PATH_MAPPINGS = [
  // Remedial Level (Below Passing)
  {
    performanceLevel: "below_passing",
    scoreRange: { min: 0, max: 65 },
    gapType: "knowledge",
    pathTemplateId: crypto.randomUUID(),
    pathName: "Intensive Remedial Study Plan",
    pathType: "remedial",
    estimatedDuration: 120, // 120 hours
    intensityLevel: "intensive",
    focusAreas: ["fundamentals", "basic_care", "safety"],
    prerequisiteScore: 0,
    sequenceRules: {
      mustCompleteFirst: ["fundamentals", "safety"],
      adaptiveBranching: true
    },
    expectedImprovement: 25,
    successRate: 0.75
  },
  {
    performanceLevel: "below_passing",
    scoreRange: { min: 0, max: 65 },
    gapType: "application",
    pathTemplateId: crypto.randomUUID(),
    pathName: "Application-Focused Remedial Plan",
    pathType: "remedial",
    estimatedDuration: 100,
    intensityLevel: "intensive", 
    focusAreas: ["clinical_judgment", "prioritization", "delegation"],
    prerequisiteScore: 50,
    sequenceRules: {
      mustCompleteFirst: ["fundamentals"],
      adaptiveBranching: true
    },
    expectedImprovement: 20,
    successRate: 0.70
  },

  // Near Passing Level
  {
    performanceLevel: "near_passing",
    scoreRange: { min: 66, max: 75 },
    gapType: "critical_thinking",
    pathTemplateId: crypto.randomUUID(),
    pathName: "Focused Critical Thinking Review",
    pathType: "standard", 
    estimatedDuration: 60,
    intensityLevel: "moderate",
    focusAreas: ["critical_thinking", "prioritization", "delegation"],
    prerequisiteScore: 60,
    sequenceRules: {
      mustCompleteFirst: ["assessment_skills"],
      adaptiveBranching: true
    },
    expectedImprovement: 15,
    successRate: 0.85
  },

  // Proficient Level
  {
    performanceLevel: "proficient",
    scoreRange: { min: 76, max: 85 },
    gapType: "knowledge",
    pathTemplateId: crypto.randomUUID(),
    pathName: "Targeted Knowledge Enhancement", 
    pathType: "standard",
    estimatedDuration: 40,
    intensityLevel: "moderate",
    focusAreas: ["advanced_concepts", "specialty_areas"],
    prerequisiteScore: 70,
    sequenceRules: {
      canSkipIf: { "fundamentals": 85 },
      adaptiveBranching: false
    },
    expectedImprovement: 10,
    successRate: 0.90
  },

  // Advanced Level
  {
    performanceLevel: "advanced",
    scoreRange: { min: 86, max: 100 },
    gapType: "application",
    pathTemplateId: crypto.randomUUID(),
    pathName: "Mastery Maintenance Plan",
    pathType: "mastery",
    estimatedDuration: 20,
    intensityLevel: "light",
    focusAreas: ["leadership", "complex_cases", "research"],
    prerequisiteScore: 85,
    sequenceRules: {
      adaptiveBranching: false
    },
    expectedImprovement: 5,
    successRate: 0.95
  }
];

// Study Path Templates
const STUDY_PATH_TEMPLATES_DATA = [
  {
    name: "NCLEX-RN Comprehensive Review",
    description: "Complete review of all NCLEX-RN content areas for first-time test takers",
    pathType: "standard",
    targetAudience: "nclex_prep",
    experienceLevel: "intermediate",
    totalModules: 8,
    totalHours: 120,
    moduleSequence: [
      {
        moduleId: "safety-care-env",
        moduleName: "Safe and Effective Care Environment", 
        topics: ["management_of_care", "safety_infection_control"],
        objectives: ["delegation", "prioritization", "infection_control"],
        resources: ["textbook", "video", "quiz"],
        duration: 20,
        order: 1
      },
      {
        moduleId: "health-promotion",
        moduleName: "Health Promotion and Maintenance",
        topics: ["health_screening", "disease_prevention", "growth_development"],
        objectives: ["health_assessment", "patient_education"], 
        resources: ["textbook", "video", "simulation"],
        duration: 15,
        order: 2
      },
      {
        moduleId: "psychosocial",
        moduleName: "Psychosocial Integrity",
        topics: ["therapeutic_communication", "coping_mechanisms", "mental_health"],
        objectives: ["communication_skills", "crisis_intervention"],
        resources: ["textbook", "video", "case_study"],
        duration: 15,
        order: 3
      },
      {
        moduleId: "phys-integrity-basic",
        moduleName: "Physiological Integrity - Basic Care",
        topics: ["basic_care_comfort", "elimination", "nutrition"],
        objectives: ["comfort_measures", "adl_assistance"],
        resources: ["textbook", "video", "demonstration"],
        duration: 20,
        order: 4
      },
      {
        moduleId: "phys-integrity-pharm",
        moduleName: "Physiological Integrity - Pharmacology",
        topics: ["medication_admin", "dosage_calc", "adverse_effects"],
        objectives: ["safe_medication_practice", "dosage_calculation"],
        resources: ["textbook", "video", "quiz", "calculator"],
        duration: 25,
        order: 5
      },
      {
        moduleId: "phys-integrity-risk",
        moduleName: "Physiological Integrity - Risk Reduction", 
        topics: ["diagnostic_tests", "lab_values", "complications"],
        objectives: ["test_interpretation", "complication_prevention"],
        resources: ["textbook", "video", "simulation"],
        duration: 15,
        order: 6
      },
      {
        moduleId: "phys-integrity-adapt", 
        moduleName: "Physiological Integrity - Adaptation",
        topics: ["pathophysiology", "fluid_electrolytes", "hemodynamics"],
        objectives: ["disease_management", "critical_thinking"],
        resources: ["textbook", "video", "case_study"],
        duration: 25,
        order: 7
      },
      {
        moduleId: "integration-review",
        moduleName: "Integration and Final Review",
        topics: ["comprehensive_review", "test_strategies"],
        objectives: ["test_taking_skills", "knowledge_integration"],
        resources: ["practice_tests", "review_sessions"],
        duration: 15,
        order: 8
      }
    ],
    isCustomizable: true,
    customizationRules: {
      allowModuleSkip: true,
      adaptivePacing: true,
      prerequisiteEnforcement: true
    },
    completionCriteria: {
      moduleCompletion: 100,
      practiceTestScore: 75,
      timeSpent: 80 // percentage of estimated time
    },
    assessmentPoints: [25, 50, 75, 100], // Module completion percentages for assessment
    isPublished: true,
    version: 1
  },
  {
    name: "Remedial Nursing Fundamentals",
    description: "Intensive review of nursing fundamentals for students needing additional support",
    pathType: "remedial",
    targetAudience: "remedial",
    experienceLevel: "beginner",
    totalModules: 6,
    totalHours: 80,
    moduleSequence: [
      {
        moduleId: "nursing-foundations",
        moduleName: "Foundations of Nursing Practice",
        topics: ["nursing_process", "critical_thinking", "professional_standards"],
        objectives: ["nursing_process_application", "professional_behavior"],
        resources: ["textbook", "video", "workbook"],
        duration: 15,
        order: 1
      },
      {
        moduleId: "safety-fundamentals",
        moduleName: "Safety and Infection Control Fundamentals", 
        topics: ["hand_hygiene", "standard_precautions", "patient_safety"],
        objectives: ["infection_prevention", "safety_protocols"],
        resources: ["textbook", "video", "demonstration"],
        duration: 15,
        order: 2
      },
      {
        moduleId: "basic-nursing-skills",
        moduleName: "Basic Nursing Skills",
        topics: ["vital_signs", "hygiene_care", "mobility"],
        objectives: ["skill_performance", "patient_comfort"],
        resources: ["textbook", "video", "skills_lab"],
        duration: 20,
        order: 3
      },
      {
        moduleId: "medication-basics",
        moduleName: "Medication Administration Basics",
        topics: ["rights_of_medication", "calculation_basics", "safety_checks"],
        objectives: ["safe_medication_admin", "basic_calculations"],
        resources: ["textbook", "video", "calculator", "quiz"],
        duration: 15,
        order: 4
      },
      {
        moduleId: "documentation-communication",
        moduleName: "Documentation and Communication",
        topics: ["charting", "reporting", "therapeutic_communication"],
        objectives: ["effective_documentation", "communication_skills"],
        resources: ["textbook", "video", "practice_scenarios"],
        duration: 10,
        order: 5
      },
      {
        moduleId: "integration-practice",
        moduleName: "Integration and Practice",
        topics: ["case_studies", "skill_integration", "test_preparation"],
        objectives: ["knowledge_application", "confidence_building"],
        resources: ["case_studies", "practice_tests", "review"],
        duration: 5,
        order: 6
      }
    ],
    isCustomizable: true,
    customizationRules: {
      allowModuleSkip: false,
      adaptivePacing: true,
      prerequisiteEnforcement: true
    },
    completionCriteria: {
      moduleCompletion: 100,
      skillsDemonstration: 80,
      timeSpent: 90
    },
    assessmentPoints: [16, 33, 50, 66, 83, 100],
    isPublished: true,
    version: 1
  }
];

export async function seedComprehensiveContent() {
  console.log("🌱 Starting comprehensive content seeding...");

  try {
    // 1. Seed enhanced content areas
    console.log("📚 Seeding NCLEX content areas...");
    const existingAreas = await db.select().from(contentAreas);
    
    if (existingAreas.length === 0) {
      for (const area of NCLEX_CONTENT_AREAS) {
        await db.insert(contentAreas).values({
          name: area.name,
          description: area.description,
          nclexCategory: area.nclexCategory
        });
      }
      console.log(`✅ Seeded ${NCLEX_CONTENT_AREAS.length} content areas`);
    } else {
      console.log("📚 Content areas already exist, skipping...");
    }

    // 2. Seed learning objectives
    console.log("🎯 Seeding learning objectives...");
    const existingObjectives = await db.select().from(learningObjectives);
    
    if (existingObjectives.length === 0) {
      for (const objective of CORE_LEARNING_OBJECTIVES) {
        await db.insert(learningObjectives).values(objective);
      }
      console.log(`✅ Seeded ${CORE_LEARNING_OBJECTIVES.length} learning objectives`);
    } else {
      console.log("🎯 Learning objectives already exist, skipping...");
    }

    // 3. Seed ATI-NCLEX crosswalk mappings
    console.log("🔗 Seeding ATI-NCLEX crosswalk mappings...");
    const existingATIMappings = await db.select().from(atiNclexCrosswalk);
    
    if (existingATIMappings.length === 0) {
      for (const mapping of ATI_NCLEX_MAPPINGS) {
        await db.insert(atiNclexCrosswalk).values({
          ...mapping,
          lastValidated: new Date(),
          validatedBy: "system"
        });
      }
      console.log(`✅ Seeded ${ATI_NCLEX_MAPPINGS.length} ATI-NCLEX mappings`);
    } else {
      console.log("🔗 ATI-NCLEX mappings already exist, skipping...");
    }

    // 4. Seed performance path crosswalks
    console.log("📈 Seeding performance path crosswalks...");
    const existingPerfPaths = await db.select().from(performancePathCrosswalk);
    
    if (existingPerfPaths.length === 0) {
      for (const pathMapping of PERFORMANCE_PATH_MAPPINGS) {
        await db.insert(performancePathCrosswalk).values(pathMapping);
      }
      console.log(`✅ Seeded ${PERFORMANCE_PATH_MAPPINGS.length} performance path mappings`);
    } else {
      console.log("📈 Performance path mappings already exist, skipping...");
    }

    // 5. Seed study path templates
    console.log("📋 Seeding study path templates...");
    const existingTemplates = await db.select().from(studyPathTemplates);
    
    if (existingTemplates.length === 0) {
      for (const template of STUDY_PATH_TEMPLATES_DATA) {
        await db.insert(studyPathTemplates).values({
          ...template,
          publishedAt: new Date(),
          createdBy: "system"
        });
      }
      console.log(`✅ Seeded ${STUDY_PATH_TEMPLATES_DATA.length} study path templates`);
    } else {
      console.log("📋 Study path templates already exist, skipping...");
    }

    console.log("🎉 Comprehensive content seeding completed successfully!");
    
    // Return summary
    return {
      success: true,
      summary: {
        contentAreas: NCLEX_CONTENT_AREAS.length,
        learningObjectives: CORE_LEARNING_OBJECTIVES.length,
        atiMappings: ATI_NCLEX_MAPPINGS.length,
        performancePaths: PERFORMANCE_PATH_MAPPINGS.length,
        studyTemplates: STUDY_PATH_TEMPLATES_DATA.length
      }
    };

  } catch (error) {
    console.error("❌ Error during comprehensive content seeding:", error);
    throw error;
  }
}

// Function to seed topic-objective crosswalks
export async function seedTopicObjectiveCrosswalks() {
  console.log("🔗 Creating topic-objective crosswalks...");
  
  try {
    // Get all topics and objectives
    const topics = await db.select().from(nursingTopics);
    const objectives = await db.select().from(learningObjectives);
    
    const crosswalks = [];
    
    // Create mappings based on practice area matching
    for (const topic of topics) {
      const matchingObjectives = objectives.filter(obj => {
        // Match based on content area or keywords
        const topicKeywords = topic.keywords || [];
        const topicName = topic.name.toLowerCase();
        const objectiveText = obj.objectiveText.toLowerCase();
        
        // Direct matching logic
        if (topicName.includes('medication') && obj.practiceArea === 'Pharmacological and Parenteral Therapies') return true;
        if (topicName.includes('infection') && obj.practiceArea === 'Safety and Infection Control') return true;
        if (topicName.includes('safety') && obj.practiceArea === 'Safety and Infection Control') return true;
        if (topicName.includes('communication') && obj.practiceArea === 'Psychosocial Integrity') return true;
        if (topicName.includes('delegation') && obj.practiceArea === 'Management of Care') return true;
        if (topicName.includes('assessment') && obj.practiceArea === 'Reduction of Risk Potential') return true;
        
        // Keyword matching
        return topicKeywords.some(keyword => 
          objectiveText.includes(keyword.toLowerCase())
        );
      });
      
      // Create crosswalk entries
      matchingObjectives.forEach((objective, index) => {
        crosswalks.push({
          topicId: topic.id,
          topicName: topic.name,
          objectiveId: objective.id,
          objectiveText: objective.objectiveText,
          bloomsLevel: objective.bloomsLevel,
          isCore: index === 0, // First match is core
          orderIndex: index + 1,
          estimatedTime: objective.bloomsLevel === 'Apply' ? 45 : 
                        objective.bloomsLevel === 'Analyze' ? 60 :
                        objective.bloomsLevel === 'Evaluate' ? 75 :
                        objective.bloomsLevel === 'Create' ? 90 : 30,
          assessmentAlignment: {
            ati: true,
            nclex: true,
            kaplan: false,
            hesi: false
          }
        });
      });
    }
    
    // Insert crosswalks
    if (crosswalks.length > 0) {
      await db.insert(topicObjectivesCrosswalk).values(crosswalks);
      console.log(`✅ Created ${crosswalks.length} topic-objective crosswalks`);
    }
    
    return crosswalks.length;
    
  } catch (error) {
    console.error("❌ Error creating topic-objective crosswalks:", error);
    throw error;
  }
}

// Function to run all seeding
export async function runComprehensiveSeeding() {
  console.log("🚀 Starting complete comprehensive content seeding...");
  
  try {
    // Run main content seeding
    const mainResult = await seedComprehensiveContent();
    
    // Create topic-objective crosswalks
    const crosswalkCount = await seedTopicObjectiveCrosswalks();
    
    console.log("🎊 All comprehensive seeding completed!");
    console.log("📊 Seeding Summary:");
    console.log(`   • Content Areas: ${mainResult.summary.contentAreas}`);
    console.log(`   • Learning Objectives: ${mainResult.summary.learningObjectives}`);
    console.log(`   • ATI Mappings: ${mainResult.summary.atiMappings}`);
    console.log(`   • Performance Paths: ${mainResult.summary.performancePaths}`);
    console.log(`   • Study Templates: ${mainResult.summary.studyTemplates}`);
    console.log(`   • Topic-Objective Crosswalks: ${crosswalkCount}`);
    
    return {
      success: true,
      totalSeeded: Object.values(mainResult.summary).reduce((a, b) => a + b, 0) + crosswalkCount
    };
    
  } catch (error) {
    console.error("💥 Comprehensive seeding failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}