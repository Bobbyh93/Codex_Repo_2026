import { db } from "./db";
import { textbooks, textbookChapters, chapterTopicMappings, nursingTopics } from "../shared/schema";
import { eq, or, ilike } from "drizzle-orm";

const POP_HEALTH_TITLE = "Nursing Mental Health and Community Concepts 2e — Community Health Chapters";

interface PopHealthChapter {
  number: number;
  title: string;
  nclexCategory: string;
  subjectTag: string;
  url: string;
  keywords: string[];
}

const POP_HEALTH_CHAPTERS: PopHealthChapter[] = [
  {
    number: 1,
    title: "Health, Wellness, and Disease Prevention",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/chapter-2/",
    keywords: [
      "health promotion", "disease prevention", "primary prevention", "secondary prevention",
      "tertiary prevention", "risk reduction", "behavioral change", "wellness",
    ],
  },
  {
    number: 2,
    title: "Family and Community Health",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/healthpromo/chapter/chapter-4/",
    keywords: [
      "family health", "community health", "family dynamics", "family structure",
      "social determinants", "health disparities",
    ],
  },
  {
    number: 3,
    title: "Substance Use Disorders in the Community",
    nclexCategory: "Psychosocial Integrity",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/nursingmhcc/chapter/chapter-14/",
    keywords: [
      "substance use", "substance use disorder", "addiction", "opioid",
      "alcohol use disorder", "withdrawal", "detoxification", "naloxone",
      "harm reduction", "prevention program",
    ],
  },
  {
    number: 4,
    title: "Trauma, Abuse, and Violence in the Community",
    nclexCategory: "Psychosocial Integrity",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/nursingmhcc/chapter/chapter-15/",
    keywords: [
      "trauma", "adverse childhood experiences", "ACE", "trauma-informed care",
      "abuse", "neglect", "intimate partner violence", "domestic violence",
      "workplace violence", "mandatory reporting",
    ],
  },
  {
    number: 5,
    title: "Community Health Nursing Concepts",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/nursingmhcc/chapter/16-2-community-health-concepts/",
    keywords: [
      "community health nursing", "public health nursing", "community assessment",
      "epidemiology", "population health", "communicable disease", "outbreak",
      "case management", "home health",
    ],
  },
  {
    number: 6,
    title: "Vulnerable Populations",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/nursingmhcc/chapter/17-2-vulnerable-populations/",
    keywords: [
      "vulnerable population", "homeless", "poverty", "rural health",
      "underserved", "minority health", "health equity", "food insecurity",
      "cultural competence", "health literacy",
    ],
  },
  {
    number: 7,
    title: "Environmental Health and Emergency Preparedness",
    nclexCategory: "Safety and Infection Control",
    subjectTag: "Community Health",
    url: "https://wtcs.pressbooks.pub/nursingmhcc/chapter/chapter-18/",
    keywords: [
      "environmental health", "occupational health", "lead exposure", "air quality",
      "emergency preparedness", "disaster nursing", "mass casualty", "bioterrorism",
      "pandemic", "emergency response", "triage",
    ],
  },
];

export async function seedPopulationHealthCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, POP_HEALTH_TITLE));

  let textbookId: string;

  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [newBook] = await db
      .insert(textbooks)
      .values({
        title: POP_HEALTH_TITLE,
        publisher: "Open RN / Chippewa Valley Technical College",
        edition: "2nd Edition (Open Access)",
        primarySubject: "Community Health",
        description:
          "Community and population health chapters from two Open RN textbooks: Nursing Health Promotion (health/wellness/disease prevention, family and community health) and Nursing Mental Health and Community Concepts 2e (substance use disorders, trauma and violence, community health nursing, vulnerable populations, environmental health and emergency preparedness). All chapters available at wtcs.pressbooks.pub.",
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

  for (const ch of POP_HEALTH_CHAPTERS) {
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

  for (const ch of POP_HEALTH_CHAPTERS) {
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
        subject: "Community Health",
        notes: `Auto-mapped: "${ch.title}" keyword match`,
      });
      mappedTopicIds.add(topic.id);
      inserted++;
    }
  }

  return { inserted, skipped };
}
