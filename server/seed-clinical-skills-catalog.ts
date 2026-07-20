import { db } from "./db";
import { textbooks, textbookChapters, chapterTopicMappings, nursingTopics } from "@shared/schema";
import { eq, or, ilike } from "drizzle-orm";

interface ClinicalSkillsChapter {
  number: string;
  title: string;
  subjectTag: string;
  nclexCategory: string;
  url: string;
  keywords: string[];
}

const CLINICAL_SKILLS_TITLE = "Clinical Nursing Skills";

const CLINICAL_SKILLS_CHAPTERS: ClinicalSkillsChapter[] = [
  {
    number: "1",
    title: "Foundations of Nursing Practice",
    subjectTag: "Fundamentals",
    nclexCategory: "Management of Care",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-1/",
    keywords: [
      "nursing process", "clinical judgment", "professional nursing", "scope of practice",
      "documentation", "nursing theory", "standards of care",
    ],
  },
  {
    number: "2",
    title: "Safe and Clean Environment",
    subjectTag: "Fundamentals",
    nclexCategory: "Safety and Infection Control",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-2/",
    keywords: [
      "patient safety", "fall prevention", "safe environment", "restraints",
      "bed safety", "call light", "safety device",
    ],
  },
  {
    number: "3",
    title: "Infection Control",
    subjectTag: "Fundamentals",
    nclexCategory: "Safety and Infection Control",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-3/",
    keywords: [
      "infection control", "hand hygiene", "standard precautions", "PPE",
      "asepsis", "sterile technique", "transmission-based precautions",
      "healthcare-associated infection", "HAI",
    ],
  },
  {
    number: "4",
    title: "Vital Signs",
    subjectTag: "Fundamentals",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-4/",
    keywords: [
      "vital signs", "blood pressure", "temperature", "pulse", "respiratory rate",
      "oxygen saturation", "SpO2", "vital sign assessment", "hypertension",
    ],
  },
  {
    number: "5",
    title: "Admission, Transfer, and Discharge",
    subjectTag: "Fundamentals",
    nclexCategory: "Management of Care",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-5/",
    keywords: [
      "admission", "transfer", "discharge", "continuity of care", "discharge planning",
      "referral", "case management", "patient handoff",
    ],
  },
  {
    number: "6",
    title: "Patient Assessment",
    subjectTag: "Fundamentals",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-6/",
    keywords: [
      "patient assessment", "physical assessment", "head-to-toe assessment",
      "health history", "auscultation", "inspection", "palpation", "percussion",
      "system-specific assessment",
    ],
  },
  {
    number: "7",
    title: "Oxygen Therapy",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Physiological Adaptation",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-7/",
    keywords: [
      "oxygen therapy", "oxygen", "nasal cannula", "face mask", "hypoxia",
      "hypoxemia", "oxygenation", "COPD", "respiratory therapy",
    ],
  },
  {
    number: "8",
    title: "Suctioning",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Physiological Adaptation",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-8/",
    keywords: [
      "suctioning", "airway clearance", "nasopharyngeal suction", "oropharyngeal suction",
      "tracheobronchial suction", "secretions", "airway management",
    ],
  },
  {
    number: "9",
    title: "Chest Tubes",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-9/",
    keywords: [
      "chest tube", "pleural drainage", "pneumothorax", "hemothorax", "pleural effusion",
      "water seal", "thoracic drainage",
    ],
  },
  {
    number: "10",
    title: "Neurological Assessment",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-10/",
    keywords: [
      "neurological assessment", "Glasgow Coma Scale", "pupil assessment",
      "level of consciousness", "neuro check", "cranial nerves", "stroke assessment",
      "increased intracranial pressure", "ICP",
    ],
  },
  {
    number: "11",
    title: "IV Therapy Management",
    subjectTag: "Fundamentals",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-11/",
    keywords: [
      "IV therapy", "intravenous therapy", "IV access", "peripheral IV", "IV insertion",
      "infusion", "IV site care", "phlebitis", "infiltration", "parenteral",
      "IV fluids", "saline lock",
    ],
  },
  {
    number: "12",
    title: "Blood Administration",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Pharmacological and Parenteral Therapies",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-12/",
    keywords: [
      "blood transfusion", "blood administration", "packed red blood cells", "PRBC",
      "blood products", "transfusion reaction", "type and crossmatch",
    ],
  },
  {
    number: "13",
    title: "Enteral Tube Management",
    subjectTag: "Fundamentals",
    nclexCategory: "Basic Care and Comfort",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-13/",
    keywords: [
      "enteral nutrition", "nasogastric tube", "NG tube", "feeding tube", "tube feeding",
      "gastrostomy", "PEG tube", "enteral feeding", "tube placement verification",
    ],
  },
  {
    number: "14",
    title: "Ostomy Care",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Basic Care and Comfort",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-14/",
    keywords: [
      "ostomy", "colostomy", "ileostomy", "urostomy", "ostomy care", "stoma",
      "ostomy appliance", "bowel diversion",
    ],
  },
  {
    number: "15",
    title: "Wound Care",
    subjectTag: "Fundamentals",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-15/",
    keywords: [
      "wound care", "wound assessment", "wound healing", "dressing change",
      "pressure injury", "pressure ulcer", "skin integrity", "dehiscence",
      "wound irrigation", "debridement",
    ],
  },
  {
    number: "16",
    title: "Preoperative and Postoperative Care",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-16/",
    keywords: [
      "preoperative", "postoperative", "perioperative", "surgical care", "PACU",
      "anesthesia", "consent", "surgical safety checklist", "post-op assessment",
    ],
  },
  {
    number: "17",
    title: "Isolation Precautions",
    subjectTag: "Fundamentals",
    nclexCategory: "Safety and Infection Control",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-17/",
    keywords: [
      "isolation precautions", "contact precautions", "droplet precautions",
      "airborne precautions", "neutropenic precautions", "protective isolation",
      "MRSA", "C. diff", "transmission-based",
    ],
  },
  {
    number: "18",
    title: "Specimen Collection",
    subjectTag: "Fundamentals",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-18/",
    keywords: [
      "specimen collection", "blood draw", "venipuncture", "urine culture", "wound culture",
      "sputum culture", "stool specimen", "throat swab", "laboratory specimen",
    ],
  },
  {
    number: "19",
    title: "Point-of-Care Testing",
    subjectTag: "Fundamentals",
    nclexCategory: "Reduction of Risk Potential",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-19/",
    keywords: [
      "point-of-care testing", "glucometer", "blood glucose monitoring", "rapid test",
      "bedside testing", "capillary blood glucose", "POCT",
    ],
  },
  {
    number: "20",
    title: "Urinary Catheterization",
    subjectTag: "Fundamentals",
    nclexCategory: "Basic Care and Comfort",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-20/",
    keywords: [
      "urinary catheterization", "Foley catheter", "indwelling catheter", "intermittent catheter",
      "straight catheter", "CAUTI", "urinary retention", "catheter care",
    ],
  },
  {
    number: "21",
    title: "Bowel Elimination",
    subjectTag: "Fundamentals",
    nclexCategory: "Basic Care and Comfort",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-21/",
    keywords: [
      "bowel elimination", "constipation", "diarrhea", "enema", "bowel assessment",
      "fecal impaction", "elimination", "bowel sounds", "digital rectal",
    ],
  },
  {
    number: "22",
    title: "Tracheostomy Care",
    subjectTag: "Medical-Surgical",
    nclexCategory: "Physiological Adaptation",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-22/",
    keywords: [
      "tracheostomy", "tracheostomy care", "trach care", "trach tube", "inner cannula",
      "tracheostomy suctioning", "airway", "mechanical ventilation",
    ],
  },
  {
    number: "23",
    title: "End-of-Life Care",
    subjectTag: "Fundamentals",
    nclexCategory: "Psychosocial Integrity",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-23/",
    keywords: [
      "end-of-life", "palliative care", "hospice", "dying patient", "grief",
      "advance directive", "DNR", "comfort care", "death and dying",
    ],
  },
  {
    number: "24",
    title: "Documentation",
    subjectTag: "Fundamentals",
    nclexCategory: "Management of Care",
    url: "https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-24/",
    keywords: [
      "documentation", "charting", "electronic health record", "EHR", "SBAR",
      "incident report", "nursing notes", "medical record",
    ],
  },
];

export async function seedClinicalSkillsCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, CLINICAL_SKILLS_TITLE));

  let textbookId: string;

  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [newBook] = await db
      .insert(textbooks)
      .values({
        title: CLINICAL_SKILLS_TITLE,
        publisher: "Open RN / Chippewa Valley Technical College",
        edition: "Current (Open Access)",
        primarySubject: "Fundamentals",
        description:
          "Open RN Clinical Nursing Skills textbook covering foundational and advanced clinical procedures including vital signs, IV therapy, wound care, oxygen therapy, urinary catheterization, and perioperative nursing.",
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
  const chapterNumberToId = new Map<string, string>();

  for (const ch of CLINICAL_SKILLS_CHAPTERS) {
    if (existingTitles.has(ch.title)) {
      const found = existingChapters.find((c) => c.title === ch.title);
      if (found) {
        await db
          .update(textbookChapters)
          .set({ url: ch.url })
          .where(eq(textbookChapters.id, found.id));
        chapterNumberToId.set(ch.number, found.id);
      }
      skipped++;
    } else {
      const [newCh] = await db
        .insert(textbookChapters)
        .values({
          textbookId,
          chapterNumber: ch.number,
          title: ch.title,
          subjectTag: ch.subjectTag,
          nclexCategoryTag: ch.nclexCategory,
          url: ch.url,
        })
        .returning();
      chapterNumberToId.set(ch.number, newCh.id);
      inserted++;
    }
  }

  for (const ch of CLINICAL_SKILLS_CHAPTERS) {
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
        subject: ch.subjectTag,
        notes: `Auto-mapped: "${ch.title}" keyword match`,
      });
      mappedTopicIds.add(topic.id);
      inserted++;
    }
  }

  return { inserted, skipped };
}
