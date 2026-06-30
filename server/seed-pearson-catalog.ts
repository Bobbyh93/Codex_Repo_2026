import { db } from "./db";
import { textbooks, textbookChapters } from "@shared/schema";
import { eq } from "drizzle-orm";

const PEARSON_TITLE = "Clinical Judgment: The Nurse's Guide to Concept-Based Learning";

const PEARSON_CONCEPTS: Array<{ title: string; nclexCategory: string }> = [
  { title: "Gas Exchange", nclexCategory: "Physiological Adaptation" },
  { title: "Perfusion", nclexCategory: "Physiological Adaptation" },
  { title: "Clotting", nclexCategory: "Physiological Adaptation" },
  { title: "Infection", nclexCategory: "Safety and Infection Control" },
  { title: "Inflammation", nclexCategory: "Physiological Adaptation" },
  { title: "Immunity", nclexCategory: "Physiological Adaptation" },
  { title: "Fluid and Electrolyte Balance", nclexCategory: "Physiological Adaptation" },
  { title: "Acid-Base Balance", nclexCategory: "Physiological Adaptation" },
  { title: "Cellular Regulation", nclexCategory: "Physiological Adaptation" },
  { title: "Metabolism", nclexCategory: "Physiological Adaptation" },
  { title: "Sensory Perception", nclexCategory: "Basic Care and Comfort" },
  { title: "Mobility", nclexCategory: "Basic Care and Comfort" },
  { title: "Tissue Integrity", nclexCategory: "Reduction of Risk Potential" },
  { title: "Elimination", nclexCategory: "Basic Care and Comfort" },
  { title: "Thermoregulation", nclexCategory: "Physiological Adaptation" },
  { title: "Reproduction", nclexCategory: "Health Promotion and Maintenance" },
  { title: "Development", nclexCategory: "Health Promotion and Maintenance" },
  { title: "Self", nclexCategory: "Psychosocial Integrity" },
  { title: "Stress and Coping", nclexCategory: "Psychosocial Integrity" },
  { title: "Mood and Affect", nclexCategory: "Psychosocial Integrity" },
  { title: "Cognition", nclexCategory: "Psychosocial Integrity" },
  { title: "Addiction", nclexCategory: "Psychosocial Integrity" },
  { title: "Communication", nclexCategory: "Management of Care" },
  { title: "Managing Care", nclexCategory: "Management of Care" },
  { title: "Safety", nclexCategory: "Safety and Infection Control" },
  { title: "Accountability", nclexCategory: "Management of Care" },
  { title: "Evidence-Based Practice", nclexCategory: "Management of Care" },
  { title: "Health Promotion", nclexCategory: "Health Promotion and Maintenance" },
  { title: "Advocacy", nclexCategory: "Management of Care" },
  { title: "Culture and Diversity", nclexCategory: "Psychosocial Integrity" },
  { title: "Spirituality", nclexCategory: "Psychosocial Integrity" },
  { title: "Ethics", nclexCategory: "Management of Care" },
  { title: "Legal Issues", nclexCategory: "Management of Care" },
  { title: "Informatics", nclexCategory: "Management of Care" },
];

export async function seedPearsonCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, PEARSON_TITLE));

  let textbookId: string;

  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [book] = await db
      .insert(textbooks)
      .values({
        title: PEARSON_TITLE,
        publisher: "Pearson",
        edition: "Current",
        primarySubject: "All Subjects",
        description:
          "Pearson's concept-based nursing series organizing NCLEX content around foundational nursing concepts rather than body systems, facilitating clinical judgment across all practice settings.",
        isActive: true,
      })
      .returning();
    textbookId = book.id;
    inserted++;
  }

  const existingChapters = await db
    .select({ title: textbookChapters.title })
    .from(textbookChapters)
    .where(eq(textbookChapters.textbookId, textbookId));

  const existingTitles = new Set(existingChapters.map((c) => c.title));

  for (let i = 0; i < PEARSON_CONCEPTS.length; i++) {
    const concept = PEARSON_CONCEPTS[i];
    if (existingTitles.has(concept.title)) {
      skipped++;
    } else {
      await db.insert(textbookChapters).values({
        textbookId,
        chapterNumber: String(i + 1),
        title: concept.title,
        subjectTag: "Concept-Based",
        nclexCategoryTag: concept.nclexCategory,
      });
      inserted++;
    }
  }

  return { inserted, skipped };
}
