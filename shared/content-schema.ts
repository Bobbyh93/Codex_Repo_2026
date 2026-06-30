import { pgTable, text, integer, timestamp, jsonb, boolean, real, index, primaryKey, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Flexible content storage with metadata and indexing
export const contentBlocks = pgTable("content_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(), // 'text', 'markdown', 'html', 'json'
  source: text("source"), // Original source document/URL
  sourceType: text("source_type"), // 'pdf', 'csv', 'markdown', 'html', 'manual'
  
  // Metadata and classification
  title: text("title"),
  category: text("category"),
  subcategory: text("subcategory"),
  tags: text("tags").array(),
  difficulty: text("difficulty"), // 'beginner', 'intermediate', 'advanced'
  
  // Indexing and search
  searchVector: text("search_vector"), // For full-text search
  embeddings: jsonb("embeddings"), // Vector embeddings for AI
  keywords: text("keywords").array(),
  
  // Performance tracking
  usageCount: integer("usage_count").default(0),
  qualityScore: real("quality_score"),
  lastAccessed: timestamp("last_accessed"),
  
  // Versioning
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
  
  // Relationships
  parentId: uuid("parent_id"), // For hierarchical content
  relatedIds: uuid("related_ids").array(), // Related content blocks
}, (table) => ({
  searchIdx: index("content_search_idx").on(table.searchVector),
  categoryIdx: index("content_category_idx").on(table.category),
  tagsIdx: index("content_tags_idx").on(table.tags),
}));

// Crosswalk mapping between different taxonomies
export const contentCrosswalks = pgTable("content_crosswalks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceSystem: text("source_system").notNull(), // 'ATI', 'NCLEX', 'Kaplan', etc.
  sourceCode: text("source_code").notNull(),
  sourceDescription: text("source_description"),
  
  targetSystem: text("target_system").notNull(), // Your unified system
  targetCode: text("target_code").notNull(),
  targetDescription: text("target_description"),
  
  mappingType: text("mapping_type").notNull(), // '1-to-1', '1-to-many', 'many-to-many'
  confidenceScore: real("confidence_score"), // 0-1 confidence in mapping
  
  rules: jsonb("rules"), // Mapping rules and conditions
  notes: text("notes"),
  
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

// Topic performance analytics for data-driven prioritization
export const topicPerformance = pgTable("topic_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: text("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  category: text("category"),
  
  // Performance metrics
  totalAttempts: integer("total_attempts").default(0),
  incorrectAttempts: integer("incorrect_attempts").default(0),
  missRate: real("miss_rate"), // Calculated: incorrect/total
  
  // Priority scoring
  priorityScore: real("priority_score"), // Based on miss rate and volume
  priorityLevel: text("priority_level"), // 'high', 'medium', 'low'
  
  // Trend analysis
  trendDirection: text("trend_direction"), // 'improving', 'worsening', 'stable'
  weeklyMissRates: jsonb("weekly_miss_rates"), // Historical data
  
  // Resource allocation
  resourceCount: integer("resource_count").default(0),
  contentGaps: text("content_gaps").array(),
  recommendedActions: jsonb("recommended_actions"),
  
  lastCalculated: timestamp("last_calculated").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  priorityIdx: index("topic_priority_idx").on(table.priorityScore),
  missRateIdx: index("topic_miss_rate_idx").on(table.missRate),
}));

// Import jobs for tracking bulk imports
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: text("job_type").notNull(), // 'csv', 'markdown', 'html', 'pdf'
  fileName: text("file_name"),
  
  status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0), // 0-100
  
  // Configuration
  mappingConfig: jsonb("mapping_config"), // Column mappings for CSV
  processingOptions: jsonb("processing_options"),
  
  // Results
  totalRecords: integer("total_records"),
  processedRecords: integer("processed_records"),
  failedRecords: integer("failed_records"),
  errorLog: jsonb("error_log"),
  
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

// Content relationships and hierarchies
export const contentRelationships = pgTable("content_relationships", {
  parentId: uuid("parent_id").notNull(),
  childId: uuid("child_id").notNull(),
  relationshipType: text("relationship_type").notNull(), // 'prerequisite', 'related', 'subtopic'
  strength: real("strength"), // Relationship strength 0-1
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.parentId, table.childId] }),
}));

// Reference sources for content attribution
export const referenceSources = pgTable("reference_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").notNull(),
  
  sourceType: text("source_type"), // 'book', 'journal', 'website', 'video'
  title: text("title"),
  authors: text("authors").array(),
  publicationDate: timestamp("publication_date"),
  url: text("url"),
  isbn: text("isbn"),
  doi: text("doi"),
  
  citation: text("citation"), // Formatted citation
  license: text("license"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const contentBlocksRelations = relations(contentBlocks, ({ many, one }) => ({
  references: many(referenceSources),
  parent: one(contentBlocks, {
    fields: [contentBlocks.parentId],
    references: [contentBlocks.id],
  }),
  children: many(contentBlocks),
}));

export const referenceSourcesRelations = relations(referenceSources, ({ one }) => ({
  content: one(contentBlocks, {
    fields: [referenceSources.contentId],
    references: [contentBlocks.id],
  }),
}));

// Insert schemas
export const insertContentBlockSchema = createInsertSchema(contentBlocks);
export const insertCrosswalksSchema = createInsertSchema(contentCrosswalks);
export const insertTopicPerformanceSchema = createInsertSchema(topicPerformance);
export const insertImportJobSchema = createInsertSchema(importJobs);

// Types
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;
export type ContentCrosswalk = typeof contentCrosswalks.$inferSelect;
export type TopicPerformanceData = typeof topicPerformance.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;