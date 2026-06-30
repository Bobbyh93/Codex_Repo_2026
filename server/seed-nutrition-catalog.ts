import { db } from "./db";
import { textbooks, textbookChapters, chapterTopicMappings, nursingTopics } from "../shared/schema";
import { eq, or, ilike } from "drizzle-orm";

const NUTRITION_TITLE = "Nursing Health Promotion — Nutrition and Dietary Care Chapters";

interface NutritionChapter {
  number: number;
  title: string;
  nclexCategory: string;
  subjectTag: string;
  url: string;
  keywords: string[];
}

const NUTRITION_CHAPTERS: NutritionChapter[] = [
  {
    number: 1,
    title: "Health Teaching and Health Promotion",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "Fundamentals",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/chapter-1/",
    keywords: [
      "health teaching", "health literacy", "patient education", "teaching plan",
      "learning theory", "learner assessment", "health promotion",
    ],
  },
  {
    number: 2,
    title: "Basic Concepts of Nutrition",
    nclexCategory: "Basic Care and Comfort",
    subjectTag: "Fundamentals",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/3-2-basic-concepts-related-to-nutrition/",
    keywords: [
      "nutrition basics", "macronutrient", "micronutrient", "nutrient", "carbohydrate",
      "protein", "fat", "lipid", "vitamin", "mineral", "dietary guideline", "calorie",
    ],
  },
  {
    number: 3,
    title: "Dietary Recommendations Across the Lifespan",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "Fundamentals",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/3-3-dietary-recommendations-according-to-age-and-developmental-level/",
    keywords: [
      "dietary recommendation", "nutrition lifespan", "infant nutrition", "pediatric nutrition",
      "older adult nutrition", "prenatal nutrition", "breastfeeding nutrition", "MyPlate",
    ],
  },
  {
    number: 4,
    title: "Therapeutic Diets and Special Dietary Needs",
    nclexCategory: "Basic Care and Comfort",
    subjectTag: "Fundamentals",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/3-4-specific-dietary-recommendations-based-on-health-conditions/",
    keywords: [
      "therapeutic diet", "special diet", "renal diet", "cardiac diet", "diabetic diet",
      "low-sodium diet", "texture-modified diet", "dysphagia", "clear liquid", "full liquid",
      "gluten-free", "food allergy", "nutritional support",
    ],
  },
  {
    number: 5,
    title: "Applying the Nursing Process to Nutrition",
    nclexCategory: "Reduction of Risk Potential",
    subjectTag: "Fundamentals",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/3-5-applying-the-nursing-process-and-clinical-judgment-model-to-healthy-diets/",
    keywords: [
      "nutritional assessment", "malnutrition screening", "body mass index", "BMI",
      "albumin", "prealbumin", "anthropometric", "nursing process nutrition",
      "clinical judgment nutrition",
    ],
  },
];

export async function seedNutritionCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, NUTRITION_TITLE));

  let textbookId: string;

  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [newBook] = await db
      .insert(textbooks)
      .values({
        title: NUTRITION_TITLE,
        publisher: "Open RN / Chippewa Valley Technical College",
        edition: "Current (Open Access)",
        primarySubject: "Fundamentals",
        description:
          "Nutrition and dietary care chapters from the Open RN Nursing Health Promotion textbook (wtcs.pressbooks.pub/healthpromo). Covers health teaching, basic nutrition concepts (macronutrients, micronutrients, dietary guidelines), dietary recommendations across the lifespan, therapeutic diets for specific health conditions, and applying the clinical judgment model to nutritional assessment and care.",
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

  for (const ch of NUTRITION_CHAPTERS) {
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
          chapterNumber: String(ch.number),
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

  for (const ch of NUTRITION_CHAPTERS) {
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
        subject: "Fundamentals",
        notes: `Auto-mapped: "${ch.title}" keyword match`,
      });
      mappedTopicIds.add(topic.id);
      inserted++;
    }
  }

  return { inserted, skipped };
}
