import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Master Topics to Review table - the foundation of everything
export const topicsToReview = pgTable("topics_to_review", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Core identity
  name: text("name").notNull().unique(), // e.g., "Medication Administration", "Infection Control"
  description: text("description"),
  
  // Subject → System → Topic hierarchy
  subject: text("subject").notNull(), // Fundamentals, Med-Surg, Maternal/Newborn, Pediatrics, Mental Health, Pharmacology, Community Health, Leadership
  system: text("system"), // Cardiovascular, Respiratory, Neurological, GI, Renal, Endocrine, Musculoskeletal, Immune
  disorder: text("disorder"), // Specific disorder if applicable: "Heart Failure", "COPD", "Diabetes"
  
  // Topic characteristics
  difficulty: text("difficulty"), // Basic, Intermediate, Advanced
  estimatedStudyTime: integer("estimated_study_time"), // minutes
  clinicalRelevance: text("clinical_relevance"), // Low, Medium, High, Critical
  
  // Content mapping
  keywords: jsonb("keywords").$type<string[]>().default([]),
  learningObjectives: jsonb("learning_objectives").$type<string[]>().default([]),
  criticalPoints: jsonb("critical_points").$type<string[]>().default([]),
  
  // Frequency tracking
  occurrenceCount: integer("occurrence_count").default(0), // Times appeared across all assessments
  averageGapScore: decimal("average_gap_score", { precision: 5, scale: 2 }), // Average gap across all students
  missedByPercent: decimal("missed_by_percent", { precision: 5, scale: 2 }), // % of students who struggle with this
  
  // Metadata
  isActive: boolean("is_active").default(true),
  isCore: boolean("is_core").default(false), // Is this a core/master topic
  sourceAssessments: jsonb("source_assessments").$type<string[]>().default([]), // ATI, NCLEX, Kaplan, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subject definitions for reference
export const nursingSubjects = pgTable("nursing_subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // "FUND", "MEDSURG", "MATERNAL", etc.
  name: text("name").notNull(), // "Fundamentals", "Medical-Surgical", etc.
  description: text("description"),
  orderIndex: integer("order_index"), // Display order
  color: text("color"), // For UI display
  icon: text("icon"), // For UI display
});

// Body systems for reference
export const bodySystems = pgTable("body_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // "CARDIO", "RESP", etc.
  name: text("name").notNull(), // "Cardiovascular", "Respiratory", etc.
  description: text("description"),
  orderIndex: integer("order_index"), // Display order
  color: text("color"), // For UI display
  commonDisorders: jsonb("common_disorders").$type<string[]>().default([]),
});

// Topic performance tracking (per user/assessment)
export const topicPerformance = pgTable("topic_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  topicId: varchar("topic_id").references(() => topicsToReview.id).notNull(),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Performance metrics
  score: decimal("score", { precision: 5, scale: 2 }), // 0-100
  gapScore: decimal("gap_score", { precision: 5, scale: 2 }), // 100 - score
  questionsTotal: integer("questions_total"),
  questionsCorrect: integer("questions_correct"),
  
  // Analysis
  priority: integer("priority"), // 1 (highest) to 5 (lowest)
  recommendedStudyTime: integer("recommended_study_time"), // minutes
  isHighPriority: boolean("is_high_priority").default(false), // Top priority flag
  
  // Comparison
  performanceVsNational: decimal("performance_vs_national", { precision: 5, scale: 2 }),
  performanceVsProgram: decimal("performance_vs_program", { precision: 5, scale: 2 }),
  
  // Timestamps
  assessmentDate: timestamp("assessment_date").defaultNow(),
  lastReviewed: timestamp("last_reviewed"),
});

// Topic relationships (for related topics)
export const topicRelationships = pgTable("topic_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryTopicId: varchar("primary_topic_id").references(() => topicsToReview.id).notNull(),
  relatedTopicId: varchar("related_topic_id").references(() => topicsToReview.id).notNull(),
  relationshipType: text("relationship_type").notNull(), // "prerequisite", "related", "inverse", "builds_on"
  strength: decimal("strength", { precision: 3, scale: 2 }), // 0-1 relationship strength
  description: text("description"),
});

// Content blocks linked to topics
export const topicContent = pgTable("topic_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => topicsToReview.id).notNull(),
  
  // Content
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(), // "explanation", "example", "practice", "reference"
  
  // Source tracking
  source: text("source"), // Textbook, ATI, etc.
  sourceType: text("source_type"), // "textbook", "assessment", "lecture"
  chapterReference: text("chapter_reference"), // "Ch 12.3"
  pageReference: text("page_reference"), // "pp 234-237"
  
  // Quality
  isReviewed: boolean("is_reviewed").default(false),
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning resources linked to topics
export const topicResources = pgTable("topic_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => topicsToReview.id).notNull(),
  
  title: text("title").notNull(),
  type: text("type").notNull(), // "video", "article", "quiz", "simulation"
  url: text("url"),
  description: text("description"),
  
  // Metadata
  duration: integer("duration"), // minutes
  difficulty: text("difficulty"),
  isFree: boolean("is_free").default(true),
  
  // Tracking
  rating: decimal("rating", { precision: 3, scale: 2 }), // 1-5 stars
  usageCount: integer("usage_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Assessment reports (simplified)
export const assessmentReports = pgTable("assessment_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User info (optional for student-facing)
  userId: varchar("user_id").references(() => users.id),
  studentName: text("student_name"), // Only for admin tracking, not shown to students
  studentEmail: text("student_email"), // Only for admin tracking
  
  // Report details
  fileName: text("file_name").notNull(),
  assessmentType: text("assessment_type"), // "ATI", "NCLEX", "Kaplan"
  uploadDate: timestamp("upload_date").defaultNow(),
  
  // Content
  extractedText: text("extracted_text"),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }),
  nationalMean: decimal("national_mean", { precision: 5, scale: 2 }),
  programMean: decimal("program_mean", { precision: 5, scale: 2 }),
  
  // Processing
  processingStatus: text("processing_status").default("pending"), // "pending", "processing", "completed", "failed"
  
  // Analysis flags
  isGroupAssessment: boolean("is_group_assessment").default(false),
  instructorNotes: text("instructor_notes"),
});

// Study plans
export const studyPlans = pgTable("study_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  userId: varchar("user_id").references(() => users.id),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  
  // Plan details
  planType: text("plan_type").notNull(), // "basic", "comprehensive", "custom"
  totalTopics: integer("total_topics"),
  totalStudyTime: integer("total_study_time"), // minutes
  
  // Progress
  completedTopics: integer("completed_topics").default(0),
  progressPercent: decimal("progress_percent", { precision: 5, scale: 2 }).default(sql`0`),
  
  // Metadata
  isActive: boolean("is_active").default(true),
  generatedAt: timestamp("generated_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Study plan items
export const studyPlanItems = pgTable("study_plan_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  studyPlanId: varchar("study_plan_id").references(() => studyPlans.id).notNull(),
  topicId: varchar("topic_id").references(() => topicsToReview.id).notNull(),
  
  // Order and priority
  orderIndex: integer("order_index").notNull(),
  priority: integer("priority"), // 1-5
  isHighPriority: boolean("is_high_priority").default(false),
  
  // Time allocation
  estimatedTime: integer("estimated_time"), // minutes
  actualTimeSpent: integer("actual_time_spent"), // minutes
  
  // Completion tracking
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // Performance
  gapScore: decimal("gap_score", { precision: 5, scale: 2 }),
});

// Users table (simplified)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").default("student"), // "student", "instructor", "admin"
  createdAt: timestamp("created_at").defaultNow(),
});

// Group analytics for admin comparisons
export const groupAnalytics = pgTable("group_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Topic reference
  topicId: varchar("topic_id").references(() => topicsToReview.id).notNull(),
  
  // Group identification
  groupType: text("group_type").notNull(), // "national", "program", "cohort", "custom"
  groupIdentifier: text("group_identifier"), // Specific program or cohort ID
  
  // Aggregate metrics
  sampleSize: integer("sample_size"),
  meanScore: decimal("mean_score", { precision: 5, scale: 2 }),
  medianScore: decimal("median_score", { precision: 5, scale: 2 }),
  standardDeviation: decimal("standard_deviation", { precision: 5, scale: 2 }),
  
  // Distribution
  percentileScores: jsonb("percentile_scores").$type<{[key: string]: number}>(), // {"25": 65, "50": 75, "75": 85}
  
  // Time-based analysis
  averageStudyTime: integer("average_study_time"), // minutes
  improvementRate: decimal("improvement_rate", { precision: 5, scale: 2 }), // % improvement after studying
  
  // Date range
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Relations
export const topicsToReviewRelations = relations(topicsToReview, ({ many }) => ({
  performance: many(topicPerformance),
  content: many(topicContent),
  resources: many(topicResources),
  studyPlanItems: many(studyPlanItems),
  groupAnalytics: many(groupAnalytics),
}));

export const topicPerformanceRelations = relations(topicPerformance, ({ one }) => ({
  topic: one(topicsToReview, {
    fields: [topicPerformance.topicId],
    references: [topicsToReview.id],
  }),
  report: one(assessmentReports, {
    fields: [topicPerformance.reportId],
    references: [assessmentReports.id],
  }),
  user: one(users, {
    fields: [topicPerformance.userId],
    references: [users.id],
  }),
}));

export const assessmentReportsRelations = relations(assessmentReports, ({ one, many }) => ({
  user: one(users, {
    fields: [assessmentReports.userId],
    references: [users.id],
  }),
  topicPerformance: many(topicPerformance),
  studyPlans: many(studyPlans),
}));

export const studyPlansRelations = relations(studyPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [studyPlans.userId],
    references: [users.id],
  }),
  report: one(assessmentReports, {
    fields: [studyPlans.reportId],
    references: [assessmentReports.id],
  }),
  items: many(studyPlanItems),
}));

export const studyPlanItemsRelations = relations(studyPlanItems, ({ one }) => ({
  studyPlan: one(studyPlans, {
    fields: [studyPlanItems.studyPlanId],
    references: [studyPlans.id],
  }),
  topic: one(topicsToReview, {
    fields: [studyPlanItems.topicId],
    references: [topicsToReview.id],
  }),
}));

// Insert schemas
export const insertTopicToReviewSchema = createInsertSchema(topicsToReview).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  occurrenceCount: true,
  averageGapScore: true,
  missedByPercent: true,
});

export const insertTopicPerformanceSchema = createInsertSchema(topicPerformance).omit({
  id: true,
  assessmentDate: true,
});

export const insertAssessmentReportSchema = createInsertSchema(assessmentReports).omit({
  id: true,
  uploadDate: true,
});

export const insertStudyPlanSchema = createInsertSchema(studyPlans).omit({
  id: true,
  generatedAt: true,
  completedTopics: true,
  progressPercent: true,
});

// Export types
export type TopicToReview = typeof topicsToReview.$inferSelect;
export type InsertTopicToReview = z.infer<typeof insertTopicToReviewSchema>;
export type TopicPerformance = typeof topicPerformance.$inferSelect;
export type InsertTopicPerformance = z.infer<typeof insertTopicPerformanceSchema>;
export type AssessmentReport = typeof assessmentReports.$inferSelect;
export type InsertAssessmentReport = z.infer<typeof insertAssessmentReportSchema>;
export type StudyPlan = typeof studyPlans.$inferSelect;
export type InsertStudyPlan = z.infer<typeof insertStudyPlanSchema>;
export type StudyPlanItem = typeof studyPlanItems.$inferSelect;
export type TopicContent = typeof topicContent.$inferSelect;
export type TopicResource = typeof topicResources.$inferSelect;
export type User = typeof users.$inferSelect;
export type NursingSubject = typeof nursingSubjects.$inferSelect;
export type BodySystem = typeof bodySystems.$inferSelect;
export type GroupAnalytics = typeof groupAnalytics.$inferSelect;