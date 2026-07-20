import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, boolean, customType } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom Drizzle type for pgvector's native vector(dimensions) column
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() { return `vector(${dimensions})`; },
    toDriver(value: number[]): string { return `[${value.join(',')}]`; },
    fromDriver(value: string): number[] {
      return value.replace(/^\[|\]$/g, '').split(',').map(Number);
    },
  })(name);
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default("student"), // 'student', 'instructor', 'admin'
  school: text("school"),
  graduationDate: timestamp("graduation_date"),
  isEmailVerified: boolean("is_email_verified").default(false),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email verification codes table
export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Verification tokens for magic links
export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Nullable for new users
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  type: text("type").notNull().default("magic-link"), // 'magic-link' or 'email-verify'
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rate limiting entries for persistent rate limiting
export const rateLimitEntries = pgTable("rate_limit_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull(),
  requestCount: integer("request_count").notNull().default(1),
  windowStart: timestamp("window_start").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin users table
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  email: text("email").notNull().unique(),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  addedBy: text("added_by"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentAreas = pgTable("content_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  nclexCategory: text("nclex_category").notNull(),
});

export const nursingTopics = pgTable("nursing_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  contentAreaId: varchar("content_area_id").references(() => contentAreas.id),
  keywords: jsonb("keywords").$type<string[]>().default([]),
  learningObjectives: jsonb("learning_objectives").$type<string[]>().default([]),
  // Enhanced fields for Subject → System → Topic organization
  subject: text("subject"), // Primary subject: "Medical-Surgical", "Pediatrics", "Mental Health", etc.
  system: text("system"), // Body system: "Cardiovascular", "Respiratory", "Neurological", etc.
  // Legacy fields kept for compatibility
  specialty: text("specialty"), // Deprecated - use 'subject' instead
  systemCategory: text("system_category"), // Deprecated - use 'system' instead
  diagnoses: jsonb("diagnoses").$type<string[]>().default([]),
  clinicalConcepts: jsonb("clinical_concepts").$type<string[]>().default([]),
  // Tracking fields
  frequency: integer("frequency").default(1), // Times this topic appeared in assessments
  lastSeen: timestamp("last_seen").defaultNow(),
});

// New table for more specific subtopics
export const nursingSubtopics = pgTable("nursing_subtopics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  name: text("name").notNull(),
  description: text("description"),
  specificSkills: jsonb("specific_skills").$type<string[]>().default([]),
  criticalPoints: jsonb("critical_points").$type<string[]>().default([]),
});

// New table for textbook chapter mappings
export const textbookMappings = pgTable("textbook_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtopicId: varchar("subtopic_id").references(() => nursingSubtopics.id),
  textbookName: text("textbook_name").notNull(),
  chapterNumber: integer("chapter_number"),
  chapterTitle: text("chapter_title"),
  sectionNumber: text("section_number"), // e.g., "12.3"
  sectionTitle: text("section_title"),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
});

export const learningResources = pgTable("learning_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'textbook', 'video', 'quiz', 'article'
  url: text("url"),
  chapterNumber: integer("chapter_number"),
  pageNumbers: text("page_numbers"),
  duration: integer("duration"), // in minutes
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  subtopicId: varchar("subtopic_id").references(() => nursingSubtopics.id), // Added reference to subtopic
});

// Track topics that need resources but don't have any
export const topicsNeedingResources = pgTable("topics_needing_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id).notNull(),
  topicName: text("topic_name").notNull(),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  requestCount: integer("request_count").default(1), // Track how many times requested
  priority: integer("priority").default(0), // Higher number = higher priority  
  firstRequested: timestamp("first_requested").defaultNow(),
  lastRequested: timestamp("last_requested").defaultNow(),
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
});

// Resource mappings for admin-managed topic-resource associations
export const resourceMappings = pgTable("resource_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id).notNull(),
  resourceId: varchar("resource_id").references(() => learningResources.id).notNull(),
  mappedBy: varchar("mapped_by").references(() => users.id), // Admin who created the mapping
  mappedAt: timestamp("mapped_at").defaultNow(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // AI confidence score (0-1)
  isAiSuggested: boolean("is_ai_suggested").default(false),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<{
    source?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    importBatch?: string;
  }>().default({}),
});

export const assessmentReports = pgTable("assessment_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fileName: text("file_name").notNull(),
  uploadDate: timestamp("upload_date").defaultNow(),
  extractedText: text("extracted_text"),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }),
  processingStatus: text("processing_status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  // Student details - stored backend only, not shown on student-facing pages
  studentName: text("student_name"),
  school: text("school"),
  testDate: text("test_date"),
  assessmentName: text("assessment_name"),
});

export const topicPerformance = pgTable("topic_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  score: decimal("score", { precision: 5, scale: 2 }),
  frequency: integer("frequency").default(1),
  gapScore: decimal("gap_score", { precision: 5, scale: 2 }),
  priority: integer("priority"),
  recommendedStudyTime: integer("recommended_study_time"), // in minutes
});

export const contentAreaPerformance = pgTable("content_area_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  contentAreaId: varchar("content_area_id").references(() => contentAreas.id),
  score: decimal("score", { precision: 5, scale: 2 }),
  totalQuestions: integer("total_questions"),
  correctAnswers: integer("correct_answers"),
});

export const studyPlans = pgTable("study_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  title: text("title").notNull(),
  description: text("description"),
  totalDuration: integer("total_duration"), // in minutes
  targetDate: timestamp("target_date"),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).default("0"),
  generatedAt: timestamp("generated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
});

export const studyPlanItems = pgTable("study_plan_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studyPlanId: varchar("study_plan_id").references(() => studyPlans.id),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  resourceId: varchar("resource_id").references(() => learningResources.id),
  order: integer("order").notNull(),
  estimatedTime: integer("estimated_time"), // in minutes
  actualDuration: integer("actual_duration"), // in minutes
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// New table for peer performance comparison
export const peerPerformance = pgTable("peer_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  contentAreaId: varchar("content_area_id").references(() => contentAreas.id),
  nationalMean: decimal("national_mean", { precision: 5, scale: 2 }),
  programMean: decimal("program_mean", { precision: 5, scale: 2 }),
  percentileMissed: decimal("percentile_missed", { precision: 5, scale: 2 }), // e.g., 80% of students miss this
  specialty: text("specialty"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New table for inverse topic relationships
export const topicRelationships = pgTable("topic_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryTopicId: varchar("primary_topic_id").references(() => nursingTopics.id),
  relatedTopicId: varchar("related_topic_id").references(() => nursingTopics.id),
  relationshipType: text("relationship_type").notNull(), // 'inverse', 'complementary', 'prerequisite'
  strength: decimal("strength", { precision: 3, scale: 2 }), // 0-1 strength of relationship
  description: text("description"),
});

// Table for tracking topic frequency across all assessments
export const topicFrequencyTracking = pgTable("topic_frequency_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicName: text("topic_name").notNull(), // Exact topic name from assessment
  normalizedName: text("normalized_name"), // Cleaned/standardized version
  subject: text("subject"),
  system: text("system"),
  occurrenceCount: integer("occurrence_count").default(1),
  lastReportId: varchar("last_report_id").references(() => assessmentReports.id),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// User study sessions for tracking actual study time
export const studySessions = pgTable("study_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  studyPlanItemId: varchar("study_plan_item_id").references(() => studyPlanItems.id),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in minutes
  focusScore: decimal("focus_score", { precision: 3, scale: 2 }), // 0-1 for engagement tracking
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Practice questions for NCLEX preparation
export const practiceQuestions = pgTable("practice_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  contentAreaId: varchar("content_area_id").references(() => contentAreas.id),
  question: text("question").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctAnswer: text("correct_answer").notNull(), // 'A', 'B', 'C', or 'D'
  explanation: text("explanation").notNull(),
  difficulty: text("difficulty"), // 'easy', 'medium', 'hard'
  cognitiveLevel: text("cognitive_level"), // 'remember', 'understand', 'apply', 'analyze'
  nclexCategory: text("nclex_category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User answers to practice questions
export const userAnswers = pgTable("user_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  questionId: varchar("question_id").references(() => practiceQuestions.id).notNull(),
  selectedAnswer: text("selected_answer").notNull(), // 'A', 'B', 'C', or 'D'
  isCorrect: boolean("is_correct").notNull(),
  timeSpent: integer("time_spent"), // in seconds
  confidence: integer("confidence"), // 1-5 scale
  answeredAt: timestamp("answered_at").defaultNow(),
});

// User progress tracking across topics
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  topicId: varchar("topic_id").references(() => nursingTopics.id).notNull(),
  currentScore: decimal("current_score", { precision: 5, scale: 2 }).default("0"),
  targetScore: decimal("target_score", { precision: 5, scale: 2 }).default("85"),
  totalStudyTime: integer("total_study_time").default(0), // in minutes
  questionsAttempted: integer("questions_attempted").default(0),
  questionsCorrect: integer("questions_correct").default(0),
  lastStudiedAt: timestamp("last_studied_at"),
  masteryLevel: text("mastery_level").default("beginner"), // 'beginner', 'intermediate', 'proficient', 'mastered'
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Curriculum progress tracking
export const curriculumProgress = pgTable("curriculum_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  chapterId: text("chapter_id").notNull(), // External curriculum chapter ID
  chapterName: text("chapter_name"),
  subject: text("subject"),
  topicId: varchar("topic_id").references(() => nursingTopics.id), // Related nursing topic
  status: text("status").default("not_started"), // 'not_started', 'in_progress', 'completed'
  progressPercentage: integer("progress_percentage").default(0), // 0-100
  timeSpent: integer("time_spent").default(0), // in minutes
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  notes: text("notes"), // User notes about the chapter
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email notifications and reminders
export const emailNotifications = pgTable("email_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'study_reminder', 'progress_report', 'milestone_achieved'
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  status: text("status").default("pending"), // 'pending', 'sent', 'failed'
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// New table for syllabus uploads and parsing
export const syllabi = pgTable("syllabi", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fileName: text("file_name").notNull(),
  courseTitle: text("course_title"),
  courseSpecialty: text("course_specialty"),
  weeklyObjectives: jsonb("weekly_objectives").$type<Array<{week: number, objectives: string[]}>>().default([]),
  extractedText: text("extracted_text"),
  uploadDate: timestamp("upload_date").defaultNow(),
});

// New table for diagnosis-specific performance
export const diagnosisPerformance = pgTable("diagnosis_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => assessmentReports.id),
  diagnosis: text("diagnosis").notNull(),
  bodySystem: text("body_system"),
  questionsTotal: integer("questions_total"),
  questionsCorrect: integer("questions_correct"),
  performanceLevel: text("performance_level"), // 'below', 'meets', 'exceeds'
});

// Content Import and Processing Tables
export const importJobs = pgTable("import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: text("job_type").notNull(), // 'csv', 'markdown', 'html', 'text'
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0), // 0-100
  mappingConfig: jsonb("mapping_config"), // Column mappings
  processingOptions: jsonb("processing_options"),
  totalRecords: integer("total_records").default(0),
  processedRecords: integer("processed_records").default(0),
  failedRecords: integer("failed_records").default(0),
  errorLog: jsonb("error_log"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const contentBlocks = pgTable("content_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(), // 'text', 'markdown', 'html'
  source: text("source"), // Original source
  sourceType: text("source_type"), // 'pdf', 'csv', 'manual'
  title: text("title"),
  description: text("description"),
  category: text("category"),
  subcategory: text("subcategory"),
  tags: jsonb("tags").$type<string[]>().default([]),
  difficulty: text("difficulty"),
  // AI-generated fields
  nursingSpecialty: text("nursing_specialty"),
  bodySystem: text("body_system"),
  diagnoses: jsonb("diagnoses").$type<string[]>().default([]),
  interventions: jsonb("interventions").$type<string[]>().default([]),
  patientProblems: jsonb("patient_problems").$type<string[]>().default([]),
  concepts: jsonb("concepts").$type<string[]>().default([]),
  // Search and indexing
  keywords: jsonb("keywords").$type<string[]>().default([]),
  embeddings: jsonb("embeddings"), // For semantic search
  // Tracking
  usageCount: integer("usage_count").default(0),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  parentId: varchar("parent_id"),
  relatedIds: jsonb("related_ids").$type<string[]>().default([]),
});

export const contentCrosswalks = pgTable("content_crosswalks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceSystem: text("source_system").notNull(), // 'ATI', 'NCLEX', 'Kaplan'
  sourceCode: text("source_code").notNull(),
  sourceDescription: text("source_description"),
  targetSystem: text("target_system").notNull(),
  targetCode: text("target_code").notNull(),
  targetDescription: text("target_description"),
  mappingType: text("mapping_type").notNull(), // '1-to-1', '1-to-many'
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  rules: jsonb("rules"),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Privacy consent management tables
export const cookieCategories = pgTable("cookie_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 'necessary', 'functional', 'analytics', 'marketing'
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  isRequired: boolean("is_required").default(false), // Necessary cookies cannot be disabled
  isEnabledByDefault: boolean("is_enabled_by_default").default(false),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPrivacyConsent = pgTable("user_privacy_consent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id"), // For anonymous users
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentVersion: text("consent_version").default("1.0"),
  necessaryCookies: boolean("necessary_cookies").default(true), // Always true
  functionalCookies: boolean("functional_cookies").default(false),
  analyticsCookies: boolean("analytics_cookies").default(false),
  marketingCookies: boolean("marketing_cookies").default(false),
  consentMethod: text("consent_method").notNull(), // 'banner', 'settings', 'api'
  consentTimestamp: timestamp("consent_timestamp").defaultNow(),
  expiresAt: timestamp("expires_at"), // When consent expires
  isWithdrawn: boolean("is_withdrawn").default(false),
  withdrawnAt: timestamp("withdrawn_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const consentLogs = pgTable("consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id"),
  action: text("action").notNull(), // 'grant', 'withdraw', 'update', 'expire'
  previousState: jsonb("previous_state"), // Previous consent preferences
  newState: jsonb("new_state"), // New consent preferences
  consentMethod: text("consent_method"), // 'banner', 'settings', 'api', 'automatic'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const privacySettings = pgTable("privacy_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailMarketing: boolean("email_marketing").default(false),
  smsMarketing: boolean("sms_marketing").default(false),
  dataSharing: boolean("data_sharing").default(false),
  profileVisible: boolean("profile_visible").default(true),
  analyticsOptOut: boolean("analytics_opt_out").default(false),
  dataExportRequests: boolean("data_export_requests").default(true),
  dataDeletionRequests: boolean("data_deletion_requests").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Topic demand tracking table
export const topicDemand = pgTable("topic_demand", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  requestedAt: timestamp("requested_at").defaultNow(),
  source: text("source").notNull(), // 'assessment', 'search', 'direct', 'study_plan'
  priority: integer("priority").default(1), // 1-5 scale
  sessionId: text("session_id"), // Track anonymous demand
  metadata: jsonb("metadata").$type<{
    assessmentId?: string;
    searchQuery?: string;
    referrer?: string;
    context?: string;
  }>().default({}),
});

// Resource allocation recommendations table
export const resourceAllocation = pgTable("resource_allocation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => nursingTopics.id).notNull(),
  recommendedResources: jsonb("recommended_resources").$type<{
    resourceType: string;
    quantity: number;
    priority: number;
    reasoning: string;
  }[]>().default([]),
  allocationScore: decimal("allocation_score", { precision: 5, scale: 2 }), // 0-100 priority score
  demandLevel: text("demand_level"), // 'low', 'medium', 'high', 'critical'
  resourceGap: decimal("resource_gap", { precision: 5, scale: 2 }), // Percentage gap
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("pending"), // 'pending', 'approved', 'in_progress', 'completed'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
});

// Call bookings table for unmapped topics
export const callBookings = pgTable("call_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  topicId: varchar("topic_id").references(() => nursingTopics.id),
  topicName: text("topic_name").notNull(), // Store topic name in case topic doesn't exist
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").default("pending"), // 'pending', 'scheduled', 'completed', 'cancelled', 'no_show'
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  preferredTimeSlots: jsonb("preferred_time_slots").$type<string[]>().default([]), // Array of ISO date strings
  urgency: text("urgency").default("medium"), // 'low', 'medium', 'high', 'critical'
  notes: text("notes"), // User's notes
  adminNotes: text("admin_notes"), // Admin's notes
  assignedTo: varchar("assigned_to").references(() => adminUsers.id),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => adminUsers.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  duration: integer("duration"), // Call duration in minutes
  meetingLink: text("meeting_link"), // Zoom/Google Meet link
  recordingUrl: text("recording_url"), // Recording URL if available
  followUpRequired: boolean("follow_up_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leads table for tracking conversions
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => callBookings.id),
  userId: varchar("user_id").references(() => users.id),
  status: text("status").default("new"), // 'new', 'qualified', 'nurturing', 'opportunity', 'negotiation', 'won', 'lost'
  score: integer("score").default(0), // Lead score 0-100
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }), // Potential or actual value
  conversionType: text("conversion_type"), // 'subscription', 'course_sale', 'consultation', 'free_resource'
  conversionDate: timestamp("conversion_date"),
  lostReason: text("lost_reason"),
  source: text("source").default("unmapped_topic"), // 'unmapped_topic', 'direct_request', 'referral', 'assessment', 'marketing'
  firstContactDate: timestamp("first_contact_date"),
  lastContactDate: timestamp("last_contact_date"),
  followUpDate: timestamp("follow_up_date"),
  numberOfContacts: integer("number_of_contacts").default(0),
  engagementLevel: text("engagement_level"), // 'low', 'medium', 'high', 'very_high'
  interestedTopics: jsonb("interested_topics").$type<string[]>().default([]),
  tags: jsonb("tags").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
  assignedTo: varchar("assigned_to").references(() => adminUsers.id),
  // Enhanced fields for CRM
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  companyName: text("company_name"),
  industry: text("industry"),
  companySize: text("company_size"), // 'small', 'medium', 'large', 'enterprise'
  budget: decimal("budget", { precision: 10, scale: 2 }),
  decisionTimeframe: text("decision_timeframe"), // 'immediate', '1_month', '3_months', '6_months', '1_year'
  jobTitle: text("job_title"),
  // Scoring components
  engagementScore: integer("engagement_score").default(0), // 0-25
  demographicScore: integer("demographic_score").default(0), // 0-25
  behavioralScore: integer("behavioral_score").default(0), // 0-25
  timingScore: integer("timing_score").default(0), // 0-25
  // Activity tracking
  emailOpens: integer("email_opens").default(0),
  linkClicks: integer("link_clicks").default(0),
  pageVisits: integer("page_visits").default(0),
  resourceDownloads: integer("resource_downloads").default(0),
  assessmentsCompleted: integer("assessments_completed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin availability slots for call scheduling
export const adminAvailability = pgTable("admin_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => adminUsers.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  timezone: text("timezone").default("America/New_York"),
  isActive: boolean("is_active").default(true),
  maxCallsPerSlot: integer("max_calls_per_slot").default(1),
  slotDuration: integer("slot_duration").default(30), // in minutes
  bufferTime: integer("buffer_time").default(15), // buffer between calls in minutes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead activities tracking table
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  activityType: text("activity_type").notNull(), // 'email', 'call', 'meeting', 'note', 'status_change', 'task', 'email_opened', 'link_clicked'
  description: text("description").notNull(),
  performedBy: varchar("performed_by").references(() => adminUsers.id),
  performedAt: timestamp("performed_at").defaultNow(),
  metadata: jsonb("metadata").$type<{
    fromStatus?: string;
    toStatus?: string;
    emailSubject?: string;
    duration?: number;
    outcome?: string;
    nextAction?: string;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lead tags for categorization
export const leadTags = pgTable("lead_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  tag: text("tag").notNull(),
  category: text("category"), // 'source', 'interest', 'qualification', 'custom'
  color: text("color").default("#gray"),
  addedBy: varchar("added_by").references(() => adminUsers.id),
  addedAt: timestamp("added_at").defaultNow(),
});

// Email campaigns for lead nurturing
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  campaignType: text("campaign_type").notNull(), // 'welcome', 'nurture', 're_engagement', 'conversion', 'custom'
  campaignName: text("campaign_name").notNull(),
  status: text("status").default("active"), // 'active', 'paused', 'completed', 'stopped'
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  linksClicked: integer("links_clicked").default(0),
  lastSentAt: timestamp("last_sent_at"),
  nextScheduled: timestamp("next_scheduled"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata").$type<{
    templateIds?: string[];
    currentStep?: number;
    totalSteps?: number;
    openRate?: number;
    clickRate?: number;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email templates for automation
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML content
  category: text("category").notNull(), // 'follow_up', 'welcome', 'nurture', 'conversion', 'reminder'
  variables: jsonb("variables").$type<string[]>().default([]), // ['firstName', 'topicName', etc.]
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdBy: varchar("created_by").references(() => adminUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== RAG System Tables ====================
// Document storage for RAG system
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'pdf', 'pptx', 'docx', 'txt'
  sourceUri: text("source_uri").notNull(), // path to original file
  totalPages: integer("total_pages"),
  totalTokens: integer("total_tokens"),
  contentHash: text("content_hash").notNull(), // for deduplication
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  metadata: jsonb("metadata").$type<{
    author?: string;
    createdDate?: string;
    modifiedDate?: string;
    fileSize?: number;
    mimeType?: string;
    extractedKeywords?: string[];
    language?: string;
    summary?: string;
    [key: string]: any;
  }>().default({}),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"), // soft delete support
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document chunks for semantic search
export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  chunkIndex: integer("chunk_index").notNull(), // order within document
  headingPath: text("heading_path").array(), // hierarchical headings
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  cleanText: text("clean_text").notNull(), // processed text for embedding
  rawText: text("raw_text").notNull(), // original text
  tokens: integer("tokens").notNull(),
  embedding: vector("embedding", 1536), // OpenAI embeddings stored as native pgvector vector(1536)
  searchVector: text("search_vector"), // Will be converted to tsvector via SQL migration
  tags: text("tags").array().default([]),
  objectives: text("objectives").array().default([]),
  topicIds: text("topic_ids").array().default([]), // links to nursing topics
  metadata: jsonb("metadata").$type<{
    headingLevel?: number;
    bulletPoints?: string[];
    tables?: any[];
    images?: string[];
    footnotes?: string[];
    references?: string[];
    [key: string]: any;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document processing jobs
export const documentJobs = pgTable("document_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  stage: text("stage").notNull(), // 'upload', 'extract', 'structure', 'chunk', 'embed', 'persist', 'tag', 'verify'
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0), // 0-100 percentage
  error: text("error"),
  metadata: jsonb("metadata").$type<{
    chunksProcessed?: number;
    totalChunks?: number;
    tokensProcessed?: number;
    embeddingsGenerated?: number;
    errorDetails?: any;
    [key: string]: any;
  }>().default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// RAG citations for tracking source usage
export const ragCitations = pgTable("rag_citations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryId: varchar("query_id").notNull(), // for tracking query sessions
  chunkId: varchar("chunk_id").references(() => documentChunks.id, { onDelete: "cascade" }).notNull(),
  relevanceScore: decimal("relevance_score", { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  usedInAnswer: boolean("used_in_answer").notNull().default(false),
  metadata: jsonb("metadata").$type<{
    searchMethod?: string; // 'vector', 'keyword', 'hybrid'
    rankPosition?: number;
    highlightedText?: string;
    [key: string]: any;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table Extraction System Tables
export const extractedTables = pgTable("extracted_tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  tableIndex: integer("table_index").notNull(), // Order of table in document (0, 1, 2...)
  title: text("title"), // Extracted or inferred table title
  pageNumber: integer("page_number"),
  boundingBox: jsonb("bounding_box").$type<{x: number, y: number, width: number, height: number}>(), // Table position on page
  rowCount: integer("row_count").notNull(),
  columnCount: integer("column_count").notNull(),
  hasHeaders: boolean("has_headers").default(true), // Whether first row contains headers
  headers: jsonb("headers").$type<string[]>().default([]), // Column headers
  extractionMethod: text("extraction_method").notNull(), // 'pdf-parse', 'manual', 'ai-extracted'
  extractionConfidence: decimal("extraction_confidence", { precision: 3, scale: 2 }), // 0-1 confidence score
  rawTableData: jsonb("raw_table_data"), // Original extracted data structure
  status: text("status").default("pending"), // 'pending', 'approved', 'rejected', 'processing'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  metadata: jsonb("metadata").$type<{
    extractionTimeMs?: number;
    originalFormat?: string;
    processingNotes?: string;
    qualityScore?: number;
    topicRelevance?: string[];
  }>().default({}),
  extractedAt: timestamp("extracted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tableCells = pgTable("table_cells", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").references(() => extractedTables.id, { onDelete: "cascade" }).notNull(),
  rowIndex: integer("row_index").notNull(), // 0-based row position
  columnIndex: integer("column_index").notNull(), // 0-based column position
  content: text("content"), // Text content of the cell
  dataType: text("data_type").default("text"), // 'text', 'number', 'date', 'percentage', 'currency'
  numericValue: decimal("numeric_value", { precision: 15, scale: 4 }), // For numerical data
  isHeader: boolean("is_header").default(false), // Whether this cell is a header
  spanRows: integer("span_rows").default(1), // Row span for merged cells
  spanColumns: integer("span_columns").default(1), // Column span for merged cells
  formatting: jsonb("formatting").$type<{
    bold?: boolean;
    italic?: boolean;
    alignment?: string;
    backgroundColor?: string;
    textColor?: string;
  }>().default({}),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // Extraction confidence for this cell
  originalBounds: jsonb("original_bounds").$type<{x: number, y: number, width: number, height: number}>(), // Position in original PDF
  editedContent: text("edited_content"), // Manual corrections to content
  validationNotes: text("validation_notes"), // Admin notes about cell validation
  createdAt: timestamp("created_at").defaultNow(),
});

export const tableApprovals = pgTable("table_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").references(() => extractedTables.id, { onDelete: "cascade" }).notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'approved', 'rejected', 'needs_revision'
  notes: text("notes"), // Reviewer feedback and comments
  changesRequested: jsonb("changes_requested").$type<{
    structuralChanges?: string[];
    contentChanges?: Array<{cellId: string, suggestedContent: string, reason: string}>;
    metadataChanges?: Record<string, any>;
  }>().default({}),
  reviewedAt: timestamp("reviewed_at").defaultNow(),
  followUpRequired: boolean("follow_up_required").default(false),
  previousApprovalId: varchar("previous_approval_id").references(() => tableApprovals.id), // For revision tracking
});

export const tableTopicMappings = pgTable("table_topic_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableId: varchar("table_id").references(() => extractedTables.id, { onDelete: "cascade" }).notNull(),
  topicId: varchar("topic_id").references(() => nursingTopics.id).notNull(),
  relevanceScore: decimal("relevance_score", { precision: 3, scale: 2 }), // How relevant is this table to the topic
  mappingSource: text("mapping_source").default("automatic"), // 'automatic', 'manual', 'ai-suggested'
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lesson Builder source registry and package output
export const sourceRegistry = pgTable("source_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sourceKind: text("source_kind").notNull().default("document"), // 'document', 'drive_sheet', 'local_file', 'taxonomy'
  sourceType: text("source_type").notNull().default("reference"), // 'blueprint', 'crosswalk', 'manual', 'textbook', 'reference'
  sourceUri: text("source_uri"),
  driveFileId: text("drive_file_id"),
  documentId: varchar("document_id").references(() => documents.id),
  subject: text("subject"),
  edition: text("edition"),
  citationPolicy: text("citation_policy").notNull().default("cite_paraphrase"),
  approvalStatus: text("approval_status").notNull().default("approved"), // 'pending', 'approved', 'rejected'
  ingestionStatus: text("ingestion_status").notNull().default("ready"), // 'queued', 'processing', 'ready', 'failed'
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taxonomyTerms = pgTable("taxonomy_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taxonomy: text("taxonomy").notNull(), // 'NCLEX', 'CJM', 'Nursing Process', 'Bloom', 'ATI', 'Textbook', 'Review Topic'
  code: text("code"),
  label: text("label").notNull(),
  parentId: varchar("parent_id"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Versioned curriculum graph used by the directed-remediation and Canvas export pipeline.
// Legacy nursing_topics records remain valid and can be linked through alias nodes.
export const curriculumFrameworks = pgTable("curriculum_frameworks", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  version: text("version").notNull(),
  audience: text("audience").notNull().default("Prelicensure RN"),
  status: text("status").notNull().default("draft"), // draft, active, retired
  sourceUri: text("source_uri"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const curriculumNodes = pgTable("curriculum_nodes", {
  id: varchar("id").primaryKey(),
  frameworkId: varchar("framework_id").references(() => curriculumFrameworks.id, { onDelete: "cascade" }).notNull(),
  nodeType: text("node_type").notNull(), // category, integrated_process, ncjmm, concept, topic, subtopic, objective, alias
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  blueprintWeight: decimal("blueprint_weight", { precision: 5, scale: 2 }),
  safetyRisk: text("safety_risk").notNull().default("standard"), // standard, elevated, high
  releaseStage: text("release_stage").notNull().default("draft"), // draft, clinical_review, approved, export_ready
  legacyIds: text("legacy_ids").array().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const curriculumEdges = pgTable("curriculum_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  frameworkId: varchar("framework_id").references(() => curriculumFrameworks.id, { onDelete: "cascade" }).notNull(),
  fromNodeId: varchar("from_node_id").references(() => curriculumNodes.id, { onDelete: "cascade" }).notNull(),
  toNodeId: varchar("to_node_id").references(() => curriculumNodes.id, { onDelete: "cascade" }).notNull(),
  relationship: text("relationship").notNull(), // contains, maps_to, prerequisite_for, alias_of
  weight: decimal("weight", { precision: 5, scale: 4 }),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const curriculumObjectiveMappings = pgTable("curriculum_objective_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveNodeId: varchar("objective_node_id").references(() => curriculumNodes.id, { onDelete: "cascade" }).notNull(),
  // These IDs intentionally remain compatibility references because legacy package/item
  // records can be imported before the curriculum graph is installed.
  packageId: varchar("package_id"),
  itemId: varchar("item_id"),
  mappingType: text("mapping_type").notNull().default("primary"),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull().default("1"),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const curriculumEvidenceSources = pgTable("curriculum_evidence_sources", {
  id: varchar("id").primaryKey(),
  frameworkId: varchar("framework_id").references(() => curriculumFrameworks.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  publisher: text("publisher").notNull(),
  license: text("license").notNull(),
  sourceUri: text("source_uri").notNull(),
  edition: text("edition"),
  locator: text("locator"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const curriculumPerformanceEvidence = pgTable("curriculum_performance_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  learnerKey: text("learner_key").notNull(),
  objectiveNodeId: varchar("objective_node_id").references(() => curriculumNodes.id, { onDelete: "cascade" }).notNull(),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull().default("1"),
  sourceKind: text("source_kind").notNull(), // generic_csv, ati_alias_report, canvas_outcome, quiz
  observedAt: timestamp("observed_at").notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const directedRemediationPlans = pgTable("directed_remediation_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  learnerKey: text("learner_key").notNull(),
  frameworkId: varchar("framework_id").references(() => curriculumFrameworks.id).notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  status: text("status").notNull().default("draft"),
  inputs: jsonb("inputs").$type<Record<string, any>>().notNull(),
  recommendations: jsonb("recommendations").$type<any[]>().notNull(),
  audit: jsonb("audit").$type<Record<string, any>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const curriculumExportJobs = pgTable("curriculum_export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  frameworkId: varchar("framework_id").references(() => curriculumFrameworks.id).notNull(),
  exportType: text("export_type").notNull(), // curriculum_json, outcomes_csv, qti, common_cartridge, pathway_rules
  status: text("status").notNull().default("queued"),
  artifactUri: text("artifact_uri"),
  validationSummary: jsonb("validation_summary").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const sourceTaxonomyMappings = pgTable("source_taxonomy_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").references(() => sourceRegistry.id, { onDelete: "cascade" }).notNull(),
  taxonomyTermId: varchar("taxonomy_term_id").references(() => taxonomyTerms.id, { onDelete: "cascade" }).notNull(),
  documentId: varchar("document_id").references(() => documents.id),
  chunkId: varchar("chunk_id").references(() => documentChunks.id),
  mappingSource: text("mapping_source").notNull().default("admin_review"), // 'drive_sheet', 'ai_suggested', 'admin_review'
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonPackages = pgTable("lesson_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  audience: text("audience").notNull().default("Prelicensure RN"),
  status: text("status").notNull().default("draft"), // legacy delivery status
  releaseStage: text("release_stage").notNull().default("draft"), // draft, clinical_review, approved, export_ready
  sourceIds: text("source_ids").array().default([]),
  taxonomySnapshot: jsonb("taxonomy_snapshot").$type<Record<string, any>>().default({}),
  deckModel: jsonb("deck_model").$type<Record<string, any>>().default({}),
  manifest: jsonb("manifest").$type<Record<string, any>>().default({}),
  qaSummary: jsonb("qa_summary").$type<Record<string, any>>().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lessonSlides = pgTable("lesson_slides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  slideNumber: integer("slide_number").notNull(),
  slideType: text("slide_type").notNull(),
  title: text("title").notNull(),
  visibleContent: jsonb("visible_content").$type<Record<string, any>>().default({}),
  speakerNotes: text("speaker_notes"),
  guidedNotes: text("guided_notes"),
  retrievalPrompt: text("retrieval_prompt"),
  nclexCategory: text("nclex_category"),
  cjmStep: text("cjm_step"),
  nursingProcess: text("nursing_process"),
  bloomLevel: text("bloom_level"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonItems = pgTable("lesson_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  slideId: varchar("slide_id").references(() => lessonSlides.id, { onDelete: "set null" }),
  itemType: text("item_type").notNull().default("multiple_choice"),
  stem: text("stem").notNull(),
  options: jsonb("options").$type<Array<{ id: string; text: string }>>().default([]),
  correctAnswer: text("correct_answer").notNull(),
  rationale: text("rationale").notNull(),
  tags: jsonb("tags").$type<Record<string, any>>().default({}),
  difficulty: text("difficulty").default("application"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonCitations = pgTable("lesson_citations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  slideId: varchar("slide_id").references(() => lessonSlides.id, { onDelete: "cascade" }),
  itemId: varchar("item_id").references(() => lessonItems.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").references(() => sourceRegistry.id),
  documentId: varchar("document_id").references(() => documents.id),
  chunkId: varchar("chunk_id").references(() => documentChunks.id),
  citationLabel: text("citation_label").notNull(),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  excerpt: text("excerpt"),
  relevanceScore: decimal("relevance_score", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonQaResults = pgTable("lesson_qa_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  gateKey: text("gate_key").notNull(),
  gateName: text("gate_name").notNull(),
  status: text("status").notNull(), // 'pass', 'warn', 'fail'
  details: text("details").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export const sourceArchiveImports = pgTable("source_archive_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sourceUri: text("source_uri").notNull(),
  archiveKind: text("archive_kind").notNull().default("source_archive"),
  role: text("role").notNull().default("pattern_reference"),
  status: text("status").notNull().default("queued"), // 'queued', 'processing', 'completed', 'failed', 'duplicate'
  contentHash: text("content_hash"),
  fileCount: integer("file_count").default(0),
  importedSourceIds: text("imported_source_ids").array().default([]),
  summary: jsonb("summary").$type<Record<string, any>>().default({}),
  errorMessage: text("error_message"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sourceArchiveFiles = pgTable("source_archive_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importId: varchar("import_id").references(() => sourceArchiveImports.id, { onDelete: "cascade" }).notNull(),
  sourceId: varchar("source_id").references(() => sourceRegistry.id, { onDelete: "set null" }),
  filePath: text("file_path").notNull(),
  fileKind: text("file_kind").notNull().default("other"),
  fileRole: text("file_role").notNull().default("reference"),
  sizeBytes: integer("size_bytes").default(0),
  contentHash: text("content_hash"),
  extractedText: text("extracted_text"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonGenerationRuns = pgTable("lesson_generation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "set null" }),
  status: text("status").notNull().default("queued"), // 'queued', 'running', 'completed', 'failed'
  generationMode: text("generation_mode").notNull().default("template"),
  topic: text("topic").notNull(),
  audience: text("audience").notNull().default("Prelicensure RN"),
  sourceIds: text("source_ids").array().default([]),
  settings: jsonb("settings").$type<Record<string, any>>().default({}),
  evidenceSnapshot: jsonb("evidence_snapshot").$type<Record<string, any>>().default({}),
  taxonomySnapshot: jsonb("taxonomy_snapshot").$type<Record<string, any>>().default({}),
  validationSummary: jsonb("validation_summary").$type<Record<string, any>>().default({}),
  errorMessage: text("error_message"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const lessonPackageArtifacts = pgTable("lesson_package_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  artifactKey: text("artifact_key").notNull(),
  artifactType: text("artifact_type").notNull().default("json"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/json"),
  contentHash: text("content_hash"),
  storageUri: text("storage_uri"),
  contentJson: jsonb("content_json").$type<Record<string, any> | any[]>().default({}),
  contentText: text("content_text"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonContractValidations = pgTable("lesson_contract_validations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  validationKey: text("validation_key").notNull(),
  validationName: text("validation_name").notNull(),
  status: text("status").notNull(), // 'pass', 'warn', 'fail'
  details: text("details").notNull(),
  evidence: jsonb("evidence").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonPackageReviews = pgTable("lesson_package_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  reviewerName: text("reviewer_name").notNull().default("Faculty reviewer"),
  reviewerRole: text("reviewer_role").notNull().default("faculty_reviewer"),
  decision: text("decision").notNull().default("comment"), // 'comment', 'changes_requested', 'approved_for_pilot', 'approved_for_release'
  focusArea: text("focus_area").notNull().default("overall"),
  comment: text("comment").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const topicProductionReviews = pgTable("topic_production_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceKey: text("source_key").notNull().unique(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  decision: text("decision").notNull().default("unreviewed"),
  reviewerNotes: text("reviewer_notes").notNull().default(""),
  reviewedBy: text("reviewed_by").notNull().default("admin"),
  reviewedAt: timestamp("reviewed_at").defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lessonAssignments = pgTable("lesson_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  cohortName: text("cohort_name").notNull().default("Pilot cohort"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("active"), // 'active', 'archived'
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lessonAssignmentLearners = pgTable("lesson_assignment_learners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").references(() => lessonAssignments.id, { onDelete: "cascade" }).notNull(),
  learnerName: text("learner_name").notNull(),
  learnerEmail: text("learner_email"),
  learnerKey: text("learner_key").notNull(),
  status: text("status").notNull().default("assigned"), // 'assigned', 'in_progress', 'completed'
  openedAt: timestamp("opened_at"),
  completedAt: timestamp("completed_at"),
  lastActivityAt: timestamp("last_activity_at"),
  feedbackRating: text("feedback_rating"),
  feedbackComment: text("feedback_comment"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lessonLearnerEvents = pgTable("lesson_learner_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  assignmentId: varchar("assignment_id").references(() => lessonAssignments.id, { onDelete: "set null" }),
  assignmentLearnerId: varchar("assignment_learner_id").references(() => lessonAssignmentLearners.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(), // 'lesson_opened', 'slide_viewed', 'practice_viewed', 'lesson_completed', 'feedback_submitted'
  slideId: varchar("slide_id").references(() => lessonSlides.id, { onDelete: "set null" }),
  itemId: varchar("item_id").references(() => lessonItems.id, { onDelete: "set null" }),
  payload: jsonb("payload").$type<Record<string, any>>().default({}),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonReleaseAuditEvents = pgTable("lesson_release_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => lessonPackages.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").$type<Record<string, any>>().default({}),
  actorId: varchar("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Call booking types
export const insertCallBookingSchema = createInsertSchema(callBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCallBooking = z.infer<typeof insertCallBookingSchema>;
export type CallBooking = typeof callBookings.$inferSelect;

// Lead types
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Admin availability types
export const insertAdminAvailabilitySchema = createInsertSchema(adminAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminAvailability = z.infer<typeof insertAdminAvailabilitySchema>;
export type AdminAvailability = typeof adminAvailability.$inferSelect;

// Lead activity types
export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true,
});
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

// Lead tag types
export const insertLeadTagSchema = createInsertSchema(leadTags).omit({
  id: true,
  addedAt: true,
});
export type InsertLeadTag = z.infer<typeof insertLeadTagSchema>;
export type LeadTag = typeof leadTags.$inferSelect;

// Email campaign types
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

// Email template types
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  assessmentReports: many(assessmentReports),
  studyPlans: many(studyPlans),
  syllabi: many(syllabi),
  privacyConsent: many(userPrivacyConsent),
  consentLogs: many(consentLogs),
  privacySettings: one(privacySettings),
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const emailVerificationCodesRelations = relations(emailVerificationCodes, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationCodes.userId],
    references: [users.id],
  }),
}));

export const adminUsersRelations = relations(adminUsers, ({ one }) => ({
  user: one(users, {
    fields: [adminUsers.userId],
    references: [users.id],
  }),
}));

export const contentAreasRelations = relations(contentAreas, ({ many }) => ({
  nursingTopics: many(nursingTopics),
  contentAreaPerformance: many(contentAreaPerformance),
}));

export const nursingTopicsRelations = relations(nursingTopics, ({ one, many }) => ({
  contentArea: one(contentAreas, {
    fields: [nursingTopics.contentAreaId],
    references: [contentAreas.id],
  }),
  learningResources: many(learningResources),
  topicPerformance: many(topicPerformance),
  studyPlanItems: many(studyPlanItems),
  subtopics: many(nursingSubtopics),
  peerPerformance: many(peerPerformance),
}));

export const nursingSubtopicsRelations = relations(nursingSubtopics, ({ one, many }) => ({
  topic: one(nursingTopics, {
    fields: [nursingSubtopics.topicId],
    references: [nursingTopics.id],
  }),
  textbookMappings: many(textbookMappings),
  learningResources: many(learningResources),
}));

export const textbookMappingsRelations = relations(textbookMappings, ({ one }) => ({
  subtopic: one(nursingSubtopics, {
    fields: [textbookMappings.subtopicId],
    references: [nursingSubtopics.id],
  }),
}));

export const assessmentReportsRelations = relations(assessmentReports, ({ one, many }) => ({
  user: one(users, {
    fields: [assessmentReports.userId],
    references: [users.id],
  }),
  topicPerformance: many(topicPerformance),
  contentAreaPerformance: many(contentAreaPerformance),
  studyPlans: many(studyPlans),
  diagnosisPerformance: many(diagnosisPerformance),
}));

export const peerPerformanceRelations = relations(peerPerformance, ({ one }) => ({
  topic: one(nursingTopics, {
    fields: [peerPerformance.topicId],
    references: [nursingTopics.id],
  }),
  contentArea: one(contentAreas, {
    fields: [peerPerformance.contentAreaId],
    references: [contentAreas.id],
  }),
}));

export const topicRelationshipsRelations = relations(topicRelationships, ({ one }) => ({
  primaryTopic: one(nursingTopics, {
    fields: [topicRelationships.primaryTopicId],
    references: [nursingTopics.id],
  }),
  relatedTopic: one(nursingTopics, {
    fields: [topicRelationships.relatedTopicId],
    references: [nursingTopics.id],
  }),
}));

export const syllabiRelations = relations(syllabi, ({ one }) => ({
  user: one(users, {
    fields: [syllabi.userId],
    references: [users.id],
  }),
}));

export const diagnosisPerformanceRelations = relations(diagnosisPerformance, ({ one }) => ({
  report: one(assessmentReports, {
    fields: [diagnosisPerformance.reportId],
    references: [assessmentReports.id],
  }),
}));

export const userPrivacyConsentRelations = relations(userPrivacyConsent, ({ one }) => ({
  user: one(users, {
    fields: [userPrivacyConsent.userId],
    references: [users.id],
  }),
}));

export const consentLogsRelations = relations(consentLogs, ({ one }) => ({
  user: one(users, {
    fields: [consentLogs.userId],
    references: [users.id],
  }),
}));

export const privacySettingsRelations = relations(privacySettings, ({ one }) => ({
  user: one(users, {
    fields: [privacySettings.userId],
    references: [users.id],
  }),
}));

export const topicPerformanceRelations = relations(topicPerformance, ({ one }) => ({
  report: one(assessmentReports, {
    fields: [topicPerformance.reportId],
    references: [assessmentReports.id],
  }),
  topic: one(nursingTopics, {
    fields: [topicPerformance.topicId],
    references: [nursingTopics.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  school: true,
  graduationDate: true,
});

export const insertAssessmentReportSchema = createInsertSchema(assessmentReports).pick({
  fileName: true,
  extractedText: true,
  overallScore: true,
});

export const insertTopicPerformanceSchema = createInsertSchema(topicPerformance).pick({
  reportId: true,
  topicId: true,
  score: true,
  frequency: true,
  gapScore: true,
  priority: true,
  recommendedStudyTime: true,
});

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  createdAt: true,
  progress: true,
});

export const insertContentBlockSchema = createInsertSchema(contentBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  version: true,
});

export const insertContentCrosswalkSchema = createInsertSchema(contentCrosswalks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudySessionSchema = createInsertSchema(studySessions).omit({
  id: true,
  createdAt: true,
});

export const insertPracticeQuestionSchema = createInsertSchema(practiceQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertUserAnswerSchema = createInsertSchema(userAnswers).omit({
  id: true,
  answeredAt: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  updatedAt: true,
});

export const insertCurriculumProgressSchema = createInsertSchema(curriculumProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailNotificationSchema = createInsertSchema(emailNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertCookieCategorySchema = createInsertSchema(cookieCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPrivacyConsentSchema = createInsertSchema(userPrivacyConsent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsentLogSchema = createInsertSchema(consentLogs).omit({
  id: true,
  timestamp: true,
});

export const insertPrivacySettingsSchema = createInsertSchema(privacySettings).omit({
  id: true,
  updatedAt: true,
});

// Add schema for topicsNeedingResources
export const insertTopicsNeedingResourcesSchema = createInsertSchema(topicsNeedingResources).omit({
  id: true,
  firstRequested: true,
  lastRequested: true,
  resolvedAt: true,
});

// Add schema for resourceMappings
export const insertResourceMappingSchema = createInsertSchema(resourceMappings).omit({
  id: true,
  mappedAt: true,
});

// Add schema for topicDemand
export const insertTopicDemandSchema = createInsertSchema(topicDemand).omit({
  id: true,
  requestedAt: true,
});

// Add schema for resourceAllocation
export const insertResourceAllocationSchema = createInsertSchema(resourceAllocation).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  completedAt: true,
});

// RAG System Insert Schemas
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentJobSchema = createInsertSchema(documentJobs).omit({
  id: true,
  createdAt: true,
});

export const insertRagCitationSchema = createInsertSchema(ragCitations).omit({
  id: true,
  createdAt: true,
});

export const insertVerificationTokenSchema = createInsertSchema(verificationTokens).omit({
  id: true,
  createdAt: true,
});

// Table Extraction Insert Schemas
export const insertExtractedTableSchema = createInsertSchema(extractedTables).omit({
  id: true,
  extractedAt: true,
  updatedAt: true,
});

export const insertTableCellSchema = createInsertSchema(tableCells).omit({
  id: true,
  createdAt: true,
});

export const insertTableApprovalSchema = createInsertSchema(tableApprovals).omit({
  id: true,
  reviewedAt: true,
});

export const insertTableTopicMappingSchema = createInsertSchema(tableTopicMappings).omit({
  id: true,
  createdAt: true,
});

// Lesson Builder Insert Schemas
export const insertSourceRegistrySchema = createInsertSchema(sourceRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxonomyTermSchema = createInsertSchema(taxonomyTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSourceTaxonomyMappingSchema = createInsertSchema(sourceTaxonomyMappings).omit({
  id: true,
  createdAt: true,
});

export const insertLessonPackageSchema = createInsertSchema(lessonPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export const insertLessonSlideSchema = createInsertSchema(lessonSlides).omit({
  id: true,
  createdAt: true,
});

export const insertLessonItemSchema = createInsertSchema(lessonItems).omit({
  id: true,
  createdAt: true,
});

export const insertLessonCitationSchema = createInsertSchema(lessonCitations).omit({
  id: true,
  createdAt: true,
});

export const insertLessonQaResultSchema = createInsertSchema(lessonQaResults).omit({
  id: true,
  checkedAt: true,
});

export const insertSourceArchiveImportSchema = createInsertSchema(sourceArchiveImports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSourceArchiveFileSchema = createInsertSchema(sourceArchiveFiles).omit({
  id: true,
  createdAt: true,
});

export const insertLessonGenerationRunSchema = createInsertSchema(lessonGenerationRuns).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertLessonPackageArtifactSchema = createInsertSchema(lessonPackageArtifacts).omit({
  id: true,
  createdAt: true,
});

export const insertLessonContractValidationSchema = createInsertSchema(lessonContractValidations).omit({
  id: true,
  createdAt: true,
});

export const insertLessonPackageReviewSchema = createInsertSchema(lessonPackageReviews).omit({
  id: true,
  createdAt: true,
});

export const insertLessonAssignmentSchema = createInsertSchema(lessonAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLessonAssignmentLearnerSchema = createInsertSchema(lessonAssignmentLearners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  openedAt: true,
  completedAt: true,
  lastActivityAt: true,
});

export const insertLessonLearnerEventSchema = createInsertSchema(lessonLearnerEvents).omit({
  id: true,
  createdAt: true,
});

export const insertLessonReleaseAuditEventSchema = createInsertSchema(lessonReleaseAuditEvents).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ContentArea = typeof contentAreas.$inferSelect;
export type NursingTopic = typeof nursingTopics.$inferSelect;
export type NursingSubtopic = typeof nursingSubtopics.$inferSelect;
export type TextbookMapping = typeof textbookMappings.$inferSelect;
export type LearningResource = typeof learningResources.$inferSelect;
export type AssessmentReport = typeof assessmentReports.$inferSelect;
export type InsertAssessmentReport = z.infer<typeof insertAssessmentReportSchema>;
export type TopicPerformance = typeof topicPerformance.$inferSelect;
export type InsertTopicPerformance = z.infer<typeof insertTopicPerformanceSchema>;
export type ContentAreaPerformance = typeof contentAreaPerformance.$inferSelect;
export type StudyPlan = typeof studyPlans.$inferSelect;
export type StudyPlanItem = typeof studyPlanItems.$inferSelect;
export type PeerPerformance = typeof peerPerformance.$inferSelect;
export type TopicRelationship = typeof topicRelationships.$inferSelect;
export type Syllabus = typeof syllabi.$inferSelect;
export type DiagnosisPerformance = typeof diagnosisPerformance.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;
export type ContentCrosswalk = typeof contentCrosswalks.$inferSelect;
export type InsertContentCrosswalk = z.infer<typeof insertContentCrosswalkSchema>;
export type TopicFrequencyTracking = typeof topicFrequencyTracking.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type PracticeQuestion = typeof practiceQuestions.$inferSelect;
export type InsertPracticeQuestion = z.infer<typeof insertPracticeQuestionSchema>;
export type UserAnswer = typeof userAnswers.$inferSelect;
export type InsertUserAnswer = z.infer<typeof insertUserAnswerSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type CurriculumProgress = typeof curriculumProgress.$inferSelect;
export type InsertCurriculumProgress = z.infer<typeof insertCurriculumProgressSchema>;
export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = z.infer<typeof insertEmailNotificationSchema>;
export type CookieCategory = typeof cookieCategories.$inferSelect;
export type InsertCookieCategory = z.infer<typeof insertCookieCategorySchema>;
export type UserPrivacyConsent = typeof userPrivacyConsent.$inferSelect;
export type InsertUserPrivacyConsent = z.infer<typeof insertUserPrivacyConsentSchema>;
export type ConsentLog = typeof consentLogs.$inferSelect;
export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;
export type PrivacySettings = typeof privacySettings.$inferSelect;
export type InsertPrivacySettings = z.infer<typeof insertPrivacySettingsSchema>;
export type TopicsNeedingResources = typeof topicsNeedingResources.$inferSelect;
export type InsertTopicsNeedingResources = z.infer<typeof insertTopicsNeedingResourcesSchema>;
export type ResourceMapping = typeof resourceMappings.$inferSelect;
export type InsertResourceMapping = z.infer<typeof insertResourceMappingSchema>;
export type TopicDemand = typeof topicDemand.$inferSelect;
export type InsertTopicDemand = z.infer<typeof insertTopicDemandSchema>;
export type ResourceAllocation = typeof resourceAllocation.$inferSelect;
export type InsertResourceAllocation = z.infer<typeof insertResourceAllocationSchema>;

// RAG System Types
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentJob = typeof documentJobs.$inferSelect;
export type InsertDocumentJob = z.infer<typeof insertDocumentJobSchema>;
export type RagCitation = typeof ragCitations.$inferSelect;
export type InsertRagCitation = z.infer<typeof insertRagCitationSchema>;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = z.infer<typeof insertVerificationTokenSchema>;

// Table Extraction Types
export type ExtractedTable = typeof extractedTables.$inferSelect;
export type InsertExtractedTable = z.infer<typeof insertExtractedTableSchema>;
export type TableCell = typeof tableCells.$inferSelect;
export type InsertTableCell = z.infer<typeof insertTableCellSchema>;
export type TableApproval = typeof tableApprovals.$inferSelect;
export type InsertTableApproval = z.infer<typeof insertTableApprovalSchema>;
export type TableTopicMapping = typeof tableTopicMappings.$inferSelect;
export type InsertTableTopicMapping = z.infer<typeof insertTableTopicMappingSchema>;

// Lesson Builder Types
export type SourceRegistry = typeof sourceRegistry.$inferSelect;
export type InsertSourceRegistry = z.infer<typeof insertSourceRegistrySchema>;
export type TaxonomyTerm = typeof taxonomyTerms.$inferSelect;
export type InsertTaxonomyTerm = z.infer<typeof insertTaxonomyTermSchema>;
export type SourceTaxonomyMapping = typeof sourceTaxonomyMappings.$inferSelect;
export type InsertSourceTaxonomyMapping = z.infer<typeof insertSourceTaxonomyMappingSchema>;
export type LessonPackage = typeof lessonPackages.$inferSelect;
export type InsertLessonPackage = z.infer<typeof insertLessonPackageSchema>;
export type LessonSlide = typeof lessonSlides.$inferSelect;
export type InsertLessonSlide = z.infer<typeof insertLessonSlideSchema>;
export type LessonItem = typeof lessonItems.$inferSelect;
export type InsertLessonItem = z.infer<typeof insertLessonItemSchema>;
export type LessonCitation = typeof lessonCitations.$inferSelect;
export type InsertLessonCitation = z.infer<typeof insertLessonCitationSchema>;
export type LessonQaResult = typeof lessonQaResults.$inferSelect;
export type InsertLessonQaResult = z.infer<typeof insertLessonQaResultSchema>;
export type SourceArchiveImport = typeof sourceArchiveImports.$inferSelect;
export type InsertSourceArchiveImport = z.infer<typeof insertSourceArchiveImportSchema>;
export type SourceArchiveFile = typeof sourceArchiveFiles.$inferSelect;
export type InsertSourceArchiveFile = z.infer<typeof insertSourceArchiveFileSchema>;
export type LessonGenerationRun = typeof lessonGenerationRuns.$inferSelect;
export type InsertLessonGenerationRun = z.infer<typeof insertLessonGenerationRunSchema>;
export type LessonPackageArtifact = typeof lessonPackageArtifacts.$inferSelect;
export type InsertLessonPackageArtifact = z.infer<typeof insertLessonPackageArtifactSchema>;
export type LessonContractValidation = typeof lessonContractValidations.$inferSelect;
export type InsertLessonContractValidation = z.infer<typeof insertLessonContractValidationSchema>;
export type LessonPackageReview = typeof lessonPackageReviews.$inferSelect;
export type InsertLessonPackageReview = z.infer<typeof insertLessonPackageReviewSchema>;
export type LessonAssignment = typeof lessonAssignments.$inferSelect;
export type InsertLessonAssignment = z.infer<typeof insertLessonAssignmentSchema>;
export type LessonAssignmentLearner = typeof lessonAssignmentLearners.$inferSelect;
export type InsertLessonAssignmentLearner = z.infer<typeof insertLessonAssignmentLearnerSchema>;
export type LessonLearnerEvent = typeof lessonLearnerEvents.$inferSelect;
export type InsertLessonLearnerEvent = z.infer<typeof insertLessonLearnerEventSchema>;
export type LessonReleaseAuditEvent = typeof lessonReleaseAuditEvents.$inferSelect;
export type InsertLessonReleaseAuditEvent = z.infer<typeof insertLessonReleaseAuditEventSchema>;

export type RateLimitEntry = typeof rateLimitEntries.$inferSelect;
export type InsertRateLimitEntry = {
  email: string;
  requestCount?: number;
  windowStart?: Date;
  expiresAt: Date;
};

// Search result types for RAG system
export type ChunkSearchResult = DocumentChunk & {
  document?: Document;
  score?: number;
  highlights?: string[];
};

// ==================== Curriculum Catalog Tables ====================

export const textbooks = pgTable("textbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  publisher: text("publisher").notNull(),
  edition: text("edition"),
  isbn: text("isbn"),
  primarySubject: text("primary_subject"), // 'Fundamentals', 'Med-Surg', 'Pharmacology', etc.
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const textbookChapters = pgTable("textbook_chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  textbookId: varchar("textbook_id").notNull().references(() => textbooks.id, { onDelete: "cascade" }),
  chapterNumber: text("chapter_number").notNull(), // e.g., "1", "2A"
  title: text("title").notNull(),
  subjectTag: text("subject_tag"), // e.g., 'Med-Surg', 'Pharmacology'
  nclexCategoryTag: text("nclex_category_tag"), // e.g., 'Physiological Adaptation'
  url: text("url"), // e.g., 'https://wtcs.pressbooks.pub/populationhealth/chapter/...'
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const textbookSections = pgTable("textbook_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => textbookChapters.id, { onDelete: "cascade" }),
  sectionNumber: text("section_number"), // e.g., "1.1", "2A.3"
  title: text("title").notNull(),
  subjectTag: text("subject_tag"),
  nclexCategoryTag: text("nclex_category_tag"),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chapterTopicMappings = pgTable("chapter_topic_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").references(() => textbookChapters.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id").references(() => textbookSections.id, { onDelete: "cascade" }),
  nursingTopicId: varchar("nursing_topic_id").references(() => nursingTopics.id),
  contentAreaId: varchar("content_area_id").references(() => contentAreas.id),
  subject: text("subject"), // 'Med-Surg', 'Pharmacology', 'Fundamentals', etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subject-to-NCLEX alignment pre-seed table
export const subjectNclexAlignment = pgTable("subject_nclex_alignment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull().unique(),
  primaryNclexCategory: text("primary_nclex_category").notNull(),
  secondaryNclexCategories: jsonb("secondary_nclex_categories").$type<string[]>().default([]),
  description: text("description"),
});

// Textbook catalog insert schemas
export const insertTextbookSchema = createInsertSchema(textbooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTextbook = z.infer<typeof insertTextbookSchema>;
export type Textbook = typeof textbooks.$inferSelect;

export const insertTextbookChapterSchema = createInsertSchema(textbookChapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTextbookChapter = z.infer<typeof insertTextbookChapterSchema>;
export type TextbookChapter = typeof textbookChapters.$inferSelect;

export const insertTextbookSectionSchema = createInsertSchema(textbookSections).omit({
  id: true,
  createdAt: true,
});
export type InsertTextbookSection = z.infer<typeof insertTextbookSectionSchema>;
export type TextbookSection = typeof textbookSections.$inferSelect;

export const insertChapterTopicMappingSchema = createInsertSchema(chapterTopicMappings).omit({
  id: true,
  createdAt: true,
});
export type InsertChapterTopicMapping = z.infer<typeof insertChapterTopicMappingSchema>;
export type ChapterTopicMapping = typeof chapterTopicMappings.$inferSelect;

// Textbook catalog relations
export const textbooksRelations = relations(textbooks, ({ many }) => ({
  chapters: many(textbookChapters),
}));

export const textbookChaptersRelations = relations(textbookChapters, ({ one, many }) => ({
  textbook: one(textbooks, {
    fields: [textbookChapters.textbookId],
    references: [textbooks.id],
  }),
  sections: many(textbookSections),
  topicMappings: many(chapterTopicMappings),
}));

export const textbookSectionsRelations = relations(textbookSections, ({ one, many }) => ({
  chapter: one(textbookChapters, {
    fields: [textbookSections.chapterId],
    references: [textbookChapters.id],
  }),
  topicMappings: many(chapterTopicMappings),
}));

export const chapterTopicMappingsRelations = relations(chapterTopicMappings, ({ one }) => ({
  chapter: one(textbookChapters, {
    fields: [chapterTopicMappings.chapterId],
    references: [textbookChapters.id],
  }),
  section: one(textbookSections, {
    fields: [chapterTopicMappings.sectionId],
    references: [textbookSections.id],
  }),
  nursingTopic: one(nursingTopics, {
    fields: [chapterTopicMappings.nursingTopicId],
    references: [nursingTopics.id],
  }),
  contentArea: one(contentAreas, {
    fields: [chapterTopicMappings.contentAreaId],
    references: [contentAreas.id],
  }),
}));

// ==================== Mental Health Nursing Curriculum Catalog ====================
// Populated from NUR2200 blueprint Excel — "NUR2200" is backend-only; display name is "Mental Health Nursing"

export const curriculumObjectives = pgTable("curriculum_objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseCode: text("course_code").notNull(), // NUR2200 — internal/backend only
  moduleDisplayName: text("module_display_name").notNull(), // Mental Health Nursing
  weekNo: integer("week_no"),
  objectiveId: text("objective_id").notNull().unique(), // e.g. W01-O01
  objectiveText: text("objective_text").notNull(),
  bloomLevel: text("bloom_level"), // Remember, Understand, Apply, Analyze, Evaluate, Create
  bloomKnowledge: text("bloom_knowledge"), // Conceptual, Procedural, Metacognitive, Factual
  ncjmmOperation: text("ncjmm_operation"), // Recognize Cues, Analyze Cues, Prioritize Hypotheses, etc.
  nclexCategory: text("nclex_category"),
  nclexSubcategory: text("nclex_subcategory"),
  topics: text("topics").array().default([]), // split from semicolon-separated Topic/Module Title
  atiChapters: text("ati_chapters"), // raw string from ATI_Textbook_Chapter(s)
  createdAt: timestamp("created_at").defaultNow(),
});

export const curriculumAssessments = pgTable("curriculum_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseCode: text("course_code").notNull(),
  assessmentId: text("assessment_id").notNull().unique(), // e.g. NUR2200-EX1
  assessmentName: text("assessment_name").notNull(),
  assessmentType: text("assessment_type"),
  weeksCovered: text("weeks_covered"),
  points: integer("points"),
  weightPercent: decimal("weight_percent", { precision: 5, scale: 2 }),
  isCumulative: boolean("is_cumulative").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const curriculumObjectiveAssessments = pgTable("curriculum_objective_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: text("objective_id").notNull(), // matches curriculumObjectives.objectiveId
  assessmentId: text("assessment_id").notNull(), // matches curriculumAssessments.assessmentId
  mapRole: text("map_role"), // Primary / Secondary
  createdAt: timestamp("created_at").defaultNow(),
});

export type CurriculumObjective = typeof curriculumObjectives.$inferSelect;
export type InsertCurriculumObjective = typeof curriculumObjectives.$inferInsert;
export type CurriculumAssessment = typeof curriculumAssessments.$inferSelect;
export type InsertCurriculumAssessment = typeof curriculumAssessments.$inferInsert;
export type CurriculumObjectiveAssessment = typeof curriculumObjectiveAssessments.$inferSelect;

// Re-export crosswalk schema tables for drizzle migration compatibility
export {
  nclexTopicCrosswalk,
  topicObjectivesCrosswalk,
  objectiveResourcesCrosswalk,
  atiNclexCrosswalk,
  performancePathCrosswalk,
  studyPathTemplates,
  learningObjectives,
  contentCoverageMatrix,
  crosswalkImportHistory,
  // Types
  type NclexTopicCrosswalk,
  type InsertNclexTopicCrosswalk,
  type TopicObjectivesCrosswalk,
  type InsertTopicObjectivesCrosswalk,
  type ObjectiveResourcesCrosswalk,
  type InsertObjectiveResourcesCrosswalk,
  type AtiNclexCrosswalk,
  type InsertAtiNclexCrosswalk,
  type PerformancePathCrosswalk,
  type InsertPerformancePathCrosswalk,
  type StudyPathTemplate,
  type InsertStudyPathTemplate,
  type ContentCoverageMatrix,
  type LearningObjective,
  type InsertLearningObjective,
  type CrosswalkImportHistory
} from "@shared/crosswalk-schema";
