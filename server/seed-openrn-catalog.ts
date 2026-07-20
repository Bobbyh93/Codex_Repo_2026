import { db } from "./db";
import { textbooks, textbookChapters } from "@shared/schema";
import { eq } from "drizzle-orm";

interface OpenRNBook {
  title: string;
  primarySubject: string;
  description: string;
  chapters: Array<{ title: string; nclexCategory: string }>;
}

const OPENRN_BOOKS: OpenRNBook[] = [
  {
    title: "Nursing Fundamentals",
    primarySubject: "Fundamentals",
    description:
      "Open RN comprehensive fundamentals textbook covering core nursing skills, safety, infection control, and patient care basics.",
    chapters: [
      { title: "Nursing Concepts", nclexCategory: "Management of Care" },
      { title: "Scope and Standards", nclexCategory: "Management of Care" },
      { title: "Communication", nclexCategory: "Management of Care" },
      { title: "Documentation", nclexCategory: "Management of Care" },
      { title: "Infection Control", nclexCategory: "Safety and Infection Control" },
      { title: "Safety", nclexCategory: "Safety and Infection Control" },
      { title: "Vital Signs", nclexCategory: "Reduction of Risk Potential" },
      { title: "Mobility", nclexCategory: "Basic Care and Comfort" },
      { title: "Hygiene", nclexCategory: "Basic Care and Comfort" },
      { title: "Elimination", nclexCategory: "Basic Care and Comfort" },
      { title: "Nutrition", nclexCategory: "Basic Care and Comfort" },
      { title: "Oxygenation", nclexCategory: "Physiological Adaptation" },
      { title: "Pain", nclexCategory: "Basic Care and Comfort" },
      { title: "Fluid and Electrolyte Balance", nclexCategory: "Physiological Adaptation" },
      { title: "Skin Integrity", nclexCategory: "Reduction of Risk Potential" },
      { title: "Perioperative Care", nclexCategory: "Reduction of Risk Potential" },
      { title: "Sensory Perception", nclexCategory: "Basic Care and Comfort" },
      { title: "End-of-Life Care", nclexCategory: "Psychosocial Integrity" },
      { title: "Mental Health", nclexCategory: "Psychosocial Integrity" },
      { title: "Leadership and Management", nclexCategory: "Management of Care" },
    ],
  },
  {
    title: "Nursing Pharmacology",
    primarySubject: "Pharmacology",
    description:
      "Open RN pharmacology textbook covering drug classifications, mechanisms of action, adverse effects, and nursing implications.",
    chapters: [
      { title: "Introduction to Pharmacology", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Nervous System Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Cardiovascular Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Respiratory Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Gastrointestinal Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Endocrine Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Renal Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Musculoskeletal Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Immune System Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Reproductive Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Eye and Ear Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Dermatologic Drugs", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Chemotherapy", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Special Populations Pharmacology", nclexCategory: "Pharmacological and Parenteral Therapies" },
    ],
  },
  {
    title: "Nursing Management of Pain and Nutrition",
    primarySubject: "Fundamentals",
    description:
      "Open RN textbook focused on pain assessment, pharmacological and non-pharmacological pain management, and nutritional care.",
    chapters: [
      { title: "Pain Assessment", nclexCategory: "Basic Care and Comfort" },
      { title: "Pharmacological Pain Management", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Non-Pharmacological Pain Management", nclexCategory: "Basic Care and Comfort" },
      { title: "Nutritional Assessment", nclexCategory: "Basic Care and Comfort" },
      { title: "Enteral and Parenteral Nutrition", nclexCategory: "Pharmacological and Parenteral Therapies" },
      { title: "Special Dietary Considerations", nclexCategory: "Basic Care and Comfort" },
    ],
  },
  {
    title: "Nursing Maternal-Newborn",
    primarySubject: "OB/Maternal",
    description:
      "Open RN maternal-newborn textbook covering prenatal through postpartum care, newborn assessment, and high-risk obstetrics.",
    chapters: [
      { title: "Prenatal Care", nclexCategory: "Health Promotion and Maintenance" },
      { title: "Intrapartum Care", nclexCategory: "Physiological Adaptation" },
      { title: "Postpartum Care", nclexCategory: "Health Promotion and Maintenance" },
      { title: "Newborn Assessment", nclexCategory: "Health Promotion and Maintenance" },
      { title: "High-Risk Pregnancy", nclexCategory: "Reduction of Risk Potential" },
      { title: "Complications of Labor and Birth", nclexCategory: "Physiological Adaptation" },
      { title: "Newborn Complications", nclexCategory: "Physiological Adaptation" },
    ],
  },
  {
    title: "Nursing Pediatrics",
    primarySubject: "Pediatrics",
    description:
      "Open RN pediatrics textbook covering growth and development, pediatric assessment, and management of childhood illnesses across body systems.",
    chapters: [
      { title: "Growth and Development", nclexCategory: "Health Promotion and Maintenance" },
      { title: "Pediatric Assessment", nclexCategory: "Health Promotion and Maintenance" },
      { title: "Pediatric Safety", nclexCategory: "Safety and Infection Control" },
      { title: "Fluid and Electrolyte Imbalances in Children", nclexCategory: "Physiological Adaptation" },
      { title: "Respiratory Conditions", nclexCategory: "Physiological Adaptation" },
      { title: "Cardiovascular Conditions", nclexCategory: "Physiological Adaptation" },
      { title: "Gastrointestinal Conditions", nclexCategory: "Physiological Adaptation" },
      { title: "Neurological Conditions", nclexCategory: "Physiological Adaptation" },
      { title: "Musculoskeletal Conditions", nclexCategory: "Physiological Adaptation" },
      { title: "Endocrine Conditions", nclexCategory: "Physiological Adaptation" },
      { title: "Oncology in Children", nclexCategory: "Physiological Adaptation" },
      { title: "Psychosocial Issues", nclexCategory: "Psychosocial Integrity" },
    ],
  },
  {
    title: "Nursing Mental Health",
    primarySubject: "Mental Health",
    description:
      "Open RN mental health textbook covering psychiatric disorders, therapeutic communication, psychopharmacology, and legal/ethical issues.",
    chapters: [
      { title: "Mental Health Foundations", nclexCategory: "Psychosocial Integrity" },
      { title: "Therapeutic Communication", nclexCategory: "Psychosocial Integrity" },
      { title: "Anxiety Disorders", nclexCategory: "Psychosocial Integrity" },
      { title: "Mood Disorders", nclexCategory: "Psychosocial Integrity" },
      { title: "Psychosis and Schizophrenia", nclexCategory: "Psychosocial Integrity" },
      { title: "Substance Use Disorders", nclexCategory: "Psychosocial Integrity" },
      { title: "Personality Disorders", nclexCategory: "Psychosocial Integrity" },
      { title: "Eating Disorders", nclexCategory: "Psychosocial Integrity" },
      { title: "Child and Adolescent Mental Health", nclexCategory: "Psychosocial Integrity" },
      { title: "Trauma and Stressor-Related Disorders", nclexCategory: "Psychosocial Integrity" },
      { title: "Legal and Ethical Issues", nclexCategory: "Management of Care" },
    ],
  },
];

export async function seedOpenRNCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const book of OPENRN_BOOKS) {
    const existing = await db
      .select({ id: textbooks.id })
      .from(textbooks)
      .where(eq(textbooks.title, book.title));

    let textbookId: string;

    if (existing.length > 0) {
      textbookId = existing[0].id;
      skipped++;
    } else {
      const [newBook] = await db
        .insert(textbooks)
        .values({
          title: book.title,
          publisher: "Open RN / Chippewa Valley Technical College",
          edition: "Current (Open Access)",
          primarySubject: book.primarySubject,
          description: book.description,
          isActive: true,
        })
        .returning();
      textbookId = newBook.id;
      inserted++;
    }

    const existingChapters = await db
      .select({ title: textbookChapters.title })
      .from(textbookChapters)
      .where(eq(textbookChapters.textbookId, textbookId));

    const existingTitles = new Set(existingChapters.map((c) => c.title));

    for (let i = 0; i < book.chapters.length; i++) {
      const ch = book.chapters[i];
      if (existingTitles.has(ch.title)) {
        skipped++;
      } else {
        await db.insert(textbookChapters).values({
          textbookId,
          chapterNumber: String(i + 1),
          title: ch.title,
          subjectTag: book.primarySubject,
          nclexCategoryTag: ch.nclexCategory,
        });
        inserted++;
      }
    }
  }

  return { inserted, skipped };
}
