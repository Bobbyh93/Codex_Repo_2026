import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core simplified schema focused on "Topics to Review"

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

// 3. USER PERFORMANCE - Track how users perform on each topic
export const topicPerformance = pgTable("topic_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Can be null for anonymous users initially
  topicId: varchar("topic_id").references(() => reviewTopics.id).notNull(),
  
  // Performance data
  score: decimal("score", { precision: 5, scale: 2 }), // 0-100
  questionsTotal: integer("questions_total"),
  questionsCorrect: integer("questions_correct"),
  
  // Gap analysis
  gapScore: decimal("gap_score", { precision: 5, scale: 2 }), // How much improvement needed
  priority: integer("priority"), // 1-10 priority for study
  
  // Study recommendations
  recommendedStudyTime: integer("recommended_study_time"), // minutes
  isTopGap: boolean("is_top_gap").default(false), // Top 2 gaps for free users
  
  // Source assessment
  assessmentSource: text("assessment_source"), // "ATI", "NCLEX", "Kaplan", etc.
  assessmentDate: timestamp("assessment_date"),
  
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

// 5. USER STUDY PLANS - Personalized study plans
export const studyPlans = pgTable("study_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Can be null for anonymous users
  
  planType: text("plan_type").notNull(), // "free_preview", "full_blueprint", "custom"
  totalTopics: integer("total_topics"),
  totalStudyTime: integer("total_study_time"), // minutes
  
  // Completion tracking
  completedTopics: integer("completed_topics").default(0),
  progressPercent: decimal("progress_percent", { precision: 5, scale: 2 }).default("0"),
  
  // Plan status
  isActive: boolean("is_active").default(true),
  generatedAt: timestamp("generated_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // For time-limited plans
});

// 6. STUDY PLAN ITEMS - Individual items in study plans
export const studyPlanItems = pgTable("study_plan_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studyPlanId: varchar("study_plan_id").references(() => studyPlans.id).notNull(),
  topicId: varchar("topic_id").references(() => reviewTopics.id).notNull(),
  
  orderIndex: integer("order_index").notNull(),
  estimatedTime: integer("estimated_time"), // minutes
  
  // Status tracking
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  timeSpent: integer("time_spent"), // actual minutes spent
  
  // Priority and gap info
  priority: integer("priority"), // 1-10
  gapScore: decimal("gap_score", { precision: 5, scale: 2 }),
  isTopGap: boolean("is_top_gap").default(false),
});

// Relations
export const reviewTopicsRelations = relations(reviewTopics, ({ many }) => ({
  content: many(topicContent),
  performance: many(topicPerformance),
  resources: many(studyResources),
  studyPlanItems: many(studyPlanItems),
}));

export const topicContentRelations = relations(topicContent, ({ one }) => ({
  topic: one(reviewTopics, {
    fields: [topicContent.topicId],
    references: [reviewTopics.id],
  }),
}));

export const topicPerformanceRelations = relations(topicPerformance, ({ one }) => ({
  topic: one(reviewTopics, {
    fields: [topicPerformance.topicId],
    references: [reviewTopics.id],
  }),
}));

export const studyResourcesRelations = relations(studyResources, ({ one }) => ({
  topic: one(reviewTopics, {
    fields: [studyResources.topicId],
    references: [reviewTopics.id],
  }),
}));

export const studyPlansRelations = relations(studyPlans, ({ many }) => ({
  items: many(studyPlanItems),
}));

export const studyPlanItemsRelations = relations(studyPlanItems, ({ one }) => ({
  studyPlan: one(studyPlans, {
    fields: [studyPlanItems.studyPlanId],
    references: [studyPlans.id],
  }),
  topic: one(reviewTopics, {
    fields: [studyPlanItems.topicId],
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

export const insertTopicPerformanceSchema = createInsertSchema(topicPerformance).omit({
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

export const insertStudyPlanSchema = createInsertSchema(studyPlans).omit({
  id: true,
  completedTopics: true,
  progressPercent: true,
  generatedAt: true,
});

export const insertStudyPlanItemSchema = createInsertSchema(studyPlanItems).omit({
  id: true,
  isCompleted: true,
  completedAt: true,
  timeSpent: true,
});

// Types
export type ReviewTopic = typeof reviewTopics.$inferSelect;
export type InsertReviewTopic = z.infer<typeof insertReviewTopicSchema>;
export type TopicContent = typeof topicContent.$inferSelect;
export type InsertTopicContent = z.infer<typeof insertTopicContentSchema>;
export type TopicPerformance = typeof topicPerformance.$inferSelect;
export type InsertTopicPerformance = z.infer<typeof insertTopicPerformanceSchema>;
export type StudyResource = typeof studyResources.$inferSelect;
export type InsertStudyResource = z.infer<typeof insertStudyResourceSchema>;
export type StudyPlan = typeof studyPlans.$inferSelect;
export type InsertStudyPlan = z.infer<typeof insertStudyPlanSchema>;
export type StudyPlanItem = typeof studyPlanItems.$inferSelect;
export type InsertStudyPlanItem = z.infer<typeof insertStudyPlanItemSchema>;

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