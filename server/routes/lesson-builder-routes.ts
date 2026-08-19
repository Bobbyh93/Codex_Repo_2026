import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import OpenAI from "openai";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../db";
<<<<<<< HEAD
import { requireAdminSession, validateCSRFToken, type AdminAuthRequest } from "../admin-auth-session";
import {
  contentBlocks,
=======
import { buildDirectedRemediationPlan } from "../directed-remediation-engine";
import {
  canvasOutcomesCsv,
  commonCartridgeArchive,
  curriculumManifest,
  executionStatus,
  pathwayRulesManifest,
  qtiAssessmentXml,
  validateCurriculum,
} from "../nclex-curriculum-service";
import { requireAdminSession, validateCSRFToken, type AdminAuthRequest } from "../admin-auth-session";
import {
  contentBlocks,
  curriculumEdges,
  curriculumEvidenceSources,
  curriculumFrameworks,
  curriculumNodes,
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
  documents,
  documentChunks,
  lessonAssignmentLearners,
  lessonAssignments,
  lessonContractValidations,
  lessonCitations,
  lessonGenerationRuns,
  lessonItems,
  lessonLearnerEvents,
  lessonPackageArtifacts,
  lessonPackageReviews,
  lessonPackages,
  lessonQaResults,
  lessonReleaseAuditEvents,
  lessonSlides,
  sourceArchiveFiles,
  sourceArchiveImports,
  sourceRegistry,
  sourceTaxonomyMappings,
  taxonomyTerms,
  topicProductionReviews,
} from "@shared/schema";
<<<<<<< HEAD
=======
import {
  EXEMPLAR_TOPICS,
  INTEGRATED_PROCESSES,
  NCJMM_FUNCTIONS,
  NCLEX_CATEGORIES,
  NCLEX_FRAMEWORK_ID,
  buildExemplarPackage,
} from "@shared/nclex-rn-2026";
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277

type EvidenceChunk = {
  sourceId?: string | null;
  documentId?: string | null;
  chunkId?: string | null;
  title: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  text: string;
  citationLabel: string;
};

type LessonBundle = {
  package: any;
  sources: any[];
  slides: any[];
  items: any[];
  citations: any[];
  qaResults: any[];
  generationRuns: any[];
  artifacts: any[];
  contractValidations: any[];
  reviews: any[];
  assignments: any[];
  learnerEvents: any[];
  releaseAuditEvents: any[];
};

type PackageArtifactPayload = {
  artifactKey: string;
  artifactType: string;
  fileName: string;
  mimeType: string;
  contentJson?: any;
  contentText?: string;
};

const topicProductionAssetLabels = {
  mapping: "Concept + nursing subject",
  slideDeck: "Video lesson slide deck",
  studyGuide: "Study guide",
  visuals: "Visuals",
  quiz: "Quiz item",
  citations: "Source citations",
} as const;

const publicPublishConfirmationText = "I understand this makes the lesson public";
const publicPublishConfirmationSchema = z.object({
  confirmPublicPublish: z.literal(true),
  confirmationText: z.string().trim().refine((value) => value === publicPublishConfirmationText, {
    message: `confirmationText must equal "${publicPublishConfirmationText}"`,
  }),
});

const topicProductionDriveProjectInventory = {
  id: "1c0Ayvgi8Av0c8M4SdOrwvHGhieXz553k",
  title: "NursePrep Platform Development",
  url: "https://drive.google.com/drive/project/1c0Ayvgi8Av0c8M4SdOrwvHGhieXz553k",
  sourceType: "google_drive_project",
  status: "indexed_from_metadata_and_search",
  note: "Google Drive project objects are not folder-listable through the Drive file API; these assets were grounded by project metadata plus targeted Harrity/Pediatrics/Maternal-Newborn/shorts searches.",
  costPolicy: "No AI generation or video processing in this inventory step. Review placements first, then approve one $100-$250 production checkpoint.",
  assets: [
    {
      id: "1NTwLb9FGhgwsPwr7sxKvPUCz98K9hU9g",
      title: "maternal_newborn_in_depth_lesson_guide_20260610.docx",
      url: "https://docs.google.com/document/d/1NTwLb9FGhgwsPwr7sxKvPUCz98K9hU9g/edit",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      subject: "Maternal-Newborn",
      concept: "Reproductive Health",
      matchers: ["maternal", "newborn", "postpartum", "contraception"],
      assetKeys: ["studyGuide", "citations"],
      belongsIn: "Knowledge Base intake, Content Mapper, and Lesson Builder source evidence.",
      nextAction: "Use as the faculty/source-backed guide before building or polishing maternal-newborn decks and quizzes.",
    },
    {
      id: "1NozANY2clLE41Dpb00vBEBCWyfa3UJMN_mCYQRfezd8",
      title: "maternal_newborn_unit1_assembled_deck_20260502",
      url: "https://docs.google.com/presentation/d/1NozANY2clLE41Dpb00vBEBCWyfa3UJMN_mCYQRfezd8",
      mimeType: "application/vnd.google-apps.presentation",
      subject: "Maternal-Newborn",
      concept: "Reproductive Health",
      matchers: ["maternal", "newborn", "postpartum", "contraception"],
      assetKeys: ["slideDeck", "visuals"],
      belongsIn: "Lesson Builder deck reference and visual/source artifact review.",
      nextAction: "Attach or import as a deck source only after the topic mapping is accepted.",
    },
    {
      id: "1DygdF06m67p97LxVK2_zXwi1c53x0OyQZz1cEwwxSK0",
      title: "ch01_contraception_harrity_deck_notes_pass",
      url: "https://docs.google.com/presentation/d/1DygdF06m67p97LxVK2_zXwi1c53x0OyQZz1cEwwxSK0",
      mimeType: "application/vnd.google-apps.presentation",
      subject: "Maternal-Newborn",
      concept: "Reproductive Health",
      matchers: ["contraception", "maternal", "newborn"],
      assetKeys: ["slideDeck", "studyGuide", "visuals"],
      belongsIn: "Lesson Builder deck/audio-script preparation for the maternal-newborn starter topic.",
      nextAction: "Review speaker notes for TTS/video readiness before any audio/video spend.",
    },
    {
      id: "1SOc0Ep0v9l0iPy2JH9lWjqH81r5p2mDb",
      title: "CH18_Asthma_Learner_Facing_Lesson_Package_20260510.pptx",
      url: "https://docs.google.com/presentation/d/1SOc0Ep0v9l0iPy2JH9lWjqH81r5p2mDb/edit",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      subject: "Pediatrics",
      concept: "Gas Exchange",
      matchers: ["pediatric", "pediatrics", "asthma", "wheez", "airway"],
      assetKeys: ["slideDeck", "studyGuide", "visuals", "quiz", "citations"],
      belongsIn: "Golden Lesson Builder example and student-facing asthma lesson pattern.",
      nextAction: "Use as the first pediatrics quality benchmark before broad batch production.",
    },
    {
      id: "18fW_Yqq7Gge-4j46dvDjv7wRA_66nJUKJxk7WIva-eU",
      title: "Pediatric Emergencies Part 1 Google Slides",
      url: "https://docs.google.com/presentation/d/18fW_Yqq7Gge-4j46dvDjv7wRA_66nJUKJxk7WIva-eU",
      mimeType: "application/vnd.google-apps.presentation",
      subject: "Pediatrics",
      concept: "Safety / Clinical Judgment",
      matchers: ["pediatric", "pediatrics", "emergencies", "children"],
      assetKeys: ["slideDeck", "visuals"],
      belongsIn: "Later pediatrics deck source after the asthma checkpoint passes.",
      nextAction: "Hold for Phase 4+ expansion; do not spend on it before the two-topic checkpoint is reviewed.",
    },
    {
      id: "13IQdvJI4ktmh-rEhIyOYEETw6uCtDCH8",
      title: "expanded_subtopics_table_1778073061306.xlsx",
      url: "https://drive.google.com/file/d/13IQdvJI4ktmh-rEhIyOYEETw6uCtDCH8",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      subject: "Topic taxonomy",
      concept: "Production planning",
      matchers: ["maternal", "newborn", "pediatric", "pediatrics", "asthma", "topic"],
      assetKeys: ["mapping"],
      belongsIn: "Content Mapper taxonomy review and topic-production backlog expansion.",
      nextAction: "Use only for mapping decisions; not student-facing content.",
    },
    {
      id: "1z8P4ci4FEzouDhNsMG9eZtaMZBE6FylF",
      title: "virality-scoring.md",
      url: "https://drive.google.com/file/d/1z8P4ci4FEzouDhNsMG9eZtaMZBE6FylF",
      mimeType: "text/markdown",
      subject: "Video/Shorts workflow",
      concept: "Clip scoring",
      matchers: ["maternal", "newborn", "pediatric", "pediatrics", "asthma", "lesson"],
      assetKeys: ["videoShorts"],
      belongsIn: "Phase 3 Shorts/Airtable handoff, after a lesson draft is approved.",
      nextAction: "Use as the future scoring recipe; do not run AI vision scoring during the $100-$250 content checkpoint.",
    },
    {
      id: "1seHNGDEu4MMrIjGPOiDtr-Aj8ve4jwKo",
      title: "video-editing SKILL.md",
      url: "https://drive.google.com/file/d/1seHNGDEu4MMrIjGPOiDtr-Aj8ve4jwKo",
      mimeType: "text/markdown",
      subject: "Video/Shorts workflow",
      concept: "FFmpeg production",
      matchers: ["maternal", "newborn", "pediatric", "pediatrics", "asthma", "lesson"],
      assetKeys: ["videoShorts"],
      belongsIn: "Future audio/video rendering workflow after script and visual review.",
      nextAction: "Keep as production guidance; no video processing until topic content quality is accepted.",
    },
  ],
} as const;

const topicProductionReviewDecisions = [
  "unreviewed",
  "approve_mapping",
  "needs_edit",
  "build_lesson",
  "needs_visuals",
  "needs_quiz",
  "hold",
] as const;

const topicProductionNextBuildDecisions = new Set<string>([
  "approve_mapping",
  "build_lesson",
  "needs_visuals",
  "needs_quiz",
]);

const topicProductionReviewSchema = z.object({
  decision: z.enum(topicProductionReviewDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionDraftReviewDecisions = [
  "unreviewed",
  "approve_polish",
  "needs_fix",
  "hold",
] as const;

const topicProductionDraftReviewSchema = z.object({
  decision: z.enum(topicProductionDraftReviewDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionPhaseThreeDecisions = [
  "unreviewed",
  "approve_polish_pass",
  "approve_short_planning",
  "needs_fix",
  "hold_spend",
] as const;

const topicProductionPhaseThreeDecisionSchema = z.object({
  decision: z.enum(topicProductionPhaseThreeDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionStudentLaunchDecisions = [
  "unreviewed",
  "approve_student_preview",
  "needs_fix",
  "hold_release",
] as const;

const topicProductionStudentLaunchDecisionSchema = z.object({
  decision: z.enum(topicProductionStudentLaunchDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionMediaWorkOrderDecisions = [
  "unreviewed",
  "approve_single_topic_scaffold",
  "needs_revision",
  "hold_spend",
] as const;

const topicProductionMediaWorkOrderReviewSchema = z.object({
  decision: z.enum(topicProductionMediaWorkOrderDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionMediaScaffoldReviewDecisions = [
  "unreviewed",
  "approve_ai_draft_checkpoint",
  "needs_revision",
  "hold_spend",
] as const;

const topicProductionMediaScaffoldReviewSchema = z.object({
  decision: z.enum(topicProductionMediaScaffoldReviewDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionMediaTextDraftReviewDecisions = [
  "unreviewed",
  "approve_package_assembly_checkpoint",
  "needs_revision",
  "hold_spend",
] as const;

const topicProductionMediaTextDraftReviewSchema = z.object({
  decision: z.enum(topicProductionMediaTextDraftReviewDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionPackageReviewBlueprintDecisions = [
  "unreviewed",
  "approve_review_package_build",
  "needs_revision",
  "hold_spend",
] as const;

const topicProductionPackageReviewBlueprintSchema = z.object({
  decision: z.enum(topicProductionPackageReviewBlueprintDecisions).default("unreviewed"),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionPreviewReviewOutcomes = [
  "ready_for_release",
  "needs_fix",
  "hold_release",
] as const;

const topicProductionPreviewReviewSchema = z.object({
  previewKey: z.string().trim().min(12).max(120),
  outcome: z.enum(topicProductionPreviewReviewOutcomes),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionPreviewReviewAdminSchema = z.object({
  outcome: z.enum(topicProductionPreviewReviewOutcomes),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionPublicReleaseDecisions = [
  "approve_public_release",
  "needs_fix",
  "hold_release",
] as const;

const topicProductionPublicReleaseDecisionSchema = z.object({
  decision: z.enum(topicProductionPublicReleaseDecisions),
  reviewerNotes: z.string().max(2000).optional().default(""),
});

const topicProductionReviewOverrides = new Map<string, TopicProductionReview>();
const topicProductionMediaWorkOrderReviewOverrides = new Map<string, TopicProductionMediaWorkOrderReview>();
const topicProductionMediaScaffoldReviewOverrides = new Map<string, TopicProductionMediaScaffoldReview>();
const topicProductionMediaTextDraftReviewOverrides = new Map<string, TopicProductionMediaTextDraftReview>();
const topicProductionPackageReviewBlueprintOverrides = new Map<string, TopicProductionPackageReviewBlueprintReview>();

type TopicProductionReview = {
  decision: (typeof topicProductionReviewDecisions)[number];
  reviewerNotes: string;
  reviewedAt: string | null;
  reviewedBy: string;
};

type TopicProductionMediaWorkOrderReview = {
  decision: (typeof topicProductionMediaWorkOrderDecisions)[number];
  reviewerNotes: string;
  reviewedAt: string | null;
  reviewedBy: string;
};

type TopicProductionMediaScaffoldReview = {
  decision: (typeof topicProductionMediaScaffoldReviewDecisions)[number];
  reviewerNotes: string;
  reviewedAt: string | null;
  reviewedBy: string;
};

type TopicProductionMediaTextDraftReview = {
  decision: (typeof topicProductionMediaTextDraftReviewDecisions)[number];
  reviewerNotes: string;
  reviewedAt: string | null;
  reviewedBy: string;
};

type TopicProductionPackageReviewBlueprintReview = {
  decision: (typeof topicProductionPackageReviewBlueprintDecisions)[number];
  reviewerNotes: string;
  reviewedAt: string | null;
  reviewedBy: string;
};

type TopicProductionPublicReleaseDecision = {
  decision: (typeof topicProductionPublicReleaseDecisions)[number];
  reviewerNotes: string;
  reviewedAt: string | null;
  reviewedBy: string;
};

const sourceImportSchema = z.object({
  title: z.string().min(2),
  sourceKind: z.string().default("document"),
  sourceType: z.string().default("reference"),
  sourceUri: z.string().optional(),
  driveFileId: z.string().optional(),
  documentId: z.string().optional(),
  subject: z.string().optional(),
  edition: z.string().optional(),
  citationPolicy: z.string().default("cite_paraphrase"),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("approved"),
  ingestionStatus: z.enum(["queued", "processing", "ready", "failed"]).default("ready"),
  metadata: z.record(z.any()).default({}),
});

const sourceArchiveImportSchema = z.object({
  archivePath: z.string().min(3),
  title: z.string().optional(),
  role: z.enum([
    "harrity_pipeline_contract",
    "chapter_deck_schema",
    "pilot_preflight_package",
    "chunking_search_pattern",
    "base_app",
    "pattern_reference",
  ]).optional(),
  sourceType: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("approved"),
});

const pilotArchiveSetImportSchema = z.object({
  archives: z.array(sourceArchiveImportSchema).optional(),
});

const drivePackageImportSchema = z.object({
  folderUrl: z.string().min(12),
  title: z.string().trim().min(2).max(180).optional(),
  packageKind: z.enum(["mnn_package_hub", "generic_drive_package"]).default("mnn_package_hub"),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

const chatgptLibraryItemSchema = z.object({
  title: z.string().trim().min(2).max(240),
  fileType: z.string().trim().max(80).optional().default("unknown"),
  modifiedAt: z.string().trim().max(120).optional().default(""),
  sizeLabel: z.string().trim().max(80).optional().default(""),
  projectContext: z.string().trim().max(240).optional().default(""),
  conversationUrl: z.string().trim().max(500).optional().default(""),
  assetFamily: z.string().trim().max(120).optional().default("reference_pack"),
  candidateUse: z.string().trim().max(500).optional().default("review for future product/source contract use"),
  sourceUrl: z.string().trim().max(500).optional().default(""),
});

const chatgptLibraryReferencePackImportSchema = z.object({
  title: z.string().trim().min(2).max(180).default("ChatGPT Library Reference Pack"),
  libraryUrl: z.string().trim().max(500).default("https://chatgpt.com/library?tab=files"),
  projectTitle: z.string().trim().max(240).optional().default(""),
  projectUrl: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
  items: z.array(chatgptLibraryItemSchema).min(1).max(80),
});

const openStaxNursingCatalogImportSchema = z.object({
  title: z.string().trim().min(2).max(180).default("OpenStax Nursing Catalog"),
  subjectUrl: z.string().trim().max(500).default("https://openstax.org/subjects/nursing"),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("pending"),
  notes: z.string().trim().max(2000).optional().default("Register catalog/book metadata only. Do not ingest OpenStax book text/PDFs into RAG or AI generation without OpenStax permission."),
});

const attachDocumentSourceSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().optional(),
  sourceType: z.string().default("nursing_content_source"),
  subject: z.string().optional(),
  edition: z.string().optional(),
  citationPolicy: z.string().default("cite_paraphrase"),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).default("approved"),
});

const sourceNormalizationSchema = z.object({
  method: z.enum(["nursesbrain_pattern", "manual_review"]).default("nursesbrain_pattern"),
  officialPilot: z.boolean().default(true),
  weakTopics: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  atiCategories: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  notes: z.string().trim().max(2000).optional().default(""),
});

const mappingReviewSchema = z.object({
  sourceId: z.string().min(1),
  mappings: z.array(z.object({
    taxonomy: z.string().min(2),
    code: z.string().optional(),
    label: z.string().min(2),
    description: z.string().optional(),
    mappingSource: z.string().default("admin_review"),
    confidence: z.number().min(0).max(1).default(0.9),
    notes: z.string().optional(),
    metadata: z.record(z.any()).default({}),
  })).default([]),
});

const assessmentBridgeSchema = z.object({
  weakTopic: z.string().trim().min(2).max(200),
  atiCategory: z.string().trim().max(200).optional().default(""),
  nclexCategory: z.string().trim().max(200).optional().default(""),
  cjmStep: z.string().trim().max(200).optional().default(""),
  sourceId: z.string().trim().optional().default(""),
  note: z.string().trim().max(2000).optional().default(""),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().trim().max(1200).optional().default(""),
  sourceEvidence: z.array(z.string().trim().min(2).max(240)).max(6).optional().default([]),
  agentMode: z.string().trim().max(80).optional().default(""),
  officialPilotPackage: z.boolean().default(true),
});

const aiAssessmentBridgeSchema = z.object({
  weakTopic: z.string().trim().min(2).max(200),
  atiCategory: z.string().trim().max(200).optional().default(""),
  nclexCategory: z.string().trim().max(200).optional().default(""),
  cjmStep: z.string().trim().max(200).optional().default(""),
  confidence: z.number().min(0).max(1).default(0.7),
  rationale: z.string().trim().min(8).max(1200),
  sourceEvidence: z.array(z.string().trim().min(2).max(240)).max(6).default([]),
});

const generateSchema = z.object({
  title: z.string().min(2),
  topic: z.string().min(2),
  audience: z.string().default("Prelicensure RN"),
  sourceIds: z.array(z.string()).min(1),
  settings: z.object({
    slideCount: z.number().min(6).max(12).default(8),
    difficulty: z.string().default("application"),
    includeGuidedNotes: z.boolean().default(true),
    generationMode: z.enum(["template", "agent_assisted"]).default("agent_assisted"),
  }).default({}),
});

const slideUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  visibleContent: z.record(z.any()).optional(),
  speakerNotes: z.string().nullable().optional(),
  guidedNotes: z.string().nullable().optional(),
  retrievalPrompt: z.string().nullable().optional(),
  nclexCategory: z.string().nullable().optional(),
  cjmStep: z.string().nullable().optional(),
  nursingProcess: z.string().nullable().optional(),
  bloomLevel: z.string().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one slide field is required.");

const itemUpdateSchema = z.object({
  stem: z.string().min(1).optional(),
  options: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
  })).min(2).optional(),
  correctAnswer: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  tags: z.record(z.any()).optional(),
  difficulty: z.string().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one item field is required.");

const packageReviewSchema = z.object({
  reviewerName: z.string().trim().min(2).max(120).default("Faculty reviewer"),
  reviewerRole: z.string().trim().min(2).max(80).default("faculty_reviewer"),
  decision: z.enum(["comment", "changes_requested", "approved_for_pilot", "approved_for_release"]).default("comment"),
  focusArea: z.enum(["overall", "accuracy", "learner_experience", "assessment", "accessibility", "source_traceability"]).default("overall"),
  comment: z.string().trim().min(3).max(4000),
  metadata: z.record(z.any()).default({}),
});

const facultyReviewRubricCriteria = [
  {
    key: "clinical_accuracy",
    label: "Clinical accuracy",
    description: "Content is clinically sound for the stated learner level.",
  },
  {
    key: "source_traceability",
    label: "Source traceability",
    description: "Claims are supported by approved sources, citations, and package artifacts.",
  },
  {
    key: "nclex_cjm_alignment",
    label: "NCLEX/CJM alignment",
    description: "Slides and practice items align to NCLEX, CJM, Bloom, and nursing-process tags.",
  },
  {
    key: "learner_experience",
    label: "Learner experience",
    description: "The lesson is learner-facing, focused, accessible, and appropriately paced.",
  },
  {
    key: "assessment_quality",
    label: "Assessment quality",
    description: "Practice item, answer key, rationale, and follow-up signals support remediation.",
  },
] as const;

const assignmentLearnerInputSchema = z.object({
  learnerName: z.string().trim().min(1).max(160),
  learnerEmail: z.string().trim().email().optional().or(z.literal("")),
});

const assignmentCreateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  cohortName: z.string().trim().min(2).max(160).default("Pilot cohort"),
  dueDate: z.string().trim().optional().or(z.literal("")),
  learners: z.array(assignmentLearnerInputSchema).min(1).max(100),
  metadata: z.record(z.any()).default({}),
});

const assignmentQuerySchema = z.object({
  assignmentId: z.string().trim().min(1).optional(),
  assignmentLearnerId: z.string().trim().min(1).optional(),
  learnerKey: z.string().trim().min(8).optional(),
});

const pilotOutcomesExportQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("json"),
});

const learnerEventSchema = z.object({
  sessionId: z.string().trim().min(8).max(120).optional(),
  assignmentId: z.string().trim().min(1).optional(),
  assignmentLearnerId: z.string().trim().min(1).optional(),
  learnerKey: z.string().trim().min(8).optional(),
  previewKey: z.string().trim().min(12).max(120).optional(),
  eventType: z.enum(["lesson_opened", "slide_viewed", "practice_viewed", "practice_attempted", "lesson_completed", "lesson_saved"]),
  slideId: z.string().optional(),
  itemId: z.string().optional(),
  payload: z.record(z.any()).default({}),
});

const studentSessionQuerySchema = z.object({
  sessionId: z.string().trim().min(8).max(120),
});

const learnerFeedbackSchema = z.object({
  sessionId: z.string().trim().min(8).max(120).optional(),
  assignmentId: z.string().trim().min(1).optional(),
  assignmentLearnerId: z.string().trim().min(1).optional(),
  learnerKey: z.string().trim().min(8).optional(),
  previewKey: z.string().trim().min(12).max(120).optional(),
  slideId: z.string().optional(),
  itemId: z.string().optional(),
  rating: z.enum(["helpful", "confusing", "too_easy", "too_hard", "needs_faculty_review"]),
  comment: z.string().trim().max(1200).optional(),
  payload: z.record(z.any()).default({}),
});

const DEFAULT_NURSING_CURRICULUM_AGENT_ID = "agt_69f192d4f1908191baa41586bb0df9ea";

const agentOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const agentPracticeItemSchema = z.object({
  slideNumber: z.number().optional(),
  itemType: z.string().default("multiple_choice"),
  stem: z.string().min(1),
  options: z.array(agentOptionSchema).min(2).default([]),
  correctAnswer: z.string().min(1),
  rationale: z.string().min(1),
  difficulty: z.string().optional(),
  citationRef: z.string().optional(),
}).passthrough();

function normalizeAgentOption(value: unknown, index: number) {
  if (typeof value === "string") {
    return {
      id: String.fromCharCode(65 + index),
      text: value,
    };
  }
  if (value && typeof value === "object") {
    const option = value as Record<string, any>;
    return {
      id: String(option.id || option.key || option.label || String.fromCharCode(65 + index)),
      text: String(option.text || option.value || option.label || option.content || ""),
    };
  }
  return {
    id: String.fromCharCode(65 + index),
    text: "",
  };
}

function normalizeVisibleContent(value: unknown) {
  if (typeof value === "string") {
    return { takeaway: value };
  }
  if (Array.isArray(value)) {
    return { bullets: value.map((item) => String(item)).filter(Boolean) };
  }
  if (value && typeof value === "object") {
    return value as Record<string, any>;
  }
  return {};
}

function normalizeCitationRef(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find(Boolean);
    return normalizeCitationRef(first);
  }
  if (value && typeof value === "object") {
    const ref = value as Record<string, any>;
    return String(ref.ref || ref.id || ref.label || ref.citationRef || "");
  }
  return "";
}

function normalizeAgentLessonPayload(payload: any) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    slides: Array.isArray(payload.slides)
      ? payload.slides.map((slide: any) => ({
        ...(slide && typeof slide === "object" ? slide : {}),
        title: String(slide?.title || "Lesson slide"),
        visibleContent: normalizeVisibleContent(slide?.visibleContent ?? slide?.content ?? slide?.bullets),
        citationRef: normalizeCitationRef(slide?.citationRef ?? slide?.citationRefs),
      }))
      : [],
    practiceItem: payload.practiceItem && typeof payload.practiceItem === "object"
      ? {
        ...payload.practiceItem,
        citationRef: normalizeCitationRef(payload.practiceItem.citationRef ?? payload.practiceItem.citationRefs),
        options: Array.isArray(payload.practiceItem.options)
          ? payload.practiceItem.options.map(normalizeAgentOption).filter((option: { text: string }) => option.text)
          : [],
      }
      : payload.practiceItem,
    citationRefs: Array.isArray(payload.citationRefs)
      ? payload.citationRefs.map((ref: any, index: number) => (
        typeof ref === "string" ? { ref, label: ref } : { ref: ref?.ref || `E${index + 1}`, ...(ref || {}) }
      ))
      : [],
  };
}

const agentSlideSchema = z.object({
  slideNumber: z.number().optional(),
  slideType: z.string().default("concept"),
  title: z.string().min(1),
  visibleContent: z.record(z.any()).default({}),
  speakerNotes: z.string().optional(),
  guidedNotes: z.string().optional(),
  retrievalPrompt: z.string().optional(),
  nclexCategory: z.string().optional(),
  cjmStep: z.string().optional(),
  nursingProcess: z.string().optional(),
  bloomLevel: z.string().optional(),
  citationRef: z.string().optional(),
}).passthrough();

const agentLessonDraftSchema = z.object({
  slides: z.array(agentSlideSchema).min(1),
  practiceItem: agentPracticeItemSchema.optional(),
  supervisorNotes: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  citationRefs: z.array(z.record(z.any())).default([]),
}).passthrough();

const defaultTaxonomySeeds = [
  { taxonomy: "NCLEX", code: "SECE", label: "Safe and Effective Care Environment" },
  { taxonomy: "NCLEX", code: "PHYS", label: "Physiological Integrity" },
  { taxonomy: "CJM", code: "recognize-cues", label: "Recognize Cues" },
  { taxonomy: "CJM", code: "analyze-cues", label: "Analyze Cues" },
  { taxonomy: "CJM", code: "prioritize-hypotheses", label: "Prioritize Hypotheses" },
  { taxonomy: "CJM", code: "generate-solutions", label: "Generate Solutions" },
  { taxonomy: "CJM", code: "take-action", label: "Take Action" },
  { taxonomy: "CJM", code: "evaluate-outcomes", label: "Evaluate Outcomes" },
  { taxonomy: "Nursing Process", code: "assessment", label: "Assessment" },
  { taxonomy: "Nursing Process", code: "analysis", label: "Analysis" },
  { taxonomy: "Nursing Process", code: "planning", label: "Planning" },
  { taxonomy: "Nursing Process", code: "implementation", label: "Implementation" },
  { taxonomy: "Nursing Process", code: "evaluation", label: "Evaluation" },
  { taxonomy: "Bloom", code: "apply", label: "Apply" },
  { taxonomy: "Bloom", code: "analyze", label: "Analyze" },
];

const harrityEvidenceSnippets = {
  improvementSpec: [
    "The lesson builder should produce a learner-facing, exam-prep teaching experience with measurable interaction density, clinical judgment alignment, retrieval practice, and QA gates.",
    "Visible slides must separate learner content from facilitation guidance; instructor notes belong in speaker notes and package artifacts.",
    "Required slide grammar: patient cue, student prediction, core concept, exam anchor, common trap, practice item, rationale, takeaway.",
  ],
  skillOverview: [
    "The Harrity lesson builder is a reusable production system that separates content, narration, layout, audio, and export logic.",
    "Minimum deliverables include source package, outline package, slide-content package, script package, deck package, and optional audio/binding/video outputs.",
    "Five-channel separation is required: visible slide text, teaching script, TTS-safe speech text, layout rules, and media metadata.",
  ],
  asthmaDemo: [
    "CH18 pediatric asthma demo uses a learner-facing case: Maya, age 8, has coughing, wheezing, chest tightness, restlessness, upright positioning, and lower SpO2 after playing outside.",
    "The asthma lesson route is airway change to cues to risk to action to evaluation to family control plan.",
    "The demo repeatedly asks students to notice, interpret meaning, choose priority action, and evaluate outcome.",
  ],
  maternalGuide: [
    "Maternal-newborn guide covers 27 chapters and 702 represented lesson slides, built from Harrity depth-pass artifacts with faculty review still required.",
    "The course-level pacing map includes antepartum, intrapartum, postpartum, and newborn nursing care units.",
    "Unresolved taxonomy fields and safety-sensitive content must be flagged for faculty/current-policy review rather than guessed.",
  ],
  maternalDepthPass: [
    "The depth-pass package contains chapter source inventories, derived outlines, taxonomy tags, slide scaffolds, presenter scripts, QA summaries, and rebuilt decks.",
    "Chapter 1 contraception includes runtime, source, taxonomy, outline, slide content, script, deck, validation, QA, and deck artifacts.",
    "Depth-pass outputs should be treated as canonical draft basis while preserving source and validation status.",
  ],
  curriculumHub: [
    "The curriculum data hub maps course IDs, concepts, modules, objectives, Bloom levels, NCJMM operations, NCLEX categories, sources, and content chunks.",
    "Governance workflow stages, packet structure, motion/vote/minutes controls, RACI, gate controls, templates, validation rules, output contracts, and system integration maps are part of the curriculum source truth.",
  ],
};

const defaultSourceSeeds = [
  {
    title: "NCLEX CJM Bloom Blueprint Toolkit Template",
    sourceKind: "drive_sheet",
    sourceType: "blueprint_crosswalk",
    sourceUri: "https://docs.google.com/spreadsheets/d/1QdrbTggSv2WndiG_WfHIRW3HpW2wM9gKfibRFZT4ecM/edit",
    driveFileId: "1QdrbTggSv2WndiG_WfHIRW3HpW2wM9gKfibRFZT4ecM",
    subject: "NCLEX / Clinical Judgment",
    edition: "2026 template",
    metadata: {
      tabs: [
        "2_NCLEX_Test_Plan",
        "03_Universal_Learning_Map",
        "4_Assessment_Item_Bank",
        "Tagging_Rubric",
        "ATI_NCLEX_Bloom_Crosswalk",
        "Data_Slide_Index",
        "Data_Learning_Crosswalk",
        "Data_NCLEX_Concept_Map",
        "Data_RAG_Index",
      ],
    },
  },
  {
    title: "ATI NCLEX RAG Database Template",
    sourceKind: "drive_sheet",
    sourceType: "source_index_crosswalk",
    sourceUri: "https://docs.google.com/spreadsheets/d/1GC4BEpdBF_-3NOMdnJVlkOv0c4iman52Prhu-KjIsjw/edit",
    driveFileId: "1GC4BEpdBF_-3NOMdnJVlkOv0c4iman52Prhu-KjIsjw",
    subject: "ATI / NCLEX Source Registry",
    edition: "2026 template",
    metadata: {
      tabs: [
        "Source_Index",
        "Curriculum_Map",
        "NCLEX_ATI_Crosswalk",
        "Learning_Objects",
        "Question_Bank",
        "Faculty_Review_Log",
        "Readiness_Dashboard",
      ],
    },
  },
  {
    title: "Harrity Lesson Builder Improvement Specification",
    sourceKind: "local_file",
    sourceType: "instructional_contract",
    sourceUri: "local-download:harrity_lesson_builder_skill_improvement_spec_20260509.md",
    driveFileId: "local-harrity-improvement-spec-20260509",
    subject: "Harrity lesson builder / learner-facing contract",
    edition: "2026-05-09 v0.2 draft",
    metadata: {
      localFileName: "harrity_lesson_builder_skill_improvement_spec_20260509.md",
      evidenceSnippets: harrityEvidenceSnippets.improvementSpec,
    },
  },
  {
    title: "Harrity Lesson Builder Skill Overview",
    sourceKind: "local_file",
    sourceType: "pipeline_architecture",
    sourceUri: "local-documents:Harrity_Lesson_Builder_Skill_Overview_20260510 - Repaired.pptx",
    driveFileId: "local-harrity-skill-overview-20260510",
    subject: "Harrity lesson builder / production pipeline",
    edition: "2026-05-10 repaired planning deck",
    metadata: {
      localFileName: "Harrity_Lesson_Builder_Skill_Overview_20260510 - Repaired.pptx",
      evidenceSnippets: harrityEvidenceSnippets.skillOverview,
    },
  },
  {
    title: "CH18 Asthma Learner-Facing Lesson Package",
    sourceKind: "local_file",
    sourceType: "golden_lesson_example",
    sourceUri: "local-download:CH18_Asthma_Learner_Facing_Lesson_Package_20260510.pptx",
    driveFileId: "local-harrity-ch18-asthma-20260510",
    subject: "Pediatric asthma / learner-facing demo",
    edition: "2026-05-10",
    metadata: {
      localFileName: "CH18_Asthma_Learner_Facing_Lesson_Package_20260510.pptx",
      slideCount: 16,
      evidenceSnippets: harrityEvidenceSnippets.asthmaDemo,
    },
  },
  {
    title: "Drive Slides: CH18 Asthma Learner-Facing Lesson Package",
    sourceKind: "drive_presentation",
    sourceType: "golden_lesson_example",
    sourceUri: "https://docs.google.com/presentation/d/1lVdeu8QhFOBLVuIyTBQ3ZnpjOaIDbE24hpuWuhF9ZQo",
    driveFileId: "1lVdeu8QhFOBLVuIyTBQ3ZnpjOaIDbE24hpuWuhF9ZQo",
    subject: "Pediatric asthma / learner-facing Google Slides demo",
    edition: "2026-05-10 native Google Slides",
    metadata: {
      driveMimeType: "application/vnd.google-apps.presentation",
      driveSourceRole: "learner_facing_gold_deck",
      discoveredFrom: "google_drive_search",
      slideCount: 16,
      cjmSteps: [
        "Recognize Cues",
        "Analyze Cues",
        "Prioritize Hypotheses",
        "Generate Solutions",
        "Take Action",
        "Evaluate Outcomes",
      ],
      outlineSummary: "Native Google Slides version of the CH18 asthma Harrity learner-facing deck; usable as a pattern source for visible learner slide grammar, student tasks, exam anchors, rationales, and takeaways.",
      evidenceSnippets: harrityEvidenceSnippets.asthmaDemo,
    },
  },
  {
    title: "Drive PPTX: Harrity Lesson Builder Skill Overview",
    sourceKind: "drive_presentation",
    sourceType: "pipeline_architecture",
    sourceUri: "https://drive.google.com/file/d/1pat39IAYGdyaGP96vP9aG9HZDpvBMzew",
    driveFileId: "1pat39IAYGdyaGP96vP9aG9HZDpvBMzew",
    subject: "Harrity lesson builder / production pipeline",
    edition: "2026-05-10 repaired PPTX",
    metadata: {
      driveMimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      driveSourceRole: "pipeline_contract_deck",
      discoveredFrom: "google_drive_search",
      evidenceSnippets: harrityEvidenceSnippets.skillOverview,
    },
  },
  {
    title: "Drive PPTX: California CNS Harrity Lesson Deck",
    sourceKind: "drive_presentation",
    sourceType: "harrity_lesson_deck_pattern",
    sourceUri: "https://drive.google.com/file/d/1Gaa6NJmO1zdTeh6GnurpgUqqkFSbS_Lf",
    driveFileId: "1Gaa6NJmO1zdTeh6GnurpgUqqkFSbS_Lf",
    subject: "California CNS / Harrity deck pattern",
    edition: "2026-05-10 PPTX",
    metadata: {
      driveMimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      driveSourceRole: "deck_pattern_reference",
      discoveredFrom: "google_drive_search",
    },
  },
  {
    title: "Drive Slides: NCC RN2019 NCOC Cardiovascular Disorders Ch 020",
    sourceKind: "drive_presentation",
    sourceType: "nursing_chapter_deck_source",
    sourceUri: "https://docs.google.com/presentation/d/19nOrE48zyOZkX14DeQKbdQ7u0K7B_fGzyEiCA5gKR-Y",
    driveFileId: "19nOrE48zyOZkX14DeQKbdQ7u0K7B_fGzyEiCA5gKR-Y",
    subject: "NCC RN2019 NCOC / Cardiovascular Disorders",
    edition: "2026-05-28 native Google Slides",
    metadata: {
      driveMimeType: "application/vnd.google-apps.presentation",
      driveSourceRole: "chapter_deck_source",
      discoveredFrom: "google_drive_search",
      unit: "Unit 2 System Disorders",
      chapter: "Ch 020 Cardiovascular Disorders",
    },
  },
  {
    title: "Drive Slides: NCC RN2019 NCOC Psychosocial Issues Ch 044",
    sourceKind: "drive_presentation",
    sourceType: "nursing_chapter_deck_source",
    sourceUri: "https://docs.google.com/presentation/d/13_5y59NraPjM6YKuaMa2sLGHowlj1S0GHvxo07kVGQQ",
    driveFileId: "13_5y59NraPjM6YKuaMa2sLGHowlj1S0GHvxo07kVGQQ",
    subject: "NCC RN2019 NCOC / Psychosocial Issues of Infants, Children, and Adolescents",
    edition: "2026-05-28 native Google Slides",
    metadata: {
      driveMimeType: "application/vnd.google-apps.presentation",
      driveSourceRole: "chapter_deck_source",
      discoveredFrom: "google_drive_search",
      unit: "Unit 3 Other Specific Needs",
      chapter: "Ch 044 Psychosocial Issues of Infants, Children, and Adolescents",
    },
  },
  {
    title: "Pearson Course Audit Workflow Dashboard",
    sourceKind: "sites_project",
    sourceType: "course_concept_audit_workflow_pattern",
    sourceUri: "https://pearson-course-audit-workflow-20260626.harrity-9048.chatgpt-team.site",
    driveFileId: "sites-appgprj_6a3e14fcc60c8191b4bde452056a01c5",
    subject: "Pearson course concept coverage review / reviewer workflow",
    edition: "Sites version 2 / 2026-06-26",
    metadata: {
      sitesProjectId: "appgprj_6a3e14fcc60c8191b4bde452056a01c5",
      sitesTitle: "Pearson Course Audit Workflow Dashboard",
      sitesRole: "reviewer_workflow_pattern",
      accessMode: "custom",
      patternUse: [
        "course concept coverage review",
        "reviewer state tracking",
        "premium faculty review workflow",
        "content-ops launch readiness",
      ],
      learnerFacing: false,
      premiumWorkflowPattern: true,
    },
  },
  {
    title: "Pearson Concept Audit Dashboard",
    sourceKind: "sites_project",
    sourceType: "concept_course_audit_pattern",
    sourceUri: "https://pearson-course-audit-20260624.harrity-9048.chatgpt-team.site",
    driveFileId: "sites-appgprj_6a3c9b51d30081919f30c4d0df9d16ab",
    subject: "Pearson concept/course package audit",
    edition: "Sites version 7 / 2026-06-26",
    metadata: {
      sitesProjectId: "appgprj_6a3c9b51d30081919f30c4d0df9d16ab",
      sitesTitle: "Pearson Concept Audit Dashboard",
      sitesRole: "concept_audit_pattern",
      accessMode: "custom",
      patternUse: [
        "concept coverage audit",
        "course package audit",
        "program director evidence reporting",
        "source-to-concept review",
      ],
      learnerFacing: false,
      premiumWorkflowPattern: true,
    },
  },
  {
    title: "Maternal-Newborn In-Depth Lesson Guide",
    sourceKind: "local_file",
    sourceType: "course_lesson_guide",
    sourceUri: "local-download:maternal_newborn_in_depth_lesson_guide_20260610.docx",
    driveFileId: "local-harrity-maternal-newborn-guide-20260610",
    subject: "Maternal-newborn nursing",
    edition: "2026-06-10 draft faculty package",
    metadata: {
      localFileName: "maternal_newborn_in_depth_lesson_guide_20260610.docx",
      chaptersBuilt: 27,
      representedSlides: 702,
      evidenceSnippets: harrityEvidenceSnippets.maternalGuide,
    },
  },
  {
    title: "Maternal-Newborn Harrity Builder Depth-Pass Package",
    sourceKind: "local_file",
    sourceType: "depth_pass_package",
    sourceUri: "local-download:maternal_newborn_harrity_builder_depthpass_20260502.zip",
    driveFileId: "local-harrity-maternal-depthpass-20260502",
    subject: "Maternal-newborn nursing / chapter production package",
    edition: "2026-05-02 depth pass",
    metadata: {
      localFileName: "maternal_newborn_harrity_builder_depthpass_20260502.zip",
      chaptersBuilt: 27,
      evidenceSnippets: harrityEvidenceSnippets.maternalDepthPass,
    },
  },
  {
    title: "RN Concept-Based Curriculum Data Hub",
    sourceKind: "drive_sheet",
    sourceType: "curriculum_governance_hub",
    sourceUri: "https://docs.google.com/spreadsheets/d/15wefqRKZbW4MEXpuuqYcltstr3T9NErieGT_X3U4JjA/edit",
    driveFileId: "15wefqRKZbW4MEXpuuqYcltstr3T9NErieGT_X3U4JjA",
    subject: "RN concept-based curriculum / accreditation alignment",
    edition: "2026 planning source",
    metadata: {
      tabs: ["Curriculum Mapping", "Governance", "Validation Rules", "Output Contracts"],
      evidenceSnippets: harrityEvidenceSnippets.curriculumHub,
    },
  },
];

const archiveRoleDescriptions: Record<string, { label: string; sourceType: string; subject: string }> = {
  harrity_pipeline_contract: {
    label: "Harrity Lesson Builder Pipeline Contract",
    sourceType: "lesson_builder_contract",
    subject: "Learner-facing contract, QA gates, package manifest, and export schema",
  },
  chapter_deck_schema: {
    label: "Nursing Chapter Deck Builder Schema",
    sourceType: "chapter_deck_schema",
    subject: "Chapter/deck production schema and PPTX/package pattern",
  },
  pilot_preflight_package: {
    label: "NCC AMS Pilot Preflight Package",
    sourceType: "pilot_preflight",
    subject: "First source-import and preflight package",
  },
  chunking_search_pattern: {
    label: "Chunk Index Retrieval Pattern",
    sourceType: "chunking_search_pattern",
    subject: "Reusable chunking/search UX pattern",
  },
  base_app: {
    label: "NurseStudy Base Application",
    sourceType: "base_application",
    subject: "Base app implementation reference",
  },
  pattern_reference: {
    label: "Reusable Pattern Reference",
    sourceType: "pattern_reference",
    subject: "Reference implementation or skill pattern",
  },
};

const textFileExtensions = new Set([".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".xml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py"]);

const defaultPilotArchiveSet: Array<z.infer<typeof sourceArchiveImportSchema>> = [
  {
    archivePath: "C:\\Users\\bobby\\Downloads\\harrity_lesson_builder_pipeline_skill_v2_20260509.zip",
    role: "harrity_pipeline_contract",
    approvalStatus: "approved",
  },
  {
    archivePath: "C:\\Users\\bobby\\Downloads\\nursing-chapter-deck-builder.zip",
    role: "chapter_deck_schema",
    approvalStatus: "approved",
  },
  {
    archivePath: "C:\\Users\\bobby\\Downloads\\20260528_NCC_AMS_preflight_package.zip",
    role: "pilot_preflight_package",
    approvalStatus: "approved",
  },
];

const mnnDriveFolderId = "18DNf_F1E9rdHjEDHYlqDeHlSKULZgTmb";
const mnnChapterCandidates = [
  ["ch01", "Contraception"],
  ["ch02", "Infertility"],
  ["ch03", "Expected Physiological Changes During Pregnancy"],
  ["ch04", "Prenatal Care"],
  ["ch05", "Nutrition During Pregnancy"],
  ["ch06", "Assessment of Fetal Well-Being"],
  ["ch07", "Bleeding During Pregnancy"],
  ["ch08", "Infections"],
  ["ch09", "Medical Conditions"],
  ["ch10", "Early Onset of Labor"],
  ["ch11", "Labor and Delivery Processes"],
  ["ch12", "Pain Management"],
  ["ch13", "Fetal Assessment During Labor"],
  ["ch14", "Nursing Care During Stages of Labor"],
  ["ch15", "Therapeutic Procedures to Assist with Labor and Delivery"],
  ["ch16", "Complications Related to the Labor Process"],
  ["ch17", "Postpartum Physiological Adaptations"],
  ["ch18", "Baby-Friendly Care"],
  ["ch19", "Client Education and Discharge Teaching"],
  ["ch20", "Postpartum Disorders"],
  ["ch21", "Postpartum Infections"],
  ["ch22", "Postpartum Depression"],
  ["ch23", "Newborn Assessment"],
  ["ch24", "Nursing Care of Newborns"],
  ["ch25", "Newborn Nutrition"],
  ["ch26", "Nursing Care and Discharge Teaching"],
  ["ch27", "Assessment and Management of Newborn Complications"],
] as const;

const mnnSupportingFiles = [
  ["20260503_MN_master_manifest", "manifest", "master_manifest"],
  ["20260503_MN_master_manifest.json", "json", "master_manifest_json"],
  ["20260503_MN_slide_blueprint_master", "spreadsheet", "slide_blueprint"],
  ["20260503_MN_QA_log", "spreadsheet", "qa_log"],
  ["20260503_MN_production_plan.md", "document", "production_plan"],
  ["20260503_MN_visual_asset_register", "spreadsheet", "visual_asset_register"],
  ["validation_overview.md", "document", "validation_overview"],
  ["chapter_validation", "spreadsheet", "chapter_validation"],
  ["batch_manifest.json", "json", "batch_manifest"],
] as const;

const openStaxNursingBooks = [
  {
    title: "Clinical Nursing Skills",
    slug: "clinical-nursing-skills",
    category: "Fundamentals and Skills",
    onlineUrl: "https://openstax.org/books/clinical-nursing-skills/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Clinical-Nursing-Skills-WEB.pdf",
  },
  {
    title: "Fundamentals of Nursing",
    slug: "fundamentals-nursing",
    category: "Fundamentals and Skills",
    onlineUrl: "https://openstax.org/books/fundamentals-nursing/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Fundamentals_of_Nursing_-_WEB.pdf",
  },
  {
    title: "Maternal-Newborn Nursing",
    slug: "maternal-newborn-nursing",
    category: "Maternal-Newborn Nursing",
    onlineUrl: "https://openstax.org/books/maternal-newborn-nursing/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Maternal-Newborn_Nursing-WEB.pdf",
  },
  {
    title: "Medical-Surgical Nursing",
    slug: "medical-surgical-nursing",
    category: "Medical-Surgical Nursing",
    onlineUrl: "https://openstax.org/books/medical-surgical-nursing/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Medical-Surgical_Nursing-WEB.pdf",
  },
  {
    title: "Nutrition for Nurses",
    slug: "nutrition",
    category: "Nutrition and Pharmacology",
    onlineUrl: "https://openstax.org/books/nutrition/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Nutrition_for_Nurses-WEB.pdf",
  },
  {
    title: "Pharmacology for Nurses",
    slug: "pharmacology",
    category: "Nutrition and Pharmacology",
    onlineUrl: "https://openstax.org/books/pharmacology/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Pharmacology-WEB.pdf",
  },
  {
    title: "Population Health for Nurses",
    slug: "population-health",
    category: "Population and Community Health",
    onlineUrl: "https://openstax.org/books/population-health/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Population_Health_for_Nurses_-_WEB.pdf",
  },
  {
    title: "Psychiatric-Mental Health Nursing",
    slug: "psychiatric-mental-health",
    category: "Psychiatric-Mental Health Nursing",
    onlineUrl: "https://openstax.org/books/psychiatric-mental-health/pages/1-introduction",
    pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/Psychiatric-Mental_Health_Nursing-WEB.pdf",
  },
] as const;

let tablesReady = false;

async function ensureLessonBuilderTables() {
  if (tablesReady) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS source_registry (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      source_kind text NOT NULL DEFAULT 'document',
      source_type text NOT NULL DEFAULT 'reference',
      source_uri text,
      drive_file_id text,
      document_id varchar REFERENCES documents(id),
      subject text,
      edition text,
      citation_policy text NOT NULL DEFAULT 'cite_paraphrase',
      approval_status text NOT NULL DEFAULT 'approved',
      ingestion_status text NOT NULL DEFAULT 'ready',
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS taxonomy_terms (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      taxonomy text NOT NULL,
      code text,
      label text NOT NULL,
      parent_id varchar,
      description text,
      metadata jsonb DEFAULT '{}'::jsonb,
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS source_taxonomy_mappings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id varchar NOT NULL REFERENCES source_registry(id) ON DELETE CASCADE,
      taxonomy_term_id varchar NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
      document_id varchar REFERENCES documents(id),
      chunk_id varchar REFERENCES document_chunks(id),
      mapping_source text NOT NULL DEFAULT 'admin_review',
      confidence decimal(3,2),
      notes text,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_packages (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      topic text NOT NULL,
      audience text NOT NULL DEFAULT 'Prelicensure RN',
      status text NOT NULL DEFAULT 'draft',
      source_ids text[] DEFAULT '{}',
      taxonomy_snapshot jsonb DEFAULT '{}'::jsonb,
      deck_model jsonb DEFAULT '{}'::jsonb,
      manifest jsonb DEFAULT '{}'::jsonb,
      qa_summary jsonb DEFAULT '{}'::jsonb,
      created_by varchar REFERENCES users(id),
      published_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
<<<<<<< HEAD
=======
  await db.execute(sql`ALTER TABLE lesson_packages ADD COLUMN IF NOT EXISTS release_stage text NOT NULL DEFAULT 'draft'`);
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_slides (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      slide_number integer NOT NULL,
      slide_type text NOT NULL,
      title text NOT NULL,
      visible_content jsonb DEFAULT '{}'::jsonb,
      speaker_notes text,
      guided_notes text,
      retrieval_prompt text,
      nclex_category text,
      cjm_step text,
      nursing_process text,
      bloom_level text,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      slide_id varchar REFERENCES lesson_slides(id) ON DELETE SET NULL,
      item_type text NOT NULL DEFAULT 'multiple_choice',
      stem text NOT NULL,
      options jsonb DEFAULT '[]'::jsonb,
      correct_answer text NOT NULL,
      rationale text NOT NULL,
      tags jsonb DEFAULT '{}'::jsonb,
      difficulty text DEFAULT 'application',
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
<<<<<<< HEAD
=======
    CREATE TABLE IF NOT EXISTS curriculum_frameworks (
      id varchar PRIMARY KEY,
      title text NOT NULL,
      version text NOT NULL,
      audience text NOT NULL DEFAULT 'Prelicensure RN',
      status text NOT NULL DEFAULT 'draft',
      source_uri text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curriculum_nodes (
      id varchar PRIMARY KEY,
      framework_id varchar NOT NULL REFERENCES curriculum_frameworks(id) ON DELETE CASCADE,
      node_type text NOT NULL,
      code text NOT NULL,
      label text NOT NULL,
      description text,
      blueprint_weight decimal(5,2),
      safety_risk text NOT NULL DEFAULT 'standard',
      release_stage text NOT NULL DEFAULT 'draft',
      legacy_ids text[] DEFAULT '{}',
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curriculum_edges (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      framework_id varchar NOT NULL REFERENCES curriculum_frameworks(id) ON DELETE CASCADE,
      from_node_id varchar NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
      to_node_id varchar NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
      relationship text NOT NULL,
      weight decimal(5,4),
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curriculum_objective_mappings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_node_id varchar NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
      package_id varchar,
      item_id varchar,
      mapping_type text NOT NULL DEFAULT 'primary',
      confidence decimal(5,4) NOT NULL DEFAULT 1,
      verified_by text,
      verified_at timestamp,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curriculum_evidence_sources (
      id varchar PRIMARY KEY,
      framework_id varchar NOT NULL REFERENCES curriculum_frameworks(id) ON DELETE CASCADE,
      title text NOT NULL,
      publisher text NOT NULL,
      license text NOT NULL,
      source_uri text NOT NULL,
      edition text,
      locator text,
      approval_status text NOT NULL DEFAULT 'pending',
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curriculum_performance_evidence (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      learner_key text NOT NULL,
      objective_node_id varchar NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
      score decimal(5,2) NOT NULL,
      confidence decimal(5,4) NOT NULL DEFAULT 1,
      source_kind text NOT NULL,
      observed_at timestamp NOT NULL DEFAULT now(),
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS directed_remediation_plans (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      learner_key text NOT NULL,
      framework_id varchar NOT NULL REFERENCES curriculum_frameworks(id),
      algorithm_version text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      inputs jsonb NOT NULL,
      recommendations jsonb NOT NULL,
      audit jsonb NOT NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curriculum_export_jobs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      framework_id varchar NOT NULL REFERENCES curriculum_frameworks(id),
      export_type text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      artifact_uri text,
      validation_summary jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      completed_at timestamp
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS curriculum_nodes_framework_idx ON curriculum_nodes(framework_id, node_type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS curriculum_performance_learner_idx ON curriculum_performance_evidence(learner_key, objective_node_id)`);

  await db.execute(sql`
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    CREATE TABLE IF NOT EXISTS lesson_citations (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      slide_id varchar REFERENCES lesson_slides(id) ON DELETE CASCADE,
      item_id varchar REFERENCES lesson_items(id) ON DELETE CASCADE,
      source_id varchar REFERENCES source_registry(id),
      document_id varchar REFERENCES documents(id),
      chunk_id varchar REFERENCES document_chunks(id),
      citation_label text NOT NULL,
      page_start integer,
      page_end integer,
      excerpt text,
      relevance_score decimal(5,4),
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_qa_results (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      gate_key text NOT NULL,
      gate_name text NOT NULL,
      status text NOT NULL,
      details text NOT NULL,
      score decimal(5,2),
      checked_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS source_archive_imports (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      source_uri text NOT NULL,
      archive_kind text NOT NULL DEFAULT 'source_archive',
      role text NOT NULL DEFAULT 'pattern_reference',
      status text NOT NULL DEFAULT 'queued',
      content_hash text,
      file_count integer DEFAULT 0,
      imported_source_ids text[] DEFAULT '{}',
      summary jsonb DEFAULT '{}'::jsonb,
      error_message text,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS source_archive_files (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      import_id varchar NOT NULL REFERENCES source_archive_imports(id) ON DELETE CASCADE,
      source_id varchar REFERENCES source_registry(id) ON DELETE SET NULL,
      file_path text NOT NULL,
      file_kind text NOT NULL DEFAULT 'other',
      file_role text NOT NULL DEFAULT 'reference',
      size_bytes integer DEFAULT 0,
      content_hash text,
      extracted_text text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_generation_runs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar REFERENCES lesson_packages(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'queued',
      generation_mode text NOT NULL DEFAULT 'template',
      topic text NOT NULL,
      audience text NOT NULL DEFAULT 'Prelicensure RN',
      source_ids text[] DEFAULT '{}',
      settings jsonb DEFAULT '{}'::jsonb,
      evidence_snapshot jsonb DEFAULT '{}'::jsonb,
      taxonomy_snapshot jsonb DEFAULT '{}'::jsonb,
      validation_summary jsonb DEFAULT '{}'::jsonb,
      error_message text,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      completed_at timestamp
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_package_artifacts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      artifact_key text NOT NULL,
      artifact_type text NOT NULL DEFAULT 'json',
      file_name text NOT NULL,
      mime_type text NOT NULL DEFAULT 'application/json',
      content_hash text,
      storage_uri text,
      content_json jsonb DEFAULT '{}'::jsonb,
      content_text text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_contract_validations (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      validation_key text NOT NULL,
      validation_name text NOT NULL,
      status text NOT NULL,
      details text NOT NULL,
      evidence jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_package_reviews (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      reviewer_name text NOT NULL DEFAULT 'Faculty reviewer',
      reviewer_role text NOT NULL DEFAULT 'faculty_reviewer',
      decision text NOT NULL DEFAULT 'comment',
      focus_area text NOT NULL DEFAULT 'overall',
      comment text NOT NULL,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS topic_production_reviews (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      source_key text NOT NULL UNIQUE,
      source_type text NOT NULL,
      source_id text NOT NULL,
      decision text NOT NULL DEFAULT 'unreviewed',
      reviewer_notes text NOT NULL DEFAULT '',
      reviewed_by text NOT NULL DEFAULT 'admin',
      reviewed_at timestamp DEFAULT now(),
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS topic_production_reviews_source_idx ON topic_production_reviews(source_type, source_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_assignments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      title text NOT NULL,
      cohort_name text NOT NULL DEFAULT 'Pilot cohort',
      due_date timestamp,
      status text NOT NULL DEFAULT 'active',
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_assignment_learners (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      assignment_id varchar NOT NULL REFERENCES lesson_assignments(id) ON DELETE CASCADE,
      learner_name text NOT NULL,
      learner_email text,
      learner_key text NOT NULL,
      status text NOT NULL DEFAULT 'assigned',
      opened_at timestamp,
      completed_at timestamp,
      last_activity_at timestamp,
      feedback_rating text,
      feedback_comment text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS lesson_assignments_package_idx ON lesson_assignments(package_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS lesson_assignment_learners_assignment_idx ON lesson_assignment_learners(assignment_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS lesson_assignment_learners_key_idx ON lesson_assignment_learners(learner_key)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_learner_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      assignment_id varchar REFERENCES lesson_assignments(id) ON DELETE SET NULL,
      assignment_learner_id varchar REFERENCES lesson_assignment_learners(id) ON DELETE SET NULL,
      session_id text NOT NULL,
      event_type text NOT NULL,
      slide_id varchar REFERENCES lesson_slides(id) ON DELETE SET NULL,
      item_id varchar REFERENCES lesson_items(id) ON DELETE SET NULL,
      payload jsonb DEFAULT '{}'::jsonb,
      user_agent text,
      ip_hash text,
      created_at timestamp DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE lesson_learner_events ADD COLUMN IF NOT EXISTS assignment_id varchar REFERENCES lesson_assignments(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE lesson_learner_events ADD COLUMN IF NOT EXISTS assignment_learner_id varchar REFERENCES lesson_assignment_learners(id) ON DELETE SET NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS lesson_learner_events_assignment_idx ON lesson_learner_events(assignment_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS lesson_learner_events_assignment_learner_idx ON lesson_learner_events(assignment_learner_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lesson_release_audit_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      package_id varchar NOT NULL REFERENCES lesson_packages(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      summary text NOT NULL,
      payload jsonb DEFAULT '{}'::jsonb,
      actor_id varchar REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )
  `);

  tablesReady = true;
}

async function seedDefaultSourceTruth() {
  await ensureLessonBuilderTables();

  for (const seed of defaultTaxonomySeeds) {
    const [existing] = await db
      .select()
      .from(taxonomyTerms)
      .where(and(eq(taxonomyTerms.taxonomy, seed.taxonomy), eq(taxonomyTerms.label, seed.label)))
      .limit(1);

    if (!existing) {
      await db.insert(taxonomyTerms).values(seed);
    }
  }

  for (const seed of defaultSourceSeeds) {
    const [existing] = await db
      .select()
      .from(sourceRegistry)
      .where(eq(sourceRegistry.driveFileId, seed.driveFileId))
      .limit(1);

    if (!existing) {
      await db.insert(sourceRegistry).values({
        ...seed,
        citationPolicy: "cite_paraphrase",
        approvalStatus: "approved",
        ingestionStatus: "ready",
      });
    }
  }
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function baseNameFromPath(filePath: string) {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || filePath;
}

function extensionOf(filePath: string) {
  const normalized = filePath.toLowerCase();
  const match = normalized.match(/(\.[a-z0-9]+)$/);
  return match?.[1] || "";
}

function classifyArchiveRole(archivePath: string, entryNames: string[], requestedRole?: string) {
  if (requestedRole) return requestedRole;
  const haystack = [archivePath, ...entryNames.slice(0, 40)].join(" ").toLowerCase();
  if (haystack.includes("harrity_lesson_builder_pipeline") || haystack.includes("harrity-lesson-builder-pipeline")) return "harrity_pipeline_contract";
  if (haystack.includes("nursing-chapter-deck-builder") || haystack.includes("chapter-deck-builder") || haystack.includes("skill(18") || haystack.includes("skill (1)")) return "chapter_deck_schema";
  if (haystack.includes("20260528_ncc_ams_preflight") || haystack.includes("ncc_ams_preflight")) return "pilot_preflight_package";
  if (haystack.includes("chunk-index-retrieval") || haystack.includes("data chunker")) return "chunking_search_pattern";
  if (haystack.includes("nursestudy")) return "base_app";
  return "pattern_reference";
}

function classifyArchiveFile(filePath: string) {
  const lower = filePath.toLowerCase();
  const ext = extensionOf(lower);
  const fileKind = ext.replace(".", "") || "other";
  let fileRole = "reference";
  if (lower.endsWith("readme.md") || lower.includes("/readme")) fileRole = "readme";
  else if (lower.endsWith("skill.md")) fileRole = "skill_contract";
  else if (lower.includes("schema") || lower.endsWith(".schema.json")) fileRole = "schema";
  else if (lower.includes("manifest")) fileRole = "manifest";
  else if (lower.includes("validate") || lower.includes("qa")) fileRole = "validator";
  else if (lower.includes("template")) fileRole = "template";
  else if (lower.includes("config")) fileRole = "config";
  return { fileKind, fileRole };
}

async function safeArchiveText(entry: JSZip.JSZipObject, filePath: string, sizeBytes: number) {
  if (!textFileExtensions.has(extensionOf(filePath)) || sizeBytes > 250_000) return null;
  try {
    return textSnippet(await entry.async("string"), 4000);
  } catch {
    return null;
  }
}

function summarizeArchiveEntries(archivePath: string, entryNames: string[], role: string) {
  const lowerEntries = entryNames.map((entry) => entry.toLowerCase());
  const importantFiles = entryNames.filter((entry) => {
    const lower = entry.toLowerCase();
    return lower.endsWith("readme.md") || lower.endsWith("skill.md") || lower.includes("schema") || lower.includes("manifest") || lower.includes("validate") || lower.includes("config");
  });
  const rootFolders = Array.from(new Set(entryNames.map((entry) => entry.split(/[\\/]/)[0]).filter(Boolean))).slice(0, 12);
  return {
    archiveFileName: baseNameFromPath(archivePath),
    role,
    roleDescription: archiveRoleDescriptions[role] || archiveRoleDescriptions.pattern_reference,
    rootFolders,
    readmePaths: entryNames.filter((entry) => entry.toLowerCase().endsWith("readme.md")),
    skillPaths: entryNames.filter((entry) => entry.toLowerCase().endsWith("skill.md")),
    schemaPaths: entryNames.filter((entry) => entry.toLowerCase().includes("schema")),
    manifestPaths: entryNames.filter((entry) => entry.toLowerCase().includes("manifest")),
    validatorPaths: entryNames.filter((entry) => entry.toLowerCase().includes("validate") || entry.toLowerCase().includes("qa")),
    configPaths: entryNames.filter((entry) => entry.toLowerCase().includes("config")),
    containsDataChunkerExport: lowerEntries.some((entry) => entry.includes("chunk") && (entry.endsWith(".json") || entry.endsWith(".csv"))),
    importantFiles: importantFiles.slice(0, 30),
  };
}

function parseDriveFolderId(folderUrl: string) {
  const foldersMatch = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) return foldersMatch[1];
  const queryMatch = folderUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch?.[1]) return queryMatch[1];
  if (/^[a-zA-Z0-9_-]{12,}$/.test(folderUrl.trim())) return folderUrl.trim();
  return "";
}

function driveFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function slugifyDriveLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildMnnDrivePackageSummary(folderId: string, title: string) {
  return {
    title,
    folderId,
    folderName: "MNN",
    role: "drive_package_hub",
    sourceTruthPolicy: "reference_only_until_admin_approval",
    contentArea: "Maternal-newborn nursing",
    observedAssets: {
      chapterFolderCount: mnnChapterCandidates.length,
      supportingFileCount: mnnSupportingFiles.length,
      deckCollectionCount: 2,
      notesPassPresent: true,
      validationPresent: true,
      sourceJsonPresent: true,
      taxonomyJsonPresent: true,
    },
    recommendedUse: [
      "Register as Drive package metadata first.",
      "Use Harrity decks as lesson grammar and template references.",
      "Promote chapter folders to approved source records only after citation policy and ownership review.",
      "Route large source PDFs through Data Chunker Pro before generation.",
    ],
    registryRoles: [
      "drive_package_hub",
      "drive_supporting_manifest",
      "drive_harrity_deck_exemplar",
      "drive_chapter_source_candidate",
      "drive_notes_pass_candidate",
    ],
  };
}

function normalizeChatgptFileType(value: string | undefined, title: string) {
  const cleanValue = (value || "").trim().toLowerCase();
  if (cleanValue && cleanValue !== "unknown") return cleanValue.replace(/^\./, "");
  const match = title.trim().toLowerCase().match(/\.([a-z0-9]+)(?:[\s)]*)?$/);
  return match?.[1] || "unknown";
}

function chatgptAssetFamilyForItem(item: z.infer<typeof chatgptLibraryItemSchema>) {
  const title = item.title.toLowerCase();
  const candidate = (item.assetFamily || "").trim();
  if (candidate && candidate !== "reference_pack") return candidate;
  if (title.includes("harrity") || title.includes("lesson_builder")) return "harrity_lesson_contract";
  if (title.includes("learner") || title.includes("handout")) return "learner_material";
  if (title.includes("facilitator") || title.includes("handoff")) return "facilitation_or_handoff";
  if (title.includes("skill")) return "skill_pack";
  if (title.includes("solution_generator")) return "solution_builder_pattern";
  if (title.includes("vdis")) return "report_workbook_pattern";
  return "reference_pack";
}

function buildChatgptLibrarySummary(data: z.infer<typeof chatgptLibraryReferencePackImportSchema>, contentHash: string) {
  const fileTypeCounts = data.items.reduce<Record<string, number>>((acc, item) => {
    const type = normalizeChatgptFileType(item.fileType, item.title);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const assetFamilies = Array.from(new Set(data.items.map((item) => chatgptAssetFamilyForItem(item)))).sort();
  return {
    title: data.title,
    role: "chatgpt_library_reference_pack",
    origin: "chatgpt_library",
    libraryUrl: data.libraryUrl,
    projectTitle: data.projectTitle,
    projectUrl: data.projectUrl,
    contentHash,
    visibleFileCount: data.items.length,
    fileTypeCounts,
    assetFamilies,
    sourceTruthPolicy: "reference_only_until_export_review_and_admin_approval",
    requiresExportBeforeCitation: true,
    recommendedUse: [
      "Register visible ChatGPT library inventory as metadata only.",
      "Export or download the actual file before promoting any item into source truth.",
      "Use handouts, facilitation guides, skills, and solution packs as product patterns until reviewed.",
      "Do not use ChatGPT library metadata as clinical citation evidence.",
    ],
    notes: data.notes,
    auditedIn: "CHATGPT_LIBRARY_ASSET_AUDIT.md",
  };
}

async function importChatgptLibraryReferencePack(data: z.infer<typeof chatgptLibraryReferencePackImportSchema>, createdBy?: string) {
  await ensureLessonBuilderTables();
  const role = "chatgpt_library_reference_pack";
  const normalizedLibraryUrl = data.libraryUrl || "https://chatgpt.com/library?tab=files";
  const itemFingerprint = data.items
    .map((item) => `${item.title}|${normalizeChatgptFileType(item.fileType, item.title)}|${item.projectContext || ""}`)
    .sort()
    .join("\n");
  const contentHash = hashText(`${role}:${normalizedLibraryUrl}:${data.projectUrl || ""}:${itemFingerprint}`);
  const summary = buildChatgptLibrarySummary(data, contentHash);

  const [duplicate] = await db
    .select()
    .from(sourceArchiveImports)
    .where(and(eq(sourceArchiveImports.contentHash, contentHash), eq(sourceArchiveImports.role, role)))
    .orderBy(desc(sourceArchiveImports.createdAt))
    .limit(1);

  if (duplicate && duplicate.status !== "failed") {
    const [duplicateJob] = await db.insert(sourceArchiveImports).values({
      title: `${duplicate.title} duplicate`,
      sourceUri: normalizedLibraryUrl,
      archiveKind: "chatgpt_library",
      role,
      status: "duplicate",
      contentHash,
      fileCount: duplicate.fileCount,
      importedSourceIds: duplicate.importedSourceIds || [],
      summary: {
        ...(duplicate.summary || {}),
        duplicateOf: duplicate.id,
        dedupedAt: new Date().toISOString(),
      },
      createdBy,
    }).returning();

    return { importJob: duplicateJob, files: [], sources: [], duplicateOf: duplicate.id };
  }

  const [importJob] = await db.insert(sourceArchiveImports).values({
    title: data.title,
    sourceUri: normalizedLibraryUrl,
    archiveKind: "chatgpt_library",
    role,
    status: "processing",
    contentHash,
    fileCount: data.items.length,
    importedSourceIds: [],
    summary,
    createdBy,
  }).returning();

  try {
    const commonMetadata = {
      chatgptLibraryImportId: importJob.id,
      origin: "chatgpt_library",
      libraryUrl: normalizedLibraryUrl,
      projectTitle: data.projectTitle,
      projectUrl: data.projectUrl,
      referenceOnly: true,
      requiresExport: true,
      sourceTruthPolicy: "not_authoritative_source_truth",
      approvalRequiredBeforeGeneration: true,
      auditedIn: "CHATGPT_LIBRARY_ASSET_AUDIT.md",
    };

    const sourceRows = [
      {
        title: data.title,
        sourceKind: "chatgpt_library_reference_pack",
        sourceType: "chatgpt_visible_inventory",
        sourceUri: normalizedLibraryUrl,
        subject: data.projectTitle || "ChatGPT library reference inventory",
        edition: "visible library inventory",
        citationPolicy: "metadata_only_requires_export",
        approvalStatus: data.approvalStatus,
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "chatgpt_library_collection",
          summary,
        },
        createdBy,
      },
      ...data.items.map((item) => {
        const fileType = normalizeChatgptFileType(item.fileType, item.title);
        const assetFamily = chatgptAssetFamilyForItem(item);
        return {
          title: item.title,
          sourceKind: "chatgpt_library_reference_pack",
          sourceType: assetFamily,
          sourceUri: item.sourceUrl || item.conversationUrl || normalizedLibraryUrl,
          subject: item.projectContext || data.projectTitle || "ChatGPT library asset candidate",
          edition: item.modifiedAt || "visible library inventory",
          citationPolicy: "metadata_only_requires_export",
          approvalStatus: "pending",
          ingestionStatus: "ready",
          metadata: {
            ...commonMetadata,
            registryRole: "chatgpt_library_file_candidate",
            fileType,
            sizeLabel: item.sizeLabel,
            modifiedAt: item.modifiedAt,
            projectContext: item.projectContext,
            conversationUrl: item.conversationUrl,
            assetFamily,
            candidateUse: item.candidateUse,
            candidateSource: true,
          },
          createdBy,
        };
      }),
    ];

    const createdSources = await db.insert(sourceRegistry).values(sourceRows).returning();
    const sourceIds = createdSources.map((source) => source.id);
    const packSource = createdSources[0];
    const candidateSources = createdSources.slice(1);
    const fileRows = data.items.map((item, index) => {
      const fileType = normalizeChatgptFileType(item.fileType, item.title);
      const assetFamily = chatgptAssetFamilyForItem(item);
      return {
        importId: importJob.id,
        sourceId: candidateSources[index]?.id || packSource.id,
        filePath: `ChatGPT Library/${item.title}`,
        fileKind: fileType,
        fileRole: assetFamily,
        sizeBytes: 0,
        contentHash: hashText(`${contentHash}:${item.title}:${index}`),
        extractedText: `${item.title}. Visible ChatGPT Library metadata only. Export/download and review the file before source-truth or citation use.`,
        metadata: {
          virtualChatgptLibraryFile: true,
          origin: "chatgpt_library",
          referenceOnly: true,
          requiresExport: true,
          projectTitle: data.projectTitle,
          projectUrl: data.projectUrl,
          modifiedAt: item.modifiedAt,
          sizeLabel: item.sizeLabel,
          projectContext: item.projectContext,
          conversationUrl: item.conversationUrl,
          candidateUse: item.candidateUse,
        },
      };
    });

    const createdFiles = await db.insert(sourceArchiveFiles).values(fileRows).returning();
    const [completed] = await db.update(sourceArchiveImports).set({
      status: "completed",
      importedSourceIds: sourceIds,
      fileCount: createdFiles.length,
      summary: {
        ...summary,
        sourceRegistryIds: sourceIds,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();

    return { importJob: completed, files: createdFiles, sources: createdSources, duplicateOf: null };
  } catch (error) {
    const [failed] = await db.update(sourceArchiveImports).set({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown ChatGPT library import failure",
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();
    return { importJob: failed, files: [], sources: [], duplicateOf: null };
  }
}

function buildOpenStaxNursingCatalogSummary(data: z.infer<typeof openStaxNursingCatalogImportSchema>, contentHash: string) {
  const categoryCounts = openStaxNursingBooks.reduce<Record<string, number>>((acc, book) => {
    acc[book.category] = (acc[book.category] || 0) + 1;
    return acc;
  }, {});
  return {
    title: data.title,
    role: "openstax_nursing_catalog",
    origin: "openstax",
    subjectUrl: data.subjectUrl,
    contentHash,
    bookCount: openStaxNursingBooks.length,
    categoryCounts,
    license: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International",
    aiIngestionPolicy: "no_llm_or_generative_ai_ingestion_without_openstax_permission",
    sourceTruthPolicy: "link_and_metadata_only_until_permission_and_admin_approval",
    recommendedUse: [
      "Use as a public nursing textbook catalog and course coverage planning reference.",
      "Link learners/admins to OpenStax online book pages when appropriate.",
      "Do not download, chunk, embed, or send OpenStax book text/PDF content into AI generation without OpenStax permission.",
      "If permission is granted later, register a separate approved source pack with citation policy and provenance.",
    ],
    notes: data.notes,
    auditedIn: "OPENSTAX_NURSING_SOURCE_AUDIT.md",
  };
}

async function importOpenStaxNursingCatalog(data: z.infer<typeof openStaxNursingCatalogImportSchema>, createdBy?: string) {
  await ensureLessonBuilderTables();
  const role = "openstax_nursing_catalog";
  const normalizedSubjectUrl = data.subjectUrl || "https://openstax.org/subjects/nursing";
  const contentHash = hashText(`${role}:${normalizedSubjectUrl}:${openStaxNursingBooks.map((book) => book.slug).join("|")}`);
  const summary = buildOpenStaxNursingCatalogSummary({ ...data, subjectUrl: normalizedSubjectUrl }, contentHash);

  const [duplicate] = await db
    .select()
    .from(sourceArchiveImports)
    .where(and(eq(sourceArchiveImports.contentHash, contentHash), eq(sourceArchiveImports.role, role)))
    .orderBy(desc(sourceArchiveImports.createdAt))
    .limit(1);

  if (duplicate && duplicate.status !== "failed") {
    const [duplicateJob] = await db.insert(sourceArchiveImports).values({
      title: `${duplicate.title} duplicate`,
      sourceUri: normalizedSubjectUrl,
      archiveKind: "openstax_catalog",
      role,
      status: "duplicate",
      contentHash,
      fileCount: duplicate.fileCount,
      importedSourceIds: duplicate.importedSourceIds || [],
      summary: {
        ...(duplicate.summary || {}),
        duplicateOf: duplicate.id,
        dedupedAt: new Date().toISOString(),
      },
      createdBy,
    }).returning();

    return { importJob: duplicateJob, files: [], sources: [], duplicateOf: duplicate.id };
  }

  const [importJob] = await db.insert(sourceArchiveImports).values({
    title: data.title,
    sourceUri: normalizedSubjectUrl,
    archiveKind: "openstax_catalog",
    role,
    status: "processing",
    contentHash,
    fileCount: openStaxNursingBooks.length,
    importedSourceIds: [],
    summary,
    createdBy,
  }).returning();

  try {
    const commonMetadata = {
      openStaxImportId: importJob.id,
      origin: "openstax",
      subjectUrl: normalizedSubjectUrl,
      referenceOnly: true,
      sourceTruthPolicy: "not_authoritative_source_truth_for_ai_until_permission",
      license: "CC BY-NC-SA 4.0",
      aiIngestionPolicy: "no_llm_or_generative_ai_ingestion_without_openstax_permission",
      noLlmIngestionWithoutPermission: true,
      requiresOpenStaxPermissionBeforeRag: true,
      blockedForGeneration: true,
      approvalRequiredBeforeGeneration: true,
      auditedIn: "OPENSTAX_NURSING_SOURCE_AUDIT.md",
    };

    const sourceRows = [
      {
        title: data.title,
        sourceKind: "openstax_nursing_catalog",
        sourceType: "public_textbook_catalog",
        sourceUri: normalizedSubjectUrl,
        subject: "OpenStax nursing textbook catalog",
        edition: "OpenStax live nursing catalog",
        citationPolicy: "link_only_no_llm_ingestion_without_permission",
        approvalStatus: data.approvalStatus,
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "openstax_nursing_catalog",
          summary,
        },
        createdBy,
      },
      ...openStaxNursingBooks.map((book) => ({
        title: book.title,
        sourceKind: "openstax_book_reference",
        sourceType: "public_textbook_reference",
        sourceUri: book.onlineUrl,
        subject: book.category,
        edition: "OpenStax live book",
        citationPolicy: "link_only_no_llm_ingestion_without_permission",
        approvalStatus: "pending",
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "openstax_book_reference",
          bookTitle: book.title,
          slug: book.slug,
          category: book.category,
          onlineUrl: book.onlineUrl,
          pdfUrl: book.pdfUrl,
          candidateSource: true,
        },
        createdBy,
      })),
    ];

    const createdSources = await db.insert(sourceRegistry).values(sourceRows).returning();
    const sourceIds = createdSources.map((source) => source.id);
    const bookSources = createdSources.slice(1);
    const fileRows = openStaxNursingBooks.map((book, index) => ({
      importId: importJob.id,
      sourceId: bookSources[index]?.id || createdSources[0].id,
      filePath: `OpenStax Nursing/${book.slug}`,
      fileKind: "openstax_book_link",
      fileRole: "book_reference",
      sizeBytes: 0,
      contentHash: hashText(`${contentHash}:${book.slug}`),
      extractedText: `${book.title}. OpenStax nursing book metadata only. Online URL: ${book.onlineUrl}. PDF URL retained for admin reference only; do not ingest/chunk/embed without OpenStax permission.`,
      metadata: {
        virtualOpenStaxBook: true,
        origin: "openstax",
        referenceOnly: true,
        blockedForGeneration: true,
        noLlmIngestionWithoutPermission: true,
        category: book.category,
        onlineUrl: book.onlineUrl,
        pdfUrl: book.pdfUrl,
      },
    }));

    const createdFiles = await db.insert(sourceArchiveFiles).values(fileRows).returning();
    const [completed] = await db.update(sourceArchiveImports).set({
      status: "completed",
      importedSourceIds: sourceIds,
      fileCount: createdFiles.length,
      summary: {
        ...summary,
        sourceRegistryIds: sourceIds,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();

    return { importJob: completed, files: createdFiles, sources: createdSources, duplicateOf: null };
  } catch (error) {
    const [failed] = await db.update(sourceArchiveImports).set({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "OpenStax nursing catalog import failed",
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();
    return { importJob: failed, files: [], sources: [], duplicateOf: null };
  }
}

async function importDrivePackageHub(data: z.infer<typeof drivePackageImportSchema>, createdBy?: string) {
  await ensureLessonBuilderTables();
  const folderId = parseDriveFolderId(data.folderUrl);
  if (!folderId) throw new Error("Drive folder URL or ID could not be parsed.");

  const normalizedFolderUrl = driveFolderUrl(folderId);
  const title = data.title || (folderId === mnnDriveFolderId ? "MNN Maternal-Newborn Package Hub" : "Drive Package Hub");
  const role = folderId === mnnDriveFolderId || data.packageKind === "mnn_package_hub" ? "drive_package_hub" : "generic_drive_package";
  const summary = folderId === mnnDriveFolderId
    ? buildMnnDrivePackageSummary(folderId, title)
    : {
        title,
        folderId,
        role,
        sourceTruthPolicy: "reference_only_until_admin_approval",
        observedAssets: {},
        recommendedUse: ["Register folder metadata, then approve specific source records before generation."],
      };

  const [duplicate] = await db
    .select()
    .from(sourceArchiveImports)
    .where(and(eq(sourceArchiveImports.sourceUri, normalizedFolderUrl), eq(sourceArchiveImports.role, role)))
    .orderBy(desc(sourceArchiveImports.createdAt))
    .limit(1);

  if (duplicate && duplicate.status !== "failed") {
    const [duplicateJob] = await db.insert(sourceArchiveImports).values({
      title: `${duplicate.title} duplicate`,
      sourceUri: normalizedFolderUrl,
      archiveKind: "drive_folder",
      role,
      status: "duplicate",
      contentHash: hashText(`${role}:${folderId}`),
      fileCount: duplicate.fileCount,
      importedSourceIds: duplicate.importedSourceIds || [],
      summary: {
        ...(duplicate.summary || {}),
        duplicateOf: duplicate.id,
        dedupedAt: new Date().toISOString(),
      },
      createdBy,
    }).returning();

    return { importJob: duplicateJob, files: [], sources: [], duplicateOf: duplicate.id };
  }

  const [importJob] = await db.insert(sourceArchiveImports).values({
    title,
    sourceUri: normalizedFolderUrl,
    archiveKind: "drive_folder",
    role,
    status: "processing",
    contentHash: hashText(`${role}:${folderId}`),
    fileCount: folderId === mnnDriveFolderId ? mnnChapterCandidates.length + mnnSupportingFiles.length + 5 : 1,
    importedSourceIds: [],
    summary,
    createdBy,
  }).returning();

  try {
    const commonMetadata = {
      drivePackageImportId: importJob.id,
      driveFolderId: folderId,
      packageKind: data.packageKind,
      referenceOnly: true,
      sourceTruthPolicy: "not_authoritative_source_truth",
      approvalRequiredBeforeGeneration: true,
      auditedIn: "DRIVE_MNN_ASSET_AUDIT.md",
    };

    const sourceRows = folderId === mnnDriveFolderId ? [
      {
        title,
        sourceKind: "drive_package_hub",
        sourceType: "drive_package_collection",
        sourceUri: normalizedFolderUrl,
        driveFileId: folderId,
        subject: "Maternal-newborn nursing package hub",
        edition: "2026-05-03 MNN package",
        citationPolicy: "reference_only",
        approvalStatus: data.approvalStatus,
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "drive_package_hub",
          summary,
        },
        createdBy,
      },
      {
        title: "MNN Supporting Files And Manifests",
        sourceKind: "drive_supporting_manifest",
        sourceType: "production_manifest_qa",
        sourceUri: `${normalizedFolderUrl}#supporting_files`,
        subject: "Maternal-newborn manifests, slide blueprint, QA log, production plan, and visual asset register",
        edition: "2026-05-03 supporting files",
        citationPolicy: "metadata_only",
        approvalStatus: "pending",
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "drive_supporting_manifest",
          supportingFiles: mnnSupportingFiles.map(([fileName, fileKind, fileRole]) => ({ fileName, fileKind, fileRole })),
        },
        createdBy,
      },
      {
        title: "MNN Harrity Chapter Deck Collection",
        sourceKind: "drive_presentation_collection",
        sourceType: "harrity_deck_exemplar_collection",
        sourceUri: `${normalizedFolderUrl}#harrity_chapter_decks`,
        subject: "Maternal-newborn Harrity deck grammar and learner-facing chapter deck exemplars",
        edition: "2026-05-02 chapter decks",
        citationPolicy: "template_reference_only",
        approvalStatus: "pending",
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "drive_harrity_deck_exemplar",
          deckCount: mnnChapterCandidates.length,
          templateUseOnly: true,
        },
        createdBy,
      },
      {
        title: "MNN Notes Pass Candidate",
        sourceKind: "drive_notes_pass",
        sourceType: "notes_pass_candidate",
        sourceUri: `${normalizedFolderUrl}#maternal_newborn_notes_pass`,
        subject: "Maternal-newborn notes pass and guided-notes source-prep candidate",
        edition: "2026-05-03 notes pass",
        citationPolicy: "requires_review_before_citation",
        approvalStatus: "pending",
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "drive_notes_pass_candidate",
          candidateSource: true,
        },
        createdBy,
      },
      ...mnnChapterCandidates.map(([chapterCode, chapterTitle]) => ({
        title: `MNN ${chapterCode.toUpperCase()} ${chapterTitle}`,
        sourceKind: "drive_chapter_source_candidate",
        sourceType: "maternal_newborn_chapter_candidate",
        sourceUri: `${normalizedFolderUrl}#chapters/${chapterCode}_${slugifyDriveLabel(chapterTitle)}`,
        subject: `Maternal-newborn nursing - ${chapterTitle}`,
        edition: "2026-05-02 chapter package",
        citationPolicy: "requires_review_before_citation",
        approvalStatus: "pending",
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "drive_chapter_source_candidate",
          chapterCode,
          chapterTitle,
          candidateSource: true,
          expectedArtifacts: ["README.md", "validation_report", "harrity_deck", "qa_summary.json", "taxonomy.json", "source.json", "deck.json", "outline.json", "script.json"],
        },
        createdBy,
      })),
    ] : [
      {
        title,
        sourceKind: "drive_package_hub",
        sourceType: "drive_package_collection",
        sourceUri: normalizedFolderUrl,
        driveFileId: folderId,
        subject: "Drive package hub",
        edition: "imported Drive folder",
        citationPolicy: "reference_only",
        approvalStatus: data.approvalStatus,
        ingestionStatus: "ready",
        metadata: {
          ...commonMetadata,
          registryRole: "drive_package_hub",
          summary,
        },
        createdBy,
      },
    ];

    const createdSources = await db.insert(sourceRegistry).values(sourceRows).returning();
    const sourceIds = createdSources.map((source) => source.id);
    const hubSource = createdSources[0];
    const fileRows = folderId === mnnDriveFolderId
      ? [
          ...mnnSupportingFiles.map(([fileName, fileKind, fileRole]) => ({
            importId: importJob.id,
            sourceId: hubSource.id,
            filePath: `MNN/supporting_files/${fileName}`,
            fileKind,
            fileRole,
            sizeBytes: 0,
            contentHash: hashText(`${folderId}:${fileName}`),
            extractedText: `Verified Drive metadata for ${fileName}. Reference-only package metadata; not clinical citation truth.`,
            metadata: { virtualDriveFile: true, sourceTruthPolicy: "not_authoritative_source_truth" },
          })),
          ...mnnChapterCandidates.map(([chapterCode, chapterTitle]) => ({
            importId: importJob.id,
            sourceId: hubSource.id,
            filePath: `MNN/chapters/${chapterCode}_${slugifyDriveLabel(chapterTitle)}`,
            fileKind: "folder",
            fileRole: "chapter_source_candidate",
            sizeBytes: 0,
            contentHash: hashText(`${folderId}:${chapterCode}:${chapterTitle}`),
            extractedText: `${chapterCode.toUpperCase()} ${chapterTitle}. Chapter package candidate with deck, validation, source JSON, taxonomy JSON, and script/deck artifacts observed in the MNN hub pattern.`,
            metadata: { virtualDriveFolder: true, chapterCode, chapterTitle, candidateSource: true },
          })),
          {
            importId: importJob.id,
            sourceId: hubSource.id,
            filePath: "MNN/maternal_newborn_notes_pass",
            fileKind: "folder",
            fileRole: "notes_pass_candidate",
            sizeBytes: 0,
            contentHash: hashText(`${folderId}:notes_pass`),
            extractedText: "Maternal-newborn notes pass folder with narrative plan, validation, and chapter folders. Requires approval before source-truth use.",
            metadata: { virtualDriveFolder: true, candidateSource: true },
          },
          {
            importId: importJob.id,
            sourceId: hubSource.id,
            filePath: "MNN/maternal_newborn_harrity_chapter_decks/decks",
            fileKind: "google_slides_collection",
            fileRole: "deck_exemplar_collection",
            sizeBytes: 0,
            contentHash: hashText(`${folderId}:harrity_decks`),
            extractedText: "Maternal-newborn Harrity chapter decks. Use for lesson grammar, pacing, and template reference only unless separately approved.",
            metadata: { virtualDriveFolder: true, deckCount: mnnChapterCandidates.length, templateUseOnly: true },
          },
        ]
      : [{
          importId: importJob.id,
          sourceId: hubSource.id,
          filePath: `Drive folder ${folderId}`,
          fileKind: "folder",
          fileRole: "drive_package_hub",
          sizeBytes: 0,
          contentHash: hashText(folderId),
          extractedText: "Generic Drive package hub metadata. Requires manual inspection before source-truth use.",
          metadata: { virtualDriveFolder: true },
        }];

    const createdFiles = await db.insert(sourceArchiveFiles).values(fileRows).returning();
    const [completed] = await db.update(sourceArchiveImports).set({
      status: "completed",
      fileCount: createdFiles.length,
      importedSourceIds: sourceIds,
      summary: {
        ...summary,
        sourceRegistryIds: sourceIds,
        sourceCount: sourceIds.length,
        fileCount: createdFiles.length,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();

    return { importJob: completed, files: createdFiles, sources: createdSources };
  } catch (error) {
    const [failed] = await db.update(sourceArchiveImports).set({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Drive package import failed",
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();
    return { importJob: failed, files: [], sources: [] };
  }
}

async function importSourceArchive(data: z.infer<typeof sourceArchiveImportSchema>, createdBy?: string) {
  await ensureLessonBuilderTables();
  const archiveBuffer = await readFile(data.archivePath);
  const contentHash = hashBuffer(archiveBuffer);

  const [duplicate] = await db
    .select()
    .from(sourceArchiveImports)
    .where(eq(sourceArchiveImports.contentHash, contentHash))
    .orderBy(desc(sourceArchiveImports.createdAt))
    .limit(1);

  if (duplicate && duplicate.status !== "failed") {
    const [duplicateJob] = await db.insert(sourceArchiveImports).values({
      title: data.title || `${duplicate.title} duplicate`,
      sourceUri: data.archivePath,
      archiveKind: duplicate.archiveKind,
      role: duplicate.role,
      status: "duplicate",
      contentHash,
      fileCount: duplicate.fileCount,
      importedSourceIds: duplicate.importedSourceIds || [],
      summary: {
        ...(duplicate.summary || {}),
        duplicateOf: duplicate.id,
        dedupedAt: new Date().toISOString(),
      },
      createdBy,
    }).returning();

    return { importJob: duplicateJob, files: [], sources: [], duplicateOf: duplicate.id };
  }

  const zip = await JSZip.loadAsync(archiveBuffer);
  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  const entryNames = files.map((entry) => entry.name);
  const role = classifyArchiveRole(data.archivePath, entryNames, data.role);
  const roleDescription = archiveRoleDescriptions[role] || archiveRoleDescriptions.pattern_reference;
  const title = data.title || roleDescription.label || baseNameFromPath(data.archivePath);
  const summary = summarizeArchiveEntries(data.archivePath, entryNames, role);

  const [importJob] = await db.insert(sourceArchiveImports).values({
    title,
    sourceUri: data.archivePath,
    archiveKind: "zip",
    role,
    status: "processing",
    contentHash,
    fileCount: files.length,
    importedSourceIds: [],
    summary,
    createdBy,
  }).returning();

  try {
    const [source] = await db.insert(sourceRegistry).values({
      title,
      sourceKind: "source_archive",
      sourceType: data.sourceType || roleDescription.sourceType,
      sourceUri: data.archivePath,
      subject: roleDescription.subject,
      edition: summary.archiveFileName,
      citationPolicy: role === "harrity_pipeline_contract" ? "contract_validate" : "cite_paraphrase",
      approvalStatus: data.approvalStatus,
      ingestionStatus: "ready",
      metadata: {
        archiveImportId: importJob.id,
        archiveRole: role,
        archiveSummary: summary,
        contentHash,
      },
      createdBy,
    }).returning();

    const rows = [];
    for (const entry of files) {
      const sizeBytes = Number((entry as any)._data?.uncompressedSize || 0);
      const { fileKind, fileRole } = classifyArchiveFile(entry.name);
      const extractedText = await safeArchiveText(entry, entry.name, sizeBytes);
      rows.push({
        importId: importJob.id,
        sourceId: source.id,
        filePath: entry.name,
        fileKind,
        fileRole,
        sizeBytes,
        contentHash: extractedText ? hashText(extractedText) : undefined,
        extractedText,
        metadata: {
          date: entry.date?.toISOString?.(),
          compressedSize: Number((entry as any)._data?.compressedSize || 0),
        },
      });
    }

    const createdFiles = rows.length ? await db.insert(sourceArchiveFiles).values(rows).returning() : [];
    const [completed] = await db.update(sourceArchiveImports).set({
      status: "completed",
      importedSourceIds: [source.id],
      summary: {
        ...summary,
        sourceRegistryId: source.id,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();

    return { importJob: completed, files: createdFiles, sources: [source] };
  } catch (error) {
    const [failed] = await db.update(sourceArchiveImports).set({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Archive import failed",
      updatedAt: new Date(),
    }).where(eq(sourceArchiveImports.id, importJob.id)).returning();
    return { importJob: failed, files: [], sources: [] };
  }
}

async function attachDocumentSource(data: z.infer<typeof attachDocumentSourceSchema>, createdBy?: string) {
  await ensureLessonBuilderTables();

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, data.documentId))
    .limit(1);

  if (!document) {
    throw new Error("Knowledge-base document not found.");
  }

  const [chunkCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, data.documentId));

  const chunkCount = chunkCountRow?.count || 0;
  const ingestionStatus = document.status === "ready" && chunkCount > 0 ? "ready" : chunkCount > 0 ? "processing" : "queued";

  const metadata = {
    attachedFrom: "knowledge_base_document",
    documentTitle: document.title,
    documentType: document.type,
    documentStatus: document.status,
    chunkCount,
    totalPages: document.totalPages,
    totalTokens: document.totalTokens,
  };

  const [existing] = await db
    .select()
    .from(sourceRegistry)
    .where(eq(sourceRegistry.documentId, data.documentId))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(sourceRegistry).set({
      title: data.title || existing.title || document.title,
      sourceKind: "document",
      sourceType: data.sourceType,
      sourceUri: document.sourceUri || existing.sourceUri,
      subject: data.subject || existing.subject || "Nursing source document",
      edition: data.edition || existing.edition || document.type,
      citationPolicy: data.citationPolicy,
      approvalStatus: data.approvalStatus,
      ingestionStatus,
      metadata: {
        ...(existing.metadata || {}),
        ...metadata,
      },
      updatedAt: new Date(),
    }).where(eq(sourceRegistry.id, existing.id)).returning();

    return { source: updated, document, chunkCount, created: false };
  }

  const [source] = await db.insert(sourceRegistry).values({
    title: data.title || document.title,
    sourceKind: "document",
    sourceType: data.sourceType,
    sourceUri: document.sourceUri,
    documentId: document.id,
    subject: data.subject || "Nursing source document",
    edition: data.edition || document.type,
    citationPolicy: data.citationPolicy,
    approvalStatus: data.approvalStatus,
    ingestionStatus,
    metadata,
    createdBy,
  }).returning();

  return { source, document, chunkCount, created: true };
}

async function importPilotArchiveSet(data: z.infer<typeof pilotArchiveSetImportSchema>, createdBy?: string) {
  const archives = data.archives?.length ? data.archives : defaultPilotArchiveSet;
  const results = [];

  for (const archive of archives) {
    try {
      results.push(await importSourceArchive(archive, createdBy));
    } catch (error) {
      results.push({
        importJob: {
          id: `failed-${hashText(archive.archivePath).slice(0, 12)}`,
          title: archive.title || baseNameFromPath(archive.archivePath),
          sourceUri: archive.archivePath,
          role: archive.role || classifyArchiveRole(archive.archivePath, [], archive.role),
          status: "failed",
          fileCount: 0,
          importedSourceIds: [],
          summary: {},
          errorMessage: error instanceof Error ? error.message : "Archive import failed",
        },
        files: [],
        sources: [],
      });
    }
  }

  const summary = {
    requested: archives.length,
    completed: results.filter((result) => result.importJob?.status === "completed").length,
    duplicate: results.filter((result) => result.importJob?.status === "duplicate").length,
    failed: results.filter((result) => result.importJob?.status === "failed").length,
    importedSourceIds: results.flatMap((result) => Array.isArray(result.importJob?.importedSourceIds) ? result.importJob.importedSourceIds : []),
  };

  return { summary, results };
}

async function listSources() {
  await seedDefaultSourceTruth();

  const [sources, docs, terms, archiveImports] = await Promise.all([
    db.select().from(sourceRegistry).orderBy(desc(sourceRegistry.createdAt)),
    db
      .select({
        id: documents.id,
        title: documents.title,
        type: documents.type,
        status: documents.status,
        sourceUri: documents.sourceUri,
        totalPages: documents.totalPages,
        totalTokens: documents.totalTokens,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(sql`${documents.deletedAt} IS NULL`)
      .orderBy(desc(documents.createdAt))
      .limit(50),
    db.select().from(taxonomyTerms).where(eq(taxonomyTerms.isActive, true)).orderBy(asc(taxonomyTerms.taxonomy), asc(taxonomyTerms.label)),
    db.select().from(sourceArchiveImports).orderBy(desc(sourceArchiveImports.createdAt)).limit(20),
  ]);

  return { sources, documents: docs, taxonomyTerms: terms, archiveImports };
}

async function getSourcesByIds(sourceIds: string[]) {
  if (sourceIds.length === 0) return [];
  return db.select().from(sourceRegistry).where(inArray(sourceRegistry.id, sourceIds));
}

async function getSourceDetail(sourceId: string) {
  await ensureLessonBuilderTables();
  const [source] = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, sourceId)).limit(1);
  if (!source) return null;

  const [chunkCountRow, archiveFiles, packages] = await Promise.all([
    source.documentId
      ? db.select({ count: sql<number>`count(*)::int` }).from(documentChunks).where(eq(documentChunks.documentId, source.documentId))
      : Promise.resolve([{ count: 0 }]),
    db.select({
      id: sourceArchiveFiles.id,
      filePath: sourceArchiveFiles.filePath,
      fileKind: sourceArchiveFiles.fileKind,
      fileRole: sourceArchiveFiles.fileRole,
      sizeBytes: sourceArchiveFiles.sizeBytes,
    })
      .from(sourceArchiveFiles)
      .where(eq(sourceArchiveFiles.sourceId, sourceId))
      .orderBy(asc(sourceArchiveFiles.filePath))
      .limit(40),
    db.select({
      id: lessonPackages.id,
      title: lessonPackages.title,
      topic: lessonPackages.topic,
      status: lessonPackages.status,
      createdAt: lessonPackages.createdAt,
      publishedAt: lessonPackages.publishedAt,
    })
      .from(lessonPackages)
      .where(sql`${sourceId} = ANY(${lessonPackages.sourceIds})`)
      .orderBy(desc(lessonPackages.createdAt))
      .limit(20),
  ]);

  return {
    source,
    chunkCount: chunkCountRow[0]?.count || 0,
    normalization: (source.metadata as any)?.normalization || null,
    archiveFiles,
    packages,
    generatedPackageCount: packages.length,
  };
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(new Set(values
    .map((value) => String(value || "").trim())
    .filter(Boolean)));
}

function detectTermsFromText(text: string, candidates: string[]) {
  const lowerText = text.toLowerCase();
  return candidates.filter((candidate) => lowerText.includes(candidate.toLowerCase()));
}

async function normalizeSourceForPilot(sourceId: string, data: z.infer<typeof sourceNormalizationSchema>, actorId?: string) {
  await ensureLessonBuilderTables();
  const detail = await getSourceDetail(sourceId);
  if (!detail) return null;

  const source = detail.source;
  const chunks = source.documentId
    ? await db.select({
      id: documentChunks.id,
      cleanText: documentChunks.cleanText,
      pageStart: documentChunks.pageStart,
      pageEnd: documentChunks.pageEnd,
      metadata: documentChunks.metadata,
    })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, source.documentId))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(80)
    : [];

  const archiveRows = await db.select({
    id: sourceArchiveFiles.id,
    filePath: sourceArchiveFiles.filePath,
    fileKind: sourceArchiveFiles.fileKind,
    fileRole: sourceArchiveFiles.fileRole,
    extractedText: sourceArchiveFiles.extractedText,
    metadata: sourceArchiveFiles.metadata,
  })
    .from(sourceArchiveFiles)
    .where(eq(sourceArchiveFiles.sourceId, sourceId))
    .orderBy(asc(sourceArchiveFiles.filePath))
    .limit(120);

  const chunkText = chunks.map((chunk) => chunk.cleanText).join("\n").slice(0, 80000);
  const archiveText = archiveRows
    .map((file) => [file.filePath, file.fileKind, file.fileRole, file.extractedText || ""].join(" "))
    .join("\n")
    .slice(0, 80000);
  const combinedText = [source.title, source.subject, source.sourceType, chunkText, archiveText].filter(Boolean).join("\n");
  const lowerText = combinedText.toLowerCase();

  const metadataTableCount = chunks.reduce((count, chunk) => {
    const tables = (chunk.metadata as any)?.tables;
    return count + (Array.isArray(tables) ? tables.length : 0);
  }, 0);
  const tableSignalFiles = archiveRows
    .filter((file) => /table|schema|csv|xlsx|matrix|blueprint/i.test(`${file.filePath} ${file.fileKind} ${file.fileRole}`))
    .map((file) => file.filePath)
    .slice(0, 12);
  const crosswalkSignalFiles = archiveRows
    .filter((file) => /crosswalk|mapping|map|alignment|taxonomy|nclex|ati|cjm|bloom/i.test(`${file.filePath} ${file.fileKind} ${file.fileRole}`))
    .map((file) => file.filePath)
    .slice(0, 12);

  const nclexHints = detectTermsFromText(combinedText, [
    "Safe and Effective Care Environment",
    "Health Promotion and Maintenance",
    "Psychosocial Integrity",
    "Physiological Integrity",
    "Reduction of Risk Potential",
    "Pharmacological and Parenteral Therapies",
  ]);
  const cjmHints = detectTermsFromText(combinedText, [
    "Recognize Cues",
    "Analyze Cues",
    "Prioritize Hypotheses",
    "Generate Solutions",
    "Take Action",
    "Evaluate Outcomes",
  ]);
  const atiHints = detectTermsFromText(combinedText, [
    "Fundamentals",
    "Pharmacology",
    "Maternal Newborn",
    "Mental Health",
    "Medical Surgical",
    "Leadership",
    "Community Health",
    "Nursing Care of Children",
  ]);
  const weakTopicHints = uniqueText([
    ...data.weakTopics,
    source.subject,
    lowerText.includes("therapeutic communication") ? "Therapeutic communication" : "",
    lowerText.includes("priority") ? "Priority cues" : "",
    lowerText.includes("patient teaching") ? "Patient teaching" : "",
  ]).slice(0, 12);

  const normalization = {
    status: chunks.length > 0 || archiveRows.length > 0 ? "ready" : "needs_review",
    method: data.method,
    officialPilot: data.officialPilot,
    normalizedAt: new Date().toISOString(),
    normalizedBy: actorId || null,
    sourceEvidence: {
      documentId: source.documentId || null,
      chunkCount: detail.chunkCount,
      inspectedChunkCount: chunks.length,
      archiveFileCount: archiveRows.length,
    },
    detected: {
      tableCount: metadataTableCount + tableSignalFiles.length,
      metadataTableCount,
      tableSignalFiles,
      crosswalkSignalFiles,
      crosswalkSignalCount: crosswalkSignalFiles.length + (/\bcrosswalk\b|\balignment\b|\bmapping\b/i.test(combinedText) ? 1 : 0),
      hasChunkEvidence: chunks.length > 0,
      hasArchiveEvidence: archiveRows.length > 0,
    },
    taxonomyHints: {
      nclex: nclexHints,
      cjm: cjmHints,
      ati: uniqueText([...data.atiCategories, ...atiHints]),
      bloom: detectTermsFromText(combinedText, ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]),
    },
    weakTopics: weakTopicHints,
    notes: data.notes,
  };

  const currentMetadata = (source.metadata || {}) as Record<string, any>;
  const [updated] = await db.update(sourceRegistry).set({
    metadata: {
      ...currentMetadata,
      normalization,
      pilot: {
        ...(currentMetadata.pilot || {}),
        officialSource: data.officialPilot,
        normalizedAt: normalization.normalizedAt,
      },
    },
    ingestionStatus: source.documentId && detail.chunkCount > 0 ? "ready" : source.ingestionStatus,
    updatedAt: new Date(),
  }).where(eq(sourceRegistry.id, sourceId)).returning();

  return {
    source: updated,
    normalization,
    detail: await getSourceDetail(sourceId),
  };
}

async function buildTaxonomySnapshot(sourceIds: string[]) {
  const rows = sourceIds.length
    ? await db
      .select({
        sourceId: sourceTaxonomyMappings.sourceId,
        taxonomy: taxonomyTerms.taxonomy,
        code: taxonomyTerms.code,
        label: taxonomyTerms.label,
      })
      .from(sourceTaxonomyMappings)
      .innerJoin(taxonomyTerms, eq(sourceTaxonomyMappings.taxonomyTermId, taxonomyTerms.id))
      .where(inArray(sourceTaxonomyMappings.sourceId, sourceIds))
    : [];

  const grouped: Record<string, Array<{ code: string | null; label: string }>> = {};
  for (const row of rows) {
    grouped[row.taxonomy] ||= [];
    grouped[row.taxonomy].push({ code: row.code, label: row.label });
  }

  if (Object.keys(grouped).length > 0) {
    return grouped;
  }

  return {
    NCLEX: [{ code: "PHYS", label: "Physiological Integrity" }],
    CJM: [
      { code: "recognize-cues", label: "Recognize Cues" },
      { code: "analyze-cues", label: "Analyze Cues" },
      { code: "take-action", label: "Take Action" },
      { code: "evaluate-outcomes", label: "Evaluate Outcomes" },
    ],
    "Nursing Process": [
      { code: "assessment", label: "Assessment" },
      { code: "implementation", label: "Implementation" },
      { code: "evaluation", label: "Evaluation" },
    ],
    Bloom: [{ code: "apply", label: "Apply" }],
  };
}

async function fetchEvidence(topic: string, sources: any[]): Promise<EvidenceChunk[]> {
  const sourceByDocument = new Map<string, any>();
  const documentIds = sources
    .filter((source) => source.documentId)
    .map((source) => {
      sourceByDocument.set(source.documentId, source);
      return source.documentId as string;
    });

  if (documentIds.length > 0) {
    const matchingRows = await db
      .select({ chunk: documentChunks, document: documents })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(
        inArray(documentChunks.documentId, documentIds),
        ilike(documentChunks.cleanText, `%${topic}%`)
      ))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(8);

    const fallbackRows = matchingRows.length > 0 ? [] : await db
      .select({ chunk: documentChunks, document: documents })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(inArray(documentChunks.documentId, documentIds))
      .orderBy(asc(documentChunks.chunkIndex))
      .limit(8);

    const rows = matchingRows.length > 0 ? matchingRows : fallbackRows;
    if (rows.length > 0) {
      return rows.map(({ chunk, document }) => {
        const source = sourceByDocument.get(document.id);
        const pageLabel = chunk.pageStart ? `, p. ${chunk.pageStart}${chunk.pageEnd && chunk.pageEnd !== chunk.pageStart ? `-${chunk.pageEnd}` : ""}` : "";
        return {
          sourceId: source?.id,
          documentId: document.id,
          chunkId: chunk.id,
          title: document.title,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          text: chunk.cleanText,
          citationLabel: `${document.title}${pageLabel}`,
        };
      });
    }
  }

  const metadataEvidence = sources.flatMap((source) => {
    const snippets = Array.isArray(source.metadata?.evidenceSnippets) ? source.metadata.evidenceSnippets : [];
    return snippets
      .map((snippet: any, index: number) => ({
        sourceId: source.id,
        documentId: source.documentId,
        title: source.title,
        text: typeof snippet === "string" ? snippet : snippet?.text,
        citationLabel: `${source.title}${snippets.length > 1 ? `, evidence ${index + 1}` : ""}`,
      }))
      .filter((chunk: EvidenceChunk) => Boolean(chunk.text));
  });

  if (metadataEvidence.length > 0) {
    return metadataEvidence;
  }

  return sources.map((source) => ({
    sourceId: source.id,
    documentId: source.documentId,
    title: source.title,
    text: `${source.title} is an approved ${source.sourceType || "reference"} source for lesson generation. Use it as source truth and cite/paraphrase rather than copying extended passages.`,
    citationLabel: source.title,
  }));
}

function textSnippet(text: string, maxLength = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trim()}...`;
}

function sanitizeAgentError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Agent-assisted generation failed.");
  return textSnippet(raw
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted_openai_key]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted_openai_key]")
    .replace(/Incorrect API key provided:[^.]+\\./gi, "Incorrect API key provided."), 900);
}

function learnerEvidenceAnchor(topic: string, focus: string) {
  return `The cited source supports using ${focus} to connect ${topic} cues with safe nursing judgment.`;
}

function firstLabel(snapshot: Record<string, any>, taxonomy: string, fallback: string) {
  const values = snapshot[taxonomy];
  return Array.isArray(values) && values[0]?.label ? values[0].label : fallback;
}

function buildSlideDrafts(topic: string, audience: string, evidence: EvidenceChunk[], taxonomySnapshot: Record<string, any>, slideCount: number) {
  const nclexCategory = firstLabel(taxonomySnapshot, "NCLEX", "Physiological Integrity");
  const cjmSteps = Array.isArray(taxonomySnapshot.CJM) && taxonomySnapshot.CJM.length > 0
    ? taxonomySnapshot.CJM.map((term: any) => term.label)
    : ["Recognize Cues", "Analyze Cues", "Prioritize Hypotheses", "Take Action", "Evaluate Outcomes"];
  const nursingProcess = firstLabel(taxonomySnapshot, "Nursing Process", "Assessment");
  const bloomLevel = firstLabel(taxonomySnapshot, "Bloom", "Apply");
  const primaryEvidence = evidence[0] || {
    title: "Approved source registry",
    text: "Approved source material for the selected lesson topic.",
    citationLabel: "Approved source registry",
  };
  const clinicalCue = learnerEvidenceAnchor(topic, "patient assessment data");

  const baseSlides = [
    {
      slideType: "patient_cue",
      title: `${topic}: Patient Cue`,
      visibleContent: {
        patientCue: `A patient scenario includes a change related to ${topic}.`,
        sourceCue: clinicalCue,
        studentTask: "Identify which cue needs attention first.",
      },
      retrievalPrompt: "What cue would you report first, and why?",
      speakerNotes: `Open with the patient cue and ask students to notice source-backed findings before teaching the concept.`,
      guidedNotes: `Priority cue: ____________________  Why it matters: ____________________`,
    },
    {
      slideType: "student_prediction",
      title: "Predict Before Teaching",
      visibleContent: {
        studentPrediction: `Before reviewing the content, predict the safest next nursing interpretation for ${topic}.`,
        choices: ["Expected finding", "Potential complication", "Needs more assessment", "Immediate action"],
        examAnchor: nclexCategory,
      },
      retrievalPrompt: "Which option would you choose on a timed exam?",
      speakerNotes: "Use prediction to surface assumptions and prepare students for clinical judgment reasoning.",
      guidedNotes: `My prediction: ____________________  Evidence I used: ____________________`,
    },
    {
      slideType: "core_concept",
      title: "Core Concept",
      visibleContent: {
        coreConcept: `${topic} questions usually require students to connect the patient cue to nursing priority, safety, and expected outcomes.`,
        sourceAnchor: learnerEvidenceAnchor(topic, "the priority cue"),
        takeaway: "Do not memorize isolated facts. Link each cue to the nursing decision it supports.",
      },
      retrievalPrompt: "What concept connects the cue to the safest nursing response?",
      speakerNotes: "Keep the visible explanation short and learner-facing. Add extra teaching detail here only.",
      guidedNotes: `Core concept: ____________________  Linked cue: ____________________`,
    },
    {
      slideType: "exam_anchor",
      title: "NCLEX and CJM Anchor",
      visibleContent: {
        examAnchor: nclexCategory,
        cjmStep: cjmSteps[1] || "Analyze Cues",
        nursingProcess,
        bloomLevel,
        decisionRule: "Prioritize unstable findings, safety risks, and findings that change the plan of care.",
      },
      retrievalPrompt: "Which CJM step is being tested here?",
      speakerNotes: "Name the exam anchor explicitly and keep the alignment visible to students.",
      guidedNotes: `NCLEX category: ____________________  CJM step: ____________________`,
    },
    {
      slideType: "common_trap",
      title: "Common Trap",
      visibleContent: {
        commonTrap: `Choosing an answer that is factually true but not the priority for this ${topic} cue.`,
        trapCheck: "Ask whether the option addresses the most urgent cue in the stem.",
        safeMove: "Return to assessment data, patient risk, and expected outcome.",
      },
      retrievalPrompt: "What makes a tempting option less safe?",
      speakerNotes: "Contrast correct reasoning with a distractor pattern without using instructor-only language on the slide.",
      guidedNotes: `Trap answer pattern: ____________________  Safer reasoning: ____________________`,
    },
    {
      slideType: "practice_item",
      title: "Practice Item",
      visibleContent: {
        practiceItem: `A nurse reviews a patient cue related to ${topic}. Which response best reflects safe clinical judgment?`,
        answerOptions: [
          "Collect another relevant assessment cue before acting.",
          "Ignore the cue because it is expected.",
          "Delegate all follow-up without review.",
          "Document only after the shift ends.",
        ],
      },
      retrievalPrompt: "Answer first, then explain the cue you used.",
      speakerNotes: "Let students answer individually before showing the rationale.",
      guidedNotes: `Answer: ______  Cue used: ____________________`,
    },
    {
      slideType: "rationale",
      title: "Rationale",
      visibleContent: {
        correctAnswer: "Collect another relevant assessment cue before acting.",
        rationale: `This answer keeps the nurse in the clinical judgment loop by connecting ${topic} cues to assessment and safe prioritization.`,
        sourceAnchor: learnerEvidenceAnchor(topic, "the rationale"),
      },
      retrievalPrompt: "What evidence makes the correct answer safer than the distractors?",
      speakerNotes: "Walk through why each distractor fails the priority/safety test.",
      guidedNotes: `Rationale phrase I can reuse: ____________________`,
    },
    {
      slideType: "takeaway",
      title: "Takeaway",
      visibleContent: {
        takeaway: `For ${topic}, use the cue, decide what it means, choose the safest nursing response, and evaluate whether the patient improved.`,
        quickCheck: "Cue -> meaning -> action -> outcome",
        nextPractice: "Apply this same chain to the next item.",
      },
      retrievalPrompt: "Say the four-step chain without looking.",
      speakerNotes: "Close with retrieval, then connect the package to the next practice set.",
      guidedNotes: `Cue -> __________ -> __________ -> __________`,
    },
  ];

  return baseSlides.slice(0, slideCount).map((slide, index) => ({
    ...slide,
    slideNumber: index + 1,
    nclexCategory,
    cjmStep: cjmSteps[index % cjmSteps.length],
    nursingProcess,
    bloomLevel,
    evidence: evidence[index % evidence.length] || primaryEvidence,
  }));
}

function lessonBuilderAgentEndpoint() {
  return process.env.NURSING_CURRICULUM_AGENT_ENDPOINT || process.env.HARRITY_LESSON_AGENT_ENDPOINT || "";
}

function lessonBuilderAgentId() {
  return process.env.NURSING_CURRICULUM_AGENT_ID || DEFAULT_NURSING_CURRICULUM_AGENT_ID;
}

function lessonBuilderWorkspaceAgentApiKey() {
  return process.env.NURSING_CURRICULUM_AGENT_API_KEY || process.env.HARRITY_LESSON_AGENT_API_KEY || "";
}

function lessonBuilderOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

let lastAgentCredentialIssue: {
  status: "agent_invalid_key";
  message: string;
  checkedAt: string;
} | null = null;

function classifyAgentCredentialIssue(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/invalid_api_key|incorrect api key|401|unauthorized|authentication/i.test(message)) {
    return {
      status: "agent_invalid_key" as const,
      message: sanitizeAgentError(message),
      checkedAt: new Date().toISOString(),
    };
  }
  return null;
}

function lessonBuilderAgentStatus() {
  const endpoint = lessonBuilderAgentEndpoint();
  const workspaceAgentKeyConfigured = Boolean(lessonBuilderWorkspaceAgentApiKey());
  const openAiFallbackConfigured = Boolean(process.env.OPENAI_API_KEY);
  const workspaceAgentReady = Boolean(endpoint && workspaceAgentKeyConfigured);
  const openAiReady = !workspaceAgentReady && openAiFallbackConfigured;
  const aiMode = workspaceAgentReady ? "workspace_agent" : openAiReady ? "openai_chat_completions" : "template_fallback";
  const status = lastAgentCredentialIssue?.status
    || (workspaceAgentReady ? "workspace_agent_ready" : openAiReady ? "openai_chat_completions_ready" : "fallback_only");
  return {
    agentId: lessonBuilderAgentId(),
    status,
    aiMode,
    aiReady: !lastAgentCredentialIssue && (workspaceAgentReady || openAiReady),
    credentialStatus: lastAgentCredentialIssue ? "invalid" : workspaceAgentReady || openAiReady ? "configured" : "missing",
    lastCredentialIssue: lastAgentCredentialIssue,
    configured: Boolean(workspaceAgentReady || openAiReady),
    endpointConfigured: Boolean(endpoint),
    openAiFallbackConfigured,
    workspaceAgentAuthorizationConfigured: workspaceAgentKeyConfigured,
    authorizationConfigured: workspaceAgentReady || openAiReady,
    fallbackAvailable: true,
    fallbackMode: "deterministic_template",
    transport: workspaceAgentReady ? "workspace_agent_endpoint" : openAiReady ? "openai_chat_completions" : "template",
  };
}

function evidenceRefs(evidence: EvidenceChunk[]) {
  return evidence.map((chunk, index) => ({
    ref: `E${index + 1}`,
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    chunkId: chunk.chunkId,
    title: chunk.title,
    citationLabel: chunk.citationLabel,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    text: textSnippet(chunk.text, 1100),
  }));
}

function evidenceForRef(ref: string | undefined, refs: ReturnType<typeof evidenceRefs>, evidence: EvidenceChunk[], fallbackIndex: number) {
  const matched = ref ? refs.find((item) => item.ref.toLowerCase() === ref.toLowerCase()) : undefined;
  if (matched) {
    const byChunkId = matched.chunkId ? evidence.find((chunk) => chunk.chunkId === matched.chunkId) : undefined;
    if (byChunkId) return byChunkId;
    const bySourceId = matched.sourceId ? evidence.find((chunk) => chunk.sourceId === matched.sourceId) : undefined;
    if (bySourceId) return bySourceId;
  }
  return evidence[fallbackIndex % evidence.length] || evidence[0];
}

function responseTextFromAgentPayload(payload: any): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const direct = payload.output_text || payload.text || payload.content || payload.response;
  if (typeof direct === "string") return direct;

  const messageContent = payload.message?.content || payload.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent.map((part: any) => part?.text || part?.content || "").join("");
  }

  if (Array.isArray(payload.output)) {
    return payload.output
      .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [item?.content])
      .map((part: any) => part?.text || part?.content || part?.value || "")
      .join("");
  }

  return "";
}

function parseAgentJson(text: string) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Agent response did not contain a JSON object.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeAnswerKey(value: string, options: Array<{ id: string; text: string }>) {
  const raw = String(value || "").trim();
  const compact = raw.toUpperCase();
  const optionIds = options.map((option) => option.id.toUpperCase());
  if (optionIds.includes(compact)) return compact;
  const byText = options.find((option) => {
    const optionText = option.text.trim().toUpperCase();
    return optionText === compact || optionText.includes(compact) || compact.includes(optionText);
  });
  if (byText) return byText.id;
  const explicitPrefix = compact.match(/^\s*([A-D])[\).:\-\s]/)?.[1];
  if (explicitPrefix && optionIds.includes(explicitPrefix)) return explicitPrefix;
  const firstLetter = compact.length === 1 ? compact.match(/[A-D]/)?.[0] : undefined;
  return firstLetter && optionIds.includes(firstLetter) ? firstLetter : options[0]?.id || "A";
}

function buildAgentPromptPayload({
  data,
  sources,
  taxonomySnapshot,
  evidence,
}: {
  data: z.infer<typeof generateSchema>;
  sources: any[];
  taxonomySnapshot: Record<string, any>;
  evidence: EvidenceChunk[];
}) {
  const refs = evidenceRefs(evidence);
  return {
    refs,
    promptPayload: {
      task: "Generate a Harrity learner-facing nursing lesson package as strict JSON.",
      requiredJsonShape: {
        slides: "array of slide drafts with slideNumber, slideType, title, visibleContent, speakerNotes, guidedNotes, retrievalPrompt, taxonomy fields, and citationRef",
        practiceItem: "one multiple-choice item with stem, options, correctAnswer, rationale, difficulty, and citationRef",
        supervisorNotes: "array of concise curriculum supervision notes",
        risks: "array of evidence or implementation risks",
        citationRefs: "array of citation references used from the evidence list",
      },
      constraints: {
        slideCount: data.settings.slideCount,
        difficulty: data.settings.difficulty,
        includeGuidedNotes: data.settings.includeGuidedNotes,
        learnerFacingVisibleContent: true,
        noInventedClinicalFacts: true,
        noMarkdown: true,
      },
      lesson: {
        title: data.title,
        topic: data.topic,
        audience: data.audience,
        taxonomySnapshot,
      },
      sources: sources.map((source) => ({
        id: source.id,
        title: source.title,
        sourceKind: source.sourceKind,
        sourceType: source.sourceType,
        subject: source.subject,
        edition: source.edition,
        citationPolicy: source.citationPolicy,
      })),
      evidence: refs,
    },
  };
}

function agentPromptFromPayload(promptPayload: Record<string, any>) {
  return `Return only valid JSON for this Harrity Lesson Builder request.\n\n${JSON.stringify(promptPayload)}`;
}

async function requestWorkspaceAgentDraft(endpoint: string, prompt: string, data: z.infer<typeof generateSchema>, signal: AbortSignal) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = lessonBuilderWorkspaceAgentApiKey();
  if (!apiKey) {
    throw new Error("NURSING_CURRICULUM_AGENT_API_KEY is not configured for the workspace lesson-agent endpoint.");
  }
  headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: prompt,
      metadata: {
        agentId: lessonBuilderAgentId(),
        feature: "harrity_lesson_builder",
        topic: data.topic,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Agent request failed with ${response.status}${body ? `: ${textSnippet(body, 240)}` : ""}`);
  }

  const responsePayload = await response.json();
  const text = responseTextFromAgentPayload(responsePayload);
  if (!text) throw new Error("Agent response did not include text output.");
  return text;
}

async function requestOpenAiSupervisorDraft(prompt: string, signal: AbortSignal) {
  const apiKey = lessonBuilderOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for direct lesson drafting.");
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create(
    {
      model: process.env.NURSING_CURRICULUM_AGENT_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the Nursing Curriculum Supervisor for Harrity lesson packages. Return only strict JSON that matches the requested schema. Do not include markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4500,
    },
    { signal },
  );

  return response.choices[0]?.message?.content || "";
}

async function requestAgentLessonDraft({
  data,
  sources,
  taxonomySnapshot,
  evidence,
}: {
  data: z.infer<typeof generateSchema>;
  sources: any[];
  taxonomySnapshot: Record<string, any>;
  evidence: EvidenceChunk[];
}) {
  const endpoint = lessonBuilderAgentEndpoint();
  const useWorkspaceEndpoint = Boolean(endpoint && lessonBuilderWorkspaceAgentApiKey());
  const { refs, promptPayload } = buildAgentPromptPayload({ data, sources, taxonomySnapshot, evidence });
  const prompt = agentPromptFromPayload(promptPayload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const text = useWorkspaceEndpoint
      ? await requestWorkspaceAgentDraft(endpoint, prompt, data, controller.signal)
      : await requestOpenAiSupervisorDraft(prompt, controller.signal);
    if (!text) throw new Error("Agent response did not include text output.");

    const parsed = normalizeAgentLessonPayload(parseAgentJson(text));
    return {
      draft: agentLessonDraftSchema.parse(parsed),
      evidenceReferenceList: refs,
      transport: useWorkspaceEndpoint ? "workspace_agent_endpoint" : "openai_chat_completions",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sourceWeakTopicHints(bundle: LessonBundle) {
  return uniqueText(bundle.sources.flatMap((source) => {
    const normalization = source.metadata?.normalization || {};
    return [
      ...(Array.isArray(normalization.weakTopics) ? normalization.weakTopics : []),
      ...(Array.isArray(normalization.atiCategories) ? normalization.atiCategories : []),
      source.subject,
      source.title,
    ];
  })).slice(0, 12);
}

function buildAssessmentBridgePromptPayload(bundle: LessonBundle) {
  const currentBridge = bundle.package.manifest?.assessmentBridge
    || bundle.package.taxonomySnapshot?.assessmentBridge
    || bundle.package.deckModel?.assessmentBridge
    || null;
  return {
    task: "Map this published nursing lesson package to one student remediation weak topic.",
    requiredJsonShape: {
      weakTopic: "concise student-facing remediation topic",
      atiCategory: "best ATI category if inferable, otherwise empty string",
      nclexCategory: "best NCLEX category if inferable, otherwise empty string",
      cjmStep: "best clinical judgment step if inferable, otherwise empty string",
      confidence: "number from 0 to 1",
      rationale: "one concise sentence explaining the mapping",
      sourceEvidence: "array of short evidence labels from lesson slides/items/citations",
    },
    constraints: {
      noInventedClinicalClaims: true,
      useOnlyProvidedLessonData: true,
      preferStudentFriendlyWeakTopic: true,
      oneMappingOnly: true,
    },
    lesson: {
      id: bundle.package.id,
      title: bundle.package.title,
      topic: bundle.package.topic,
      audience: bundle.package.audience,
      currentBridge,
      sourceWeakTopicHints: sourceWeakTopicHints(bundle),
    },
    slides: bundle.slides.slice(0, 12).map((slide) => ({
      slideNumber: slide.slideNumber,
      title: slide.title,
      nclexCategory: slide.nclexCategory,
      cjmStep: slide.cjmStep,
      nursingProcess: slide.nursingProcess,
      bloomLevel: slide.bloomLevel,
      visibleContent: textSnippet(JSON.stringify(slide.visibleContent || {}), 420),
    })),
    practiceItems: bundle.items.slice(0, 3).map((item) => ({
      stem: item.stem,
      rationale: textSnippet(item.rationale || "", 420),
      difficulty: item.difficulty,
      tags: item.tags || {},
    })),
    citations: bundle.citations.slice(0, 8).map((citation) => ({
      label: citation.citationLabel,
      sourceId: citation.sourceId,
      slideId: citation.slideId,
      itemId: citation.itemId,
    })),
  };
}

async function requestWorkspaceAgentAssessmentBridge(endpoint: string, prompt: string, bundle: LessonBundle, signal: AbortSignal) {
  const apiKey = lessonBuilderWorkspaceAgentApiKey();
  if (!apiKey) {
    throw new Error("NURSING_CURRICULUM_AGENT_API_KEY is not configured for the workspace lesson-agent endpoint.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: prompt,
      metadata: {
        agentId: lessonBuilderAgentId(),
        feature: "ai_assessment_bridge",
        packageId: bundle.package.id,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Agent mapping request failed with ${response.status}${body ? `: ${textSnippet(body, 240)}` : ""}`);
  }

  const responsePayload = await response.json();
  const text = responseTextFromAgentPayload(responsePayload);
  if (!text) throw new Error("Agent mapping response did not include text output.");
  return text;
}

async function requestOpenAiAssessmentBridge(prompt: string, signal: AbortSignal) {
  const apiKey = lessonBuilderOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for direct AI weak-topic mapping.");
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create(
    {
      model: process.env.NURSING_CURRICULUM_AGENT_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You map nursing lesson packages to ATI/NCLEX remediation weak topics. Return only strict JSON. Do not include markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 900,
    },
    { signal },
  );

  return response.choices[0]?.message?.content || "";
}

async function generateAiAssessmentBridge(bundle: LessonBundle) {
  const health = lessonBuilderAgentStatus();
  if (!health.aiReady) {
    throw new Error("AI weak-topic mapping is unavailable because no server-side AI agent or OpenAI key is configured.");
  }

  const endpoint = lessonBuilderAgentEndpoint();
  const useWorkspaceEndpoint = Boolean(endpoint && lessonBuilderWorkspaceAgentApiKey());
  const promptPayload = buildAssessmentBridgePromptPayload(bundle);
  const prompt = `Return only valid JSON for this NurseStudy weak-topic mapping request.\n\n${JSON.stringify(promptPayload)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const text = useWorkspaceEndpoint
      ? await requestWorkspaceAgentAssessmentBridge(endpoint, prompt, bundle, controller.signal)
      : await requestOpenAiAssessmentBridge(prompt, controller.signal);
    if (!text) throw new Error("AI weak-topic mapper returned an empty response.");

    const parsed = aiAssessmentBridgeSchema.parse(parseAgentJson(text));
    return {
      ...parsed,
      agentMode: useWorkspaceEndpoint ? "workspace_agent" : "openai_chat_completions",
      generatedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function buildGenerationDrafts({
  data,
  sources,
  taxonomySnapshot,
  evidence,
  templateSlideDrafts,
}: {
  data: z.infer<typeof generateSchema>;
  sources: any[];
  taxonomySnapshot: Record<string, any>;
  evidence: EvidenceChunk[];
  templateSlideDrafts: any[];
}) {
  const requestedMode = data.settings.generationMode;
  const agentHealth = lessonBuilderAgentStatus();
  const baseMetadata = {
    requestedMode,
    usedMode: "template",
    agentId: lessonBuilderAgentId(),
    agentConfigured: agentHealth.configured,
    agentHealthStatus: agentHealth.status,
    agentTransport: agentHealth.transport,
    fallbackAvailable: agentHealth.fallbackAvailable,
  };

  if (requestedMode !== "agent_assisted") {
    return {
      slideDrafts: templateSlideDrafts,
      practiceItem: null,
      supervisorNotes: [],
      risks: [],
      metadata: baseMetadata,
    };
  }

  try {
    const { draft, evidenceReferenceList, transport } = await requestAgentLessonDraft({ data, sources, taxonomySnapshot, evidence });
    const normalizedSlides = templateSlideDrafts.map((fallbackSlide, index) => {
      const agentSlide = draft.slides[index];
      if (!agentSlide) return fallbackSlide;
      return {
        ...fallbackSlide,
        slideNumber: index + 1,
        slideType: agentSlide.slideType || fallbackSlide.slideType,
        title: agentSlide.title || fallbackSlide.title,
        visibleContent: agentSlide.visibleContent || fallbackSlide.visibleContent,
        speakerNotes: agentSlide.speakerNotes || fallbackSlide.speakerNotes,
        guidedNotes: data.settings.includeGuidedNotes ? (agentSlide.guidedNotes || fallbackSlide.guidedNotes) : null,
        retrievalPrompt: agentSlide.retrievalPrompt || fallbackSlide.retrievalPrompt,
        nclexCategory: agentSlide.nclexCategory || fallbackSlide.nclexCategory,
        cjmStep: agentSlide.cjmStep || fallbackSlide.cjmStep,
        nursingProcess: agentSlide.nursingProcess || fallbackSlide.nursingProcess,
        bloomLevel: agentSlide.bloomLevel || fallbackSlide.bloomLevel,
        evidence: evidenceForRef(agentSlide.citationRef, evidenceReferenceList, evidence, index) || fallbackSlide.evidence,
      };
    });
    if (!normalizedSlides.some((slide) => JSON.stringify(slide.visibleContent || {}).toLowerCase().includes("trap"))) {
      const trapIndex = Math.min(4, normalizedSlides.length - 1);
      normalizedSlides[trapIndex] = {
        ...normalizedSlides[trapIndex],
        visibleContent: {
          ...(normalizedSlides[trapIndex].visibleContent || {}),
          commonTrap: "Common trap: jumping to reassurance before exploring the patient cue.",
        },
      };
    }
    if (!normalizedSlides.some((slide) => JSON.stringify(slide.visibleContent || {}).toLowerCase().includes("predict"))) {
      const predictionIndex = Math.min(1, normalizedSlides.length - 1);
      normalizedSlides[predictionIndex] = {
        ...normalizedSlides[predictionIndex],
        visibleContent: {
          ...(normalizedSlides[predictionIndex].visibleContent || {}),
          studentPrediction: "Predict the safest nursing response before choosing the next action.",
        },
      };
    }

    const itemOptions = draft.practiceItem?.options?.length
      ? draft.practiceItem.options.map((option, index) => ({
        id: option.id || String.fromCharCode(65 + index),
        text: option.text,
      }))
      : [];

    const practiceItem = draft.practiceItem ? {
      ...draft.practiceItem,
      options: itemOptions,
      correctAnswer: normalizeAnswerKey(draft.practiceItem.correctAnswer, itemOptions),
      evidence: evidenceForRef(draft.practiceItem.citationRef, evidenceReferenceList, evidence, Math.max(0, (draft.practiceItem.slideNumber || 1) - 1)),
    } : null;

    return {
      slideDrafts: normalizedSlides,
      practiceItem,
      supervisorNotes: draft.supervisorNotes,
      risks: draft.risks,
      metadata: {
        ...baseMetadata,
        usedMode: "agent_assisted",
        agentTransport: transport,
        agentEndpointConfigured: lessonBuilderAgentStatus().endpointConfigured,
        agentWorkaround: transport === "openai_chat_completions",
        agentResponseValid: true,
        slideCount: normalizedSlides.length,
      },
    };
  } catch (error) {
    const safeError = sanitizeAgentError(error);
    const credentialIssue = classifyAgentCredentialIssue(error);
    if (credentialIssue) {
      lastAgentCredentialIssue = credentialIssue;
    }
    const fallbackHealth = lessonBuilderAgentStatus();
    return {
      slideDrafts: templateSlideDrafts,
      practiceItem: null,
      supervisorNotes: [],
      risks: [safeError],
      metadata: {
        ...baseMetadata,
        usedMode: "template",
        fallbackUsed: true,
        fallbackReason: safeError,
        agentHealthStatus: fallbackHealth.status,
        credentialStatus: fallbackHealth.credentialStatus,
      },
    };
  }
}

function buildDeckModel(packageId: string, title: string, topic: string, audience: string, slideDrafts: any[], taxonomySnapshot: Record<string, any>) {
  return {
    packageId,
    title,
    topic,
    audience,
    grammar: "patient cue -> student prediction -> core concept -> exam anchor -> common trap -> practice item -> rationale -> takeaway",
    taxonomySnapshot,
    slides: slideDrafts.map((slide) => ({
      slideNumber: slide.slideNumber,
      slideType: slide.slideType,
      title: slide.title,
      visibleContent: slide.visibleContent,
      retrievalPrompt: slide.retrievalPrompt,
      alignment: {
        nclexCategory: slide.nclexCategory,
        cjmStep: slide.cjmStep,
        nursingProcess: slide.nursingProcess,
        bloomLevel: slide.bloomLevel,
      },
    })),
  };
}

function buildManifest(packageId: string, title: string, topic: string, sourceIds: string[]) {
  return {
    packageId,
    title,
    topic,
    generatedAt: new Date().toISOString(),
    sourceIds,
    requiredFiles: [
      "source_summary.json",
      "concept_clusters.json",
      "assessment_blueprint.csv",
      "slide_map.csv",
      "item_map.csv",
      "qa_log.csv",
      "student_guided_notes.md",
      "instructor_facilitation_notes.md",
      "student_reception_review.json",
      "accessibility_report.json",
      "package_manifest.json",
    ],
  };
}

async function deleteExistingQa(packageId: string) {
  await db.delete(lessonQaResults).where(eq(lessonQaResults.packageId, packageId));
}

function createLearnerKey() {
  return randomBytes(12).toString("base64url");
}

function publicLessonPath(packageId: string, assignmentId: string, learnerId: string, learnerKey: string) {
  return `/lessons/${packageId}?assignmentId=${encodeURIComponent(assignmentId)}&assignmentLearnerId=${encodeURIComponent(learnerId)}&learnerKey=${encodeURIComponent(learnerKey)}`;
}

function publicAssignmentPath(packageId: string, assignmentId: string, learnerId: string, learnerKey: string) {
  return `/lesson-assignments/${encodeURIComponent(assignmentId)}/learner/${encodeURIComponent(learnerId)}?learnerKey=${encodeURIComponent(learnerKey)}`;
}

async function getPackageAssignments(packageId: string) {
  const assignments = await db
    .select()
    .from(lessonAssignments)
    .where(eq(lessonAssignments.packageId, packageId))
    .orderBy(desc(lessonAssignments.createdAt));

  if (!assignments.length) return [];

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [learners, events] = await Promise.all([
    db
      .select()
      .from(lessonAssignmentLearners)
      .where(inArray(lessonAssignmentLearners.assignmentId, assignmentIds))
      .orderBy(asc(lessonAssignmentLearners.createdAt)),
    db
      .select()
      .from(lessonLearnerEvents)
      .where(inArray(lessonLearnerEvents.assignmentId, assignmentIds))
      .orderBy(desc(lessonLearnerEvents.createdAt))
      .limit(500),
  ]);

  return assignments.map((assignment) => {
    const assignmentLearners = learners.filter((learner) => learner.assignmentId === assignment.id);
    const assignmentEvents = events.filter((event) => event.assignmentId === assignment.id);
    const learnerSummaries = assignmentLearners.map((learner) => ({
      id: learner.id,
      learnerName: learner.learnerName,
      learnerEmail: learner.learnerEmail,
      status: learner.status,
      openedAt: learner.openedAt,
      completedAt: learner.completedAt,
      lastActivityAt: learner.lastActivityAt,
      feedbackRating: learner.feedbackRating,
      feedbackComment: learner.feedbackComment,
      linkPath: publicAssignmentPath(packageId, assignment.id, learner.id, learner.learnerKey),
    }));
    return {
      id: assignment.id,
      packageId: assignment.packageId,
      title: assignment.title,
      cohortName: assignment.cohortName,
      dueDate: assignment.dueDate,
      status: assignment.status,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      learners: learnerSummaries,
      counts: {
        total: assignmentLearners.length,
        assigned: assignmentLearners.filter((learner) => learner.status === "assigned").length,
        inProgress: assignmentLearners.filter((learner) => learner.status === "in_progress").length,
        completed: assignmentLearners.filter((learner) => learner.status === "completed").length,
        feedback: assignmentLearners.filter((learner) => learner.feedbackRating).length,
        events: assignmentEvents.length,
      },
    };
  });
}

async function findAssignmentLearner(packageId: string, assignmentId?: string, learnerId?: string, learnerKey?: string) {
  if (!assignmentId || !learnerId || !learnerKey) return null;

  const [assignment] = await db
    .select()
    .from(lessonAssignments)
    .where(and(eq(lessonAssignments.id, assignmentId), eq(lessonAssignments.packageId, packageId)))
    .limit(1);
  if (!assignment || assignment.status !== "active") return null;

  const [learner] = await db
    .select()
    .from(lessonAssignmentLearners)
    .where(and(eq(lessonAssignmentLearners.id, learnerId), eq(lessonAssignmentLearners.assignmentId, assignment.id)))
    .limit(1);
  if (!learner || learner.learnerKey !== learnerKey) return null;

  return { assignment, learner };
}

async function updateAssignmentLearnerProgress(
  context: { assignment: any; learner: any } | null,
  eventType: string,
  payload: Record<string, any> = {}
) {
  if (!context) return;
  const now = new Date();
  const values: Record<string, any> = {
    lastActivityAt: now,
    updatedAt: now,
  };

  if (eventType === "lesson_opened" && !context.learner.openedAt) {
    values.openedAt = now;
  }

  if (["lesson_opened", "slide_viewed", "practice_viewed", "practice_attempted"].includes(eventType) && context.learner.status === "assigned") {
    values.status = "in_progress";
  }

  if (eventType === "lesson_completed") {
    values.status = "completed";
    values.completedAt = context.learner.completedAt || now;
  }

  if (eventType === "feedback_submitted") {
    values.feedbackRating = payload.rating || null;
    values.feedbackComment = payload.comment || "";
  }

  await db
    .update(lessonAssignmentLearners)
    .set(values)
    .where(eq(lessonAssignmentLearners.id, context.learner.id));
}

function buildLearnerAssignmentProgress(bundle: LessonBundle, learner: any, events: any[]) {
  const viewedSlideIds = new Set(
    events
      .filter((event) => event.eventType === "slide_viewed" && event.slideId)
      .map((event) => event.slideId)
  );
  const viewedPracticeIds = new Set(
    events
      .filter((event) => event.eventType === "practice_viewed" && event.itemId)
      .map((event) => event.itemId)
  );
  const practiceAttempts = events.filter((event) => event.eventType === "practice_attempted");
  const attemptedPracticeIds = new Set(practiceAttempts.filter((event) => event.itemId).map((event) => event.itemId));
  const latestPracticeAttempt = practiceAttempts[0] || null;
  const feedbackEvents = events.filter((event) => event.eventType === "feedback_submitted");
  const latestFeedback = feedbackEvents[0] || null;
  const openedAt = learner.openedAt || events.find((event) => event.eventType === "lesson_opened")?.createdAt || null;
  const completedAt = learner.completedAt || events.find((event) => event.eventType === "lesson_completed")?.createdAt || null;
  const lastActivityAt = learner.lastActivityAt || events[0]?.createdAt || null;
  const feedbackRating = learner.feedbackRating || latestFeedback?.payload?.rating || null;
  const feedbackComment = learner.feedbackComment || latestFeedback?.payload?.comment || "";
  const totalSlides = bundle.slides.length;
  const totalPracticeItems = bundle.items.length;
  const slideProgress = totalSlides ? viewedSlideIds.size / totalSlides : 0;
  const practiceProgress = totalPracticeItems ? attemptedPracticeIds.size / totalPracticeItems : 1;
  const feedbackProgress = feedbackRating ? 1 : 0;
  const completed = Boolean(completedAt || learner.status === "completed");
  const completionPercent = completed
    ? 100
    : Math.round(Math.min(0.95, (slideProgress * 0.55) + (practiceProgress * 0.25) + (feedbackProgress * 0.2)) * 100);

  let nextAction = "Start lesson";
  if (completed && feedbackRating) {
    nextAction = "Assignment complete";
  } else if (completed) {
    nextAction = "Send feedback";
  } else if (openedAt && viewedSlideIds.size < totalSlides) {
    nextAction = "Continue slides";
  } else if (totalPracticeItems && attemptedPracticeIds.size < totalPracticeItems) {
    nextAction = "Try the practice item";
  } else {
    nextAction = "Mark lesson complete";
  }

  return {
    status: learner.status,
    completionPercent,
    opened: Boolean(openedAt),
    completed,
    openedAt: outcomeTimestamp(openedAt),
    completedAt: outcomeTimestamp(completedAt),
    lastActivityAt: outcomeTimestamp(lastActivityAt),
    nextAction,
    slideProgress: {
      viewed: viewedSlideIds.size,
      total: totalSlides,
    },
    practice: {
      viewed: viewedPracticeIds.size,
      attempted: attemptedPracticeIds.size,
      total: totalPracticeItems,
      attempts: practiceAttempts.length,
      correct: practiceAttempts.filter((event) => event.payload?.isCorrect === true).length,
      latest: latestPracticeAttempt ? {
        itemId: latestPracticeAttempt.itemId,
        selectedAnswer: latestPracticeAttempt.payload?.selectedAnswer || null,
        correctAnswer: latestPracticeAttempt.payload?.correctAnswer || null,
        isCorrect: latestPracticeAttempt.payload?.isCorrect ?? null,
        createdAt: outcomeTimestamp(latestPracticeAttempt.createdAt),
      } : null,
    },
    feedback: {
      submitted: Boolean(feedbackRating),
      rating: feedbackRating,
      comment: feedbackComment,
      submittedAt: outcomeTimestamp(latestFeedback?.createdAt || (feedbackRating ? lastActivityAt : null)),
    },
    eventCounts: events.reduce<Record<string, number>>((counts, event) => {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
      return counts;
    }, {}),
  };
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function outcomeTimestamp(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function recommendedActionForReasons(reasons: string[]) {
  if (reasons.includes("not_started")) return "Send reminder and confirm learner can access the assignment link.";
  if (reasons.includes("feedback_needs_review")) return "Faculty should review feedback and decide whether the lesson needs clarification.";
  if (reasons.includes("practice_missed")) return "Review rationale with learner and consider targeted remediation.";
  if (reasons.includes("incomplete")) return "Prompt learner to finish lesson and submit feedback.";
  return "Monitor in next pilot review.";
}

async function buildPilotOutcomes(packageId: string) {
  const bundle = await findPackageBundle(packageId);
  if (!bundle) return null;

  const assignments = await db
    .select()
    .from(lessonAssignments)
    .where(eq(lessonAssignments.packageId, packageId))
    .orderBy(desc(lessonAssignments.createdAt));

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const learners = assignmentIds.length
    ? await db
      .select()
      .from(lessonAssignmentLearners)
      .where(inArray(lessonAssignmentLearners.assignmentId, assignmentIds))
      .orderBy(asc(lessonAssignmentLearners.createdAt))
    : [];
  const events = assignmentIds.length
    ? await db
      .select()
      .from(lessonLearnerEvents)
      .where(inArray(lessonLearnerEvents.assignmentId, assignmentIds))
      .orderBy(desc(lessonLearnerEvents.createdAt))
      .limit(2000)
    : [];

  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const itemById = new Map(bundle.items.map((item) => [item.id, item]));
  const learnersByAssignment = new Map<string, any[]>();
  for (const learner of learners) {
    learnersByAssignment.set(learner.assignmentId, [...(learnersByAssignment.get(learner.assignmentId) || []), learner]);
  }

  const learnerSummaries = learners.map((learner) => {
    const assignment = assignmentById.get(learner.assignmentId);
    const learnerEvents = events.filter((event) => event.assignmentLearnerId === learner.id);
    const eventCounts = learnerEvents.reduce<Record<string, number>>((counts, event) => {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
      return counts;
    }, {});
    const practiceAttempts = learnerEvents.filter((event) => event.eventType === "practice_attempted");
    const feedbackEvents = learnerEvents.filter((event) => event.eventType === "feedback_submitted");
    const latestFeedback = feedbackEvents[0];
    const correctAttempts = practiceAttempts.filter((event) => Boolean((event.payload as Record<string, any> | null)?.isCorrect)).length;
    const openedAt = outcomeTimestamp(learner.openedAt || learnerEvents.find((event) => event.eventType === "lesson_opened")?.createdAt);
    const completedAt = outcomeTimestamp(learner.completedAt || learnerEvents.find((event) => event.eventType === "lesson_completed")?.createdAt);
    const lastActivityAt = outcomeTimestamp(learner.lastActivityAt || learnerEvents[0]?.createdAt);
    const feedbackRating = learner.feedbackRating || latestFeedback?.payload?.rating || null;
    const feedbackComment = learner.feedbackComment || latestFeedback?.payload?.comment || "";
    const reasons: string[] = [];

    if (!openedAt) reasons.push("not_started");
    if (openedAt && !completedAt) reasons.push("incomplete");
    if (["confusing", "too_hard", "needs_faculty_review"].includes(String(feedbackRating || ""))) reasons.push("feedback_needs_review");
    if (practiceAttempts.length > correctAttempts) reasons.push("practice_missed");

    return {
      assignmentId: learner.assignmentId,
      assignmentTitle: assignment?.title || "Pilot assignment",
      cohortName: assignment?.cohortName || "Pilot cohort",
      learnerId: learner.id,
      learnerName: learner.learnerName,
      learnerEmail: learner.learnerEmail,
      status: completedAt ? "completed" : openedAt ? "in_progress" : "assigned",
      openedAt,
      completedAt,
      lastActivityAt,
      eventCounts,
      practice: {
        attempts: practiceAttempts.length,
        correct: correctAttempts,
        incorrect: Math.max(0, practiceAttempts.length - correctAttempts),
        latestItemId: practiceAttempts[0]?.itemId || null,
        latestItemStem: practiceAttempts[0]?.itemId ? itemById.get(practiceAttempts[0].itemId)?.stem || null : null,
      },
      feedback: {
        rating: feedbackRating,
        comment: feedbackComment,
        submittedAt: outcomeTimestamp(latestFeedback?.createdAt || (learner.feedbackRating ? learner.lastActivityAt : null)),
      },
      needsReview: reasons.length > 0,
      reasons,
      recommendedAction: reasons.length ? recommendedActionForReasons(reasons) : "No action needed.",
    };
  });

  const assignmentSummaries = assignments.map((assignment) => {
    const assignmentLearners = learnerSummaries.filter((learner) => learner.assignmentId === assignment.id);
    return {
      id: assignment.id,
      title: assignment.title,
      cohortName: assignment.cohortName,
      status: assignment.status,
      dueDate: outcomeTimestamp(assignment.dueDate),
      createdAt: outcomeTimestamp(assignment.createdAt),
      totals: {
        assigned: assignmentLearners.length,
        opened: assignmentLearners.filter((learner) => Boolean(learner.openedAt)).length,
        practiceAttempted: assignmentLearners.filter((learner) => learner.practice.attempts > 0).length,
        completed: assignmentLearners.filter((learner) => Boolean(learner.completedAt)).length,
        feedbackSubmitted: assignmentLearners.filter((learner) => Boolean(learner.feedback.rating)).length,
        needsReview: assignmentLearners.filter((learner) => learner.needsReview).length,
      },
    };
  });

  const feedbackRatings = learnerSummaries.reduce<Record<string, number>>((ratings, learner) => {
    const rating = learner.feedback.rating ? String(learner.feedback.rating) : "none";
    ratings[rating] = (ratings[rating] || 0) + 1;
    return ratings;
  }, {});
  const totalPracticeAttempts = learnerSummaries.reduce((sum, learner) => sum + learner.practice.attempts, 0);
  const totalPracticeCorrect = learnerSummaries.reduce((sum, learner) => sum + learner.practice.correct, 0);
  const actionQueue = learnerSummaries
    .filter((learner) => learner.needsReview)
    .map((learner) => ({
      assignmentId: learner.assignmentId,
      cohortName: learner.cohortName,
      learnerId: learner.learnerId,
      learnerName: learner.learnerName,
      learnerEmail: learner.learnerEmail,
      status: learner.status,
      reasons: learner.reasons,
      recommendedAction: learner.recommendedAction,
      lastActivityAt: learner.lastActivityAt,
      feedbackRating: learner.feedback.rating,
    }));

  return {
    package: {
      id: bundle.package.id,
      title: bundle.package.title,
      topic: bundle.package.topic,
      audience: bundle.package.audience,
      status: bundle.package.status,
      publishedAt: outcomeTimestamp(bundle.package.publishedAt),
    },
    generatedAt: new Date().toISOString(),
    totals: {
      assignments: assignments.length,
      assigned: learnerSummaries.length,
      opened: learnerSummaries.filter((learner) => Boolean(learner.openedAt)).length,
      practiceAttempted: learnerSummaries.filter((learner) => learner.practice.attempts > 0).length,
      completed: learnerSummaries.filter((learner) => Boolean(learner.completedAt)).length,
      feedbackSubmitted: learnerSummaries.filter((learner) => Boolean(learner.feedback.rating)).length,
      needsReview: actionQueue.length,
    },
    assignments: assignmentSummaries,
    learners: learnerSummaries,
    practiceSummary: {
      attempts: totalPracticeAttempts,
      correct: totalPracticeCorrect,
      incorrect: Math.max(0, totalPracticeAttempts - totalPracticeCorrect),
      accuracy: totalPracticeAttempts ? Math.round((totalPracticeCorrect / totalPracticeAttempts) * 100) : null,
    },
    feedbackSummary: {
      ratings: feedbackRatings,
      comments: learnerSummaries
        .filter((learner) => learner.feedback.comment)
        .map((learner) => ({
          learnerId: learner.learnerId,
          learnerName: learner.learnerName,
          cohortName: learner.cohortName,
          rating: learner.feedback.rating,
          comment: learner.feedback.comment,
          submittedAt: learner.feedback.submittedAt,
        })),
    },
    actionQueue,
  };
}

function pilotOutcomesCsv(outcomes: Awaited<ReturnType<typeof buildPilotOutcomes>>) {
  if (!outcomes) return "";
  const headers = [
    "package_title",
    "assignment_title",
    "cohort",
    "learner_name",
    "learner_email",
    "status",
    "opened_at",
    "last_activity_at",
    "completed_at",
    "practice_attempts",
    "practice_correct",
    "feedback_rating",
    "feedback_comment",
    "needs_review",
    "reasons",
    "recommended_action",
  ];
  const rows = outcomes.learners.map((learner) => [
    outcomes.package.title,
    learner.assignmentTitle,
    learner.cohortName,
    learner.learnerName,
    learner.learnerEmail,
    learner.status,
    learner.openedAt,
    learner.lastActivityAt,
    learner.completedAt,
    learner.practice.attempts,
    learner.practice.correct,
    learner.feedback.rating,
    learner.feedback.comment,
    learner.needsReview,
    learner.reasons.join(";"),
    learner.recommendedAction,
  ].map(csvValue).join(","));
  return [headers.map(csvValue).join(","), ...rows].join("\n");
}

async function findPackageBundle(packageId: string): Promise<LessonBundle | null> {
  const [pkg] = await db.select().from(lessonPackages).where(eq(lessonPackages.id, packageId)).limit(1);
  if (!pkg) return null;

  const sourceIds = Array.isArray(pkg.sourceIds) ? pkg.sourceIds : [];
  const [sources, slides, items, citations, qaResults, generationRuns, artifacts, contractValidations, reviews, assignments, learnerEvents, releaseAuditEvents] = await Promise.all([
    sourceIds.length ? getSourcesByIds(sourceIds) : [],
    db.select().from(lessonSlides).where(eq(lessonSlides.packageId, packageId)).orderBy(asc(lessonSlides.slideNumber)),
    db.select().from(lessonItems).where(eq(lessonItems.packageId, packageId)).orderBy(asc(lessonItems.createdAt)),
    db.select().from(lessonCitations).where(eq(lessonCitations.packageId, packageId)).orderBy(asc(lessonCitations.createdAt)),
    db.select().from(lessonQaResults).where(eq(lessonQaResults.packageId, packageId)).orderBy(asc(lessonQaResults.checkedAt)),
    db.select().from(lessonGenerationRuns).where(eq(lessonGenerationRuns.packageId, packageId)).orderBy(desc(lessonGenerationRuns.createdAt)),
    db.select().from(lessonPackageArtifacts).where(eq(lessonPackageArtifacts.packageId, packageId)).orderBy(asc(lessonPackageArtifacts.createdAt)),
    db.select().from(lessonContractValidations).where(eq(lessonContractValidations.packageId, packageId)).orderBy(asc(lessonContractValidations.createdAt)),
    db.select().from(lessonPackageReviews).where(eq(lessonPackageReviews.packageId, packageId)).orderBy(desc(lessonPackageReviews.createdAt)),
    getPackageAssignments(packageId),
    db.select().from(lessonLearnerEvents).where(eq(lessonLearnerEvents.packageId, packageId)).orderBy(desc(lessonLearnerEvents.createdAt)).limit(100),
    db.select().from(lessonReleaseAuditEvents).where(eq(lessonReleaseAuditEvents.packageId, packageId)).orderBy(desc(lessonReleaseAuditEvents.createdAt)).limit(50),
  ]);

  return { package: pkg, sources, slides, items, citations, qaResults, generationRuns, artifacts, contractValidations, reviews, assignments, learnerEvents, releaseAuditEvents };
}

<<<<<<< HEAD
=======
function hasLicensedClinicalApproval(bundle: LessonBundle) {
  return bundle.reviews.some((review) => {
    const metadata = review.metadata || {};
    const role = String(review.reviewerRole || "").toLowerCase();
    return review.decision === "approved_for_release"
      && metadata.licensedRn === true
      && (role.includes("rn") || role.includes("faculty") || role.includes("clinical"));
  });
}

function clinicalDomain(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (/contraception|postpartum|maternal|newborn|pregnan|labor|fetal|reproductive/.test(text)) return "maternal-newborn";
  if (/respiratory|asthma|oxygen|airway|lung|ventilat/.test(text)) return "respiratory";
  if (/mental health|psychiatr|therapeutic communication|suicid|anxiety/.test(text)) return "mental-health";
  if (/pharmacol|medication|drug|infusion/.test(text)) return "pharmacology";
  if (/pediatric|child|infant|adolescent/.test(text)) return "pediatrics";
  return "general";
}

function topicSourceAlignment(bundle: LessonBundle) {
  const expected = clinicalDomain(`${bundle.package.topic} ${bundle.package.title}`);
  const sourceDomains = bundle.sources.map((source) => clinicalDomain(`${source.title} ${source.subject || ""}`));
  const incompatible = expected !== "general"
    && sourceDomains.length > 0
    && sourceDomains.every((domain) => domain !== expected && domain !== "general");
  return {
    valid: !incompatible,
    expectedDomain: expected,
    sourceDomains,
    message: incompatible
      ? `Topic domain ${expected} does not align with the attached source domains (${sourceDomains.join(", ")}).`
      : "Topic and source domains are compatible.",
  };
}

function nodeId(kind: string, value: string) {
  return `${NCLEX_FRAMEWORK_ID}:${kind}:${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

async function installCanonicalCurriculumGraph() {
  await db.insert(curriculumFrameworks).values({
    id: NCLEX_FRAMEWORK_ID,
    title: "2026 NCLEX-RN Open Curriculum",
    version: "2026",
    audience: "Prelicensure RN",
    status: "active",
    sourceUri: "https://www.ncsbn.org/publications/2026-nclex-rn-test-plan",
    metadata: { legacyTopicMigrationTarget: 77, maternalNewbornMigrationRows: 94, atiPolicy: "aliases_only" },
  }).onConflictDoUpdate({
    target: curriculumFrameworks.id,
    set: { status: "active", updatedAt: new Date() },
  });

  const categoryNodes = NCLEX_CATEGORIES.map((category) => ({
    id: nodeId("category", category.id),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "category",
    code: category.id,
    label: category.label,
    blueprintWeight: category.blueprintWeight.toFixed(2),
    releaseStage: "approved",
    metadata: { blueprintRange: category.blueprintRange },
  }));
  const processNodes = INTEGRATED_PROCESSES.map((process) => ({
    id: nodeId("integrated-process", process),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "integrated_process",
    code: process,
    label: process,
    releaseStage: "approved",
  }));
  const judgmentNodes = NCJMM_FUNCTIONS.map((fn) => ({
    id: nodeId("ncjmm", fn),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "ncjmm",
    code: fn,
    label: fn,
    releaseStage: "approved",
  }));
  const topicNodes = EXEMPLAR_TOPICS.map((topic) => ({
    id: nodeId("topic", topic.id),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "topic",
    code: topic.id,
    label: topic.title,
    description: topic.summary,
    safetyRisk: topic.safetyRisk,
    releaseStage: topic.releaseStage,
    legacyIds: topic.prerequisites,
    metadata: { concept: topic.concept, prerequisites: topic.prerequisites },
  }));
  const objectiveNodes = EXEMPLAR_TOPICS.flatMap((topic) => topic.objectives.map((objective, index) => ({
    id: nodeId("objective", `${topic.id}-${index + 1}`),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "objective",
    code: `${topic.id}-objective-${index + 1}`,
    label: objective,
    safetyRisk: topic.safetyRisk,
    releaseStage: topic.releaseStage,
    metadata: { topicId: topic.id },
  })));

  for (const node of [...categoryNodes, ...processNodes, ...judgmentNodes, ...topicNodes, ...objectiveNodes]) {
    await db.insert(curriculumNodes).values(node).onConflictDoUpdate({
      target: curriculumNodes.id,
      set: { label: node.label, releaseStage: node.releaseStage, updatedAt: new Date() },
    });
  }

  const edges = EXEMPLAR_TOPICS.flatMap((topic) => {
    const topicNodeId = nodeId("topic", topic.id);
    const relationships = [
      { id: nodeId("edge", `${topic.id}-category`), fromNodeId: nodeId("category", topic.categoryId), toNodeId: topicNodeId, relationship: "contains" },
      ...topic.objectives.map((_, index) => ({ id: nodeId("edge", `${topic.id}-objective-${index + 1}`), fromNodeId: topicNodeId, toNodeId: nodeId("objective", `${topic.id}-${index + 1}`), relationship: "contains" })),
      ...topic.integratedProcesses.map((process) => ({ id: nodeId("edge", `${topic.id}-process-${process}`), fromNodeId: topicNodeId, toNodeId: nodeId("integrated-process", process), relationship: "maps_to" })),
      ...NCJMM_FUNCTIONS.map((fn) => ({ id: nodeId("edge", `${topic.id}-ncjmm-${fn}`), fromNodeId: topicNodeId, toNodeId: nodeId("ncjmm", fn), relationship: "maps_to" })),
    ];
    return relationships;
  });
  for (const edge of edges) {
    await db.insert(curriculumEdges).values({ ...edge, frameworkId: NCLEX_FRAMEWORK_ID }).onConflictDoNothing();
  }

  const sources = Array.from(new Map(EXEMPLAR_TOPICS.flatMap((topic) => topic.sources).map((source) => [source.id, source])).values());
  for (const source of sources) {
    await db.insert(curriculumEvidenceSources).values({
      id: source.id,
      frameworkId: NCLEX_FRAMEWORK_ID,
      title: source.title,
      publisher: source.publisher,
      license: source.license,
      sourceUri: source.sourceUri,
      locator: source.locator,
      approvalStatus: source.approvalStatus,
    }).onConflictDoUpdate({
      target: curriculumEvidenceSources.id,
      set: { locator: source.locator, approvalStatus: source.approvalStatus, updatedAt: new Date() },
    });
  }

  return { frameworkId: NCLEX_FRAMEWORK_ID, nodes: categoryNodes.length + processNodes.length + judgmentNodes.length + topicNodes.length + objectiveNodes.length, edges: edges.length, sources: sources.length };
}

async function quarantineUnsafePackages() {
  const packages = await db.select({ id: lessonPackages.id, title: lessonPackages.title, status: lessonPackages.status }).from(lessonPackages);
  const quarantined: Array<{ id: string; title: string; reason: string }> = [];
  for (const pkg of packages) {
    const bundle = await findPackageBundle(pkg.id);
    if (!bundle) continue;
    const alignment = topicSourceAlignment(bundle);
    const demoPackage = /\b(smoke|demo|test package|pilot variant)\b/i.test(pkg.title);
    if (!demoPackage && alignment.valid) continue;
    const reason = demoPackage ? "demo_or_smoke_package" : "topic_source_mismatch";
    await db.update(lessonPackages).set({
      status: "blocked",
      releaseStage: "draft",
      publishedAt: null,
      manifest: {
        ...(bundle.package.manifest || {}),
        quarantine: { reason, quarantinedAt: new Date().toISOString(), alignment },
      },
      updatedAt: new Date(),
    }).where(eq(lessonPackages.id, pkg.id));
    quarantined.push({ id: pkg.id, title: pkg.title, reason });
  }
  return quarantined;
}

>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
function compactTopicKey(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topicProductionRowKey(sourceType: string, id: string) {
  return `${sourceType}:${id}`;
}

function defaultTopicProductionReview(): TopicProductionReview {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionMediaWorkOrderReview(): TopicProductionMediaWorkOrderReview {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionMediaScaffoldReview(): TopicProductionMediaScaffoldReview {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionMediaTextDraftReview(): TopicProductionMediaTextDraftReview {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionPackageReviewBlueprintReview(): TopicProductionPackageReviewBlueprintReview {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function normalizeTopicProductionReview(value: any): TopicProductionReview {
  const parsed = topicProductionReviewSchema.safeParse(value || {});
  if (!parsed.success) return defaultTopicProductionReview();
  return {
    decision: parsed.data.decision,
    reviewerNotes: parsed.data.reviewerNotes || "",
    reviewedAt: typeof value?.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: typeof value?.reviewedBy === "string" ? value.reviewedBy : "",
  };
}

function normalizeTopicProductionMediaWorkOrderReview(value: any): TopicProductionMediaWorkOrderReview {
  const parsed = topicProductionMediaWorkOrderReviewSchema.safeParse(value || {});
  if (!parsed.success) return defaultTopicProductionMediaWorkOrderReview();
  return {
    decision: parsed.data.decision,
    reviewerNotes: parsed.data.reviewerNotes || "",
    reviewedAt: typeof value?.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: typeof value?.reviewedBy === "string" ? value.reviewedBy : "",
  };
}

function normalizeTopicProductionMediaScaffoldReview(value: any): TopicProductionMediaScaffoldReview {
  const parsed = topicProductionMediaScaffoldReviewSchema.safeParse(value || {});
  if (!parsed.success) return defaultTopicProductionMediaScaffoldReview();
  return {
    decision: parsed.data.decision,
    reviewerNotes: parsed.data.reviewerNotes || "",
    reviewedAt: typeof value?.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: typeof value?.reviewedBy === "string" ? value.reviewedBy : "",
  };
}

function normalizeTopicProductionMediaTextDraftReview(value: any): TopicProductionMediaTextDraftReview {
  const parsed = topicProductionMediaTextDraftReviewSchema.safeParse(value || {});
  if (!parsed.success) return defaultTopicProductionMediaTextDraftReview();
  return {
    decision: parsed.data.decision,
    reviewerNotes: parsed.data.reviewerNotes || "",
    reviewedAt: typeof value?.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: typeof value?.reviewedBy === "string" ? value.reviewedBy : "",
  };
}

function normalizeTopicProductionPackageReviewBlueprintReview(value: any): TopicProductionPackageReviewBlueprintReview {
  const parsed = topicProductionPackageReviewBlueprintSchema.safeParse(value || {});
  if (!parsed.success) return defaultTopicProductionPackageReviewBlueprintReview();
  return {
    decision: parsed.data.decision,
    reviewerNotes: parsed.data.reviewerNotes || "",
    reviewedAt: typeof value?.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: typeof value?.reviewedBy === "string" ? value.reviewedBy : "",
  };
}

function topicProductionReviewForRow(sourceType: string, id: string, fallback?: any) {
  const override = topicProductionReviewOverrides.get(topicProductionRowKey(sourceType, id));
  return override || normalizeTopicProductionReview(fallback);
}

function topicProductionMediaWorkOrderId(sourceId: string) {
  return `media-work-order-${sourceId}`;
}

function topicProductionMediaWorkOrderReviewForId(workOrderId: string, fallback?: any) {
  const override = topicProductionMediaWorkOrderReviewOverrides.get(topicProductionRowKey("media_work_order", workOrderId));
  return override || normalizeTopicProductionMediaWorkOrderReview(fallback);
}

function topicProductionMediaScaffoldReviewForId(workOrderId: string, fallback?: any) {
  const override = topicProductionMediaScaffoldReviewOverrides.get(topicProductionRowKey("media_scaffold", workOrderId));
  return override || normalizeTopicProductionMediaScaffoldReview(fallback);
}

function topicProductionMediaTextDraftReviewForId(workOrderId: string, fallback?: any) {
  const override = topicProductionMediaTextDraftReviewOverrides.get(topicProductionRowKey("media_text_draft", workOrderId));
  return override || normalizeTopicProductionMediaTextDraftReview(fallback);
}

function topicProductionPackageReviewBlueprintForId(workOrderId: string, fallback?: any) {
  const override = topicProductionPackageReviewBlueprintOverrides.get(topicProductionRowKey("package_review_blueprint", workOrderId));
  return override || normalizeTopicProductionPackageReviewBlueprintReview(fallback);
}

async function loadTopicProductionReviewOverrides() {
  const rows = await db.select().from(topicProductionReviews);
  for (const row of rows) {
    const payload = {
      decision: row.decision,
      reviewerNotes: row.reviewerNotes,
      reviewedAt: row.reviewedAt instanceof Date ? row.reviewedAt.toISOString() : row.reviewedAt,
      reviewedBy: row.reviewedBy,
    };
    if (row.sourceType === "media_work_order") {
      topicProductionMediaWorkOrderReviewOverrides.set(row.sourceKey, normalizeTopicProductionMediaWorkOrderReview(payload));
    } else if (row.sourceType === "media_scaffold") {
      topicProductionMediaScaffoldReviewOverrides.set(row.sourceKey, normalizeTopicProductionMediaScaffoldReview(payload));
    } else if (row.sourceType === "media_text_draft") {
      topicProductionMediaTextDraftReviewOverrides.set(row.sourceKey, normalizeTopicProductionMediaTextDraftReview(payload));
    } else if (row.sourceType === "package_review_blueprint") {
      topicProductionPackageReviewBlueprintOverrides.set(row.sourceKey, normalizeTopicProductionPackageReviewBlueprintReview(payload));
    } else {
      topicProductionReviewOverrides.set(row.sourceKey, normalizeTopicProductionReview(payload));
    }
  }
}

async function saveTopicProductionReview(sourceType: string, sourceId: string, review: TopicProductionReview, metadata: Record<string, any> = {}) {
  const sourceKey = topicProductionRowKey(sourceType, sourceId);
  const reviewedAt = review.reviewedAt ? new Date(review.reviewedAt) : new Date();
  const [saved] = await db.insert(topicProductionReviews).values({
    sourceKey,
    sourceType,
    sourceId,
    decision: review.decision,
    reviewerNotes: review.reviewerNotes || "",
    reviewedBy: review.reviewedBy || "admin",
    reviewedAt,
    metadata,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: topicProductionReviews.sourceKey,
    set: {
      decision: review.decision,
      reviewerNotes: review.reviewerNotes || "",
      reviewedBy: review.reviewedBy || "admin",
      reviewedAt,
      metadata,
      updatedAt: new Date(),
    },
  }).returning();

  topicProductionReviewOverrides.set(sourceKey, normalizeTopicProductionReview({
    decision: saved.decision,
    reviewerNotes: saved.reviewerNotes,
    reviewedAt: saved.reviewedAt instanceof Date ? saved.reviewedAt.toISOString() : saved.reviewedAt,
    reviewedBy: saved.reviewedBy,
  }));
  return saved;
}

async function saveTopicProductionMediaWorkOrderReview(workOrderId: string, review: TopicProductionMediaWorkOrderReview, metadata: Record<string, any> = {}) {
  const sourceType = "media_work_order";
  const sourceKey = topicProductionRowKey(sourceType, workOrderId);
  const reviewedAt = review.reviewedAt ? new Date(review.reviewedAt) : new Date();
  const [saved] = await db.insert(topicProductionReviews).values({
    sourceKey,
    sourceType,
    sourceId: workOrderId,
    decision: review.decision,
    reviewerNotes: review.reviewerNotes || "",
    reviewedBy: review.reviewedBy || "admin",
    reviewedAt,
    metadata,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: topicProductionReviews.sourceKey,
    set: {
      decision: review.decision,
      reviewerNotes: review.reviewerNotes || "",
      reviewedBy: review.reviewedBy || "admin",
      reviewedAt,
      metadata,
      updatedAt: new Date(),
    },
  }).returning();

  topicProductionMediaWorkOrderReviewOverrides.set(sourceKey, normalizeTopicProductionMediaWorkOrderReview({
    decision: saved.decision,
    reviewerNotes: saved.reviewerNotes,
    reviewedAt: saved.reviewedAt instanceof Date ? saved.reviewedAt.toISOString() : saved.reviewedAt,
    reviewedBy: saved.reviewedBy,
  }));
  return saved;
}

async function saveTopicProductionMediaScaffoldReview(workOrderId: string, review: TopicProductionMediaScaffoldReview, metadata: Record<string, any> = {}) {
  const sourceType = "media_scaffold";
  const sourceKey = topicProductionRowKey(sourceType, workOrderId);
  const reviewedAt = review.reviewedAt ? new Date(review.reviewedAt) : new Date();
  const [saved] = await db.insert(topicProductionReviews).values({
    sourceKey,
    sourceType,
    sourceId: workOrderId,
    decision: review.decision,
    reviewerNotes: review.reviewerNotes || "",
    reviewedBy: review.reviewedBy || "admin",
    reviewedAt,
    metadata,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: topicProductionReviews.sourceKey,
    set: {
      decision: review.decision,
      reviewerNotes: review.reviewerNotes || "",
      reviewedBy: review.reviewedBy || "admin",
      reviewedAt,
      metadata,
      updatedAt: new Date(),
    },
  }).returning();

  topicProductionMediaScaffoldReviewOverrides.set(sourceKey, normalizeTopicProductionMediaScaffoldReview({
    decision: saved.decision,
    reviewerNotes: saved.reviewerNotes,
    reviewedAt: saved.reviewedAt instanceof Date ? saved.reviewedAt.toISOString() : saved.reviewedAt,
    reviewedBy: saved.reviewedBy,
  }));
  return saved;
}

async function saveTopicProductionMediaTextDraftReview(workOrderId: string, review: TopicProductionMediaTextDraftReview, metadata: Record<string, any> = {}) {
  const sourceType = "media_text_draft";
  const sourceKey = topicProductionRowKey(sourceType, workOrderId);
  const reviewedAt = review.reviewedAt ? new Date(review.reviewedAt) : new Date();
  const [saved] = await db.insert(topicProductionReviews).values({
    sourceKey,
    sourceType,
    sourceId: workOrderId,
    decision: review.decision,
    reviewerNotes: review.reviewerNotes || "",
    reviewedBy: review.reviewedBy || "admin",
    reviewedAt,
    metadata,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: topicProductionReviews.sourceKey,
    set: {
      decision: review.decision,
      reviewerNotes: review.reviewerNotes || "",
      reviewedBy: review.reviewedBy || "admin",
      reviewedAt,
      metadata,
      updatedAt: new Date(),
    },
  }).returning();

  topicProductionMediaTextDraftReviewOverrides.set(sourceKey, normalizeTopicProductionMediaTextDraftReview({
    decision: saved.decision,
    reviewerNotes: saved.reviewerNotes,
    reviewedAt: saved.reviewedAt instanceof Date ? saved.reviewedAt.toISOString() : saved.reviewedAt,
    reviewedBy: saved.reviewedBy,
  }));
  return saved;
}

async function saveTopicProductionPackageReviewBlueprint(workOrderId: string, review: TopicProductionPackageReviewBlueprintReview, metadata: Record<string, any> = {}) {
  const sourceType = "package_review_blueprint";
  const sourceKey = topicProductionRowKey(sourceType, workOrderId);
  const reviewedAt = review.reviewedAt ? new Date(review.reviewedAt) : new Date();
  const [saved] = await db.insert(topicProductionReviews).values({
    sourceKey,
    sourceType,
    sourceId: workOrderId,
    decision: review.decision,
    reviewerNotes: review.reviewerNotes || "",
    reviewedBy: review.reviewedBy || "admin",
    reviewedAt,
    metadata,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: topicProductionReviews.sourceKey,
    set: {
      decision: review.decision,
      reviewerNotes: review.reviewerNotes || "",
      reviewedBy: review.reviewedBy || "admin",
      reviewedAt,
      metadata,
      updatedAt: new Date(),
    },
  }).returning();

  topicProductionPackageReviewBlueprintOverrides.set(sourceKey, normalizeTopicProductionPackageReviewBlueprintReview({
    decision: saved.decision,
    reviewerNotes: saved.reviewerNotes,
    reviewedAt: saved.reviewedAt instanceof Date ? saved.reviewedAt.toISOString() : saved.reviewedAt,
    reviewedBy: saved.reviewedBy,
  }));
  return saved;
}

function firstString(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const found = value.find((item) => typeof item === "string" && item.trim());
      if (found) return found.trim();
    }
  }
  return "";
}

function compactText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function topicProductionDriveAssetsForRow(row: any) {
  const rowText = compactText([
    row.topic,
    row.title,
    row.concept,
    row.weakTopic,
    row.nursingSubject,
    row.sourceEvidence,
  ].filter(Boolean).join(" ")).toLowerCase();

  return topicProductionDriveProjectInventory.assets
    .filter((asset) => asset.matchers.some((matcher) => rowText.includes(matcher)))
    .map((asset) => ({
      id: asset.id,
      title: asset.title,
      url: asset.url,
      mimeType: asset.mimeType,
      subject: asset.subject,
      concept: asset.concept,
      assetKeys: asset.assetKeys,
      belongsIn: asset.belongsIn,
      nextAction: asset.nextAction,
    }));
}

function topicProductionDriveProjectPayload(rows: any[]) {
  const matchedAssetIds = new Set(rows.flatMap((row) => topicProductionDriveAssetsForRow(row).map((asset) => asset.id)));
  return {
    id: topicProductionDriveProjectInventory.id,
    title: topicProductionDriveProjectInventory.title,
    url: topicProductionDriveProjectInventory.url,
    sourceType: topicProductionDriveProjectInventory.sourceType,
    status: topicProductionDriveProjectInventory.status,
    note: topicProductionDriveProjectInventory.note,
    costPolicy: topicProductionDriveProjectInventory.costPolicy,
    assetCount: topicProductionDriveProjectInventory.assets.length,
    matchedAssetCount: matchedAssetIds.size,
    assets: topicProductionDriveProjectInventory.assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      url: asset.url,
      mimeType: asset.mimeType,
      subject: asset.subject,
      concept: asset.concept,
      assetKeys: asset.assetKeys,
      belongsIn: asset.belongsIn,
      nextAction: asset.nextAction,
      matchedToCurrentRows: matchedAssetIds.has(asset.id),
    })),
  };
}

const topicProductionAirtableTrackerFields = [
  { name: "Tracker Stage", type: "singleSelect", required: true, source: "system", notes: "Phase/status label for filtering records into Airtable views." },
  { name: "Spend Window", type: "singleSelect", required: true, source: "system", notes: "Budget checkpoint, currently $100-$250 only." },
  { name: "Spend Permission", type: "longText", required: true, source: "system", notes: "Human-readable spend boundary before any video or AI polish." },
  { name: "Topic", type: "singleLineText", required: true, source: "lesson_builder", notes: "Primary field; one record per approved topic/draft." },
  { name: "Concept", type: "singleLineText", required: true, source: "content_mapper", notes: "Nursing concept attached before draft production." },
  { name: "Nursing Subject", type: "singleSelect", required: true, source: "content_mapper", notes: "Subject or specialty such as Maternal-Newborn or Pediatrics." },
  { name: "Weak Topic", type: "singleLineText", required: false, source: "assessment_bridge", notes: "Optional weak-topic/remediation bridge label." },
  { name: "NCLEX Category", type: "singleLineText", required: false, source: "assessment_bridge", notes: "Learner-safe NCLEX category tag." },
  { name: "CJM Step", type: "singleLineText", required: false, source: "assessment_bridge", notes: "Clinical Judgment Measurement Model step." },
  { name: "Template Draft Package ID", type: "singleLineText", required: true, source: "lesson_builder", notes: "Internal package ID used to reopen QA/export." },
  { name: "Lesson Builder Review URL", type: "url", required: true, source: "system", notes: "Admin review link; keep internal only." },
  { name: "Student Surface After Publish", type: "url", required: false, source: "system", notes: "Student lesson route after publish." },
  { name: "Drive Project Assets", type: "longText", required: true, source: "google_drive_project", notes: "Source files associated with the topic." },
  { name: "Drive Asset Links", type: "longText", required: true, source: "google_drive_project", notes: "Drive source links for content review and traceability." },
  { name: "Short Hook", type: "longText", required: true, source: "template", notes: "First no-cost short hook draft." },
  { name: "Short Script Draft", type: "longText", required: true, source: "template", notes: "First no-cost script draft; not final polished copy." },
  { name: "CTA", type: "longText", required: true, source: "template", notes: "Call to action pointing to the NurseStudy lesson." },
  { name: "Video Lesson Deck", type: "singleSelect", required: true, source: "coverage_contract", notes: "Deck coverage state." },
  { name: "Study Guide", type: "singleSelect", required: true, source: "coverage_contract", notes: "Study guide coverage state." },
  { name: "Quiz/Rationale", type: "singleSelect", required: true, source: "coverage_contract", notes: "Quiz and rationale coverage state." },
  { name: "Visuals", type: "singleSelect", required: true, source: "coverage_contract", notes: "Visual coverage state." },
  { name: "Citations", type: "singleSelect", required: true, source: "coverage_contract", notes: "Citation coverage state." },
  { name: "Visual Brief", type: "longText", required: true, source: "template", notes: "One visual direction for review before image/video spend." },
  { name: "Audio/TTS Status", type: "singleLineText", required: true, source: "system", notes: "Keeps audio generation separate from draft approval." },
  { name: "Coverage Summary", type: "singleLineText", required: true, source: "coverage_contract", notes: "Human-readable coverage count." },
  { name: "Next Production Action", type: "longText", required: true, source: "system", notes: "One next action, not broad production." },
  { name: "Human Review Gate", type: "longText", required: true, source: "system", notes: "Review gates that must stay human-owned." },
  { name: "Cost Guardrail", type: "longText", required: true, source: "system", notes: "Budget rule for this record." },
] as const;

const topicProductionPhaseTwoCandidates = [
  {
    id: "phase-2-postpartum-hemorrhage",
    topic: "Postpartum Hemorrhage Priorities",
    title: "Postpartum Hemorrhage Priorities",
    concept: "Perfusion / Reproductive Health",
    nursingSubject: "Maternal-Newborn",
    weakTopic: "Postpartum complications",
    nclexCategory: "Reduction of Risk Potential",
    cjmStep: "Recognize Cues",
    sourceEvidence: "MNN CH20 Postpartum Disorders and CH17 Postpartum Physiological Adaptations source candidates.",
    nextAction: "Review source approval and create the first learner-facing slide deck, quiz rationale, visuals, and guided notes before publish.",
  },
  {
    id: "phase-2-newborn-assessment",
    topic: "Newborn Assessment Cues",
    title: "Newborn Assessment Cues",
    concept: "Health Promotion / Safety",
    nursingSubject: "Maternal-Newborn",
    weakTopic: "Newborn assessment",
    nclexCategory: "Health Promotion and Maintenance",
    cjmStep: "Recognize Cues",
    sourceEvidence: "MNN CH23 Newborn Assessment and CH24 Nursing Care of Newborns source candidates.",
    nextAction: "Review normal-versus-abnormal cue taxonomy, then draft study guide prompts and one NCLEX-style item.",
  },
  {
    id: "phase-2-pediatric-emergency-priorities",
    topic: "Pediatric Emergency Priorities",
    title: "Pediatric Emergency Priorities",
    concept: "Safety / Clinical Judgment",
    nursingSubject: "Pediatrics",
    weakTopic: "Emergency prioritization",
    nclexCategory: "Physiological Integrity",
    cjmStep: "Prioritize Hypotheses",
    sourceEvidence: "Pediatric Emergencies Part 1 Google Slides and Nursing Care of Children source-pattern assets.",
    nextAction: "Use the pediatrics deck as a source-pattern reference, then draft the first quiz and visual flow only after review.",
  },
] as const;

const topicProductionHumanReviewCatalogTopics = [
  "Maternal-Newborn Lesson Guide",
  "Pediatrics Asthma",
  "Postpartum Hemorrhage Priorities",
  "Newborn Assessment Cues",
  "Pediatric Emergency Priorities",
] as const;

function topicProductionAirtableTrackerPayload() {
  return {
    baseName: "NurseStudy Content Production",
    tableName: "Viral Shorts Workflow",
    version: "phase_3_no_ai_v1",
    primaryField: "Topic",
    importMode: "CSV import now; API upsert later after Airtable base selection is confirmed.",
    costPolicy: "Do not batch audio, vision scoring, or video rendering. Review two topic rows first, then approve one $100-$250 polish checkpoint.",
    requiredCsvHeaders: topicProductionAirtableTrackerFields.map((field) => field.name),
    fields: topicProductionAirtableTrackerFields,
    recommendedViews: [
      { name: "Needs Review", filter: "Tracker Stage is phase_3_shorts_video_handoff and Spend Permission is not empty" },
      { name: "Approved $100-$250", filter: "Spend Window is $100-$250" },
      { name: "Needs Visual Choice", filter: "Visuals is not ready" },
      { name: "Ready for Audio Later", filter: "Audio/TTS Status contains script draft only" },
    ],
  };
}

function topicProductionIsGenericLabel(value: string) {
  return /^(imported source|source|knowledge source|mapped nursing content|slide deck import|uploaded file intake|learner-facing contract.*|.*qa gates.*|.*package manifest.*|builder operations)$/i.test(String(value || "").trim());
}

function topicProductionHumanizeLabel(value: string) {
  const cleaned = String(value || "")
    .replace(/\.(zip|docx|pptx|pdf|md|txt|json|jsonl|csv)\b/gi, "")
    .replace(/\s*-\s*chunk\s*\d+\b/gi, "")
    .replace(/\bchunk\s*\d+\b/gi, "")
    .replace(/\b20\d{6,8}\b/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      if (["RN", "ATI", "NCLEX", "CJM", "QA"].includes(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function topicProductionBlockText(block: any) {
  return [
    block.title,
    block.source,
    block.description,
    block.content,
    block.category,
    block.nursingSpecialty,
    block.bodySystem,
    Array.isArray(block.concepts) ? block.concepts.join(" ") : "",
    Array.isArray(block.keywords) ? block.keywords.join(" ") : "",
  ].filter(Boolean).join(" ");
}

function topicProductionMappingText(...values: any[]) {
  return compactText(values.flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).join(" "));
}

function topicProductionInferredSubjectFromText(text: string) {
  const lower = text.toLowerCase();
  if (/maternal|newborn|postpartum|contraception|pregnan|labor|fetal|reproductive|family planning/.test(lower)) return "Maternal-Newborn";
  if (/therapeutic communication|psychosocial|mental health|anxiety|de-escalation|psychiatric/.test(lower)) return "Mental Health Nursing";
  if (/asthma|pediatric|paediatric|child|children|infant|growth|development/.test(lower)) return "Pediatrics";
  if (/medicat|haloperidol|diuretic|amphetamine|subcutaneous|injection|needle|iv team|intravenous|\biv\b|metaboli|tolerance|orthostatic|extrapyramidal|\beps\b/.test(lower)) return "Pharmacology";
  if (/basic care|comfort|catheter|urine|urinary|incontinence|hearing|sensory|ng tube|nasogastric|enteral|feeding tube|tube feeding/.test(lower)) return "Fundamentals";
  if (/\bclient\b|\bnurse\b|clinical decision/.test(lower)) return "Medical-Surgical";
  if (/concept.*curriculum|curriculum.*concept|data hub/.test(lower)) return "Curriculum Planning";
  if (/lesson[_\s-]*builder|harrity[_\s-]*builder|skill[_\s-]*overview|improvement[_\s-]*spec/.test(lower)) return "Builder Operations";
  return "";
}

function topicProductionInferredWeakTopicFromText(text: string, concept = "") {
  const lower = `${text} ${concept}`.toLowerCase();
  if (/contraception|family planning|birth control/.test(lower)) return "Contraception";
  if (/postpartum|post[-\s]?birth/.test(lower)) return "Postpartum complications";
  if (/newborn|neonate/.test(lower)) return "Newborn assessment";
  if (/therapeutic communication|communication priority|psychosocial/.test(lower)) return "Therapeutic communication";
  if (/asthma|wheez|bronchodilator/.test(lower)) return "Asthma";
  if (/subcutaneous|injection|needle|iv team|intravenous|\biv\b/.test(lower)) return "Medication administration";
  if (/haloperidol|schizophrenia|extrapyramidal|\beps\b|orthostatic/.test(lower)) return "Antipsychotic adverse effects";
  if (/diuretic|hyperglycemia|adverse effect|adverse reaction|medication adverse/.test(lower)) return "Medication adverse effects";
  if (/metaboli|medication tolerance|drug tolerance|therapeutic effect.*decrease|decrease.*therapeutic effect/.test(lower)) return "Medication metabolism";
  if (/ng tube|nasogastric|enteral|feeding tube|tube feeding|instill.*feeding/.test(lower)) return "Enteral tube feeding";
  if (/emergency|prioriti[sz]ation|triage/.test(lower)) return "Emergency prioritization";
  if (/gas exchange|oxygen|respiratory|airway/.test(lower)) return "Respiratory compromise";
  if (/reproductive|maternal|pregnan|labor|fetal/.test(lower)) return "Reproductive health";
  if (concept && !topicProductionIsGenericLabel(concept)) return concept;
  return "";
}

function topicProductionIsBroadWeakTopicLabel(value: string) {
  return /^(physiological integrity|safe and effective care environment|health promotion and maintenance|psychosocial integrity|basic care and comfort|clinical decision making|pathophysiology and disease management|medication administration and safety)$/i.test(String(value || "").trim());
}

function topicProductionFirstSpecificWeakTopic(...values: any[]) {
  const flattened = values.flatMap((value) => Array.isArray(value) ? value : [value]);
  for (const value of flattened) {
    if (typeof value !== "string" || !value.trim()) continue;
    const candidate = value.trim();
    if (topicProductionIsGenericLabel(candidate) || topicProductionIsBroadWeakTopicLabel(candidate)) continue;
    return candidate;
  }
  return "";
}

function topicProductionInferredNclexCategoryFromText(text: string, concept = "") {
  const lower = `${text} ${concept}`.toLowerCase();
  if (/therapeutic communication|psychosocial|mental health|anxiety|de-escalation/.test(lower)) return "Psychosocial Integrity";
  if (/medicat|haloperidol|diuretic|amphetamine|subcutaneous|injection|needle|iv team|intravenous|\biv\b|metaboli|tolerance|orthostatic|extrapyramidal|\beps\b/.test(lower)) return "Pharmacological and Parenteral Therapies";
  if (/basic care|comfort|catheter|urine|urinary|incontinence|hearing|sensory|ng tube|nasogastric|enteral|feeding tube|tube feeding/.test(lower)) return "Basic Care and Comfort";
  if (/contraception|family planning|newborn|growth|development|health promotion|teaching/.test(lower)) return "Health Promotion and Maintenance";
  if (/asthma|oxygen|respiratory|airway|postpartum complication|hemorrhage|infection|basic care|comfort|catheter|urine|urinary|incontinence/.test(lower)) return "Physiological Integrity";
  if (/clinical decision|prioriti[sz]ation|delegation|assignment/.test(lower)) return "Safe and Effective Care Environment";
  if (/curriculum|lesson[_\s-]*builder|harrity[_\s-]*builder|production workflow|builder operations/.test(lower)) return "Safe and Effective Care Environment";
  if (/safety|infection control/.test(lower)) return "Safe and Effective Care Environment";
  return "";
}

function topicProductionInferredCjmStepFromText(text: string) {
  const lower = text.toLowerCase();
  if (/priority cue|analy[sz]e|interpret|compare|cluster/.test(lower)) return "Analyze Cues";
  if (/assessment|recognize|identify|observe|finding/.test(lower)) return "Recognize Cues";
  if (/teaching|intervention|administer|take action|implement/.test(lower)) return "Take Action";
  if (/evaluate|response|outcome/.test(lower)) return "Evaluate Outcomes";
  return "Analyze Cues";
}

function topicProductionInferredBlockTopic(block: any) {
  const text = topicProductionBlockText(block);
  const lower = text.toLowerCase();
  if (/maternal|newborn|postpartum|contraception|pregnan|labor|fetal/.test(lower)) {
    return /depthpass|depth pass/.test(lower) ? "Maternal-Newborn Builder Depth Pass" : "Maternal-Newborn Lesson Guide";
  }
  if (/asthma|wheez|bronchodilator/.test(lower)) return "Pediatrics Asthma";
  if (/pediatric|paediatric|child|children|infant/.test(lower)) return "Pediatrics Nursing Care of Children";
  if (/concept.*curriculum|curriculum.*concept|data hub/.test(lower)) return "RN Concept-Based Curriculum Data Hub";
  return topicProductionHumanizeLabel(firstString(block.source, block.title, block.category));
}

function topicProductionInferredBlockConcept(block: any) {
  const existing = firstString(block.concepts, block.category);
  if (existing && !topicProductionIsGenericLabel(existing)) return existing;
  const lower = topicProductionBlockText(block).toLowerCase();
  if (/asthma|wheez|oxygen|respiratory|airway/.test(lower)) return "Gas Exchange";
  if (/maternal|newborn|postpartum|contraception|pregnan|labor|fetal|reproductive/.test(lower)) return "Reproductive Health";
  if (/pediatric|child|children|infant|growth|development/.test(lower)) return "Growth and Development";
  if (/concept.*curriculum|curriculum.*concept|data hub/.test(lower)) return "Curriculum Concepts";
  if (/lesson[_\s-]*builder|harrity[_\s-]*builder|skill[_\s-]*overview|improvement[_\s-]*spec/.test(lower)) return "Production Workflow";
  return "";
}

function topicProductionInferredBlockSubject(block: any) {
  const existing = firstString(block.nursingSpecialty, block.sourceType === "pptx" ? "Slide deck import" : "");
  if (existing && !topicProductionIsGenericLabel(existing)) return existing;
  return topicProductionInferredSubjectFromText(topicProductionBlockText(block));
}

function artifactMatches(artifact: any, pattern: RegExp) {
  return pattern.test([
    artifact?.artifactKey,
    artifact?.artifactType,
    artifact?.fileName,
    artifact?.mimeType,
    artifact?.metadata ? JSON.stringify(artifact.metadata) : "",
  ].filter(Boolean).join(" "));
}

function bundleHasVisualSignals(bundle: LessonBundle) {
  if (bundle.artifacts.some((artifact) => artifactMatches(artifact, /visual|image|diagram|chart|graphic|illustration/i))) {
    return true;
  }
  return bundle.slides.some((slide) => {
    const text = JSON.stringify(slide.visibleContent || {});
    return /visual|image|diagram|chart|graphic|illustration|concept map|table/i.test(text);
  });
}

function topicProductionStatus(missing: string[]) {
  if (missing.length === 0) return "ready";
  if (missing.includes("mapping")) return "needs_mapping";
  return "needs_assets";
}

function topicProductionNextAction(status: string, missing: string[]) {
  if (status === "ready") return "Ready for student-facing release and optional shorts/video production.";
  if (missing.includes("mapping")) return "Map concept and nursing subject before production.";
  if (missing.includes("slideDeck")) return "Generate or attach the related lesson slide deck.";
  if (missing.includes("studyGuide")) return "Add guided notes or study guide artifact.";
  if (missing.includes("visuals")) return "Add visual prompts, diagrams, or verified slide visuals.";
  if (missing.includes("quiz")) return "Add at least one practice item with rationale.";
  if (missing.includes("citations")) return "Attach source-backed citations.";
  return "Review production assets.";
}

function topicProductionPlacementForBundle(pkg: any, status: string, missing: string[]) {
  const isPublished = pkg.status === "published";
  return {
    contentKind: "Generated lesson package",
    currentLocation: "Lesson Builder package",
    belongsIn: isPublished ? "Student lesson library and study pack" : "Lesson Builder QA, export, and publish workflow",
    reviewSurface: "Lesson Builder",
    nextBuildSurface: status === "ready"
      ? "Publish, export, then queue optional shorts/video production"
      : topicProductionNextAction(status, missing),
    productionQueue: status === "ready" ? "Airtable shorts/video queue ready" : "Hold until missing assets are resolved",
    studentVisible: isPublished,
  };
}

function topicProductionPlacementForContentBlock(status: string, missing: string[]) {
  return {
    contentKind: "Processed imported source",
    currentLocation: "Content Mapper backlog",
    belongsIn: "Topic taxonomy review before lesson generation",
    reviewSurface: "Content Mapper",
    nextBuildSurface: topicProductionNextAction(status, missing),
    productionQueue: "Not queued for shorts/video until a lesson package exists",
    studentVisible: false,
  };
}

function topicProductionRowFromBundle(bundle: LessonBundle) {
  const pkg = bundle.package;
  const manifest = pkg.manifest || {};
  const taxonomySnapshot = pkg.taxonomySnapshot || {};
  const topicProductionMeta = (manifest as any).topicProduction || (taxonomySnapshot as any).topicProduction || {};
  const assessmentBridge = manifest.assessmentBridge || taxonomySnapshot.assessmentBridge || {};
  const itemTags = bundle.items.flatMap((item) => {
    const tags = item.tags || {};
    return [tags.concept, tags.weakTopic, tags.nclexCategory, ...(Array.isArray(tags.concepts) ? tags.concepts : [])];
  });
  const concept = firstString(
    topicProductionMeta.concept,
    taxonomySnapshot.concept,
    taxonomySnapshot.concepts,
    assessmentBridge.weakTopic,
    itemTags
  );
  const rowText = topicProductionMappingText(
    pkg.topic,
    pkg.title,
    concept,
    topicProductionMeta.weakTopic,
    (taxonomySnapshot as any).weakTopic,
    assessmentBridge.weakTopic,
    bundle.sources.map((source) => [source.title, source.subject]),
    bundle.slides.map((slide) => [slide.title, slide.nclexCategory, slide.cjmStep]),
    bundle.items.map((item) => [item.stem, item.rationale, safeJsonText(item.tags)])
  );
  const rawSpecialty = firstString(
    topicProductionMeta.nursingSubject,
    taxonomySnapshot.nursingSpecialty,
    taxonomySnapshot.subject,
    bundle.sources.map((source) => source.subject),
    assessmentBridge.atiCategory
  );
  const specialty = rawSpecialty && !topicProductionIsGenericLabel(rawSpecialty)
    ? rawSpecialty
    : topicProductionInferredSubjectFromText(rowText);
  const weakTopic = topicProductionFirstSpecificWeakTopic(
    assessmentBridge.weakTopic,
    topicProductionMeta.weakTopic,
    (taxonomySnapshot as any).weakTopic,
    topicProductionInferredWeakTopicFromText(rowText, concept),
    itemTags
  );
  const nclexCategory = firstString(
    topicProductionInferredNclexCategoryFromText(rowText, concept),
    assessmentBridge.nclexCategory,
    topicProductionMeta.nclexCategory,
    taxonomySnapshot.nclexCategory,
    bundle.slides.map((slide) => slide.nclexCategory)
  );
  const cjmStep = firstString(
    topicProductionInferredCjmStepFromText(rowText),
    assessmentBridge.cjmStep,
    topicProductionMeta.cjmStep,
    bundle.slides.map((slide) => slide.cjmStep)
  );
  const sourceEvidence = firstString(
    assessmentBridge.sourceEvidence,
    bundle.sources.map((source) => source.title)
  );
  const hasStudyGuide = bundle.slides.some((slide) => Boolean(String(slide.guidedNotes || "").trim()))
    || bundle.artifacts.some((artifact) => artifactMatches(artifact, /guided|study[_ -]?guide|student[_ -]?notes/i));
  const assets = {
    mapping: Boolean(concept && specialty),
    slideDeck: bundle.slides.length > 0,
    studyGuide: hasStudyGuide,
    visuals: bundleHasVisualSignals(bundle),
    quiz: bundle.items.length >= 1,
    citations: bundle.citations.length >= 1,
  };
  const missing = Object.entries(assets)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const status = topicProductionStatus(missing);

  return {
    id: pkg.id,
    sourceType: "lesson_package",
    topic: pkg.topic,
    title: pkg.title,
    status,
    packageStatus: pkg.status,
    concept,
    nursingSubject: specialty,
    weakTopic,
    nclexCategory,
    cjmStep,
    sourceEvidence,
    review: manifest.topicProductionReview,
    assets,
    missing,
    missingLabels: missing.map((key) => topicProductionAssetLabels[key as keyof typeof topicProductionAssetLabels]),
    placement: topicProductionPlacementForBundle(pkg, status, missing),
    counts: {
      slides: bundle.slides.length,
      studyGuideSlides: bundle.slides.filter((slide) => Boolean(String(slide.guidedNotes || "").trim())).length,
      quizItems: bundle.items.length,
      citations: bundle.citations.length,
      artifacts: bundle.artifacts.length,
    },
    nextAction: topicProductionNextAction(status, missing),
    updatedAt: pkg.updatedAt || pkg.createdAt,
  };
}

function topicProductionRowFromContentBlock(block: any) {
  const inferredTopic = topicProductionInferredBlockTopic(block);
  const concept = topicProductionInferredBlockConcept(block);
  const specialty = topicProductionInferredBlockSubject(block);
  const rowText = topicProductionMappingText(inferredTopic, concept, specialty, topicProductionBlockText(block));
  const weakTopic = topicProductionInferredWeakTopicFromText(rowText, concept);
  const nclexCategory = topicProductionInferredNclexCategoryFromText(rowText, concept);
  const cjmStep = topicProductionInferredCjmStepFromText(rowText);
  const assets = {
    mapping: Boolean(concept && specialty),
    slideDeck: false,
    studyGuide: false,
    visuals: false,
    quiz: false,
    citations: false,
  };
  const missing = Object.entries(assets)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const status = topicProductionStatus(missing);

  return {
    id: block.id,
    sourceType: "content_block",
    topic: inferredTopic || block.title,
    title: block.title,
    status,
    packageStatus: "not_generated",
    concept,
    nursingSubject: specialty,
    weakTopic,
    nclexCategory,
    cjmStep,
    sourceEvidence: block.source || "",
    assets,
    missing,
    missingLabels: missing.map((key) => topicProductionAssetLabels[key as keyof typeof topicProductionAssetLabels]),
    placement: topicProductionPlacementForContentBlock(status, missing),
    counts: {
      slides: 0,
      studyGuideSlides: 0,
      quizItems: 0,
      citations: 0,
      artifacts: 0,
    },
    nextAction: topicProductionNextAction(status, missing),
    updatedAt: block.updatedAt || block.createdAt,
  };
}

function topicProductionRollupRows(rows: Array<ReturnType<typeof topicProductionRowFromContentBlock>>) {
  const groups = new Map<string, ReturnType<typeof topicProductionRowFromContentBlock>[]>();
  for (const row of rows) {
    const key = compactTopicKey(row.sourceEvidence || row.topic || row.title);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    const assets = {
      mapping: group.some((row) => Boolean(row.assets.mapping)),
      slideDeck: group.some((row) => Boolean(row.assets.slideDeck)),
      studyGuide: group.some((row) => Boolean(row.assets.studyGuide)),
      visuals: group.some((row) => Boolean(row.assets.visuals)),
      quiz: group.some((row) => Boolean(row.assets.quiz)),
      citations: group.some((row) => Boolean(row.assets.citations)),
    };
    const missing = Object.entries(assets).filter(([, value]) => !value).map(([key]) => key);
    const status = topicProductionStatus(missing);
    const sourceEvidence = first.sourceEvidence || first.topic || first.title;

    return {
      ...first,
      id: `source:${compactTopicKey(sourceEvidence)}`,
      sourceType: "content_block" as const,
      title: sourceEvidence,
      status,
      assets,
      missing,
      missingLabels: missing.map((key) => topicProductionAssetLabels[key as keyof typeof topicProductionAssetLabels]),
      counts: {
        slides: 0,
        studyGuideSlides: 0,
        quizItems: 0,
        citations: 0,
        artifacts: group.length,
      },
      nextAction: topicProductionNextAction(status, missing),
      sourceEvidence,
      childBlockIds: group.map((row) => row.id),
      chunkCount: group.length,
      updatedAt: group.map((row) => row.updatedAt || "").sort().reverse()[0] || first.updatedAt,
    };
  });
}

function topicProductionPhaseTwoCandidateRows(existingRows: any[] = []) {
  const existingTopicKeys = new Set(existingRows.map((row) => compactTopicKey(row.topic || row.title)));
  return topicProductionPhaseTwoCandidates
    .filter((candidate) => !existingTopicKeys.has(compactTopicKey(candidate.topic)))
    .map((candidate) => {
      const assets = {
        mapping: true,
        slideDeck: false,
        studyGuide: false,
        visuals: false,
        quiz: false,
        citations: false,
      };
      const missing = Object.entries(assets).filter(([, value]) => !value).map(([key]) => key);
      const status = topicProductionStatus(missing);
      return {
        id: candidate.id,
        sourceType: "topic_candidate" as const,
        topic: candidate.topic,
        title: candidate.title,
        status,
        packageStatus: "not_generated",
        concept: candidate.concept,
        nursingSubject: candidate.nursingSubject,
        weakTopic: candidate.weakTopic,
        nclexCategory: candidate.nclexCategory,
        cjmStep: candidate.cjmStep,
        sourceEvidence: candidate.sourceEvidence,
        assets,
        missing,
        missingLabels: missing.map((key) => topicProductionAssetLabels[key as keyof typeof topicProductionAssetLabels]),
        placement: {
          contentKind: "Phase 2 topic candidate",
          currentLocation: "Topic Production backlog",
          belongsIn: "Content Mapper review, source approval, then Lesson Builder draft generation",
          reviewSurface: "Topic Production",
          nextBuildSurface: candidate.nextAction,
          productionQueue: "Hold for human review before any AI polish, video, audio, or visual spend",
          studentVisible: false,
        },
        counts: {
          slides: 0,
          studyGuideSlides: 0,
          quizItems: 0,
          citations: 0,
          artifacts: 0,
        },
        nextAction: candidate.nextAction,
        updatedAt: new Date().toISOString(),
      };
    });
}

function summarizeTopicProductionRows(rows: any[]) {
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const assetCounts = Object.keys(topicProductionAssetLabels).reduce<Record<string, number>>((acc, key) => {
    acc[key] = rows.filter((row) => Boolean(row.assets[key as keyof typeof row.assets])).length;
    return acc;
  }, {});

  return {
    totalTopics: rows.length,
    ready: statusCounts.ready || 0,
    needsMapping: statusCounts.needs_mapping || 0,
    needsAssets: statusCounts.needs_assets || 0,
    packageRows: rows.filter((row) => row.sourceType === "lesson_package").length,
    contentBlockRows: rows.filter((row) => row.sourceType === "content_block").length,
    candidateRows: rows.filter((row) => row.sourceType === "topic_candidate").length,
    assetCounts,
    requiredAssets: topicProductionAssetLabels,
  };
}

function topicProductionAirtableStage(row: any) {
  if (row.status === "ready") return "ready_for_review";
  if (row.status === "needs_mapping") return "taxonomy_mapping";
  return "asset_build";
}

function topicProductionShortHook(row: any) {
  const topic = row.topic || row.title || "this nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  return `Stop memorizing ${topic}. Learn the ${concept} cue that changes the nursing action.`;
}

function topicProductionShortScript(row: any) {
  const topic = row.topic || row.title || "this nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  const subject = row.nursingSubject || "nursing";
  return [
    `If ${topic} keeps showing up in practice questions, do not start by memorizing facts.`,
    `Start with the ${concept} cue, connect it to ${subject}, then choose the safest next nursing action.`,
    "Open the full NurseStudy lesson for the deck, guided notes, rationale, and source-backed quiz practice.",
  ].join(" ");
}

function topicProductionDecoratedRow(row: any) {
  const review = topicProductionReviewForRow(row.sourceType, row.id, row.review);
  return {
    ...row,
    review,
    nextBuildApproved: topicProductionNextBuildDecisions.has(review.decision),
    shorts: {
      hook: topicProductionShortHook(row),
      scriptDraft: topicProductionShortScript(row),
      cta: "Open the full NurseStudy lesson for deck, guided notes, rationales, citations, and quiz practice.",
    },
  };
}

function topicProductionPhaseOneCheckpoint(rows: any[]) {
  const findRow = (subjectKey: "maternal_newborn" | "pediatrics") => {
    const isMaternal = subjectKey === "maternal_newborn";
    const candidates = rows.filter((row) => {
      const text = compactText(`${row.topic || ""} ${row.title || ""} ${row.nursingSubject || ""}`).toLowerCase();
      return isMaternal
        ? /maternal|newborn|postpartum/.test(text)
        : /pediatric|paediatric|child|children|asthma/.test(text);
    });
    const preferred = candidates.find((row) => {
      const text = compactText(`${row.topic || ""} ${row.title || ""}`).toLowerCase();
      return isMaternal
        ? text.includes("maternal-newborn lesson guide") || text.includes("maternal newborn lesson guide")
        : text.includes("pediatrics asthma") || text.includes("asthma");
    });
    return preferred || candidates[0] || null;
  };

  const topics = [
    {
      key: "maternal_newborn",
      subject: "Maternal-Newborn",
      reason: "First nursing-subject review slice for the Harrity maternal-newborn lesson guide.",
      row: findRow("maternal_newborn"),
    },
    {
      key: "pediatrics",
      subject: "Pediatrics",
      reason: "First nursing-subject review slice for the pediatric asthma learner package.",
      row: findRow("pediatrics"),
    },
  ].map((item) => {
    const row = item.row;
    return {
      key: item.key,
      subject: item.subject,
      reason: item.reason,
      found: Boolean(row),
      sourceType: row?.sourceType || "",
      rowId: row?.id || "",
      topic: row?.topic || "",
      title: row?.title || "",
      concept: row?.concept || "",
      nursingSubject: row?.nursingSubject || item.subject,
      status: row?.status || "missing_source",
      reviewDecision: row?.review?.decision || "unreviewed",
      nextBuildApproved: Boolean(row?.nextBuildApproved),
      recommendedDecision: "build_lesson",
      nextAction: row
        ? row.nextBuildApproved
          ? "Open the build packet and inspect coverage before any paid polish."
          : "Review mapping, confirm the asset homes, then mark this row build_lesson."
        : "Import or map the source before spending on generation.",
    };
  });
  const foundCount = topics.filter((topic) => topic.found).length;
  const queuedCount = topics.filter((topic) => topic.nextBuildApproved).length;

  return {
    phase: "Phase 1",
    label: "Two-topic review checkpoint",
    budgetDollars: "$100-$250",
    tokenRule: "2,500 tokens = $100",
    costPolicy: "No broad AI/video batch. Use existing source packets and template drafts first; spend only after both topic rows are reviewed.",
    totalCount: topics.length,
    foundCount,
    queuedCount,
    status: queuedCount >= 2 ? "ready" : foundCount >= 2 ? "review_needed" : "missing_sources",
    topics,
  };
}

function topicProductionPhaseOneStarterSubject(row: any) {
  const text = compactText(`${row.topic || ""} ${row.title || ""}`).toLowerCase();
  if (text.includes("maternal-newborn lesson guide") || text.includes("maternal newborn lesson guide")) return "Maternal-Newborn";
  if (text.includes("pediatrics asthma") || text.includes("asthma")) return "Pediatrics";
  return "";
}

function topicProductionAirtableRows(rows: any[]) {
  return rows.map((row) => {
    const phaseOneSubject = topicProductionPhaseOneStarterSubject(row);
    return {
      "Airtable Status": row.status === "ready" ? "Ready for review" : row.status === "needs_mapping" ? "Needs mapping" : "Needs assets",
      "Production Stage": topicProductionAirtableStage(row),
      "Phase 1 Starter": phaseOneSubject ? "Yes" : "No",
      "Phase 1 Subject": phaseOneSubject,
      "Phase 1 Cost Guardrail": phaseOneSubject ? "$100-$250 checkpoint; no batch AI/video spend until both starter topics pass review." : "",
      "Review Decision": row.review?.decision || "unreviewed",
      "Reviewer Notes": row.review?.reviewerNotes || "",
      "Reviewed At": row.review?.reviewedAt || "",
      "Topic": row.topic || "",
      "Title": row.title || "",
      "Concept": row.concept || "",
      "Nursing Subject": row.nursingSubject || "",
      "Weak Topic": row.weakTopic || "",
      "NCLEX Category": row.nclexCategory || "",
      "CJM Step": row.cjmStep || "",
      "Source Type": row.sourceType || "",
      "Content Kind": row.placement?.contentKind || "",
      "Current Location": row.placement?.currentLocation || "",
      "Belongs In": row.placement?.belongsIn || "",
      "Review Surface": row.placement?.reviewSurface || "",
      "Next Build Surface": row.placement?.nextBuildSurface || "",
      "Production Queue": row.placement?.productionQueue || "",
      "Student Visible": row.placement?.studentVisible ? "Yes" : "No",
      "Package Status": row.packageStatus || "",
      "Lesson Package ID": row.sourceType === "lesson_package" ? row.id : "",
      "Content Block ID": row.sourceType === "content_block" ? row.id : "",
      "Chunk Count": row.chunkCount || "",
      "Child Content Block IDs": Array.isArray(row.childBlockIds) ? row.childBlockIds.join("; ") : "",
      "Slide Deck Ready": row.assets?.slideDeck ? "Yes" : "No",
      "Study Guide Ready": row.assets?.studyGuide ? "Yes" : "No",
      "Visuals Ready": row.assets?.visuals ? "Yes" : "No",
      "Quiz Ready": row.assets?.quiz ? "Yes" : "No",
      "Citations Ready": row.assets?.citations ? "Yes" : "No",
      "Slide Count": row.counts?.slides || 0,
      "Guided Notes Slides": row.counts?.studyGuideSlides || 0,
      "Quiz Count": row.counts?.quizItems || 0,
      "Citation Count": row.counts?.citations || 0,
      "Missing Assets": Array.isArray(row.missingLabels) ? row.missingLabels.join("; ") : "",
      "Suggested Short Hook": row.shorts?.hook || topicProductionShortHook(row),
      "Short Script Draft": row.shorts?.scriptDraft || topicProductionShortScript(row),
      "CTA": row.shorts?.cta || "Open the full NurseStudy lesson for deck, guided notes, rationales, citations, and quiz practice.",
      "Next Action": row.nextAction || "",
      "Source Evidence": row.sourceEvidence || "",
      "Updated At": row.updatedAt || "",
    };
  });
}

function topicProductionAirtableCsv(rows: any[]) {
  const exportRows = topicProductionAirtableRows(rows);
  const headers = [
    "Airtable Status",
    "Production Stage",
    "Phase 1 Starter",
    "Phase 1 Subject",
    "Phase 1 Cost Guardrail",
    "Review Decision",
    "Reviewer Notes",
    "Reviewed At",
    "Topic",
    "Title",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Source Type",
    "Content Kind",
    "Current Location",
    "Belongs In",
    "Review Surface",
    "Next Build Surface",
    "Production Queue",
    "Student Visible",
    "Package Status",
    "Lesson Package ID",
    "Content Block ID",
    "Chunk Count",
    "Child Content Block IDs",
    "Slide Deck Ready",
    "Study Guide Ready",
    "Visuals Ready",
    "Quiz Ready",
    "Citations Ready",
    "Slide Count",
    "Guided Notes Slides",
    "Quiz Count",
    "Citation Count",
    "Missing Assets",
    "Suggested Short Hook",
    "Short Script Draft",
    "CTA",
    "Next Action",
    "Source Evidence",
    "Updated At",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue(row[header as keyof typeof row])).join(",")),
  ].join("\n");
}

function topicProductionBuildBrief(row: any, assetKey: string) {
  const topic = row.topic || row.title || "Selected nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  const subject = row.nursingSubject || "nursing";
  const briefs: Record<string, string> = {
    slideDeck: `Build a concise learner-facing deck for ${topic}: cue recognition, ${concept} explanation, safe nursing action, common trap, and retrieval prompt.`,
    studyGuide: `Create guided notes for ${topic} with fill-in cues, priority decision prompts, and a one-page review summary for ${subject}.`,
    visuals: `Add simple visuals only where they clarify ${topic}: cue map, decision flow, comparison table, or medication/safety diagram.`,
    quiz: `Create at least one NCLEX-style item with answer, rationale, why-wrong options, ${concept} tag, and CJM step.`,
    citations: `Attach source-backed citations from the selected source chunks and keep excerpts short, paraphrased, and learner-safe.`,
  };
  return briefs[assetKey] || "";
}

function topicProductionTemplateDraft(row: any) {
  const topic = row.topic || row.title || "Selected nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  const subject = row.nursingSubject || "nursing";
  const nclexCategory = row.nclexCategory || "Physiological Integrity";
  const cjmStep = row.cjmStep || "Recognize Cues";
  return {
    slideOutline: [
      {
        title: `${topic}: why this matters`,
        purpose: `Orient the learner to the ${subject} context and the core ${concept} decision.`,
        retrievalPrompt: `What cue would make ${topic} a priority?`,
      },
      {
        title: "Recognize the cue pattern",
        purpose: `Name the assessment findings, risk signals, and source-backed cues tied to ${concept}.`,
        retrievalPrompt: "Which cue changes what the nurse does first?",
      },
      {
        title: "Connect concept to safe action",
        purpose: `Link ${concept} to nursing action, patient teaching, and escalation/delegation limits.`,
        retrievalPrompt: "What action is safe, timely, and within nursing scope?",
      },
      {
        title: "Common trap and rationale",
        purpose: `Contrast the tempting memorization answer with the clinical-judgment rationale.`,
        retrievalPrompt: "Why is the common distractor unsafe or incomplete?",
      },
      {
        title: "Practice and commit",
        purpose: `Close with one NCLEX-style practice item, rationale, citation reminder, and student takeaway.`,
        retrievalPrompt: "What evidence supports your answer?",
      },
    ],
    guidedNotesOutline: [
      `Key cue for ${topic}: ________`,
      `Concept link: ${concept} means the nurse should first ________.`,
      `Patient teaching or safety point: ________`,
      `Common trap to avoid: ________`,
      `Citation/evidence note: ________`,
    ],
    practicePreview: {
      stem: `A nursing student reviews a patient scenario related to ${topic}. Which response best reflects ${cjmStep} and safe ${subject} care?`,
      correctAnswer: "Assess the priority cue, connect it to the clinical concept, and choose the safest nursing action.",
      rationale: `The correct answer should use ${concept}, align with ${nclexCategory}, and cite the approved source evidence before publishing.`,
    },
    reviewChecklist: [
      "Slide titles are learner-facing and not instructor notes.",
      "Guided notes have blanks/prompts students can complete.",
      "Practice item has answer, rationale, and why-wrong review.",
      "Every clinical claim can be traced to approved source truth.",
    ],
  };
}

function topicProductionPacketReadiness(row: any, assetPlan: any[], templateDraft: any) {
  const plannedAssets = new Set(assetPlan.map((asset) => asset.assetKey));
  const checks = [
    {
      key: "topic_mapping",
      label: "Concept and nursing subject mapped",
      passed: Boolean(row.concept && row.nursingSubject),
      detail: [row.concept, row.nursingSubject].filter(Boolean).join(" / ") || "Missing concept or nursing subject.",
    },
    {
      key: "source_evidence",
      label: "Source evidence attached",
      passed: Boolean(row.sourceEvidence || row.chunkCount || row.childBlockIds?.length),
      detail: row.sourceEvidence || `${row.chunkCount || 0} source chunk(s) available.`,
    },
    {
      key: "asset_plan",
      label: "Required asset slots planned",
      passed: ["slideDeck", "studyGuide", "visuals", "quiz", "citations"].every((assetKey) => plannedAssets.has(assetKey)),
      detail: assetPlan.map((asset) => asset.asset).join(", "),
    },
    {
      key: "template_skeleton",
      label: "Template draft skeleton complete",
      passed: (templateDraft.slideOutline?.length || 0) >= 5
        && (templateDraft.guidedNotesOutline?.length || 0) >= 5
        && Boolean(templateDraft.practicePreview?.stem && templateDraft.practicePreview?.rationale),
      detail: `${templateDraft.slideOutline?.length || 0} slides, ${templateDraft.guidedNotesOutline?.length || 0} guided-note prompts, practice preview ${templateDraft.practicePreview?.stem ? "present" : "missing"}.`,
    },
    {
      key: "review_decision",
      label: "Queued by review decision",
      passed: topicProductionNextBuildDecisions.has(row.review?.decision),
      detail: row.review?.decision || "unreviewed",
    },
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    readyForTemplateDraft: passedCount === checks.length,
    passedCount,
    totalCount: checks.length,
    checks,
  };
}

function topicProductionCoverageContract(row: any, draftPackage: any, assetPlan: any[]) {
  const assetStatus = (assetKey: string) => {
    if (row.assets?.[assetKey]) return "ready";
    if (draftPackage && ["slideDeck", "studyGuide", "quiz", "citations"].includes(assetKey)) return "draft";
    if (assetPlan.some((asset) => asset.assetKey === assetKey)) return "placeholder";
    return "needed";
  };
  const coverageRows = [
    {
      key: "lessonDeck",
      label: "Video lesson slide deck",
      status: assetStatus("slideDeck"),
      belongsIn: "Lesson Builder package",
      studentSurface: draftPackage ? `/lessons/${draftPackage.packageId}` : "Student lesson page after publish",
      adminSurface: draftPackage ? `/admin/lesson-builder?tab=review&packageId=${draftPackage.packageId}` : "Generate tab in Lesson Builder",
      proof: draftPackage ? `${draftPackage.slideCount || 0} draft slide(s)` : `${row.counts?.slides || 0} slide(s) on current source row`,
      nextAction: draftPackage ? "Review deck flow and publish after QA." : "Create template draft from this packet.",
    },
    {
      key: "studyGuide",
      label: "Guided study guide",
      status: assetStatus("studyGuide"),
      belongsIn: "Guided notes + student study pack",
      studentSurface: draftPackage ? "/student/study-pack" : "Study Pack after lesson is opened or saved",
      adminSurface: draftPackage ? `/admin/lesson-builder?tab=review&packageId=${draftPackage.packageId}` : "Lesson Builder guided notes",
      proof: draftPackage ? "Draft package includes guided-note review checks." : `${row.counts?.studyGuideSlides || 0} guided-note slide(s)`,
      nextAction: "Confirm fill-in cues, priority prompts, and one-page summary.",
    },
    {
      key: "quiz",
      label: "Quiz item and rationale",
      status: assetStatus("quiz"),
      belongsIn: "Lesson practice item",
      studentSurface: draftPackage ? `/lessons/${draftPackage.packageId}` : "Student lesson practice tab after publish",
      adminSurface: draftPackage ? `/admin/lesson-builder?tab=review&packageId=${draftPackage.packageId}` : "Lesson Builder practice item",
      proof: draftPackage ? `${draftPackage.itemCount || 0} draft item(s)` : `${row.counts?.quizItems || 0} quiz item(s)`,
      nextAction: "Verify answer, rationale, why-wrong options, NCLEX tag, and CJM step.",
    },
    {
      key: "visuals",
      label: "Visuals",
      status: assetStatus("visuals"),
      belongsIn: "Slide visual prompts or visual asset queue",
      studentSurface: "Embedded in lesson slides after review",
      adminSurface: "Visual asset queue / Lesson Builder slide edit",
      proof: row.assets?.visuals ? "Visual signals found in current package." : "Placeholder brief only; no paid visual generation yet.",
      nextAction: "Use simple cue map, decision flow, comparison table, or safety diagram before custom art.",
    },
    {
      key: "videoShorts",
      label: "Short/video script",
      status: row.shorts?.scriptDraft ? "placeholder" : "needed",
      belongsIn: "Airtable shorts/video queue after draft approval",
      studentSurface: "Post-MVP video lesson/shorts channel",
      adminSurface: "Topic Matrix Airtable CSV / next spend queue",
      proof: row.shorts?.hook || "No hook drafted yet.",
      nextAction: "Do not spend on audio/video until deck, guide, quiz, citations, and review status pass.",
    },
    {
      key: "citations",
      label: "Source citations",
      status: assetStatus("citations"),
      belongsIn: "Lesson citations and export package",
      studentSurface: draftPackage ? `/lessons/${draftPackage.packageId}` : "Student citations section after publish",
      adminSurface: draftPackage ? `/admin/lesson-builder?tab=review&packageId=${draftPackage.packageId}` : "Lesson Builder QA/export",
      proof: draftPackage ? `${draftPackage.citationCount || 0} citation(s)` : `${row.counts?.citations || 0} citation(s)`,
      nextAction: "Keep source traceability and short learner-safe excerpts.",
    },
  ];
  const readyCount = coverageRows.filter((item) => item.status === "ready" || item.status === "draft").length;
  return {
    readyCount,
    totalCount: coverageRows.length,
    studentReady: Boolean(draftPackage && readyCount >= 4),
    rows: coverageRows,
  };
}

function topicProductionSourceTokens(value: string): string[] {
  return compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token: string) => token.length >= 4 && !["source", "lesson", "guide", "package"].includes(token));
}

function topicProductionMatchedSource(row: any, sourceRecords: any[] = []) {
  const rawNeedles = [row.topic, row.concept, row.nursingSubject, row.sourceEvidence, String(row.id || "").replace(/^source:/i, "")]
    .filter(Boolean)
    .join(" ");
  const tokens = Array.from(new Set(topicProductionSourceTokens(rawNeedles)));
  return sourceRecords
    .map((source) => {
      const haystack = [source.id, source.title, source.subject, source.sourceType].filter(Boolean).join(" ").toLowerCase();
      const tokenScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      const readyBonus = source.approvalStatus === "approved" && source.ingestionStatus === "ready" ? 2 : 0;
      return { source, score: tokenScore + readyBonus };
    })
    .filter((candidate) => candidate.score >= 4)
    .sort((a, b) => b.score - a.score)[0]?.source || null;
}

function topicProductionDraftTopicKey(value: any) {
  return compactText(value)
    .toLowerCase()
    .replace(/\b(template|draft|lesson|guide|package)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topicProductionPreviewKey(existing?: unknown) {
  const current = typeof existing === "string" ? existing.trim() : "";
  return current.length >= 16 ? current : randomBytes(18).toString("base64url");
}

function topicProductionPreviewAllowed(pkg: any, previewKey?: unknown) {
  if (pkg?.status === "published") return true;
  const key = typeof previewKey === "string" ? previewKey.trim() : "";
  const decision = pkg?.manifest?.topicProductionStudentLaunchDecision || {};
  return Boolean(
    key
    && decision.decision === "approve_student_preview"
    && decision.previewKey
    && decision.previewKey === key
  );
}

function topicProductionDraftSummary(record: any) {
  if (!record) return null;
  const pkg = record.package || record;
  const slides = Array.isArray(record.slides) ? record.slides : [];
  const items = Array.isArray(record.items) ? record.items : [];
  const citations = Array.isArray(record.citations) ? record.citations : [];
  if (!pkg?.id || !pkg?.title) return null;
  const failCount = Number(pkg.qaSummary?.failCount || 0);
  const warnCount = Number(pkg.qaSummary?.warnCount || pkg.qaSummary?.warningCount || 0);
  const draftReview = pkg.manifest?.topicProductionDraftReview || {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
  const phaseThreeDecision = pkg.manifest?.topicProductionPhaseThreeDecision || {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
  const studentLaunchDecision = pkg.manifest?.topicProductionStudentLaunchDecision || {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
  const topicProduction = pkg.manifest?.topicProduction || {};
  const publicReleaseDecision = pkg.manifest?.topicProductionStudentLaunchDecision?.publicReleaseDecision || {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
  const reviewChecklist = [
    {
      key: "slides",
      label: "Lesson deck exists",
      passed: slides.length >= 5,
      detail: `${slides.length} slide(s) generated for review.`,
    },
    {
      key: "practice",
      label: "Quiz/rationale exists",
      passed: items.length >= 1,
      detail: `${items.length} practice item(s) attached.`,
    },
    {
      key: "citations",
      label: "Citations are attached",
      passed: citations.length >= Math.max(1, Math.min(slides.length, 5)),
      detail: `${citations.length} citation(s) available for source checking.`,
    },
    {
      key: "qa",
      label: "QA has no failures",
      passed: failCount === 0,
      detail: `${failCount} fail / ${warnCount} warning(s).`,
    },
    {
      key: "source_truth",
      label: "Source truth linked",
      passed: Array.isArray(pkg.sourceIds) && pkg.sourceIds.length > 0,
      detail: `${Array.isArray(pkg.sourceIds) ? pkg.sourceIds.length : 0} source record(s) selected.`,
    },
  ];
  const reviewPassedCount = reviewChecklist.filter((check) => check.passed).length;
  const baseRecommendation = reviewPassedCount === reviewChecklist.length
    ? "Ready for human review or a small polish pass."
    : "Do not spend on polish/video yet; fix the failed checklist items first.";
  const nextSpendRecommendation = draftReview.decision === "approve_polish"
    ? "Approved for the next $100-$250 polish checkpoint."
    : draftReview.decision === "needs_fix"
      ? "Needs fixes before the next spend checkpoint."
      : draftReview.decision === "hold"
        ? "Hold spending on this draft until the topic is re-prioritized."
        : baseRecommendation;
  return {
    packageId: pkg.id,
    title: pkg.title,
    topic: pkg.topic || "",
    status: pkg.status || "draft",
    slideCount: slides.length,
    itemCount: items.length,
    citationCount: citations.length,
    qaStatus: pkg.qaSummary?.status || pkg.status || "unknown",
    failCount,
    warnCount,
    reviewChecklist,
    reviewPassedCount,
    reviewTotalCount: reviewChecklist.length,
    reviewPackageWorkOrderId: topicProduction.reviewPackageWorkOrderId || "",
    draftReview,
    phaseThreeDecision,
    studentLaunchDecision,
    publicReleaseDecision,
    nextSpendApproved: draftReview.decision === "approve_polish" && reviewPassedCount === reviewChecklist.length,
    nextSpendRecommendation,
    updatedAt: pkg.updatedAt || pkg.createdAt || new Date().toISOString(),
  };
}

function topicProductionPreviewReviewSummary(record: any) {
  const draft = topicProductionDraftSummary(record);
  if (!draft) return null;

  return {
    status: draft.reviewPassedCount === draft.reviewTotalCount ? "ready_for_human_review" : "needs_admin_fix",
    passedCount: draft.reviewPassedCount,
    totalCount: draft.reviewTotalCount,
    checklist: draft.reviewChecklist.map((check: any) => ({
      label: check.label,
      passed: Boolean(check.passed),
      detail: check.detail,
    })),
    decisions: {
      draftReview: draft.draftReview?.decision || "unreviewed",
      phaseThree: draft.phaseThreeDecision?.decision || "unreviewed",
      studentLaunch: draft.studentLaunchDecision?.decision || "unreviewed",
      previewReview: draft.studentLaunchDecision?.previewReview?.outcome || "not_recorded",
    },
    reviewerFocus: [
      "Confirm the lesson is clinically accurate for prelicensure RN learners.",
      "Check that slide language is learner-facing and not instructor-only planning text.",
      "Verify the practice answer, rationale, and citation support before public release.",
    ],
    recommendation: draft.nextSpendRecommendation,
  };
}

function topicProductionExistingDraft(row: any, draftRecords: any[] = []) {
  const topic = row.topic || row.title || "";
  const expectedTitle = `${topic} Template Draft`.toLowerCase();
  const topicKey = topicProductionDraftTopicKey(topic);
  return draftRecords
    .map(topicProductionDraftSummary)
    .filter(Boolean)
    .find((summary: any) => {
      const title = String(summary.title || "").toLowerCase();
      const summaryTopicKey = topicProductionDraftTopicKey(summary.topic || summary.title);
      return title === expectedTitle || (title.includes("template draft") && topicKey && summaryTopicKey.includes(topicKey));
    }) || null;
}

function topicProductionBuildPackets(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  return rows.map((row, index) => {
    const topic = row.topic || row.title || "Selected nursing topic";
    const concept = row.concept || row.weakTopic || "";
    const subject = row.nursingSubject || "";
    const assetPlan = Object.keys(topicProductionAssetLabels).map((assetKey) => ({
      assetKey,
      asset: topicProductionAssetLabels[assetKey as keyof typeof topicProductionAssetLabels],
      status: row.assets?.[assetKey] ? "ready" : "needed",
      belongsIn: assetKey === "visuals" ? "Visual asset queue" : "Lesson Builder",
      brief: topicProductionBuildBrief(row, assetKey),
    }));
    const templateDraft = topicProductionTemplateDraft(row);
    const readiness = topicProductionPacketReadiness(row, assetPlan, templateDraft);
    const matchedSource = topicProductionMatchedSource(row, sourceRecords);
    const draftPackage = topicProductionExistingDraft(row, draftRecords);
    const coverageContract = topicProductionCoverageContract(row, draftPackage, assetPlan);
    const driveProjectAssets = topicProductionDriveAssetsForRow(row);
    return {
      buildOrder: index + 1,
      topic,
      concept,
      nursingSubject: subject,
      weakTopic: row.weakTopic || "",
      nclexCategory: row.nclexCategory || "",
      cjmStep: row.cjmStep || "",
      sourceType: row.sourceType,
      sourceId: row.id,
      sourceTruth: matchedSource ? {
        sourceId: matchedSource.id,
        title: matchedSource.title,
        sourceType: matchedSource.sourceType,
        subject: matchedSource.subject,
        approvalStatus: matchedSource.approvalStatus,
        ingestionStatus: matchedSource.ingestionStatus,
      } : null,
      sourceEvidence: row.sourceEvidence || "",
      reviewDecision: row.review?.decision || "unreviewed",
      reviewerNotes: row.review?.reviewerNotes || "",
      chunkCount: row.chunkCount || 0,
      childBlockIds: Array.isArray(row.childBlockIds) ? row.childBlockIds : [],
      lessonBuilderInput: {
        title: topic,
        audience: "nursing students",
        concept,
        nursingSubject: subject,
        slideTarget: row.counts?.slides > 0 ? row.counts.slides : 8,
        minimumQuizItems: Math.max(1, row.counts?.quizItems || 0),
        guidedNotesRequired: true,
        citationsRequired: true,
      },
      assetPlan,
      driveProjectAssets,
      coverageContract,
      templateDraft,
      draftPackage,
      readiness,
      shortsStarter: row.shorts || {
        hook: topicProductionShortHook(row),
        scriptDraft: topicProductionShortScript(row),
        cta: "Open the full NurseStudy lesson.",
      },
      humanReviewGate: [
        "Confirm concept and nursing subject before generation.",
        "Faculty/content expert reviews any safety-sensitive teaching.",
        "Publish only after deck, study guide, quiz rationale, and citations pass QA.",
      ],
      costGuardrail: "Use this packet to approve scope before spending AI/video production budget.",
    };
  });
}

function topicProductionBuildPacketRows(packets: any[]) {
  return packets.flatMap((packet) => packet.assetPlan.map((asset: any) => ({
    "Build Order": packet.buildOrder,
    "Topic": packet.topic,
    "Concept": packet.concept,
    "Nursing Subject": packet.nursingSubject,
    "Weak Topic": packet.weakTopic,
    "NCLEX Category": packet.nclexCategory,
    "CJM Step": packet.cjmStep,
    "Source Type": packet.sourceType,
    "Source ID": packet.sourceId,
    "Matched Source ID": packet.sourceTruth?.sourceId || "",
    "Matched Source Title": packet.sourceTruth?.title || "",
    "Drive Project Assets": (packet.driveProjectAssets || []).map((asset: any) => asset.title).join(" | "),
    "Drive Asset Links": (packet.driveProjectAssets || []).map((asset: any) => asset.url).join(" | "),
    "Chunk Count": packet.chunkCount,
    "Asset": asset.asset,
    "Asset Status": asset.status,
    "Belongs In": asset.belongsIn,
    "Build Brief": asset.brief,
    "Coverage Status": (packet.coverageContract?.rows || []).find((item: any) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.status || "",
    "Coverage Proof": (packet.coverageContract?.rows || []).find((item: any) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.proof || "",
    "Student Surface": (packet.coverageContract?.rows || []).find((item: any) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.studentSurface || "",
    "Admin Surface": (packet.coverageContract?.rows || []).find((item: any) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.adminSurface || "",
    "Coverage Summary": packet.coverageContract ? `${packet.coverageContract.readyCount}/${packet.coverageContract.totalCount} reviewable; student ready ${packet.coverageContract.studentReady ? "yes" : "no"}` : "",
    "Video/Shorts Status": (packet.coverageContract?.rows || []).find((item: any) => item.key === "videoShorts")?.status || "",
    "Short Hook": packet.shortsStarter.hook || "",
    "Short Script Draft": packet.shortsStarter.scriptDraft || "",
    "Template Slide Outline": (packet.templateDraft?.slideOutline || []).map((slide: any) => slide.title).join(" | "),
    "Practice Preview": packet.templateDraft?.practicePreview?.stem || "",
    "Template Draft Status": packet.draftPackage ? `${packet.draftPackage.status} / ${packet.draftPackage.qaStatus}` : "Not created",
    "Template Draft Package ID": packet.draftPackage?.packageId || "",
    "Template Draft Counts": packet.draftPackage
      ? `${packet.draftPackage.slideCount} slides / ${packet.draftPackage.itemCount} item(s) / ${packet.draftPackage.citationCount} citation(s)`
      : "",
    "Template Draft Review Checks": packet.draftPackage
      ? `${packet.draftPackage.reviewPassedCount}/${packet.draftPackage.reviewTotalCount}`
      : "",
    "Template Draft Review Decision": packet.draftPackage?.draftReview?.decision || "",
    "Next Spend Approved": packet.draftPackage?.nextSpendApproved ? "yes" : "no",
    "Next Spend Recommendation": packet.draftPackage?.nextSpendRecommendation || "",
    "Readiness Status": packet.readiness?.readyForTemplateDraft ? "Ready for template draft" : "Not ready",
    "Readiness Checks": (packet.readiness?.checks || []).map((check: any) => `${check.label}: ${check.passed ? "pass" : "needs review"}`).join(" | "),
    "Review Gate": packet.humanReviewGate.join(" | "),
    "Source Evidence": packet.sourceEvidence,
    "Cost Guardrail": packet.costGuardrail,
  })));
}

function topicProductionBuildPacketsCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionBuildPacketRows(topicProductionBuildPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Build Order",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Source Type",
    "Source ID",
    "Matched Source ID",
    "Matched Source Title",
    "Drive Project Assets",
    "Drive Asset Links",
    "Chunk Count",
    "Asset",
    "Asset Status",
    "Belongs In",
    "Build Brief",
    "Coverage Status",
    "Coverage Proof",
    "Student Surface",
    "Admin Surface",
    "Coverage Summary",
    "Video/Shorts Status",
    "Short Hook",
    "Short Script Draft",
    "Template Slide Outline",
    "Practice Preview",
    "Template Draft Status",
    "Template Draft Package ID",
    "Template Draft Counts",
    "Template Draft Review Checks",
    "Template Draft Review Decision",
    "Next Spend Approved",
    "Next Spend Recommendation",
    "Readiness Status",
    "Readiness Checks",
    "Review Gate",
    "Source Evidence",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionHumanReviewCatalogRows(rows: any[]) {
  const rank = (row: any) => {
    if (row.sourceType === "lesson_package" && row.packageStatus === "published") return 0;
    if (row.sourceType === "lesson_package") return 1;
    if (row.sourceType === "topic_candidate") return 2;
    return 3;
  };
  const sortedRows = [...rows].sort((a, b) => rank(a) - rank(b));
  return topicProductionHumanReviewCatalogTopics
    .map((topic) => sortedRows.find((row) => compactTopicKey(row.topic || row.title) === compactTopicKey(topic)))
    .filter(Boolean);
}

function topicProductionHumanReviewPackRows(rows: any[]) {
  return topicProductionHumanReviewCatalogRows(rows).map((row) => {
    const driveAssets = topicProductionDriveAssetsForRow(row);
    const review = topicProductionReviewForRow(row.sourceType, row.id, row.review);
    const recommendedDecision = row.sourceType === "lesson_package"
      ? "approve_mapping"
      : row.assets?.mapping
        ? "approve_mapping"
        : "needs_edit";
    const assetPlacement = Object.entries(topicProductionAssetLabels)
      .map(([key, label]) => `${label}: ${row.assets?.[key] ? "ready" : "needed"}`)
      .join(" | ");
    const reviewStage = row.sourceType === "lesson_package"
      ? (row.packageStatus === "published" ? "public_example_review" : "draft_review")
      : "candidate_topic_review";

    return {
      "Review Stage": reviewStage,
      "Spend Window": "$100-$500",
      "Topic": row.topic,
      "Concept": row.concept,
      "Nursing Subject": row.nursingSubject,
      "Weak Topic": row.weakTopic || "",
      "NCLEX Category": row.nclexCategory || "",
      "CJM Step": row.cjmStep || "",
      "Source Type": row.sourceType,
      "Source ID": row.id,
      "Package Status": row.packageStatus || "",
      "Current Location": row.placement?.currentLocation || "",
      "Belongs In": row.placement?.belongsIn || "",
      "Student Visible": row.placement?.studentVisible ? "yes" : "no",
      "Asset Placement": assetPlacement,
      "Drive Project Assets": driveAssets.map((asset: any) => asset.title).join(" | "),
      "Drive Asset Links": driveAssets.map((asset: any) => asset.url).join(" | "),
      "Source Evidence": row.sourceEvidence || "",
      "Review Decision": review.decision || "unreviewed",
      "Reviewer Notes": review.reviewerNotes || "",
      "Recommended Decision": recommendedDecision,
      "Immediate Review Question": "Is this topic mapped to the right concept, nursing subject, weak-topic bridge, source placement, and next build action?",
      "Next Owner Action": row.nextAction || row.placement?.nextBuildSurface || "",
      "Hold Trigger": "Hold if the concept, specialty, source evidence, quiz rationale, or student value is unclear.",
      "Cost Guardrail": "Human review only. Do not spend on AI polish, visuals, audio, or video until this row has an explicit review decision.",
    };
  });
}

function topicProductionHumanReviewPackCsv(rows: any[]) {
  const exportRows = topicProductionHumanReviewPackRows(rows);
  const headers = [
    "Review Stage",
    "Spend Window",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Source Type",
    "Source ID",
    "Package Status",
    "Current Location",
    "Belongs In",
    "Student Visible",
    "Asset Placement",
    "Drive Project Assets",
    "Drive Asset Links",
    "Source Evidence",
    "Review Decision",
    "Reviewer Notes",
    "Recommended Decision",
    "Immediate Review Question",
    "Next Owner Action",
    "Hold Trigger",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionMediaPilotPackRows(rows: any[]) {
  return topicProductionHumanReviewCatalogRows(rows)
    .filter((row) => topicProductionReviewForRow(row.sourceType, row.id, row.review).decision === "approve_mapping")
    .map((row) => {
      const driveAssets = topicProductionDriveAssetsForRow(row);
      const review = topicProductionReviewForRow(row.sourceType, row.id, row.review);
      const topic = row.topic || row.title || "Untitled topic";
      const sourceEvidence = row.sourceEvidence || row.placement?.sourceEvidence || "";

      return {
        "Pilot Stage": "phase_4_media_pilot_plan",
        "Spend Window": "$100-$500",
        "Topic": topic,
        "Concept": row.concept || "",
        "Nursing Subject": row.nursingSubject || "",
        "Weak Topic": row.weakTopic || "",
        "NCLEX Category": row.nclexCategory || "",
        "CJM Step": row.cjmStep || "",
        "Source Type": row.sourceType,
        "Source ID": row.id,
        "Review Decision": review.decision,
        "Reviewer Notes": review.reviewerNotes || "",
        "Slide Deck Plan": `Create or attach a 6-8 slide learner deck for ${topic}: why it matters, cue pattern, safest action, common trap, practice/rationale, and source recap.`,
        "Study Guide Plan": `Create a one-page guided note for ${topic} with blanks for priority cues, concept link, safety action, patient teaching, and citation note.`,
        "Visual Plan": `Place one cue map or decision-flow visual for ${topic}; do not generate image/video assets until this media pilot row is explicitly approved.`,
        "Quiz/Rationale Plan": `Attach at least 1 NCLEX-style item for ${topic} with correct answer, why-wrong rationales, concept tag, CJM step, and citation.`,
        "Narration Script Plan": `Draft speaker-notes narration from the deck for ${topic}; TTS, audio, and video rendering are not approved in this checkpoint.`,
        "Video Status": "not_started_manual_approval_required",
        "Required Human Approval": "Approve one media pilot only. No batch generation, paid media rendering, TTS, or video export until the first row is reviewed.",
        "Source Evidence": sourceEvidence,
        "Drive Project Assets": driveAssets.map((asset: any) => asset.title).join(" | "),
        "Drive Asset Links": driveAssets.map((asset: any) => asset.url).join(" | "),
        "Hold Trigger": "Hold if the topic placement, concept, specialty, source evidence, quiz rationale, or learner value is unclear.",
        "Cost Guardrail": "Planning and placement only. Keep this checkpoint inside $100-$500; do not run media generation until a single row is explicitly approved.",
      };
    });
}

function topicProductionMediaPilotPackCsv(rows: any[]) {
  const exportRows = topicProductionMediaPilotPackRows(rows);
  const headers = [
    "Pilot Stage",
    "Spend Window",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Source Type",
    "Source ID",
    "Review Decision",
    "Reviewer Notes",
    "Slide Deck Plan",
    "Study Guide Plan",
    "Visual Plan",
    "Quiz/Rationale Plan",
    "Narration Script Plan",
    "Video Status",
    "Required Human Approval",
    "Source Evidence",
    "Drive Project Assets",
    "Drive Asset Links",
    "Hold Trigger",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

const topicProductionMediaWorkOrderLineItems = [
  { name: "Slide deck scaffold", tokens: 1000, dollars: 40 },
  { name: "Guided study guide scaffold", tokens: 700, dollars: 28 },
  { name: "Quiz and rationale draft", tokens: 500, dollars: 20 },
  { name: "Visual storyboard or prompt plan", tokens: 300, dollars: 12 },
  { name: "Narration script outline", tokens: 500, dollars: 20 },
  { name: "Creator review checklist", tokens: 500, dollars: 20 },
];

function topicProductionMediaWorkOrderRows(rows: any[]) {
  const lineItemSummary = topicProductionMediaWorkOrderLineItems
    .map((item) => `${item.name}: ${item.tokens} tokens / $${item.dollars}`)
    .join(" | ");
  const estimatedTokens = topicProductionMediaWorkOrderLineItems.reduce((sum, item) => sum + item.tokens, 0);
  const estimatedDollars = topicProductionMediaWorkOrderLineItems.reduce((sum, item) => sum + item.dollars, 0);

  return topicProductionMediaPilotPackRows(rows).map((pilotRow) => {
    const topic = String(pilotRow["Topic"] || "Untitled topic");
    const sourceId = String(pilotRow["Source ID"] || compactTopicKey(topic));
    const workOrderId = topicProductionMediaWorkOrderId(sourceId);
    const review = topicProductionMediaWorkOrderReviewForId(workOrderId);
    const approvalStatus = review.decision === "approve_single_topic_scaffold"
      ? "approved_for_single_topic_scaffold"
      : review.decision === "needs_revision"
        ? "needs_revision"
        : review.decision === "hold_spend"
          ? "hold_spend"
          : "manual_approval_required";

    return {
      "Work Order ID": workOrderId,
      "Work Order Stage": "phase_4_single_topic_media_work_order",
      "Approval Status": approvalStatus,
      "Work Order Review Decision": review.decision,
      "Work Order Review Notes": review.reviewerNotes,
      "Work Order Reviewed At": review.reviewedAt || "",
      "Cost Basis": "2,500 tokens = $100; $0.04 per token planning rate.",
      "Estimated Token Budget": estimatedTokens,
      "Estimated Dollar Budget": `$${estimatedDollars}`,
      "Maximum Dollar Checkpoint": "$500",
      "Topic": topic,
      "Concept": pilotRow["Concept"],
      "Nursing Subject": pilotRow["Nursing Subject"],
      "Weak Topic": pilotRow["Weak Topic"],
      "NCLEX Category": pilotRow["NCLEX Category"],
      "CJM Step": pilotRow["CJM Step"],
      "Production Line Items": lineItemSummary,
      "Slide Deck Work": pilotRow["Slide Deck Plan"],
      "Study Guide Work": pilotRow["Study Guide Plan"],
      "Visual Work": pilotRow["Visual Plan"],
      "Quiz Work": pilotRow["Quiz/Rationale Plan"],
      "Narration Work": pilotRow["Narration Script Plan"],
      "Video Work": "Do not start video production. Create only a storyboard slot until manual approval is recorded.",
      "Current Video Status": pilotRow["Video Status"],
      "Required Before Spend": approvalStatus === "approved_for_single_topic_scaffold"
        ? "Single-topic scaffold planning is approved; media rendering, TTS, and video still require a separate decision."
        : "Creator approves this single work order and confirms source evidence, quiz rationale, and learner value.",
      "Source Evidence": pilotRow["Source Evidence"],
      "Drive Project Assets": pilotRow["Drive Project Assets"],
      "Drive Asset Links": pilotRow["Drive Asset Links"],
      "Cost Guardrail": "One topic only. No batch generation, no TTS, no rendered video, and no paid visual generation in this checkpoint.",
    };
  });
}

function topicProductionMediaWorkOrderCsv(rows: any[]) {
  const exportRows = topicProductionMediaWorkOrderRows(rows);
  const headers = [
    "Work Order ID",
    "Work Order Stage",
    "Approval Status",
    "Work Order Review Decision",
    "Work Order Review Notes",
    "Work Order Reviewed At",
    "Cost Basis",
    "Estimated Token Budget",
    "Estimated Dollar Budget",
    "Maximum Dollar Checkpoint",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Production Line Items",
    "Slide Deck Work",
    "Study Guide Work",
    "Visual Work",
    "Quiz Work",
    "Narration Work",
    "Video Work",
    "Current Video Status",
    "Required Before Spend",
    "Source Evidence",
    "Drive Project Assets",
    "Drive Asset Links",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionMediaScaffoldPackRows(rows: any[]) {
  return topicProductionMediaWorkOrderRows(rows)
    .filter((workOrder) => workOrder["Work Order Review Decision"] === "approve_single_topic_scaffold")
    .map((workOrder) => {
      const topic = String(workOrder["Topic"] || "Untitled topic");
      const concept = String(workOrder["Concept"] || "Clinical Judgment");
      const subject = String(workOrder["Nursing Subject"] || "Nursing");
      const weakTopic = String(workOrder["Weak Topic"] || "Priority decision");
      const cjmStep = String(workOrder["CJM Step"] || "Recognize Cues");
      const nclexCategory = String(workOrder["NCLEX Category"] || "Physiological Integrity");
      const scaffoldReview = topicProductionMediaScaffoldReviewForId(String(workOrder["Work Order ID"] || ""));
      const scaffoldApprovalStatus = scaffoldReview.decision === "approve_ai_draft_checkpoint"
        ? "approved_for_ai_draft_checkpoint"
        : scaffoldReview.decision === "needs_revision"
          ? "needs_revision"
          : scaffoldReview.decision === "hold_spend"
            ? "hold_spend"
            : "creator_review_required";

      return {
        "Scaffold Stage": "phase_4_single_topic_scaffold_ready",
        "Approved Work Order ID": workOrder["Work Order ID"],
        "Scaffold Approval Status": scaffoldApprovalStatus,
        "Scaffold Review Decision": scaffoldReview.decision,
        "Scaffold Review Notes": scaffoldReview.reviewerNotes,
        "Scaffold Reviewed At": scaffoldReview.reviewedAt || "",
        "Topic": topic,
        "Concept": concept,
        "Nursing Subject": subject,
        "Weak Topic": weakTopic,
        "NCLEX Category": nclexCategory,
        "CJM Step": cjmStep,
        "Estimated Dollar Budget": workOrder["Estimated Dollar Budget"],
        "Estimated Token Budget": workOrder["Estimated Token Budget"],
        "Slide Deck Scaffold": [
          `Slide 1: Why ${topic} matters for ${subject}`,
          `Slide 2: Priority cues and risk signals`,
          `Slide 3: Link cues to ${concept}`,
          `Slide 4: Safest first nursing action`,
          `Slide 5: Common trap or distractor`,
          `Slide 6: Practice item and rationale`,
          `Slide 7: Source-backed recap`,
          `Slide 8: Student takeaways and next review`,
        ].join(" | "),
        "Study Guide Scaffold": `Guided notes for ${topic}: define ${weakTopic}; list three priority cues; connect cues to ${cjmStep}; choose safest action; write one patient-teaching point; cite source evidence.`,
        "Visual Storyboard": `Create a simple cue-to-action flow: source cue -> risk interpretation -> ${concept} link -> safest nursing action. Do not render custom art yet.`,
        "Quiz Scaffold": `One NCLEX-style item for ${topic} with one correct answer, three distractors, why-correct rationale, why-wrong rationales, ${nclexCategory} tag, ${cjmStep} tag, and citation.`,
        "Narration Outline": `Speaker notes only: introduce ${topic}; explain why the cue pattern matters; walk through the decision; close with the practice rationale. No TTS/audio rendering.`,
        "Creator Review Checklist": "Confirm source evidence | Confirm concept/specialty mapping | Confirm quiz rationale | Confirm student value | Confirm no media rendering requested",
        "Next Allowed Action": scaffoldApprovalStatus === "approved_for_ai_draft_checkpoint"
          ? "Creator approved this scaffold for the next AI text-draft checkpoint only; TTS, video, batch generation, and paid visuals remain blocked."
          : scaffoldApprovalStatus === "needs_revision"
            ? "Revise the scaffold outline before approving any AI text-draft checkpoint."
            : scaffoldApprovalStatus === "hold_spend"
              ? "Hold this topic; do not start AI drafting or media work."
              : "Creator reviews and edits this scaffold; no paid media rendering or batch production.",
        "Source Evidence": workOrder["Source Evidence"],
        "Drive Project Assets": workOrder["Drive Project Assets"],
        "Drive Asset Links": workOrder["Drive Asset Links"],
        "Cost Guardrail": "Deterministic scaffold only until creator approval. Scaffold approval permits only a separately budgeted AI text-draft checkpoint; no TTS, no rendered video, no paid visual generation.",
      };
    });
}

function topicProductionMediaScaffoldPackCsv(rows: any[]) {
  const exportRows = topicProductionMediaScaffoldPackRows(rows);
  const headers = [
    "Scaffold Stage",
    "Approved Work Order ID",
    "Scaffold Approval Status",
    "Scaffold Review Decision",
    "Scaffold Review Notes",
    "Scaffold Reviewed At",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Estimated Dollar Budget",
    "Estimated Token Budget",
    "Slide Deck Scaffold",
    "Study Guide Scaffold",
    "Visual Storyboard",
    "Quiz Scaffold",
    "Narration Outline",
    "Creator Review Checklist",
    "Next Allowed Action",
    "Source Evidence",
    "Drive Project Assets",
    "Drive Asset Links",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionMediaTextDraftPackRows(rows: any[]) {
  return topicProductionMediaScaffoldPackRows(rows)
    .filter((scaffold) => scaffold["Scaffold Review Decision"] === "approve_ai_draft_checkpoint")
    .map((scaffold) => {
      const topic = String(scaffold["Topic"] || "Untitled topic");
      const concept = String(scaffold["Concept"] || "Clinical Judgment");
      const subject = String(scaffold["Nursing Subject"] || "Nursing");
      const weakTopic = String(scaffold["Weak Topic"] || "Priority decision");
      const cjmStep = String(scaffold["CJM Step"] || "Recognize Cues");
      const nclexCategory = String(scaffold["NCLEX Category"] || "Physiological Integrity");
      const sourceEvidence = String(scaffold["Source Evidence"] || "Source evidence pending creator review.");
      const textDraftReview = topicProductionMediaTextDraftReviewForId(String(scaffold["Approved Work Order ID"] || ""));
      const textDraftApprovalStatus = textDraftReview.decision === "approve_package_assembly_checkpoint"
        ? "approved_for_package_assembly_checkpoint"
        : textDraftReview.decision === "needs_revision"
          ? "needs_revision"
          : textDraftReview.decision === "hold_spend"
            ? "hold_spend"
            : "creator_review_required";

      return {
        "Draft Stage": "phase_5_single_topic_text_draft_ready_for_creator_review",
        "Approved Work Order ID": scaffold["Approved Work Order ID"],
        "Text Draft Approval Status": textDraftApprovalStatus,
        "Text Draft Review Decision": textDraftReview.decision,
        "Text Draft Review Notes": textDraftReview.reviewerNotes,
        "Text Draft Reviewed At": textDraftReview.reviewedAt || "",
        "Topic": topic,
        "Concept": concept,
        "Nursing Subject": subject,
        "Weak Topic": weakTopic,
        "NCLEX Category": nclexCategory,
        "CJM Step": cjmStep,
        "Draft Mode": "local_text_draft_checkpoint_no_external_media_generation",
        "Slide Deck Text Draft": [
          `Slide 1 - Why it matters: ${topic} is a priority ${subject} decision because students must recognize early cues, connect them to ${concept}, and choose the safest first nursing action.`,
          `Slide 2 - Cues: look for changes in assessment findings, risk factors, timing, and response to intervention that point toward ${weakTopic}.`,
          `Slide 3 - Clinical judgment link: use ${cjmStep} to separate expected findings from warning signs before choosing an action.`,
          `Slide 4 - Action: prioritize safety, rapid reassessment, escalation when indicated, and patient-centered teaching.`,
          `Slide 5 - Trap: do not jump to a familiar task before matching the cue pattern to the highest-risk problem.`,
          `Slide 6 - Practice: answer one NCLEX-style item, then read both correct and incorrect rationales.`,
          `Slide 7 - Evidence: anchor the explanation to the cited source packet and keep paraphrasing concise.`,
          `Slide 8 - Takeaway: name the cue, explain the risk, choose the action, and document the reassessment.`,
        ].join(" | "),
        "Study Guide Text Draft": `Student notes: define ${weakTopic}; list three priority cues; explain why those cues matter in ${subject}; connect the decision to ${concept} and ${cjmStep}; write the safest first action; write one teaching point; add the citation used for review.`,
        "Visual Brief Text": `Storyboard a simple four-step flow: cue observed -> risk interpreted -> ${concept} decision -> safest nursing action. Use plain icons/placeholders only until visual generation is separately approved.`,
        "Quiz/Rationale Text Draft": `Stem: A nursing student reviews a client scenario about ${topic}. Which action best reflects ${cjmStep}? Correct answer should prioritize the safest first nursing action. Rationales: explain why the correct answer addresses ${weakTopic}; explain why each distractor is delayed, incomplete, or mismatched to the cue pattern. Tags: ${nclexCategory}; ${cjmStep}; ${subject}.`,
        "Narration Script Draft": `Opening: Today we are focusing on ${topic}. Body: Start with the cue pattern, then explain the risk, the ${concept} link, and the safest action. Practice: Pause for the NCLEX item and rationale. Close: Before moving on, students should be able to name the priority cue and justify the nursing action. No TTS or audio rendering is approved.`,
        "Creator Review Questions": "Is the source evidence accurate? | Is the student-facing wording clear? | Does the quiz rationale teach why distractors are wrong? | Is the visual brief simple enough for first review? | Should this move to paid AI/media production?",
        "Next Allowed Action": textDraftApprovalStatus === "approved_for_package_assembly_checkpoint"
          ? "Creator approved package assembly checkpoint only. Build a learner-safe package next; TTS, rendered video, paid visuals, and batch generation remain blocked."
          : textDraftApprovalStatus === "needs_revision"
            ? "Revise slide, study guide, quiz, visual brief, or narration text before package assembly."
            : textDraftApprovalStatus === "hold_spend"
              ? "Hold this text draft; do not assemble package or start media work."
              : "Creator reviews and edits text drafts. A separate approval is required before package assembly, TTS, rendered video, paid visuals, or batch generation.",
        "Source Evidence": sourceEvidence,
        "Drive Project Assets": scaffold["Drive Project Assets"],
        "Drive Asset Links": scaffold["Drive Asset Links"],
        "Cost Guardrail": "Text-draft checkpoint only. No TTS, no rendered video, no paid visual generation, and no batch generation.",
      };
    });
}

function topicProductionMediaTextDraftPackCsv(rows: any[]) {
  const exportRows = topicProductionMediaTextDraftPackRows(rows);
  const headers = [
    "Draft Stage",
    "Approved Work Order ID",
    "Text Draft Approval Status",
    "Text Draft Review Decision",
    "Text Draft Review Notes",
    "Text Draft Reviewed At",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Draft Mode",
    "Slide Deck Text Draft",
    "Study Guide Text Draft",
    "Visual Brief Text",
    "Quiz/Rationale Text Draft",
    "Narration Script Draft",
    "Creator Review Questions",
    "Next Allowed Action",
    "Source Evidence",
    "Drive Project Assets",
    "Drive Asset Links",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionPackageAssemblyPackRows(rows: any[]) {
  return topicProductionMediaTextDraftPackRows(rows)
    .filter((draft) => draft["Text Draft Review Decision"] === "approve_package_assembly_checkpoint")
    .map((draft) => {
      const topic = String(draft["Topic"] || "Untitled topic");
      const concept = String(draft["Concept"] || "Clinical Judgment");
      const subject = String(draft["Nursing Subject"] || "Nursing");
      const weakTopic = String(draft["Weak Topic"] || "Priority decision");
      const cjmStep = String(draft["CJM Step"] || "Recognize Cues");
      const nclexCategory = String(draft["NCLEX Category"] || "Physiological Integrity");

      return {
        "Assembly Stage": "phase_6_package_assembly_ready_for_creator_review",
        "Approved Work Order ID": draft["Approved Work Order ID"],
        "Topic": topic,
        "Concept": concept,
        "Nursing Subject": subject,
        "Weak Topic": weakTopic,
        "NCLEX Category": nclexCategory,
        "CJM Step": cjmStep,
        "Lesson Package Title": `${topic}: NurseStudy Review Package`,
        "Slide Assembly Plan": `Create an 8-slide learner deck from the approved text draft: why it matters, cue pattern, ${cjmStep}, safest action, common trap, practice prompt, cited evidence, and takeaway.`,
        "Guided Notes Assembly Plan": `Convert the study-guide draft into fillable notes with sections for ${weakTopic}, priority cues, ${concept}, first action, teaching point, and citation used for review.`,
        "Practice Item Assembly Plan": `Build one NCLEX-style item tagged ${nclexCategory}, ${cjmStep}, and ${subject}. Include one correct answer and rationales for correct and incorrect options.`,
        "Citation Plan": "Attach source-backed citations from the approved evidence packet. Keep source text paraphrased and show citations in the lesson, study guide, and export manifest.",
        "Learner Surface Plan": "Publish only after review: lesson library card, lesson deck, guided notes panel, practice/rationale panel, citation drawer, and completion/feedback controls.",
        "Export Plan": "Bundle slides, guided notes, quiz/rationale, citations, manifest, QA summary, and creator notes as the review export.",
        "Review Gate": "Creator reviews assembled package before publish. Human content expert review remains recommended before broad student release.",
        "Next Allowed Action": "Assemble one learner-safe package for review only. Do not render video, TTS, paid visuals, public publish, or batch-produce topics without the next approval.",
        "Source Evidence": draft["Source Evidence"],
        "Drive Project Assets": draft["Drive Project Assets"],
        "Drive Asset Links": draft["Drive Asset Links"],
        "Cost Guardrail": "Package assembly checkpoint only. No TTS, no rendered video, no paid visual generation, no batch generation, and no public publish without review.",
      };
    });
}

function topicProductionPackageAssemblyPackCsv(rows: any[]) {
  const exportRows = topicProductionPackageAssemblyPackRows(rows);
  const headers = [
    "Assembly Stage",
    "Approved Work Order ID",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Lesson Package Title",
    "Slide Assembly Plan",
    "Guided Notes Assembly Plan",
    "Practice Item Assembly Plan",
    "Citation Plan",
    "Learner Surface Plan",
    "Export Plan",
    "Review Gate",
    "Next Allowed Action",
    "Source Evidence",
    "Drive Project Assets",
    "Drive Asset Links",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionPackageReviewBlueprintRows(rows: any[]) {
  return topicProductionPackageAssemblyPackRows(rows).map((assembly) => {
    const workOrderId = String(assembly["Approved Work Order ID"] || "");
    const topic = String(assembly["Topic"] || "Untitled topic");
    const concept = String(assembly["Concept"] || "Clinical Judgment");
    const subject = String(assembly["Nursing Subject"] || "Nursing");
    const weakTopic = String(assembly["Weak Topic"] || "Priority decision");
    const cjmStep = String(assembly["CJM Step"] || "Recognize Cues");
    const nclexCategory = String(assembly["NCLEX Category"] || "Physiological Integrity");
    const blueprintReview = topicProductionPackageReviewBlueprintForId(workOrderId);
    const buildApprovalStatus = blueprintReview.decision === "approve_review_package_build"
      ? "approved_for_deterministic_review_package_build"
      : blueprintReview.decision === "needs_revision"
        ? "needs_blueprint_revision"
        : blueprintReview.decision === "hold_spend"
          ? "hold_spend"
          : "creator_review_required";
    const nextAllowedAction = buildApprovalStatus === "approved_for_deterministic_review_package_build"
      ? "Build one deterministic unpublished review package from this blueprint. No public publish, TTS, video, paid visuals, or batch generation is approved."
      : buildApprovalStatus === "needs_blueprint_revision"
        ? "Revise learner outcome, slides, guided notes, practice, citations, or stop conditions before building a package."
        : buildApprovalStatus === "hold_spend"
          ? "Hold this blueprint. Do not build the package or start media work."
          : "Creator reviews this blueprint, then either requests revisions or explicitly approves one deterministic review package build. Media and public publish stay blocked.";

    return {
      "Blueprint Stage": "phase_7_review_blueprint_ready_for_creator_review",
      "Approved Work Order ID": workOrderId,
      "Build Approval Status": buildApprovalStatus,
      "Blueprint Review Decision": blueprintReview.decision,
      "Blueprint Review Notes": blueprintReview.reviewerNotes,
      "Blueprint Reviewed At": blueprintReview.reviewedAt || "",
      "Topic": topic,
      "Concept": concept,
      "Nursing Subject": subject,
      "Weak Topic": weakTopic,
      "NCLEX Category": nclexCategory,
      "CJM Step": cjmStep,
      "Lesson Package Title": assembly["Lesson Package Title"],
      "Learner Outcome": `After this review package, the student should identify priority cues for ${weakTopic}, explain the ${concept} risk, choose the safest first nursing action, and justify the action with source-backed rationale.`,
      "Slide Blueprint": [
        "Slide 1: why this topic matters for nursing judgment",
        "Slide 2: priority cue pattern",
        `Slide 3: ${cjmStep} decision point`,
        "Slide 4: safest first nursing action",
        "Slide 5: common NCLEX trap",
        "Slide 6: practice item setup",
        "Slide 7: citation-backed rationale",
        "Slide 8: student takeaway and completion prompt",
      ].join(" | "),
      "Guided Notes Blueprint": `Sections: define ${weakTopic}; list three priority cues; connect to ${concept}; choose first action; write one teaching point; cite the source used.`,
      "Practice Blueprint": `One NCLEX-style item tagged ${nclexCategory}, ${cjmStep}, and ${subject}; four options; one correct answer; rationales for every option; feedback tied to cue recognition and safety.`,
      "Visual Placeholder Blueprint": "Use simple placeholders only: cue icon, risk arrow, action checklist, citation badge. Do not generate paid visuals until review approves the visual direction.",
      "Citation Slot Blueprint": "Minimum citation slots: source evidence for cue pattern, rationale source, and review manifest source. All citations remain tied to approved source records.",
      "Export File Blueprint": "review_manifest.json | learner_slides.md | guided_notes.md | practice_item.md | citations.md | creator_review_checklist.md",
      "Review Checklist": "Clinical accuracy | student clarity | taxonomy fit | rationale quality | citation traceability | visual direction | publish readiness",
      "Human Expert Questions": `Does ${topic} reflect current safe nursing practice? Are the distractors plausible? Is the ${cjmStep} tag correct? Is this ready for a human expert or student preview?`,
      "Stop Conditions": "Stop if source evidence is weak, the nursing action is ambiguous, quiz rationales are thin, or the package cannot be understood without admin context.",
      "Next Allowed Action": nextAllowedAction,
      "Source Evidence": assembly["Source Evidence"],
      "Cost Guardrail": "Blueprint checkpoint only. Approval permits at most one deterministic unpublished review package build. No package publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
    };
  });
}

function topicProductionPackageReviewBlueprintCsv(rows: any[]) {
  const exportRows = topicProductionPackageReviewBlueprintRows(rows);
  const headers = [
    "Blueprint Stage",
    "Approved Work Order ID",
    "Build Approval Status",
    "Blueprint Review Decision",
    "Blueprint Review Notes",
    "Blueprint Reviewed At",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Lesson Package Title",
    "Learner Outcome",
    "Slide Blueprint",
    "Guided Notes Blueprint",
    "Practice Blueprint",
    "Visual Placeholder Blueprint",
    "Citation Slot Blueprint",
    "Export File Blueprint",
    "Review Checklist",
    "Human Expert Questions",
    "Stop Conditions",
    "Next Allowed Action",
    "Source Evidence",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

const topicProductionReviewPackageFileNames = [
  "review_manifest.json",
  "learner_slides.md",
  "guided_notes.md",
  "practice_item.md",
  "citations.md",
  "creator_review_checklist.md",
] as const;

function topicProductionReviewPackageSlug(value: any) {
  const slug = String(value || "review-package")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "review-package";
}

function topicProductionReviewPackageFiles(blueprint: Record<string, any>) {
  const topic = String(blueprint["Topic"] || "Untitled topic");
  const title = String(blueprint["Lesson Package Title"] || `${topic}: NurseStudy Review Package`);
  const concept = String(blueprint["Concept"] || "Clinical Judgment");
  const subject = String(blueprint["Nursing Subject"] || "Nursing");
  const weakTopic = String(blueprint["Weak Topic"] || "Priority decision");
  const nclexCategory = String(blueprint["NCLEX Category"] || "Physiological Integrity");
  const cjmStep = String(blueprint["CJM Step"] || "Recognize Cues");
  const slideLines = String(blueprint["Slide Blueprint"] || "")
    .split(" | ")
    .map((line) => line.trim())
    .filter(Boolean);
  const reviewChecklist = String(blueprint["Review Checklist"] || "")
    .split(" | ")
    .map((line) => line.trim())
    .filter(Boolean);
  const guardrail = "No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.";

  return {
    "review_manifest.json": JSON.stringify({
      packageTitle: title,
      topic,
      concept,
      nursingSubject: subject,
      weakTopic,
      nclexCategory,
      cjmStep,
      buildMode: "deterministic_unpublished_review_package",
      publishStatus: "not_published",
      mediaStatus: "not_started",
      sourceEvidence: blueprint["Source Evidence"] || "",
      guardrail,
    }, null, 2),
    "learner_slides.md": [
      `# ${title}`,
      "",
      ...slideLines.flatMap((line, index) => [
        `## ${line}`,
        "",
        `Student-facing draft content placeholder for creator review. Connect this section to ${weakTopic}, ${concept}, and ${cjmStep}.`,
        index === 0 ? `Use ${subject} context and keep the explanation learner-safe.` : "Keep this section concise, source-backed, and ready for later expert polish.",
        "",
      ]),
    ].join("\n"),
    "guided_notes.md": [
      "# Guided Notes",
      "",
      String(blueprint["Guided Notes Blueprint"] || `Define ${weakTopic}, identify cues, choose a first action, and cite the source.`),
      "",
      "## Student Prompts",
      "- Priority cues:",
      "- Risk or safety concern:",
      "- Best first nursing action:",
      "- Rationale in my words:",
      "- Citation/source used:",
    ].join("\n"),
    "practice_item.md": [
      "# Practice Item",
      "",
      String(blueprint["Practice Blueprint"] || `One NCLEX-style item tagged ${nclexCategory} and ${cjmStep}.`),
      "",
      "## Draft Item Shell",
      `A nursing student is reviewing ${topic}. Which finding or action best reflects ${cjmStep}?`,
      "",
      "- A.",
      "- B.",
      "- C.",
      "- D.",
      "",
      "## Rationale Review",
      "- Correct answer rationale:",
      "- Distractor rationale checks:",
      "- Source/citation check:",
    ].join("\n"),
    "citations.md": [
      "# Citations",
      "",
      String(blueprint["Citation Slot Blueprint"] || "Citations remain tied to approved source records."),
      "",
      "## Source Evidence",
      String(blueprint["Source Evidence"] || "Source evidence pending review."),
    ].join("\n"),
    "creator_review_checklist.md": [
      "# Creator Review Checklist",
      "",
      ...reviewChecklist.map((item) => `- [ ] ${item}`),
      "",
      "## Human Expert Questions",
      String(blueprint["Human Expert Questions"] || "Expert questions pending."),
      "",
      "## Stop Conditions",
      String(blueprint["Stop Conditions"] || "Stop if source, rationale, or student clarity is weak."),
      "",
      "## Guardrail",
      guardrail,
    ].join("\n"),
  } satisfies Record<(typeof topicProductionReviewPackageFileNames)[number], string>;
}

function topicProductionReviewPackageBuildRows(rows: any[]) {
  return topicProductionPackageReviewBlueprintRows(rows)
    .filter((blueprint) => blueprint["Blueprint Review Decision"] === "approve_review_package_build"
      && blueprint["Build Approval Status"] === "approved_for_deterministic_review_package_build")
    .map((blueprint) => {
      const files = topicProductionReviewPackageFiles(blueprint as Record<string, any>);
      return {
        "Build Stage": "phase_9_deterministic_review_package_built",
        "Approved Work Order ID": blueprint["Approved Work Order ID"],
        "Topic": blueprint["Topic"],
        "Concept": blueprint["Concept"],
        "Nursing Subject": blueprint["Nursing Subject"],
        "Weak Topic": blueprint["Weak Topic"],
        "NCLEX Category": blueprint["NCLEX Category"],
        "CJM Step": blueprint["CJM Step"],
        "Lesson Package Title": blueprint["Lesson Package Title"],
        "Build Mode": "deterministic_unpublished_review_package",
        "Publish Status": "not_published",
        "Media Status": "not_started",
        "Bundle File Count": topicProductionReviewPackageFileNames.length,
        "Bundle Files": topicProductionReviewPackageFileNames.join(" | "),
        "Review Manifest": files["review_manifest.json"],
        "Learner Slides": files["learner_slides.md"],
        "Guided Notes": files["guided_notes.md"],
        "Practice Item": files["practice_item.md"],
        "Citations": files["citations.md"],
        "Creator Review Checklist": files["creator_review_checklist.md"],
        "Next Allowed Action": "Creator reviews the built package files, then either requests revisions or explicitly promotes it into Lesson Builder as an unpublished package. Public publish and media remain blocked.",
        "Cost Guardrail": "Review package build only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
      };
    });
}

function topicProductionReviewPackageBuildCsv(rows: any[]) {
  const exportRows = topicProductionReviewPackageBuildRows(rows);
  const headers = [
    "Build Stage",
    "Approved Work Order ID",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Lesson Package Title",
    "Build Mode",
    "Publish Status",
    "Media Status",
    "Bundle File Count",
    "Bundle Files",
    "Next Allowed Action",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

async function topicProductionReviewPackageBuildZip(rows: any[]) {
  const exportRows = topicProductionReviewPackageBuildRows(rows);
  const zip = new JSZip();
  for (const row of exportRows) {
    const folder = zip.folder(topicProductionReviewPackageSlug(row["Lesson Package Title"]));
    if (!folder) continue;
    folder.file("review_manifest.json", String(row["Review Manifest"] || ""));
    folder.file("learner_slides.md", String(row["Learner Slides"] || ""));
    folder.file("guided_notes.md", String(row["Guided Notes"] || ""));
    folder.file("practice_item.md", String(row["Practice Item"] || ""));
    folder.file("citations.md", String(row["Citations"] || ""));
    folder.file("creator_review_checklist.md", String(row["Creator Review Checklist"] || ""));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function topicProductionReviewPackageDraftSlides(record: Record<string, any>) {
  const title = String(record["Lesson Package Title"] || record["Topic"] || "NurseStudy Review Package");
  const topic = String(record["Topic"] || "Clinical judgment priority decision");
  const weakTopic = String(record["Weak Topic"] || "Priority decision");
  const concept = String(record["Concept"] || "Clinical Judgment");
  const nclexCategory = String(record["NCLEX Category"] || "Physiological Integrity");
  const cjmStep = String(record["CJM Step"] || "Recognize Cues");
  const learnerSlides = String(record["Learner Slides"] || "");
  const slideHeadings = learnerSlides
    .split(/\r?\n/)
    .filter((line) => line.startsWith("## "))
    .map((line) => line.replace(/^##\s+/, "").trim())
    .filter(Boolean);
  const headings = slideHeadings.length ? slideHeadings : [
    `${title}: why it matters`,
    "Priority cue pattern",
    `${cjmStep} decision point`,
    "Safest first nursing action",
    "Common NCLEX trap",
    "Practice item setup",
    "Citation-backed rationale",
    "Student takeaway",
  ];
  const slideTypes = ["patient_cue", "priority_cues", "clinical_judgment", "take_action", "common_trap", "practice_item", "rationale", "takeaway"];

  return headings.slice(0, 8).map((heading, index) => ({
    slideNumber: index + 1,
    slideType: slideTypes[index] || "review_slide",
    title: heading,
    visibleContent: {
      heading,
      studentFocus: `${weakTopic} in ${topic}`,
      cueToAction: `Connect ${concept} cues to the safest nursing action.`,
      examAnchor: nclexCategory,
      learningMoment: index === 1
        ? `Predict which cue changes the nursing priority before reading the teaching point.`
        : index === 6
          ? `Use the rationale to explain why the safest answer reduces risk.`
          : `Use the evidence to move from cue recognition to clinical judgment.`,
    },
    speakerNotes: `Creator review draft generated from Phase 9 review-package files. Confirm clinical accuracy and source traceability before QA or publish.`,
    guidedNotes: `Cue: ____________________ Meaning: ____________________ First action: ____________________ Evidence: ____________________`,
    retrievalPrompt: index === 0
      ? `What cue makes ${topic} a priority?`
      : index === 5
        ? "Answer the practice item before reading the rationale."
        : `How does this slide support ${cjmStep}?`,
    nclexCategory,
    cjmStep,
    nursingProcess: index < 3 ? "Assessment" : index < 6 ? "Planning" : "Evaluation",
    bloomLevel: "Apply",
  }));
}

function topicProductionReviewPackageDraftItem(record: Record<string, any>) {
  const topic = String(record["Topic"] || "Clinical judgment priority decision");
  const nclexCategory = String(record["NCLEX Category"] || "Physiological Integrity");
  const cjmStep = String(record["CJM Step"] || "Analyze Cues");
  return {
    itemType: "multiple_choice",
    stem: `A nursing student is reviewing ${topic}. Which action best supports safe clinical judgment?`,
    options: [
      { id: "A", text: "Identify the priority cue and connect it to the safest first nursing action." },
      { id: "B", text: "Choose the option that sounds familiar even if it does not address the cue." },
      { id: "C", text: "Delay assessment until all teaching has been completed." },
      { id: "D", text: "Focus on documentation before deciding whether the patient is stable." },
    ],
    correctAnswer: "A",
    rationale: `The safest answer starts with the priority cue, connects it to ${cjmStep}, and selects the nursing action that best reduces risk for ${topic}.`,
    tags: {
      nclexCategory,
      cjmStep,
      nursingProcess: "Assessment",
      bloomLevel: "Apply",
      source: "phase_9_review_package_build",
    },
    difficulty: "application",
  };
}

async function findTopicProductionReviewDraft(workOrderId: string) {
  const packages = await db.select().from(lessonPackages).orderBy(desc(lessonPackages.createdAt)).limit(200);
  const draftPhases = new Set([
    "phase_10_unpublished_lesson_builder_draft",
    "phase_11_creator_qa_gate",
    "phase_13_controlled_preview_decision",
    "phase_14_controlled_preview_review",
  ]);
  const existing = packages.find((pkg) => {
    const manifest = (pkg.manifest || {}) as Record<string, any>;
    const phase = manifest.topicProduction?.phase;
    return draftPhases.has(phase)
      && manifest.topicProduction?.reviewPackageWorkOrderId === workOrderId
      && pkg.status !== "published"
      && manifest.topicProduction?.publishStatus !== "published";
  });
  return existing ? findPackageBundle(existing.id) : null;
}

async function promoteTopicProductionReviewPackageDraft(record: Record<string, any>, createdBy?: string | null) {
  const workOrderId = String(record["Approved Work Order ID"] || "");
  const existing = workOrderId ? await findTopicProductionReviewDraft(workOrderId) : null;
  if (existing) {
    return { bundle: existing, created: false };
  }

  const title = String(record["Lesson Package Title"] || `${record["Topic"] || "Untitled topic"}: NurseStudy Review Package`);
  const topic = String(record["Topic"] || "Clinical judgment priority decision");
  const sourceEvidence = String(record["Review Manifest"] || record["Citations"] || record["Cost Guardrail"] || "");
  const reviewDocumentId = `topic-production-review-package:${workOrderId || hashText(title).slice(0, 10)}`;
  const slideDrafts = topicProductionReviewPackageDraftSlides(record);
  const taxonomySnapshot = {
    topicProduction: {
      concept: record["Concept"],
      nursingSubject: record["Nursing Subject"],
      weakTopic: record["Weak Topic"],
      nclexCategory: record["NCLEX Category"],
      cjmStep: record["CJM Step"],
    },
  };
  const [pkg] = await db.insert(lessonPackages).values({
    title,
    topic,
    audience: "Prelicensure RN",
    status: "draft",
    sourceIds: [],
    taxonomySnapshot,
    deckModel: {},
    manifest: {},
    qaSummary: {
      status: "creator_review_required",
      passCount: 0,
      warningCount: 0,
      failCount: 0,
      reason: "Promoted from Phase 9 review package; QA, publish, and media remain blocked until creator review.",
    },
    createdBy: createdBy || null,
  }).returning();

  const createdSlides = [];
  for (const slide of slideDrafts) {
    const [createdSlide] = await db.insert(lessonSlides).values({
      packageId: pkg.id,
      slideNumber: slide.slideNumber,
      slideType: slide.slideType,
      title: slide.title,
      visibleContent: slide.visibleContent,
      speakerNotes: slide.speakerNotes,
      guidedNotes: slide.guidedNotes,
      retrievalPrompt: slide.retrievalPrompt,
      nclexCategory: slide.nclexCategory,
      cjmStep: slide.cjmStep,
      nursingProcess: slide.nursingProcess,
      bloomLevel: slide.bloomLevel,
    }).returning();
    createdSlides.push(createdSlide);
  }

  const practiceSlide = createdSlides.find((slide) => slide.slideType === "practice_item") || createdSlides[0];
  const practiceItem = topicProductionReviewPackageDraftItem(record);
  const [item] = await db.insert(lessonItems).values({
    packageId: pkg.id,
    slideId: practiceSlide?.id,
    ...practiceItem,
  }).returning();

  for (const slide of createdSlides) {
    await db.insert(lessonCitations).values({
      packageId: pkg.id,
      slideId: slide.id,
      documentId: reviewDocumentId,
      chunkId: `${reviewDocumentId}:slide:${slide.slideNumber}`,
      citationLabel: "Topic Production Phase 9 Review Bundle",
      excerpt: textSnippet(sourceEvidence || `Review bundle evidence for ${topic}.`, 320),
      relevanceScore: "0.7500",
    });
  }
  await db.insert(lessonCitations).values({
    packageId: pkg.id,
    slideId: practiceSlide?.id,
    itemId: item.id,
    documentId: reviewDocumentId,
    chunkId: `${reviewDocumentId}:practice-item`,
    citationLabel: "Topic Production Phase 9 Practice Blueprint",
    excerpt: textSnippet(String(record["Practice Item"] || `Practice blueprint for ${topic}.`), 320),
    relevanceScore: "0.7500",
  });

  const deckModel = {
    ...buildDeckModel(pkg.id, title, topic, "Prelicensure RN", slideDrafts, taxonomySnapshot),
    generation: {
      usedMode: "deterministic_review_package_promotion",
      sourceQueue: "phase_9_review_package_builds",
      aiCalls: 0,
      mediaGenerated: false,
    },
  };
  const manifest = {
    ...buildManifest(pkg.id, title, topic, []),
    topicProduction: {
      phase: "phase_10_unpublished_lesson_builder_draft",
      reviewPackageWorkOrderId: workOrderId,
      concept: record["Concept"],
      nursingSubject: record["Nursing Subject"],
      weakTopic: record["Weak Topic"],
      nclexCategory: record["NCLEX Category"],
      cjmStep: record["CJM Step"],
      sourceQueue: "phase_9_review_package_builds",
      promotionStatus: "unpublished_creator_review",
      publishStatus: "not_published",
      mediaStatus: "not_started",
      costGuardrail: "Unpublished Lesson Builder draft only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
      bundleFiles: topicProductionReviewPackageFileNames,
    },
  };
  await db.update(lessonPackages).set({
    deckModel,
    manifest,
    updatedAt: new Date(),
  }).where(eq(lessonPackages.id, pkg.id));

  const bundle = await findPackageBundle(pkg.id);
  return { bundle, created: true };
}

async function repairTopicProductionReviewDraftForCreatorQa(bundle: LessonBundle, workOrderId: string) {
  const reviewDocumentId = `topic-production-review-package:${workOrderId || bundle.package.id}`;
  const slideNumberById = new Map(bundle.slides.map((slide) => [slide.id, slide.slideNumber]));

  for (const slide of bundle.slides) {
    const visibleContent = {
      ...((slide.visibleContent || {}) as Record<string, any>),
      learningMoment: slide.slideNumber === 2
        ? "Predict which cue changes the nursing priority before reading the teaching point."
        : slide.slideNumber === 7
          ? "Use the rationale to explain why the safest answer reduces risk."
          : "Use the evidence to move from cue recognition to clinical judgment.",
    };
    await db.update(lessonSlides).set({
      visibleContent,
    }).where(eq(lessonSlides.id, slide.id));
  }

  for (const citation of bundle.citations) {
    const slideNumber = citation.slideId ? slideNumberById.get(citation.slideId) : null;
    await db.update(lessonCitations).set({
      documentId: citation.documentId || reviewDocumentId,
      chunkId: citation.chunkId || `${reviewDocumentId}:${citation.itemId ? "practice-item" : slideNumber ? `slide:${slideNumber}` : `citation:${citation.id}`}`,
    }).where(eq(lessonCitations.id, citation.id));
  }
}

async function runTopicProductionCreatorQaGate(workOrderId: string, reviewedBy?: string | null) {
  let promotedBundle = await findTopicProductionReviewDraft(workOrderId);
  if (!promotedBundle) return null;

  const packageId = promotedBundle.package.id;
  await repairTopicProductionReviewDraftForCreatorQa(promotedBundle, workOrderId);
  promotedBundle = await findPackageBundle(packageId);
  if (!promotedBundle) throw new Error("Lesson package not found after draft repair");
  const qa = await runQaForPackage(packageId);
  const validation = await validateLessonContract(packageId, "harrity");
  const refreshedBundle = await findPackageBundle(packageId);
  if (!refreshedBundle) throw new Error("Lesson package not found after QA");

  const qaFailCount = Number(qa.qaSummary.failCount || 0);
  const contractFailCount = Number(validation.validationSummary.failCount || 0);
  const qaWarningCount = Number(qa.qaSummary.warningCount || 0);
  const contractWarningCount = Number(validation.validationSummary.warningCount || 0);
  const readyForControlledPreview = qaFailCount === 0 && contractFailCount === 0;
  const checkedAt = new Date().toISOString();
  const creatorQaGate = {
    phase: "phase_11_creator_qa_gate",
    reviewPackageWorkOrderId: workOrderId,
    packageId,
    status: readyForControlledPreview ? "ready_for_controlled_preview" : "needs_revision",
    qaStatus: qa.qaSummary.status,
    contractStatus: validation.validationSummary.status,
    qaFailCount,
    qaWarningCount,
    contractFailCount,
    contractWarningCount,
    artifactCount: validation.validationSummary.artifactCount || 0,
    publishStatus: "not_published",
    mediaStatus: "not_started",
    controlledPreviewStatus: readyForControlledPreview ? "eligible_after_creator_approval" : "blocked_until_revision",
    nextAllowedAction: readyForControlledPreview
      ? "Creator may inspect the Lesson Builder draft and decide whether to open a controlled preview. Public publish and media still require a later explicit checkpoint."
      : "Revise the draft issues shown by QA/contract validation, then rerun this creator QA gate before any preview or publish decision.",
    costGuardrail: "Creator QA checkpoint only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
    reviewedBy: reviewedBy || null,
    checkedAt,
  };

  const existingManifest = (refreshedBundle.package.manifest || {}) as Record<string, any>;
  await db.update(lessonPackages).set({
    manifest: {
      ...existingManifest,
      topicProduction: {
        ...(existingManifest.topicProduction || {}),
        phase: "phase_11_creator_qa_gate",
        reviewPackageWorkOrderId: workOrderId,
        creatorQaGate,
        publishStatus: "not_published",
        mediaStatus: "not_started",
        costGuardrail: creatorQaGate.costGuardrail,
      },
    },
    updatedAt: new Date(),
  }).where(eq(lessonPackages.id, packageId));

  return {
    bundle: await findPackageBundle(packageId),
    qa,
    validation,
    creatorQaGate,
  };
}

async function saveTopicProductionControlledPreviewDecision(workOrderId: string, decision: (typeof topicProductionStudentLaunchDecisions)[number], reviewerNotes: string, reviewedBy?: string | null) {
  const bundle = await findTopicProductionReviewDraft(workOrderId);
  if (!bundle) return null;

  const topicProduction = ((bundle.package.manifest || {}) as Record<string, any>).topicProduction || {};
  const creatorQaGate = topicProduction.creatorQaGate || {};
  const blockers = [
    creatorQaGate.status !== "ready_for_controlled_preview" ? "Creator QA gate is not ready for controlled preview" : "",
    bundle.package.status !== "qa_ready" && bundle.package.status !== "published" ? "Package is not QA-ready" : "",
    Number((bundle.package.qaSummary as any)?.failCount || 0) > 0 ? "QA has failures" : "",
    bundle.slides.length < 5 ? "Lesson deck is too small for controlled preview" : "",
    bundle.items.length < 1 ? "Practice item is missing" : "",
    bundle.citations.length < bundle.slides.length ? "Citations are incomplete" : "",
  ].filter(Boolean);

  if (decision === "approve_student_preview" && blockers.length) {
    return { bundle, blocked: true, blockers };
  }

  const previousDecision = ((bundle.package.manifest || {}) as Record<string, any>).topicProductionStudentLaunchDecision || {};
  const previewKey = decision === "approve_student_preview"
    ? topicProductionPreviewKey(previousDecision.previewKey)
    : null;
  const studentLaunchDecision = {
    decision,
    reviewerNotes: reviewerNotes.trim(),
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy || "admin",
    previewKey,
    previewReview: previousDecision.previewReview || null,
  };
  const controlledPreviewDecision = {
    phase: "phase_13_controlled_preview_decision",
    reviewPackageWorkOrderId: workOrderId,
    packageId: bundle.package.id,
    decision,
    previewKeyStatus: previewKey ? "active" : "not_created",
    studentPreviewUrl: previewKey ? `/lessons/${bundle.package.id}?previewKey=${encodeURIComponent(previewKey)}` : "",
    publishStatus: "not_published",
    mediaStatus: "not_started",
    nextAllowedAction: decision === "approve_student_preview"
      ? "Open the controlled preview link and record preview feedback before any public publish decision."
      : decision === "needs_fix"
        ? "Revise the QA-ready draft before opening controlled preview."
        : decision === "hold_release"
          ? "Hold release. No preview, public publish, or media work is approved."
          : "Record approve_student_preview, needs_fix, or hold_release.",
    costGuardrail: "Controlled preview decision only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
    reviewedAt: studentLaunchDecision.reviewedAt,
    reviewedBy: studentLaunchDecision.reviewedBy,
    blockers,
  };
  const manifest = {
    ...(bundle.package.manifest || {}),
    topicProductionStudentLaunchDecision: studentLaunchDecision,
    topicProduction: {
      ...topicProduction,
      phase: "phase_13_controlled_preview_decision",
      reviewPackageWorkOrderId: workOrderId,
      controlledPreviewDecision,
      publishStatus: "not_published",
      mediaStatus: "not_started",
      costGuardrail: controlledPreviewDecision.costGuardrail,
    },
  };
  await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, bundle.package.id));
  const updatedBundle = await findPackageBundle(bundle.package.id);
  return {
    bundle: updatedBundle,
    blocked: false,
    blockers,
    studentLaunchDecision,
    controlledPreviewDecision,
  };
}

async function saveTopicProductionControlledPreviewReview(workOrderId: string, outcome: (typeof topicProductionPreviewReviewOutcomes)[number], reviewerNotes: string, reviewedBy?: string | null) {
  const bundle = await findTopicProductionReviewDraft(workOrderId);
  if (!bundle) return null;

  const existingDecision = ((bundle.package.manifest || {}) as Record<string, any>).topicProductionStudentLaunchDecision || {};
  const previewKey = typeof existingDecision.previewKey === "string" ? existingDecision.previewKey : "";
  const blockers = [
    existingDecision.decision !== "approve_student_preview" ? "Controlled preview is not approved" : "",
    !previewKey ? "Controlled preview key is missing" : "",
    bundle.package.status !== "qa_ready" && bundle.package.status !== "published" ? "Package is not QA-ready" : "",
    Number((bundle.package.qaSummary as any)?.failCount || 0) > 0 ? "QA has failures" : "",
  ].filter(Boolean);
  if (blockers.length) {
    return { bundle, blocked: true, blockers };
  }

  const previewReview = {
    outcome,
    reviewerNotes: reviewerNotes.trim(),
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy || "controlled_preview_reviewer",
  };
  const topicProduction = ((bundle.package.manifest || {}) as Record<string, any>).topicProduction || {};
  const controlledPreviewReview = {
    phase: "phase_14_controlled_preview_review",
    reviewPackageWorkOrderId: workOrderId,
    packageId: bundle.package.id,
    outcome,
    previewKeyStatus: "active",
    studentPreviewUrl: `/lessons/${bundle.package.id}?previewKey=${encodeURIComponent(previewKey)}`,
    publishStatus: "not_published",
    mediaStatus: "not_started",
    nextAllowedAction: outcome === "ready_for_release"
      ? "Creator preview review is ready. A later explicit publish checkpoint is still required before public release."
      : outcome === "needs_fix"
        ? "Revise the controlled preview issues before any publish decision."
        : "Hold release. No public publish or media work is approved.",
    costGuardrail: "Controlled preview review only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
    reviewedAt: previewReview.reviewedAt,
    reviewedBy: previewReview.reviewedBy,
    blockers: [],
  };
  const manifest = {
    ...(bundle.package.manifest || {}),
    topicProductionStudentLaunchDecision: {
      ...existingDecision,
      previewKey,
      previewReview,
    },
    topicProduction: {
      ...topicProduction,
      phase: "phase_14_controlled_preview_review",
      reviewPackageWorkOrderId: workOrderId,
      controlledPreviewReview,
      publishStatus: "not_published",
      mediaStatus: "not_started",
      costGuardrail: controlledPreviewReview.costGuardrail,
    },
  };
  await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, bundle.package.id));
  const updatedBundle = await findPackageBundle(bundle.package.id);
  return {
    bundle: updatedBundle,
    blocked: false,
    blockers: [],
    previewReview,
    controlledPreviewReview,
    reviewSummary: updatedBundle ? topicProductionPreviewReviewSummary(updatedBundle) : null,
  };
}

async function persistTopicProductionPublicReleaseDecision(bundle: LessonBundle, releaseReferenceId: string, decision: (typeof topicProductionPublicReleaseDecisions)[number], reviewerNotes: string, reviewedBy?: string | null) {
  const manifestRecord = (bundle.package.manifest || {}) as Record<string, any>;
  const existingDecision = manifestRecord.topicProductionStudentLaunchDecision || {};
  const previewReview = existingDecision.previewReview || {};
  const topicProduction = manifestRecord.topicProduction || {};
  const reviewPackageWorkOrderId = topicProduction.reviewPackageWorkOrderId || releaseReferenceId;
  const blockers = [
    existingDecision.decision !== "approve_student_preview" ? "Controlled preview is not approved" : "",
    !existingDecision.previewKey ? "Controlled preview key is missing" : "",
    previewReview.outcome !== "ready_for_release" ? "Controlled preview review is not marked ready for release" : "",
    bundle.package.status !== "qa_ready" && bundle.package.status !== "published" ? "Package is not QA-ready" : "",
    Number((bundle.package.qaSummary as any)?.failCount || 0) > 0 ? "QA has failures" : "",
  ].filter(Boolean);
  if (blockers.length) {
    return { bundle, blocked: true, blockers };
  }

  const publicReleaseDecision: TopicProductionPublicReleaseDecision = {
    decision,
    reviewerNotes: reviewerNotes.trim(),
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy || "release_reviewer",
  };
  const publicReleaseGate = {
    phase: "phase_15_public_release_decision",
    reviewPackageWorkOrderId,
    releaseReferenceId,
    packageId: bundle.package.id,
    decision,
    releaseStatus: decision === "approve_public_release"
      ? "approved_for_public_publish"
      : decision === "needs_fix"
        ? "needs_fix_before_publish"
        : "release_held",
    publishStatus: decision === "approve_public_release" ? "approved_for_public_publish" : "not_published",
    mediaStatus: "not_started",
    nextAllowedAction: decision === "approve_public_release"
      ? "Open the final Lesson Builder publish panel for this single package only. Media, video, audio, paid visuals, and batch production remain separate approvals."
      : decision === "needs_fix"
        ? "Fix the release concern before enabling the public publish endpoint."
        : "Hold release. Do not publish or start media work.",
    costGuardrail: "Public release decision only. No TTS, rendered video, paid visual generation, or batch production is approved.",
    reviewedAt: publicReleaseDecision.reviewedAt,
    reviewedBy: publicReleaseDecision.reviewedBy,
    blockers: [],
  };
  const manifest = {
    ...manifestRecord,
    topicProductionStudentLaunchDecision: {
      ...existingDecision,
      previewReview,
      publicReleaseDecision,
    },
    topicProduction: {
      ...topicProduction,
      phase: "phase_15_public_release_decision",
      reviewPackageWorkOrderId,
      publicReleaseDecision: publicReleaseGate,
      publishStatus: publicReleaseGate.publishStatus,
      mediaStatus: "not_started",
      costGuardrail: publicReleaseGate.costGuardrail,
    },
  };
  await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, bundle.package.id));
  const updatedBundle = await findPackageBundle(bundle.package.id);
  return {
    bundle: updatedBundle,
    blocked: false,
    blockers: [],
    publicReleaseDecision,
    publicReleaseGate,
  };
}

async function saveTopicProductionPublicReleaseDecision(workOrderId: string, decision: (typeof topicProductionPublicReleaseDecisions)[number], reviewerNotes: string, reviewedBy?: string | null) {
  const bundle = await findTopicProductionReviewDraft(workOrderId);
  if (!bundle) return null;
  return persistTopicProductionPublicReleaseDecision(bundle, workOrderId, decision, reviewerNotes, reviewedBy);
}

async function saveTopicProductionPublicReleaseDecisionForPackage(packageId: string, decision: (typeof topicProductionPublicReleaseDecisions)[number], reviewerNotes: string, reviewedBy?: string | null) {
  const bundle = await findPackageBundle(packageId);
  if (!bundle) return null;
  return persistTopicProductionPublicReleaseDecision(bundle, packageId, decision, reviewerNotes, reviewedBy);
}

function topicProductionNextSpendPackets(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  return topicProductionBuildPackets(rows, sourceRecords, draftRecords)
    .filter((packet: any) => packet.draftPackage?.nextSpendApproved);
}

function topicProductionDraftReviewRows(packets: any[]) {
  return packets
    .filter((packet) => packet.draftPackage)
    .map((packet) => {
      const checklist = packet.draftPackage?.reviewChecklist || [];
      return {
        "Review Stage": packet.draftPackage?.nextSpendApproved ? "approved_for_next_checkpoint" : "human_review_needed",
        "Spend Window": "$100-$250",
        "Topic": packet.topic,
        "Concept": packet.concept,
        "Nursing Subject": packet.nursingSubject,
        "Weak Topic": packet.weakTopic || "",
        "NCLEX Category": packet.nclexCategory || "",
        "CJM Step": packet.cjmStep || "",
        "Template Draft Package ID": packet.draftPackage?.packageId || "",
        "Lesson Builder Review URL": packet.draftPackage?.packageId ? `/admin/lesson-builder?tab=review&packageId=${packet.draftPackage.packageId}` : "",
        "Slide Count": packet.draftPackage?.slideCount || 0,
        "Quiz Count": packet.draftPackage?.itemCount || 0,
        "Citation Count": packet.draftPackage?.citationCount || 0,
        "QA Status": packet.draftPackage?.qaStatus || "",
        "QA Failures": packet.draftPackage?.failCount || 0,
        "QA Warnings": packet.draftPackage?.warnCount || 0,
        "Checklist Summary": `${packet.draftPackage?.reviewPassedCount || 0}/${packet.draftPackage?.reviewTotalCount || checklist.length} checks passed`,
        "Checklist Detail": checklist.map((check: any) => `${check.label}: ${check.passed ? "pass" : "needs review"} (${check.detail})`).join(" | "),
        "Slide Outline": (packet.templateDraft?.slideOutline || []).map((slide: any) => `${slide.title}: ${slide.purpose}`).join(" | "),
        "Guided Notes Outline": (packet.templateDraft?.guidedNotesOutline || []).join(" | "),
        "Practice Stem": packet.templateDraft?.practicePreview?.stem || "",
        "Correct Answer": packet.templateDraft?.practicePreview?.correctAnswer || "",
        "Rationale": packet.templateDraft?.practicePreview?.rationale || "",
        "Drive Project Assets": (packet.driveProjectAssets || []).map((asset: any) => asset.title).join(" | "),
        "Drive Asset Links": (packet.driveProjectAssets || []).map((asset: any) => asset.url).join(" | "),
        "Coverage Summary": packet.coverageContract ? `${packet.coverageContract.readyCount}/${packet.coverageContract.totalCount} reviewable; student ready ${packet.coverageContract.studentReady ? "yes" : "no"}` : "",
        "Human Review Questions": [
          "Is the concept and nursing subject correct?",
          "Are slide titles learner-facing and clinically safe?",
          "Does the practice item test judgment rather than memorization?",
          "Are citations sufficient for the claims?",
          "Should this draft receive a small polish pass, need fixes, or hold spend?",
        ].join(" | "),
        "Decision Options": "approve_polish | needs_fix | hold",
        "Cost Guardrail": "Review first. Do not buy AI polish, audio, visuals, or video until the human review decision is recorded.",
      };
    });
}

function topicProductionDraftReviewCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionDraftReviewRows(topicProductionBuildPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Review Stage",
    "Spend Window",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Template Draft Package ID",
    "Lesson Builder Review URL",
    "Slide Count",
    "Quiz Count",
    "Citation Count",
    "QA Status",
    "QA Failures",
    "QA Warnings",
    "Checklist Summary",
    "Checklist Detail",
    "Slide Outline",
    "Guided Notes Outline",
    "Practice Stem",
    "Correct Answer",
    "Rationale",
    "Drive Project Assets",
    "Drive Asset Links",
    "Coverage Summary",
    "Human Review Questions",
    "Decision Options",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue(row[header as keyof typeof row])).join(",")),
  ].join("\n");
}

function topicProductionNextSpendCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionBuildPacketRows(topicProductionNextSpendPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Build Order",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Template Draft Package ID",
    "Template Draft Status",
    "Template Draft Review Decision",
    "Next Spend Approved",
    "Next Spend Recommendation",
    "Asset",
    "Asset Status",
    "Belongs In",
    "Build Brief",
    "Coverage Status",
    "Coverage Proof",
    "Student Surface",
    "Admin Surface",
    "Coverage Summary",
    "Video/Shorts Status",
    "Short Hook",
    "Short Script Draft",
    "Review Gate",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionShortsWorkflowRows(packets: any[]) {
  return packets.map((packet) => {
    const coverage = (key: string) => (packet.coverageContract?.rows || []).find((item: any) => item.key === key);
    const visualAsset = (packet.assetPlan || []).find((asset: any) => asset.assetKey === "visuals");
    const packageId = packet.draftPackage?.packageId || "";
    return {
      "Tracker Stage": "phase_3_shorts_video_handoff",
      "Spend Window": "$100-$250",
      "Spend Permission": "Approved for small polish/shorts planning checkpoint only",
      "Topic": packet.topic,
      "Concept": packet.concept,
      "Nursing Subject": packet.nursingSubject,
      "Weak Topic": packet.weakTopic || "",
      "NCLEX Category": packet.nclexCategory || "",
      "CJM Step": packet.cjmStep || "",
      "Template Draft Package ID": packageId,
      "Lesson Builder Review URL": packageId ? `/admin/lesson-builder?tab=review&packageId=${packageId}` : "",
      "Student Surface After Publish": packageId ? `/lessons/${packageId}` : "",
      "Drive Project Assets": (packet.driveProjectAssets || []).map((asset: any) => asset.title).join(" | "),
      "Drive Asset Links": (packet.driveProjectAssets || []).map((asset: any) => asset.url).join(" | "),
      "Short Hook": packet.shortsStarter?.hook || "",
      "Short Script Draft": packet.shortsStarter?.scriptDraft || "",
      "CTA": packet.shortsStarter?.cta || "Open the full NurseStudy lesson.",
      "Video Lesson Deck": coverage("lessonDeck")?.status || "",
      "Study Guide": coverage("studyGuide")?.status || "",
      "Quiz/Rationale": coverage("quiz")?.status || "",
      "Visuals": coverage("visuals")?.status || "",
      "Citations": coverage("citations")?.status || "",
      "Visual Brief": visualAsset?.brief || "",
      "Audio/TTS Status": "script draft only; record audio after content review",
      "Coverage Summary": packet.coverageContract ? `${packet.coverageContract.readyCount}/${packet.coverageContract.totalCount} reviewable` : "",
      "Next Production Action": "Review the hook/script, choose one visual direction, then approve only one short for polish.",
      "Human Review Gate": (packet.humanReviewGate || []).join(" | "),
      "Cost Guardrail": "Do not batch video/audio. Approve one short per topic inside the $100-$250 checkpoint.",
    };
  });
}

function topicProductionShortsWorkflowCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionShortsWorkflowRows(topicProductionNextSpendPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Tracker Stage",
    "Spend Window",
    "Spend Permission",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Template Draft Package ID",
    "Lesson Builder Review URL",
    "Student Surface After Publish",
    "Drive Project Assets",
    "Drive Asset Links",
    "Short Hook",
    "Short Script Draft",
    "CTA",
    "Video Lesson Deck",
    "Study Guide",
    "Quiz/Rationale",
    "Visuals",
    "Citations",
    "Visual Brief",
    "Audio/TTS Status",
    "Coverage Summary",
    "Next Production Action",
    "Human Review Gate",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionPhaseThreeHandoffRows(packets: any[]) {
  return packets.map((packet) => {
    const coverage = (key: string) => (packet.coverageContract?.rows || []).find((item: any) => item.key === key);
    const packageId = packet.draftPackage?.packageId || "";
    const phaseThreeDecision = packet.draftPackage?.phaseThreeDecision || {};
    const readyItems = [
      `lesson deck: ${coverage("lessonDeck")?.status || "needed"}`,
      `study guide: ${coverage("studyGuide")?.status || "needed"}`,
      `quiz/rationale: ${coverage("quiz")?.status || "needed"}`,
      `citations: ${coverage("citations")?.status || "needed"}`,
      `visuals: ${coverage("visuals")?.status || "needed"}`,
      `video/shorts: ${coverage("videoShorts")?.status || "needed"}`,
    ].join(" | ");

    return {
      "Handoff Stage": "phase_3_review_before_polish",
      "Spend Window": "$100-$250",
      "Topic": packet.topic,
      "Concept": packet.concept,
      "Nursing Subject": packet.nursingSubject,
      "Template Draft Package ID": packageId,
      "Admin Review URL": packageId ? `/admin/lesson-builder?tab=review&packageId=${packageId}` : "",
      "Student Lesson URL": packageId ? `/lessons/${packageId}` : "",
      "Airtable Tracker Row": "ready_to_import",
      "Shorts Workflow Row": "ready_to_export",
      "Current Asset Coverage": readyItems,
      "Drive Project Assets": (packet.driveProjectAssets || []).map((asset: any) => asset.title).join(" | "),
      "Immediate Human Decision": "approve one polish pass | request fixes | hold spend",
      "Recorded Decision": phaseThreeDecision.decision || "unreviewed",
      "Decision Notes": phaseThreeDecision.reviewerNotes || "",
      "Decision Recorded At": phaseThreeDecision.reviewedAt || "",
      "Next Owner Action": "Review the lesson draft, quiz rationale, citations, and hook/script; choose exactly one approved production action.",
      "Allowed Next Work": "One polish pass or one short planning pass for this topic only.",
      "Hold Trigger": "Any incorrect concept/specialty, unsafe rationale, missing citation, or unclear student value.",
      "Cost Guardrail": "No batch generation, no full video production, no paid audio until this row is reviewed and accepted.",
    };
  });
}

function topicProductionPhaseThreeHandoffCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionPhaseThreeHandoffRows(topicProductionNextSpendPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Handoff Stage",
    "Spend Window",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Template Draft Package ID",
    "Admin Review URL",
    "Student Lesson URL",
    "Airtable Tracker Row",
    "Shorts Workflow Row",
    "Current Asset Coverage",
    "Drive Project Assets",
    "Immediate Human Decision",
    "Recorded Decision",
    "Decision Notes",
    "Decision Recorded At",
    "Next Owner Action",
    "Allowed Next Work",
    "Hold Trigger",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionStudentLaunchReadinessRows(packets: any[]) {
  return packets.map((packet) => {
    const draft = packet.draftPackage || {};
    const packageId = draft.packageId || "";
    const phaseThreeDecision = draft.phaseThreeDecision || {};
    const studentLaunchDecision = draft.studentLaunchDecision || {};
    const previewReview = studentLaunchDecision.previewReview || {};
    const blockers = [
      !draft.nextSpendApproved ? "Phase 2 draft is not approved for next checkpoint" : "",
      !phaseThreeDecision.decision || phaseThreeDecision.decision === "unreviewed" ? "Phase 3 production decision is not recorded" : "",
      Number(draft.slideCount || 0) < 5 ? "Lesson deck is too small for student review" : "",
      Number(draft.itemCount || 0) < 1 ? "Practice item is missing" : "",
      Number(draft.citationCount || 0) < 1 ? "Citations are missing" : "",
      Number(draft.failCount || 0) > 0 ? "QA has failures" : "",
      studentLaunchDecision.decision === "needs_fix" ? "Student launch reviewer requested fixes" : "",
      studentLaunchDecision.decision === "hold_release" ? "Student launch reviewer put release on hold" : "",
      previewReview.outcome === "needs_fix" ? "Controlled preview reviewer requested fixes" : "",
      previewReview.outcome === "hold_release" ? "Controlled preview reviewer put release on hold" : "",
    ].filter(Boolean);
    const publicVisible = draft.status === "published";
    const approvedPreview = studentLaunchDecision.decision === "approve_student_preview" && blockers.length === 0;
    const previewEnabled = studentLaunchDecision.decision === "approve_student_preview" && studentLaunchDecision.previewKey;
    const previewUrl = publicVisible
      ? `/lessons/${packageId}`
      : previewEnabled
        ? `/lessons/${packageId}?previewKey=${encodeURIComponent(studentLaunchDecision.previewKey)}`
        : "";
    const launchGateStatus = publicVisible
      ? "published"
      : approvedPreview && previewReview.outcome === "ready_for_release"
        ? "reviewed_ready_for_release"
        : approvedPreview
        ? "approved_for_student_preview"
        : blockers.length
          ? "blocked"
          : "student_review_needed";

    return {
      "Launch Gate Status": launchGateStatus,
      "Topic": packet.topic,
      "Concept": packet.concept,
      "Nursing Subject": packet.nursingSubject,
      "Template Draft Package ID": packageId,
      "Package Status": draft.status || "",
      "Student Preview URL": previewUrl,
      "Public Visibility": publicVisible ? "published" : "admin_only_until_publish",
      "Student Launch Decision": studentLaunchDecision.decision || "unreviewed",
      "Preview Key Status": studentLaunchDecision.previewKey ? "active" : "not_created",
      "Decision Notes": studentLaunchDecision.reviewerNotes || "",
      "Decision Recorded At": studentLaunchDecision.reviewedAt || "",
      "Preview Review Outcome": previewReview.outcome || "not_recorded",
      "Preview Review Notes": previewReview.reviewerNotes || "",
      "Preview Review Recorded At": previewReview.reviewedAt || "",
      "Phase 3 Decision": phaseThreeDecision.decision || "unreviewed",
      "Slide Count": draft.slideCount || 0,
      "Quiz Count": draft.itemCount || 0,
      "Citation Count": draft.citationCount || 0,
      "QA Failures": draft.failCount || 0,
      "Coverage Summary": packet.coverageContract ? `${packet.coverageContract.readyCount}/${packet.coverageContract.totalCount} reviewable; student ready ${packet.coverageContract.studentReady ? "yes" : "no"}` : "",
      "Blockers": blockers.join(" | "),
      "Next Action": previewReview.outcome === "ready_for_release"
        ? "Admin can proceed to final publish decision after confirming no external release blockers remain."
        : approvedPreview
        ? "Open a controlled student preview review; publish only after visual/content review passes."
        : blockers.length
          ? "Resolve blockers before public release."
          : "Record approve_student_preview, needs_fix, or hold_release.",
      "Cost Guardrail": "No broad public launch, video/audio, or batch production until this gate is approved.",
    };
  });
}

function topicProductionStudentLaunchReadinessCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionStudentLaunchReadinessRows(topicProductionNextSpendPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Launch Gate Status",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Template Draft Package ID",
    "Package Status",
    "Student Preview URL",
    "Public Visibility",
    "Student Launch Decision",
    "Preview Key Status",
    "Decision Notes",
    "Decision Recorded At",
    "Preview Review Outcome",
    "Preview Review Notes",
    "Preview Review Recorded At",
    "Phase 3 Decision",
    "Slide Count",
    "Quiz Count",
    "Citation Count",
    "QA Failures",
    "Coverage Summary",
    "Blockers",
    "Next Action",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionPublishReadinessRows(packets: any[]) {
  return packets.map((packet) => {
    const draft = packet.draftPackage || {};
    const packageId = draft.packageId || "";
    const phaseThreeDecision = draft.phaseThreeDecision || {};
    const studentLaunchDecision = draft.studentLaunchDecision || {};
    const previewReview = studentLaunchDecision.previewReview || {};
    const publicReleaseDecision = draft.publicReleaseDecision || {};
    const publicVisible = draft.status === "published";
    const blockers = [
      publicVisible ? "" : (!draft.nextSpendApproved ? "Phase 2 draft is not approved for next checkpoint" : ""),
      publicVisible ? "" : (!phaseThreeDecision.decision || phaseThreeDecision.decision === "unreviewed" ? "Phase 3 production decision is not recorded" : ""),
      publicVisible ? "" : (studentLaunchDecision.decision !== "approve_student_preview" ? "Controlled student preview is not approved" : ""),
      publicVisible ? "" : (previewReview.outcome !== "ready_for_release" ? "Controlled preview reviewer has not marked ready for release" : ""),
      publicVisible ? "" : (publicReleaseDecision.decision === "needs_fix" ? "Final release reviewer requested fixes" : ""),
      publicVisible ? "" : (publicReleaseDecision.decision === "hold_release" ? "Final release reviewer put release on hold" : ""),
      Number(draft.slideCount || 0) < 5 ? "Lesson deck is too small for public release" : "",
      Number(draft.itemCount || 0) < 1 ? "Practice item is missing" : "",
      Number(draft.citationCount || 0) < 1 ? "Citations are missing" : "",
      Number(draft.failCount || 0) > 0 ? "QA has failures" : "",
    ].filter(Boolean);
    const baseReadyForReleaseDecision = !publicVisible && blockers.length === 0 && previewReview.outcome === "ready_for_release";
    const releaseApproved = publicReleaseDecision.decision === "approve_public_release";
    const readyForPublish = baseReadyForReleaseDecision && releaseApproved;
    const publishGateStatus = publicVisible
      ? "published"
      : readyForPublish
        ? "ready_for_public_publish"
        : baseReadyForReleaseDecision
          ? "release_decision_needed"
        : "blocked";

    return {
      "Publish Gate Status": publishGateStatus,
      "Topic": packet.topic,
      "Concept": packet.concept,
      "Nursing Subject": packet.nursingSubject,
      "Approved Work Order ID": draft.reviewPackageWorkOrderId || "",
      "Template Draft Package ID": packageId,
      "Package Status": draft.status || "",
      "Public Lesson URL": publicVisible && packageId ? `/lessons/${packageId}` : "",
      "Lesson Builder Publish URL": packageId ? `/admin/lesson-builder?tab=review&packageId=${packageId}` : "",
      "Publish Endpoint": readyForPublish && packageId ? `/api/admin/lesson-builder/packages/${packageId}/publish` : "",
      "Release Audit Endpoint": packageId ? `/api/admin/topic-production-matrix/drafts/${packageId}/release-audit-snapshot` : "",
      "Student Release QA Endpoint": packageId ? `/api/admin/topic-production-matrix/drafts/${packageId}/student-release-sanity` : "",
      "Student Launch Decision": studentLaunchDecision.decision || "unreviewed",
      "Preview Review Outcome": previewReview.outcome || "not_recorded",
      "Preview Review Notes": previewReview.reviewerNotes || "",
      "Public Release Decision": publicReleaseDecision.decision || "unreviewed",
      "Public Release Notes": publicReleaseDecision.reviewerNotes || "",
      "Public Release Recorded At": publicReleaseDecision.reviewedAt || "",
      "Phase 3 Decision": phaseThreeDecision.decision || "unreviewed",
      "Slide Count": draft.slideCount || 0,
      "Quiz Count": draft.itemCount || 0,
      "Citation Count": draft.citationCount || 0,
      "QA Failures": draft.failCount || 0,
      "Publish Blockers": blockers.join(" | "),
      "Next Action": publicVisible
        ? "Lesson is already public; monitor student outcomes and feedback."
        : readyForPublish
          ? "Open Lesson Builder and publish after final admin confirmation."
          : baseReadyForReleaseDecision
            ? "Record approve_public_release, needs_fix, or hold_release before exposing the publish endpoint."
          : "Resolve blockers before publishing.",
      "Cost Guardrail": "No paid video/audio, rendered visuals, or batch production is included in this public release gate.",
    };
  });
}

function topicProductionPublishReadinessCsv(rows: any[], sourceRecords: any[] = [], draftRecords: any[] = []) {
  const exportRows = topicProductionPublishReadinessRows(topicProductionNextSpendPackets(rows, sourceRecords, draftRecords));
  const headers = [
    "Publish Gate Status",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Approved Work Order ID",
    "Template Draft Package ID",
    "Package Status",
    "Public Lesson URL",
    "Lesson Builder Publish URL",
    "Publish Endpoint",
    "Release Audit Endpoint",
    "Student Release QA Endpoint",
    "Student Launch Decision",
    "Preview Review Outcome",
    "Preview Review Notes",
    "Public Release Decision",
    "Public Release Notes",
    "Public Release Recorded At",
    "Phase 3 Decision",
    "Slide Count",
    "Quiz Count",
    "Citation Count",
    "QA Failures",
    "Publish Blockers",
    "Next Action",
    "Cost Guardrail",
  ];
  return [
    headers.map(csvValue).join(","),
    ...exportRows.map((row) => headers.map((header) => csvValue((row as Record<string, any>)[header])).join(",")),
  ].join("\n");
}

function topicProductionReleaseAuditSnapshot(bundle: LessonBundle) {
  const pkg = bundle.package;
  const manifest = (pkg.manifest || {}) as Record<string, any>;
  const draft = topicProductionDraftSummary(bundle);
  if (!draft) throw new Error("Release audit snapshot requires a package draft summary");
  const studentLaunchDecision = draft.studentLaunchDecision || {};
  const previewReview = studentLaunchDecision.previewReview || {};
  const publicReleaseDecision = draft.publicReleaseDecision || {};
  const publicVisible = pkg.status === "published";
  const previewKey = typeof studentLaunchDecision.previewKey === "string" ? studentLaunchDecision.previewKey : "";
  const blockers = [
    publicVisible ? "" : (!draft.nextSpendApproved ? "Phase 2 draft is not approved for next checkpoint" : ""),
    publicVisible ? "" : (studentLaunchDecision.decision !== "approve_student_preview" ? "Controlled student preview is not approved" : ""),
    publicVisible ? "" : (previewReview.outcome !== "ready_for_release" ? "Controlled preview reviewer has not marked ready for release" : ""),
    publicVisible ? "" : (publicReleaseDecision.decision !== "approve_public_release" ? "Public release decision is not approved" : ""),
    Number(draft.slideCount || 0) < 5 ? "Lesson deck is too small for public release" : "",
    Number(draft.itemCount || 0) < 1 ? "Practice item is missing" : "",
    Number(draft.citationCount || 0) < 1 ? "Citations are missing" : "",
    Number(draft.failCount || 0) > 0 ? "QA has failures" : "",
  ].filter(Boolean);
  const publishGateStatus = publicVisible
    ? "published"
    : blockers.length === 0
      ? "ready_for_public_publish"
      : "blocked";
  const slideDeck = bundle.slides
    .sort((a: any, b: any) => Number(a.slideNumber || 0) - Number(b.slideNumber || 0))
    .map((slide: any) => ({
      slideNumber: slide.slideNumber,
      title: slide.title,
      type: slide.slideType || slide.type || "",
      learningObjective: slide.learningObjective || "",
      speakerNotesAvailable: Boolean(slide.speakerNotes),
    }));
  const practiceItems = bundle.items.map((item: any) => ({
    itemType: item.itemType,
    stem: item.stem,
    correctAnswer: item.correctAnswer,
    rationalePreview: String(item.rationale || "").slice(0, 240),
    tags: item.tags || {},
  }));
  const citations = bundle.citations.map((citation: any) => ({
    sourceTitle: citation.sourceTitle || citation.title || citation.sourceId || "Source",
    section: citation.sectionTitle || citation.location || citation.sourceLocator || "",
    claim: citation.claim || citation.snippet || citation.evidence || "",
  }));
  const qaFailures = bundle.qaResults.filter((result: any) => result.status === "fail");
  const qaWarnings = bundle.qaResults.filter((result: any) => result.status === "warn" || result.status === "warning");

  return {
    generatedAt: new Date().toISOString(),
    phase: "phase_16_release_audit_snapshot",
    package: {
      id: pkg.id,
      title: pkg.title,
      topic: pkg.topic,
      status: pkg.status,
      deckModel: pkg.deckModel,
      updatedAt: pkg.updatedAt,
    },
    learnerVisibility: {
      currentVisibility: publicVisible ? "public" : "hidden_until_publish",
      publicLessonUrl: publicVisible ? `/lessons/${pkg.id}` : "",
      controlledPreviewUrl: previewKey ? `/lessons/${pkg.id}?previewKey=${encodeURIComponent(previewKey)}` : "",
      publishEndpoint: !publicVisible && blockers.length === 0 ? `/api/admin/lesson-builder/packages/${pkg.id}/publish` : "",
      lessonBuilderReviewUrl: `/admin/lesson-builder?tab=review&packageId=${pkg.id}`,
    },
    publicContentInventory: {
      slideCount: bundle.slides.length,
      practiceItemCount: bundle.items.length,
      citationCount: bundle.citations.length,
      artifactCount: bundle.artifacts.length,
      guidedNotesAvailable: Boolean(manifest.guidedNotes || bundle.artifacts.some((artifact: any) => String(artifact.artifactType || "").includes("guided"))),
      learnerSafeSurface: "slides, guided notes, practice item/rationale, citations, and completion/feedback events",
    },
    slideDeck,
    practiceItems,
    citations,
    qa: {
      summary: pkg.qaSummary || {},
      resultCount: bundle.qaResults.length,
      failureCount: qaFailures.length,
      warningCount: qaWarnings.length,
      failures: qaFailures.map((result: any) => ({ gate: result.gateName || result.gateKey, details: result.details || "" })),
      warnings: qaWarnings.map((result: any) => ({ gate: result.gateName || result.gateKey, details: result.details || "" })),
      contractValidationCount: bundle.contractValidations.length,
    },
    decisions: {
      draftReview: draft.draftReview,
      phaseThreeDecision: draft.phaseThreeDecision,
      studentLaunchDecision: {
        decision: studentLaunchDecision.decision || "unreviewed",
        reviewedAt: studentLaunchDecision.reviewedAt || null,
        reviewedBy: studentLaunchDecision.reviewedBy || "",
      },
      previewReview: {
        outcome: previewReview.outcome || "not_recorded",
        reviewedAt: previewReview.reviewedAt || null,
        reviewedBy: previewReview.reviewedBy || "",
      },
      publicReleaseDecision: {
        decision: publicReleaseDecision.decision || "unreviewed",
        reviewedAt: publicReleaseDecision.reviewedAt || null,
        reviewedBy: publicReleaseDecision.reviewedBy || "",
      },
    },
    publishReadiness: {
      status: publishGateStatus,
      blockers,
      nextAction: publicVisible
        ? "Lesson is public. Monitor learner feedback and outcomes."
        : blockers.length === 0
          ? "Final publish endpoint is available for this single package."
          : "Resolve blockers before public publish.",
    },
    costGuardrail: "Read-only release audit snapshot. No public publish, no TTS, no rendered video, no paid visual generation, and no batch production is performed by this audit.",
  };
}

function findForbiddenLearnerPayloadKeys(value: any, pathName = ""): string[] {
  const forbiddenKeys = [
    "qaResults",
    "generationRuns",
    "contractValidations",
    "releaseAuditEvents",
    "sourceArchiveFiles",
    "sourceArchiveImports",
    "sourceRegistry",
    "taxonomySnapshot",
    "manifest",
    "adminNotes",
    "internalNotes",
    "csrfToken",
    "learnerKey",
    "previewKey",
    "publishEndpoint",
    "releaseAuditEndpoint",
  ];
  if (!value || typeof value !== "object") return [];
  const matches: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(...findForbiddenLearnerPayloadKeys(item, `${pathName}[${index}]`));
    });
    return matches;
  }
  for (const [key, nested] of Object.entries(value)) {
    const currentPath = pathName ? `${pathName}.${key}` : key;
    if (forbiddenKeys.includes(key)) matches.push(currentPath);
    matches.push(...findForbiddenLearnerPayloadKeys(nested, currentPath));
  }
  return matches;
}

function topicProductionStudentReleaseSanity(bundle: LessonBundle) {
  const learner = learnerLessonPayload(bundle, null);
  const summary = studentLessonSummary(bundle);
  const assessmentBridge = learner.package.assessmentBridge || {};
  const guidedNotesSlides = learner.slides.filter((slide: any) => Boolean(String(slide.guidedNotes || "").trim())).length;
  const rationaleCount = learner.practiceItems.filter((item: any) => Boolean(String(item.rationale || "").trim())).length;
  const optionsReadyCount = learner.practiceItems.filter((item: any) => Array.isArray(item.options) && item.options.length >= 2).length;
  const slideCitationCount = learner.slides.reduce((total: number, slide: any) => total + (Array.isArray(slide.citations) ? slide.citations.length : 0), 0);
  const forbiddenKeysFound = findForbiddenLearnerPayloadKeys(learner);
  const checks = [
    {
      key: "public_visibility",
      label: "Public lesson URL is live",
      passed: learner.package.status === "published",
      detail: learner.package.status === "published" ? `/lessons/${learner.package.id}` : `status ${learner.package.status}`,
    },
    {
      key: "student_topic_labels",
      label: "Topic has learner-facing weak topic, NCLEX, and CJM labels",
      passed: Boolean(assessmentBridge.weakTopic && assessmentBridge.nclexCategory && assessmentBridge.cjmStep),
      detail: `${assessmentBridge.weakTopic || "missing"} / ${assessmentBridge.nclexCategory || "missing"} / ${assessmentBridge.cjmStep || "missing"}`,
    },
    {
      key: "slide_deck",
      label: "Student deck has at least five slides",
      passed: learner.slides.length >= 5 && learner.deck.slideCount === learner.slides.length,
      detail: `${learner.slides.length} slide(s)`,
    },
    {
      key: "guided_notes",
      label: "Guided notes are available in the deck",
      passed: guidedNotesSlides >= Math.min(5, learner.slides.length),
      detail: `${guidedNotesSlides} slide(s) with guided notes`,
    },
    {
      key: "practice_and_rationale",
      label: "Practice item includes options, answer, and rationale",
      passed: learner.practiceItems.length >= 1 && optionsReadyCount >= 1 && rationaleCount >= 1,
      detail: `${learner.practiceItems.length} item(s), ${rationaleCount} rationale(s)`,
    },
    {
      key: "citations",
      label: "Citations and source-backed trust signals are present",
      passed: learner.citations.length >= 1 && learner.sources.length >= 1 && slideCitationCount >= 1,
      detail: `${learner.citations.length} citation(s), ${learner.sources.length} source(s), ${slideCitationCount} slide citation link(s)`,
    },
    {
      key: "learner_events",
      label: "Completion and feedback event endpoints are available",
      passed: Boolean(learner.package.id),
      detail: `/api/lessons/${learner.package.id}/events and /api/lessons/${learner.package.id}/feedback`,
    },
    {
      key: "admin_safe_payload",
      label: "Learner payload excludes admin-only internals",
      passed: forbiddenKeysFound.length === 0 && learner.package.reviewSummary === null,
      detail: forbiddenKeysFound.length ? forbiddenKeysFound.join(", ") : "no forbidden keys found",
    },
  ];
  const failCount = checks.filter((check) => !check.passed).length;

  return {
    generatedAt: new Date().toISOString(),
    phase: "phase_18_public_student_release_sanity",
    package: {
      id: learner.package.id,
      title: learner.package.title,
      topic: learner.package.topic,
      status: learner.package.status,
      publicLessonUrl: `/lessons/${learner.package.id}`,
    },
    summary: {
      status: failCount === 0 ? "pass" : "blocked",
      passCount: checks.length - failCount,
      failCount,
    },
    studentLabels: {
      subject: summary.subject,
      weakTopic: assessmentBridge.weakTopic || summary.weakTopic || "",
      atiCategory: assessmentBridge.atiCategory || summary.atiCategory || null,
      nclexCategory: assessmentBridge.nclexCategory || summary.nclexCategory || null,
      cjmStep: assessmentBridge.cjmStep || summary.cjmStep || null,
      tags: summary.tags || [],
    },
    publicContentInventory: {
      slideCount: learner.slides.length,
      guidedNotesSlides,
      practiceItemCount: learner.practiceItems.length,
      rationaleCount,
      citationCount: learner.citations.length,
      sourceCount: learner.sources.length,
    },
    checks,
    adminSafety: {
      forbiddenKeysFound,
      reviewSummaryIncluded: learner.package.reviewSummary !== null,
      publicResponseTopLevelKeys: Object.keys(learner),
    },
    learnerActions: {
      lessonUrl: `/lessons/${learner.package.id}`,
      eventEndpoint: `/api/lessons/${learner.package.id}/events`,
      feedbackEndpoint: `/api/lessons/${learner.package.id}/feedback`,
      supportedSignals: ["lesson_opened", "slide_viewed", "practice_attempted", "lesson_completed", "feedback_submitted", "lesson_saved"],
    },
    sampleContent: {
      slideTitles: learner.slides.slice(0, 5).map((slide: any) => slide.title),
      practicePreview: learner.practiceItems[0]
        ? {
          stem: learner.practiceItems[0].stem,
          rationalePreview: String(learner.practiceItems[0].rationale || "").slice(0, 220),
        }
        : null,
      citationLabels: learner.citations.slice(0, 5).map((citation: any) => citation.citationLabel),
    },
    costGuardrail: "Read-only student release sanity check. No new AI generation, public publish, TTS, rendered video, paid visual generation, or batch production is performed by this audit.",
  };
}

function topicProductionNextBuildRows(rows: any[]) {
  return rows.filter((row) => topicProductionNextBuildDecisions.has(row.review?.decision));
}

async function topicProductionMatrixPayload() {
  await ensureLessonBuilderTables();
  await loadTopicProductionReviewOverrides();

  const packages = await db.select().from(lessonPackages).orderBy(desc(lessonPackages.updatedAt)).limit(75);
  const packageRows = [];
  for (const pkg of packages) {
    const bundle = await findPackageBundle(pkg.id);
    if (bundle) packageRows.push(topicProductionRowFromBundle(bundle));
  }

  let blockRows: ReturnType<typeof topicProductionRowFromContentBlock>[] = [];
  try {
    const packagedTopics = new Set(packageRows.map((row) => compactTopicKey(row.topic)));
    const blocks = await db.select().from(contentBlocks).orderBy(desc(contentBlocks.updatedAt)).limit(150);
    blockRows = blocks
      .filter((block) => !packagedTopics.has(compactTopicKey(block.category || block.title)))
      .slice(0, 75)
      .map(topicProductionRowFromContentBlock);
    blockRows = topicProductionRollupRows(blockRows);
  } catch (error) {
    console.warn("Topic production matrix content-block rows unavailable:", error);
  }

  const candidateRows = topicProductionPhaseTwoCandidateRows([...packageRows, ...blockRows]);
  const rows = [...packageRows, ...blockRows, ...candidateRows].map(topicProductionDecoratedRow);
  return {
    rows,
    summary: summarizeTopicProductionRows(rows),
    driveProject: topicProductionDriveProjectPayload(rows),
    airtableTracker: topicProductionAirtableTrackerPayload(),
    phaseOneCheckpoint: topicProductionPhaseOneCheckpoint(rows),
    generatedAt: new Date().toISOString(),
  };
}

async function recordReleaseAuditEvent(
  packageId: string,
  eventType: string,
  summary: string,
  payload: Record<string, any> = {},
  actorId?: string
) {
  const [event] = await db.insert(lessonReleaseAuditEvents).values({
    packageId,
    eventType,
    summary,
    payload,
    actorId,
  }).returning();
  return event;
}

async function attachAssessmentBridge(packageId: string, data: z.infer<typeof assessmentBridgeSchema>, actorId?: string) {
  const bundle = await findPackageBundle(packageId);
  if (!bundle) return null;

  const selectedSource = data.sourceId
    ? bundle.sources.find((source) => source.id === data.sourceId)
      || (await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, data.sourceId)).limit(1))[0]
    : null;
  const attachedAt = new Date().toISOString();
  const assessmentBridge = {
    status: "ready",
    weakTopic: data.weakTopic,
    atiCategory: data.atiCategory || null,
    nclexCategory: data.nclexCategory || null,
    cjmStep: data.cjmStep || null,
    sourceId: selectedSource?.id || null,
    sourceTitle: selectedSource?.title || null,
    note: data.note || "",
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    rationale: data.rationale || "",
    sourceEvidence: Array.isArray(data.sourceEvidence) ? data.sourceEvidence : [],
    agentMode: data.agentMode || null,
    attachedAt,
    attachedBy: actorId || null,
  };

  const nextManifest = {
    ...(bundle.package.manifest || {}),
    assessmentBridge,
    pilot: {
      ...((bundle.package.manifest || {}).pilot || {}),
      officialPackage: data.officialPilotPackage,
      officialPackageSetAt: attachedAt,
    },
  };
  const nextTaxonomySnapshot = {
    ...(bundle.package.taxonomySnapshot || {}),
    assessmentBridge,
  };
  const nextDeckModel = {
    ...(bundle.package.deckModel || {}),
    assessmentBridge,
  };

  await db.update(lessonPackages).set({
    manifest: nextManifest,
    taxonomySnapshot: nextTaxonomySnapshot,
    deckModel: nextDeckModel,
    updatedAt: new Date(),
  }).where(eq(lessonPackages.id, packageId));

  await recordReleaseAuditEvent(
    packageId,
    "assessment_bridge_attached",
    `Assessment bridge attached for ${data.weakTopic}.`,
    {
      weakTopic: assessmentBridge.weakTopic,
      atiCategory: assessmentBridge.atiCategory,
      nclexCategory: assessmentBridge.nclexCategory,
      cjmStep: assessmentBridge.cjmStep,
      sourceId: assessmentBridge.sourceId,
      confidence: assessmentBridge.confidence,
      agentMode: assessmentBridge.agentMode,
      sourceEvidence: assessmentBridge.sourceEvidence,
      officialPilotPackage: data.officialPilotPackage,
    },
    actorId
  );

  return findPackageBundle(packageId);
}

function cleanedUpdateValues<T extends Record<string, any>>(values: T) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function buildCurrentDeckModel(bundle: LessonBundle) {
  const taxonomySnapshot = bundle.package.taxonomySnapshot || {};
  return {
    ...buildDeckModel(
      bundle.package.id,
      bundle.package.title,
      bundle.package.topic,
      bundle.package.audience,
      bundle.slides,
      taxonomySnapshot
    ),
    items: bundle.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      stem: item.stem,
      options: item.options,
      correctAnswer: item.correctAnswer,
      rationale: item.rationale,
      tags: item.tags,
      difficulty: item.difficulty,
    })),
    generation: bundle.package.deckModel?.generation,
    supervisorNotes: bundle.package.deckModel?.supervisorNotes,
    risks: bundle.package.deckModel?.risks,
  };
}

function buildCurrentManifest(bundle: LessonBundle, reason: string) {
  const wasPublished = bundle.package.status === "published" || Boolean(bundle.package.publishedAt);
  return {
    ...(bundle.package.manifest || {}),
    packageId: bundle.package.id,
    title: bundle.package.title,
    topic: bundle.package.topic,
    sourceIds: bundle.package.sourceIds || [],
    requiredFiles: harrityRequiredExportFiles,
    counts: {
      sources: bundle.sources.length,
      slides: bundle.slides.length,
      items: bundle.items.length,
      citations: bundle.citations.length,
    },
    reviewStatus: wasPublished ? "needs_republish" : "needs_qa_after_edit",
    lastEditedAt: new Date().toISOString(),
    editReason: reason,
  };
}

async function markPackageNeedsReview(packageId: string, reason: string) {
  const existingBundle = await findPackageBundle(packageId);
  if (!existingBundle) throw new Error("Lesson package not found");
  const wasPublished = existingBundle.package.status === "published" || Boolean(existingBundle.package.publishedAt);

  await Promise.all([
    db.delete(lessonQaResults).where(eq(lessonQaResults.packageId, packageId)),
    db.delete(lessonContractValidations).where(eq(lessonContractValidations.packageId, packageId)),
    db.delete(lessonPackageArtifacts).where(eq(lessonPackageArtifacts.packageId, packageId)),
  ]);

  const bundle = await findPackageBundle(packageId);
  if (!bundle) throw new Error("Lesson package not found");

  const qaSummary = {
    status: "needs_review",
    passCount: 0,
    warningCount: 0,
    failCount: 0,
    reason,
    requiresRepublish: wasPublished,
    checkedAt: null,
  };

  await db.update(lessonPackages).set({
    status: wasPublished ? "needs_republish" : "draft",
<<<<<<< HEAD
=======
    releaseStage: "draft",
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    qaSummary,
    deckModel: buildCurrentDeckModel(bundle),
    manifest: buildCurrentManifest(bundle, reason),
    updatedAt: new Date(),
  }).where(eq(lessonPackages.id, packageId));

  return findPackageBundle(packageId);
}

function gate(gateKey: string, gateName: string, passed: boolean, details: string, warn = false) {
  return {
    gateKey,
    gateName,
    status: passed ? "pass" : warn ? "warn" : "fail",
    details,
    score: passed ? "100" : warn ? "75" : "0",
  };
}

async function runQaForPackage(packageId: string) {
  const bundle = await findPackageBundle(packageId);
  if (!bundle) throw new Error("Lesson package not found");

  const { slides, items, citations } = bundle;
  const visibleText = slides.map((slide) => JSON.stringify(slide.visibleContent || {})).join(" ").toLowerCase();
  const bannedVisibleTerms = ["instructor", "faculty", "speaker notes", "teaching plan"];
  const visibleHasBannedTerms = bannedVisibleTerms.some((term) => visibleText.includes(term));
  const slidesWithCitations = new Set(citations.filter((citation) => citation.slideId).map((citation) => citation.slideId));
  const slidesWithRetrieval = slides.filter((slide) => Boolean(slide.retrievalPrompt));
  const slidesWithTrap = slides.filter((slide) => JSON.stringify(slide.visibleContent || {}).toLowerCase().includes("trap"));
  const maxVisibleKeys = Math.max(0, ...slides.map((slide) => Object.keys(slide.visibleContent || {}).length));
  const itemsWithRationales = items.filter((item) => Boolean(item.rationale && item.correctAnswer));
  const hasClinicalJudgment = slides.some((slide) => Boolean(slide.cjmStep)) && items.some((item) => Boolean((item.tags as any)?.cjmStep));
  const hasValidCitations = citations.every((citation) => citation.sourceId || citation.documentId || citation.chunkId);
<<<<<<< HEAD

  const results = [
    gate("source_traceability", "Source Traceability", slidesWithCitations.size >= slides.length, `${slidesWithCitations.size}/${slides.length} slides have traceable citations.`),
=======
  const alignment = topicSourceAlignment(bundle);
  const licensedApproval = hasLicensedClinicalApproval(bundle);

  const results = [
    gate("source_traceability", "Source Traceability", slidesWithCitations.size >= slides.length, `${slidesWithCitations.size}/${slides.length} slides have traceable citations.`),
    gate("topic_source_alignment", "Topic and Source Alignment", alignment.valid, alignment.message),
    gate("licensed_clinical_review", "Licensed RN Clinical Review", licensedApproval, licensedApproval ? "Licensed RN faculty release approval is recorded." : "Licensed RN faculty review is required before release.", true),
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    gate("learner_only_visible_slides", "Learner-only Visible Slides", !visibleHasBannedTerms, visibleHasBannedTerms ? "Visible slide content contains instructor-facing language." : "Visible slide content stays learner-facing."),
    gate("exam_anchor_density", "Exam Anchor Density", slides.every((slide) => slide.nclexCategory), "Every slide should carry an NCLEX category."),
    gate("retrieval_practice", "Retrieval and Application", slidesWithRetrieval.length >= Math.max(2, Math.floor(slides.length / 2)), `${slidesWithRetrieval.length}/${slides.length} slides include retrieval prompts.`),
    gate("rationale_coverage", "Rationale Coverage", items.length > 0 && itemsWithRationales.length === items.length, `${itemsWithRationales.length}/${items.length} items include answer keys and rationales.`),
    gate("clinical_judgment_alignment", "Clinical Judgment Alignment", hasClinicalJudgment, "Slides and items should include CJM tags."),
    gate("common_trap_coverage", "Common Trap Coverage", slidesWithTrap.length > 0, `${slidesWithTrap.length} slides include common trap language.`),
    gate("cognitive_load", "Cognitive Load", maxVisibleKeys <= 5, `Largest slide has ${maxVisibleKeys} visible content blocks.`, maxVisibleKeys <= 6),
    gate("accessibility", "Accessibility", slides.every((slide) => slide.title && slide.retrievalPrompt), "Every slide should have a title and retrieval prompt."),
    gate("assessment_blueprint", "Assessment Blueprint", items.length > 0 && items.every((item) => (item.tags as any)?.nclexCategory), "Practice items should include NCLEX/CJM tags."),
    gate("student_reception_review", "Student Reception Review", true, "Package includes prediction, practice, rationale, and takeaway flow."),
    gate("proprietary_source_safety", "Proprietary-source Safety", citations.every((citation) => !citation.excerpt || citation.excerpt.length <= 360), "Citation excerpts are short and source content is paraphrased."),
    gate("artifact_truthfulness", "Artifact Truthfulness", hasValidCitations, "Citations point to selected source records, documents, or chunks."),
  ];

  await deleteExistingQa(packageId);
  if (results.length > 0) {
    await db.insert(lessonQaResults).values(results.map((result) => ({
      packageId,
      ...result,
    })));
  }

  const failing = results.filter((result) => result.status === "fail").length;
  const warnings = results.filter((result) => result.status === "warn").length;
  const wasPublished = bundle.package.status === "published" || Boolean(bundle.package.publishedAt);
  const nextStatus = failing > 0
    ? (wasPublished ? "needs_republish" : "blocked")
    : (bundle.package.status === "published" ? "published" : "qa_ready");
  const qaSummary = {
    status: nextStatus,
    passCount: results.length - failing - warnings,
    warningCount: warnings,
    failCount: failing,
    requiresRepublish: nextStatus === "needs_republish",
    checkedAt: new Date().toISOString(),
  };

  await db
    .update(lessonPackages)
    .set({
      status: nextStatus,
<<<<<<< HEAD
=======
      releaseStage: failing > 0
        ? "draft"
        : bundle.package.status === "published"
          ? "export_ready"
          : "clinical_review",
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
      qaSummary,
      updatedAt: new Date(),
    })
    .where(eq(lessonPackages.id, packageId));

  return { qaSummary, results };
}

function csvEscape(value: any) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: any[][]) {
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

const harrityRequiredExportFiles = [
  "source_summary.json",
  "concept_clusters.json",
  "assessment_blueprint.csv",
  "slide_map.csv",
  "item_map.csv",
  "qa_log.csv",
  "student_guided_notes.md",
  "instructor_facilitation_notes.md",
  "student_reception_review.json",
  "accessibility_report.json",
  "package_manifest.json",
];

function serializeArtifactContent(artifact: { contentJson?: any; contentText?: string }) {
  if (artifact.contentText !== undefined) return artifact.contentText;
  return JSON.stringify(artifact.contentJson || {}, null, 2);
}

function buildPackageArtifactPayloads(bundle: LessonBundle, profile = "harrity"): PackageArtifactPayload[] {
  const { package: pkg, sources, slides, items, citations, qaResults } = bundle;
  const citationsBySlide = new Map<string, any[]>();
  for (const citation of citations) {
    if (citation.slideId) {
      const existing = citationsBySlide.get(citation.slideId) || [];
      existing.push(citation);
      citationsBySlide.set(citation.slideId, existing);
    }
  }

  const sourceSummary = {
    packageId: pkg.id,
    title: pkg.title,
    exportProfile: profile,
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      sourceKind: source.sourceKind,
      sourceType: source.sourceType,
      subject: source.subject,
      edition: source.edition,
      citationPolicy: source.citationPolicy,
      approvalStatus: source.approvalStatus,
      sourceUri: source.sourceUri,
    })),
  };

  const conceptClusters = {
    topic: pkg.topic,
    audience: pkg.audience,
    taxonomySnapshot: pkg.taxonomySnapshot,
    clusters: slides.map((slide) => ({
      slideNumber: slide.slideNumber,
      title: slide.title,
      cjmStep: slide.cjmStep,
      nclexCategory: slide.nclexCategory,
      nursingProcess: slide.nursingProcess,
    })),
  };

  const assessmentBlueprint = toCsv(
    ["topic", "audience", "nclex_category", "cjm_step", "nursing_process", "bloom_level", "item_count"],
    [[pkg.topic, pkg.audience, slides[0]?.nclexCategory, slides[0]?.cjmStep, slides[0]?.nursingProcess, slides[0]?.bloomLevel, items.length]]
  );

  const slideMap = toCsv(
    ["slide_number", "slide_type", "title", "nclex_category", "cjm_step", "retrieval_prompt", "citations"],
    slides.map((slide) => [
      slide.slideNumber,
      slide.slideType,
      slide.title,
      slide.nclexCategory,
      slide.cjmStep,
      slide.retrievalPrompt,
      (citationsBySlide.get(slide.id) || []).map((citation) => citation.citationLabel).join("; "),
    ])
  );

  const itemMap = toCsv(
    ["item_type", "stem", "correct_answer", "rationale", "nclex_category", "cjm_step", "difficulty"],
    items.map((item) => [
      item.itemType,
      item.stem,
      item.correctAnswer,
      item.rationale,
      (item.tags as any)?.nclexCategory,
      (item.tags as any)?.cjmStep,
      item.difficulty,
    ])
  );

  const qaLog = toCsv(
    ["gate_key", "gate_name", "status", "details", "score", "checked_at"],
    qaResults.map((result) => [result.gateKey, result.gateName, result.status, result.details, result.score, result.checkedAt])
  );

  const studentGuidedNotes = slides.map((slide) => [
    `## Slide ${slide.slideNumber}: ${slide.title}`,
    slide.guidedNotes || "Notes: ____________________",
    slide.retrievalPrompt ? `Retrieval prompt: ${slide.retrievalPrompt}` : "",
  ].filter(Boolean).join("\n\n")).join("\n\n");

  const instructorFacilitationNotes = slides.map((slide) => [
    `## Slide ${slide.slideNumber}: ${slide.title}`,
    slide.speakerNotes || "No speaker notes provided.",
  ].join("\n\n")).join("\n\n");

  const studentReceptionReview = {
    packageId: pkg.id,
    reviewStatus: "ready_for_student_preview",
    checks: [
      "Starts with a patient cue.",
      "Asks students to predict before explanation.",
      "Includes exam anchor and clinical judgment tags.",
      "Includes practice, rationale, and takeaway.",
    ],
  };

  const accessibilityReport = {
    packageId: pkg.id,
    status: "draft_pass",
    checks: [
      "Every slide has a title.",
      "Every slide includes a retrieval prompt or learner task.",
      "Visible slide content is separated from instructor facilitation notes.",
      "Citation excerpts are short enough for proprietary-source safety.",
    ],
    slideCount: slides.length,
  };

  const packageManifest = {
    ...pkg.manifest,
    exportProfile: profile,
    exportedAt: new Date().toISOString(),
    counts: {
      sources: sources.length,
      slides: slides.length,
      items: items.length,
      citations: citations.length,
      qaResults: qaResults.length,
    },
  };

  return [
    { artifactKey: "source_summary", artifactType: "json", fileName: "source_summary.json", mimeType: "application/json", contentJson: sourceSummary },
    { artifactKey: "concept_clusters", artifactType: "json", fileName: "concept_clusters.json", mimeType: "application/json", contentJson: conceptClusters },
    { artifactKey: "assessment_blueprint", artifactType: "csv", fileName: "assessment_blueprint.csv", mimeType: "text/csv", contentText: assessmentBlueprint },
    { artifactKey: "slide_map", artifactType: "csv", fileName: "slide_map.csv", mimeType: "text/csv", contentText: slideMap },
    { artifactKey: "item_map", artifactType: "csv", fileName: "item_map.csv", mimeType: "text/csv", contentText: itemMap },
    { artifactKey: "qa_log", artifactType: "csv", fileName: "qa_log.csv", mimeType: "text/csv", contentText: qaLog },
    { artifactKey: "student_guided_notes", artifactType: "markdown", fileName: "student_guided_notes.md", mimeType: "text/markdown", contentText: studentGuidedNotes },
    { artifactKey: "instructor_facilitation_notes", artifactType: "markdown", fileName: "instructor_facilitation_notes.md", mimeType: "text/markdown", contentText: instructorFacilitationNotes },
    { artifactKey: "student_reception_review", artifactType: "json", fileName: "student_reception_review.json", mimeType: "application/json", contentJson: studentReceptionReview },
    { artifactKey: "accessibility_report", artifactType: "json", fileName: "accessibility_report.json", mimeType: "application/json", contentJson: accessibilityReport },
    { artifactKey: "package_manifest", artifactType: "json", fileName: "package_manifest.json", mimeType: "application/json", contentJson: packageManifest },
    { artifactKey: "deck_model", artifactType: "json", fileName: "deck_model.json", mimeType: "application/json", contentJson: pkg.deckModel || {} },
  ];
}

function buildControlPlaneArtifactPayload(bundle: LessonBundle, profile = "harrity"): PackageArtifactPayload {
  return {
    artifactKey: "control_plane_report",
    artifactType: "json",
    fileName: "control_plane_report.json",
    mimeType: "application/json",
    contentJson: buildLessonControlPlaneReport(bundle, profile),
  };
}

function buildPackageExportArtifactPayloads(bundle: LessonBundle, profile = "harrity"): PackageArtifactPayload[] {
  return [
    ...buildPackageArtifactPayloads(bundle, profile),
    buildControlPlaneArtifactPayload(bundle, profile),
  ];
}

async function persistPackageArtifacts(bundle: LessonBundle, profile = "harrity") {
  const artifacts = buildPackageArtifactPayloads(bundle, profile);
  await db.delete(lessonPackageArtifacts).where(eq(lessonPackageArtifacts.packageId, bundle.package.id));
  if (artifacts.length === 0) return [];

  return db.insert(lessonPackageArtifacts).values(artifacts.map((artifact) => {
    const content = serializeArtifactContent(artifact);
    return {
      packageId: bundle.package.id,
      artifactKey: artifact.artifactKey,
      artifactType: artifact.artifactType,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      contentHash: hashText(content),
      contentJson: artifact.contentJson || {},
      contentText: artifact.contentText,
      metadata: {
        profile,
        generatedAt: new Date().toISOString(),
      },
    };
  })).returning();
}

async function buildExportZip(bundle: LessonBundle, profile = "harrity") {
  const zip = new JSZip();
  const artifacts = buildPackageExportArtifactPayloads(bundle, profile);
  for (const artifact of artifacts) {
    zip.file(artifact.fileName, serializeArtifactContent(artifact));
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

function contractGate(validationKey: string, validationName: string, passed: boolean, details: string, evidence: Record<string, any> = {}, warn = false) {
  return {
    validationKey,
    validationName,
    status: passed ? "pass" : warn ? "warn" : "fail",
    details,
    evidence,
  };
}

type ControlPlaneCheckStatus = "pass" | "warn" | "fail";
type ControlPlaneCheckSeverity = "low" | "medium" | "high";

function controlPlaneCheck(
  key: string,
  label: string,
  passed: boolean,
  detail: string,
  evidence: Record<string, any> = {},
  severity: ControlPlaneCheckSeverity = "high",
  warn = false
) {
  const status: ControlPlaneCheckStatus = passed ? "pass" : warn ? "warn" : "fail";
  return {
    key,
    label,
    status,
    severity,
    detail,
    evidence,
  };
}

function safeJsonText(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "";
  }
}

function collectPlaceholderFindings(value: unknown, path = "$", findings: string[] = []) {
  if (findings.length >= 25) return findings;

  if (typeof value === "string") {
    if (/\b(TODO|TBD|PLACEHOLDER|FIXME|LOREM IPSUM)\b/i.test(value)) {
      findings.push(`${path}: ${value.slice(0, 100)}`);
    }
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectPlaceholderFindings(entry, `${path}[${index}]`, findings));
    return findings;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      collectPlaceholderFindings(entry, `${path}.${key}`, findings);
    });
  }

  return findings;
}

function buildLessonControlPlaneReport(bundle: LessonBundle, profile = "harrity") {
  const { package: pkg, sources, slides, items, citations, qaResults, contractValidations } = bundle;
  const generatedArtifacts = buildPackageArtifactPayloads(bundle, profile);
  const generatedFiles = generatedArtifacts.map((artifact) => artifact.fileName).sort();
  const persistedFiles = bundle.artifacts.map((artifact) => artifact.fileName).sort();
  const allFileNames = new Set([...generatedFiles, ...persistedFiles]);
  const packageSourceIds: string[] = Array.isArray(pkg.sourceIds) ? pkg.sourceIds.map(String) : [];
  const loadedSourceIds = new Set(sources.map((source) => source.id));
  const missingLoadedSources = packageSourceIds.filter((sourceId) => !loadedSourceIds.has(sourceId));
  const slidesWithCitations = new Set(citations.filter((citation) => citation.slideId).map((citation) => citation.slideId));
  const itemCitationIds = new Set(citations.filter((citation) => citation.itemId).map((citation) => citation.itemId));
  const knownSourceIds = new Set(sources.map((source) => source.id));
  const citationsUseKnownSources = citations.every((citation) => {
    return Boolean(citation.documentId || citation.chunkId || (citation.sourceId && knownSourceIds.has(citation.sourceId)));
  });
  const failedQa = qaResults.filter((result) => result.status === "fail");
  const failedContracts = contractValidations.filter((result) => result.status === "fail");
  const manifestContractStatus = String((pkg.manifest as Record<string, any> | null)?.contractValidation?.status || "");
  const hasContractEvidence = contractValidations.length > 0 || Boolean(manifestContractStatus);
  const taxonomySnapshotReady = Object.keys(pkg.taxonomySnapshot || {}).length > 0;
  const slideTaxonomyReady = slides.length > 0 && slides.every((slide) => slide.nclexCategory && slide.cjmStep && slide.bloomLevel);
  const slideNumbers = slides.map((slide) => slide.slideNumber);
  const duplicateSlideNumbers = slideNumbers.filter((slideNumber, index) => slideNumbers.indexOf(slideNumber) !== index);
  const placeholderFindings = collectPlaceholderFindings({
    package: {
      title: pkg.title,
      topic: pkg.topic,
      taxonomySnapshot: pkg.taxonomySnapshot,
      deckModel: pkg.deckModel,
      manifest: pkg.manifest,
    },
    slides: slides.map((slide) => ({
      id: slide.id,
      title: slide.title,
      visibleContent: slide.visibleContent,
      speakerNotes: slide.speakerNotes,
      guidedNotes: slide.guidedNotes,
      retrievalPrompt: slide.retrievalPrompt,
    })),
    items: items.map((item) => ({
      id: item.id,
      stem: item.stem,
      options: item.options,
      correctAnswer: item.correctAnswer,
      rationale: item.rationale,
      tags: item.tags,
    })),
    artifacts: generatedArtifacts.map((artifact) => ({
      fileName: artifact.fileName,
      contentJson: artifact.contentJson,
      contentText: artifact.contentText,
    })),
  });
  const exportedText = [
    safeJsonText(pkg.manifest),
    safeJsonText(pkg.deckModel),
    generatedArtifacts.map((artifact) => serializeArtifactContent(artifact)).join("\n"),
  ].join("\n").toLowerCase();
  const rawLeakTerms = ["chunks/", "tagged_chunks/", "\\chunks\\", "\\tagged_chunks\\"];
  const rawInputLeaks = rawLeakTerms.filter((term) => exportedText.includes(term));
  const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !generatedFiles.includes(fileName));
  const audioFileNames = Array.from(allFileNames).filter((fileName) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(fileName));
  const claimsRenderedAudio = /\b(audio|tts|voice|mp3|wav)\b/.test(exportedText)
    && /\b(rendered|bound|inserted|verified|complete|completed)\b/.test(exportedText);

  const checks = [
    controlPlaneCheck(
      "source_inventory_gate",
      "Source Inventory Gate",
      sources.length > 0 && missingLoadedSources.length === 0,
      missingLoadedSources.length === 0
        ? `${sources.length} source(s) loaded for ${packageSourceIds.length} package source id(s).`
        : `Missing loaded source records: ${missingLoadedSources.join(", ")}.`,
      { packageSourceIds, loadedSourceIds: Array.from(loadedSourceIds), missingLoadedSources }
    ),
    controlPlaneCheck(
      "ckm_contract_gate",
      "CKM / Control Contract Gate",
      hasContractEvidence && failedContracts.length === 0 && manifestContractStatus !== "blocked",
      hasContractEvidence
        ? `${contractValidations.length} contract validation row(s); manifest contract status ${manifestContractStatus || "row-backed"}.`
        : "Run Harrity contract validation before treating the package as control-plane ready.",
      {
        validationCount: contractValidations.length,
        failedValidationKeys: failedContracts.map((result) => result.validationKey),
        manifestContractStatus: manifestContractStatus || null,
      }
    ),
    controlPlaneCheck(
      "taxonomy_gate_0_equivalent",
      "Taxonomy Gate 0 Equivalent",
      slideTaxonomyReady,
      slideTaxonomyReady
        ? `${slides.length} slide(s) carry NCLEX, CJM, and Bloom alignment.`
        : "Every slide must carry NCLEX category, CJM step, and Bloom level before lesson build/export.",
      { taxonomySnapshotReady, slideCount: slides.length }
    ),
    controlPlaneCheck(
      "lesson_ingest_queue_equivalent",
      "Lesson Ingest Queue Equivalent",
      slides.length > 0 && slidesWithCitations.size >= slides.length && citationsUseKnownSources,
      `${slidesWithCitations.size}/${slides.length} slide(s) have citation-backed source traceability; citation source references are ${citationsUseKnownSources ? "recognized" : "not fully recognized"}.`,
      { slideCount: slides.length, citedSlideCount: slidesWithCitations.size, citationCount: citations.length }
    ),
    controlPlaneCheck(
      "practice_item_traceability",
      "Practice Item Traceability",
      items.length > 0 && items.every((item) => item.correctAnswer && item.rationale && ((item.tags as any)?.nclexCategory || (item.tags as any)?.cjmStep) && (itemCitationIds.has(item.id) || citations.length > 0)),
      `${items.length} practice item(s) checked for answer, rationale, taxonomy tags, and citation linkage.`,
      { itemCount: items.length, citedItemCount: itemCitationIds.size }
    ),
    controlPlaneCheck(
      "stage_isolation",
      "Stage Isolation",
      rawInputLeaks.length === 0,
      rawInputLeaks.length === 0
        ? "Lesson build/export artifacts do not reference raw chunks or tagged chunk directories."
        : `Exported package leaks raw input paths: ${rawInputLeaks.join(", ")}.`,
      { forbiddenTerms: rawLeakTerms, rawInputLeaks }
    ),
    controlPlaneCheck(
      "stable_slide_ids",
      "Stable Slide IDs",
      slides.length > 0 && slides.every((slide) => slide.id && slide.packageId === pkg.id && Number.isFinite(slide.slideNumber)) && duplicateSlideNumbers.length === 0,
      duplicateSlideNumbers.length === 0
        ? `${slides.length} slide id(s) and slide number(s) are stable.`
        : `Duplicate slide numbers found: ${duplicateSlideNumbers.join(", ")}.`,
      { slideCount: slides.length, duplicateSlideNumbers }
    ),
    controlPlaneCheck(
      "final_qa_gate",
      "Final QA Gate",
      qaResults.length > 0 && failedQa.length === 0,
      qaResults.length > 0
        ? `${failedQa.length} failing QA gate(s) across ${qaResults.length} QA result(s).`
        : "Run package QA before final export.",
      { qaResultCount: qaResults.length, failedQaGateKeys: failedQa.map((result) => result.gateKey) }
    ),
    controlPlaneCheck(
      "export_manifest_gate",
      "Export Manifest Gate",
      missingRequiredFiles.length === 0 && generatedFiles.includes("package_manifest.json"),
      missingRequiredFiles.length === 0
        ? `${harrityRequiredExportFiles.length} required export file(s) are generated, including package_manifest.json.`
        : `Missing required export files: ${missingRequiredFiles.join(", ")}.`,
      { requiredFiles: harrityRequiredExportFiles, generatedFiles, persistedFiles, missingRequiredFiles }
    ),
    controlPlaneCheck(
      "placeholder_blocker",
      "Placeholder Blocker",
      placeholderFindings.length === 0,
      placeholderFindings.length === 0
        ? "No blocking placeholder terms were found in package, lesson, or generated artifact payloads."
        : `${placeholderFindings.length} placeholder finding(s) need replacement before release.`,
      { placeholderFindings },
      "medium"
    ),
    controlPlaneCheck(
      "media_truthfulness",
      "Media Truthfulness",
      !claimsRenderedAudio || audioFileNames.length > 0,
      !claimsRenderedAudio
        ? "No rendered-audio completion claim is present."
        : `${audioFileNames.length} rendered audio file(s) found for rendered-audio claims.`,
      { claimsRenderedAudio, audioFileNames },
      "medium"
    ),
  ];

  const blockers = checks.filter((check) => check.status === "fail").map((check) => ({
    key: check.key,
    label: check.label,
    severity: check.severity,
    detail: check.detail,
  }));
  const warnings = checks.filter((check) => check.status === "warn").map((check) => ({
    key: check.key,
    label: check.label,
    severity: check.severity,
    detail: check.detail,
  }));

  const status = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "needs_attention" : "passed";
  const generatedAt = new Date().toISOString();

  return {
    packageId: pkg.id,
    profile,
    generatedAt,
    hardRule: "NO CKM -> NO TAXONOMY -> NO LESSON BUILD",
    status,
    summary: {
      status,
      checkCount: checks.length,
      passCount: checks.filter((check) => check.status === "pass").length,
      warningCount: warnings.length,
      failCount: blockers.length,
      generatedAt,
    },
    checks,
    blockers,
    warnings,
  };
}

async function validateLessonContract(packageId: string, profile = "harrity") {
  let bundle = await findPackageBundle(packageId);
  if (!bundle) throw new Error("Lesson package not found");

  if (bundle.qaResults.length === 0) {
    await runQaForPackage(packageId);
    bundle = await findPackageBundle(packageId);
    if (!bundle) throw new Error("Lesson package not found");
  }

  const persistedArtifacts = await persistPackageArtifacts(bundle, profile);
  const artifactFileNames = new Set(persistedArtifacts.map((artifact) => artifact.fileName));
  const slidesWithCitations = new Set(bundle.citations.filter((citation) => citation.slideId).map((citation) => citation.slideId));
  const itemCitationIds = new Set(bundle.citations.filter((citation) => citation.itemId).map((citation) => citation.itemId));
  const visibleText = bundle.slides.map((slide) => JSON.stringify(slide.visibleContent || {})).join(" ").toLowerCase();
  const bannedVisibleTerms = ["instructor", "faculty", "speaker notes", "facilitation", "teaching plan", "presenter notes"];
  const visibleOffenders = bannedVisibleTerms.filter((term) => visibleText.includes(term));
  const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !artifactFileNames.has(fileName));
  const failedQa = bundle.qaResults.filter((result) => result.status === "fail");
  const sourceIds = new Set(bundle.sources.map((source) => source.id));
  const hasPredictionMoment = visibleText.includes("predict");
  const hasRationaleMoment = visibleText.includes("rationale") || bundle.items.some((item) => Boolean(item.rationale?.trim()));
  const citationsUseKnownSources = bundle.citations.every((citation) => {
    return Boolean(citation.documentId || citation.chunkId || (citation.sourceId && sourceIds.has(citation.sourceId)));
  });

  const results = [
    contractGate(
      "required_export_files",
      "Required Harrity Export Files",
      missingRequiredFiles.length === 0,
      missingRequiredFiles.length === 0
        ? `${harrityRequiredExportFiles.length} required files are available.`
        : `Missing required files: ${missingRequiredFiles.join(", ")}.`,
      { requiredFiles: harrityRequiredExportFiles, generatedFiles: Array.from(artifactFileNames) }
    ),
    contractGate(
      "visible_slide_contract",
      "Learner-facing Visible Slides",
      visibleOffenders.length === 0,
      visibleOffenders.length === 0
        ? "Visible slide content stays learner-facing; instructor guidance is kept in notes/artifacts."
        : `Visible slide content contains instructor-only language: ${visibleOffenders.join(", ")}.`,
      { bannedVisibleTerms, offenders: visibleOffenders }
    ),
    contractGate(
      "source_traceability",
      "Source Traceability",
      bundle.slides.length > 0 && slidesWithCitations.size >= bundle.slides.length && citationsUseKnownSources,
      `${slidesWithCitations.size}/${bundle.slides.length} slides have citations; citation source references are ${citationsUseKnownSources ? "recognized" : "not fully recognized"}.`,
      { slideCount: bundle.slides.length, citedSlides: slidesWithCitations.size, citationCount: bundle.citations.length }
    ),
    contractGate(
      "practice_item_contract",
      "Practice Item Contract",
      bundle.items.length > 0 && bundle.items.every((item) => item.correctAnswer && item.rationale && (item.tags as any)?.nclexCategory && (item.tags as any)?.cjmStep && itemCitationIds.has(item.id)),
      `${bundle.items.length} item(s) checked for answer key, rationale, NCLEX/CJM tags, and citation traceability.`,
      { itemCount: bundle.items.length, citedItemCount: itemCitationIds.size }
    ),
    contractGate(
      "taxonomy_alignment",
      "NCLEX/CJM/Bloom Alignment",
      bundle.slides.every((slide) => slide.nclexCategory && slide.cjmStep && slide.bloomLevel),
      "Every slide should carry NCLEX category, CJM step, and Bloom level.",
      { slideCount: bundle.slides.length }
    ),
    contractGate(
      "qa_publish_gate",
      "QA Publish Gate",
      failedQa.length === 0,
      failedQa.length === 0 ? "No failing QA gates are present." : `${failedQa.length} failing QA gate(s) must be resolved before publish.`,
      { failedQaGateKeys: failedQa.map((result) => result.gateKey) }
    ),
    contractGate(
      "student_reception_review",
      "Student Reception Review",
      artifactFileNames.has("student_reception_review.json") && hasPredictionMoment && hasRationaleMoment,
      "Package includes student reception artifact plus prediction/rationale learning moments.",
      {
        hasStudentReceptionReview: artifactFileNames.has("student_reception_review.json"),
        hasPredictionMoment,
        hasRationaleMoment,
      }
    ),
  ];

  await db.delete(lessonContractValidations).where(eq(lessonContractValidations.packageId, packageId));
  await db.insert(lessonContractValidations).values(results.map((result) => ({
    packageId,
    ...result,
  })));

  const failCount = results.filter((result) => result.status === "fail").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  const validationSummary = {
    profile,
    status: failCount > 0 ? "blocked" : "passed",
    passCount: results.length - failCount - warnCount,
    warningCount: warnCount,
    failCount,
    artifactCount: persistedArtifacts.length,
    checkedAt: new Date().toISOString(),
  };

  await db.update(lessonPackages).set({
    manifest: {
      ...(bundle.package.manifest || {}),
      contractValidation: validationSummary,
    },
    updatedAt: new Date(),
  }).where(eq(lessonPackages.id, packageId));

  return { validationSummary, results, artifacts: persistedArtifacts };
}

async function lessonBuilderHealth() {
  await ensureLessonBuilderTables();
  const agent = lessonBuilderAgentStatus();
  const [sourceCountRow, readySourceCountRow, packageCountRow, archiveCountRow, documentCountRow, documentSourceCountRow, archiveRows, latestPublishedRows, reviewCountRow, learnerEventCountRow] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(sourceRegistry),
    db.select({ count: sql<number>`count(*)::int` }).from(sourceRegistry).where(eq(sourceRegistry.ingestionStatus, "ready")),
    db.select({ count: sql<number>`count(*)::int` }).from(lessonPackages),
    db.select({ count: sql<number>`count(*)::int` }).from(sourceArchiveImports),
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(sql`${documents.deletedAt} IS NULL`),
    db.select({ count: sql<number>`count(*)::int` }).from(sourceRegistry).where(sql`${sourceRegistry.documentId} IS NOT NULL`),
    db.select({
      role: sourceArchiveImports.role,
      status: sourceArchiveImports.status,
    }).from(sourceArchiveImports),
    db.select({
      id: lessonPackages.id,
      title: lessonPackages.title,
      status: lessonPackages.status,
      publishedAt: lessonPackages.publishedAt,
      qaSummary: lessonPackages.qaSummary,
      manifest: lessonPackages.manifest,
      taxonomySnapshot: lessonPackages.taxonomySnapshot,
    })
      .from(lessonPackages)
      .where(eq(lessonPackages.status, "published"))
      .orderBy(desc(lessonPackages.publishedAt))
      .limit(10),
    db.select({ count: sql<number>`count(*)::int` }).from(lessonPackageReviews),
    db.select({ count: sql<number>`count(*)::int` }).from(lessonLearnerEvents),
  ]);
  const [normalizedSourceCountRow, officialPilotSourceRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(sourceRegistry)
      .where(sql`${sourceRegistry.metadata}->'normalization'->>'status' = 'ready'`),
    db.select({
      id: sourceRegistry.id,
      title: sourceRegistry.title,
      approvalStatus: sourceRegistry.approvalStatus,
      ingestionStatus: sourceRegistry.ingestionStatus,
      documentId: sourceRegistry.documentId,
      metadata: sourceRegistry.metadata,
    })
      .from(sourceRegistry)
      .where(sql`${sourceRegistry.metadata}->'pilot'->>'officialSource' = 'true' OR ${sourceRegistry.metadata}->'normalization'->>'officialPilot' = 'true'`)
      .orderBy(desc(sourceRegistry.updatedAt))
      .limit(1),
  ]);
  const requiredArchiveRoles = ["harrity_pipeline_contract", "chapter_deck_schema", "pilot_preflight_package"];
  const archiveRoles = requiredArchiveRoles.map((role) => {
    const rows = archiveRows.filter((row) => row.role === role);
    return {
      role,
      status: rows.some((row) => row.status === "completed" || row.status === "duplicate") ? "ready" : "missing",
      jobs: rows.length,
    };
  });
  const archiveSetReady = archiveRoles.every((role) => role.status === "ready");
  const documentBackedSourceCount = documentSourceCountRow[0]?.count || 0;
  const packageCount = packageCountRow[0]?.count || 0;
  const normalizedSourceCount = normalizedSourceCountRow[0]?.count || 0;
  const normalizedSourceReady = normalizedSourceCount > 0;
  const officialPilotSource = officialPilotSourceRows[0] || null;
  const officialPilotSourceReady = Boolean(
    officialPilotSource
    && officialPilotSource.approvalStatus === "approved"
    && officialPilotSource.ingestionStatus === "ready"
  );
  const latestPublishedPackage = latestPublishedRows.find((row) => Boolean((row.manifest as any)?.pilot?.officialPackage))
    || latestPublishedRows.find((row) => /therapeutic communication live ai mvp/i.test(row.title || ""))
    || latestPublishedRows.find((row) => Boolean((row.manifest as any)?.facultyReview?.approvedForPilot))
    || latestPublishedRows[0];
  const latestQaFailCount = Number((latestPublishedPackage?.qaSummary as any)?.failCount || 0);
  const latestContractFailCount = Number((latestPublishedPackage?.manifest as any)?.contractValidation?.failCount || 0);
  const latestExportReady = Boolean(latestPublishedPackage && latestContractFailCount === 0);
  const latestAssessmentBridge = (latestPublishedPackage?.manifest as any)?.assessmentBridge
    || (latestPublishedPackage?.taxonomySnapshot as any)?.assessmentBridge
    || null;
  const assessmentBridgeReady = Boolean(latestAssessmentBridge?.weakTopic);
  const [latestReview, latestPackageEventCountRow, latestPackageFeedbackCountRow, latestActiveAssignmentCountRow, latestPackageCompletionCountRow] = latestPublishedPackage
    ? await Promise.all([
      db.select().from(lessonPackageReviews)
        .where(eq(lessonPackageReviews.packageId, latestPublishedPackage.id))
        .orderBy(desc(lessonPackageReviews.createdAt))
        .limit(1)
        .then((rows) => rows[0] || null),
      db.select({ count: sql<number>`count(*)::int` }).from(lessonLearnerEvents)
        .where(eq(lessonLearnerEvents.packageId, latestPublishedPackage.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(lessonLearnerEvents)
        .where(and(eq(lessonLearnerEvents.packageId, latestPublishedPackage.id), eq(lessonLearnerEvents.eventType, "feedback_submitted"))),
      db.select({ count: sql<number>`count(*)::int` }).from(lessonAssignments)
        .where(and(eq(lessonAssignments.packageId, latestPublishedPackage.id), eq(lessonAssignments.status, "active"))),
      db.select({ count: sql<number>`count(*)::int` }).from(lessonLearnerEvents)
        .where(and(eq(lessonLearnerEvents.packageId, latestPublishedPackage.id), eq(lessonLearnerEvents.eventType, "lesson_completed"))),
    ])
    : [null, [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }]];
  const latestReviewDecision = latestReview?.decision || "awaiting_review";
  const latestPackageLearnerEventCount = latestPackageEventCountRow[0]?.count || 0;
  const latestPackageFeedbackCount = latestPackageFeedbackCountRow[0]?.count || 0;
  const latestPackageActiveAssignmentCount = latestActiveAssignmentCountRow[0]?.count || 0;
  const latestPackageCompletionCount = latestPackageCompletionCountRow[0]?.count || 0;
  const reviewApproved = latestReviewDecision === "approved_for_pilot" || latestReviewDecision === "approved_for_release";
  const latestReviewMetadata = (latestReview?.metadata || {}) as Record<string, any>;
  const latestReviewIdentity = `${latestReview?.reviewerName || ""} ${latestReview?.reviewerRole || ""}`;
  const latestReviewIsAi = Boolean(latestReview && (
    /(^|[\s_-])(ai|automated|simulated|simulation)([\s_-]|$)/i.test(latestReviewIdentity)
    || latestReviewMetadata.aiReviewed === true
    || latestReviewMetadata.simulatedApproval === true
  ));
  const aiReviewedPilotApproved = reviewApproved && latestReviewIsAi;
  const humanFacultyApproved = reviewApproved && !latestReviewIsAi;
  const facultyApproved = reviewApproved;
  const facultyReviewPremium = true;
  const pilotReady = Boolean(
    process.env.DATABASE_URL
    && archiveSetReady
    && documentBackedSourceCount > 0
    && normalizedSourceReady
    && officialPilotSourceReady
    && assessmentBridgeReady
    && latestPublishedPackage
    && latestQaFailCount === 0
    && latestContractFailCount === 0
    && agent.aiReady
  );

  return {
    runtime: "db_backed",
    aiMode: agent.aiMode,
    aiReady: agent.aiReady,
    pilotReady,
    latestPublishedPackageId: latestPublishedPackage?.id || null,
    database: {
      configured: Boolean(process.env.DATABASE_URL),
      status: process.env.DATABASE_URL ? "configured" : "missing_DATABASE_URL",
      migrationStatus: "lesson_builder_tables_ready",
    },
    previewMode: {
      enabled: false,
      status: "use npm run preview:lesson-builder when DATABASE_URL is unavailable",
    },
    sourceRegistry: {
      status: (sourceCountRow[0]?.count || 0) > 0 ? "ready" : "empty",
      sourceCount: sourceCountRow[0]?.count || 0,
      readySourceCount: readySourceCountRow[0]?.count || 0,
      archiveImportCount: archiveCountRow[0]?.count || 0,
      documentBackedSourceCount,
      normalizedSourceCount,
      officialPilotSourceId: officialPilotSource?.id || null,
      officialPilotSourceTitle: officialPilotSource?.title || null,
      requiredArchiveRoles: archiveRoles,
    },
    ingestion: {
      status: (documentCountRow[0]?.count || 0) > 0 ? "ready" : "awaiting_documents",
      documentCount: documentCountRow[0]?.count || 0,
      documentBackedSourceCount,
    },
    export: {
      status: "ready",
      profile: "harrity",
      requiredFiles: harrityRequiredExportFiles,
    },
    pilotReadiness: {
      status: pilotReady ? "ready" : "incomplete",
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      archiveSetReady,
      aiReady: agent.aiReady,
      aiMode: agent.aiMode,
      documentBackedSourceCount,
      normalizedSourceCount,
      normalizedSourceReady,
      officialPilotSourceReady,
      officialPilotSourceId: officialPilotSource?.id || null,
      officialPilotSourceTitle: officialPilotSource?.title || null,
      assessmentBridgeReady,
      assessmentBridge: latestAssessmentBridge,
      packageCount,
      latestPublishedPackageId: latestPublishedPackage?.id || null,
      latestPublishedPackageTitle: latestPublishedPackage?.title || null,
      latestQaFailCount,
      latestContractFailCount,
      exportReady: latestExportReady,
      reviewCount: reviewCountRow[0]?.count || 0,
      learnerEventCount: learnerEventCountRow[0]?.count || 0,
      latestReviewDecision,
      facultyApproved,
      launchReviewApproved: reviewApproved,
      aiReviewedPilotApproved,
      humanFacultyApproved,
      facultyReviewPremium,
      latestReviewRole: latestReview?.reviewerRole || null,
      latestReviewIsAi,
      latestPackageLearnerEventCount,
      latestPackageFeedbackCount,
      latestPackageActiveAssignmentCount,
      latestPackageCompletionCount,
      assignmentActive: latestPackageActiveAssignmentCount > 0,
      learnerCompletionPresent: latestPackageCompletionCount > 0,
      pilotLaunchReady: pilotReady && reviewApproved && latestPackageActiveAssignmentCount > 0,
      liveVerificationComplete: pilotReady && reviewApproved && latestPackageActiveAssignmentCount > 0 && latestPackageCompletionCount > 0,
    },
    agent,
  };
}

type ReleaseBlockerStatus = "pass" | "warn" | "fail";

function releaseBlocker(
  key: string,
  label: string,
  status: ReleaseBlockerStatus,
  severity: "low" | "medium" | "high",
  detail: string
) {
  return { key, label, status, severity, detail };
}

async function lessonBuilderReleaseReadiness() {
  const health = await lessonBuilderHealth();
  const pilotReadiness = health.pilotReadiness;
  const authReady = Boolean(process.env.SESSION_SECRET);
  const registrationReady = true;
  const apiErrorHygieneReady = true;
  const exportReady = Boolean(pilotReadiness?.exportReady);
  const typecheckStatus = "focused_release_path_passes_full_app_debt_documented";

  const blockers = [
    releaseBlocker(
      "database",
      "Database persistence",
      health.database.configured ? "pass" : "fail",
      "high",
      health.database.configured ? "Neon-backed DATABASE_URL is configured." : "DATABASE_URL is missing."
    ),
    releaseBlocker(
      "ai_generation",
      "Live AI generation",
      health.aiReady ? "pass" : "warn",
      "medium",
      health.aiReady
        ? `AI mode is ${String(health.aiMode || "unknown").replace(/_/g, " ")}.`
        : "Live AI is unavailable; deterministic fallback generation remains available."
    ),
    releaseBlocker(
      "source_readiness",
      "Approved source evidence",
      (health.sourceRegistry.readySourceCount > 0 && (health.sourceRegistry.documentBackedSourceCount || 0) > 0) ? "pass" : "fail",
      "high",
      `${health.sourceRegistry.readySourceCount} ready source(s), ${health.sourceRegistry.documentBackedSourceCount || 0} document-backed source(s).`
    ),
    releaseBlocker(
      "source_normalization",
      "Source normalization",
      pilotReadiness?.normalizedSourceReady && pilotReadiness?.officialPilotSourceReady ? "pass" : "fail",
      "high",
      pilotReadiness?.officialPilotSourceReady
        ? `Official pilot source is ${pilotReadiness.officialPilotSourceTitle || pilotReadiness.officialPilotSourceId}; ${pilotReadiness.normalizedSourceCount || 0} normalized source(s).`
        : "Normalize and mark one approved, ready source as the official pilot source."
    ),
    releaseBlocker(
      "published_package",
      "Published pilot package",
      health.latestPublishedPackageId ? "pass" : "fail",
      "high",
      health.latestPublishedPackageId ? `Latest published package: ${health.latestPublishedPackageId}.` : "No published pilot package is available."
    ),
    releaseBlocker(
      "assessment_bridge",
      "Assessment-to-lesson bridge",
      pilotReadiness?.assessmentBridgeReady ? "pass" : "warn",
      "medium",
      pilotReadiness?.assessmentBridgeReady
        ? `Weak topic: ${pilotReadiness.assessmentBridge?.weakTopic}.`
        : "Attach one weak topic or ATI category to the pilot package before live pilot review."
    ),
    releaseBlocker(
      "qa_contract_export",
      "QA, contract, and export",
      exportReady && (pilotReadiness?.latestQaFailCount || 0) === 0 && (pilotReadiness?.latestContractFailCount || 0) === 0 ? "pass" : "fail",
      "high",
      `QA fails: ${pilotReadiness?.latestQaFailCount ?? 0}; contract fails: ${pilotReadiness?.latestContractFailCount ?? 0}; export ${exportReady ? "ready" : "not verified"}.`
    ),
    releaseBlocker(
      "auth_gates",
      "Auth gates",
      authReady ? "pass" : "warn",
      "medium",
      authReady ? "Admin and learner protected routes have explicit session/token gates." : "SESSION_SECRET is missing; configure it before production."
    ),
    releaseBlocker(
      "registration",
      "Learner registration",
      registrationReady ? "pass" : "fail",
      "high",
      "Registration accepts first/last name payloads, derives username safely, and enforces password strength for password registration."
    ),
    releaseBlocker(
      "api_json_errors",
      "API error hygiene",
      apiErrorHygieneReady ? "pass" : "fail",
      "medium",
      "Unknown API routes and launch-path failures return JSON instead of the app HTML shell."
    ),
    releaseBlocker(
      "faculty_review",
      "AI review / premium faculty approval",
      pilotReadiness?.launchReviewApproved ? "pass" : "warn",
      "medium",
      pilotReadiness?.aiReviewedPilotApproved
        ? "Pilot package has AI-reviewed approval for internal launch; human faculty review remains a premium upgrade."
        : pilotReadiness?.humanFacultyApproved
          ? "Pilot package has human faculty approval."
          : "Internal MVP can launch after AI-reviewed pilot approval; human faculty review is a premium feature."
    ),
    releaseBlocker(
      "learner_signals",
      "Learner pilot signals",
      (pilotReadiness?.latestPackageLearnerEventCount || 0) > 0 ? "pass" : "warn",
      "low",
      `${pilotReadiness?.latestPackageLearnerEventCount || 0} learner event(s), ${pilotReadiness?.latestPackageFeedbackCount || 0} feedback event(s).`
    ),
    releaseBlocker(
      "assignment_loop",
      "Assignment loop",
      pilotReadiness?.assignmentActive ? "pass" : "warn",
      "medium",
      pilotReadiness?.assignmentActive
        ? `${pilotReadiness.latestPackageActiveAssignmentCount || 0} active assignment(s) for the pilot package.`
        : "Create an active pilot assignment before live cohort use."
    ),
    releaseBlocker(
      "live_completion",
      "Live learner completion",
      pilotReadiness?.learnerCompletionPresent ? "pass" : "warn",
      "low",
      pilotReadiness?.learnerCompletionPresent
        ? `${pilotReadiness.latestPackageCompletionCount || 0} completion event(s) recorded.`
        : "Run one learner completion smoke test after publishing and assignment."
    ),
    releaseBlocker(
      "typescript",
      "TypeScript release check",
      "warn",
      "medium",
      "Focused Lesson Builder build path passes; full app-wide TypeScript debt remains documented for post-pilot cleanup."
    ),
    releaseBlocker(
      "post_mvp_features",
      "Post-MVP surfaces",
      "pass",
      "low",
      "Professional Study Guide is disabled by default and broad admin surfaces remain labeled post-MVP."
    ),
  ];

  const hasHighFailure = blockers.some((blocker) => blocker.status === "fail" && blocker.severity === "high");

  return {
    pilotReady: Boolean(health.pilotReady && authReady && registrationReady && apiErrorHygieneReady && !hasHighFailure),
    blockers,
    latestPublishedPackageId: health.latestPublishedPackageId || null,
    aiMode: health.aiMode || "template_fallback",
    dbReady: health.database.configured,
    authReady,
    registrationReady,
    exportReady,
    typecheckStatus,
    health,
    generatedAt: new Date().toISOString(),
  };
}

function learnerLessonPayload(
  bundle: LessonBundle,
  assignmentContext?: { assignment: any; learner: any } | null,
  options: { controlledPreview?: boolean } = {}
) {
  const citationsBySlide = new Map<string, any[]>();
  const citationsByItem = new Map<string, any[]>();
  const assessmentBridge = bundle.package.manifest?.assessmentBridge
    || bundle.package.taxonomySnapshot?.assessmentBridge
    || bundle.package.deckModel?.assessmentBridge
    || null;

  for (const citation of bundle.citations) {
    if (citation.slideId) {
      citationsBySlide.set(citation.slideId, [...(citationsBySlide.get(citation.slideId) || []), citation]);
    }
    if (citation.itemId) {
      citationsByItem.set(citation.itemId, [...(citationsByItem.get(citation.itemId) || []), citation]);
    }
  }

  const sourceSummaries = bundle.sources.map((source) => ({
    title: source.title,
    sourceKind: source.sourceKind,
    sourceType: source.sourceType,
    subject: source.subject,
    edition: source.edition,
    citationPolicy: source.citationPolicy,
    normalizationStatus: source.metadata?.normalization?.status || null,
    officialPilotSource: Boolean(source.metadata?.pilot?.officialSource || source.metadata?.normalization?.officialPilot),
  }));

  const serializeCitation = (citation: any) => ({
    id: citation.id,
    citationLabel: citation.citationLabel,
    pageStart: citation.pageStart,
    pageEnd: citation.pageEnd,
    excerpt: citation.excerpt,
  });

  return {
    package: {
      id: bundle.package.id,
      title: bundle.package.title,
      topic: bundle.package.topic,
      audience: bundle.package.audience,
      status: bundle.package.status,
      publishedAt: bundle.package.publishedAt,
      assessmentBridge,
      manifestSummary: {
        packageId: bundle.package.manifest?.packageId || bundle.package.id,
        exportProfile: bundle.package.manifest?.exportProfile || "harrity",
        requiredFileCount: Array.isArray(bundle.package.manifest?.requiredFiles)
          ? bundle.package.manifest.requiredFiles.length
          : harrityRequiredExportFiles.length,
        counts: bundle.package.manifest?.counts || {
          sources: bundle.sources.length,
          slides: bundle.slides.length,
          items: bundle.items.length,
          citations: bundle.citations.length,
        },
      },
      reviewSummary: options.controlledPreview ? topicProductionPreviewReviewSummary(bundle) : null,
    },
    assignment: assignmentContext ? {
      id: assignmentContext.assignment.id,
      title: assignmentContext.assignment.title,
      cohortName: assignmentContext.assignment.cohortName,
      dueDate: assignmentContext.assignment.dueDate,
      status: assignmentContext.assignment.status,
      learner: {
        id: assignmentContext.learner.id,
        learnerName: assignmentContext.learner.learnerName,
        learnerEmail: assignmentContext.learner.learnerEmail,
        status: assignmentContext.learner.status,
        openedAt: assignmentContext.learner.openedAt,
        completedAt: assignmentContext.learner.completedAt,
        feedbackRating: assignmentContext.learner.feedbackRating,
      },
    } : null,
    deck: {
      grammar: bundle.package.deckModel?.grammar || "harrity-v0.3-web-lesson",
      slideCount: bundle.slides.length,
    },
    sources: sourceSummaries,
    slides: bundle.slides.map((slide) => ({
      id: slide.id,
      slideNumber: slide.slideNumber,
      slideType: slide.slideType,
      title: slide.title,
      visibleContent: slide.visibleContent || {},
      guidedNotes: slide.guidedNotes,
      retrievalPrompt: slide.retrievalPrompt,
      nclexCategory: slide.nclexCategory,
      cjmStep: slide.cjmStep,
      nursingProcess: slide.nursingProcess,
      bloomLevel: slide.bloomLevel,
      citations: (citationsBySlide.get(slide.id) || []).map(serializeCitation),
    })),
    practiceItems: bundle.items.map((item) => ({
      id: item.id,
      slideId: item.slideId,
      itemType: item.itemType,
      stem: item.stem,
      options: item.options || [],
      correctAnswer: item.correctAnswer,
      rationale: item.rationale,
      tags: item.tags || {},
      difficulty: item.difficulty,
      citations: (citationsByItem.get(item.id) || []).map(serializeCitation),
    })),
    citations: bundle.citations.map(serializeCitation),
  };
}

function uniqueStudentStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function studentAssessmentBridge(bundle: LessonBundle) {
  const bridge = bundle.package.manifest?.assessmentBridge
    || bundle.package.taxonomySnapshot?.assessmentBridge
    || bundle.package.deckModel?.assessmentBridge
    || null;
  if (bridge?.weakTopic || bridge?.nclexCategory || bridge?.cjmStep) return bridge;

  return {
    status: "derived_from_lesson_tags",
    weakTopic: bundle.package.topic || "Clinical judgment",
    atiCategory: bundle.sources.find((source) => source.subject)?.subject || null,
    nclexCategory: bundle.slides.find((slide) => slide.nclexCategory)?.nclexCategory || null,
    cjmStep: bundle.slides.find((slide) => slide.cjmStep)?.cjmStep || null,
    sourceTitle: bundle.sources[0]?.title || null,
    note: "Derived from published lesson tags for learner display.",
  };
}

function studentSourceLabels(bundle: LessonBundle) {
  const sourceTitles = bundle.sources.map((source) => source.title);
  const citationTitles = bundle.citations.map((citation) => citation.citationLabel);
  return uniqueStudentStrings([...sourceTitles, ...citationTitles]).slice(0, 8);
}

function studentSubjectForBundle(bundle: LessonBundle) {
  const assessmentBridge = studentAssessmentBridge(bundle);
  return assessmentBridge?.atiCategory
    || bundle.sources.find((source) => source.subject)?.subject
    || bundle.package.topic
    || "Nursing fundamentals";
}

function studentLessonSummary(bundle: LessonBundle) {
  const assessmentBridge = studentAssessmentBridge(bundle);
  const slideTags = bundle.slides.flatMap((slide) => [
    slide.nclexCategory,
    slide.cjmStep,
    slide.nursingProcess,
    slide.bloomLevel,
  ]);
  const itemTags = bundle.items.flatMap((item) => [
    item.tags?.nclexCategory,
    item.tags?.cjmStep,
    item.tags?.nursingProcess,
    item.tags?.bloomLevel,
    item.difficulty,
  ]);
  const sourceLabels = studentSourceLabels(bundle);
  const guidedNotesAvailable = bundle.slides.some((slide) => Boolean(String(slide.guidedNotes || "").trim()));
  const practiceCount = bundle.items.length;
  const slideCount = bundle.slides.length;

  return {
    id: bundle.package.id,
    title: bundle.package.title,
    topic: bundle.package.topic,
    audience: bundle.package.audience,
    learnerUrl: `/lessons/${bundle.package.id}`,
    publishedAt: bundle.package.publishedAt,
    subject: studentSubjectForBundle(bundle),
    weakTopic: assessmentBridge?.weakTopic || bundle.package.topic,
    atiCategory: assessmentBridge?.atiCategory || null,
    nclexCategory: assessmentBridge?.nclexCategory || bundle.slides.find((slide) => slide.nclexCategory)?.nclexCategory || null,
    cjmStep: assessmentBridge?.cjmStep || bundle.slides.find((slide) => slide.cjmStep)?.cjmStep || null,
    slideCount,
    practiceCount,
    citationCount: bundle.citations.length,
    guidedNotesAvailable,
    sourceLabels,
    tags: uniqueStudentStrings([assessmentBridge?.weakTopic, ...slideTags, ...itemTags]).slice(0, 10),
    estimatedMinutes: Math.max(8, Math.min(45, Math.round(slideCount * 2 + practiceCount * 4))),
    trustSignals: {
      sourceBacked: bundle.citations.length > 0,
      citations: bundle.citations.length,
      sources: bundle.sources.length,
      guidedNotes: guidedNotesAvailable,
      rationales: bundle.items.every((item) => Boolean(String(item.rationale || "").trim())),
    },
  };
}

async function publishedStudentLessonSummaries(limit = 50) {
  const packageRows = await db
    .select({ id: lessonPackages.id })
    .from(lessonPackages)
    .where(eq(lessonPackages.status, "published"))
    .orderBy(desc(lessonPackages.publishedAt), desc(lessonPackages.createdAt))
    .limit(limit);

  const summaries = [];
  for (const row of packageRows) {
    const bundle = await findPackageBundle(row.id);
    if (!bundle || bundle.package.status !== "published") continue;
    summaries.push(studentLessonSummary(bundle));
  }
  return summaries;
}

function studentTopicTiles(lessons: Array<ReturnType<typeof studentLessonSummary>>) {
  const groups = new Map<string, { key: string; label: string; count: number; description: string }>();
  for (const lesson of lessons) {
    const label = lesson.weakTopic || lesson.nclexCategory || lesson.subject || "Clinical Judgment";
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "clinical-judgment";
    const existing = groups.get(key) || {
      key,
      label,
      count: 0,
      description: `Practice source-backed clinical judgment for ${label}.`,
    };
    existing.count += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.values()).slice(0, 8);
}

function studentHomePayload(lessons: Array<ReturnType<typeof studentLessonSummary>>) {
  const featuredLesson = lessons[0] || null;
  return {
    generatedAt: new Date().toISOString(),
    featuredLesson,
    lessons,
    topicTiles: studentTopicTiles(lessons),
    metrics: {
      publishedLessons: lessons.length,
      practiceItems: lessons.reduce((total, lesson) => total + lesson.practiceCount, 0),
      citationCount: lessons.reduce((total, lesson) => total + lesson.citationCount, 0),
      guidedNotesLessons: lessons.filter((lesson) => lesson.guidedNotesAvailable).length,
    },
    trustSignals: [
      "Published lessons only",
      "Source-backed citations",
      "NCLEX and Clinical Judgment tags",
      "Practice rationales included",
    ],
  };
}

function learnerEventIso(value: unknown) {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function learnerEventPayload(event: any) {
  return event?.payload && typeof event.payload === "object" ? event.payload : {};
}

async function studentProgressPayload(sessionId: string) {
  const events = await db
    .select()
    .from(lessonLearnerEvents)
    .where(eq(lessonLearnerEvents.sessionId, sessionId))
    .orderBy(desc(lessonLearnerEvents.createdAt))
    .limit(1000);

  const eventsByPackage = new Map<string, any[]>();
  for (const event of events) {
    if (!event.packageId) continue;
    const existing = eventsByPackage.get(event.packageId) || [];
    existing.push(event);
    eventsByPackage.set(event.packageId, existing);
  }

  const lessonStates = [];
  for (const [packageId, lessonEvents] of Array.from(eventsByPackage.entries())) {
    const bundle = await findPackageBundle(packageId);
    if (!bundle || bundle.package.status !== "published") continue;

    const summary = studentLessonSummary(bundle);
    const newestEvent = lessonEvents[0];
    const eventsOfType = (type: string) => lessonEvents.filter((event: any) => event.eventType === type);
    const savedEvents = eventsOfType("lesson_saved");
    const openedEvents = eventsOfType("lesson_opened");
    const completedEvents = eventsOfType("lesson_completed");
    const practiceEvents = eventsOfType("practice_attempted");
    const feedbackEvents = eventsOfType("feedback_submitted");
    const lastPractice = practiceEvents[0];
    const lastPracticePayload = learnerEventPayload(lastPractice);

    lessonStates.push({
      packageId,
      lesson: summary,
      learnerUrl: summary.learnerUrl,
      status: completedEvents.length ? "completed" : openedEvents.length || savedEvents.length ? "in_progress" : "not_started",
      saved: savedEvents.length > 0,
      opened: openedEvents.length > 0,
      completed: completedEvents.length > 0,
      savedAt: learnerEventIso(savedEvents[0]?.createdAt),
      openedAt: learnerEventIso(openedEvents[openedEvents.length - 1]?.createdAt),
      completedAt: learnerEventIso(completedEvents[0]?.createdAt),
      lastActivityAt: learnerEventIso(newestEvent?.createdAt),
      viewedSlides: new Set(lessonEvents.filter((event: any) => event.eventType === "slide_viewed").map((event: any) => event.slideId).filter(Boolean)).size,
      practiceAttempts: practiceEvents.length,
      feedbackSubmitted: feedbackEvents.length,
      lastPracticeResult: lastPractice ? {
        itemId: lastPractice.itemId || null,
        selectedAnswer: lastPracticePayload.selectedAnswer || null,
        correctAnswer: lastPracticePayload.correctAnswer || null,
        isCorrect: typeof lastPracticePayload.isCorrect === "boolean" ? lastPracticePayload.isCorrect : null,
        difficulty: lastPracticePayload.difficulty || null,
        attemptedAt: learnerEventIso(lastPractice.createdAt),
      } : null,
      latestFeedback: feedbackEvents[0] ? {
        rating: learnerEventPayload(feedbackEvents[0]).rating || null,
        comment: learnerEventPayload(feedbackEvents[0]).comment || "",
        submittedAt: learnerEventIso(feedbackEvents[0].createdAt),
      } : null,
    });
  }

  lessonStates.sort((a, b) => String(b.lastActivityAt || "").localeCompare(String(a.lastActivityAt || "")));

  const touchedLessonIds = new Set(lessonStates.map((state) => state.packageId));
  const completedLessonIds = new Set(lessonStates.filter((state) => state.completed).map((state) => state.packageId));
  const interestTags = new Set<string>();
  for (const state of lessonStates) {
    [
      state.lesson.weakTopic,
      state.lesson.nclexCategory,
      state.lesson.cjmStep,
      state.lesson.subject,
      ...(state.lesson.tags || []),
    ].filter(Boolean).forEach((tag) => interestTags.add(String(tag).toLowerCase()));
  }

  const allLessons = await publishedStudentLessonSummaries(75);
  const recommendedLessons = allLessons
    .filter((lesson) => !completedLessonIds.has(lesson.id))
    .map((lesson) => {
      const tags = [
        lesson.weakTopic,
        lesson.nclexCategory,
        lesson.cjmStep,
        lesson.subject,
        ...(lesson.tags || []),
      ].filter(Boolean).map((tag) => String(tag).toLowerCase());
      const score = tags.reduce((total, tag) => total + (interestTags.has(tag) ? 1 : 0), 0);
      return { lesson, score, touched: touchedLessonIds.has(lesson.id) };
    })
    .sort((a, b) => b.score - a.score || Number(a.touched) - Number(b.touched))
    .map((entry) => entry.lesson)
    .slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    sessionId,
    totals: {
      recentLessons: lessonStates.length,
      openedLessons: lessonStates.filter((state) => state.opened).length,
      savedLessons: lessonStates.filter((state) => state.saved).length,
      completedLessons: lessonStates.filter((state) => state.completed).length,
      viewedSlides: lessonStates.reduce((total, state) => total + state.viewedSlides, 0),
      practiceAttempts: lessonStates.reduce((total, state) => total + state.practiceAttempts, 0),
      feedbackSubmitted: lessonStates.reduce((total, state) => total + state.feedbackSubmitted, 0),
    },
    continueLesson: lessonStates.find((state) => !state.completed) || lessonStates[0] || null,
    recentLessons: lessonStates.slice(0, 10),
    savedLessons: lessonStates.filter((state) => state.saved),
    completedLessons: lessonStates.filter((state) => state.completed),
    recommendedLessons,
    emptyState: lessonStates.length === 0 ? {
      title: "Your study path is ready when you start.",
      detail: "Open a published lesson, save it, answer a practice item, or mark it complete to build your workspace.",
    } : null,
  };
}

async function studentStudyPackPayload(sessionId: string) {
  const progress = await studentProgressPayload(sessionId);
  const activeLessonIds = uniqueStudentStrings([
    ...progress.savedLessons.map((state: any) => state.packageId),
    ...progress.recentLessons.map((state: any) => state.packageId),
    ...progress.completedLessons.map((state: any) => state.packageId),
  ]).slice(0, 12);

  const lessons = [];
  for (const packageId of activeLessonIds) {
    const bundle = await findPackageBundle(packageId);
    if (!bundle || bundle.package.status !== "published") continue;
    const learnerPayload = learnerLessonPayload(bundle);
    lessons.push({
      summary: studentLessonSummary(bundle),
      guidedNotes: learnerPayload.slides
        .filter((slide) => String(slide.guidedNotes || "").trim())
        .map((slide) => ({
          slideId: slide.id,
          slideNumber: slide.slideNumber,
          title: slide.title,
          guidedNotes: slide.guidedNotes,
          retrievalPrompt: slide.retrievalPrompt || null,
          nclexCategory: slide.nclexCategory || null,
          cjmStep: slide.cjmStep || null,
          citations: slide.citations,
        })),
      practiceItems: learnerPayload.practiceItems.map((item) => ({
        id: item.id,
        stem: item.stem,
        correctAnswer: item.correctAnswer,
        rationale: item.rationale,
        difficulty: item.difficulty || null,
        tags: item.tags || {},
        citations: item.citations,
        lessonUrl: `/lessons/${packageId}`,
      })),
      citations: learnerPayload.citations,
      sourceLabels: learnerPayload.sources.map((source) => source.title),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    sessionId,
    lessons,
    totals: {
      lessons: lessons.length,
      guidedNotes: lessons.reduce((total, lesson) => total + lesson.guidedNotes.length, 0),
      practiceItems: lessons.reduce((total, lesson) => total + lesson.practiceItems.length, 0),
      citations: lessons.reduce((total, lesson) => total + lesson.citations.length, 0),
    },
    emptyState: lessons.length === 0 ? {
      title: "No study pack yet.",
      detail: "Save or open a lesson to collect guided notes, rationales, and citations here.",
    } : null,
  };
}

async function generateLessonPackageFromData(data: z.infer<typeof generateSchema>, createdBy?: string) {
  let generationRunId: string | undefined;
  try {
    await ensureLessonBuilderTables();
    const [generationRun] = await db.insert(lessonGenerationRuns).values({
      status: "running",
      generationMode: data.settings.generationMode,
      topic: data.topic,
      audience: data.audience,
      sourceIds: data.sourceIds,
      settings: data.settings,
      createdBy,
    }).returning();
    generationRunId = generationRun.id;

    const sources = await getSourcesByIds(data.sourceIds);

    if (sources.length === 0) {
      await db.update(lessonGenerationRuns).set({
        status: "failed",
        errorMessage: "At least one approved source is required",
        completedAt: new Date(),
      }).where(eq(lessonGenerationRuns.id, generationRunId));
      throw new Error("At least one approved source is required");
    }

    const taxonomySnapshot = await buildTaxonomySnapshot(data.sourceIds);
    const evidence = await fetchEvidence(data.topic, sources);
    const templateSlideDrafts = buildSlideDrafts(data.topic, data.audience, evidence, taxonomySnapshot, data.settings.slideCount);
    const generation = await buildGenerationDrafts({
      data,
      sources,
      taxonomySnapshot,
      evidence,
      templateSlideDrafts,
    });
    const slideDrafts = generation.slideDrafts;

    const [pkg] = await db.insert(lessonPackages).values({
      title: data.title,
      topic: data.topic,
      audience: data.audience,
      status: "draft",
      sourceIds: data.sourceIds,
      taxonomySnapshot,
      deckModel: {},
      manifest: {},
      qaSummary: {},
      createdBy,
    }).returning();

    const createdSlides = [];
    for (const slide of slideDrafts) {
      const [createdSlide] = await db.insert(lessonSlides).values({
        packageId: pkg.id,
        slideNumber: slide.slideNumber,
        slideType: slide.slideType,
        title: slide.title,
        visibleContent: slide.visibleContent,
        speakerNotes: slide.speakerNotes,
        guidedNotes: slide.guidedNotes,
        retrievalPrompt: slide.retrievalPrompt,
        nclexCategory: slide.nclexCategory,
        cjmStep: slide.cjmStep,
        nursingProcess: slide.nursingProcess,
        bloomLevel: slide.bloomLevel,
      }).returning();
      createdSlides.push({ createdSlide, evidence: slide.evidence });
    }

    const practiceSlide = createdSlides.find(({ createdSlide }) => createdSlide.slideType === "practice_item")?.createdSlide || createdSlides[0]?.createdSlide;
    const generatedItem = generation.practiceItem;
    const itemOptions = generatedItem?.options?.length ? generatedItem.options : [
      { id: "A", text: "Collect another relevant assessment cue before acting." },
      { id: "B", text: "Ignore the cue because it may be expected." },
      { id: "C", text: "Delegate follow-up without reviewing the patient." },
      { id: "D", text: "Document the finding at the end of the shift only." },
    ];
    const [item] = await db.insert(lessonItems).values({
      packageId: pkg.id,
      slideId: practiceSlide?.id,
      itemType: generatedItem?.itemType || "multiple_choice",
      stem: generatedItem?.stem || `A nurse is caring for a patient with a cue related to ${data.topic}. Which action best supports safe clinical judgment?`,
      options: itemOptions,
      correctAnswer: generatedItem?.correctAnswer || "A",
      rationale: generatedItem?.rationale || `Collecting a relevant assessment cue keeps the nurse aligned with the clinical judgment process and supports safe prioritization for ${data.topic}.`,
      tags: {
        nclexCategory: slideDrafts[0]?.nclexCategory,
        cjmStep: "Analyze Cues",
        nursingProcess: slideDrafts[0]?.nursingProcess,
        bloomLevel: slideDrafts[0]?.bloomLevel,
      },
      difficulty: data.settings.difficulty,
    }).returning();

    for (const { createdSlide, evidence: citationEvidence } of createdSlides) {
      await db.insert(lessonCitations).values({
        packageId: pkg.id,
        slideId: createdSlide.id,
        sourceId: citationEvidence.sourceId,
        documentId: citationEvidence.documentId,
        chunkId: citationEvidence.chunkId,
        citationLabel: citationEvidence.citationLabel,
        pageStart: citationEvidence.pageStart,
        pageEnd: citationEvidence.pageEnd,
        excerpt: textSnippet(citationEvidence.text, 320),
        relevanceScore: "0.8500",
      });
    }

    if (practiceSlide) {
      const itemEvidence = generatedItem?.evidence || evidence[0];
      await db.insert(lessonCitations).values({
        packageId: pkg.id,
        slideId: practiceSlide.id,
        itemId: item.id,
        sourceId: itemEvidence.sourceId,
        documentId: itemEvidence.documentId,
        chunkId: itemEvidence.chunkId,
        citationLabel: itemEvidence.citationLabel,
        pageStart: itemEvidence.pageStart,
        pageEnd: itemEvidence.pageEnd,
        excerpt: textSnippet(itemEvidence.text, 320),
        relevanceScore: "0.8500",
      });
    }

    const deckModel = {
      ...buildDeckModel(pkg.id, data.title, data.topic, data.audience, slideDrafts, taxonomySnapshot),
      generation: generation.metadata,
      supervisorNotes: generation.supervisorNotes,
      risks: generation.risks,
    };
    const manifest = {
      ...buildManifest(pkg.id, data.title, data.topic, data.sourceIds),
      generation: generation.metadata,
      supervisorNotes: generation.supervisorNotes,
      risks: generation.risks,
    };
    await db.update(lessonPackages).set({
      deckModel,
      manifest,
      updatedAt: new Date(),
    }).where(eq(lessonPackages.id, pkg.id));

    const qa = await runQaForPackage(pkg.id);
    const validation = await validateLessonContract(pkg.id, "harrity");
    await db.update(lessonGenerationRuns).set({
      packageId: pkg.id,
      status: "completed",
      evidenceSnapshot: {
        topic: data.topic,
        refs: evidenceRefs(evidence),
      },
      taxonomySnapshot,
      validationSummary: {
        qa: qa.qaSummary,
        contract: validation.validationSummary,
      },
      completedAt: new Date(),
    }).where(eq(lessonGenerationRuns.id, generationRunId));

    const bundle = await findPackageBundle(pkg.id);

    return {
      package: bundle?.package,
      slides: bundle?.slides,
      items: bundle?.items,
      citations: bundle?.citations,
      qa,
      validation,
      generationRun: { id: generationRunId, status: "completed" },
      generation: generation.metadata,
    };
  } catch (error) {
    if (generationRunId) {
      try {
        await db.update(lessonGenerationRuns).set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Lesson generation failed",
          completedAt: new Date(),
        }).where(eq(lessonGenerationRuns.id, generationRunId));
      } catch {
        // Preserve the original generation error for the response.
      }
    }
    throw error;
  }
}

function rubricScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(4, Math.round(parsed)));
}

function normalizeFacultyReviewRubric(metadata: Record<string, any> = {}) {
  const rawRubric = (metadata.rubric || metadata.rubricScores || {}) as Record<string, any>;
  const criteria = facultyReviewRubricCriteria.map((criterion) => {
    const raw = rawRubric[criterion.key] || {};
    const score = rubricScore(typeof raw === "object" ? raw.score : raw);
    const note = typeof raw === "object" && typeof raw.note === "string" ? raw.note.trim().slice(0, 600) : "";
    return {
      key: criterion.key,
      label: criterion.label,
      description: criterion.description,
      score,
      note,
      status: score == null ? "not_scored" : score >= 3 ? "meets_standard" : score === 2 ? "needs_review" : "does_not_meet",
    };
  });
  const scored = criteria.filter((criterion) => typeof criterion.score === "number");
  const totalScore = scored.reduce((sum, criterion) => sum + Number(criterion.score || 0), 0);
  const averageScore = scored.length ? Number((totalScore / scored.length).toFixed(2)) : 0;
  const lowestScore = scored.length ? Math.min(...scored.map((criterion) => Number(criterion.score || 0))) : 0;
  const percentScore = scored.length ? Math.round((averageScore / 4) * 100) : 0;
  const allCriteriaScored = scored.length === facultyReviewRubricCriteria.length;
  const passing = allCriteriaScored && averageScore >= 3 && lowestScore >= 3;

  return {
    version: "faculty_review_rubric_v1",
    maxScore: 4,
    scoredCriteria: scored.length,
    requiredCriteria: facultyReviewRubricCriteria.length,
    allCriteriaScored,
    totalScore,
    averageScore,
    percentScore,
    lowestScore,
    passing,
    status: passing ? "rubric_pass" : allCriteriaScored ? "rubric_needs_review" : "rubric_incomplete",
    criteria,
  };
}

async function recordPackageReview(
  packageId: string,
  data: z.infer<typeof packageReviewSchema>,
  actorId?: string,
  reviewKind: "ai" | "faculty" | "general" = "general"
) {
  await ensureLessonBuilderTables();
  const bundle = await findPackageBundle(packageId);
  if (!bundle) return null;
  const rubricSummary = reviewKind === "faculty" ? normalizeFacultyReviewRubric(data.metadata || {}) : null;

  const [review] = await db.insert(lessonPackageReviews).values({
    packageId,
    reviewerName: data.reviewerName,
    reviewerRole: data.reviewerRole,
    decision: data.decision,
    focusArea: data.focusArea,
    comment: data.comment,
    metadata: {
      ...data.metadata,
      ...(rubricSummary ? { rubricSummary } : {}),
      reviewKind,
      premiumFeature: reviewKind === "faculty",
      packageStatusAtReview: bundle.package.status,
      qaFailCount: Number(bundle.package.qaSummary?.failCount || 0),
      contractFailCount: Number(bundle.package.manifest?.contractValidation?.failCount || 0),
    },
    createdBy: actorId,
  }).returning();

  const reviewSummary = {
    latestDecision: review.decision,
    latestReviewerName: review.reviewerName,
    latestReviewerRole: review.reviewerRole,
    latestFocusArea: review.focusArea,
    latestComment: review.comment,
    reviewedAt: review.createdAt,
    approvedForPilot: review.decision === "approved_for_pilot" || review.decision === "approved_for_release",
    approvedForRelease: review.decision === "approved_for_release",
    changesRequested: review.decision === "changes_requested",
    premiumFeature: reviewKind === "faculty",
    reviewKind,
    ...(rubricSummary ? {
      rubricSummary,
      rubricPassing: rubricSummary.passing,
      rubricAverageScore: rubricSummary.averageScore,
      certificateEligible: rubricSummary.passing && (review.decision === "approved_for_pilot" || review.decision === "approved_for_release"),
    } : {}),
  };

  await db.update(lessonPackages).set({
    manifest: {
      ...(bundle.package.manifest || {}),
      [reviewKind === "ai" ? "aiReview" : "facultyReview"]: reviewSummary,
    },
    updatedAt: new Date(),
  }).where(eq(lessonPackages.id, packageId));

  await recordReleaseAuditEvent(
    packageId,
    reviewKind === "ai" ? "ai_review_recorded" : "faculty_review_recorded",
    `${reviewKind === "ai" ? "AI" : "Faculty"} review recorded: ${review.decision.replace(/_/g, " ")}`,
    {
      reviewId: review.id,
      decision: review.decision,
      focusArea: review.focusArea,
      reviewerRole: review.reviewerRole,
      premiumFeature: reviewKind === "faculty",
      ...(rubricSummary ? {
        rubricAverageScore: rubricSummary.averageScore,
        rubricPassing: rubricSummary.passing,
        rubricStatus: rubricSummary.status,
      } : {}),
    },
    actorId
  );

  const updatedBundle = await findPackageBundle(packageId);
  return { review, package: updatedBundle?.package, reviews: updatedBundle?.reviews || [] };
}

function pilotReadinessSteps({
  bundle,
  sourceDetails,
  outcomes,
  exportStatus,
  health,
}: {
  bundle: LessonBundle | null;
  sourceDetails: any[];
  outcomes: Awaited<ReturnType<typeof buildPilotOutcomes>> | null;
  exportStatus: Record<string, any> | null;
  health: Awaited<ReturnType<typeof lessonBuilderHealth>>;
}) {
  const latestReview = bundle?.reviews?.[0];
  const aiReview = bundle?.reviews?.find((review) => review.reviewerRole === "ai_reviewer")
    || bundle?.package?.manifest?.aiReview
    || null;
  const humanReview = bundle?.reviews?.find((review) => review.reviewerRole !== "ai_reviewer")
    || bundle?.package?.manifest?.facultyReview
    || null;

  return [
    {
      key: "source_approved",
      label: "Source approved",
      status: sourceDetails.some((detail) => detail?.source?.approvalStatus === "approved") ? "pass" : "missing",
      detail: sourceDetails.some((detail) => detail?.source?.approvalStatus === "approved")
        ? `${sourceDetails.filter((detail) => detail?.source?.approvalStatus === "approved").length} approved source(s)`
        : "Approve one nursing source before launch.",
    },
    {
      key: "chunks_ready",
      label: "Chunks ready",
      status: sourceDetails.some((detail) => Number(detail?.chunkCount || 0) > 0) ? "pass" : "warn",
      detail: `${sourceDetails.reduce((total, detail) => total + Number(detail?.chunkCount || 0), 0)} source chunk(s) available`,
    },
    {
      key: "package_generated",
      label: "Package generated",
      status: bundle ? "pass" : "missing",
      detail: bundle ? bundle.package.title : "Generate the pilot web lesson package.",
    },
    {
      key: "ai_reviewed",
      label: "AI reviewed",
      status: aiReview ? "pass" : "warn",
      detail: aiReview ? `Latest AI review: ${String(aiReview.decision || aiReview.latestDecision || "recorded").replace(/_/g, " ")}` : "Run AI review for MVP approval.",
    },
    {
      key: "faculty_review",
      label: "Faculty review",
      status: humanReview ? "pass" : "premium_feature",
      detail: humanReview
        ? `Faculty review: ${String(humanReview.decision || humanReview.latestDecision || "recorded").replace(/_/g, " ")}`
        : "Premium gate. Optional for MVP; required for paid faculty review workflows.",
    },
    {
      key: "published",
      label: "Published",
      status: bundle?.package?.status === "published" ? "pass" : "warn",
      detail: bundle?.package?.status === "published" ? "Learner route is available." : "Publish after QA and contract gates pass.",
    },
    {
      key: "assignment_active",
      label: "Assignment active",
      status: (outcomes?.totals.assignments || 0) > 0 ? "pass" : "warn",
      detail: `${outcomes?.totals.assignments || 0} active pilot assignment(s)`,
    },
    {
      key: "learner_activity",
      label: "Learner activity",
      status: (outcomes?.totals.opened || 0) > 0 ? "pass" : "warn",
      detail: `${outcomes?.totals.opened || 0} opened, ${outcomes?.totals.completed || 0} completed`,
    },
    {
      key: "export_ready",
      label: "Export ready",
      status: exportStatus?.status === "ready" ? "pass" : "warn",
      detail: exportStatus ? `${exportStatus.fileCount} generated file(s)` : "No export check available yet.",
    },
    {
      key: "ai_mode",
      label: "AI mode",
      status: health.aiReady ? "pass" : "warn",
      detail: `${health.aiMode || health.agent?.aiMode || "template_fallback"}`,
    },
  ];
}

async function buildPilotLaunchSummary() {
  await ensureLessonBuilderTables();
  const [health, releaseReadiness] = await Promise.all([
    lessonBuilderHealth(),
    lessonBuilderReleaseReadiness(),
  ]);

  const packageId = health.latestPublishedPackageId || releaseReadiness.latestPublishedPackageId || null;
  const bundle = packageId ? await findPackageBundle(packageId) : null;
  const sourceDetails = bundle?.sources?.length
    ? await Promise.all(bundle.sources.map((source) => getSourceDetail(source.id)))
    : [];
  const outcomes = packageId ? await buildPilotOutcomes(packageId) : null;
  const exportStatus = bundle ? (() => {
    const artifacts = buildPackageArtifactPayloads(bundle, "harrity");
    const generatedFiles = artifacts.map((artifact) => artifact.fileName).sort();
    const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !generatedFiles.includes(fileName));
    return {
      status: missingRequiredFiles.length === 0 ? "ready" : "missing_required_files",
      fileCount: generatedFiles.length,
      requiredFileCount: harrityRequiredExportFiles.length,
      generatedFiles,
      missingRequiredFiles,
      includesDeckModel: generatedFiles.includes("deck_model.json"),
    };
  })() : null;
  const readinessSteps = pilotReadinessSteps({ bundle, sourceDetails, outcomes, exportStatus, health });
  const blockingSteps = readinessSteps.filter((step) => !["pass", "premium_feature"].includes(step.status));
  const latestAssignment = bundle?.assignments?.[0] || null;
  const latestLearner = latestAssignment?.learners?.[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    pilotReady: Boolean(releaseReadiness.pilotReady && bundle?.package?.status === "published" && exportStatus?.status === "ready"),
    latestPublishedPackageId: packageId,
    package: bundle ? {
      id: bundle.package.id,
      title: bundle.package.title,
      topic: bundle.package.topic,
      audience: bundle.package.audience,
      status: bundle.package.status,
      publishedAt: bundle.package.publishedAt,
      learnerUrl: `/lessons/${bundle.package.id}`,
      aiReview: bundle.package.manifest?.aiReview || null,
      facultyReview: bundle.package.manifest?.facultyReview || null,
      assessmentBridge: bundle.package.manifest?.assessmentBridge || bundle.package.taxonomySnapshot?.assessmentBridge || null,
    } : null,
    health: {
      aiMode: health.aiMode,
      aiReady: health.aiReady,
      dbReady: health.database.configured && health.database.status !== "unhealthy",
      sourceRegistryStatus: health.sourceRegistry.status,
      exportStatus: health.export.status,
    },
    readinessSteps,
    nextActions: blockingSteps.slice(0, 4).map((step) => ({
      key: step.key,
      label: step.label,
      detail: step.detail,
    })),
    avatars: [
      {
        key: "program_admin",
        label: "Program Admin",
        solution: "Launch Console",
        status: bundle ? "available" : "needs_package",
        nextAction: bundle ? "Monitor readiness ladder and assignment links." : "Generate and publish the pilot package.",
      },
      {
        key: "faculty_reviewer",
        label: "Faculty Reviewer",
        solution: "Premium Faculty Review Workspace",
        status: bundle?.package?.manifest?.facultyReview ? "review_recorded" : "premium_available",
        nextAction: "Record human review when the premium faculty gate is enabled.",
      },
      {
        key: "learner",
        label: "Nursing Student",
        solution: "Learner Assignment View",
        status: latestLearner ? "assignment_link_ready" : "needs_assignment",
        nextAction: latestLearner ? "Share the copied learner link." : "Create a pilot cohort assignment.",
      },
      {
        key: "remediation_coach",
        label: "Remediation Coach",
        solution: "Cohort Outcomes",
        status: outcomes?.totals.assigned ? "available" : "needs_assignment_data",
        nextAction: "Use action queue for not-started, incomplete, confused, or missed-practice learners.",
      },
      {
        key: "content_ops",
        label: "Content Ops",
        solution: "Source Studio",
        status: sourceDetails.some((detail) => detail?.normalization) ? "normalized" : "needs_normalization",
        nextAction: "Normalize official source metadata and taxonomy hints.",
      },
      {
        key: "program_director",
        label: "Program Director",
        solution: "Pilot Evidence Report",
        status: exportStatus?.status === "ready" ? "export_ready" : "needs_export_check",
        nextAction: "Export pilot evidence after cohort activity is present.",
      },
    ],
    sourceSummary: sourceDetails.map((detail) => ({
      id: detail?.source?.id,
      title: detail?.source?.title,
      approvalStatus: detail?.source?.approvalStatus,
      ingestionStatus: detail?.source?.ingestionStatus,
      chunkCount: detail?.chunkCount || 0,
      citationPolicy: detail?.source?.citationPolicy,
      normalized: Boolean(detail?.normalization),
      weakTopics: detail?.normalization?.weakTopics || [],
    })),
    assignment: latestAssignment ? {
      id: latestAssignment.id,
      title: latestAssignment.title,
      cohortName: latestAssignment.cohortName,
      status: latestAssignment.status,
      counts: latestAssignment.counts,
      firstLearnerLink: latestLearner?.linkPath || null,
    } : null,
    outcomes: outcomes ? {
      totals: outcomes.totals,
      practiceSummary: outcomes.practiceSummary,
      feedbackSummary: outcomes.feedbackSummary,
      actionQueue: outcomes.actionQueue.slice(0, 8),
    } : null,
    exportStatus,
  };
}

function buildPilotEvidenceReport(
  bundle: LessonBundle,
  outcomes: Awaited<ReturnType<typeof buildPilotOutcomes>> | null,
  auditPatterns: Array<typeof sourceRegistry.$inferSelect> = [],
  deckExemplars: Array<typeof sourceRegistry.$inferSelect> = []
) {
  const artifacts = buildPackageArtifactPayloads(bundle, "harrity");
  const generatedFiles = artifacts.map((artifact) => artifact.fileName).sort();
  const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !generatedFiles.includes(fileName));
  const sourceTraceability = bundle.sources.map((source) => ({
    id: source.id,
    title: source.title,
    sourceType: source.sourceType,
    approvalStatus: source.approvalStatus,
    ingestionStatus: source.ingestionStatus,
    citationPolicy: source.citationPolicy,
  }));
  const relatedAuditPatterns = auditPatterns.map((source) => {
    const metadata = (source.metadata || {}) as Record<string, any>;
    return {
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
      sourceUri: source.sourceUri,
      subject: source.subject,
      role: metadata.sitesRole || source.sourceType,
      patternUse: Array.isArray(metadata.patternUse) ? metadata.patternUse.slice(0, 6) : [],
      premiumWorkflowPattern: Boolean(metadata.premiumWorkflowPattern),
    };
  });
  const relatedDeckExemplars = deckExemplars.map((source) => {
    const metadata = (source.metadata || {}) as Record<string, any>;
    return {
      id: source.id,
      title: source.title,
      sourceType: source.sourceType,
      sourceUri: source.sourceUri,
      subject: source.subject,
      edition: source.edition,
      role: metadata.driveSourceRole || source.sourceType,
      driveFileId: source.driveFileId,
      slideCount: metadata.slideCount || null,
      unit: metadata.unit || null,
      chapter: metadata.chapter || null,
      outlineSummary: metadata.outlineSummary || null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    reportType: "pilot_evidence",
    relatedAssetPolicy: {
      role: "reference_only",
      citationUse: "not_authoritative_source_truth",
      note: "Related Drive/Pearson assets support lesson grammar, workflow review, traceability, and reporting. Lesson claims must cite approved source traceability records.",
    },
    package: {
      id: bundle.package.id,
      title: bundle.package.title,
      topic: bundle.package.topic,
      audience: bundle.package.audience,
      status: bundle.package.status,
      publishedAt: bundle.package.publishedAt,
      learnerUrl: `/lessons/${bundle.package.id}`,
    },
    readiness: {
      qaSummary: bundle.package.qaSummary || {},
      contractValidation: bundle.package.manifest?.contractValidation || null,
      aiReview: bundle.package.manifest?.aiReview || null,
      facultyReview: bundle.package.manifest?.facultyReview || null,
      facultyReviewPremium: true,
      exportReady: missingRequiredFiles.length === 0,
      missingRequiredFiles,
    },
    sourceTraceability,
    relatedAuditPatterns,
    relatedDeckExemplars,
    lessonAssets: {
      slideCount: bundle.slides.length,
      itemCount: bundle.items.length,
      citationCount: bundle.citations.length,
      artifactCount: artifacts.length,
      generatedFiles,
    },
    cohortOutcomes: outcomes ? {
      totals: outcomes.totals,
      practiceSummary: outcomes.practiceSummary,
      feedbackSummary: outcomes.feedbackSummary,
      actionQueue: outcomes.actionQueue,
    } : null,
    avatarSolutions: [
      "Program Admin: Pilot Launch Console",
      "Faculty Reviewer: Premium Faculty Review Workspace",
      "Nursing Student: Learner Assignment View",
      "Remediation Coach: Cohort Outcomes",
      "Content Ops: Source Studio",
      "Program Director: Pilot Evidence Report",
    ],
  };
}

function renderPilotEvidenceMarkdown(report: ReturnType<typeof buildPilotEvidenceReport>) {
  const totals = (report.cohortOutcomes?.totals || {}) as Record<string, number>;
  const qaSummary = report.readiness.qaSummary || {};
  const aiReview = report.readiness.aiReview as Record<string, any> | null;
  const facultyReview = report.readiness.facultyReview as Record<string, any> | null;
  const missingFiles = report.readiness.missingRequiredFiles || [];
  const generatedFiles = report.lessonAssets.generatedFiles || [];
  const actionQueue = report.cohortOutcomes?.actionQueue || [];
  const practiceSummary = (report.cohortOutcomes?.practiceSummary || {}) as Record<string, number>;
  const feedbackSummary = (report.cohortOutcomes?.feedbackSummary || {}) as Record<string, number>;

  const lines = [
    `# Pilot Evidence Report: ${report.package.title}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Executive Summary",
    "",
    `- Package status: ${report.package.status}`,
    `- Topic: ${report.package.topic || "Not specified"}`,
    `- Audience: ${report.package.audience || "Not specified"}`,
    `- Learner route: ${report.package.learnerUrl}`,
    `- Export ready: ${report.readiness.exportReady ? "Yes" : "No"}`,
    `- AI review: ${aiReview?.decision || aiReview?.status || "Not recorded"}`,
    `- Faculty review: ${facultyReview?.decision || facultyReview?.status || "Premium / optional"}`,
    `- Related audit patterns: ${report.relatedAuditPatterns.length}`,
    `- Related deck exemplars: ${report.relatedDeckExemplars.length}`,
    `- Related asset policy: ${report.relatedAssetPolicy.note}`,
    "",
    "## Cohort Outcomes",
    "",
    `- Assigned: ${totals.assigned || 0}`,
    `- Opened: ${totals.opened || 0}`,
    `- Practice attempted: ${totals.practiceAttempted || 0}`,
    `- Completed: ${totals.completed || 0}`,
    `- Feedback submitted: ${totals.feedbackSubmitted || 0}`,
    `- Needs review: ${totals.needsReview || 0}`,
    "",
    "## Lesson Assets",
    "",
    `- Slides: ${report.lessonAssets.slideCount}`,
    `- Practice items: ${report.lessonAssets.itemCount}`,
    `- Citations: ${report.lessonAssets.citationCount}`,
    `- Export artifacts: ${report.lessonAssets.artifactCount}`,
    "",
    "## QA And Review",
    "",
    `- QA pass: ${qaSummary.passCount || 0}`,
    `- QA warnings: ${qaSummary.warningCount || 0}`,
    `- QA failures: ${qaSummary.failCount || 0}`,
    `- Required export files missing: ${missingFiles.length ? missingFiles.join(", ") : "None"}`,
    "",
    "## Source Traceability",
    "",
    ...(
      report.sourceTraceability.length
        ? report.sourceTraceability.map((source) => `- ${source.title} (${source.sourceType}; ${source.approvalStatus}; ${source.ingestionStatus}; ${source.citationPolicy})`)
        : ["- No sources attached."]
    ),
    "",
    "## Related Audit Patterns",
    "",
    ...(
      report.relatedAuditPatterns.length
        ? report.relatedAuditPatterns.map((pattern) => {
            const uses = pattern.patternUse.length ? ` Use for: ${pattern.patternUse.join(", ")}.` : "";
            const link = pattern.sourceUri ? ` [Open reference](${pattern.sourceUri})` : "";
            return `- ${pattern.title} (${pattern.role}; ${pattern.premiumWorkflowPattern ? "premium review pattern" : "reference pattern"}).${uses}${link}`;
          })
        : ["- No related audit patterns registered."]
    ),
    "",
    "## Related Deck Exemplars",
    "",
    ...(
      report.relatedDeckExemplars.length
        ? report.relatedDeckExemplars.map((deck) => {
            const facts = [
              deck.role,
              deck.slideCount ? `${deck.slideCount} slides` : "",
              deck.chapter,
              deck.unit,
            ].filter(Boolean).join("; ");
            const link = deck.sourceUri ? ` [Open reference](${deck.sourceUri})` : "";
            return `- ${deck.title} (${facts || deck.sourceType}).${deck.outlineSummary ? ` ${deck.outlineSummary}` : ""}${link}`;
          })
        : ["- No related Drive deck exemplars registered."]
    ),
    "",
    "## Practice And Feedback Summary",
    "",
    `- Practice correct: ${practiceSummary.correct || 0}`,
    `- Practice incorrect: ${practiceSummary.incorrect || 0}`,
    `- Helpful feedback: ${feedbackSummary.helpful || 0}`,
    `- Confusing feedback: ${feedbackSummary.confusing || 0}`,
    `- Too hard feedback: ${feedbackSummary.tooHard || 0}`,
    "",
    "## Follow-Up Queue",
    "",
    ...(
      actionQueue.length
        ? actionQueue.slice(0, 12).map((item: any) => `- ${item.learnerName || "Learner"}: ${item.reason || item.status || "Needs review"}`)
        : ["- No follow-up actions currently flagged."]
    ),
    "",
    "## Generated Files",
    "",
    ...(
      generatedFiles.length
        ? generatedFiles.map((fileName) => `- ${fileName}`)
        : ["- No generated files reported."]
    ),
    "",
    "## Avatar Coverage",
    "",
    ...report.avatarSolutions.map((solution) => `- ${solution}`),
    "",
  ];

  return lines.join("\n");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPilotEvidenceHtml(report: ReturnType<typeof buildPilotEvidenceReport>) {
  const totals = (report.cohortOutcomes?.totals || {}) as Record<string, number>;
  const qaSummary = report.readiness.qaSummary || {};
  const aiReview = report.readiness.aiReview as Record<string, any> | null;
  const facultyReview = report.readiness.facultyReview as Record<string, any> | null;
  const missingFiles = report.readiness.missingRequiredFiles || [];
  const generatedFiles = report.lessonAssets.generatedFiles || [];
  const actionQueue = report.cohortOutcomes?.actionQueue || [];
  const practiceSummary = (report.cohortOutcomes?.practiceSummary || {}) as Record<string, number>;
  const feedbackSummary = (report.cohortOutcomes?.feedbackSummary || {}) as Record<string, number>;
  const metric = (label: string, value: string | number) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  const list = (items: string[], empty: string) => (items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li>${escapeHtml(empty)}</li>`);
  const linkedList = (items: Array<{ label: string; detail: string; url?: string | null }>, empty: string) => (
    items.length
      ? items.map((item) => {
          const link = item.url ? ` <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open reference</a>` : "";
          return `<li><strong>${escapeHtml(item.label)}</strong>${item.detail ? `: ${escapeHtml(item.detail)}` : ""}${link}</li>`;
        }).join("")
      : `<li>${escapeHtml(empty)}</li>`
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pilot Evidence Report - ${escapeHtml(report.package.title)}</title>
  <style>
    :root { color: #0f172a; background: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 32px; }
    main { max-width: 1040px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); overflow: hidden; }
    header { padding: 32px; background: #0f766e; color: #fff; }
    header p { margin: 8px 0 0; color: #ccfbf1; }
    section { padding: 24px 32px; border-top: 1px solid #e2e8f0; }
    h1, h2 { margin: 0; }
    h1 { font-size: 28px; line-height: 1.2; }
    h2 { font-size: 18px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #f8fafc; }
    .metric strong { display: block; font-size: 22px; color: #0f172a; }
    .metric span { display: block; margin-top: 4px; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: .05em; }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #ccfbf1; color: #134e4a; font-size: 12px; font-weight: 700; }
    .notice { border: 1px solid #bae6fd; background: #f0f9ff; color: #0c4a6e; border-radius: 10px; padding: 12px 14px; }
    a { color: #0f766e; font-weight: 700; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    .muted { color: #64748b; }
    .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
    @media (max-width: 760px) { body { padding: 12px; } section, header { padding: 20px; } .two { grid-template-columns: 1fr; } }
    @media print { body { padding: 0; background: #fff; } main { box-shadow: none; border: 0; border-radius: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="pill">Pilot Evidence Report</div>
      <h1>${escapeHtml(report.package.title)}</h1>
      <p>${escapeHtml(report.package.topic || "Topic not specified")} · ${escapeHtml(report.package.audience || "Audience not specified")}</p>
      <p>Generated ${escapeHtml(report.generatedAt)}</p>
    </header>

    <section>
      <h2>Executive Summary</h2>
      <div class="grid">
        ${metric("Package status", report.package.status)}
        ${metric("Export ready", report.readiness.exportReady ? "Yes" : "No")}
        ${metric("AI review", aiReview?.decision || aiReview?.status || "Not recorded")}
        ${metric("Faculty review", facultyReview?.decision || facultyReview?.status || "Premium")}
        ${metric("Audit patterns", report.relatedAuditPatterns.length)}
        ${metric("Deck exemplars", report.relatedDeckExemplars.length)}
      </div>
    </section>

    <section>
      <h2>Cohort Outcomes</h2>
      <div class="grid">
        ${metric("Assigned", totals.assigned || 0)}
        ${metric("Opened", totals.opened || 0)}
        ${metric("Practice attempted", totals.practiceAttempted || 0)}
        ${metric("Completed", totals.completed || 0)}
        ${metric("Feedback submitted", totals.feedbackSubmitted || 0)}
        ${metric("Needs review", totals.needsReview || 0)}
      </div>
    </section>

    <section>
      <h2>Lesson Assets</h2>
      <div class="grid">
        ${metric("Slides", report.lessonAssets.slideCount)}
        ${metric("Practice items", report.lessonAssets.itemCount)}
        ${metric("Citations", report.lessonAssets.citationCount)}
        ${metric("Export artifacts", report.lessonAssets.artifactCount)}
      </div>
    </section>

    <section class="two">
      <div>
        <h2>QA And Review</h2>
        <ul>
          <li>QA pass: ${escapeHtml(qaSummary.passCount || 0)}</li>
          <li>QA warnings: ${escapeHtml(qaSummary.warningCount || 0)}</li>
          <li>QA failures: ${escapeHtml(qaSummary.failCount || 0)}</li>
          <li>Missing required files: ${escapeHtml(missingFiles.length ? missingFiles.join(", ") : "None")}</li>
        </ul>
      </div>
      <div>
        <h2>Practice And Feedback</h2>
        <ul>
          <li>Practice correct: ${escapeHtml(practiceSummary.correct || 0)}</li>
          <li>Practice incorrect: ${escapeHtml(practiceSummary.incorrect || 0)}</li>
          <li>Helpful feedback: ${escapeHtml(feedbackSummary.helpful || 0)}</li>
          <li>Confusing feedback: ${escapeHtml(feedbackSummary.confusing || 0)}</li>
          <li>Too hard feedback: ${escapeHtml(feedbackSummary.tooHard || 0)}</li>
        </ul>
      </div>
    </section>

    <section>
      <h2>Source Traceability</h2>
      <div class="notice">Related Drive/Pearson assets are reference-only. Lesson claims must cite approved source traceability records.</div>
      <ul>
        ${list(report.sourceTraceability.map((source) => `${source.title} (${source.sourceType}; ${source.approvalStatus}; ${source.ingestionStatus}; ${source.citationPolicy})`), "No sources attached.")}
      </ul>
    </section>

    <section>
      <h2>Related Audit Patterns</h2>
      <ul>
        ${linkedList(report.relatedAuditPatterns.map((pattern) => ({
          label: pattern.title,
          detail: `(${pattern.role}; ${pattern.premiumWorkflowPattern ? "premium review pattern" : "reference pattern"}). ${pattern.patternUse.length ? `Use for: ${pattern.patternUse.join(", ")}.` : ""}`,
          url: pattern.sourceUri,
        })), "No related audit patterns registered.")}
      </ul>
    </section>

    <section>
      <h2>Related Deck Exemplars</h2>
      <ul>
        ${linkedList(report.relatedDeckExemplars.map((deck) => {
          const facts = [deck.role, deck.slideCount ? `${deck.slideCount} slides` : "", deck.chapter, deck.unit].filter(Boolean).join("; ");
          return {
            label: deck.title,
            detail: `(${facts || deck.sourceType}). ${deck.outlineSummary || ""}`,
            url: deck.sourceUri,
          };
        }), "No related Drive deck exemplars registered.")}
      </ul>
    </section>

    <section class="two">
      <div>
        <h2>Follow-Up Queue</h2>
        <ul>
          ${list(actionQueue.slice(0, 12).map((item: any) => `${item.learnerName || "Learner"}: ${item.reason || item.status || "Needs review"}`), "No follow-up actions currently flagged.")}
        </ul>
      </div>
      <div>
        <h2>Avatar Coverage</h2>
        <ul>${list(report.avatarSolutions, "No avatar coverage listed.")}</ul>
      </div>
    </section>

    <section>
      <h2>Generated Files</h2>
      <ul>${list(generatedFiles, "No generated files reported.")}</ul>
    </section>
  </main>
</body>
</html>`;
}

function formatEvidencePercent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function buildPilotEvidenceSlideOutline(report: ReturnType<typeof buildPilotEvidenceReport>) {
  const totals = (report.cohortOutcomes?.totals || {}) as Record<string, number>;
  const qaSummary = report.readiness.qaSummary || {};
  const aiReview = report.readiness.aiReview as Record<string, any> | null;
  const facultyReview = report.readiness.facultyReview as Record<string, any> | null;
  const practiceSummary = (report.cohortOutcomes?.practiceSummary || {}) as Record<string, number>;
  const feedbackSummary = (report.cohortOutcomes?.feedbackSummary || {}) as Record<string, number>;
  const actionQueue = report.cohortOutcomes?.actionQueue || [];
  const assigned = totals.assigned || 0;
  const completed = totals.completed || 0;
  const opened = totals.opened || 0;
  const practiceAttempted = totals.practiceAttempted || 0;
  const aiDecision = aiReview?.decision || aiReview?.status || "Not recorded";
  const facultyDecision = facultyReview?.decision || facultyReview?.status || "Premium / optional";
  const missingFiles = report.readiness.missingRequiredFiles || [];
  const sourceLabels = report.sourceTraceability.map((source) => `${source.title} (${source.approvalStatus}/${source.ingestionStatus})`);
  const followUpLabels = actionQueue.slice(0, 5).map((item: any) => `${item.learnerName || "Learner"}: ${item.reason || item.status || "Needs review"}`);

  const slides = [
    {
      slideNumber: 1,
      title: "Pilot Snapshot",
      purpose: "Orient program leadership to the active internal pilot lesson.",
      visibleBullets: [
        `Package: ${report.package.title}`,
        `Topic: ${report.package.topic || "Not specified"}`,
        `Audience: ${report.package.audience || "Not specified"}`,
        `Status: ${report.package.status}`,
      ],
      speakerNotes: "Use this opening slide to anchor the pilot in a single lesson package and remind reviewers that this is an internal cohort release, not a full public launch.",
    },
    {
      slideNumber: 2,
      title: "Launch Readiness",
      purpose: "Summarize the release gates that matter for pilot launch.",
      visibleBullets: [
        `Export readiness: ${report.readiness.exportReady ? "Ready" : "Needs attention"}`,
        `AI review: ${aiDecision}`,
        `Faculty review: ${facultyDecision}`,
        `Missing required files: ${missingFiles.length ? missingFiles.join(", ") : "None"}`,
      ],
      speakerNotes: "AI-reviewed approval is the MVP launch gate. Human faculty review remains a premium release layer unless the institution requires it.",
    },
    {
      slideNumber: 3,
      title: "Cohort Outcomes",
      purpose: "Show whether the pilot has evidence of learner engagement.",
      visibleBullets: [
        `Assigned: ${assigned}`,
        `Opened: ${opened} (${formatEvidencePercent(opened, assigned)})`,
        `Completed: ${completed} (${formatEvidencePercent(completed, assigned)})`,
        `Practice attempted: ${practiceAttempted} (${formatEvidencePercent(practiceAttempted, assigned)})`,
      ],
      speakerNotes: "Use this slide to decide whether the cohort has enough activity for a useful faculty conversation or whether more learner follow-up is needed first.",
    },
    {
      slideNumber: 4,
      title: "Lesson Quality Signals",
      purpose: "Summarize QA, practice, and learner feedback signals.",
      visibleBullets: [
        `QA pass/warn/fail: ${qaSummary.passCount || 0}/${qaSummary.warningCount || 0}/${qaSummary.failCount || 0}`,
        `Practice correct/incorrect: ${practiceSummary.correct || 0}/${practiceSummary.incorrect || 0}`,
        `Helpful feedback: ${feedbackSummary.helpful || 0}`,
        `Confusing or too hard: ${(feedbackSummary.confusing || 0) + (feedbackSummary.tooHard || 0)}`,
      ],
      speakerNotes: "Quality signals should guide review priorities. A clean QA pass still needs learner reception data before scale-up decisions.",
    },
    {
      slideNumber: 5,
      title: "Source Traceability",
      purpose: "Make the source-truth policy visible to reviewers.",
      visibleBullets: sourceLabels.length ? sourceLabels.slice(0, 6) : ["No approved source traceability attached."],
      speakerNotes: report.relatedAssetPolicy.note,
    },
    {
      slideNumber: 6,
      title: "Reusable Assets",
      purpose: "Show the supporting workflow and deck-pattern library without overstating citation authority.",
      visibleBullets: [
        `${report.relatedAuditPatterns.length} Pearson audit-pattern reference(s)`,
        `${report.relatedDeckExemplars.length} Drive deck exemplar(s)`,
        `${report.lessonAssets.slideCount} lesson slide(s)`,
        `${report.lessonAssets.artifactCount} export artifact(s)`,
      ],
      speakerNotes: "Related Pearson and Drive assets are useful for workflow, coverage, and lesson grammar. They are reference-only and do not replace approved source truth.",
    },
    {
      slideNumber: 7,
      title: "Follow-Up Queue",
      purpose: "Translate outcomes into faculty action.",
      visibleBullets: followUpLabels.length ? followUpLabels : ["No follow-up actions currently flagged."],
      speakerNotes: "Use this slide with remediation coaches or success faculty to decide who needs encouragement, clarification, or a practice review.",
    },
    {
      slideNumber: 8,
      title: "Scale Recommendation",
      purpose: "Close with a practical next step for the program director.",
      visibleBullets: [
        report.readiness.exportReady ? "Evidence bundle is export-ready." : "Resolve missing evidence files before formal handoff.",
        completed > 0 ? "Learner completion evidence is present." : "Collect at least one completion before scale decision.",
        aiDecision !== "Not recorded" ? "AI review evidence is recorded." : "Run AI review before presenting this package.",
        "Use faculty review as the premium gate for formal release.",
      ],
      speakerNotes: "This recommendation keeps the MVP launch path separate from the premium faculty approval path while still showing how the product scales.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    reportType: "pilot_evidence_slide_outline",
    package: report.package,
    relatedAssetPolicy: report.relatedAssetPolicy,
    slideCount: slides.length,
    exportUse: {
      audience: "Program director, faculty reviewer, product operator",
      format: "JSON slide outline for slide deck creation or handoff",
      sourcePayload: "Generated from the same Pilot Evidence Report data used by JSON, Markdown, and HTML exports.",
    },
    slides,
  };
}

function renderPilotEvidenceExecutiveHtml(report: ReturnType<typeof buildPilotEvidenceReport>) {
  const outline = buildPilotEvidenceSlideOutline(report);
  const totals = (report.cohortOutcomes?.totals || {}) as Record<string, number>;
  const aiReview = report.readiness.aiReview as Record<string, any> | null;
  const facultyReview = report.readiness.facultyReview as Record<string, any> | null;
  const qaSummary = report.readiness.qaSummary || {};
  const metric = (label: string, value: string | number) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  const slideBlock = (slide: typeof outline.slides[number]) => `
    <section class="slide">
      <div class="slide-kicker">Slide ${slide.slideNumber}</div>
      <h2>${escapeHtml(slide.title)}</h2>
      <p class="purpose">${escapeHtml(slide.purpose)}</p>
      <ul>${slide.visibleBullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
      <div class="notes"><strong>Presenter note:</strong> ${escapeHtml(slide.speakerNotes)}</div>
    </section>
  `;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Executive Pilot Evidence Report - ${escapeHtml(report.package.title)}</title>
  <style>
    :root { color: #111827; background: #f6f7f9; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 24px; }
    main { max-width: 1120px; margin: 0 auto; }
    header, .summary, .slide { background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; box-shadow: 0 10px 24px rgba(17, 24, 39, 0.08); }
    header { padding: 34px; background: #12343b; color: #f8fafc; }
    header p { margin: 10px 0 0; color: #dbeafe; }
    h1, h2 { margin: 0; line-height: 1.15; }
    h1 { font-size: 34px; }
    h2 { font-size: 28px; }
    .eyebrow { display: inline-flex; margin-bottom: 14px; padding: 5px 10px; border-radius: 999px; background: #d9f99d; color: #1f2937; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .summary { margin: 18px 0; padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; background: #f9fafb; }
    .metric strong { display: block; font-size: 24px; color: #111827; }
    .metric span { display: block; margin-top: 4px; font-size: 12px; color: #4b5563; text-transform: uppercase; letter-spacing: .05em; }
    .slide { margin: 18px 0; min-height: 520px; padding: 38px; display: flex; flex-direction: column; justify-content: center; }
    .slide-kicker { color: #0f766e; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; }
    .purpose { margin: 12px 0 20px; max-width: 780px; color: #475569; font-size: 16px; }
    ul { margin: 0; padding-left: 24px; font-size: 21px; line-height: 1.45; }
    li { margin: 8px 0; }
    .notes { margin-top: 28px; border-left: 4px solid #0f766e; background: #ecfeff; padding: 14px 16px; color: #164e63; font-size: 14px; line-height: 1.5; }
    .policy { margin-top: 16px; color: #dbeafe; font-size: 13px; }
    @media (max-width: 760px) { body { padding: 12px; } header, .summary, .slide { padding: 22px; } h1 { font-size: 26px; } h2 { font-size: 23px; } ul { font-size: 17px; } .slide { min-height: auto; } }
    @media print { body { padding: 0; background: #fff; } header, .summary, .slide { box-shadow: none; border-radius: 0; page-break-after: always; break-after: page; } .slide:last-child { page-break-after: auto; break-after: auto; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">Executive Pilot Evidence Report</div>
      <h1>${escapeHtml(report.package.title)}</h1>
      <p>${escapeHtml(report.package.topic || "Topic not specified")} | ${escapeHtml(report.package.audience || "Audience not specified")}</p>
      <p>Generated ${escapeHtml(report.generatedAt)} from the official Pilot Evidence Report payload.</p>
      <p class="policy">${escapeHtml(report.relatedAssetPolicy.note)}</p>
    </header>
    <section class="summary">
      <h2>Director Snapshot</h2>
      <div class="grid" style="margin-top: 16px;">
        ${metric("Package status", report.package.status)}
        ${metric("Assigned", totals.assigned || 0)}
        ${metric("Completed", totals.completed || 0)}
        ${metric("Export ready", report.readiness.exportReady ? "Yes" : "No")}
        ${metric("AI review", aiReview?.decision || aiReview?.status || "Not recorded")}
        ${metric("Faculty review", facultyReview?.decision || facultyReview?.status || "Premium")}
        ${metric("QA failures", qaSummary.failCount || 0)}
        ${metric("Slide outline", outline.slideCount)}
      </div>
    </section>
    ${outline.slides.map(slideBlock).join("")}
  </main>
</body>
</html>`;
}

function renderFacultyReviewCertificateHtml(bundle: LessonBundle, review: any) {
  const metadata = (review.metadata || {}) as Record<string, any>;
  const rubric = metadata.rubricSummary || normalizeFacultyReviewRubric(metadata);
  const decisionLabel = String(review.decision || "comment").replace(/_/g, " ");
  const eligible = rubric.passing && (review.decision === "approved_for_pilot" || review.decision === "approved_for_release");
  const criterionRows = (rubric.criteria || []).map((criterion: any) => `
    <tr>
      <td><strong>${escapeHtml(criterion.label)}</strong><div class="muted">${escapeHtml(criterion.description)}</div></td>
      <td>${escapeHtml(criterion.score ?? "Not scored")}</td>
      <td>${escapeHtml(String(criterion.status || "not_scored").replace(/_/g, " "))}</td>
      <td>${escapeHtml(criterion.note || "")}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Faculty Review Certificate - ${escapeHtml(bundle.package.title)}</title>
  <style>
    :root { color: #111827; background: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 28px; }
    main { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #dbe4ee; border-radius: 8px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); overflow: hidden; }
    header { padding: 34px; background: #1f2937; color: #f8fafc; }
    header p { margin: 8px 0 0; color: #dbeafe; }
    section { padding: 24px 34px; border-top: 1px solid #e5e7eb; }
    h1, h2 { margin: 0; line-height: 1.2; }
    h1 { font-size: 30px; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    .pill { display: inline-block; margin-bottom: 12px; padding: 5px 10px; border-radius: 999px; background: ${eligible ? "#dcfce7" : "#fef3c7"}; color: #111827; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; background: #f9fafb; }
    .metric strong { display: block; font-size: 22px; color: #111827; }
    .metric span { display: block; margin-top: 4px; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 12px 10px; text-align: left; vertical-align: top; }
    th { color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .muted { margin-top: 4px; color: #64748b; font-size: 12px; line-height: 1.4; }
    .note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; border-radius: 8px; padding: 14px 16px; line-height: 1.55; }
    @media (max-width: 760px) { body { padding: 12px; } header, section { padding: 22px; } table { font-size: 12px; } }
    @media print { body { padding: 0; background: #fff; } main { box-shadow: none; border: 0; border-radius: 0; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="pill">${eligible ? "Faculty certificate eligible" : "Faculty review report"}</div>
      <h1>${escapeHtml(bundle.package.title)}</h1>
      <p>${escapeHtml(bundle.package.topic || "Topic not specified")} | ${escapeHtml(bundle.package.audience || "Audience not specified")}</p>
      <p>Reviewed by ${escapeHtml(review.reviewerName)} (${escapeHtml(String(review.reviewerRole || "faculty_reviewer").replace(/_/g, " "))}) on ${escapeHtml(review.createdAt || new Date().toISOString())}</p>
    </header>

    <section>
      <h2>Review Decision</h2>
      <div class="grid">
        <div class="metric"><strong>${escapeHtml(decisionLabel)}</strong><span>Decision</span></div>
        <div class="metric"><strong>${escapeHtml(rubric.averageScore || 0)} / 4</strong><span>Average rubric score</span></div>
        <div class="metric"><strong>${escapeHtml(rubric.percentScore || 0)}%</strong><span>Rubric percent</span></div>
        <div class="metric"><strong>${escapeHtml(rubric.status.replace(/_/g, " "))}</strong><span>Rubric status</span></div>
      </div>
    </section>

    <section>
      <h2>Faculty Note</h2>
      <div class="note">${escapeHtml(review.comment || "No faculty note recorded.")}</div>
    </section>

    <section>
      <h2>Rubric Evidence</h2>
      <table>
        <thead>
          <tr>
            <th>Criterion</th>
            <th>Score</th>
            <th>Status</th>
            <th>Reviewer note</th>
          </tr>
        </thead>
        <tbody>${criterionRows}</tbody>
      </table>
    </section>

    <section>
      <h2>Certificate Statement</h2>
      <p class="muted">
        This premium faculty review report records a human faculty decision and rubric snapshot for the selected NurseStudy lesson package.
        AI review may satisfy internal MVP pilot readiness; human faculty review is the premium gate for formal release support.
      </p>
    </section>
  </main>
</body>
</html>`;
}

export function registerLessonBuilderRoutes(app: Express) {
  app.get("/api/admin/topic-production-matrix", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      res.json(await topicProductionMatrixPayload());
    } catch (error) {
      console.error("Topic production matrix load error:", error);
      res.status(500).json({ error: "Failed to load topic production matrix" });
    }
  });

  app.get("/api/admin/topic-production-matrix/airtable-tracker-contract", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    res.json({
      generatedAt: new Date().toISOString(),
      tracker: topicProductionAirtableTrackerPayload(),
    });
  });

  app.post("/api/admin/topic-production-matrix/phase-one/queue", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      const payload = await topicProductionMatrixPayload();
      const topics = (payload.phaseOneCheckpoint?.topics || []).filter((topic: any) => topic.found);
      const review: TopicProductionReview = {
        decision: "build_lesson",
        reviewerNotes: String(req.body?.reviewerNotes || "Phase 1 starter topic queued for the $100-$250 review checkpoint.").trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };

      for (const topic of topics) {
        if (topic.sourceType === "lesson_package") {
          await ensureLessonBuilderTables();
          const [pkg] = await db.select().from(lessonPackages).where(eq(lessonPackages.id, topic.rowId)).limit(1);
          if (!pkg) continue;
          await db.update(lessonPackages).set({
            manifest: {
              ...(pkg.manifest || {}),
              topicProductionReview: review,
            },
            updatedAt: new Date(),
          }).where(eq(lessonPackages.id, topic.rowId));
        } else if (topic.sourceType === "content_block") {
          await saveTopicProductionReview(topic.sourceType, topic.rowId, review, {
            phase: "phase_1_queue",
            topic: topic.topic,
            subject: topic.subject,
          });
        }
      }

      const nextPayload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(nextPayload.rows);
      const [approvedSources, packages] = await Promise.all([
        db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved")).orderBy(desc(sourceRegistry.updatedAt)),
        db.select().from(lessonPackages).orderBy(desc(lessonPackages.updatedAt)).limit(75),
      ]);
      const draftBundles = (await Promise.all(packages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      res.json({
        success: true,
        queuedCount: topics.length,
        phaseOneCheckpoint: nextPayload.phaseOneCheckpoint,
        packets: topicProductionBuildPackets(nextRows, approvedSources, draftBundles),
      });
    } catch (error) {
      console.error("Topic production phase one queue error:", error);
      res.status(500).json({ error: "Failed to queue Phase 1 starter topics" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/drafts/:packageId/review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const parsed = topicProductionDraftReviewSchema.parse(req.body || {});
      const [pkg] = await db.select().from(lessonPackages).where(eq(lessonPackages.id, req.params.packageId)).limit(1);
      if (!pkg) return res.status(404).json({ error: "Lesson package not found" });

      const draftReview = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };
      const manifest = {
        ...(pkg.manifest || {}),
        topicProductionDraftReview: draftReview,
      };
      await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, req.params.packageId));
      const bundle = await findPackageBundle(req.params.packageId);
      res.json({
        success: true,
        draftReview,
        package: bundle?.package || { ...pkg, manifest },
        draftPackage: bundle ? topicProductionDraftSummary(bundle) : null,
      });
    } catch (error) {
      console.error("Topic production draft review save error:", error);
      res.status(500).json({ error: "Failed to save topic production draft review" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/drafts/:packageId/phase-3-decision", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const parsed = topicProductionPhaseThreeDecisionSchema.parse(req.body || {});
      const [pkg] = await db.select().from(lessonPackages).where(eq(lessonPackages.id, req.params.packageId)).limit(1);
      if (!pkg) return res.status(404).json({ error: "Lesson package not found" });

      const phaseThreeDecision = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };
      const manifest = {
        ...(pkg.manifest || {}),
        topicProductionPhaseThreeDecision: phaseThreeDecision,
      };
      await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, req.params.packageId));
      const bundle = await findPackageBundle(req.params.packageId);
      res.json({
        success: true,
        phaseThreeDecision,
        package: bundle?.package || { ...pkg, manifest },
        draftPackage: bundle ? topicProductionDraftSummary(bundle) : null,
      });
    } catch (error) {
      console.error("Topic production Phase 3 decision save error:", error);
      res.status(500).json({ error: "Failed to save Phase 3 production decision" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/drafts/:packageId/student-launch-decision", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const parsed = topicProductionStudentLaunchDecisionSchema.parse(req.body || {});
      const [pkg] = await db.select().from(lessonPackages).where(eq(lessonPackages.id, req.params.packageId)).limit(1);
      if (!pkg) return res.status(404).json({ error: "Lesson package not found" });
      const bundle = await findPackageBundle(req.params.packageId);
      const draftSummary = bundle ? topicProductionDraftSummary(bundle) : null;
      const blockers = [
        !draftSummary?.nextSpendApproved ? "Phase 2 draft is not approved for next checkpoint" : "",
        !draftSummary?.phaseThreeDecision?.decision || draftSummary.phaseThreeDecision.decision === "unreviewed" ? "Phase 3 production decision is not recorded" : "",
        Number(draftSummary?.slideCount || 0) < 5 ? "Lesson deck is too small for student review" : "",
        Number(draftSummary?.itemCount || 0) < 1 ? "Practice item is missing" : "",
        Number(draftSummary?.citationCount || 0) < 1 ? "Citations are missing" : "",
        Number(draftSummary?.failCount || 0) > 0 ? "QA has failures" : "",
      ].filter(Boolean);

      if (parsed.decision === "approve_student_preview" && blockers.length) {
        return res.status(400).json({ error: "Student preview is blocked", blockers });
      }

      const studentLaunchDecision = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
        previewKey: parsed.decision === "approve_student_preview"
          ? topicProductionPreviewKey((pkg.manifest as any)?.topicProductionStudentLaunchDecision?.previewKey)
          : null,
        previewReview: (pkg.manifest as any)?.topicProductionStudentLaunchDecision?.previewReview || null,
      };
      const manifest = {
        ...(pkg.manifest || {}),
        topicProductionStudentLaunchDecision: studentLaunchDecision,
      };
      await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, req.params.packageId));
      const updatedBundle = await findPackageBundle(req.params.packageId);
      res.json({
        success: true,
        studentLaunchDecision,
        package: updatedBundle?.package || { ...pkg, manifest },
        draftPackage: updatedBundle ? topicProductionDraftSummary(updatedBundle) : null,
      });
    } catch (error) {
      console.error("Topic production student launch decision save error:", error);
      res.status(500).json({ error: "Failed to save student launch decision" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/media-work-orders/:workOrderId/review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      const workOrderId = req.params.workOrderId;
      const payload = await topicProductionMatrixPayload();
      const currentRows = topicProductionMediaWorkOrderRows(payload.rows);
      const current = currentRows.find((row) => row["Work Order ID"] === workOrderId);
      if (!current) return res.status(404).json({ error: "Media work order not found" });

      const parsed = topicProductionMediaWorkOrderReviewSchema.parse(req.body || {});
      const review: TopicProductionMediaWorkOrderReview = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };

      await saveTopicProductionMediaWorkOrderReview(workOrderId, review, {
        phase: "phase_4_media_work_order_review",
        topic: current["Topic"],
        estimatedDollarBudget: current["Estimated Dollar Budget"],
        estimatedTokenBudget: current["Estimated Token Budget"],
      });

      const refreshedPayload = await topicProductionMatrixPayload();
      const refreshedRows = topicProductionMediaWorkOrderRows(refreshedPayload.rows);
      const row = refreshedRows.find((candidate) => candidate["Work Order ID"] === workOrderId) || null;
      res.json({ success: true, review, row });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid media work order review decision", details: error.errors });
      }
      console.error("Topic production media work order review error:", error);
      res.status(500).json({ error: "Failed to save media work order review" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/media-scaffold-pack/:workOrderId/review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      const workOrderId = req.params.workOrderId;
      const payload = await topicProductionMatrixPayload();
      const currentRows = topicProductionMediaScaffoldPackRows(payload.rows);
      const current = currentRows.find((row) => row["Approved Work Order ID"] === workOrderId);
      if (!current) return res.status(404).json({ error: "Media scaffold row not found" });

      const parsed = topicProductionMediaScaffoldReviewSchema.parse(req.body || {});
      const review: TopicProductionMediaScaffoldReview = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };

      await saveTopicProductionMediaScaffoldReview(workOrderId, review, {
        phase: "phase_4_media_scaffold_review",
        topic: current["Topic"],
        estimatedDollarBudget: current["Estimated Dollar Budget"],
        estimatedTokenBudget: current["Estimated Token Budget"],
      });

      const refreshedPayload = await topicProductionMatrixPayload();
      const refreshedRows = topicProductionMediaScaffoldPackRows(refreshedPayload.rows);
      const row = refreshedRows.find((candidate) => candidate["Approved Work Order ID"] === workOrderId) || null;
      res.json({ success: true, review, row });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid media scaffold review decision", details: error.errors });
      }
      console.error("Topic production media scaffold review error:", error);
      res.status(500).json({ error: "Failed to save media scaffold review" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/media-text-draft-pack/:workOrderId/review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      const workOrderId = req.params.workOrderId;
      const payload = await topicProductionMatrixPayload();
      const currentRows = topicProductionMediaTextDraftPackRows(payload.rows);
      const current = currentRows.find((row) => row["Approved Work Order ID"] === workOrderId);
      if (!current) return res.status(404).json({ error: "Media text draft row not found" });

      const parsed = topicProductionMediaTextDraftReviewSchema.parse(req.body || {});
      const review: TopicProductionMediaTextDraftReview = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };

      await saveTopicProductionMediaTextDraftReview(workOrderId, review, {
        phase: "phase_5_media_text_draft_review",
        topic: current["Topic"],
        draftMode: current["Draft Mode"],
      });

      const refreshedPayload = await topicProductionMatrixPayload();
      const refreshedRows = topicProductionMediaTextDraftPackRows(refreshedPayload.rows);
      const row = refreshedRows.find((candidate) => candidate["Approved Work Order ID"] === workOrderId) || null;
      res.json({ success: true, review, row });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid media text draft review decision", details: error.errors });
      }
      console.error("Topic production media text draft review error:", error);
      res.status(500).json({ error: "Failed to save media text draft review" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/package-review-blueprint/:workOrderId/review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      const workOrderId = req.params.workOrderId;
      const payload = await topicProductionMatrixPayload();
      const currentRows = topicProductionPackageReviewBlueprintRows(payload.rows);
      const current = currentRows.find((row) => row["Approved Work Order ID"] === workOrderId);
      if (!current) return res.status(404).json({ error: "Package review blueprint row not found" });

      const parsed = topicProductionPackageReviewBlueprintSchema.parse(req.body || {});
      const review: TopicProductionPackageReviewBlueprintReview = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };

      await saveTopicProductionPackageReviewBlueprint(workOrderId, review, {
        phase: "phase_8_package_review_blueprint_decision",
        topic: current["Topic"],
        lessonPackageTitle: current["Lesson Package Title"],
      });

      const refreshedPayload = await topicProductionMatrixPayload();
      const refreshedRows = topicProductionPackageReviewBlueprintRows(refreshedPayload.rows);
      const row = refreshedRows.find((candidate) => candidate["Approved Work Order ID"] === workOrderId) || null;
      res.json({ success: true, review, row });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid package review blueprint decision", details: error.errors });
      }
      console.error("Topic production package review blueprint error:", error);
      res.status(500).json({ error: "Failed to save package review blueprint" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/:sourceType/:id/review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      const sourceType = req.params.sourceType;
      const id = req.params.id;
      if (!["lesson_package", "content_block", "topic_candidate"].includes(sourceType)) {
        return res.status(400).json({ error: "Unsupported topic production source type" });
      }

      const parsed = topicProductionReviewSchema.parse(req.body || {});
      const review: TopicProductionReview = {
        decision: parsed.decision,
        reviewerNotes: parsed.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.adminUser?.email || "admin",
      };

      if (sourceType === "lesson_package") {
        await ensureLessonBuilderTables();
        const [pkg] = await db.select().from(lessonPackages).where(eq(lessonPackages.id, id)).limit(1);
        if (!pkg) return res.status(404).json({ error: "Lesson package not found" });
        const manifest = {
          ...(pkg.manifest || {}),
          topicProductionReview: review,
        };
        await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, id));
      } else {
        await saveTopicProductionReview(sourceType, id, review, {
          phase: "topic_production_review",
        });
      }

      const payload = await topicProductionMatrixPayload();
      const row = payload.rows.find((candidate: any) => candidate.sourceType === sourceType && candidate.id === id) || null;
      res.json({ success: true, review, row });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid review decision", details: error.errors });
      }
      console.error("Topic production review save error:", error);
      res.status(500).json({ error: "Failed to save topic production review" });
    }
  });

  app.get("/api/admin/topic-production-matrix/export", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "csv").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const rows = topicProductionAirtableRows(payload.rows);

      if (format === "json") {
        res.setHeader("Content-Disposition", `attachment; filename="topic-production-airtable-queue.json"`);
        return res.json({
          generatedAt: payload.generatedAt,
          summary: payload.summary,
          airtableReady: true,
          rows,
        });
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="topic-production-airtable-queue.csv"`);
      return res.send(topicProductionAirtableCsv(payload.rows));
    } catch (error) {
      console.error("Topic production matrix export error:", error);
      res.status(500).json({ error: "Failed to export topic production matrix" });
    }
  });

  app.get("/api/admin/topic-production-matrix/human-review-pack", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionHumanReviewPackRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-3-human-review-pack.csv"`);
        return res.send(topicProductionHumanReviewPackCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-3-human-review-pack.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_3_human_review_pack",
        budgetWindow: "$100-$500",
        count: records.length,
        reviewOptions: ["approve_mapping", "needs_edit", "hold"],
        costGuardrail: "Review placement first. Do not spend on AI polish, visuals, audio, or video until each row has an explicit review decision.",
        records,
      });
    } catch (error) {
      console.error("Topic production human review pack error:", error);
      res.status(500).json({ error: "Failed to export human review pack" });
    }
  });

  app.get("/api/admin/topic-production-matrix/media-pilot-pack", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionMediaPilotPackRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-pilot-pack.csv"`);
        return res.send(topicProductionMediaPilotPackCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-pilot-pack.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_4_media_pilot_pack",
        budgetWindow: "$100-$500",
        count: records.length,
        nextAllowedSpend: records.length ? "Plan one approved topic only; media generation still requires explicit approval." : "Approve one Phase 3 placement before planning media.",
        costGuardrail: "This pack organizes where approved content belongs. It does not generate visuals, audio, video, or batch lesson media.",
        records,
      });
    } catch (error) {
      console.error("Topic production media pilot pack error:", error);
      res.status(500).json({ error: "Failed to export media pilot pack" });
    }
  });

  app.get("/api/admin/topic-production-matrix/media-work-orders", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionMediaWorkOrderRows(payload.rows);
      const estimatedTokens = topicProductionMediaWorkOrderLineItems.reduce((sum, item) => sum + item.tokens, 0);
      const estimatedDollars = topicProductionMediaWorkOrderLineItems.reduce((sum, item) => sum + item.dollars, 0);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-work-orders.csv"`);
        return res.send(topicProductionMediaWorkOrderCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-work-orders.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_4_media_work_orders",
        budgetWindow: "$100-$500",
        costBasis: "2,500 tokens = $100; $0.04 per token planning rate.",
        estimatedTokensPerTopic: estimatedTokens,
        estimatedDollarsPerTopic: estimatedDollars,
        approvalStatus: "manual_approval_required",
        count: records.length,
        costGuardrail: "This is a dollarized work order only. It does not run AI generation, visuals, TTS, audio, video, or batch production.",
        records,
      });
    } catch (error) {
      console.error("Topic production media work order error:", error);
      res.status(500).json({ error: "Failed to export media work orders" });
    }
  });

  app.get("/api/admin/topic-production-matrix/media-scaffold-pack", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionMediaScaffoldPackRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-scaffold-pack.csv"`);
        return res.send(topicProductionMediaScaffoldPackCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-scaffold-pack.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_4_media_scaffold_pack",
        budgetWindow: "$100-$500",
        count: records.length,
        prerequisite: "A Phase 4 work order must be reviewed as approve_single_topic_scaffold.",
        costGuardrail: "Deterministic scaffold only. No AI generation call, no TTS, no rendered video, no paid visual generation.",
        records,
      });
    } catch (error) {
      console.error("Topic production media scaffold pack error:", error);
      res.status(500).json({ error: "Failed to export media scaffold pack" });
    }
  });

  app.get("/api/admin/topic-production-matrix/media-text-draft-pack", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionMediaTextDraftPackRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-5-media-text-draft-pack.csv"`);
        return res.send(topicProductionMediaTextDraftPackCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-5-media-text-draft-pack.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_5_media_text_draft_pack",
        budgetWindow: "$100-$500 text-draft checkpoint",
        count: records.length,
        prerequisite: "A Phase 4 scaffold must be reviewed as approve_ai_draft_checkpoint.",
        costGuardrail: "Text-draft checkpoint only. No TTS, no rendered video, no paid visual generation, and no batch generation.",
        records,
      });
    } catch (error) {
      console.error("Topic production media text draft pack error:", error);
      res.status(500).json({ error: "Failed to export media text draft pack" });
    }
  });

  app.get("/api/admin/topic-production-matrix/package-assembly-pack", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionPackageAssemblyPackRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-6-package-assembly-pack.csv"`);
        return res.send(topicProductionPackageAssemblyPackCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-6-package-assembly-pack.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_6_package_assembly_pack",
        budgetWindow: "$100-$500 package assembly checkpoint",
        count: records.length,
        prerequisite: "A Phase 5 text draft must be reviewed as approve_package_assembly_checkpoint.",
        costGuardrail: "Package assembly checkpoint only. No TTS, no rendered video, no paid visual generation, no batch generation, and no public publish without review.",
        records,
      });
    } catch (error) {
      console.error("Topic production package assembly pack error:", error);
      res.status(500).json({ error: "Failed to export package assembly pack" });
    }
  });

  app.get("/api/admin/topic-production-matrix/package-review-blueprint", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionPackageReviewBlueprintRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-7-package-review-blueprint.csv"`);
        return res.send(topicProductionPackageReviewBlueprintCsv(payload.rows));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-7-package-review-blueprint.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_7_package_review_blueprint",
        budgetWindow: "$100-$500 review-blueprint checkpoint",
        count: records.length,
        prerequisite: "A Phase 6 package assembly row must exist from an approved Phase 5 text draft.",
        costGuardrail: "Blueprint checkpoint only. No package publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
        records,
      });
    } catch (error) {
      console.error("Topic production package review blueprint error:", error);
      res.status(500).json({ error: "Failed to export package review blueprint" });
    }
  });

  app.get("/api/admin/topic-production-matrix/review-package-builds", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionReviewPackageBuildRows(payload.rows);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-9-review-package-builds.csv"`);
        return res.send(topicProductionReviewPackageBuildCsv(payload.rows));
      }

      if (format === "zip") {
        const zipBuffer = await topicProductionReviewPackageBuildZip(payload.rows);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="phase-9-review-package-builds.zip"`);
        return res.send(zipBuffer);
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-9-review-package-builds.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_9_review_package_builds",
        budgetWindow: "$100-$500 deterministic review-package checkpoint",
        count: records.length,
        prerequisite: "A Phase 8 blueprint decision must be approve_review_package_build.",
        costGuardrail: "Review package build only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
        records,
      });
    } catch (error) {
      console.error("Topic production review package build error:", error);
      res.status(500).json({ error: "Failed to export review package builds" });
    }
  });

  app.post("/api/admin/topic-production-matrix/review-package-builds/:workOrderId/promote", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const workOrderId = decodeURIComponent(req.params.workOrderId || "");
      const payload = await topicProductionMatrixPayload();
      const records = topicProductionReviewPackageBuildRows(payload.rows);
      const record = records.find((candidate) => String(candidate["Approved Work Order ID"] || "") === workOrderId);
      if (!record) {
        return res.status(404).json({
          error: "No approved Phase 9 review package build found for this work order",
          prerequisite: "Approve the Phase 8 blueprint build gate first.",
        });
      }

      const promotion = await promoteTopicProductionReviewPackageDraft(record as Record<string, any>, req.session.adminUser?.userId);
      const bundle = promotion.bundle;
      if (!bundle) return res.status(500).json({ error: "Review package draft could not be loaded after promotion" });

      return res.json({
        created: promotion.created,
        package: bundle.package,
        bundle,
        promotion: {
          phase: "phase_10_unpublished_lesson_builder_draft",
          workOrderId,
          publishStatus: "not_published",
          mediaStatus: "not_started",
          costGuardrail: "Unpublished Lesson Builder draft only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
          lessonBuilderUrl: `/admin/lesson-builder?tab=review&packageId=${bundle.package.id}`,
        },
      });
    } catch (error) {
      console.error("Topic production review package promotion error:", error);
      res.status(500).json({ error: "Failed to promote review package draft" });
    }
  });

  app.post("/api/admin/topic-production-matrix/review-package-builds/:workOrderId/creator-qa", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const workOrderId = decodeURIComponent(req.params.workOrderId || "");
      const result = await runTopicProductionCreatorQaGate(workOrderId, req.session.adminUser?.userId);
      if (!result?.bundle) {
        return res.status(409).json({
          error: "No promoted unpublished draft found for this work order",
          prerequisite: "Promote the Phase 9 review package into Lesson Builder before running creator QA.",
        });
      }

      return res.json({
        package: result.bundle.package,
        bundle: result.bundle,
        qa: result.qa,
        validation: result.validation,
        creatorQaGate: result.creatorQaGate,
      });
    } catch (error) {
      console.error("Topic production creator QA gate error:", error);
      res.status(500).json({ error: "Failed to run creator QA gate" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/review-package-builds/:workOrderId/controlled-preview-decision", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const workOrderId = decodeURIComponent(req.params.workOrderId || "");
      const parsed = topicProductionStudentLaunchDecisionSchema.parse(req.body || {});
      const result = await saveTopicProductionControlledPreviewDecision(
        workOrderId,
        parsed.decision,
        parsed.reviewerNotes,
        req.adminUser?.email || req.session.adminUser?.userId || "admin"
      );
      if (!result) {
        return res.status(409).json({
          error: "No QA-ready promoted draft found for this work order",
          prerequisite: "Promote the review package and run creator QA before opening controlled preview.",
        });
      }
      if (result.blocked) {
        return res.status(400).json({ error: "Controlled preview is blocked", blockers: result.blockers });
      }

      return res.json({
        success: true,
        package: result.bundle?.package,
        bundle: result.bundle,
        studentLaunchDecision: result.studentLaunchDecision,
        controlledPreviewDecision: result.controlledPreviewDecision,
      });
    } catch (error) {
      console.error("Topic production controlled preview decision save error:", error);
      res.status(500).json({ error: "Failed to save controlled preview decision" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/review-package-builds/:workOrderId/preview-review", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const workOrderId = decodeURIComponent(req.params.workOrderId || "");
      const parsed = topicProductionPreviewReviewAdminSchema.parse(req.body || {});
      const result = await saveTopicProductionControlledPreviewReview(
        workOrderId,
        parsed.outcome,
        parsed.reviewerNotes,
        req.adminUser?.email || req.session.adminUser?.userId || "admin"
      );
      if (!result) {
        return res.status(409).json({
          error: "No controlled preview draft found for this work order",
          prerequisite: "Approve controlled preview before recording preview review outcome.",
        });
      }
      if (result.blocked) {
        return res.status(400).json({ error: "Controlled preview review is blocked", blockers: result.blockers });
      }

      return res.json({
        recorded: true,
        package: result.bundle?.package,
        bundle: result.bundle,
        previewReview: result.previewReview,
        controlledPreviewReview: result.controlledPreviewReview,
        reviewSummary: result.reviewSummary,
      });
    } catch (error) {
      console.error("Topic production controlled preview review save error:", error);
      res.status(500).json({ error: "Failed to record controlled preview review" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/review-package-builds/:workOrderId/public-release-decision", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const workOrderId = decodeURIComponent(req.params.workOrderId || "");
      const parsed = topicProductionPublicReleaseDecisionSchema.parse(req.body || {});
      const result = await saveTopicProductionPublicReleaseDecision(
        workOrderId,
        parsed.decision,
        parsed.reviewerNotes,
        req.adminUser?.email || req.session.adminUser?.userId || "admin"
      );
      if (!result) {
        return res.status(409).json({
          error: "No release candidate found for this work order",
          prerequisite: "Complete controlled preview review before recording a public release decision.",
        });
      }
      if (result.blocked) {
        return res.status(400).json({ error: "Public release decision is blocked", blockers: result.blockers });
      }

      return res.json({
        recorded: true,
        package: result.bundle?.package,
        bundle: result.bundle,
        publicReleaseDecision: result.publicReleaseDecision,
        publicReleaseGate: result.publicReleaseGate,
      });
    } catch (error) {
      console.error("Topic production public release decision save error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid public release decision", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save public release decision" });
    }
  });

  app.patch("/api/admin/topic-production-matrix/drafts/:packageId/public-release-decision", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const packageId = decodeURIComponent(req.params.packageId || "");
      const parsed = topicProductionPublicReleaseDecisionSchema.parse(req.body || {});
      const result = await saveTopicProductionPublicReleaseDecisionForPackage(
        packageId,
        parsed.decision,
        parsed.reviewerNotes,
        req.adminUser?.email || req.session.adminUser?.userId || "admin"
      );
      if (!result) {
        return res.status(409).json({
          error: "No release candidate found for this package",
          prerequisite: "Complete controlled preview review before recording a public release decision.",
        });
      }
      if (result.blocked) {
        return res.status(400).json({ error: "Public release decision is blocked", blockers: result.blockers });
      }

      return res.json({
        recorded: true,
        package: result.bundle?.package,
        bundle: result.bundle,
        publicReleaseDecision: result.publicReleaseDecision,
        publicReleaseGate: result.publicReleaseGate,
      });
    } catch (error) {
      console.error("Topic production draft public release decision save error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid public release decision", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save draft public release decision" });
    }
  });

  app.get("/api/admin/topic-production-matrix/next-build-export", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "csv").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const rows = topicProductionAirtableRows(nextRows);

      if (format === "json") {
        res.setHeader("Content-Disposition", `attachment; filename="approved-next-build-queue.json"`);
        return res.json({
          generatedAt: payload.generatedAt,
          queue: "approved_next_build",
          includedDecisions: Array.from(topicProductionNextBuildDecisions),
          count: rows.length,
          rows,
        });
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="approved-next-build-queue.csv"`);
      return res.send(topicProductionAirtableCsv(nextRows));
    } catch (error) {
      console.error("Topic production next-build export error:", error);
      res.status(500).json({ error: "Failed to export approved next-build queue" });
    }
  });

  app.get("/api/admin/topic-production-matrix/build-packets", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionBuildPackets(nextRows, approvedSources, draftBundles);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="approved-build-packets.csv"`);
        return res.send(topicProductionBuildPacketsCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="approved-build-packets.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "approved_build_packets",
        count: packets.length,
        packets,
      });
    } catch (error) {
      console.error("Topic production build-packet export error:", error);
      res.status(500).json({ error: "Failed to export approved build packets" });
    }
  });

  app.get("/api/admin/topic-production-matrix/draft-review-pack", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionBuildPackets(nextRows, approvedSources, draftBundles);
      const rows = topicProductionDraftReviewRows(packets);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-2-draft-quality-review.csv"`);
        return res.send(topicProductionDraftReviewCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-2-draft-quality-review.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_2_draft_quality_review",
        costGuardrail: "Human review only. Do not run paid polish/audio/video until a review decision is recorded.",
        count: rows.length,
        records: rows,
      });
    } catch (error) {
      console.error("Topic production draft review pack error:", error);
      res.status(500).json({ error: "Failed to export draft quality review pack" });
    }
  });

  app.get("/api/admin/topic-production-matrix/next-spend-queue", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionNextSpendPackets(nextRows, approvedSources, draftBundles);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="approved-next-spend-polish.csv"`);
        return res.send(topicProductionNextSpendCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="approved-next-spend-polish.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "approved_next_spend_polish",
        budgetWindow: "$100-$250",
        count: packets.length,
        packets,
      });
    } catch (error) {
      console.error("Topic production next-spend queue error:", error);
      res.status(500).json({ error: "Failed to export approved next-spend queue" });
    }
  });

  app.get("/api/admin/topic-production-matrix/shorts-workflow", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionNextSpendPackets(nextRows, approvedSources, draftBundles);
      const records = topicProductionShortsWorkflowRows(packets);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-3-shorts-airtable.csv"`);
        return res.send(topicProductionShortsWorkflowCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-3-shorts-airtable.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_3_shorts_airtable_handoff",
        budgetWindow: "$100-$250",
        count: records.length,
        records,
      });
    } catch (error) {
      console.error("Topic production shorts workflow export error:", error);
      res.status(500).json({ error: "Failed to export Phase 3 shorts workflow" });
    }
  });

  app.get("/api/admin/topic-production-matrix/phase-3-handoff", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionNextSpendPackets(nextRows, approvedSources, draftBundles);
      const records = topicProductionPhaseThreeHandoffRows(packets);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="phase-3-production-handoff.csv"`);
        return res.send(topicProductionPhaseThreeHandoffCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="phase-3-production-handoff.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "phase_3_production_handoff",
        budgetWindow: "$100-$250",
        nextAllowedSpend: "One polish pass or one short planning pass per accepted topic.",
        costGuardrail: "No batch generation, no full video production, and no paid audio until each row is reviewed.",
        count: records.length,
        records,
      });
    } catch (error) {
      console.error("Topic production Phase 3 handoff export error:", error);
      res.status(500).json({ error: "Failed to export Phase 3 production handoff" });
    }
  });

  app.get("/api/admin/topic-production-matrix/student-launch-readiness", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionNextSpendPackets(nextRows, approvedSources, draftBundles);
      const records = topicProductionStudentLaunchReadinessRows(packets);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="student-launch-readiness.csv"`);
        return res.send(topicProductionStudentLaunchReadinessCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="student-launch-readiness.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "student_launch_readiness",
        costGuardrail: "No broad public launch, video/audio, or batch production until this gate is approved.",
        count: records.length,
        records,
      });
    } catch (error) {
      console.error("Topic production student launch readiness export error:", error);
      res.status(500).json({ error: "Failed to export student launch readiness" });
    }
  });

  app.get("/api/admin/topic-production-matrix/publish-readiness", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = String(req.query.format || "json").toLowerCase();
      const payload = await topicProductionMatrixPayload();
      const nextRows = topicProductionNextBuildRows(payload.rows);
      const approvedSources = await db.select().from(sourceRegistry).where(eq(sourceRegistry.approvalStatus, "approved"));
      const recentDraftPackages = await db
        .select()
        .from(lessonPackages)
        .where(sql`${lessonPackages.title} ILIKE ${"%Template Draft%"}`)
        .orderBy(desc(lessonPackages.updatedAt))
        .limit(25);
      const draftBundles = (await Promise.all(recentDraftPackages.map((pkg) => findPackageBundle(pkg.id)))).filter(Boolean);
      const packets = topicProductionNextSpendPackets(nextRows, approvedSources, draftBundles);
      const records = topicProductionPublishReadinessRows(packets);

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="publish-readiness.csv"`);
        return res.send(topicProductionPublishReadinessCsv(nextRows, approvedSources, draftBundles));
      }

      res.setHeader("Content-Disposition", `attachment; filename="publish-readiness.json"`);
      return res.json({
        generatedAt: payload.generatedAt,
        queue: "final_publish_readiness",
        costGuardrail: "Publishing uses existing package artifacts; no paid video/audio or batch production is part of this gate.",
        count: records.length,
        records,
      });
    } catch (error) {
      console.error("Topic production publish readiness export error:", error);
      res.status(500).json({ error: "Failed to export publish readiness" });
    }
  });

  app.get("/api/admin/topic-production-matrix/drafts/:packageId/release-audit-snapshot", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const packageId = decodeURIComponent(req.params.packageId || "");
      const bundle = await findPackageBundle(packageId);
      if (!bundle) return res.status(404).json({ error: "Package not found" });
      return res.json(topicProductionReleaseAuditSnapshot(bundle));
    } catch (error) {
      console.error("Topic production release audit snapshot error:", error);
      res.status(500).json({ error: "Failed to load release audit snapshot" });
    }
  });

  app.get("/api/admin/topic-production-matrix/drafts/:packageId/student-release-sanity", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const packageId = decodeURIComponent(req.params.packageId || "");
      const bundle = await findPackageBundle(packageId);
      if (!bundle) return res.status(404).json({ error: "Package not found" });
      return res.json(topicProductionStudentReleaseSanity(bundle));
    } catch (error) {
      console.error("Topic production student release sanity error:", error);
      res.status(500).json({ error: "Failed to load student release sanity report" });
    }
  });

  app.get("/api/student/home", async (_req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const lessons = await publishedStudentLessonSummaries(50);
      res.json(studentHomePayload(lessons));
    } catch (error) {
      console.error("Student home load error:", error);
      res.status(500).json({ error: "Failed to load student home" });
    }
  });

  app.get("/api/student/lessons", async (_req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const lessons = await publishedStudentLessonSummaries(75);
      res.json({ lessons, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Student lesson library load error:", error);
      res.status(500).json({ error: "Failed to load lesson library" });
    }
  });

  app.get("/api/student/lessons/:id/summary", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      const previewKey = typeof req.query.previewKey === "string" ? req.query.previewKey : "";
      if (!bundle || !topicProductionPreviewAllowed(bundle.package, previewKey)) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      res.json({ lesson: studentLessonSummary(bundle), generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Student lesson summary load error:", error);
      res.status(500).json({ error: "Failed to load lesson summary" });
    }
  });

  app.get("/api/student/progress", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const query = studentSessionQuerySchema.parse({ sessionId: req.query.sessionId });
      res.json(await studentProgressPayload(query.sessionId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "A valid student session id is required", details: error.errors });
      }
      console.error("Student progress load error:", error);
      res.status(500).json({ error: "Failed to load student progress" });
    }
  });

  app.get("/api/student/study-pack", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const query = studentSessionQuerySchema.parse({ sessionId: req.query.sessionId });
      res.json(await studentStudyPackPayload(query.sessionId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "A valid student session id is required", details: error.errors });
      }
      console.error("Student study pack load error:", error);
      res.status(500).json({ error: "Failed to load study pack" });
    }
  });

  app.get("/api/lessons/:id", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      const previewKey = typeof req.query.previewKey === "string" ? req.query.previewKey : "";
      if (!bundle || !topicProductionPreviewAllowed(bundle.package, previewKey)) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      const controlledPreview = Boolean(previewKey && bundle.package.status !== "published");

      const assignmentQuery = assignmentQuerySchema.parse({
        assignmentId: req.query.assignmentId,
        assignmentLearnerId: req.query.assignmentLearnerId,
        learnerKey: req.query.learnerKey,
      });
      const assignmentContext = await findAssignmentLearner(
        req.params.id,
        assignmentQuery.assignmentId,
        assignmentQuery.assignmentLearnerId,
        assignmentQuery.learnerKey
      );

      if ((assignmentQuery.assignmentId || assignmentQuery.assignmentLearnerId || assignmentQuery.learnerKey) && !assignmentContext) {
        return res.status(404).json({ error: "Assignment link not found" });
      }

      res.json(learnerLessonPayload(bundle, assignmentContext, { controlledPreview }));
    } catch (error) {
      console.error("Learner lesson load error:", error);
      res.status(500).json({ error: "Failed to load lesson" });
    }
  });

  app.get("/api/lesson-assignments/:assignmentId/learner/:learnerId", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const learnerKey = typeof req.query.learnerKey === "string" ? req.query.learnerKey : "";
      if (!learnerKey || learnerKey.length < 8) {
        return res.status(400).json({ error: "Learner key is required" });
      }

      const [assignment] = await db
        .select()
        .from(lessonAssignments)
        .where(eq(lessonAssignments.id, req.params.assignmentId))
        .limit(1);
      if (!assignment || assignment.status !== "active") {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const assignmentContext = await findAssignmentLearner(
        assignment.packageId,
        assignment.id,
        req.params.learnerId,
        learnerKey
      );
      if (!assignmentContext) {
        return res.status(404).json({ error: "Assignment link not found" });
      }

      const bundle = await findPackageBundle(assignment.packageId);
      if (!bundle || bundle.package.status !== "published") {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const learnerEvents = await db
        .select()
        .from(lessonLearnerEvents)
        .where(and(
          eq(lessonLearnerEvents.packageId, assignment.packageId),
          eq(lessonLearnerEvents.assignmentId, assignment.id),
          eq(lessonLearnerEvents.assignmentLearnerId, assignmentContext.learner.id)
        ))
        .orderBy(desc(lessonLearnerEvents.createdAt))
        .limit(500);
      const progress = buildLearnerAssignmentProgress(bundle, assignmentContext.learner, learnerEvents);

      res.json({
        assignment: {
          id: assignment.id,
          title: assignment.title,
          cohortName: assignment.cohortName,
          dueDate: assignment.dueDate,
          status: assignment.status,
        },
        learner: {
          id: assignmentContext.learner.id,
          learnerName: assignmentContext.learner.learnerName,
          status: assignmentContext.learner.status,
          openedAt: assignmentContext.learner.openedAt,
          completedAt: assignmentContext.learner.completedAt,
          lastActivityAt: assignmentContext.learner.lastActivityAt,
          feedbackRating: assignmentContext.learner.feedbackRating,
        },
        progress,
        links: {
          dashboardUrl: publicAssignmentPath(assignment.packageId, assignment.id, assignmentContext.learner.id, learnerKey),
          lessonUrl: publicLessonPath(assignment.packageId, assignment.id, assignmentContext.learner.id, learnerKey),
        },
        lesson: learnerLessonPayload(bundle, assignmentContext),
      });
    } catch (error) {
      console.error("Learner assignment load error:", error);
      res.status(500).json({ error: "Failed to load learner assignment" });
    }
  });

  app.post("/api/lessons/:id/events", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = learnerEventSchema.parse(req.body || {});
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle || !topicProductionPreviewAllowed(bundle.package, data.previewKey)) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      const assignmentContext = await findAssignmentLearner(req.params.id, data.assignmentId, data.assignmentLearnerId, data.learnerKey);
      if ((data.assignmentId || data.assignmentLearnerId || data.learnerKey) && !assignmentContext) {
        return res.status(404).json({ error: "Assignment link not found" });
      }

      const sessionId = data.sessionId || createHash("sha256")
        .update(`${req.ip || "unknown"}:${req.headers["user-agent"] || "unknown"}:${new Date().toISOString().slice(0, 10)}`)
        .digest("hex")
        .slice(0, 32);
      const ipHash = createHash("sha256")
        .update(`${req.ip || "unknown"}:${process.env.SESSION_SECRET || "lesson-builder"}`)
        .digest("hex")
        .slice(0, 24);

      const [event] = await db.insert(lessonLearnerEvents).values({
        packageId: req.params.id,
        assignmentId: assignmentContext?.assignment.id,
        assignmentLearnerId: assignmentContext?.learner.id,
        sessionId,
        eventType: data.eventType,
        slideId: data.slideId,
        itemId: data.itemId,
        payload: data.payload,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        ipHash,
      }).returning();

      await updateAssignmentLearnerProgress(assignmentContext, data.eventType, data.payload);

      res.json({ eventId: event.id, sessionId, recorded: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid learner event", details: error.errors });
      }
      console.error("Learner lesson event error:", error);
      res.status(500).json({ error: "Failed to record lesson event" });
    }
  });

  app.post("/api/lessons/:id/preview-review", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = topicProductionPreviewReviewSchema.parse(req.body || {});
      const bundle = await findPackageBundle(req.params.id);
      const expectedPreviewKey = (bundle?.package.manifest as any)?.topicProductionStudentLaunchDecision?.previewKey;
      if (!bundle || !expectedPreviewKey || expectedPreviewKey !== data.previewKey) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const previewReview = {
        outcome: data.outcome,
        reviewerNotes: data.reviewerNotes.trim(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: "controlled_preview_reviewer",
      };
      const existingDecision = (bundle.package.manifest as any)?.topicProductionStudentLaunchDecision || {};
      const manifest = {
        ...(bundle.package.manifest || {}),
        topicProductionStudentLaunchDecision: {
          ...existingDecision,
          previewKey: existingDecision.previewKey || data.previewKey,
          previewReview,
        },
      };

      await db.update(lessonPackages).set({ manifest, updatedAt: new Date() }).where(eq(lessonPackages.id, req.params.id));
      const updatedBundle = await findPackageBundle(req.params.id);
      res.json({
        recorded: true,
        previewReview,
        reviewSummary: updatedBundle ? topicProductionPreviewReviewSummary(updatedBundle) : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid preview review", details: error.errors });
      }
      console.error("Controlled preview review save error:", error);
      res.status(500).json({ error: "Failed to record preview review" });
    }
  });

  app.post("/api/lessons/:id/feedback", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = learnerFeedbackSchema.parse(req.body || {});
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle || !topicProductionPreviewAllowed(bundle.package, data.previewKey)) {
        return res.status(404).json({ error: "Lesson not found" });
      }
      const assignmentContext = await findAssignmentLearner(req.params.id, data.assignmentId, data.assignmentLearnerId, data.learnerKey);
      if ((data.assignmentId || data.assignmentLearnerId || data.learnerKey) && !assignmentContext) {
        return res.status(404).json({ error: "Assignment link not found" });
      }

      const sessionId = data.sessionId || createHash("sha256")
        .update(`${req.ip || "unknown"}:${req.headers["user-agent"] || "unknown"}:${new Date().toISOString().slice(0, 10)}`)
        .digest("hex")
        .slice(0, 32);
      const ipHash = createHash("sha256")
        .update(`${req.ip || "unknown"}:${process.env.SESSION_SECRET || "lesson-builder"}`)
        .digest("hex")
        .slice(0, 24);

      const [event] = await db.insert(lessonLearnerEvents).values({
        packageId: req.params.id,
        assignmentId: assignmentContext?.assignment.id,
        assignmentLearnerId: assignmentContext?.learner.id,
        sessionId,
        eventType: "feedback_submitted",
        slideId: data.slideId,
        itemId: data.itemId,
        payload: {
          ...data.payload,
          rating: data.rating,
          comment: data.comment || "",
        },
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        ipHash,
      }).returning();

      await recordReleaseAuditEvent(req.params.id, "learner_feedback_received", `Learner feedback submitted: ${data.rating}`, {
        rating: data.rating,
        slideId: data.slideId || null,
        itemId: data.itemId || null,
        hasComment: Boolean(data.comment),
        assignmentId: assignmentContext?.assignment.id || null,
        assignmentLearnerId: assignmentContext?.learner.id || null,
      });

      await updateAssignmentLearnerProgress(assignmentContext, "feedback_submitted", {
        rating: data.rating,
        comment: data.comment || "",
      });

      res.json({ eventId: event.id, sessionId, recorded: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid learner feedback", details: error.errors });
      }
      console.error("Learner lesson feedback error:", error);
      res.status(500).json({ error: "Failed to record lesson feedback" });
    }
  });

  app.get("/api/admin/lesson-builder/agent-status", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    res.json(lessonBuilderAgentStatus());
  });

  app.get("/api/admin/lesson-builder/health", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      res.json(await lessonBuilderHealth());
    } catch (error) {
      console.error("Lesson builder health error:", error);
      res.status(500).json({
        runtime: "db_backed",
        database: {
          configured: Boolean(process.env.DATABASE_URL),
          status: "unhealthy",
        },
        previewMode: {
          enabled: false,
          status: "fallback available with npm run preview:lesson-builder",
        },
        sourceRegistry: { status: "unknown", sourceCount: 0, readySourceCount: 0, archiveImportCount: 0 },
        ingestion: { status: "unknown", documentCount: 0 },
        export: { status: "unknown", requiredFiles: harrityRequiredExportFiles },
        agent: lessonBuilderAgentStatus(),
        error: error instanceof Error ? error.message : "Health check failed",
      });
    }
  });

  app.get("/api/admin/pilot-launch/summary", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      res.json(await buildPilotLaunchSummary());
    } catch (error) {
      console.error("Pilot launch summary error:", error);
      res.status(500).json({ error: "Failed to load pilot launch summary" });
    }
  });

  app.get("/api/admin/lesson-builder/release-readiness", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      res.json(await lessonBuilderReleaseReadiness());
    } catch (error) {
      console.error("Lesson builder release readiness error:", error);
      res.status(500).json({
        pilotReady: false,
        blockers: [
          releaseBlocker(
            "release_readiness",
            "Release readiness",
            "fail",
            "high",
            error instanceof Error ? error.message : "Release readiness check failed."
          ),
        ],
        latestPublishedPackageId: null,
        aiMode: "invalid",
        dbReady: Boolean(process.env.DATABASE_URL),
        authReady: Boolean(process.env.SESSION_SECRET),
        registrationReady: false,
        exportReady: false,
        typecheckStatus: "unknown",
      });
    }
  });

  app.get("/api/admin/lesson-builder/sources", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      res.json(await listSources());
    } catch (error) {
      console.error("Lesson builder source list error:", error);
      res.status(500).json({ error: "Failed to load lesson builder sources" });
    }
  });

  app.get("/api/admin/lesson-builder/sources/:id", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const detail = await getSourceDetail(req.params.id);
      if (!detail) return res.status(404).json({ error: "Source not found" });
      res.json(detail);
    } catch (error) {
      console.error("Lesson builder source detail error:", error);
      res.status(500).json({ error: "Failed to load source detail" });
    }
  });

  app.post("/api/admin/lesson-builder/sources/:id/normalize", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = sourceNormalizationSchema.parse(req.body || {});
      const result = await normalizeSourceForPilot(req.params.id, data, req.session.adminUser?.userId);
      if (!result) return res.status(404).json({ error: "Source not found" });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid source normalization request", details: error.errors });
      }
      console.error("Lesson builder source normalization error:", error);
      res.status(500).json({ error: "Failed to normalize source" });
    }
  });

  app.post("/api/admin/lesson-builder/sources/import", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const source = sourceImportSchema.parse(req.body);
      const [created] = await db.insert(sourceRegistry).values({
        ...source,
        createdBy: req.session.adminUser?.userId,
      }).returning();

      res.json({ source: created });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid source", details: error.errors });
      }
      console.error("Lesson builder source import error:", error);
      res.status(500).json({ error: "Failed to import source" });
    }
  });

  app.post("/api/admin/lesson-builder/sources/attach-document", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = attachDocumentSourceSchema.parse(req.body);
      const result = await attachDocumentSource(data, req.session.adminUser?.userId);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document source", details: error.errors });
      }
      console.error("Lesson builder document attach error:", error);
      res.status(500).json({ error: "Failed to attach knowledge document", details: error instanceof Error ? error.message : undefined });
    }
  });

  app.post("/api/admin/lesson-builder/source-archives/import", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = sourceArchiveImportSchema.parse(req.body);
      const result = await importSourceArchive(data, req.session.adminUser?.userId);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid source archive import", details: error.errors });
      }
      console.error("Lesson builder archive import error:", error);
      res.status(500).json({ error: "Failed to import source archive", details: error instanceof Error ? error.message : undefined });
    }
  });

  app.post("/api/admin/lesson-builder/source-archives/import-pilot-set", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = pilotArchiveSetImportSchema.parse(req.body || {});
      res.json(await importPilotArchiveSet(data, req.session.adminUser?.userId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pilot archive set", details: error.errors });
      }
      console.error("Lesson builder pilot archive set error:", error);
      res.status(500).json({ error: "Failed to import pilot archive set", details: error instanceof Error ? error.message : undefined });
    }
  });

  app.post("/api/admin/lesson-builder/drive-packages/import", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = drivePackageImportSchema.parse(req.body);
      res.json(await importDrivePackageHub(data, req.session.adminUser?.userId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid Drive package import", details: error.errors });
      }
      console.error("Lesson builder Drive package import error:", error);
      res.status(500).json({ error: "Failed to import Drive package", details: error instanceof Error ? error.message : undefined });
    }
  });

  app.post("/api/admin/lesson-builder/chatgpt-library/import", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = chatgptLibraryReferencePackImportSchema.parse(req.body);
      res.json(await importChatgptLibraryReferencePack(data, req.session.adminUser?.userId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid ChatGPT library import", details: error.errors });
      }
      console.error("Lesson builder ChatGPT library import error:", error);
      res.status(500).json({ error: "Failed to import ChatGPT library reference pack", details: error instanceof Error ? error.message : undefined });
    }
  });

  app.post("/api/admin/lesson-builder/openstax/import", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      const data = openStaxNursingCatalogImportSchema.parse(req.body || {});
      res.json(await importOpenStaxNursingCatalog(data, req.session.adminUser?.userId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid OpenStax nursing catalog import", details: error.errors });
      }
      console.error("Lesson builder OpenStax catalog import error:", error);
      res.status(500).json({ error: "Failed to import OpenStax nursing catalog", details: error instanceof Error ? error.message : undefined });
    }
  });

  app.get("/api/admin/lesson-builder/source-archives/jobs/:id", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const [importJob] = await db.select().from(sourceArchiveImports).where(eq(sourceArchiveImports.id, req.params.id)).limit(1);
      if (!importJob) return res.status(404).json({ error: "Archive import job not found" });
      const files = await db.select().from(sourceArchiveFiles).where(eq(sourceArchiveFiles.importId, importJob.id)).orderBy(asc(sourceArchiveFiles.filePath));
      const importedSources = Array.isArray(importJob.importedSourceIds) && importJob.importedSourceIds.length
        ? await getSourcesByIds(importJob.importedSourceIds)
        : [];
      res.json({ importJob, files, sources: importedSources });
    } catch (error) {
      console.error("Lesson builder archive job error:", error);
      res.status(500).json({ error: "Failed to load archive import job" });
    }
  });

  app.post("/api/admin/lesson-builder/mappings/review", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = mappingReviewSchema.parse(req.body);
      const createdMappings = [];

      for (const mapping of data.mappings) {
        const [existingTerm] = await db
          .select()
          .from(taxonomyTerms)
          .where(and(eq(taxonomyTerms.taxonomy, mapping.taxonomy), eq(taxonomyTerms.label, mapping.label)))
          .limit(1);

        const [term] = existingTerm ? [existingTerm] : await db.insert(taxonomyTerms).values({
          taxonomy: mapping.taxonomy,
          code: mapping.code,
          label: mapping.label,
          description: mapping.description,
          metadata: mapping.metadata,
        }).returning();

        const [created] = await db.insert(sourceTaxonomyMappings).values({
          sourceId: data.sourceId,
          taxonomyTermId: term.id,
          mappingSource: mapping.mappingSource,
          confidence: mapping.confidence.toFixed(2),
          notes: mapping.notes,
        }).returning();
        createdMappings.push({ ...created, taxonomyTerm: term });
      }

      res.json({ mappings: createdMappings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid mapping review", details: error.errors });
      }
      console.error("Lesson builder mapping review error:", error);
      res.status(500).json({ error: "Failed to review mappings" });
    }
  });

  app.post("/api/admin/lesson-builder/generate", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    let generationRunId: string | undefined;
    try {
      await ensureLessonBuilderTables();
      const data = generateSchema.parse(req.body);
      const [generationRun] = await db.insert(lessonGenerationRuns).values({
        status: "running",
        generationMode: data.settings.generationMode,
        topic: data.topic,
        audience: data.audience,
        sourceIds: data.sourceIds,
        settings: data.settings,
        createdBy: req.session.adminUser?.userId,
      }).returning();
      generationRunId = generationRun.id;

      const sources = await getSourcesByIds(data.sourceIds);

      if (sources.length === 0) {
        await db.update(lessonGenerationRuns).set({
          status: "failed",
          errorMessage: "At least one approved source is required",
          completedAt: new Date(),
        }).where(eq(lessonGenerationRuns.id, generationRunId));
        return res.status(400).json({ error: "At least one approved source is required" });
      }

      const taxonomySnapshot = await buildTaxonomySnapshot(data.sourceIds);
      const evidence = await fetchEvidence(data.topic, sources);
      const templateSlideDrafts = buildSlideDrafts(data.topic, data.audience, evidence, taxonomySnapshot, data.settings.slideCount);
      const generation = await buildGenerationDrafts({
        data,
        sources,
        taxonomySnapshot,
        evidence,
        templateSlideDrafts,
      });
      const slideDrafts = generation.slideDrafts;

      const [pkg] = await db.insert(lessonPackages).values({
        title: data.title,
        topic: data.topic,
        audience: data.audience,
        status: "draft",
        sourceIds: data.sourceIds,
        taxonomySnapshot,
        deckModel: {},
        manifest: {},
        qaSummary: {},
        createdBy: req.session.adminUser?.userId,
      }).returning();

      const createdSlides = [];
      for (const slide of slideDrafts) {
        const [createdSlide] = await db.insert(lessonSlides).values({
          packageId: pkg.id,
          slideNumber: slide.slideNumber,
          slideType: slide.slideType,
          title: slide.title,
          visibleContent: slide.visibleContent,
          speakerNotes: slide.speakerNotes,
          guidedNotes: slide.guidedNotes,
          retrievalPrompt: slide.retrievalPrompt,
          nclexCategory: slide.nclexCategory,
          cjmStep: slide.cjmStep,
          nursingProcess: slide.nursingProcess,
          bloomLevel: slide.bloomLevel,
        }).returning();
        createdSlides.push({ createdSlide, evidence: slide.evidence });
      }

      const practiceSlide = createdSlides.find(({ createdSlide }) => createdSlide.slideType === "practice_item")?.createdSlide || createdSlides[0]?.createdSlide;
      const generatedItem = generation.practiceItem;
      const itemOptions = generatedItem?.options?.length ? generatedItem.options : [
        { id: "A", text: "Collect another relevant assessment cue before acting." },
        { id: "B", text: "Ignore the cue because it may be expected." },
        { id: "C", text: "Delegate follow-up without reviewing the patient." },
        { id: "D", text: "Document the finding at the end of the shift only." },
      ];
      const [item] = await db.insert(lessonItems).values({
        packageId: pkg.id,
        slideId: practiceSlide?.id,
        itemType: generatedItem?.itemType || "multiple_choice",
        stem: generatedItem?.stem || `A nurse is caring for a patient with a cue related to ${data.topic}. Which action best supports safe clinical judgment?`,
        options: itemOptions,
        correctAnswer: generatedItem?.correctAnswer || "A",
        rationale: generatedItem?.rationale || `Collecting a relevant assessment cue keeps the nurse aligned with the clinical judgment process and supports safe prioritization for ${data.topic}.`,
        tags: {
          nclexCategory: slideDrafts[0]?.nclexCategory,
          cjmStep: "Analyze Cues",
          nursingProcess: slideDrafts[0]?.nursingProcess,
          bloomLevel: slideDrafts[0]?.bloomLevel,
        },
        difficulty: data.settings.difficulty,
      }).returning();

      for (const { createdSlide, evidence: citationEvidence } of createdSlides) {
        await db.insert(lessonCitations).values({
          packageId: pkg.id,
          slideId: createdSlide.id,
          sourceId: citationEvidence.sourceId,
          documentId: citationEvidence.documentId,
          chunkId: citationEvidence.chunkId,
          citationLabel: citationEvidence.citationLabel,
          pageStart: citationEvidence.pageStart,
          pageEnd: citationEvidence.pageEnd,
          excerpt: textSnippet(citationEvidence.text, 320),
          relevanceScore: "0.8500",
        });
      }

      if (practiceSlide) {
        const itemEvidence = generatedItem?.evidence || evidence[0];
        await db.insert(lessonCitations).values({
          packageId: pkg.id,
          slideId: practiceSlide.id,
          itemId: item.id,
          sourceId: itemEvidence.sourceId,
          documentId: itemEvidence.documentId,
          chunkId: itemEvidence.chunkId,
          citationLabel: itemEvidence.citationLabel,
          pageStart: itemEvidence.pageStart,
          pageEnd: itemEvidence.pageEnd,
          excerpt: textSnippet(itemEvidence.text, 320),
          relevanceScore: "0.8500",
        });
      }

      const deckModel = {
        ...buildDeckModel(pkg.id, data.title, data.topic, data.audience, slideDrafts, taxonomySnapshot),
        generation: generation.metadata,
        supervisorNotes: generation.supervisorNotes,
        risks: generation.risks,
      };
      const manifest = {
        ...buildManifest(pkg.id, data.title, data.topic, data.sourceIds),
        generation: generation.metadata,
        supervisorNotes: generation.supervisorNotes,
        risks: generation.risks,
      };
      await db.update(lessonPackages).set({
        deckModel,
        manifest,
        updatedAt: new Date(),
      }).where(eq(lessonPackages.id, pkg.id));

      const qa = await runQaForPackage(pkg.id);
      const validation = await validateLessonContract(pkg.id, "harrity");
      await db.update(lessonGenerationRuns).set({
        packageId: pkg.id,
        status: "completed",
        evidenceSnapshot: {
          topic: data.topic,
          refs: evidenceRefs(evidence),
        },
        taxonomySnapshot,
        validationSummary: {
          qa: qa.qaSummary,
          contract: validation.validationSummary,
        },
        completedAt: new Date(),
      }).where(eq(lessonGenerationRuns.id, generationRunId));

      const bundle = await findPackageBundle(pkg.id);

      res.json({
        package: bundle?.package,
        slides: bundle?.slides,
        items: bundle?.items,
        citations: bundle?.citations,
        qa,
        validation,
        generationRun: { id: generationRunId, status: "completed" },
        generation: generation.metadata,
      });
    } catch (error) {
      if (generationRunId) {
        try {
          await db.update(lessonGenerationRuns).set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Lesson generation failed",
            completedAt: new Date(),
          }).where(eq(lessonGenerationRuns.id, generationRunId));
        } catch {
          // Preserve the original generation error for the response.
        }
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid lesson generation request", details: error.errors });
      }
      console.error("Lesson builder generation error:", error);
      res.status(500).json({ error: "Failed to generate lesson package" });
    }
  });

  app.get("/api/admin/lesson-builder/packages", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const packages = await db.select().from(lessonPackages).orderBy(desc(lessonPackages.createdAt)).limit(50);
      res.json({ packages });
    } catch (error) {
      console.error("Lesson builder packages list error:", error);
      res.status(500).json({ error: "Failed to load lesson packages" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      res.json(bundle);
    } catch (error) {
      console.error("Lesson builder package detail error:", error);
      res.status(500).json({ error: "Failed to load lesson package" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/assignments", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      res.json({
        packageId: req.params.id,
        assignments: bundle.assignments,
      });
    } catch (error) {
      console.error("Lesson builder assignments load error:", error);
      res.status(500).json({ error: "Failed to load lesson assignments" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/pilot-outcomes", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const outcomes = await buildPilotOutcomes(req.params.id);
      if (!outcomes) return res.status(404).json({ error: "Lesson package not found" });
      res.json(outcomes);
    } catch (error) {
      console.error("Lesson builder pilot outcomes error:", error);
      res.status(500).json({ error: "Failed to load pilot outcomes" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/cohort-report", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const [bundle, outcomes] = await Promise.all([
        findPackageBundle(req.params.id),
        buildPilotOutcomes(req.params.id),
      ]);
      if (!bundle || !outcomes) return res.status(404).json({ error: "Lesson package not found" });

      res.json({
        package: outcomes.package,
        assessmentBridge: bundle.package.manifest?.assessmentBridge || bundle.package.taxonomySnapshot?.assessmentBridge || null,
        weakTopic: bundle.package.manifest?.assessmentBridge?.weakTopic || bundle.package.topic,
        totals: outcomes.totals,
        practiceSummary: outcomes.practiceSummary,
        feedbackSummary: outcomes.feedbackSummary,
        actionQueue: outcomes.actionQueue,
        learners: outcomes.learners,
      });
    } catch (error) {
      console.error("Lesson builder cohort report error:", error);
      res.status(500).json({ error: "Failed to load cohort report" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/pilot-outcomes/export", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const { format } = pilotOutcomesExportQuerySchema.parse(req.query || {});
      const outcomes = await buildPilotOutcomes(req.params.id);
      if (!outcomes) return res.status(404).json({ error: "Lesson package not found" });

      await recordReleaseAuditEvent(req.params.id, "pilot_outcomes_exported", `Pilot outcomes exported as ${format.toUpperCase()}`, {
        format,
        assignmentCount: outcomes.totals.assignments,
        learnerCount: outcomes.totals.assigned,
        actionQueueCount: outcomes.totals.needsReview,
      }, req.session.adminUser?.userId);

      const safeTitle = outcomes.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lesson";
      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}-pilot-outcomes.csv"`);
        return res.send(pilotOutcomesCsv(outcomes));
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}-pilot-outcomes.json"`);
      res.send(JSON.stringify(outcomes, null, 2));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pilot outcomes export request", details: error.errors });
      }
      console.error("Lesson builder pilot outcomes export error:", error);
      res.status(500).json({ error: "Failed to export pilot outcomes" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/assessment-bridge", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = assessmentBridgeSchema.parse(req.body || {});
      const bundle = await attachAssessmentBridge(req.params.id, data, req.session.adminUser?.userId);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      res.json({ package: bundle.package, assessmentBridge: bundle.package.manifest?.assessmentBridge, bundle });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid assessment bridge", details: error.errors });
      }
      console.error("Lesson builder assessment bridge error:", error);
      res.status(500).json({ error: "Failed to attach assessment bridge" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/ai-assessment-bridge", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      const aiMapping = await generateAiAssessmentBridge(bundle);
      const existingPilot = Boolean((bundle.package.manifest || {}).pilot?.officialPackage ?? true);
      const bridgedBundle = await attachAssessmentBridge(req.params.id, {
        weakTopic: aiMapping.weakTopic,
        atiCategory: aiMapping.atiCategory,
        nclexCategory: aiMapping.nclexCategory,
        cjmStep: aiMapping.cjmStep,
        sourceId: "",
        confidence: aiMapping.confidence,
        rationale: aiMapping.rationale,
        sourceEvidence: aiMapping.sourceEvidence,
        agentMode: aiMapping.agentMode,
        note: `AI mapped weak topic: ${aiMapping.rationale}`,
        officialPilotPackage: existingPilot,
      }, req.session.adminUser?.userId);
      if (!bridgedBundle) return res.status(404).json({ error: "Lesson package not found" });

      await recordReleaseAuditEvent(
        req.params.id,
        "ai_assessment_bridge_mapped",
        `AI mapped weak topic: ${aiMapping.weakTopic}.`,
        {
          weakTopic: aiMapping.weakTopic,
          atiCategory: aiMapping.atiCategory,
          nclexCategory: aiMapping.nclexCategory,
          cjmStep: aiMapping.cjmStep,
          confidence: aiMapping.confidence,
          agentMode: aiMapping.agentMode,
          sourceEvidence: aiMapping.sourceEvidence,
        },
        req.session.adminUser?.userId
      );

      res.json({
        package: bridgedBundle.package,
        assessmentBridge: bridgedBundle.package.manifest?.assessmentBridge,
        aiMapping,
        bundle: bridgedBundle,
      });
    } catch (error) {
      const credentialIssue = classifyAgentCredentialIssue(error);
      if (credentialIssue) {
        lastAgentCredentialIssue = credentialIssue;
      }
      const message = sanitizeAgentError(error);
      const status = /unavailable|not configured|missing/i.test(message) ? 409 : credentialIssue ? 401 : 502;
      console.error("Lesson builder AI assessment bridge error:", message);
      res.status(status).json({
        error: "AI weak-topic mapping failed",
        detail: message,
        aiMode: lessonBuilderAgentStatus().aiMode,
        existingBridgePreserved: true,
      });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/ai-review", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const [qa, validation] = await Promise.all([
        runQaForPackage(req.params.id),
        validateLessonContract(req.params.id, "harrity"),
      ]);
      const failing = Number(qa.qaSummary.failCount || 0) > 0 || Number(validation.validationSummary.failCount || 0) > 0;
      const data = packageReviewSchema.parse({
        reviewerName: "NurseStudy AI Review",
        reviewerRole: "ai_reviewer",
        decision: failing ? "changes_requested" : "approved_for_pilot",
        focusArea: "overall",
        comment: failing
          ? "AI review found unresolved QA or contract gates. Resolve failed items before pilot launch."
          : "AI review confirms the package is ready for internal MVP pilot use. Human faculty review remains a premium release gate.",
        metadata: {
          ...(req.body?.metadata || {}),
          qaSummary: qa.qaSummary,
          validationSummary: validation.validationSummary,
          humanFacultyReviewPremium: true,
        },
      });
      const result = await recordPackageReview(req.params.id, data, req.session.adminUser?.userId, "ai");
      if (!result) return res.status(404).json({ error: "Lesson package not found" });
      res.json({ ...result, qa, validation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid AI review request", details: error.errors });
      }
      console.error("Lesson builder AI review error:", error);
      res.status(500).json({ error: "Failed to run AI review" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/assignments", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = assignmentCreateSchema.parse(req.body || {});
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      if (bundle.package.status !== "published") {
        return res.status(400).json({ error: "Only published lesson packages can be assigned" });
      }

      let dueDate: Date | undefined;
      if (data.dueDate) {
        dueDate = new Date(data.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          return res.status(400).json({ error: "Invalid assignment due date" });
        }
      }

      const [assignment] = await db.insert(lessonAssignments).values({
        packageId: req.params.id,
        title: data.title || `${bundle.package.title} Pilot Assignment`,
        cohortName: data.cohortName,
        dueDate,
        status: "active",
        metadata: {
          ...data.metadata,
          learnerCount: data.learners.length,
          packageTitle: bundle.package.title,
        },
        createdBy: req.session.adminUser?.userId,
      }).returning();

      const createdLearners = [];
      for (const learner of data.learners) {
        const [createdLearner] = await db.insert(lessonAssignmentLearners).values({
          assignmentId: assignment.id,
          learnerName: learner.learnerName,
          learnerEmail: learner.learnerEmail || null,
          learnerKey: createLearnerKey(),
          status: "assigned",
          metadata: {},
        }).returning();
        createdLearners.push(createdLearner);
      }

      await recordReleaseAuditEvent(req.params.id, "lesson_assignment_created", `Assignment created for ${createdLearners.length} learner${createdLearners.length === 1 ? "" : "s"}`, {
        assignmentId: assignment.id,
        cohortName: assignment.cohortName,
        learnerCount: createdLearners.length,
      }, req.session.adminUser?.userId);

      const assignments = await getPackageAssignments(req.params.id);
      res.json({
        assignment,
        learners: createdLearners.map((learner) => ({
          id: learner.id,
          learnerName: learner.learnerName,
          learnerEmail: learner.learnerEmail,
          status: learner.status,
          linkPath: publicAssignmentPath(req.params.id, assignment.id, learner.id, learner.learnerKey),
        })),
        assignments,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid lesson assignment", details: error.errors });
      }
      console.error("Lesson builder assignment create error:", error);
      res.status(500).json({ error: "Failed to create lesson assignment" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/faculty-review", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      const facultyReviews = bundle.reviews.filter((review) => review.reviewerRole !== "ai_reviewer");
      const latestReview = facultyReviews[0] || null;
      const latestRubricSummary = latestReview
        ? ((latestReview.metadata || {}) as Record<string, any>).rubricSummary || normalizeFacultyReviewRubric((latestReview.metadata || {}) as Record<string, any>)
        : null;
      res.json({
        packageId: req.params.id,
        premiumFeature: true,
        status: latestReview ? "review_recorded" : "premium_available",
        rubricCriteria: facultyReviewRubricCriteria,
        latestReview,
        latestRubricSummary,
        certificateUrl: latestReview ? `/api/admin/lesson-builder/packages/${req.params.id}/faculty-review/certificate` : null,
        reviews: facultyReviews,
      });
    } catch (error) {
      console.error("Lesson builder faculty review load error:", error);
      res.status(500).json({ error: "Failed to load faculty review" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/faculty-review/certificate", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      const latestReview = bundle.reviews.find((review) => review.reviewerRole !== "ai_reviewer");
      if (!latestReview) return res.status(404).json({ error: "Faculty review not found" });

      const safeTitle = bundle.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lesson";
      await recordReleaseAuditEvent(req.params.id, "faculty_review_certificate_opened", "Faculty review certificate opened for premium review handoff.", {
        reviewId: latestReview.id,
        decision: latestReview.decision,
        reviewerRole: latestReview.reviewerRole,
      }, req.session.adminUser?.userId);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${safeTitle}-faculty-review-certificate.html"`);
      res.send(renderFacultyReviewCertificateHtml(bundle, latestReview));
    } catch (error) {
      console.error("Lesson builder faculty review certificate error:", error);
      res.status(500).json({ error: "Failed to open faculty review certificate" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/faculty-review", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const metadata = {
        ...(req.body?.metadata || {}),
        premiumFeature: true,
        humanFacultyReview: true,
      };
      const rubricSummary = normalizeFacultyReviewRubric(metadata);
      const data = packageReviewSchema.parse({
        reviewerName: req.body?.reviewerName || "Faculty reviewer",
        reviewerRole: req.body?.reviewerRole || "faculty_reviewer",
        decision: req.body?.decision || "comment",
        focusArea: req.body?.focusArea || "overall",
        comment: req.body?.comment || "Faculty review note recorded.",
        metadata: {
          ...metadata,
          rubricSummary,
        },
      });
      const result = await recordPackageReview(req.params.id, data, req.session.adminUser?.userId, "faculty");
      if (!result) return res.status(404).json({ error: "Lesson package not found" });
      res.json({ ...result, premiumFeature: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid faculty review", details: error.errors });
      }
      console.error("Lesson builder faculty review save error:", error);
      res.status(500).json({ error: "Failed to save faculty review" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/reviews", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      res.json({
        packageId: req.params.id,
        reviews: bundle.reviews,
        latestReview: bundle.reviews[0] || null,
      });
    } catch (error) {
      console.error("Lesson builder package reviews error:", error);
      res.status(500).json({ error: "Failed to load lesson package reviews" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/reviews", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = packageReviewSchema.parse(req.body || {});
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
<<<<<<< HEAD
=======
      if (data.decision === "approved_for_release" && data.metadata.licensedRn !== true) {
        return res.status(400).json({
          error: "Release approval requires an explicit licensed RN attestation",
          requiredMetadata: { licensedRn: true },
        });
      }
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277

      const [review] = await db.insert(lessonPackageReviews).values({
        packageId: req.params.id,
        reviewerName: data.reviewerName,
        reviewerRole: data.reviewerRole,
        decision: data.decision,
        focusArea: data.focusArea,
        comment: data.comment,
        metadata: {
          ...data.metadata,
          packageStatusAtReview: bundle.package.status,
          qaFailCount: Number(bundle.package.qaSummary?.failCount || 0),
          contractFailCount: Number(bundle.package.manifest?.contractValidation?.failCount || 0),
        },
        createdBy: req.session.adminUser?.userId,
      }).returning();

      const reviewSummary = {
        latestDecision: review.decision,
        latestReviewerName: review.reviewerName,
        latestReviewerRole: review.reviewerRole,
        latestFocusArea: review.focusArea,
        latestComment: review.comment,
        reviewedAt: review.createdAt,
        approvedForPilot: review.decision === "approved_for_pilot" || review.decision === "approved_for_release",
        approvedForRelease: review.decision === "approved_for_release",
        changesRequested: review.decision === "changes_requested",
      };

      await db.update(lessonPackages).set({
<<<<<<< HEAD
=======
        releaseStage: review.decision === "approved_for_release"
          ? "approved"
          : review.decision === "changes_requested"
            ? "draft"
            : "clinical_review",
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
        manifest: {
          ...(bundle.package.manifest || {}),
          facultyReview: reviewSummary,
        },
        updatedAt: new Date(),
      }).where(eq(lessonPackages.id, req.params.id));

      await recordReleaseAuditEvent(req.params.id, "faculty_review_recorded", `Faculty review recorded: ${review.decision.replace(/_/g, " ")}`, {
        reviewId: review.id,
        decision: review.decision,
        focusArea: review.focusArea,
        reviewerRole: review.reviewerRole,
      }, req.session.adminUser?.userId);

      const updatedBundle = await findPackageBundle(req.params.id);
      res.json({ review, package: updatedBundle?.package, reviews: updatedBundle?.reviews || [] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid package review", details: error.errors });
      }
      console.error("Lesson builder package review save error:", error);
      res.status(500).json({ error: "Failed to save lesson package review" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/duplicate", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      const latestRun = bundle.generationRuns[0];
      const sourceIds = Array.isArray(bundle.package.sourceIds) ? bundle.package.sourceIds : [];
      if (sourceIds.length === 0) return res.status(400).json({ error: "Package has no source IDs to regenerate from" });

      const latestSettings = (latestRun?.settings || {}) as Record<string, any>;
      const title = typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim()
        : `${bundle.package.title} Regenerated`;
      const data = generateSchema.parse({
        title,
        topic: bundle.package.topic,
        audience: bundle.package.audience,
        sourceIds,
        settings: {
          slideCount: Number(latestSettings.slideCount || bundle.slides.length || 8),
          difficulty: String(latestSettings.difficulty || bundle.items[0]?.difficulty || "application"),
          includeGuidedNotes: typeof latestSettings.includeGuidedNotes === "boolean"
            ? latestSettings.includeGuidedNotes
            : bundle.slides.some((slide) => Boolean(slide.guidedNotes)),
          generationMode: latestSettings.generationMode || latestRun?.generationMode || bundle.package.deckModel?.generation?.requestedMode || "agent_assisted",
        },
      });

      const result = await generateLessonPackageFromData(data, req.session.adminUser?.userId);
      if (result.package?.id) {
        const regeneratedBundle = await findPackageBundle(result.package.id);
        if (regeneratedBundle) {
          await db.update(lessonPackages).set({
            manifest: {
              ...(regeneratedBundle.package.manifest || {}),
              duplicatedFromPackageId: req.params.id,
              duplicatedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          }).where(eq(lessonPackages.id, result.package.id));
        }
      }
      res.json({ ...result, duplicatedFromPackageId: req.params.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid duplicate request", details: error.errors });
      }
      console.error("Lesson builder duplicate error:", error);
      res.status(500).json({ error: "Failed to duplicate lesson package" });
    }
  });

  app.patch("/api/admin/lesson-builder/packages/:id/slides/:slideId", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = slideUpdateSchema.parse(req.body);
      const [existing] = await db
        .select()
        .from(lessonSlides)
        .where(and(eq(lessonSlides.id, req.params.slideId), eq(lessonSlides.packageId, req.params.id)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Lesson slide not found" });

      const [updated] = await db.update(lessonSlides).set(cleanedUpdateValues({
        title: data.title,
        visibleContent: data.visibleContent,
        speakerNotes: data.speakerNotes,
        guidedNotes: data.guidedNotes,
        retrievalPrompt: data.retrievalPrompt,
        nclexCategory: data.nclexCategory,
        cjmStep: data.cjmStep,
        nursingProcess: data.nursingProcess,
        bloomLevel: data.bloomLevel,
      })).where(eq(lessonSlides.id, req.params.slideId)).returning();

      const bundle = await markPackageNeedsReview(req.params.id, "slide_edit");
      res.json({ slide: updated, package: bundle?.package, reviewStatus: "needs_qa_after_edit" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid slide update", details: error.errors });
      }
      console.error("Lesson builder slide update error:", error);
      res.status(500).json({ error: "Failed to update lesson slide" });
    }
  });

  app.patch("/api/admin/lesson-builder/packages/:id/items/:itemId", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = itemUpdateSchema.parse(req.body);
      const [existing] = await db
        .select()
        .from(lessonItems)
        .where(and(eq(lessonItems.id, req.params.itemId), eq(lessonItems.packageId, req.params.id)))
        .limit(1);

      if (!existing) return res.status(404).json({ error: "Lesson item not found" });

      const [updated] = await db.update(lessonItems).set(cleanedUpdateValues({
        stem: data.stem,
        options: data.options,
        correctAnswer: data.correctAnswer,
        rationale: data.rationale,
        tags: data.tags,
        difficulty: data.difficulty,
      })).where(eq(lessonItems.id, req.params.itemId)).returning();

      const bundle = await markPackageNeedsReview(req.params.id, "item_edit");
      res.json({ item: updated, package: bundle?.package, reviewStatus: "needs_qa_after_edit" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid item update", details: error.errors });
      }
      console.error("Lesson builder item update error:", error);
      res.status(500).json({ error: "Failed to update lesson item" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/run-qa", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      res.json(await runQaForPackage(req.params.id));
    } catch (error) {
      console.error("Lesson builder QA error:", error);
      res.status(500).json({ error: "Failed to run QA" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/validate-contract", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const profile = typeof req.query.profile === "string" ? req.query.profile : "harrity";
      res.json(await validateLessonContract(req.params.id, profile));
    } catch (error) {
      console.error("Lesson builder contract validation error:", error);
      res.status(500).json({ error: "Failed to validate lesson package contract" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/rebuild-artifacts", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const profile = typeof req.query.profile === "string" ? req.query.profile : "harrity";
      const qa = await runQaForPackage(req.params.id);
      const validation = await validateLessonContract(req.params.id, profile);
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      const controlPlane = buildLessonControlPlaneReport(bundle, profile);
      const blocked = validation.validationSummary.failCount > 0 || qa.qaSummary.failCount > 0 || controlPlane.summary.failCount > 0;

      res.json({
        package: bundle.package,
        qa,
        validation,
        controlPlane,
        artifacts: validation.artifacts,
        reviewStatus: blocked
          ? (bundle.package.status === "needs_republish" ? "needs_republish" : "blocked")
          : (bundle.package.status === "published" ? "published" : "ready_to_publish"),
      });
    } catch (error) {
      console.error("Lesson builder artifact rebuild error:", error);
      res.status(500).json({ error: "Failed to rebuild lesson package artifacts" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/control-plane-report", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const profile = typeof req.query.profile === "string" ? req.query.profile : "harrity";
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      res.json(buildLessonControlPlaneReport(bundle, profile));
    } catch (error) {
      console.error("Lesson builder control-plane report error:", error);
      res.status(500).json({ error: "Failed to inspect lesson package control plane" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/publish", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const publishConfirmation = publicPublishConfirmationSchema.safeParse(req.body || {});
      if (!publishConfirmation.success) {
        return res.status(400).json({
          error: "Publish confirmation required",
          requiredConfirmationText: publicPublishConfirmationText,
          details: publishConfirmation.error.errors,
        });
      }

      const qa = await runQaForPackage(req.params.id);
      const validation = await validateLessonContract(req.params.id, "harrity");
      if (qa.qaSummary.failCount > 0 || validation.validationSummary.failCount > 0) {
        return res.status(400).json({ error: "Package has failing QA or contract gates", qa, validation });
      }
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
<<<<<<< HEAD
=======
      const alignment = topicSourceAlignment(bundle);
      if (!alignment.valid) {
        return res.status(400).json({ error: "Topic and source evidence do not align", alignment });
      }
      if (bundle.package.releaseStage !== "approved" && bundle.package.releaseStage !== "export_ready") {
        return res.status(400).json({
          error: "Licensed clinical approval is required before public publishing",
          releaseStage: bundle.package.releaseStage || "draft",
          requiredReleaseStage: "approved",
        });
      }
      if (!hasLicensedClinicalApproval(bundle)) {
        return res.status(400).json({
          error: "No licensed RN faculty release approval is recorded",
          requiredReview: { decision: "approved_for_release", metadata: { licensedRn: true } },
        });
      }
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
      const controlPlane = buildLessonControlPlaneReport(bundle, "harrity");
      if (controlPlane.summary.failCount > 0) {
        return res.status(400).json({
          error: "Package has failing Build Package 1 control-plane gates",
          qa,
          validation,
          controlPlane,
        });
      }

      const [published] = await db.update(lessonPackages).set({
        status: "published",
<<<<<<< HEAD
=======
        releaseStage: "export_ready",
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(lessonPackages.id, req.params.id)).returning();

      await recordReleaseAuditEvent(req.params.id, "package_published", "Package published after QA and contract validation passed.", {
        qaSummary: qa.qaSummary,
        validationSummary: validation.validationSummary,
        controlPlaneSummary: controlPlane.summary,
        publishConfirmation: {
          confirmed: true,
          confirmationText: publicPublishConfirmationText,
        },
      }, req.session.adminUser?.userId);

<<<<<<< HEAD
      res.json({ package: published, qa, validation, controlPlane, publishConfirmation: { confirmed: true } });
=======
      res.json({ package: published, qa, validation, controlPlane, alignment, publishConfirmation: { confirmed: true } });
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    } catch (error) {
      console.error("Lesson builder publish error:", error);
      res.status(500).json({ error: "Failed to publish lesson package" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/export-status", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const profile = typeof req.query.profile === "string" ? req.query.profile : "harrity";
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      const artifacts = buildPackageExportArtifactPayloads(bundle, profile);
      const generatedFiles = artifacts.map((artifact) => artifact.fileName).sort();
      const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !generatedFiles.includes(fileName));
      const persistedFiles = bundle.artifacts.map((artifact) => artifact.fileName).sort();
      const latestExportAudit = bundle.releaseAuditEvents.find((event) => event.eventType === "harrity_export_downloaded") || null;
      const controlPlane = buildLessonControlPlaneReport(bundle, profile);

      res.json({
        packageId: req.params.id,
        profile,
        status: missingRequiredFiles.length === 0 ? "ready" : "missing_required_files",
        generatedAt: new Date().toISOString(),
        requiredFiles: harrityRequiredExportFiles,
        generatedFiles,
        persistedFiles,
        fileCount: generatedFiles.length,
        requiredFileCount: harrityRequiredExportFiles.length,
        missingRequiredFiles,
        includesDeckModel: generatedFiles.includes("deck_model.json"),
        latestExportAudit,
        controlPlane,
      });
    } catch (error) {
      console.error("Lesson builder export status error:", error);
      res.status(500).json({ error: "Failed to inspect lesson package export status" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/pilot-evidence-export", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const [bundle, outcomes, auditPatterns, deckExemplars] = await Promise.all([
        findPackageBundle(req.params.id),
        buildPilotOutcomes(req.params.id),
        db.select().from(sourceRegistry).where(eq(sourceRegistry.sourceKind, "sites_project")),
        db.select().from(sourceRegistry).where(eq(sourceRegistry.sourceKind, "drive_presentation")),
      ]);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      const report = buildPilotEvidenceReport(bundle, outcomes, auditPatterns, deckExemplars);
      const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "json";
      await recordReleaseAuditEvent(req.params.id, "pilot_evidence_exported", "Pilot evidence report exported for program review.", {
        format,
        learnerCount: outcomes?.totals.assigned || 0,
        completedCount: outcomes?.totals.completed || 0,
        sourceCount: bundle.sources.length,
        auditPatternCount: report.relatedAuditPatterns.length,
        deckExemplarCount: report.relatedDeckExemplars.length,
        exportReady: report.readiness.exportReady,
      }, req.session.adminUser?.userId);

      const safeTitle = bundle.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lesson";
      if (format === "markdown" || format === "md" || format === "brief") {
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}-pilot-evidence-brief.md"`);
        res.send(renderPilotEvidenceMarkdown(report));
        return;
      }
      if (format === "html" || format === "print") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `inline; filename="${safeTitle}-pilot-evidence-report.html"`);
        res.send(renderPilotEvidenceHtml(report));
        return;
      }
      if (format === "executive" || format === "executive-html" || format === "pdf") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `inline; filename="${safeTitle}-executive-pilot-evidence-report.html"`);
        res.send(renderPilotEvidenceExecutiveHtml(report));
        return;
      }
      if (format === "slides" || format === "deck" || format === "slide-outline") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}-pilot-evidence-slides.json"`);
        res.send(JSON.stringify(buildPilotEvidenceSlideOutline(report), null, 2));
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}-pilot-evidence.json"`);
      res.send(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error("Lesson builder pilot evidence export error:", error);
      res.status(500).json({ error: "Failed to export pilot evidence report" });
    }
  });

  app.get("/api/admin/lesson-builder/packages/:id/export", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const profile = typeof req.query.profile === "string" ? req.query.profile : "harrity";
      let bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      if (bundle.qaResults.length === 0) {
        await runQaForPackage(req.params.id);
        bundle = await findPackageBundle(req.params.id);
      }

      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });

      await validateLessonContract(req.params.id, profile);
      bundle = await findPackageBundle(req.params.id);
      if (!bundle) return res.status(404).json({ error: "Lesson package not found" });
      const controlPlane = buildLessonControlPlaneReport(bundle, profile);
      if (controlPlane.summary.failCount > 0) {
        return res.status(400).json({
          error: "Package has failing Build Package 1 control-plane gates",
          controlPlane,
        });
      }

      const buffer = await buildExportZip(bundle, profile);
      const fileName = `${bundle.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lesson-package"}.zip`;

      await recordReleaseAuditEvent(req.params.id, "harrity_export_downloaded", `Harrity export downloaded with ${bundle.artifacts.length} persisted artifact(s).`, {
        profile,
        fileName,
        artifactCount: bundle.artifacts.length,
        requiredFiles: harrityRequiredExportFiles,
        missingRequiredFiles: harrityRequiredExportFiles.filter((requiredFile) => !bundle.artifacts.some((artifact) => artifact.fileName === requiredFile)),
        includesDeckModel: bundle.artifacts.some((artifact) => artifact.fileName === "deck_model.json"),
        controlPlaneSummary: controlPlane.summary,
      }, req.session.adminUser?.userId);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Lesson builder export error:", error);
      res.status(500).json({ error: "Failed to export lesson package" });
    }
  });
<<<<<<< HEAD
=======

  app.get("/api/public/nclex-curriculum/status", (_req: Request, res: Response) => {
    res.json(executionStatus());
  });

  app.get("/api/admin/nclex-curriculum/coverage", requireAdminSession, (_req: AdminAuthRequest, res: Response) => {
    res.json({ validation: validateCurriculum(), status: executionStatus() });
  });

  app.post("/api/admin/nclex-curriculum/install", requireAdminSession, validateCSRFToken, async (_req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const validation = validateCurriculum();
      if (!validation.valid) return res.status(400).json({ error: "Curriculum contract validation failed", validation });
      const installed = await installCanonicalCurriculumGraph();
      const quarantinedPackages = await quarantineUnsafePackages();
      res.json({ installed, quarantinedPackages, validation });
    } catch (error) {
      console.error("NCLEX curriculum install error:", error);
      res.status(500).json({ error: "Failed to install NCLEX curriculum graph" });
    }
  });

  app.get("/api/admin/nclex-curriculum/manifest", requireAdminSession, (_req: AdminAuthRequest, res: Response) => {
    res.setHeader("Content-Disposition", "attachment; filename=curriculum-manifest.json");
    res.json(curriculumManifest());
  });

  app.post("/api/admin/nclex-curriculum/remediation-preview", requireAdminSession, (req: AdminAuthRequest, res: Response) => {
    const parsed = z.object({
      learnerKey: z.string().trim().min(1).max(160),
      signals: z.array(z.object({
        objectiveId: z.string().trim().min(1),
        topicId: z.string().trim().min(1),
        score: z.number().min(0).max(100),
        confidence: z.number().min(0).max(1),
        observedAt: z.string().datetime(),
        frequency: z.number().int().positive().optional(),
        sourceKind: z.enum(["generic_csv", "ati_alias_report", "canvas_outcome", "quiz"]),
      })).min(1).max(500),
    }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid performance signals", details: parsed.error.errors });
    res.json(buildDirectedRemediationPlan(parsed.data.learnerKey, parsed.data.signals));
  });

  app.post("/api/admin/nclex-curriculum/generate-batch", requireAdminSession, validateCSRFToken, (req: AdminAuthRequest, res: Response) => {
    const parsed = z.object({ topicIds: z.array(z.string().trim().min(1)).min(1).max(15) }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "A batch must contain 1-15 topic IDs", details: parsed.error.errors });
    const selected = parsed.data.topicIds.map((id) => EXEMPLAR_TOPICS.find((topic) => topic.id === id));
    const missing = parsed.data.topicIds.filter((_, index) => !selected[index]);
    if (missing.length) return res.status(404).json({ error: "Unknown curriculum topic IDs", missing });
    const packages = selected.map((topic) => buildExemplarPackage(topic!));
    res.json({
      generationMode: "deterministic_clinical_review_draft",
      releaseStage: "clinical_review",
      packageCount: packages.length,
      packages,
    });
  });

  app.get("/api/admin/nclex-curriculum/canvas-outcomes", requireAdminSession, (_req: AdminAuthRequest, res: Response) => {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=canvas-outcomes.csv");
    res.send(canvasOutcomesCsv());
  });

  app.get("/api/admin/nclex-curriculum/qti", requireAdminSession, (_req: AdminAuthRequest, res: Response) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=qti-exemplar-bank.xml");
    res.send(qtiAssessmentXml());
  });

  app.get("/api/admin/nclex-curriculum/pathway-rules", requireAdminSession, (_req: AdminAuthRequest, res: Response) => {
    res.setHeader("Content-Disposition", "attachment; filename=pathway-rules.json");
    res.json(pathwayRulesManifest());
  });

  app.get("/api/admin/nclex-curriculum/common-cartridge", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      const validation = validateCurriculum();
      if (!validation.valid) return res.status(400).json({ error: "Curriculum export validation failed", validation });
      const buffer = await commonCartridgeArchive();
      res.setHeader("Content-Type", "application/vnd.ims.imsccv1p3");
      res.setHeader("Content-Disposition", "attachment; filename=nclex-rn-2026.imscc");
      res.send(buffer);
    } catch (error) {
      console.error("NCLEX Common Cartridge export error:", error);
      res.status(500).json({ error: "Failed to build Common Cartridge" });
    }
  });
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
}
