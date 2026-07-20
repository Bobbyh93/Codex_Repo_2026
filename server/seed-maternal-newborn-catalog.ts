import { db } from "./db";
import { textbooks, textbookChapters, chapterTopicMappings, nursingTopics } from "@shared/schema";
import { eq, or, and, ilike } from "drizzle-orm";

const MATERNAL_NEWBORN_TITLE = "Maternal-Newborn Nursing";

interface MaternalNewbornChapter {
  number: number;
  title: string;
  nclexCategory: string;
  subjectTag: string;
  url: string;
  keywords: string[];
}

const MATERNAL_NEWBORN_CHAPTERS: MaternalNewbornChapter[] = [
  {
    number: 1,
    title: "Antepartum Nursing Care",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-1/",
    keywords: [
      "antepartum", "prenatal care", "pregnancy", "prenatal", "antenatal",
      "gestational age", "fetal development", "obstetric history", "gravida", "para",
      "prenatal visit", "fetal growth", "obstetric", "maternal",
    ],
  },
  {
    number: 2,
    title: "High-Risk Antepartum Nursing Care",
    nclexCategory: "Reduction of Risk Potential",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-2/",
    keywords: [
      "high-risk pregnancy", "preeclampsia", "eclampsia", "gestational diabetes",
      "gestational hypertension", "HELLP syndrome", "placenta previa", "placental abruption",
      "hyperemesis gravidarum", "preterm labor", "incompetent cervix", "ectopic pregnancy",
      "spontaneous abortion", "miscarriage", "fetal demise", "Rh incompatibility",
    ],
  },
  {
    number: 3,
    title: "Intrapartum Nursing Care",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-3/",
    keywords: [
      "intrapartum", "labor", "delivery", "labor and delivery", "labor stages",
      "cervical dilation", "effacement", "fetal station", "contractions", "active labor",
      "second stage labor", "third stage labor", "pushing", "episiotomy", "birth",
      "Leopold maneuver", "rupture of membranes", "SROM", "AROM",
    ],
  },
  {
    number: 4,
    title: "High-Risk Intrapartum Nursing Care",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-4/",
    keywords: [
      "dystocia", "prolonged labor", "fetal distress", "fetal monitoring", "electronic fetal monitoring",
      "late decelerations", "variable decelerations", "oxytocin", "Pitocin",
      "cord prolapse", "shoulder dystocia", "uterine rupture", "cesarean section", "C-section",
      "operative delivery", "vacuum extraction", "forceps delivery", "precipitous labor",
    ],
  },
  {
    number: 5,
    title: "Postpartum Nursing Care",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-5/",
    keywords: [
      "postpartum", "postnatal", "fourth trimester", "lochia", "uterine involution",
      "fundal assessment", "breastfeeding", "lactation", "breast engorgement",
      "perineal care", "postpartum blues", "bonding", "attachment", "BUBBLE-HE",
      "pain management postpartum",
    ],
  },
  {
    number: 6,
    title: "High-Risk Postpartum Nursing Care",
    nclexCategory: "Reduction of Risk Potential",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-6/",
    keywords: [
      "postpartum hemorrhage", "postpartum infection", "postpartum depression",
      "postpartum psychosis", "endometritis", "mastitis", "thromboembolic disease",
      "deep vein thrombosis postpartum", "subinvolution", "retained placenta",
      "postpartum complication", "uterine atony",
    ],
  },
  {
    number: 7,
    title: "Newborn Nursing Care",
    nclexCategory: "Health Promotion and Maintenance",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-7/",
    keywords: [
      "newborn", "neonate", "neonatal", "APGAR score", "newborn assessment",
      "newborn transition", "thermoregulation newborn", "neonatal care",
      "newborn reflexes", "Moro reflex", "rooting reflex", "cord care",
      "neonatal jaundice", "hyperbilirubinemia", "breastfeeding initiation",
      "neonatal screening", "circumcision", "vitamin K",
    ],
  },
  {
    number: 8,
    title: "High-Risk Newborn Nursing Care",
    nclexCategory: "Physiological Adaptation",
    subjectTag: "OB/Maternal",
    url: "https://wtcs.pressbooks.pub/maternalnewborn/chapter/chapter-8/",
    keywords: [
      "premature infant", "preterm infant", "prematurity", "respiratory distress syndrome",
      "neonatal RDS", "NICU", "neonatal intensive care", "neonatal sepsis",
      "small for gestational age", "SGA", "large for gestational age", "LGA",
      "hypoglycemia newborn", "neonatal abstinence syndrome", "meconium aspiration",
      "neonatal hypothermia", "neonatal jaundice severe",
    ],
  },
];

export async function seedMaternalNewbornCatalog(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, MATERNAL_NEWBORN_TITLE));

  let textbookId: string;

  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [newBook] = await db
      .insert(textbooks)
      .values({
        title: MATERNAL_NEWBORN_TITLE,
        publisher: "Open RN / Chippewa Valley Technical College",
        edition: "Current (Open Access)",
        primarySubject: "OB/Maternal",
        description:
          "Open RN Maternal-Newborn Nursing textbook covering antepartum, intrapartum, postpartum, and newborn nursing care, including high-risk conditions such as preeclampsia, gestational diabetes, fetal monitoring, postpartum hemorrhage, and neonatal complications. Available open-access at wtcs.pressbooks.pub.",
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

  for (const ch of MATERNAL_NEWBORN_CHAPTERS) {
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

  for (const ch of MATERNAL_NEWBORN_CHAPTERS) {
    const chapterId = chapterNumberToId.get(ch.number);
    if (!chapterId || ch.keywords.length === 0) continue;

    const keywordConditions = ch.keywords.map((kw) => ilike(nursingTopics.name, `%${kw}%`));
    const subjectFilter = or(
      eq(nursingTopics.subject, "OB/Maternal"),
      eq(nursingTopics.subject, "Maternal and Newborn"),
    );
    const matchedTopics = await db
      .select({ id: nursingTopics.id })
      .from(nursingTopics)
      .where(and(subjectFilter, or(...keywordConditions)))
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
        subject: "OB/Maternal",
        notes: `Auto-mapped: "${ch.title}" keyword match`,
      });
      mappedTopicIds.add(topic.id);
      inserted++;
    }
  }

  return { inserted, skipped };
}
