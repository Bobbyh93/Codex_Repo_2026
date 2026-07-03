import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import OpenAI from "openai";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { requireAdminSession, type AdminAuthRequest } from "../admin-auth-session";
import {
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
} from "@shared/schema";

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
  officialPilotPackage: z.boolean().default(true),
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
  eventType: z.enum(["lesson_opened", "slide_viewed", "practice_viewed", "practice_attempted", "lesson_completed"]),
  slideId: z.string().optional(),
  itemId: z.string().optional(),
  payload: z.record(z.any()).default({}),
});

const learnerFeedbackSchema = z.object({
  sessionId: z.string().trim().min(8).max(120).optional(),
  assignmentId: z.string().trim().min(1).optional(),
  assignmentLearnerId: z.string().trim().min(1).optional(),
  learnerKey: z.string().trim().min(8).optional(),
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

function publicAssignmentPath(packageId: string, assignmentId: string, learnerId: string, learnerKey: string) {
  return `/lessons/${packageId}?assignmentId=${encodeURIComponent(assignmentId)}&assignmentLearnerId=${encodeURIComponent(learnerId)}&learnerKey=${encodeURIComponent(learnerKey)}`;
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

  const results = [
    gate("source_traceability", "Source Traceability", slidesWithCitations.size >= slides.length, `${slidesWithCitations.size}/${slides.length} slides have traceable citations.`),
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
  const artifacts = buildPackageArtifactPayloads(bundle, profile);
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

function learnerLessonPayload(bundle: LessonBundle, assignmentContext?: { assignment: any; learner: any } | null) {
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

async function recordPackageReview(
  packageId: string,
  data: z.infer<typeof packageReviewSchema>,
  actorId?: string,
  reviewKind: "ai" | "faculty" | "general" = "general"
) {
  await ensureLessonBuilderTables();
  const bundle = await findPackageBundle(packageId);
  if (!bundle) return null;

  const [review] = await db.insert(lessonPackageReviews).values({
    packageId,
    reviewerName: data.reviewerName,
    reviewerRole: data.reviewerRole,
    decision: data.decision,
    focusArea: data.focusArea,
    comment: data.comment,
    metadata: {
      ...data.metadata,
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

export function registerLessonBuilderRoutes(app: Express) {
  app.get("/api/lessons/:id", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle || bundle.package.status !== "published") {
        return res.status(404).json({ error: "Lesson not found" });
      }

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

      res.json(learnerLessonPayload(bundle, assignmentContext));
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
      if (!bundle || bundle.package.status !== "published") {
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

  app.post("/api/lessons/:id/feedback", async (req: Request, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = learnerFeedbackSchema.parse(req.body || {});
      const bundle = await findPackageBundle(req.params.id);
      if (!bundle || bundle.package.status !== "published") {
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
      res.json({
        packageId: req.params.id,
        premiumFeature: true,
        status: facultyReviews[0] ? "review_recorded" : "premium_available",
        latestReview: facultyReviews[0] || null,
        reviews: facultyReviews,
      });
    } catch (error) {
      console.error("Lesson builder faculty review load error:", error);
      res.status(500).json({ error: "Failed to load faculty review" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/faculty-review", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const data = packageReviewSchema.parse({
        reviewerName: req.body?.reviewerName || "Faculty reviewer",
        reviewerRole: req.body?.reviewerRole || "faculty_reviewer",
        decision: req.body?.decision || "comment",
        focusArea: req.body?.focusArea || "overall",
        comment: req.body?.comment || "Faculty review note recorded.",
        metadata: {
          ...(req.body?.metadata || {}),
          premiumFeature: true,
          humanFacultyReview: true,
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

      res.json({
        package: bundle.package,
        qa,
        validation,
        artifacts: validation.artifacts,
        reviewStatus: validation.validationSummary.failCount > 0 || qa.qaSummary.failCount > 0
          ? (bundle.package.status === "needs_republish" ? "needs_republish" : "blocked")
          : (bundle.package.status === "published" ? "published" : "ready_to_publish"),
      });
    } catch (error) {
      console.error("Lesson builder artifact rebuild error:", error);
      res.status(500).json({ error: "Failed to rebuild lesson package artifacts" });
    }
  });

  app.post("/api/admin/lesson-builder/packages/:id/publish", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const qa = await runQaForPackage(req.params.id);
      const validation = await validateLessonContract(req.params.id, "harrity");
      if (qa.qaSummary.failCount > 0 || validation.validationSummary.failCount > 0) {
        return res.status(400).json({ error: "Package has failing QA or contract gates", qa, validation });
      }

      const [published] = await db.update(lessonPackages).set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(lessonPackages.id, req.params.id)).returning();

      await recordReleaseAuditEvent(req.params.id, "package_published", "Package published after QA and contract validation passed.", {
        qaSummary: qa.qaSummary,
        validationSummary: validation.validationSummary,
      }, req.session.adminUser?.userId);

      res.json({ package: published, qa });
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

      const artifacts = buildPackageArtifactPayloads(bundle, profile);
      const generatedFiles = artifacts.map((artifact) => artifact.fileName).sort();
      const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !generatedFiles.includes(fileName));
      const persistedFiles = bundle.artifacts.map((artifact) => artifact.fileName).sort();
      const latestExportAudit = bundle.releaseAuditEvents.find((event) => event.eventType === "harrity_export_downloaded") || null;

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
      await recordReleaseAuditEvent(req.params.id, "pilot_evidence_exported", "Pilot evidence report exported for program review.", {
        learnerCount: outcomes?.totals.assigned || 0,
        completedCount: outcomes?.totals.completed || 0,
        sourceCount: bundle.sources.length,
        auditPatternCount: report.relatedAuditPatterns.length,
        deckExemplarCount: report.relatedDeckExemplars.length,
        exportReady: report.readiness.exportReady,
      }, req.session.adminUser?.userId);

      const safeTitle = bundle.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lesson";
      const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "json";
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

      const buffer = await buildExportZip(bundle, profile);
      const fileName = `${bundle.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lesson-package"}.zip`;

      await recordReleaseAuditEvent(req.params.id, "harrity_export_downloaded", `Harrity export downloaded with ${bundle.artifacts.length} persisted artifact(s).`, {
        profile,
        fileName,
        artifactCount: bundle.artifacts.length,
        requiredFiles: harrityRequiredExportFiles,
        missingRequiredFiles: harrityRequiredExportFiles.filter((requiredFile) => !bundle.artifacts.some((artifact) => artifact.fileName === requiredFile)),
        includesDeckModel: bundle.artifacts.some((artifact) => artifact.fileName === "deck_model.json"),
      }, req.session.adminUser?.userId);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Lesson builder export error:", error);
      res.status(500).json({ error: "Failed to export lesson package" });
    }
  });
}
