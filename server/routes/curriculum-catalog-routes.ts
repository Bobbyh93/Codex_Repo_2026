import type { Express, Response, Request } from "express";
import { db } from "../db";
import {
  textbooks,
  textbookChapters,
  textbookSections,
  chapterTopicMappings,
  subjectNclexAlignment,
  contentAreas,
  nursingTopics,
  insertTextbookSchema,
  insertTextbookChapterSchema,
  insertTextbookSectionSchema,
  insertChapterTopicMappingSchema,
  type Textbook,
  type TextbookChapter,
  type TextbookSection,
  type ChapterTopicMapping,
} from "@shared/schema";
import {
  requireAdminSession,
  auditLog,
  validateCSRFToken,
  type AdminAuthRequest,
} from "../admin-auth-session";
import { invalidateTextbookRefCache, invalidateChapterCache } from "../focused-report-pdf-generator";
import { eq, asc, inArray, sql as drizzleSql } from "drizzle-orm";

// Subject-to-NCLEX alignment seed data
const SUBJECT_NCLEX_ALIGNMENT = [
  {
    subject: "Pharmacology",
    primaryNclexCategory: "Pharmacological and Parenteral Therapies",
    secondaryNclexCategories: ["Physiological Adaptation", "Reduction of Risk Potential"],
    description: "Drug classifications, dosage calculations, adverse effects, and medication administration",
  },
  {
    subject: "Fundamentals",
    primaryNclexCategory: "Basic Care and Comfort",
    secondaryNclexCategories: ["Safety and Infection Control", "Health Promotion and Maintenance"],
    description: "Core nursing skills, hygiene, mobility, nutrition, elimination, and patient comfort",
  },
  {
    subject: "Medical-Surgical",
    primaryNclexCategory: "Physiological Adaptation",
    secondaryNclexCategories: ["Reduction of Risk Potential", "Pharmacological and Parenteral Therapies"],
    description: "Adult health conditions, disease management, and surgical care",
  },
  {
    subject: "OB/Maternal",
    primaryNclexCategory: "Health Promotion and Maintenance",
    secondaryNclexCategories: ["Physiological Adaptation", "Safety and Infection Control"],
    description: "Antepartum, intrapartum, postpartum, and newborn nursing care",
  },
  {
    subject: "Pediatrics",
    primaryNclexCategory: "Growth and Development",
    secondaryNclexCategories: ["Health Promotion and Maintenance", "Reduction of Risk Potential"],
    description: "Child health, developmental milestones, and pediatric disease management",
  },
  {
    subject: "Mental Health",
    primaryNclexCategory: "Psychosocial Integrity",
    secondaryNclexCategories: ["Management of Care", "Health Promotion and Maintenance"],
    description: "Psychiatric disorders, therapeutic communication, and behavioral health",
  },
  {
    subject: "Geriatrics",
    primaryNclexCategory: "Safety and Infection Control",
    secondaryNclexCategories: ["Management of Care", "Basic Care and Comfort"],
    description: "Age-related changes, fall prevention, polypharmacy, and elder care",
  },
  {
    subject: "Community Health",
    primaryNclexCategory: "Health Promotion and Maintenance",
    secondaryNclexCategories: ["Management of Care", "Safety and Infection Control"],
    description: "Population health, epidemiology, and preventive care",
  },
  {
    subject: "Leadership/Management",
    primaryNclexCategory: "Management of Care",
    secondaryNclexCategories: ["Safety and Infection Control"],
    description: "Delegation, prioritization, chain of command, and quality improvement",
  },
];

const requireAdmin = [requireAdminSession];
const requireAdminWrite = [requireAdminSession, validateCSRFToken];

export function registerCurriculumCatalogRoutes(app: Express) {
  // ==================== Seed subject-NCLEX alignment ====================
  app.post(
    "/api/admin/curriculum/seed-alignment",
    requireAdminWrite,
    auditLog("SEED_CURRICULUM_ALIGNMENT"),
    async (_req: AdminAuthRequest, res: Response) => {
      try {
        for (const alignment of SUBJECT_NCLEX_ALIGNMENT) {
          await db
            .insert(subjectNclexAlignment)
            .values(alignment)
            .onConflictDoUpdate({
              target: subjectNclexAlignment.subject,
              set: {
                primaryNclexCategory: alignment.primaryNclexCategory,
                secondaryNclexCategories: alignment.secondaryNclexCategories,
                description: alignment.description,
              },
            });
        }
        res.json({ message: "Subject-NCLEX alignment seeded successfully", count: SUBJECT_NCLEX_ALIGNMENT.length });
      } catch (error) {
        console.error("Seed alignment error:", error);
        res.status(500).json({ error: "Failed to seed alignment data" });
      }
    }
  );

  app.get("/api/admin/curriculum/alignment", requireAdmin, async (_req: AdminAuthRequest, res: Response) => {
    try {
      const alignments = await db.select().from(subjectNclexAlignment).orderBy(asc(subjectNclexAlignment.subject));
      res.json(alignments);
    } catch (error) {
      console.error("Get alignment error:", error);
      res.status(500).json({ error: "Failed to fetch alignment data" });
    }
  });

  // ==================== Textbooks CRUD ====================
  app.get("/api/admin/curriculum/textbooks", requireAdmin, async (_req: AdminAuthRequest, res: Response) => {
    try {
      const books = await db.select().from(textbooks).orderBy(asc(textbooks.title));
      res.json(books);
    } catch (error) {
      console.error("Get textbooks error:", error);
      res.status(500).json({ error: "Failed to fetch textbooks" });
    }
  });

  app.post(
    "/api/admin/curriculum/textbooks",
    requireAdminWrite,
    auditLog("CREATE_TEXTBOOK"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const data = insertTextbookSchema.parse(req.body);
        const [book] = await db.insert(textbooks).values(data).returning();
        invalidateTextbookRefCache();
        res.json(book);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to create textbook";
        res.status(400).json({ error: message });
      }
    }
  );

  app.put(
    "/api/admin/curriculum/textbooks/:id",
    requireAdminWrite,
    auditLog("UPDATE_TEXTBOOK"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const data = insertTextbookSchema.partial().parse(req.body);
        const [book] = await db
          .update(textbooks)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(textbooks.id, id))
          .returning();
        if (!book) return res.status(404).json({ error: "Textbook not found" });
        invalidateTextbookRefCache();
        res.json(book);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update textbook";
        res.status(400).json({ error: message });
      }
    }
  );

  app.delete(
    "/api/admin/curriculum/textbooks/:id",
    requireAdminWrite,
    auditLog("DELETE_TEXTBOOK"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        await db.delete(textbooks).where(eq(textbooks.id, id));
        invalidateTextbookRefCache();
        res.json({ message: "Textbook deleted" });
      } catch (error) {
        console.error("Delete textbook error:", error);
        res.status(500).json({ error: "Failed to delete textbook" });
      }
    }
  );

  // ==================== Chapters CRUD ====================
  app.get(
    "/api/admin/curriculum/textbooks/:textbookId/chapters",
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { textbookId } = req.params;
        const chapters = await db
          .select()
          .from(textbookChapters)
          .where(eq(textbookChapters.textbookId, textbookId))
          .orderBy(asc(textbookChapters.chapterNumber));
        res.json(chapters);
      } catch (error) {
        console.error("Get chapters error:", error);
        res.status(500).json({ error: "Failed to fetch chapters" });
      }
    }
  );

  app.post(
    "/api/admin/curriculum/textbooks/:textbookId/chapters",
    requireAdminWrite,
    auditLog("CREATE_CHAPTER"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { textbookId } = req.params;
        const data = insertTextbookChapterSchema.parse({ ...req.body, textbookId });
        const [chapter] = await db.insert(textbookChapters).values(data).returning();
        invalidateTextbookRefCache();
        res.json(chapter);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to create chapter";
        res.status(400).json({ error: message });
      }
    }
  );

  // Bulk import chapters for a textbook
  app.post(
    "/api/admin/curriculum/textbooks/:textbookId/chapters/bulk",
    requireAdminWrite,
    auditLog("BULK_IMPORT_CHAPTERS"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { textbookId } = req.params;
        const { chapters } = req.body as { chapters: unknown };
        if (!Array.isArray(chapters)) {
          return res.status(400).json({ error: "chapters must be an array" });
        }
        const parsed = chapters.map((ch: unknown) =>
          insertTextbookChapterSchema.parse({ ...(ch as object), textbookId })
        );
        const inserted = await db.insert(textbookChapters).values(parsed).returning();
        invalidateTextbookRefCache();
        res.json({ inserted: inserted.length, chapters: inserted });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to bulk import chapters";
        res.status(400).json({ error: message });
      }
    }
  );

  app.put(
    "/api/admin/curriculum/chapters/:id",
    requireAdminWrite,
    auditLog("UPDATE_CHAPTER"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const data = insertTextbookChapterSchema.partial().parse(req.body);
        const [chapter] = await db
          .update(textbookChapters)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(textbookChapters.id, id))
          .returning();
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });
        invalidateTextbookRefCache();
        invalidateChapterCache(id);
        res.json(chapter);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update chapter";
        res.status(400).json({ error: message });
      }
    }
  );

  app.delete(
    "/api/admin/curriculum/chapters/:id",
    requireAdminWrite,
    auditLog("DELETE_CHAPTER"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        await db.delete(textbookChapters).where(eq(textbookChapters.id, id));
        invalidateTextbookRefCache();
        invalidateChapterCache(id);
        res.json({ message: "Chapter deleted" });
      } catch (error) {
        console.error("Delete chapter error:", error);
        res.status(500).json({ error: "Failed to delete chapter" });
      }
    }
  );

  // ==================== Sections CRUD ====================
  app.get(
    "/api/admin/curriculum/chapters/:chapterId/sections",
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { chapterId } = req.params;
        const sections = await db
          .select()
          .from(textbookSections)
          .where(eq(textbookSections.chapterId, chapterId))
          .orderBy(asc(textbookSections.sectionNumber));
        res.json(sections);
      } catch (error) {
        console.error("Get sections error:", error);
        res.status(500).json({ error: "Failed to fetch sections" });
      }
    }
  );

  app.post(
    "/api/admin/curriculum/chapters/:chapterId/sections",
    requireAdminWrite,
    auditLog("CREATE_SECTION"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { chapterId } = req.params;
        const data = insertTextbookSectionSchema.parse({ ...req.body, chapterId });
        const [section] = await db.insert(textbookSections).values(data).returning();
        res.json(section);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to create section";
        res.status(400).json({ error: message });
      }
    }
  );

  app.put(
    "/api/admin/curriculum/sections/:id",
    requireAdminWrite,
    auditLog("UPDATE_SECTION"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const data = insertTextbookSectionSchema.partial().parse(req.body);
        const [section] = await db
          .update(textbookSections)
          .set(data)
          .where(eq(textbookSections.id, id))
          .returning();
        if (!section) return res.status(404).json({ error: "Section not found" });
        res.json(section);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update section";
        res.status(400).json({ error: message });
      }
    }
  );

  app.delete(
    "/api/admin/curriculum/sections/:id",
    requireAdminWrite,
    auditLog("DELETE_SECTION"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        await db.delete(textbookSections).where(eq(textbookSections.id, id));
        res.json({ message: "Section deleted" });
      } catch (error) {
        console.error("Delete section error:", error);
        res.status(500).json({ error: "Failed to delete section" });
      }
    }
  );

  // ==================== Topic Mappings ====================
  app.get(
    "/api/admin/curriculum/topics-with-mappings",
    requireAdmin,
    async (_req: AdminAuthRequest, res: Response) => {
      try {
        const areas = await db.select().from(contentAreas).orderBy(asc(contentAreas.name));
        const topics = await db.select().from(nursingTopics).orderBy(asc(nursingTopics.name));
        const mappings = await db
          .select({
            id: chapterTopicMappings.id,
            chapterId: chapterTopicMappings.chapterId,
            sectionId: chapterTopicMappings.sectionId,
            nursingTopicId: chapterTopicMappings.nursingTopicId,
            contentAreaId: chapterTopicMappings.contentAreaId,
            subject: chapterTopicMappings.subject,
            notes: chapterTopicMappings.notes,
            chapterTitle: textbookChapters.title,
            chapterNumber: textbookChapters.chapterNumber,
            textbookTitle: textbooks.title,
            sectionTitle: textbookSections.title,
            sectionNumber: textbookSections.sectionNumber,
          })
          .from(chapterTopicMappings)
          .leftJoin(textbookChapters, eq(chapterTopicMappings.chapterId, textbookChapters.id))
          .leftJoin(textbooks, eq(textbookChapters.textbookId, textbooks.id))
          .leftJoin(textbookSections, eq(chapterTopicMappings.sectionId, textbookSections.id));
        res.json({ areas, topics, mappings });
      } catch (error) {
        console.error("Get topics with mappings error:", error);
        res.status(500).json({ error: "Failed to fetch topics with mappings" });
      }
    }
  );

  app.post(
    "/api/admin/curriculum/mappings",
    requireAdminWrite,
    auditLog("CREATE_TOPIC_MAPPING"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const data = insertChapterTopicMappingSchema.parse(req.body);
        const [mapping] = await db.insert(chapterTopicMappings).values(data).returning();
        invalidateTextbookRefCache();
        if (data.chapterId) invalidateChapterCache(data.chapterId);
        res.json(mapping);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to create mapping";
        res.status(400).json({ error: message });
      }
    }
  );

  app.put(
    "/api/admin/curriculum/mappings/:id",
    requireAdminWrite,
    auditLog("UPDATE_TOPIC_MAPPING"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const data = insertChapterTopicMappingSchema.partial().parse(req.body);
        const [mapping] = await db
          .update(chapterTopicMappings)
          .set(data)
          .where(eq(chapterTopicMappings.id, id))
          .returning();
        if (!mapping) return res.status(404).json({ error: "Mapping not found" });
        invalidateTextbookRefCache();
        if (mapping.chapterId) invalidateChapterCache(mapping.chapterId);
        res.json(mapping);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update mapping";
        res.status(400).json({ error: message });
      }
    }
  );

  app.delete(
    "/api/admin/curriculum/mappings/:id",
    requireAdminWrite,
    auditLog("DELETE_TOPIC_MAPPING"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        // Pre-fetch chapterId so we can invalidate the right cache entry after deletion
        const [existing] = await db
          .select({ chapterId: chapterTopicMappings.chapterId })
          .from(chapterTopicMappings)
          .where(eq(chapterTopicMappings.id, id))
          .limit(1);
        await db.delete(chapterTopicMappings).where(eq(chapterTopicMappings.id, id));
        invalidateTextbookRefCache();
        if (existing?.chapterId) invalidateChapterCache(existing.chapterId);
        res.json({ message: "Mapping deleted" });
      } catch (error) {
        console.error("Delete mapping error:", error);
        res.status(500).json({ error: "Failed to delete mapping" });
      }
    }
  );

  // Search chapters + sections across all textbooks (for mapping UI)
  app.get(
    "/api/admin/curriculum/chapters/search",
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const q = typeof req.query.q === "string" ? req.query.q : "";
        const chapters = await db
          .select({
            id: textbookChapters.id,
            chapterNumber: textbookChapters.chapterNumber,
            title: textbookChapters.title,
            subjectTag: textbookChapters.subjectTag,
            nclexCategoryTag: textbookChapters.nclexCategoryTag,
            textbookId: textbookChapters.textbookId,
            textbookTitle: textbooks.title,
            textbookPublisher: textbooks.publisher,
          })
          .from(textbookChapters)
          .leftJoin(textbooks, eq(textbookChapters.textbookId, textbooks.id))
          .orderBy(asc(textbooks.title), asc(textbookChapters.chapterNumber));

        const filtered = q
          ? chapters.filter(
              (ch) =>
                ch.title.toLowerCase().includes(q.toLowerCase()) ||
                (ch.textbookTitle ?? "").toLowerCase().includes(q.toLowerCase()) ||
                (ch.subjectTag ?? "").toLowerCase().includes(q.toLowerCase())
            )
          : chapters;

        res.json(filtered);
      } catch (error) {
        console.error("Search chapters error:", error);
        res.status(500).json({ error: "Failed to search chapters" });
      }
    }
  );

  // Get sections for a chapter (used in mapping dialog)
  app.get(
    "/api/admin/curriculum/chapters/:chapterId/sections/search",
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { chapterId } = req.params;
        const q = typeof req.query.q === "string" ? req.query.q : "";
        const sections = await db
          .select()
          .from(textbookSections)
          .where(eq(textbookSections.chapterId, chapterId))
          .orderBy(asc(textbookSections.sectionNumber));

        const filtered = q
          ? sections.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))
          : sections;

        res.json(filtered);
      } catch (error) {
        console.error("Search sections error:", error);
        res.status(500).json({ error: "Failed to search sections" });
      }
    }
  );

}
// Public curriculum routes (health, subjects, chapters, search, topic detail)
// live exclusively in server/curriculum-routes.ts — do not duplicate here.
