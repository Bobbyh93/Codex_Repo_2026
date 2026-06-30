// Master Topics to Review list organized by Subject → System → Topic
export const masterTopicsList = [
  // FUNDAMENTALS
  {
    subject: "Fundamentals",
    system: null,
    topics: [
      { name: "Infection Control", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Hand Hygiene", difficulty: "Basic", estimatedStudyTime: 20 },
      { name: "Standard Precautions", difficulty: "Basic", estimatedStudyTime: 25 },
      { name: "Isolation Precautions", difficulty: "Intermediate", estimatedStudyTime: 30 },
      { name: "Vital Signs Assessment", difficulty: "Basic", estimatedStudyTime: 25 },
      { name: "Medication Administration", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Safe Medication Practices", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Patient Safety", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Fall Prevention", difficulty: "Basic", estimatedStudyTime: 25 },
      { name: "Documentation", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Therapeutic Communication", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Cultural Competence", difficulty: "Intermediate", estimatedStudyTime: 30 },
      { name: "Patient Education", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Wound Care", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Pressure Injury Prevention", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Mobility and Positioning", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Hygiene Care", difficulty: "Basic", estimatedStudyTime: 25 },
      { name: "Nutrition and Hydration", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Pain Management", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Sleep and Rest", difficulty: "Basic", estimatedStudyTime: 25 }
    ]
  },
  
  // MEDICAL-SURGICAL - CARDIOVASCULAR
  {
    subject: "Medical-Surgical",
    system: "Cardiovascular",
    topics: [
      { name: "Heart Failure", difficulty: "Advanced", estimatedStudyTime: 60 },
      { name: "Myocardial Infarction", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Hypertension", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Coronary Artery Disease", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Dysrhythmias", difficulty: "Advanced", estimatedStudyTime: 60 },
      { name: "Atrial Fibrillation", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Peripheral Vascular Disease", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Deep Vein Thrombosis", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Pulmonary Embolism", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Cardiac Catheterization", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Pacemaker Management", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Cardiac Medications", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "EKG Interpretation", difficulty: "Advanced", estimatedStudyTime: 60 },
      { name: "Shock States", difficulty: "Advanced", estimatedStudyTime: 55 }
    ]
  },
  
  // MEDICAL-SURGICAL - RESPIRATORY
  {
    subject: "Medical-Surgical",
    system: "Respiratory",
    topics: [
      { name: "COPD", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Asthma", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Pneumonia", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Tuberculosis", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Pulmonary Edema", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Acute Respiratory Distress Syndrome", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Mechanical Ventilation", difficulty: "Advanced", estimatedStudyTime: 60 },
      { name: "Oxygen Therapy", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Chest Tubes", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Pneumothorax", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Lung Cancer", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Respiratory Assessment", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "ABG Interpretation", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Bronchodilators", difficulty: "Intermediate", estimatedStudyTime: 40 }
    ]
  },
  
  // MEDICAL-SURGICAL - NEUROLOGICAL
  {
    subject: "Medical-Surgical",
    system: "Neurological",
    topics: [
      { name: "Stroke", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Seizure Disorders", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Head Injuries", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Spinal Cord Injuries", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Meningitis", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Multiple Sclerosis", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Parkinson's Disease", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Alzheimer's Disease", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Increased Intracranial Pressure", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Neurological Assessment", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Glasgow Coma Scale", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Autonomic Dysreflexia", difficulty: "Advanced", estimatedStudyTime: 45 }
    ]
  },
  
  // MEDICAL-SURGICAL - GASTROINTESTINAL
  {
    subject: "Medical-Surgical",
    system: "Gastrointestinal",
    topics: [
      { name: "Peptic Ulcer Disease", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "GERD", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Inflammatory Bowel Disease", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Crohn's Disease", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Ulcerative Colitis", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Cirrhosis", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Hepatitis", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Pancreatitis", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Cholecystitis", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Bowel Obstruction", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Gastrointestinal Bleeding", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Colorectal Cancer", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Enteral Nutrition", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Total Parenteral Nutrition", difficulty: "Advanced", estimatedStudyTime: 45 }
    ]
  },
  
  // MEDICAL-SURGICAL - RENAL
  {
    subject: "Medical-Surgical",
    system: "Renal",
    topics: [
      { name: "Acute Kidney Injury", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Chronic Kidney Disease", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Dialysis", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Kidney Transplant", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Urinary Tract Infection", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Kidney Stones", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Fluid and Electrolyte Balance", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Acid-Base Imbalances", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Urinary Catheterization", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Bladder Cancer", difficulty: "Intermediate", estimatedStudyTime: 45 }
    ]
  },
  
  // MEDICAL-SURGICAL - ENDOCRINE
  {
    subject: "Medical-Surgical",
    system: "Endocrine",
    topics: [
      { name: "Diabetes Mellitus Type 1", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Diabetes Mellitus Type 2", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Diabetic Ketoacidosis", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Hyperosmolar Hyperglycemic State", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Hypoglycemia", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Thyroid Disorders", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Hyperthyroidism", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Hypothyroidism", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Cushing's Syndrome", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Addison's Disease", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "SIADH", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Diabetes Insipidus", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Insulin Administration", difficulty: "Intermediate", estimatedStudyTime: 40 }
    ]
  },
  
  // PEDIATRICS
  {
    subject: "Pediatrics",
    system: null,
    topics: [
      { name: "Growth and Development", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Immunization Schedule", difficulty: "Basic", estimatedStudyTime: 35 },
      { name: "Pediatric Vital Signs", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Pediatric Medication Dosing", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Respiratory Syncytial Virus", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Croup", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Epiglottitis", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Asthma in Children", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Congenital Heart Defects", difficulty: "Advanced", estimatedStudyTime: 60 },
      { name: "Kawasaki Disease", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Dehydration in Children", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Febrile Seizures", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Juvenile Diabetes", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Wilms Tumor", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Leukemia in Children", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Child Abuse Recognition", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "ADHD", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Autism Spectrum Disorder", difficulty: "Intermediate", estimatedStudyTime: 45 }
    ]
  },
  
  // MATERNAL AND NEWBORN
  {
    subject: "Maternal and Newborn",
    system: null,
    topics: [
      { name: "Prenatal Care", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Pregnancy Complications", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Gestational Diabetes", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Preeclampsia", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "HELLP Syndrome", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Placenta Previa", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Placental Abruption", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Labor and Delivery", difficulty: "Advanced", estimatedStudyTime: 60 },
      { name: "Fetal Monitoring", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Cesarean Section", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Postpartum Hemorrhage", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Newborn Assessment", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "APGAR Scoring", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Breastfeeding", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Neonatal Jaundice", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Respiratory Distress Syndrome", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Neonatal Abstinence Syndrome", difficulty: "Advanced", estimatedStudyTime: 45 }
    ]
  },
  
  // MENTAL HEALTH
  {
    subject: "Mental Health",
    system: null,
    topics: [
      { name: "Depression", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Anxiety Disorders", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Bipolar Disorder", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Schizophrenia", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Personality Disorders", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "PTSD", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Substance Use Disorders", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Suicide Prevention", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Therapeutic Communication in Mental Health", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Psychotropic Medications", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Antidepressants", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Antipsychotics", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Mood Stabilizers", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Anxiolytics", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "ECT Therapy", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Restraints and Seclusion", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Eating Disorders", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Dementia Care", difficulty: "Advanced", estimatedStudyTime: 50 }
    ]
  },
  
  // PHARMACOLOGY
  {
    subject: "Pharmacology",
    system: null,
    topics: [
      { name: "Pharmacokinetics", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Pharmacodynamics", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Drug Calculations", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Medication Rights", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Adverse Drug Reactions", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Drug Interactions", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Antibiotics", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Anticoagulants", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Cardiac Glycosides", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "ACE Inhibitors", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Beta Blockers", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Diuretics", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Insulin Types", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Oral Antidiabetics", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Pain Medications", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Opioid Management", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Chemotherapy Drugs", difficulty: "Advanced", estimatedStudyTime: 55 },
      { name: "Immunosuppressants", difficulty: "Advanced", estimatedStudyTime: 45 }
    ]
  },
  
  // COMMUNITY HEALTH
  {
    subject: "Community Health",
    system: null,
    topics: [
      { name: "Health Promotion", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Disease Prevention", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Epidemiology", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Public Health Emergencies", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Disaster Management", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "Triage", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Communicable Diseases", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Vaccine Administration", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Home Health Nursing", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "School Nursing", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Occupational Health", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Environmental Health", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Health Disparities", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Cultural Health Practices", difficulty: "Intermediate", estimatedStudyTime: 35 }
    ]
  },
  
  // LEADERSHIP
  {
    subject: "Leadership",
    system: null,
    topics: [
      { name: "Delegation", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Prioritization", difficulty: "Intermediate", estimatedStudyTime: 45 },
      { name: "Time Management", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Conflict Resolution", difficulty: "Intermediate", estimatedStudyTime: 40 },
      { name: "Team Collaboration", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Quality Improvement", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Risk Management", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Ethical Decision Making", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Legal Issues in Nursing", difficulty: "Advanced", estimatedStudyTime: 50 },
      { name: "HIPAA Compliance", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Informed Consent", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Advance Directives", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "End-of-Life Care", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Patient Advocacy", difficulty: "Intermediate", estimatedStudyTime: 35 },
      { name: "Professional Development", difficulty: "Basic", estimatedStudyTime: 30 },
      { name: "Evidence-Based Practice", difficulty: "Advanced", estimatedStudyTime: 45 },
      { name: "Nursing Research", difficulty: "Advanced", estimatedStudyTime: 50 }
    ]
  }
];

export const nursingSubjects = [
  { code: "FUND", name: "Fundamentals", description: "Basic nursing skills and foundational concepts", orderIndex: 1, color: "#4CAF50" },
  { code: "MEDSURG", name: "Medical-Surgical", description: "Adult health nursing across body systems", orderIndex: 2, color: "#2196F3" },
  { code: "PEDS", name: "Pediatrics", description: "Nursing care for infants, children, and adolescents", orderIndex: 3, color: "#FF9800" },
  { code: "MATERNITY", name: "Maternal and Newborn", description: "Pregnancy, labor, delivery, and newborn care", orderIndex: 4, color: "#E91E63" },
  { code: "MENTAL", name: "Mental Health", description: "Psychiatric and mental health nursing", orderIndex: 5, color: "#9C27B0" },
  { code: "PHARM", name: "Pharmacology", description: "Medication administration and drug therapy", orderIndex: 6, color: "#00BCD4" },
  { code: "COMMUNITY", name: "Community Health", description: "Public health and community nursing", orderIndex: 7, color: "#8BC34A" },
  { code: "LEADERSHIP", name: "Leadership", description: "Management, delegation, and professional practice", orderIndex: 8, color: "#795548" }
];

export const bodySystems = [
  { code: "CARDIO", name: "Cardiovascular", description: "Heart and blood vessels", orderIndex: 1, color: "#F44336" },
  { code: "RESP", name: "Respiratory", description: "Lungs and breathing", orderIndex: 2, color: "#03A9F4" },
  { code: "NEURO", name: "Neurological", description: "Brain, spinal cord, and nerves", orderIndex: 3, color: "#673AB7" },
  { code: "GI", name: "Gastrointestinal", description: "Digestive system", orderIndex: 4, color: "#FFC107" },
  { code: "RENAL", name: "Renal", description: "Kidneys and urinary system", orderIndex: 5, color: "#009688" },
  { code: "ENDO", name: "Endocrine", description: "Hormones and metabolism", orderIndex: 6, color: "#FF5722" },
  { code: "MUSCULO", name: "Musculoskeletal", description: "Bones, muscles, and joints", orderIndex: 7, color: "#607D8B" },
  { code: "IMMUNE", name: "Immune", description: "Immune system and blood", orderIndex: 8, color: "#4CAF50" },
  { code: "INTEG", name: "Integumentary", description: "Skin and wound care", orderIndex: 9, color: "#795548" },
  { code: "REPRO", name: "Reproductive", description: "Reproductive health", orderIndex: 10, color: "#E91E63" }
];