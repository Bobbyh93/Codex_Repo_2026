import { pgTable, text, uuid, timestamp, jsonb, boolean, real, integer, index, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NCLEX to Topic Crosswalk
export const nclexTopicCrosswalk = pgTable("nclex_topic_crosswalk", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // NCLEX side
  nclexCategory: text("nclex_category").notNull(), // Safe Care, Physiological Integrity, etc.
  nclexSubcategory: text("nclex_subcategory"), // Management of Care, Pharmacology, etc.
  nclexWeight: real("nclex_weight"), // Percentage weight in exam
  
  // Topic side
  topicId: uuid("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  
  // Mapping metadata
  mappingStrength: real("mapping_strength").notNull().default(1.0), // 0-1 strength of relationship
  mappingType: text("mapping_type").notNull().default("primary"), // primary, secondary, tertiary
  
  // Quality and tracking
  isVerified: boolean("is_verified").default(false),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nclexIdx: index("nclex_category_idx").on(table.nclexCategory),
  topicIdx: index("nclex_topic_idx").on(table.topicId),
}));

// Topic to Learning Objectives Crosswalk
export const topicObjectivesCrosswalk = pgTable("topic_objectives_crosswalk", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Topic side
  topicId: uuid("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  
  // Learning objective side
  objectiveId: uuid("objective_id").notNull(),
  objectiveText: text("objective_text").notNull(),
  bloomsLevel: text("blooms_level"), // Remember, Understand, Apply, Analyze, Evaluate, Create
  
  // Relationship metadata
  isCore: boolean("is_core").default(false), // Core vs supplementary objective
  orderIndex: integer("order_index"), // Display order
  estimatedTime: integer("estimated_time"), // Minutes to master
  
  // Assessment alignment
  assessmentAlignment: jsonb("assessment_alignment").$type<{
    ati?: boolean;
    nclex?: boolean;
    kaplan?: boolean;
    hesi?: boolean;
  }>().default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  topicIdx: index("objective_topic_idx").on(table.topicId),
  objectiveIdx: index("objective_id_idx").on(table.objectiveId),
}));

// Learning Objectives to Resources Crosswalk
export const objectiveResourcesCrosswalk = pgTable("objective_resources_crosswalk", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Objective side
  objectiveId: uuid("objective_id").notNull(),
  objectiveText: text("objective_text"),
  
  // Resource side
  resourceId: uuid("resource_id").notNull(),
  resourceTitle: text("resource_title").notNull(),
  resourceType: text("resource_type").notNull(), // video, article, quiz, simulation, textbook
  
  // Mapping metadata
  relevanceScore: real("relevance_score").notNull().default(1.0), // 0-1 how relevant
  coverageType: text("coverage_type").notNull(), // complete, partial, supplementary
  
  // Resource specifics
  startPage: integer("start_page"), // For textbooks
  endPage: integer("end_page"),
  startTime: integer("start_time"), // For videos (seconds)
  endTime: integer("end_time"),
  
  // Quality metrics
  effectivenessScore: real("effectiveness_score"), // Based on student outcomes
  usageCount: integer("usage_count").default(0),
  avgCompletionRate: real("avg_completion_rate"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  objectiveIdx: index("resource_objective_idx").on(table.objectiveId),
  resourceIdx: index("resource_id_idx").on(table.resourceId),
  relevanceIdx: index("resource_relevance_idx").on(table.relevanceScore),
}));

// ATI to NCLEX Category Crosswalk
export const atiNclexCrosswalk = pgTable("ati_nclex_crosswalk", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // ATI side
  atiCategory: text("ati_category").notNull(),
  atiSubcategory: text("ati_subcategory"),
  atiTopicCode: text("ati_topic_code"),
  
  // NCLEX side
  nclexCategory: text("nclex_category").notNull(),
  nclexSubcategory: text("nclex_subcategory"),
  
  // Mapping confidence
  mappingConfidence: real("mapping_confidence").notNull().default(1.0), // 0-1
  mappingSource: text("mapping_source"), // manual, ai, official
  
  // Validation
  isOfficial: boolean("is_official").default(false), // From official mapping guide
  lastValidated: timestamp("last_validated"),
  validatedBy: text("validated_by"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  atiIdx: index("ati_category_idx").on(table.atiCategory),
  nclexIdx: index("ati_nclex_idx").on(table.nclexCategory),
}));

// Performance to Learning Path Crosswalk
export const performancePathCrosswalk = pgTable("performance_path_crosswalk", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Performance criteria
  performanceLevel: text("performance_level").notNull(), // below_passing, near_passing, proficient, advanced
  scoreRange: jsonb("score_range").$type<{min: number; max: number}>().notNull(),
  gapType: text("gap_type"), // knowledge, application, critical_thinking
  
  // Learning path
  pathTemplateId: uuid("path_template_id").notNull(),
  pathName: text("path_name").notNull(),
  pathType: text("path_type").notNull(), // remedial, standard, accelerated, mastery
  
  // Path characteristics
  estimatedDuration: integer("estimated_duration"), // Total hours
  intensityLevel: text("intensity_level"), // light, moderate, intensive
  focusAreas: jsonb("focus_areas").$type<string[]>().default([]),
  
  // Sequencing rules
  prerequisiteScore: real("prerequisite_score"), // Min score to start
  sequenceRules: jsonb("sequence_rules").$type<{
    mustCompleteFirst?: string[];
    canSkipIf?: Record<string, number>;
    adaptiveBranching?: boolean;
  }>().default({}),
  
  // Success metrics
  expectedImprovement: real("expected_improvement"), // Percentage points
  successRate: real("success_rate"), // Historical success rate
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  levelIdx: index("performance_level_idx").on(table.performanceLevel),
  pathIdx: index("path_template_idx").on(table.pathTemplateId),
}));

// Study Path Templates
export const studyPathTemplates = pgTable("study_path_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  name: text("name").notNull(),
  description: text("description"),
  pathType: text("path_type").notNull(), // remedial, standard, accelerated, mastery
  
  // Target audience
  targetAudience: text("target_audience"), // new_grad, nclex_prep, remedial, continuing_ed
  experienceLevel: text("experience_level"), // beginner, intermediate, advanced
  
  // Content structure
  totalModules: integer("total_modules"),
  totalHours: integer("total_hours"),
  
  // Module sequence
  moduleSequence: jsonb("module_sequence").$type<Array<{
    moduleId: string;
    moduleName: string;
    topics: string[];
    objectives: string[];
    resources: string[];
    duration: number;
    order: number;
  }>>().default([]),
  
  // Customization options
  isCustomizable: boolean("is_customizable").default(true),
  customizationRules: jsonb("customization_rules"),
  
  // Performance tracking
  completionCriteria: jsonb("completion_criteria"),
  assessmentPoints: jsonb("assessment_points").$type<number[]>().default([]),
  
  // Metadata
  version: integer("version").default(1),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content Coverage Matrix
export const contentCoverageMatrix = pgTable("content_coverage_matrix", {
  topicId: uuid("topic_id").notNull(),
  resourceId: uuid("resource_id").notNull(),
  
  // Coverage metrics
  coveragePercent: real("coverage_percent").notNull(), // 0-100
  coverageDepth: text("coverage_depth").notNull(), // surface, moderate, deep
  
  // Quality indicators
  alignmentScore: real("alignment_score"), // 0-1
  completenessScore: real("completeness_score"), // 0-1
  clarityScore: real("clarity_score"), // 0-1
  
  // Usage statistics
  timesAccessed: integer("times_accessed").default(0),
  avgTimeSpent: integer("avg_time_spent"), // seconds
  completionRate: real("completion_rate"),
  
  // Effectiveness
  preTestAvg: real("pre_test_avg"),
  postTestAvg: real("post_test_avg"),
  improvementRate: real("improvement_rate"),
  
  lastAnalyzed: timestamp("last_analyzed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.topicId, table.resourceId] }),
  topicIdx: index("coverage_topic_idx").on(table.topicId),
  resourceIdx: index("coverage_resource_idx").on(table.resourceId),
  coverageIdx: index("coverage_percent_idx").on(table.coveragePercent),
}));

// Learning Objectives Master Table
export const learningObjectives = pgTable("learning_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Objective details
  objectiveText: text("objective_text").notNull(),
  abbreviation: text("abbreviation"),
  
  // Taxonomy
  bloomsLevel: text("blooms_level").notNull(), // Remember, Understand, Apply, Analyze, Evaluate, Create
  cognitiveLevel: text("cognitive_level"), // knowledge, comprehension, application, analysis
  
  // Clinical relevance
  clinicalContext: text("clinical_context"),
  practiceArea: text("practice_area"),
  
  // Measurement
  measurable: boolean("measurable").default(true),
  assessmentMethod: text("assessment_method"), // mcq, simulation, case_study, demonstration
  
  // Metadata
  isActive: boolean("is_active").default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Crosswalk Import History
export const crosswalkImportHistory = pgTable("crosswalk_import_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  importType: text("import_type").notNull(), // nclex_topic, topic_objective, etc.
  fileName: text("file_name"),
  
  // Import statistics
  totalRecords: integer("total_records"),
  successfulRecords: integer("successful_records"),
  failedRecords: integer("failed_records"),
  skippedRecords: integer("skipped_records"),
  
  // Validation results
  validationErrors: jsonb("validation_errors").$type<Array<{
    row: number;
    field: string;
    error: string;
  }>>().default([]),
  
  // Import configuration
  mappingConfig: jsonb("mapping_config"),
  importOptions: jsonb("import_options"),
  
  // Status and timing
  status: text("status").notNull(), // pending, processing, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  importedBy: text("imported_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertNclexTopicCrosswalkSchema = createInsertSchema(nclexTopicCrosswalk).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTopicObjectivesCrosswalkSchema = createInsertSchema(topicObjectivesCrosswalk).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertObjectiveResourcesCrosswalkSchema = createInsertSchema(objectiveResourcesCrosswalk).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export const insertAtiNclexCrosswalkSchema = createInsertSchema(atiNclexCrosswalk).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformancePathCrosswalkSchema = createInsertSchema(performancePathCrosswalk).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudyPathTemplateSchema = createInsertSchema(studyPathTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});

export const insertLearningObjectiveSchema = createInsertSchema(learningObjectives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type NclexTopicCrosswalk = typeof nclexTopicCrosswalk.$inferSelect;
export type InsertNclexTopicCrosswalk = z.infer<typeof insertNclexTopicCrosswalkSchema>;
export type TopicObjectivesCrosswalk = typeof topicObjectivesCrosswalk.$inferSelect;
export type InsertTopicObjectivesCrosswalk = z.infer<typeof insertTopicObjectivesCrosswalkSchema>;
export type ObjectiveResourcesCrosswalk = typeof objectiveResourcesCrosswalk.$inferSelect;
export type InsertObjectiveResourcesCrosswalk = z.infer<typeof insertObjectiveResourcesCrosswalkSchema>;
export type AtiNclexCrosswalk = typeof atiNclexCrosswalk.$inferSelect;
export type InsertAtiNclexCrosswalk = z.infer<typeof insertAtiNclexCrosswalkSchema>;
export type PerformancePathCrosswalk = typeof performancePathCrosswalk.$inferSelect;
export type InsertPerformancePathCrosswalk = z.infer<typeof insertPerformancePathCrosswalkSchema>;
export type StudyPathTemplate = typeof studyPathTemplates.$inferSelect;
export type InsertStudyPathTemplate = z.infer<typeof insertStudyPathTemplateSchema>;
export type ContentCoverageMatrix = typeof contentCoverageMatrix.$inferSelect;
export type LearningObjective = typeof learningObjectives.$inferSelect;
export type InsertLearningObjective = z.infer<typeof insertLearningObjectiveSchema>;
export type CrosswalkImportHistory = typeof crosswalkImportHistory.$inferSelect;