import { db } from "./db";
import { textbooks, textbookChapters, chapterTopicMappings, nursingTopics } from "../shared/schema";
import { eq, or, ilike } from "drizzle-orm";

const PHARM_TITLE = "Pharmacology for Nurses";

interface PharmChapter {
  number: number;
  title: string;
  nclexCategory: string;
  subjectTag: string;
  keywords: string[];
}

const PHARM_CHAPTERS: PharmChapter[] = [
  // Unit 1: Introduction to Pharmacology for Nurses
  {
    number: 1,
    title: "Introduction to Pharmacology",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "pharmacology", "drug classification", "drug prototype", "drug sources",
      "generic drug", "brand name", "drug form", "special populations pharmacology",
    ],
  },
  {
    number: 2,
    title: "Drug Administration",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "drug administration", "pharmacokinetics", "pharmacodynamics", "dosage calculation",
      "medication administration", "drug route", "rights of medication administration",
      "absorption", "distribution", "metabolism", "excretion", "half-life",
    ],
  },
  {
    number: 3,
    title: "Ethics, Legal Considerations, and Safety",
    nclexCategory: "Safety and Infection Control",
    subjectTag: "Pharmacology",
    keywords: [
      "medication error", "drug error prevention", "medication safety", "legal considerations",
      "controlled substance", "documentation", "drug informatics", "medication reconciliation",
      "high-alert medication", "safe medication administration",
    ],
  },

  // Unit 2: Homeostasis
  {
    number: 4,
    title: "Introduction to Homeostasis",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "Pharmacology",
    keywords: [
      "homeostasis", "osmolality", "osmolarity", "negative feedback", "fluid balance",
    ],
  },
  {
    number: 5,
    title: "Fluids and Electrolytes, Vitamins, Minerals, and Alternative Therapies",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "fluid electrolyte", "intravenous fluid", "iv therapy", "total parenteral nutrition",
      "blood products", "sodium", "potassium", "calcium", "magnesium",
      "electrolyte imbalance", "vitamins", "minerals", "complementary therapy",
      "alternative therapy", "dehydration", "hypervolemia", "hypovolemia",
    ],
  },

  // Unit 3: Immune System
  {
    number: 6,
    title: "Immune System and Inflammatory Response Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "immune system", "vaccine", "immunization", "immunosuppressant", "biologic",
      "monoclonal antibody", "inflammatory response", "anti-inflammatory", "corticosteroid",
      "nsaid", "nonsteroidal anti-inflammatory", "autoimmune",
    ],
  },
  {
    number: 7,
    title: "Anti-infective Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antibiotic", "antiviral", "antifungal", "antimicrobial", "antiparasitic",
      "hiv", "aids", "antiretroviral", "sexually transmitted infection", "tuberculosis",
      "antitubercular", "infection", "bacterial infection", "fungal infection",
    ],
  },
  {
    number: 8,
    title: "Cancer Therapy and Cancer Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "chemotherapy", "antineoplastic", "cancer", "oncology", "hormonal therapy",
      "biologic response modifier", "targeted therapy", "cancer drug", "chemotherapeutic",
    ],
  },

  // Unit 4: Nervous System and Drugs for Mental Well-being
  {
    number: 9,
    title: "Introduction to the Nervous System",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "Pharmacology",
    keywords: [
      "nervous system", "central nervous system", "peripheral nervous system",
      "neurotransmitter", "neurological",
    ],
  },
  {
    number: 10,
    title: "Drugs to Treat Myasthenia Gravis and Alzheimer's Disease",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "myasthenia gravis", "alzheimer", "dementia", "cholinergic", "acetylcholinesterase inhibitor",
      "neuromuscular", "cognitive impairment",
    ],
  },
  {
    number: 11,
    title: "Drugs to Treat Parkinson's Disease and Multiple Sclerosis",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "parkinson", "anti-parkinsonian", "levodopa", "dopaminergic", "multiple sclerosis",
      "demyelinating", "disease-modifying therapy",
    ],
  },
  {
    number: 12,
    title: "Anticonvulsant Drugs and Drugs to Treat Epilepsy and Migraine",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "anticonvulsant", "antiepileptic", "seizure", "epilepsy", "migraine",
      "migraine headache", "intracranial", "status epilepticus",
    ],
  },
  {
    number: 13,
    title: "Psychopharmacologic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antidepressant", "antipsychotic", "mood stabilizer", "anxiolytic", "sedative",
      "hypnotic", "cns stimulant", "ssri", "snri", "benzodiazepine", "lithium",
      "psychopharmacology", "psychiatric medication", "depression medication",
      "anxiety medication", "bipolar medication",
    ],
  },
  {
    number: 14,
    title: "Pain Response Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "analgesic", "opioid", "non-opioid analgesic", "pain management", "opioid agonist",
      "opioid antagonist", "naloxone", "acetaminophen", "pain relief",
    ],
  },
  {
    number: 15,
    title: "Substance Use Disorder Treatment Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "substance use disorder", "opioid use disorder", "alcohol use disorder", "nicotine",
      "addiction treatment", "withdrawal", "methadone", "buprenorphine",
      "naltrexone", "disulfiram",
    ],
  },

  // Unit 5: Cardiovascular System
  {
    number: 16,
    title: "Introduction to the Cardiovascular System",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "Pharmacology",
    keywords: [
      "cardiovascular system", "heart", "cardiac", "conduction", "blood flow",
    ],
  },
  {
    number: 17,
    title: "Antidysrhythmic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antidysrhythmic", "dysrhythmia", "arrhythmia", "beta blocker", "calcium channel blocker",
      "sodium channel blocker", "potassium channel blocker", "digoxin", "atrial fibrillation",
      "cardiac rhythm",
    ],
  },
  {
    number: 18,
    title: "Antihypertensive and Antianginal Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antihypertensive", "hypertension", "angina", "ace inhibitor", "arb", "beta blocker",
      "calcium channel blocker", "diuretic", "nitrate", "blood pressure medication",
    ],
  },
  {
    number: 19,
    title: "Heart Failure Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "heart failure", "cardiac glycoside", "diuretic", "ace inhibitor", "arb",
      "beta blocker", "sglt2", "digoxin", "cardiac output",
    ],
  },
  {
    number: 20,
    title: "Anticoagulant, Antiplatelet, and Thrombolytic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "anticoagulant", "antiplatelet", "thrombolytic", "heparin", "warfarin",
      "enoxaparin", "aspirin", "clotting", "coagulation", "deep vein thrombosis",
      "dvt", "pulmonary embolism",
    ],
  },
  {
    number: 21,
    title: "Lipid-Lowering Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "statin", "lipid-lowering", "hyperlipidemia", "cholesterol", "lipoprotein",
      "hdl", "ldl", "triglyceride", "hmg-coa reductase inhibitor",
    ],
  },
  {
    number: 22,
    title: "Cardiac Emergency and Shock Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "cardiac emergency", "shock", "vasopressor", "epinephrine", "atropine",
      "cardiovascular emergency", "code", "resuscitation", "cardiac arrest",
    ],
  },

  // Unit 6: Respiratory System
  {
    number: 23,
    title: "Introduction to the Respiratory System",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "Pharmacology",
    keywords: [
      "respiratory system", "oxygenation", "gas exchange", "upper respiratory",
      "lower respiratory", "lung",
    ],
  },
  {
    number: 24,
    title: "Upper Respiratory Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antihistamine", "decongestant", "antitussive", "expectorant", "mucolytic",
      "upper respiratory", "rhinitis", "sinusitis", "cold", "allergy",
    ],
  },
  {
    number: 25,
    title: "Lower Respiratory Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "bronchodilator", "inhaler", "corticosteroid inhaled", "leukotriene modifier",
      "xanthine", "adrenergic", "anticholinergic", "asthma", "copd",
      "lower respiratory", "beta-agonist", "albuterol",
    ],
  },

  // Unit 7: Endocrine System
  {
    number: 26,
    title: "Hypothalamus, Pituitary, and Adrenal Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "glucocorticoid", "mineralocorticoid", "corticosteroid", "adrenal", "pituitary",
      "growth hormone", "antidiuretic hormone", "addison", "cushing",
    ],
  },
  {
    number: 27,
    title: "Thyroid and Parathyroid Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "thyroid", "antithyroid", "hypothyroidism", "hyperthyroidism", "levothyroxine",
      "parathyroid", "calcium preparation", "vitamin d", "bisphosphonate",
    ],
  },
  {
    number: 28,
    title: "Diabetic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "diabetes", "insulin", "antidiabetic", "oral antidiabetic", "hypoglycemia",
      "hyperglycemia", "metformin", "glipizide", "diabetic medication",
      "blood glucose", "injectable diabetes",
    ],
  },

  // Unit 8: Digestive System
  {
    number: 29,
    title: "Introduction to the Digestive System",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "Pharmacology",
    keywords: [
      "gastrointestinal system", "digestive system", "gi tract", "intestine",
    ],
  },
  {
    number: 30,
    title: "Gastrointestinal Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antiemetic", "antidiarrheal", "laxative", "stool softener", "nausea medication",
      "constipation", "diarrhea", "gastrointestinal drug",
    ],
  },
  {
    number: 31,
    title: "Hyperacidity and Antiulcer Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "antacid", "proton pump inhibitor", "ppi", "histamine blocker", "h2 blocker",
      "peptic ulcer", "gerd", "gastroesophageal reflux", "hyperacidity",
    ],
  },
  {
    number: 32,
    title: "Weight Management Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "weight management", "obesity", "anorexiant", "lipase inhibitor", "weight loss",
    ],
  },

  // Unit 9: Renal and Urinary Systems
  {
    number: 33,
    title: "Introduction to the Renal and Urinary Systems",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "Pharmacology",
    keywords: [
      "renal system", "urinary system", "kidney", "nephron", "fluid volume",
    ],
  },
  {
    number: 34,
    title: "Diuretic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "diuretic", "loop diuretic", "osmotic diuretic", "potassium-sparing diuretic",
      "thiazide diuretic", "furosemide", "lasix", "hydrochlorothiazide", "spironolactone",
    ],
  },
  {
    number: 35,
    title: "Urinary and Bladder Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "urinary anti-infective", "urinary antispasmodic", "bladder", "urinary analgesic",
      "urinary tract infection", "uti", "urinary incontinence", "urinary retention",
    ],
  },

  // Unit 10: Reproductive System
  {
    number: 36,
    title: "Reproductive Health Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "reproductive health", "hormonal contraception", "contraception", "infertility",
      "uterine motility", "lactation", "estrogen", "progesterone", "testosterone",
      "androgen", "female reproductive", "male reproductive",
    ],
  },
  {
    number: 37,
    title: "Transgender and Nonbinary Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "transgender", "gender-affirming", "feminizing hormonal therapy", "masculinizing hormonal therapy",
      "hormone therapy",
    ],
  },

  // Unit 11: Sensory and Dermatologic Systems
  {
    number: 38,
    title: "Ophthalmic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "ophthalmic", "eye medication", "ocular", "antiglaucoma", "glaucoma",
      "ocular anti-inflammatory", "eye drop", "eye disorder",
    ],
  },
  {
    number: 39,
    title: "Otic Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "otic", "ear medication", "ear disorder", "otitis", "cerumen",
      "otic anti-inflammatory", "ear drop",
    ],
  },
  {
    number: 40,
    title: "Dermatologic Disorder Drugs",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    subjectTag: "Pharmacology",
    keywords: [
      "dermatologic", "skin medication", "acne", "psoriasis", "topical anti-infective",
      "burns topical", "dermatology", "skin disorder drug",
    ],
  },
];

export async function seedPharmacologyCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, PHARM_TITLE));

  let textbookId: string;

  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [newBook] = await db
      .insert(textbooks)
      .values({
        title: PHARM_TITLE,
        publisher: "OpenStax / Rice University",
        edition: "1st Edition (Open Access, CC BY-NC-SA 4.0)",
        primarySubject: "Pharmacology",
        description:
          "OpenStax Pharmacology for Nurses — a comprehensive 40-chapter open-access textbook (openstax.org) covering drug administration, pharmacokinetics, pharmacodynamics, and system-based drug classes organized by body system. Distinct from the Open RN / CVTC 'Nursing Pharmacology' textbook; this edition is published by Rice University under CC BY-NC-SA 4.0 and provides detailed chapter-level topic mappings aligned to NCLEX-RN pharmacological and parenteral therapies content.",
        isActive: true,
      })
      .returning();
    textbookId = newBook.id;
    inserted++;
  }

  const existingChapters = await db
    .select({ id: textbookChapters.id, title: textbookChapters.title })
    .from(textbookChapters)
    .where(eq(textbookChapters.textbookId, textbookId));

  const existingTitles = new Set(existingChapters.map((c) => c.title));
  const chapterNumberToId = new Map<number, string>();

  for (const ch of PHARM_CHAPTERS) {
    if (existingTitles.has(ch.title)) {
      const found = existingChapters.find((c) => c.title === ch.title);
      if (found) chapterNumberToId.set(ch.number, found.id);
      skipped++;
    } else {
      const [newCh] = await db
        .insert(textbookChapters)
        .values({
          textbookId,
          chapterNumber: String(ch.number),
          title: ch.title,
          subjectTag: ch.subjectTag,
          nclexCategoryTag: ch.nclexCategory,
        })
        .returning();
      chapterNumberToId.set(ch.number, newCh.id);
      inserted++;
    }
  }

  for (const ch of PHARM_CHAPTERS) {
    const chapterId = chapterNumberToId.get(ch.number);
    if (!chapterId || ch.keywords.length === 0) continue;

    const conditions = ch.keywords.map((kw) => ilike(nursingTopics.name, `%${kw}%`));
    const matchedTopics = await db
      .select({ id: nursingTopics.id })
      .from(nursingTopics)
      .where(or(...conditions))
      .limit(30);

    const existingMappings = await db
      .select({ nursingTopicId: chapterTopicMappings.nursingTopicId })
      .from(chapterTopicMappings)
      .where(eq(chapterTopicMappings.chapterId, chapterId));

    const mappedTopicIds = new Set(existingMappings.map((m) => m.nursingTopicId));

    for (const topic of matchedTopics) {
      if (mappedTopicIds.has(topic.id)) {
        skipped++;
        continue;
      }
      await db.insert(chapterTopicMappings).values({
        chapterId,
        nursingTopicId: topic.id,
        subject: "Pharmacology",
        notes: `Auto-mapped: "${ch.title}" keyword match`,
      });
      mappedTopicIds.add(topic.id);
      inserted++;
    }
  }

  return { inserted, skipped };
}
