import { db } from "./db";
import { textbooks, textbookChapters, chapterTopicMappings, nursingTopics } from "../shared/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";

const MEDSURG_TITLE = "Open RN Medical-Surgical Nursing";

interface MedSurgChapter {
  number: number;
  title: string;
  nclexCategory: string;
  subjectTag: string;
  keywords: string[];
}

const MEDSURG_CHAPTERS: MedSurgChapter[] = [
  // Unit I: The Nursing Profession
  {
    number: 1, title: "Scope and Standards of Practice",
    nclexCategory: "Management of Care", subjectTag: "Med-Surg",
    keywords: ["scope of practice", "standards", "nursing profession"],
  },

  // Unit II: Foundations of Medical-Surgical Nursing
  {
    number: 2, title: "Basic Concepts",
    nclexCategory: "Management of Care", subjectTag: "Med-Surg",
    keywords: ["basic concept", "anticipating provider"],
  },
  {
    number: 3, title: "Assessment",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["assessment", "data collection", "physical assessment"],
  },
  {
    number: 4, title: "Comfort",
    nclexCategory: "Basic Care and Comfort", subjectTag: "Med-Surg",
    keywords: ["comfort", "pain management", "pain relief"],
  },

  // Unit III: Cardiovascular and Hematologic System
  {
    number: 5, title: "Cardiovascular Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["cardiovascular", "cardiac", "heart rate", "blood pressure"],
  },
  {
    number: 6, title: "Heart Failure",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["heart failure", "pulmonary edema", "cardiac output"],
  },
  {
    number: 7, title: "Coronary Artery Disease",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["coronary artery", "myocardial infarction", "angina", "coronary heart"],
  },
  {
    number: 8, title: "Dysrhythmias",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["dysrhythmia", "arrhythmia", "electrocardiography", "cardiac rhythm"],
  },
  {
    number: 9, title: "Peripheral Vascular Disease",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["peripheral vascular", "peripheral artery", "deep vein thrombosis", "hypertension"],
  },
  {
    number: 10, title: "Clotting Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["clotting", "coagulation", "anticoagulant", "thrombus", "warfarin", "heparin"],
  },
  {
    number: 11, title: "Anemia and Hematologic Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["anemia", "hematologic", "sickle cell", "pernicious anemia", "blood disorder"],
  },

  // Unit IV: Respiratory System
  {
    number: 12, title: "Respiratory Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["respiratory", "oxygenation", "breathing", "lung", "oxygen"],
  },
  {
    number: 13, title: "Airway Management",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["airway management", "suctioning", "tracheostomy", "artificial airway"],
  },
  {
    number: 14, title: "Chronic Obstructive Pulmonary Disease (COPD)",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["copd", "chronic obstructive", "emphysema", "chronic bronchitis"],
  },
  {
    number: 15, title: "Asthma",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["asthma", "bronchospasm", "inhaler"],
  },
  {
    number: 16, title: "Pneumonia",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["pneumonia", "pulmonary infection"],
  },
  {
    number: 17, title: "Tuberculosis",
    nclexCategory: "Safety and Infection Control", subjectTag: "Med-Surg",
    keywords: ["tuberculosis", "mantoux", "tb skin test", "acid-fast"],
  },
  {
    number: 18, title: "Lung Cancer",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["lung cancer", "pulmonary cancer", "chemotherapy", "cyclophosphamide"],
  },
  {
    number: 19, title: "Pulmonary Edema and Pulmonary Embolism",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["pulmonary embolism", "deep vein", "pulmonary edema"],
  },

  // Unit V: Neurological System
  {
    number: 20, title: "Neurological Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["neurological", "neurology", "nervous system"],
  },
  {
    number: 21, title: "Increased Intracranial Pressure",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["intracranial pressure", "brain herniation"],
  },
  {
    number: 22, title: "Stroke",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["stroke", "cerebrovascular", "cva", "tia"],
  },
  {
    number: 23, title: "Traumatic Brain Injury",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["traumatic brain", "brain injury", "head injury", "concussion"],
  },
  {
    number: 24, title: "Spinal Cord Injury",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["spinal cord", "spinal injury", "paraplegia", "quadriplegia"],
  },
  {
    number: 25, title: "Seizures",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["seizure", "epilepsy", "anticonvulsant"],
  },
  {
    number: 26, title: "Parkinson's Disease and Multiple Sclerosis",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["parkinson", "multiple sclerosis", "demyelinating"],
  },
  {
    number: 27, title: "Peripheral Nervous System Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["peripheral neuropathy", "guillain-barre", "myasthenia"],
  },

  // Unit VI: Musculoskeletal System
  {
    number: 28, title: "Musculoskeletal Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["musculoskeletal", "bone", "muscle", "ergonomic"],
  },
  {
    number: 29, title: "Fractures",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["fracture", "cast care", "traction", "orthopedic"],
  },
  {
    number: 30, title: "Joint Replacement",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["joint replacement", "arthroplasty", "hip replacement", "knee replacement", "valvuloplasty"],
  },
  {
    number: 31, title: "Osteoporosis",
    nclexCategory: "Health Promotion and Maintenance", subjectTag: "Med-Surg",
    keywords: ["osteoporosis", "bone density", "calcium supplement"],
  },
  {
    number: 32, title: "Rheumatoid Arthritis and Connective Tissue Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["rheumatoid arthritis", "connective tissue", "lupus", "gout"],
  },

  // Unit VII: Gastrointestinal System
  {
    number: 33, title: "Gastrointestinal Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["gastrointestinal", "abdominal assessment", "gi disorder"],
  },
  {
    number: 34, title: "Nausea and Vomiting",
    nclexCategory: "Basic Care and Comfort", subjectTag: "Med-Surg",
    keywords: ["nausea", "vomiting", "gastric lavage", "antiemetic"],
  },
  {
    number: 35, title: "Upper Gastrointestinal Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["peptic ulcer", "gastroesophageal", "upper gastrointestinal", "esophageal", "hiatal hernia"],
  },
  {
    number: 36, title: "Lower Gastrointestinal Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["colitis", "diverticular", "irritable bowel", "inflammatory bowel", "lower gastrointestinal", "colorectal", "crohn"],
  },
  {
    number: 37, title: "Liver, Biliary, and Pancreatic Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["liver", "hepatic", "cirrhosis", "biliary", "pancreatic", "pancreatitis", "cholecystitis", "hepatitis"],
  },
  {
    number: 38, title: "Surgical Interventions for Gastrointestinal Disorders",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["ostomy", "colostomy", "ileostomy", "parenteral nutrition", "total parenteral", "postoperative"],
  },

  // Unit VIII: Endocrine System
  {
    number: 39, title: "Endocrine Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["endocrine", "hormone"],
  },
  {
    number: 40, title: "Diabetes Mellitus",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["diabetes", "insulin", "glucose", "hyperglycemia", "hypoglycemia", "diabetic"],
  },
  {
    number: 41, title: "Thyroid Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["thyroid", "hypothyroidism", "hyperthyroidism", "thyroidectomy"],
  },
  {
    number: 42, title: "Adrenal Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["adrenal", "cushing", "addison", "corticosteroid"],
  },

  // Unit IX: Renal and Urinary System
  {
    number: 43, title: "Renal and Urinary Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["renal", "urinary", "kidney", "urine", "urinalysis"],
  },
  {
    number: 44, title: "Urinary Tract Infections",
    nclexCategory: "Safety and Infection Control", subjectTag: "Med-Surg",
    keywords: ["urinary tract infection", "uti", "antibiotic-resistant", "isolation precautions"],
  },
  {
    number: 45, title: "Renal Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["renal disorder", "kidney disease", "nephrotic", "glomerulonephritis"],
  },
  {
    number: 46, title: "Kidney Failure",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["kidney failure", "renal failure", "dialysis", "hemodialysis"],
  },
  {
    number: 47, title: "Urinary Incontinence and Retention",
    nclexCategory: "Basic Care and Comfort", subjectTag: "Med-Surg",
    keywords: ["urinary incontinence", "urinary retention", "bladder", "catheter"],
  },

  // Unit X: Reproductive System
  {
    number: 48, title: "Reproductive System Basics",
    nclexCategory: "Health Promotion and Maintenance", subjectTag: "Med-Surg",
    keywords: ["reproductive", "gynecological", "prostate"],
  },
  {
    number: 49, title: "Sexually Transmitted Infections",
    nclexCategory: "Safety and Infection Control", subjectTag: "Med-Surg",
    keywords: ["sexually transmitted", "std", "sti", "hiv", "herpes"],
  },
  {
    number: 50, title: "Reproductive Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["reproductive disorder", "ovarian", "uterine", "mastectomy", "abdominal hysterectomy"],
  },

  // Unit XI: Integumentary System
  {
    number: 51, title: "Integumentary Basics",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["integumentary", "skin", "dermatology", "skin integrity"],
  },
  {
    number: 52, title: "Burns",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["burn", "burn injury", "thermal injury"],
  },
  {
    number: 53, title: "Wound Management",
    nclexCategory: "Reduction of Risk Potential", subjectTag: "Med-Surg",
    keywords: ["wound", "pressure injury", "wound management", "wound care", "dressing"],
  },

  // Unit XII: Eye and Ear
  {
    number: 54, title: "Eye Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["eye", "ocular", "glaucoma", "cataract", "vision"],
  },
  {
    number: 55, title: "Ear Disorders",
    nclexCategory: "Physiological Adaptation", subjectTag: "Med-Surg",
    keywords: ["ear", "hearing", "otitis", "vertigo", "tinnitus"],
  },
];

export async function seedMedSurgCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped  = 0;

  // ── 1. Upsert textbook ────────────────────────────────────────────────────
  const existingBook = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, MEDSURG_TITLE));

  let textbookId: string;

  if (existingBook.length > 0) {
    textbookId = existingBook[0].id;
    skipped++;
  } else {
    const [book] = await db
      .insert(textbooks)
      .values({
        title:          MEDSURG_TITLE,
        publisher:      "Open RN / Chippewa Valley Technical College",
        edition:        "Current (Open Access)",
        primarySubject: "Med-Surg",
        description:
          "Open RN Medical-Surgical Nursing textbook covering adult health conditions across all major body systems. Organized by system with chapters on pathophysiology, assessment, nursing interventions, and patient education — aligned to NCLEX-RN client need categories.",
        isActive: true,
      })
      .returning();
    textbookId = book.id;
    inserted++;
  }

  // ── 2. Upsert chapters ────────────────────────────────────────────────────
  const existingChapters = await db
    .select({ id: textbookChapters.id, title: textbookChapters.title })
    .from(textbookChapters)
    .where(eq(textbookChapters.textbookId, textbookId));

  const chapterIdByTitle = new Map(existingChapters.map(c => [c.title, c.id]));
  const chapterNumberToId = new Map<number, string>();

  for (const ch of MEDSURG_CHAPTERS) {
    let chapterId = chapterIdByTitle.get(ch.title);
    if (chapterId) {
      skipped++;
    } else {
      const [created] = await db
        .insert(textbookChapters)
        .values({
          textbookId,
          chapterNumber: String(ch.number),
          title:         ch.title,
          subjectTag:    ch.subjectTag,
          nclexCategoryTag: ch.nclexCategory,
        })
        .returning();
      chapterId = created.id;
      inserted++;
    }
    chapterNumberToId.set(ch.number, chapterId);
  }

  // ── 3. Upsert chapter_topic_mappings ──────────────────────────────────────
  // Find which chapter→topic pairs already exist so we stay idempotent
  const existingMappings = await db
    .select({ chapterId: chapterTopicMappings.chapterId, nursingTopicId: chapterTopicMappings.nursingTopicId })
    .from(chapterTopicMappings)
    .where(
      sql`${chapterTopicMappings.chapterId} IN (${sql.join(
        [...chapterNumberToId.values()].map(id => sql`${id}`),
        sql`, `
      )})`
    );

  const existingPairs = new Set(
    existingMappings
      .filter(m => m.nursingTopicId !== null)
      .map(m => `${m.chapterId}||${m.nursingTopicId}`)
  );

  for (const ch of MEDSURG_CHAPTERS) {
    const chapterId = chapterNumberToId.get(ch.number);
    if (!chapterId || ch.keywords.length === 0) continue;

    // Build OR conditions for all keywords
    const conditions = ch.keywords.map(kw => ilike(nursingTopics.name, `%${kw}%`));

    const matchedTopics = await db
      .select({ id: nursingTopics.id, name: nursingTopics.name })
      .from(nursingTopics)
      .where(or(...conditions))
      .limit(30);

    for (const topic of matchedTopics) {
      const pairKey = `${chapterId}||${topic.id}`;
      if (existingPairs.has(pairKey)) {
        skipped++;
        continue;
      }
      await db.insert(chapterTopicMappings).values({
        chapterId,
        nursingTopicId: topic.id,
        subject:        "Med-Surg",
        notes:          `Auto-mapped: "${ch.title}" keyword match`,
      });
      existingPairs.add(pairKey);
      inserted++;
    }
  }

  return { inserted, skipped };
}
