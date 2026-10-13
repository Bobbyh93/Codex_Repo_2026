import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core simplified schema focused on "Topics to Review"
//
// Every table here is owned by this file alone. That is a requirement, not a
// coincidence: drizzle.config.ts lists this file, and drizzle-kit rejects a
// schema set that defines the same table name twice.
//
// Three definitions were removed to get here, all of them second declarations
// of tables that shared/schema.ts already owns and that exist in the database
// with schema.ts's columns:
//
//   topic_performance  - schema.ts keys it on report_id; this file's version
//                        invented a user_id column the real table lacks.
//   study_plans        - imported nowhere.
//   study_plan_items   - imported nowhere.
//
// Anything needing those tables must import them from @shared/schema.

// 1. REVIEW TOPICS - The foundation of everything
export const reviewTopics = pgTable("review_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // e.g., "Medication Administration", "Infection Control"
  description: text("description"),
  
  // NCLEX Classification (simplified to core categories)
  nclexCategory: text("nclex_category").notNull(), // Safe Care, Physiological Integrity, Psychosocial Integrity, Health Promotion
  nclexSubcategory: text("nclex_subcategory"), // Management of Care, Pharmacology, etc.
  
  // Clinical Context
  nursingSpecialty: text("nursing_specialty"), // Medical-Surgical, Pediatrics, etc.
  bodySystem: text("body_system"), // Cardiovascular, Respiratory, etc.
  
  // Learning metadata
  difficulty: text("difficulty"), // Basic, Intermediate, Advanced
  estimatedStudyTime: integer("estimated_study_time"), // minutes
  keywords: jsonb("keywords").$type<string[]>().default([]),
  
  // Tracking
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 2. CONTENT BLOCKS - Map content directly to review topics
export const topicContent = pgTable("topic_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => reviewTopics.id).notNull(),
  
  // Content details
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(), // text, markdown, video, quiz
  source: text("source"), // PDF name, URL, etc.
  
  // Metadata
  difficulty: text("difficulty"),
  tags: jsonb("tags").$type<string[]>().default([]),
  
  // Quality tracking
  isReviewed: boolean("is_reviewed").default(false),
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 4. STUDY RESOURCES - Resources mapped to topics
export const studyResources = pgTable("study_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => reviewTopics.id).notNull(),
  
  title: text("title").notNull(),
  type: text("type").notNull(), // video, article, practice_questions, textbook
  url: text("url"),
  description: text("description"),
  
  // Content metadata
  duration: integer("duration"), // minutes for videos
  difficulty: text("difficulty"),
  isFree: boolean("is_free").default(true),
  isPremium: boolean("is_premium").default(false),
  
  // Quality metrics
  rating: decimal("rating", { precision: 3, scale: 2 }), // 1-5 stars
  usageCount: integer("usage_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const reviewTopicsRelations = relations(reviewTopics, ({ many }) => ({
  content: many(topicContent),
  resources: many(studyResources),
}));

export const topicContentRelations = relations(topicContent, ({ one }) => ({
  topic: one(reviewTopics, {
    fields: [topicContent.topicId],
    references: [reviewTopics.id],
  }),
}));

export const studyResourcesRelations = relations(studyResources, ({ one }) => ({
  topic: one(reviewTopics, {
    fields: [studyResources.topicId],
    references: [reviewTopics.id],
  }),
}));

// Insert schemas
export const insertReviewTopicSchema = createInsertSchema(reviewTopics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTopicContentSchema = createInsertSchema(topicContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudyResourceSchema = createInsertSchema(studyResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

// Types
export type ReviewTopic = typeof reviewTopics.$inferSelect;
export type InsertReviewTopic = z.infer<typeof insertReviewTopicSchema>;
export type TopicContent = typeof topicContent.$inferSelect;
export type InsertTopicContent = z.infer<typeof insertTopicContentSchema>;
export type StudyResource = typeof studyResources.$inferSelect;
export type InsertStudyResource = z.infer<typeof insertStudyResourceSchema>;

// Core NCLEX categories for validation
export const NCLEX_CATEGORIES = [
  "Safe and Effective Care Environment",
  "Physiological Integrity", 
  "Psychosocial Integrity",
  "Health Promotion and Maintenance"
] as const;

export const NCLEX_SUBCATEGORIES = [
  "Management of Care",
  "Safety and Infection Control", 
  "Basic Care and Comfort",
  "Pharmacological and Parenteral Therapies",
  "Reduction of Risk Potential",
  "Physiological Adaptation"
] as const;

export const NURSING_SPECIALTIES = [
  "Medical-Surgical",
  "Critical Care", 
  "Pediatrics",
  "Obstetrics",
  "Mental Health",
  "Community Health",
  "Emergency",
  "Geriatrics"
] as const;

export const BODY_SYSTEMS = [
  "Cardiovascular",
  "Respiratory", 
  "Neurological",
  "Musculoskeletal",
  "Gastrointestinal",
  "Genitourinary", 
  "Endocrine",
  "Integumentary",
  "Immune/Hematologic"
] as const;