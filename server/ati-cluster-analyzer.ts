import { ATITopic } from './ati-parser';

export interface TopicCluster {
  name: string;
  topics: ATITopic[];
  bodySystem?: string;
  population?: string;
}

export interface CJMPhaseGroup {
  phase: string;
  topics: ATITopic[];
}

export interface FocusedCluster {
  name: string;
  specialty: string;
  topics: ATITopic[];
  cjmGroups: CJMPhaseGroup[];
  adpiFocus: string;
  bodySystem?: string;
  population?: string;
}

export interface FocusedStudyPlan {
  specialty: string;
  clusters: FocusedCluster[];
  allAltTopics: ATITopic[];
}

const ALT_TYPE_PRIORITY: Record<string, number> = {
  'System Disorder': 1,
  'Nursing Skill': 2,
  'Nursing Intervention': 2,
  'Medication': 3,
  'Pharmacology': 3,
  'Basic Concept': 4,
  'Therapeutic Procedure': 4,
  'Health Promotion': 5,
};

function altTypePriority(altType?: string): number {
  if (!altType) return 99;
  for (const [key, val] of Object.entries(ALT_TYPE_PRIORITY)) {
    if (altType.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 6;
}

// ── Subject specialty detection ────────────────────────────────────────────
// Order matters: more specific specialties are checked before the Med-Surg catch-all
const SUBJECT_SPECIALTY_KEYWORDS: Array<{ specialty: string; keywords: string[] }> = [
  {
    specialty: 'OB/Maternal-Newborn',
    keywords: [
      'obstetric', 'maternal', 'prenatal', 'antepartum', 'postpartum', 'intrapartum',
      'labor', 'delivery', 'newborn', 'neonatal', 'gestational', 'preeclampsia',
      'eclampsia', 'placenta', 'breastfeeding', 'lactation', 'gravida', 'para',
      'miscarriage', 'ectopic', 'cesarean', 'oxytocin', 'nicu',
    ],
  },
  {
    specialty: 'Pediatrics',
    keywords: [
      'pediatric', 'child', 'infant', 'toddler', 'adolescent', 'school-age',
      'neonate', 'growth and development', 'immunization schedule',
    ],
  },
  {
    specialty: 'Mental Health',
    keywords: [
      'mental health', 'psychiatric', 'anxiety', 'depression', 'bipolar', 'schizophrenia',
      'psychosis', 'eating disorder', 'substance use', 'alcohol use disorder', 'opioid use',
      'suicide', 'ptsd', 'therapeutic communication', 'de-escalation', 'behavior management',
      'personality disorder', 'addiction', 'hallucination', 'delusion', 'mania',
    ],
  },
  {
    specialty: 'Pharmacology',
    keywords: [
      'pharmacology', 'drug interaction', 'medication class', 'dosage calculation',
      'antibiotic coverage', 'antihypertensive class', 'analgesic ladder',
      'anticoagulation therapy', 'antidepressant mechanism', 'antipsychotic agent',
      'chemotherapy agent', 'immunosuppressant therapy',
    ],
  },
  {
    specialty: 'Fundamentals',
    keywords: [
      'fundamental', 'basic care', 'infection control', 'standard precaution',
      'isolation precaution', 'hand hygiene', 'mobility', 'body mechanics', 'hygiene',
      'elimination', 'nutrition', 'oxygenation', 'fluid balance', 'skin integrity',
      'wound care', 'vital signs', 'documentation', 'delegation', 'fall prevention',
      'legal ethical', 'scope of practice', 'nursing process',
    ],
  },
];

export function detectSubjectSpecialty(topic: ATITopic): string {
  const text = `${topic.name} ${topic.subcategory ?? ''} ${topic.category}`.toLowerCase();
  for (const { specialty, keywords } of SUBJECT_SPECIALTY_KEYWORDS) {
    if (keywords.some(k => text.includes(k))) return specialty;
  }
  return 'Med-Surg';
}

// ── Body system detection (unchanged) ─────────────────────────────────────
const BODY_SYSTEM_KEYWORDS: Record<string, string[]> = {
  Cardiovascular: [
    'cardiac', 'cardiovascular', 'heart', 'coronary', 'angina', 'myocardial',
    'hypertension', 'heart failure', 'chf', 'atrial', 'ventricular', 'dysrhythmia',
    'arrhythmia', 'valve', 'aorta', 'peripheral vascular', 'endocarditis',
    'pericarditis', 'cardiomyopathy', 'cardiogenic shock', 'deep vein', 'dvt',
    'peripheral arterial', 'stemi', 'nstemi',
  ],
  Respiratory: [
    'respiratory', 'pulmonary', 'lung', 'copd', 'asthma', 'pneumonia', 'oxygen',
    'ventilator', 'tracheostomy', 'bronchitis', 'emphysema', 'pleural', 'tuberculosis',
    'influenza', 'pneumothorax', 'pulmonary embolism', 'ards', 'respiratory failure',
    'cystic fibrosis',
  ],
  Neurological: [
    'neurological', 'neuro', 'brain', 'stroke', 'seizure', 'epilepsy', 'parkinson',
    'alzheimer', 'dementia', 'spinal cord', 'meningitis', 'encephalitis', 'tia',
    'hemorrhage', 'multiple sclerosis', 'guillain', 'intracranial', 'increased icp',
    'concussion', 'cva',
  ],
  Gastrointestinal: [
    'gastrointestinal', 'gi', 'gastric', 'bowel', 'colon', 'liver', 'hepatic',
    'pancreas', 'crohn', 'colitis', 'appendix', 'hernia', 'ulcer', 'nausea',
    'diarrhea', 'cirrhosis', 'diverticular', 'celiac', 'gastroenteritis',
    'esophageal', 'cholecyst',
  ],
  Renal: [
    'renal', 'kidney', 'urinary', 'bladder', 'dialysis', 'nephro', 'uti',
    'glomerulo', 'incontinence', 'ureter', 'renal failure', 'acute kidney',
    'calculi', 'nephrotic', 'hemodialysis', 'peritoneal dialysis',
  ],
  Endocrine: [
    'endocrine', 'diabetes', 'thyroid', 'adrenal', 'pituitary', 'glucose',
    'insulin', 'hormonal', 'cushing', 'addison', 'ketoacidosis', 'hypoglycemia',
    'hyperglycemia', 'hypothyroidism', 'hyperthyroidism', 'syndrome of inappropriate',
    'siadh',
  ],
  Musculoskeletal: [
    'musculoskeletal', 'bone', 'joint', 'fracture', 'arthritis', 'osteo', 'muscle',
    'cast', 'traction', 'amputation', 'gout', 'compartment syndrome', 'dislocation',
    'total hip', 'total knee',
  ],
  Integumentary: [
    'skin', 'wound', 'burn', 'pressure ulcer', 'pressure injury', 'integumentary',
    'dermatitis', 'cellulitis', 'wound healing', 'debridement', 'skin breakdown',
  ],
  Hematologic: [
    'blood', 'anemia', 'hematologic', 'sickle cell', 'leukemia', 'lymphoma',
    'coagulation', 'platelet', 'hemophilia', 'transfusion', 'disseminated intravascular',
    'dic', 'neutropenia', 'thrombocytopenia',
  ],
  Immune: [
    'immune', 'hiv', 'aids', 'autoimmune', 'lupus', 'rheumatoid', 'allergy',
    'anaphylaxis', 'transplant', 'immunosuppression', 'sepsis', 'infection control',
    'immunodeficiency',
  ],
  Reproductive: [
    'reproductive', 'obstetric', 'prenatal', 'postpartum', 'labor', 'delivery',
    'neonatal', 'newborn', 'breast', 'cervical', 'prostate', 'gynecologic',
    'ectopic', 'preeclampsia', 'eclampsia', 'placenta', 'miscarriage', 'contraception',
  ],
  Mental: [
    'mental health', 'psychiatric', 'anxiety', 'depression', 'bipolar', 'schizophrenia',
    'psychosis', 'eating disorder', 'substance', 'alcohol', 'opioid', 'suicide', 'ptsd',
    'therapeutic communication', 'de-escalation', 'behavior management',
  ],
  Pharmacology: [
    'medication', 'drug', 'pharmacology', 'antibiotic', 'antihypertensive', 'analgesic',
    'diuretic', 'anticoagulant', 'steroid', 'opioid', 'antidepressant', 'antipsychotic',
    'beta blocker', 'ace inhibitor', 'chemotherapy', 'immunosuppressant',
  ],
};

const DISORDER_CATEGORY_KEYWORDS: Record<string, Record<string, string[]>> = {
  Cardiovascular: {
    'Heart Failure': ['heart failure', 'chf', 'congestive heart'],
    'Dysrhythmia': ['dysrhythmia', 'arrhythmia', 'atrial fibril', 'atrial flutter', 'ventricular tachycardia', 'ventricular fibril', 'pacemaker', 'cardiac rhythm'],
    'Coronary Artery Disease': ['coronary artery', 'angina', 'myocardial infarction', 'stemi', 'nstemi', 'atherosclerosis', 'coronary syndrome'],
    'Hypertension': ['hypertension', 'hypertensive crisis', 'antihypertensive'],
    'Peripheral Vascular': ['peripheral vascular', 'dvt', 'deep vein thrombosis', 'peripheral arterial'],
    'Valvular Disease': ['valvular', 'heart valve', 'endocarditis', 'pericarditis', 'cardiomyopathy'],
    'Shock': ['cardiogenic shock'],
  },
  Respiratory: {
    'COPD': ['copd', 'emphysema', 'chronic bronchitis', 'chronic obstructive'],
    'Asthma': ['asthma', 'bronchospasm'],
    'Pneumonia': ['pneumonia', 'pneumococcal'],
    'Respiratory Failure': ['respiratory failure', 'ards', 'mechanical ventilation', 'ventilator', 'acute respiratory'],
    'Pulmonary Embolism': ['pulmonary embolism', 'pulmonary emboli'],
    'Tuberculosis': ['tuberculosis', ' tb '],
    'Pleural Disorders': ['pleural effusion', 'pneumothorax', 'hemothorax'],
  },
  Neurological: {
    'Stroke': ['stroke', 'cva', 'cerebrovascular accident', 'tia', 'thrombolytic', 'alteplase'],
    'Seizure': ['seizure', 'epilepsy', 'status epilepticus', 'anticonvulsant', 'antiepileptic'],
    'Increased ICP': ['intracranial pressure', 'increased icp', 'cerebral edema', 'herniation'],
    'Neurodegenerative': ['parkinson', 'alzheimer', 'dementia', 'multiple sclerosis', 'als', 'guillain'],
    'CNS Infection': ['meningitis', 'encephalitis'],
    'Spinal Injury': ['spinal cord', 'quadriplegia', 'paraplegia', 'spinal injury'],
  },
  Gastrointestinal: {
    'Hepatic Disorders': ['cirrhosis', 'hepatitis', 'liver failure', 'hepatic', 'portal hypertension'],
    'Inflammatory Bowel': ['crohn', 'colitis', 'inflammatory bowel', 'ibd'],
    'Peptic Ulcer Disease': ['peptic ulcer', 'gastric ulcer', 'duodenal ulcer', 'h pylori', 'gerd'],
    'Pancreatitis': ['pancreatitis', 'pancreatic'],
    'Bowel Obstruction': ['bowel obstruction', 'ileus', 'diverticular', 'hernia'],
    'GI Bleeding': ['gi bleed', 'gastrointestinal bleed', 'hematemesis', 'melena', 'rectal bleed'],
  },
  Renal: {
    'Acute Kidney Injury': ['acute kidney injury', 'aki', 'acute renal failure'],
    'Chronic Kidney Disease': ['chronic kidney', 'ckd', 'chronic renal failure', 'end-stage renal'],
    'Dialysis': ['hemodialysis', 'peritoneal dialysis', 'dialysis'],
    'Urinary Tract': ['uti', 'urinary tract infection', 'pyelonephritis', 'cystitis'],
    'Nephrotic Syndrome': ['nephrotic', 'glomerulonephritis', 'glomerulo'],
    'Urinary Calculi': ['calculi', 'kidney stones', 'renal calculi', 'urolithiasis'],
  },
  Endocrine: {
    'Diabetes': ['diabetes', 'diabetic', 'hyperglycemia', 'hypoglycemia', 'ketoacidosis', 'dka', 'insulin', 'glucose'],
    'Thyroid Disorders': ['thyroid', 'hypothyroidism', 'hyperthyroidism', 'thyroidectomy', 'goiter'],
    'Adrenal Disorders': ['adrenal', 'addison', 'cushing', 'pheochromocytoma'],
    'SIADH/DI': ['siadh', 'syndrome of inappropriate', 'diabetes insipidus'],
  },
  Musculoskeletal: {
    'Fractures': ['fracture', 'cast', 'traction', 'orthopedic', 'compartment syndrome'],
    'Joint Replacement': ['total hip', 'total knee', 'arthroplasty', 'joint replacement'],
    'Arthritis': ['arthritis', 'rheumatoid', 'gout', 'osteoarthritis'],
    'Osteoporosis': ['osteoporosis', 'osteopenia', 'bone density'],
    'Amputation': ['amputation'],
  },
  Hematologic: {
    'Anemia': ['anemia', 'sickle cell', 'iron deficiency', 'pernicious', 'aplastic'],
    'Clotting Disorders': ['hemophilia', 'coagulation', 'dic', 'disseminated intravascular', 'thrombocytopenia', 'anticoagulant'],
    'Blood Cancer': ['leukemia', 'lymphoma', 'multiple myeloma'],
    'Transfusion': ['transfusion', 'blood product', 'packed red'],
  },
  Immune: {
    'HIV/AIDS': ['hiv', 'aids', 'antiretroviral'],
    'Autoimmune': ['lupus', 'rheumatoid', 'autoimmune', 'multiple sclerosis'],
    'Allergic Reaction': ['anaphylaxis', 'allergy', 'allergic', 'epinephrine'],
    'Sepsis': ['sepsis', 'septic shock', 'bacteremia'],
    'Transplant': ['transplant', 'immunosuppression', 'rejection'],
  },
  Reproductive: {
    'Antepartum': ['prenatal', 'antepartum', 'ectopic', 'preeclampsia', 'eclampsia', 'placenta', 'miscarriage', 'gestational'],
    'Labor & Delivery': ['labor', 'delivery', 'intrapartum', 'cervical dilation', 'oxytocin', 'cesarean'],
    'Postpartum': ['postpartum', 'postnatal', 'breastfeeding', 'lactation'],
    'Neonatal': ['neonatal', 'newborn', 'nicu', 'preterm infant'],
    'Gynecologic': ['gynecologic', 'breast', 'cervical', 'uterine', 'ovarian', 'contraception', 'prostate'],
  },
  Mental: {
    'Mood Disorders': ['depression', 'bipolar', 'mania', 'seasonal affective'],
    'Anxiety Disorders': ['anxiety', 'ptsd', 'panic', 'obsessive', 'ocd'],
    'Psychotic Disorders': ['schizophrenia', 'psychosis', 'hallucination', 'delusion'],
    'Substance Use': ['substance', 'alcohol', 'opioid', 'addiction', 'withdrawal', 'detoxification'],
    'Eating Disorders': ['eating disorder', 'anorexia', 'bulimia'],
    'Suicidality': ['suicide', 'self-harm', 'suicidal'],
  },
};

const POPULATION_KEYWORDS: Record<string, string[]> = {
  Pediatric: ['pediatric', 'child', 'infant', 'toddler', 'adolescent', 'school-age', 'neonatal', 'newborn'],
  Maternal: ['maternal', 'obstetric', 'prenatal', 'antepartum', 'postpartum', 'labor', 'delivery', 'pregnant'],
  Geriatric: ['geriatric', 'elderly', 'older adult', 'aging'],
  Psychiatric: ['psychiatric', 'mental health', 'psychosocial'],
};

// ── Clinical Judgment Model phase mapping ──────────────────────────────────
const CJM_PHASE_ORDER = [
  'Recognize Cues',
  'Analyze Cues',
  'Prioritize Hypotheses',
  'Generate Solutions & Take Action',
  'Evaluate Outcomes',
] as const;

type CJMPhase = typeof CJM_PHASE_ORDER[number];

const CJM_PHASE_KEYWORDS: Array<{ phase: CJMPhase; keywords: string[] }> = [
  {
    phase: 'Evaluate Outcomes',
    keywords: [
      'evaluate', 'outcome', 'expected outcome', 'complication', 'reassess',
      'response to', 'effectiveness', 'result', 'improvement', 'expected finding',
    ],
  },
  {
    phase: 'Recognize Cues',
    keywords: [
      'assess', 'monitor', 'observe', 'vital sign', 'sign and symptom', 'manifestation',
      'finding', 'health history', 'physical assessment', 'lab value', 'diagnostic',
      'auscultate', 'inspect', 'palpate', 'measure', 'data collection',
      'subjective', 'objective', 'symptom', 'presentation',
    ],
  },
  {
    phase: 'Analyze Cues',
    keywords: [
      'pathophysiology', 'mechanism', 'interpret', 'implication', 'relate',
      'alteration', 'dysfunction', 'etiology', 'risk factor', 'cause',
      'pathogen', 'disease process',
    ],
  },
  {
    phase: 'Prioritize Hypotheses',
    keywords: [
      'priority', 'identify', 'differential', 'problem', 'hypothesis', 'urgent',
      'emergent', 'critical', 'concern', 'nursing diagnosis', 'risk for',
    ],
  },
];

// Default: Generate Solutions & Take Action (interventions, medications, procedures)
export function mapToCJMPhase(topic: ATITopic): CJMPhase {
  const text = topic.name.toLowerCase();
  for (const { phase, keywords } of CJM_PHASE_KEYWORDS) {
    if (keywords.some(k => text.includes(k))) return phase;
  }
  // ALT type fallback
  const alt = (topic.altType ?? '').toLowerCase();
  if (alt.includes('system disorder') || alt.includes('basic concept')) return 'Analyze Cues';
  return 'Generate Solutions & Take Action';
}

// ── ADPIE focus derivation ─────────────────────────────────────────────────
function deriveAdpiFocus(cjmGroups: CJMPhaseGroup[]): string {
  const phaseCounts: Record<string, number> = {};
  for (const g of cjmGroups) {
    phaseCounts[g.phase] = (phaseCounts[g.phase] ?? 0) + g.topics.length;
  }
  const dominant = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const map: Record<string, string> = {
    'Recognize Cues': 'Assessment — focus on data collection and identifying abnormal findings',
    'Analyze Cues': 'Analysis — focus on understanding the disease process and its implications',
    'Prioritize Hypotheses': 'Diagnosis — focus on identifying priority nursing problems',
    'Generate Solutions & Take Action': 'Implementation — focus on nursing interventions and medication management',
    'Evaluate Outcomes': 'Evaluation — focus on expected outcomes and monitoring for complications',
  };
  return map[dominant ?? ''] ?? 'Implementation — focus on nursing interventions';
}

// ── Body system helpers (unchanged interface) ──────────────────────────────
function detectBodySystem(text: string): string | undefined {
  const lower = text.toLowerCase();
  let bestMatch: string | undefined;
  let bestCount = 0;
  for (const [system, keywords] of Object.entries(BODY_SYSTEM_KEYWORDS)) {
    const count = keywords.filter(k => lower.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      bestMatch = system;
    }
  }
  return bestCount > 0 ? bestMatch : undefined;
}

function detectDisorderCategory(topicName: string, bodySystem: string): string | undefined {
  const disorderMap = DISORDER_CATEGORY_KEYWORDS[bodySystem];
  if (!disorderMap) return undefined;
  const lower = topicName.toLowerCase();
  for (const [disorder, keywords] of Object.entries(disorderMap)) {
    if (keywords.some(k => lower.includes(k))) return disorder;
  }
  return undefined;
}

function detectPopulation(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [pop, keywords] of Object.entries(POPULATION_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return pop;
  }
  return undefined;
}

export function clusterKey(topic: ATITopic): string {
  const textForDetection = `${topic.name} ${topic.subcategory ?? ''} ${topic.category}`;
  const system = detectBodySystem(topic.name) ?? detectBodySystem(textForDetection);
  const population = detectPopulation(topic.name) ?? detectPopulation(textForDetection);
  const disorder = system ? detectDisorderCategory(topic.name, system) : undefined;

  if (population && population !== 'Psychiatric') {
    const parts = ['pop', population];
    if (system) parts.push(system);
    if (disorder) parts.push(disorder);
    return parts.join(':');
  }
  if (system) {
    return disorder ? `sys:${system}:${disorder}` : `sys:${system}`;
  }
  return `cat:${topic.category ?? 'General'}`;
}

export function clusterDisplayName(key: string, topics: ATITopic[]): string {
  const parts = key.split(':');
  const prefix = parts[0];

  if (prefix === 'pop') {
    const population = parts[1] ?? '';
    const system = parts[2];
    const disorder = parts[3];
    if (disorder) return `${population}: ${disorder}`;
    if (system) return `${population}: ${system}`;
    return `${population} Nursing`;
  }

  if (prefix === 'sys') {
    const system = parts[1] ?? '';
    const disorder = parts[2];
    if (disorder) return `${system}: ${disorder}`;
    const hasMeds = topics.some(t => (t.altType ?? '').toLowerCase().includes('medication'));
    return hasMeds ? `${system}: Disorders & Medications` : `${system}: Disorders & Care`;
  }

  if (prefix === 'cat') {
    return `${parts.slice(1).join(':')} Core Topics`;
  }

  return 'General Nursing';
}

function sortTopicsWithinCluster(topics: ATITopic[]): ATITopic[] {
  return topics.slice().sort((a, b) => {
    const aPri = altTypePriority(a.altType);
    const bPri = altTypePriority(b.altType);
    if (aPri !== bPri) return aPri - bPri;
    return (a.groupScore ?? Infinity) - (b.groupScore ?? Infinity);
  });
}

function avgScore(topics: ATITopic[]): number {
  if (topics.length === 0) return 100;
  const scored = topics.filter(t => t.groupScore != null);
  if (scored.length === 0) return 100;
  return scored.reduce((s, t) => s + (t.groupScore as number), 0) / scored.length;
}

// ── Public: existing API (used by web UI) ──────────────────────────────────
export function clusterALTTopics(topics: ATITopic[]): TopicCluster[] {
  const altTopics = topics.filter(t => t.altType);
  const clusterMap = new Map<string, ATITopic[]>();

  for (const topic of altTopics) {
    const key = clusterKey(topic);
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key)!.push(topic);
  }

  const clusters: TopicCluster[] = [];
  Array.from(clusterMap.entries()).forEach(([key, clusterTopics]) => {
    const sorted = sortTopicsWithinCluster(clusterTopics);
    const parts = key.split(':');
    const bodySystem = parts[0] === 'sys' ? parts[1] : (parts[0] === 'pop' && parts[2] ? parts[2] : undefined);
    const population = parts[0] === 'pop' ? parts[1] : undefined;

    clusters.push({
      name: clusterDisplayName(key, clusterTopics),
      topics: sorted,
      bodySystem,
      population,
    });
  });

  clusters.sort((a, b) => avgScore(a.topics) - avgScore(b.topics));
  return clusters;
}

// ── Public: new focused plan for the PDF (max 2 disorder clusters) ─────────
export function selectFocusedClusters(topics: ATITopic[]): FocusedStudyPlan {
  const altTopics = topics.filter(t => t.altType);

  // 1. Group by subject specialty
  const specialtyMap = new Map<string, ATITopic[]>();
  for (const t of altTopics) {
    const sp = detectSubjectSpecialty(t);
    if (!specialtyMap.has(sp)) specialtyMap.set(sp, []);
    specialtyMap.get(sp)!.push(t);
  }

  // 2. Select the specialty with the worst (lowest) average score (primary only)
  const specialtyRanked = Array.from(specialtyMap.entries())
    .map(([sp, tps]) => ({ sp, tps, avg: avgScore(tps) }))
    .sort((a, b) => a.avg - b.avg);

  const primary = specialtyRanked[0];
  if (!primary) {
    return { specialty: 'General Nursing', clusters: [], allAltTopics: altTopics };
  }

  // Always use only the primary specialty — never merge or slash-combine subjects
  const focusTopics = primary.tps;
  const specialtyLabel = primary.sp;

  // 3. Build disorder clusters within the chosen specialty topics
  const clusterMap = new Map<string, ATITopic[]>();
  for (const t of focusTopics) {
    const key = clusterKey(t);
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key)!.push(t);
  }

  // 4. Score clusters: weighted by topic count × gap severity (lower score = bigger gap)
  const scoredClusters = Array.from(clusterMap.entries())
    .map(([key, tps]) => ({
      key,
      tps,
      weight: tps.length * (100 - avgScore(tps)), // more topics + bigger gap = higher priority
    }))
    .sort((a, b) => b.weight - a.weight);

  // 5. Select top 1 cluster; add a second only if it exists and its weight is within 30% of first
  const topWeight = scoredClusters[0]?.weight ?? 0;
  const chosen = scoredClusters.filter(
    (c, i) => i === 0 || (i === 1 && c.weight >= topWeight * 0.7),
  ).slice(0, 2);

  // 6. Build FocusedCluster objects with CJM phase grouping
  const focusedClusters: FocusedCluster[] = chosen.map(({ key, tps }) => {
    const sorted = sortTopicsWithinCluster(tps);
    const parts = key.split(':');
    const bodySystem = parts[0] === 'sys' ? parts[1] : (parts[0] === 'pop' && parts[2] ? parts[2] : undefined);
    const population = parts[0] === 'pop' ? parts[1] : undefined;

    // Group topics by CJM phase while preserving priority order within each phase
    const phaseMap = new Map<CJMPhase, ATITopic[]>();
    for (const phase of CJM_PHASE_ORDER) phaseMap.set(phase, []);
    for (const t of sorted) {
      phaseMap.get(mapToCJMPhase(t))!.push(t);
    }

    const cjmGroups: CJMPhaseGroup[] = CJM_PHASE_ORDER
      .filter(phase => phaseMap.get(phase)!.length > 0)
      .map(phase => ({ phase, topics: phaseMap.get(phase)! }));

    const adpiFocus = deriveAdpiFocus(cjmGroups);

    return {
      name: clusterDisplayName(key, tps),
      specialty: specialtyLabel,
      topics: sorted,
      cjmGroups,
      adpiFocus,
      bodySystem,
      population,
    };
  });

  // Fallback: if clustering produced nothing, surface a single catch-all cluster
  if (focusedClusters.length === 0 && altTopics.length > 0) {
    const sorted = sortTopicsWithinCluster(altTopics);
    const phaseMap = new Map<CJMPhase, ATITopic[]>();
    for (const phase of CJM_PHASE_ORDER) phaseMap.set(phase, []);
    for (const t of sorted) phaseMap.get(mapToCJMPhase(t))!.push(t);
    const cjmGroups: CJMPhaseGroup[] = CJM_PHASE_ORDER
      .filter(phase => phaseMap.get(phase)!.length > 0)
      .map(phase => ({ phase, topics: phaseMap.get(phase)! }));
    focusedClusters.push({
      name: `${primary.sp} Core Topics`,
      specialty: primary.sp,
      topics: sorted,
      cjmGroups,
      adpiFocus: deriveAdpiFocus(cjmGroups),
    });
  }

  return { specialty: specialtyLabel, clusters: focusedClusters, allAltTopics: altTopics };
}

// ── Eight nursing subjects taxonomy ───────────────────────────────────────
// Topic-name keyword overrides — checked BEFORE subcategory table (order matters).
// Each entry: { subject: display name, keywords: substrings to match in topic.name }
const TOPIC_NAME_OVERRIDES: Array<{ subject: string; keywords: string[] }> = [
  {
    subject: 'Maternal-Newborn Nursing',
    keywords: [
      'obstetric', 'maternal', 'prenatal', 'antepartum', 'postpartum',
      'intrapartum', 'labor', 'delivery', 'newborn', 'neonatal',
      'gestational', 'preeclampsia', 'eclampsia', 'placenta',
      'breastfeeding', 'lactation', 'gravida', 'cesarean', 'oxytocin',
    ],
  },
  {
    subject: 'Pediatrics',
    keywords: [
      'pediatric', 'child', 'infant', 'toddler', 'adolescent',
      'school-age', 'neonate', 'growth and development',
    ],
  },
  {
    subject: 'Mental Health Nursing',
    keywords: [
      'mental health', 'psychiatric', 'anxiety', 'depression', 'bipolar',
      'schizophrenia', 'psychosis', 'substance use', 'suicide', 'ptsd',
      'therapeutic communication', 'addiction', 'hallucination', 'mania',
    ],
  },
];

// NCLEX subcategory → nursing subject (exact match, applied after topic-name overrides).
const SUBCAT_TO_SUBJECT: Record<string, string> = {
  'Physiological Adaptation':                'Medical-Surgical Nursing',
  'Reduction of Risk Potential':             'Medical-Surgical Nursing',
  'Pharmacological and Parenteral Therapies':'Pharmacology',
  'Psychosocial Integrity':                  'Mental Health Nursing',
  'Basic Care and Comfort':                  'Fundamentals of Nursing',
  'Safety and Infection Control':            'Fundamentals of Nursing',
  'Management of Care':                      'Fundamentals of Nursing',
  'Health Promotion and Maintenance':        'Fundamentals of Nursing',
};

export function subjectDisplayName(subject: string): string {
  return subject; // subjects are already full display names in this taxonomy
}

function mapToNursingSubject(topic: ATITopic): string {
  const name = (topic.name ?? '').toLowerCase();

  // Step 1: topic-name keyword overrides (highest precedence)
  for (const { subject, keywords } of TOPIC_NAME_OVERRIDES) {
    if (keywords.some(k => name.includes(k))) return subject;
  }

  // Step 2: exact NCLEX subcategory match
  const subcat = (topic.subcategory ?? '').trim();
  if (SUBCAT_TO_SUBJECT[subcat]) return SUBCAT_TO_SUBJECT[subcat];

  // Step 3: partial NCLEX category string match (catch-all before default)
  const cat = (topic.category ?? '').toLowerCase();
  if (cat.includes('pharmacol')) return 'Pharmacology';
  if (cat.includes('psychosocial')) return 'Mental Health Nursing';
  if (cat.includes('health promotion')) return 'Fundamentals of Nursing';
  if (cat.includes('physiological')) return 'Medical-Surgical Nursing';

  // Step 4: default
  return 'Fundamentals of Nursing';
}

// ── Clinical body-system/disorder cluster key (for subject reports) ─────────
// Always uses the body-system/disorder/population hierarchy — never NCLEX subcat
function subjectClusterKey(topic: ATITopic): string {
  return clusterKey(topic);
}

function subjectClusterName(key: string, topics: ATITopic[]): string {
  return clusterDisplayName(key, topics);
}

// Derive the "body system" label for grouping purposes from a cluster key.
// sys:X[:Y] → X, pop:X[:...] → X (population name), cat:* → 'Other'
function clusterBodySystem(key: string): string {
  const parts = key.split(':');
  if (parts[0] === 'sys') return parts[1] ?? 'Other';
  if (parts[0] === 'pop') return parts[1] ?? 'Other';
  return 'Other';
}

export interface FlatTopic {
  name: string;
  altType?: string;
  groupScore: number | null;
  subcategory?: string;
  cjmPhase: string;
}

export interface SubjectCluster {
  name: string;
  bodySystem?: string;
  population?: string;
  avgScore: number;
  cjmGroups: Array<{ phase: string; topics: FlatTopic[] }>;
}

export interface SubjectReport {
  reportNumber: number;
  subject: string;
  displaySubject: string;
  avgGap: number;
  topicCount: number;
  allTopics: FlatTopic[];
  cluster: FocusedCluster | null;
  clusters: SubjectCluster[];
}

export function buildSubjectReports(topics: ATITopic[]): SubjectReport[] {
  // Group all topics (ALT or not) by nursing subject
  const subjectMap = new Map<string, ATITopic[]>();
  for (const t of topics) {
    const subject = mapToNursingSubject(t);
    if (!subjectMap.has(subject)) subjectMap.set(subject, []);
    subjectMap.get(subject)!.push(t);
  }

  // Rank subjects by gap severity (most missed first)
  const ranked = Array.from(subjectMap.entries())
    .map(([subject, tps]) => ({ subject, tps, avgGap: 100 - avgScore(tps) }))
    .filter(r => r.tps.length >= 1)
    .sort((a, b) => b.avgGap - a.avgGap)
    .slice(0, 3);

  return ranked.map(({ subject, tps, avgGap }, i) => {
    // Find the primary disorder cluster within this subject (highest gap weight)
    const clusterMap = new Map<string, ATITopic[]>();
    for (const t of tps) {
      const key = subjectClusterKey(t);
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(t);
    }

    const scoredClusters = Array.from(clusterMap.entries())
      .map(([key, ctps]) => ({ key, ctps, weight: ctps.length * (100 - avgScore(ctps)) }))
      .sort((a, b) => b.weight - a.weight);

    const top = scoredClusters[0];
    let cluster: FocusedCluster | null = null;

    if (top) {
      const sorted = sortTopicsWithinCluster(top.ctps);
      const keyParts = top.key.split(':');
      const bodySystem = keyParts[0] === 'sys' ? keyParts[1] : undefined;
      const population = keyParts[0] === 'pop' ? keyParts[1] : undefined;

      const phaseMap = new Map<CJMPhase, ATITopic[]>();
      for (const phase of CJM_PHASE_ORDER) phaseMap.set(phase, []);
      for (const t of sorted) phaseMap.get(mapToCJMPhase(t))!.push(t);

      let cjmGroups: CJMPhaseGroup[] = CJM_PHASE_ORDER
        .filter(phase => phaseMap.get(phase)!.length > 0)
        .map(phase => ({ phase, topics: phaseMap.get(phase)! }));

      // Fallback: if nothing was mapped, surface all topics under Interventions
      if (cjmGroups.length === 0) {
        cjmGroups = [{ phase: 'Generate Solutions & Take Action', topics: sorted }];
      }

      cluster = {
        name: subjectClusterName(top.key, top.ctps),
        specialty: subject,
        topics: sorted,
        cjmGroups,
        adpiFocus: deriveAdpiFocus(cjmGroups),
        bodySystem,
        population,
      };
    }

    // Build ALL clusters for the structured UI view (sorted highest-priority first)
    const allClusters: SubjectCluster[] = scoredClusters.map(({ key, ctps }) => {
      const sorted = sortTopicsWithinCluster(ctps);
      const keyParts = key.split(':');
      const bodySystem = clusterBodySystem(key);          // 'Cardiovascular' | 'Maternal' | 'Other'
      const population = keyParts[0] === 'pop' ? keyParts[1] : undefined;

      const phaseMap = new Map<CJMPhase, ATITopic[]>();
      for (const phase of CJM_PHASE_ORDER) phaseMap.set(phase, []);
      for (const t of sorted) phaseMap.get(mapToCJMPhase(t))!.push(t);

      const cjmGroups = CJM_PHASE_ORDER
        .filter(phase => phaseMap.get(phase)!.length > 0)
        .map(phase => ({
          phase,
          topics: phaseMap.get(phase)!.map(t => ({
            name: t.name,
            altType: t.altType,
            groupScore: t.groupScore,
            subcategory: t.subcategory,
            cjmPhase: phase as string,
          })),
        }));

      return {
        name: subjectClusterName(key, ctps),
        bodySystem,
        population,
        avgScore: avgScore(ctps),
        cjmGroups,
      };
    });

    // All topics for this subject sorted worst-first, each tagged with CJM phase
    const allTopics: FlatTopic[] = [...tps]
      .sort((a, b) => (a.groupScore ?? Infinity) - (b.groupScore ?? Infinity))
      .map(t => ({
        name: t.name,
        altType: t.altType,
        groupScore: t.groupScore,
        subcategory: t.subcategory,
        cjmPhase: mapToCJMPhase(t),
      }));

    return {
      reportNumber: i + 1,
      subject,
      displaySubject: subjectDisplayName(subject),
      avgGap: Math.round(avgGap),
      topicCount: tps.length,
      allTopics,
      cluster,
      clusters: allClusters,
    };
  });
}
