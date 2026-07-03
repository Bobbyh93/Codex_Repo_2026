import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/admin-layout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  Archive,
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  FileText,
  FlaskConical,
  Layers3,
  MessageSquare,
  PackageCheck,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

type SourceRecord = {
  id: string;
  title: string;
  sourceKind: string;
  sourceType: string;
  subject?: string;
  edition?: string;
  approvalStatus: string;
  ingestionStatus: string;
  sourceUri?: string;
  documentId?: string;
  citationPolicy?: string;
  metadata?: Record<string, any>;
};

type TaxonomyTerm = {
  id: string;
  taxonomy: string;
  code?: string;
  label: string;
};

type LessonPackage = {
  id: string;
  title: string;
  topic: string;
  audience: string;
  status: string;
  qaSummary?: {
    passCount?: number;
    warningCount?: number;
    failCount?: number;
  };
  createdAt?: string;
};

type ArchiveImport = {
  id: string;
  title: string;
  sourceUri: string;
  role: string;
  status: string;
  fileCount?: number;
  importedSourceIds?: string[];
  summary?: Record<string, any>;
  errorMessage?: string;
  createdAt?: string;
};

const defaultChatgptLibraryItemsText = [
  "skill(21).zip | zip | skill_pack | Review as a possible lesson-builder skill or agent workflow pattern",
  "harrity_lesson_builder_audio_feature_20260623.zip | zip | harrity_lesson_contract | Review as an audio lesson feature pattern",
  "learner_handout.md | md | learner_material | Review as learner-facing handout grammar",
  "facilitator_guide.md | md | facilitation_or_handoff | Review as instructor notes/facilitation grammar",
  "boots_to_bedside_agent_packet.zip | zip | agent_packet | Review as agent handoff/reference packet pattern",
  "boots_to_bedside_agent_handoff.docx | docx | facilitation_or_handoff | Review as handoff document pattern",
  "Solution_Generator_Launch_Builder.zip | zip | solution_builder_pattern | Review as product launch builder pattern",
  "VDIS_v1_Templates_Workbook.xlsx | xlsx | report_workbook_pattern | Review as workbook/report export pattern",
  "VDIS_v1_Report_Package.pdf | pdf | report_workbook_pattern | Review as evidence-report package pattern",
].join("\n");

function inferChatgptFileType(title: string) {
  const match = title.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "unknown";
}

function inferChatgptAssetFamily(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("harrity") || lower.includes("lesson_builder")) return "harrity_lesson_contract";
  if (lower.includes("learner") || lower.includes("handout")) return "learner_material";
  if (lower.includes("facilitator") || lower.includes("handoff")) return "facilitation_or_handoff";
  if (lower.includes("skill")) return "skill_pack";
  if (lower.includes("solution_generator")) return "solution_builder_pattern";
  if (lower.includes("vdis")) return "report_workbook_pattern";
  return "reference_pack";
}

function parseChatgptLibraryItems(itemsText: string, projectContext: string) {
  return itemsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titlePart, typePart, familyPart, usePart] = line.split("|").map((part) => part.trim());
      const title = titlePart || "Untitled ChatGPT library asset";
      return {
        title,
        fileType: typePart || inferChatgptFileType(title),
        assetFamily: familyPart || inferChatgptAssetFamily(title),
        candidateUse: usePart || "Review as a future NurseStudy reference/source contract candidate",
        projectContext,
      };
    });
}

type LessonBuilderHealth = {
  runtime: string;
  aiMode?: "workspace_agent" | "openai_chat_completions" | "template_fallback" | "invalid" | string;
  aiReady?: boolean;
  pilotReady?: boolean;
  latestPublishedPackageId?: string | null;
  database: { configured: boolean; status: string; migrationStatus?: string };
  previewMode: { enabled: boolean; status: string };
  sourceRegistry: {
    status: string;
    sourceCount: number;
    readySourceCount: number;
    archiveImportCount: number;
    documentBackedSourceCount?: number;
    normalizedSourceCount?: number;
    officialPilotSourceId?: string | null;
    officialPilotSourceTitle?: string | null;
    requiredArchiveRoles?: Array<{ role: string; status: string; jobs: number }>;
  };
  ingestion: { status: string; documentCount: number; documentBackedSourceCount?: number };
  export: { status: string; profile?: string; requiredFiles?: string[] };
  pilotReadiness?: {
    status: string;
    databaseConfigured: boolean;
    archiveSetReady: boolean;
    aiReady?: boolean;
    aiMode?: string;
    documentBackedSourceCount: number;
    normalizedSourceCount?: number;
    normalizedSourceReady?: boolean;
    officialPilotSourceReady?: boolean;
    officialPilotSourceId?: string | null;
    officialPilotSourceTitle?: string | null;
    assessmentBridgeReady?: boolean;
    assessmentBridge?: Record<string, any> | null;
    packageCount: number;
    latestPublishedPackageId?: string | null;
    latestPublishedPackageTitle?: string | null;
    latestQaFailCount?: number;
    latestContractFailCount?: number;
    exportReady?: boolean;
    reviewCount?: number;
    learnerEventCount?: number;
    latestReviewDecision?: string;
    facultyApproved?: boolean;
    launchReviewApproved?: boolean;
    aiReviewedPilotApproved?: boolean;
    humanFacultyApproved?: boolean;
    facultyReviewPremium?: boolean;
    latestReviewRole?: string | null;
    latestReviewIsAi?: boolean;
    latestPackageLearnerEventCount?: number;
    latestPackageFeedbackCount?: number;
    latestPackageActiveAssignmentCount?: number;
    latestPackageCompletionCount?: number;
    assignmentActive?: boolean;
    learnerCompletionPresent?: boolean;
    pilotLaunchReady?: boolean;
    liveVerificationComplete?: boolean;
  };
  agent: {
    agentId: string;
    status: "workspace_agent_ready" | "openai_chat_completions_ready" | "agent_ready" | "agent_invalid_key" | "agent_missing" | "fallback_only" | string;
    aiMode?: string;
    aiReady?: boolean;
    credentialStatus?: string;
    fallbackAvailable?: boolean;
    fallbackMode?: string;
    configured: boolean;
    endpointConfigured: boolean;
    openAiFallbackConfigured?: boolean;
    workspaceAgentAuthorizationConfigured?: boolean;
    authorizationConfigured: boolean;
    transport?: string;
  };
};

type ReleaseReadiness = {
  pilotReady: boolean;
  latestPublishedPackageId?: string | null;
  aiMode?: string;
  dbReady: boolean;
  authReady: boolean;
  registrationReady: boolean;
  exportReady: boolean;
  typecheckStatus: string;
  generatedAt?: string;
  blockers: Array<{
    key: string;
    label: string;
    status: "pass" | "warn" | "fail" | string;
    severity: "low" | "medium" | "high" | string;
    detail: string;
  }>;
};

type SourceDetail = {
  source: SourceRecord;
  chunkCount: number;
  generatedPackageCount: number;
  normalization?: Record<string, any> | null;
  archiveFiles: Array<{
    id: string;
    filePath: string;
    fileKind?: string;
    fileRole?: string;
    sizeBytes?: number;
  }>;
  packages: Array<{
    id: string;
    title: string;
    topic: string;
    status: string;
    createdAt?: string;
    publishedAt?: string;
  }>;
};

type ExportStatus = {
  packageId: string;
  profile: string;
  status: string;
  generatedAt: string;
  fileCount: number;
  requiredFileCount: number;
  requiredFiles: string[];
  generatedFiles: string[];
  persistedFiles: string[];
  missingRequiredFiles: string[];
  includesDeckModel: boolean;
  latestExportAudit?: {
    id: string;
    eventType: string;
    summary: string;
    createdAt?: string;
    payload?: Record<string, any>;
  } | null;
};

type PilotEvidenceReport = {
  generatedAt?: string;
  reportType?: string;
  package?: {
    id?: string;
    title?: string;
    status?: string;
  };
  readiness?: {
    exportReady?: boolean;
    missingRequiredFiles?: string[];
  };
  lessonAssets?: {
    slideCount?: number;
    itemCount?: number;
    citationCount?: number;
    artifactCount?: number;
    generatedFiles?: string[];
  };
  cohortOutcomes?: {
    totals?: Record<string, number>;
  } | null;
  relatedAuditPatterns?: any[];
  relatedDeckExemplars?: any[];
  relatedAssetPolicy?: {
    note?: string;
    citationUse?: string;
  };
};

type PackageDetail = {
  package: LessonPackage & { manifest?: Record<string, any>; deckModel?: Record<string, any>; taxonomySnapshot?: Record<string, any> };
  sources: SourceRecord[];
  slides: Array<{
    id: string;
    slideNumber: number;
    slideType: string;
    title: string;
    visibleContent: Record<string, any>;
    speakerNotes?: string;
    guidedNotes?: string;
    retrievalPrompt?: string;
    nclexCategory?: string;
    cjmStep?: string;
    nursingProcess?: string;
    bloomLevel?: string;
  }>;
  items: Array<{
    id: string;
    itemType?: string;
    stem: string;
    options?: Array<{ id: string; text: string }>;
    correctAnswer: string;
    rationale: string;
    tags?: Record<string, any>;
    difficulty?: string;
  }>;
  citations: Array<{
    id: string;
    slideId?: string;
    citationLabel: string;
    excerpt?: string;
  }>;
  qaResults: Array<{
    id: string;
    gateKey: string;
    gateName: string;
    status: "pass" | "warn" | "fail";
    details: string;
    score?: string;
  }>;
  generationRuns?: Array<{
    id: string;
    status: string;
    generationMode: string;
    validationSummary?: Record<string, any>;
    createdAt?: string;
    completedAt?: string;
  }>;
  artifacts?: Array<{
    id: string;
    artifactKey: string;
    artifactType: string;
    fileName: string;
    mimeType: string;
    contentHash?: string;
    createdAt?: string;
  }>;
  contractValidations?: Array<{
    id: string;
    validationKey: string;
    validationName: string;
    status: "pass" | "warn" | "fail";
    details: string;
  }>;
  reviews?: Array<{
    id: string;
    reviewerName: string;
    reviewerRole: string;
    decision: string;
    focusArea: string;
    comment: string;
    createdAt?: string;
  }>;
  assignments?: Array<{
    id: string;
    title: string;
    cohortName: string;
    dueDate?: string;
    status: string;
    createdAt?: string;
    counts?: {
      total: number;
      assigned: number;
      inProgress: number;
      completed: number;
      feedback: number;
      events: number;
    };
    learners: Array<{
      id: string;
      learnerName: string;
      learnerEmail?: string;
      status: string;
      openedAt?: string;
      completedAt?: string;
      lastActivityAt?: string;
      feedbackRating?: string;
      feedbackComment?: string;
      linkPath: string;
    }>;
  }>;
  learnerEvents?: Array<{
    id: string;
    eventType: string;
    sessionId: string;
    slideId?: string;
    itemId?: string;
    payload?: Record<string, any>;
    createdAt?: string;
  }>;
  releaseAuditEvents?: Array<{
    id: string;
    eventType: string;
    summary: string;
    payload?: Record<string, any>;
    createdAt?: string;
  }>;
};

type PilotOutcomes = {
  package: {
    id: string;
    title: string;
    topic: string;
    audience: string;
    status: string;
    publishedAt?: string | null;
  };
  generatedAt: string;
  totals: {
    assignments: number;
    assigned: number;
    opened: number;
    practiceAttempted: number;
    completed: number;
    feedbackSubmitted: number;
    needsReview: number;
  };
  assignments: Array<{
    id: string;
    title: string;
    cohortName: string;
    status: string;
    dueDate?: string | null;
    totals: {
      assigned: number;
      opened: number;
      practiceAttempted: number;
      completed: number;
      feedbackSubmitted: number;
      needsReview: number;
    };
  }>;
  learners: Array<{
    assignmentId: string;
    assignmentTitle: string;
    cohortName: string;
    learnerId: string;
    learnerName: string;
    learnerEmail?: string | null;
    status: string;
    openedAt?: string | null;
    completedAt?: string | null;
    lastActivityAt?: string | null;
    practice: {
      attempts: number;
      correct: number;
      incorrect: number;
      latestItemStem?: string | null;
    };
    feedback: {
      rating?: string | null;
      comment?: string | null;
      submittedAt?: string | null;
    };
    needsReview: boolean;
    reasons: string[];
    recommendedAction: string;
  }>;
  practiceSummary: {
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy?: number | null;
  };
  feedbackSummary: {
    ratings: Record<string, number>;
    comments: Array<{
      learnerId: string;
      learnerName: string;
      cohortName: string;
      rating?: string | null;
      comment?: string | null;
      submittedAt?: string | null;
    }>;
  };
  actionQueue: Array<{
    assignmentId: string;
    cohortName: string;
    learnerId: string;
    learnerName: string;
    learnerEmail?: string | null;
    status: string;
    reasons: string[];
    recommendedAction: string;
    lastActivityAt?: string | null;
    feedbackRating?: string | null;
  }>;
};

type PilotLaunchSummary = {
  generatedAt: string;
  pilotReady: boolean;
  latestPublishedPackageId?: string | null;
  package?: {
    id: string;
    title: string;
    topic: string;
    audience: string;
    status: string;
    learnerUrl: string;
    aiReview?: Record<string, any> | null;
    facultyReview?: Record<string, any> | null;
    assessmentBridge?: Record<string, any> | null;
  } | null;
  health: {
    aiMode?: string;
    aiReady?: boolean;
    dbReady?: boolean;
    sourceRegistryStatus?: string;
    exportStatus?: string;
  };
  readinessSteps: Array<{
    key: string;
    label: string;
    status: string;
    detail: string;
  }>;
  nextActions: Array<{
    key: string;
    label: string;
    detail: string;
  }>;
  avatars: Array<{
    key: string;
    label: string;
    solution: string;
    status: string;
    nextAction: string;
  }>;
  sourceSummary: Array<{
    id?: string;
    title?: string;
    approvalStatus?: string;
    ingestionStatus?: string;
    chunkCount?: number;
    citationPolicy?: string;
    normalized?: boolean;
    weakTopics?: string[];
  }>;
  assignment?: {
    id: string;
    title: string;
    cohortName: string;
    status: string;
    counts?: Record<string, number>;
    firstLearnerLink?: string | null;
  } | null;
  outcomes?: {
    totals: PilotOutcomes["totals"];
    practiceSummary: PilotOutcomes["practiceSummary"];
    feedbackSummary: PilotOutcomes["feedbackSummary"];
    actionQueue: PilotOutcomes["actionQueue"];
  } | null;
  exportStatus?: {
    status: string;
    fileCount: number;
    requiredFileCount: number;
    generatedFiles: string[];
    missingRequiredFiles: string[];
    includesDeckModel: boolean;
  } | null;
};

const defaultMappingRows = [
  { taxonomy: "NCLEX", code: "PHYS", label: "Physiological Integrity", confidence: 0.9 },
  { taxonomy: "CJM", code: "recognize-cues", label: "Recognize Cues", confidence: 0.9 },
  { taxonomy: "CJM", code: "analyze-cues", label: "Analyze Cues", confidence: 0.9 },
  { taxonomy: "Nursing Process", code: "assessment", label: "Assessment", confidence: 0.9 },
  { taxonomy: "Bloom", code: "apply", label: "Apply", confidence: 0.9 },
];

const fullMvpBuildRails = [
  {
    label: "Lesson Builder Core",
    source: "Current NurseStudy MVP",
    value: "Generate, edit, QA, publish, assign, complete, review outcomes, and export a Harrity bundle.",
    status: "active",
    next: "Keep as the launch spine for every other feature.",
  },
  {
    label: "Assessment Remediation",
    source: "Replit NurseStudy",
    value: "Use ATI report parsing, weak-topic study plans, and progress tracking to decide which lesson a learner needs.",
    status: "needs_assignment_data",
    next: "Connect parsed ATI weak topics to published lesson assignments.",
  },
  {
    label: "Source/RAG Studio",
    source: "NursesBrain + Data Chunker Pro",
    value: "Turn large PDFs, chapters, tables, and crosswalks into chunked, approved, citation-ready source packs.",
    status: "available",
    next: "Import Data Chunker Pro indexes as first-class source packs with chunk counts and taxonomy hints.",
  },
  {
    label: "Maternal-Newborn Package Hub",
    source: "MNN Google Drive folder",
    value: "Register the 27 chapter folders, Harrity decks, manifests, slide blueprint, QA log, notes pass, and validation reports as a Drive package collection.",
    status: "available",
    next: "Import MNN manifests and deck/package metadata first, then promote only approved source records into generation.",
  },
  {
    label: "Agent Production Bench",
    source: "OpenAI workspace agents",
    value: "Use Builder, Architecture, Supervisor, Planner, SQL, and Knowledge Search agents as specialized production operators.",
    status: "agent_missing",
    next: "Create a published API channel before using a workspace agent as the live runtime.",
  },
  {
    label: "Premium Faculty Review",
    source: "Pearson audit dashboards",
    value: "Use reviewer state, coverage checks, and evidence reporting as the premium approval layer.",
    status: "premium_available",
    next: "Add rubric scoring, request-change threads, and approval certificates.",
  },
  {
    label: "Deck Grammar Library",
    source: "Google Drive PPT/Slides",
    value: "Reuse Harrity deck exemplars and chapter decks as layout, pacing, and learner-facing grammar references.",
    status: "available",
    next: "Convert deck patterns into reusable lesson templates without treating them as citation truth.",
  },
  {
    label: "Buyer Evidence Loop",
    source: "Pilot Evidence Export",
    value: "Show source traceability, AI/faculty review, completion, feedback, follow-up queue, and export readiness.",
    status: "export_ready",
    next: "Add PDF/slide executive report for pilot handoff.",
  },
];

const statusTone: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ready: "bg-blue-50 text-blue-700 border-blue-200",
  draft: "bg-slate-50 text-slate-700 border-slate-200",
  qa_ready: "bg-teal-50 text-teal-700 border-teal-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_republish: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  fail: "bg-red-50 text-red-700 border-red-200",
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  duplicate: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  configured: "bg-emerald-50 text-emerald-700 border-emerald-200",
  agent_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  workspace_agent_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  openai_chat_completions_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fallback_only: "bg-blue-50 text-blue-700 border-blue-200",
  template_fallback: "bg-blue-50 text-blue-700 border-blue-200",
  agent_missing: "bg-amber-50 text-amber-700 border-amber-200",
  agent_invalid_key: "bg-red-50 text-red-700 border-red-200",
  missing_DATABASE_URL: "bg-amber-50 text-amber-700 border-amber-200",
  missing_required_files: "bg-red-50 text-red-700 border-red-200",
  awaiting_documents: "bg-amber-50 text-amber-700 border-amber-200",
  incomplete: "bg-amber-50 text-amber-700 border-amber-200",
  missing: "bg-red-50 text-red-700 border-red-200",
  comment: "bg-slate-50 text-slate-700 border-slate-200",
  changes_requested: "bg-amber-50 text-amber-700 border-amber-200",
  approved_for_pilot: "bg-emerald-50 text-emerald-700 border-emerald-200",
  approved_for_release: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ai_reviewed: "bg-blue-50 text-blue-700 border-blue-200",
  premium_feature: "bg-violet-50 text-violet-700 border-violet-200",
  awaiting_review: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  assigned: "bg-slate-50 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  not_started: "bg-amber-50 text-amber-700 border-amber-200",
  normalized: "bg-emerald-50 text-emerald-700 border-emerald-200",
  source_normalized: "bg-emerald-50 text-emerald-700 border-emerald-200",
  assessment_bridge_attached: "bg-blue-50 text-blue-700 border-blue-200",
  feedback_needs_review: "bg-red-50 text-red-700 border-red-200",
  practice_missed: "bg-amber-50 text-amber-700 border-amber-200",
  helpful: "bg-emerald-50 text-emerald-700 border-emerald-200",
  confusing: "bg-amber-50 text-amber-700 border-amber-200",
  too_easy: "bg-blue-50 text-blue-700 border-blue-200",
  too_hard: "bg-amber-50 text-amber-700 border-amber-200",
  needs_faculty_review: "bg-red-50 text-red-700 border-red-200",
  package_published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  harrity_export_downloaded: "bg-blue-50 text-blue-700 border-blue-200",
  faculty_review_recorded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  learner_feedback_received: "bg-blue-50 text-blue-700 border-blue-200",
  pilot_outcomes_exported: "bg-blue-50 text-blue-700 border-blue-200",
  pilot_evidence_exported: "bg-blue-50 text-blue-700 border-blue-200",
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  assignment_link_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  review_recorded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  premium_available: "bg-violet-50 text-violet-700 border-violet-200",
  export_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_package: "bg-amber-50 text-amber-700 border-amber-200",
  needs_assignment: "bg-amber-50 text-amber-700 border-amber-200",
  needs_assignment_data: "bg-amber-50 text-amber-700 border-amber-200",
  needs_normalization: "bg-amber-50 text-amber-700 border-amber-200",
  needs_export_check: "bg-amber-50 text-amber-700 border-amber-200",
};

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={statusTone[value] || "bg-slate-50 text-slate-700 border-slate-200"}>
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

function packageGenerationSummary(detail: PackageDetail) {
  const latestRun = detail.generationRuns?.[0];
  const generation = (detail.package.deckModel?.generation || detail.package.manifest?.generation || {}) as Record<string, any>;
  const requestedMode = String(generation.requestedMode || latestRun?.generationMode || "template");
  const usedMode = String(generation.usedMode || requestedMode || "template");
  const fallbackUsed = Boolean(generation.fallbackUsed || generation.fallbackReason || (requestedMode === "agent_assisted" && usedMode === "template"));
  const label = fallbackUsed ? "fallback used" : usedMode.replace(/_/g, " ");
  const status = fallbackUsed ? "fallback_only" : usedMode === "agent_assisted" ? "agent_ready" : "draft";
  const detailText = fallbackUsed
    ? `Requested ${requestedMode.replace(/_/g, " ")}; deterministic template fallback was used.`
    : `Generated with ${usedMode.replace(/_/g, " ")} mode.`;

  return {
    label,
    status,
    detailText,
    fallbackReason: generation.fallbackReason ? String(generation.fallbackReason) : "",
  };
}

function parseAssignmentRoster(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const emailMatch = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const learnerEmail = emailMatch?.[0] || "";
      const learnerName = line
        .replace(learnerEmail, "")
        .replace(/[<>,()]/g, " ")
        .replace(/\s+/g, " ")
        .trim() || (learnerEmail ? learnerEmail.split("@")[0] : line);
      return { learnerName, learnerEmail };
    });
}

function parseListText(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderVisibleContent(content: Record<string, any>) {
  return Object.entries(content || {}).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
    const rendered = Array.isArray(value) ? value.join(" | ") : String(value);
    return (
      <div key={key} className="space-y-1">
        <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
        <div className="text-sm text-slate-800">{rendered}</div>
      </div>
    );
  });
}

export default function LessonBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sources");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedMappingSourceId, setSelectedMappingSourceId] = useState<string>("");
  const [selectedSourceDetailId, setSelectedSourceDetailId] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [mappingRows, setMappingRows] = useState(defaultMappingRows);
  const [sourceForm, setSourceForm] = useState({
    title: "",
    sourceKind: "local_file",
    sourceType: "manual",
    subject: "",
    edition: "",
    sourceUri: "",
  });
  const [archiveForm, setArchiveForm] = useState({
    archivePath: "C:\\Users\\bobby\\Downloads\\harrity_lesson_builder_pipeline_skill_v2_20260509.zip",
    role: "harrity_pipeline_contract",
  });
  const [drivePackageForm, setDrivePackageForm] = useState({
    folderUrl: "https://drive.google.com/drive/folders/18DNf_F1E9rdHjEDHYlqDeHlSKULZgTmb",
    title: "MNN Maternal-Newborn Package Hub",
    packageKind: "mnn_package_hub",
  });
  const [chatgptLibraryForm, setChatgptLibraryForm] = useState({
    title: "ChatGPT Library Nursing Education Reference Pack",
    libraryUrl: "https://chatgpt.com/library?tab=files",
    projectTitle: "Nursing Education Concepts and Topics",
    projectUrl: "https://chatgpt.com/g/g-p-69def0f95a00819184e951302b7bf3fb-nursing-education-concepts-and-topics/project",
    notes: "Visible signed-in Chrome library inventory. Register as reference-only until each file is exported, reviewed, and approved.",
    itemsText: defaultChatgptLibraryItemsText,
  });
  const [openStaxForm, setOpenStaxForm] = useState({
    title: "OpenStax Nursing Catalog",
    subjectUrl: "https://openstax.org/subjects/nursing",
    notes: "Register catalog/book metadata only. Do not ingest OpenStax book text/PDFs into RAG or AI generation without OpenStax permission.",
  });
  const [documentSourceForm, setDocumentSourceForm] = useState({
    documentId: "",
    sourceType: "nursing_content_source",
    subject: "Nursing source document",
  });
  const [lastArchiveImportId, setLastArchiveImportId] = useState<string>("");
  const [lessonForm, setLessonForm] = useState({
    title: "Harrity Maternal-Newborn Lesson Package",
    topic: "Contraception priority cues and patient teaching",
    audience: "Prelicensure RN",
    slideCount: 8,
    difficulty: "application",
    includeGuidedNotes: true,
    generationMode: "agent_assisted",
  });
  const [generationModeTouched, setGenerationModeTouched] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState("");
  const [slideEditForm, setSlideEditForm] = useState({
    title: "",
    visibleContentText: "{}",
    speakerNotes: "",
    guidedNotes: "",
    retrievalPrompt: "",
    nclexCategory: "",
    cjmStep: "",
    nursingProcess: "",
    bloomLevel: "",
  });
  const [editingItemId, setEditingItemId] = useState("");
  const [itemEditForm, setItemEditForm] = useState({
    stem: "",
    optionsText: "[]",
    correctAnswer: "",
    rationale: "",
    tagsText: "{}",
    difficulty: "application",
  });
  const [reviewForm, setReviewForm] = useState({
    reviewerName: "Faculty reviewer",
    reviewerRole: "faculty_reviewer",
    decision: "comment",
    focusArea: "overall",
    comment: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    cohortName: "Internal pilot cohort",
    dueDate: "",
    rosterText: "Pilot learner, pilot.learner@example.com",
  });
  const [evidenceExportingPackageId, setEvidenceExportingPackageId] = useState("");
  const [latestEvidenceExport, setLatestEvidenceExport] = useState<{
    packageId: string;
    packageTitle: string;
    fileName: string;
    reportKind: "json" | "markdown";
    generatedAt: string;
    artifactCount: number;
    generatedFileCount: number;
    auditPatternCount: number;
    deckExemplarCount: number;
    relatedAssetPolicyNote?: string;
    assignedCount: number;
    completedCount: number;
    exportReady: boolean;
  } | null>(null);
  const [normalizationForm, setNormalizationForm] = useState({
    officialPilot: true,
    weakTopicsText: "Therapeutic communication",
    atiCategoriesText: "Psychosocial Integrity",
    notes: "Pilot normalization using NursesBrain-style source metadata review.",
  });
  const [assessmentBridgeForm, setAssessmentBridgeForm] = useState({
    weakTopic: "Therapeutic communication",
    atiCategory: "Psychosocial Integrity",
    nclexCategory: "Psychosocial Integrity",
    cjmStep: "Analyze Cues",
    sourceId: "",
    note: "Manual pilot bridge from assessment gap to learner lesson package.",
    officialPilotPackage: true,
  });

  const healthQuery = useQuery<LessonBuilderHealth>({
    queryKey: ["/api/admin/lesson-builder/health"],
  });

  const releaseReadinessQuery = useQuery<ReleaseReadiness>({
    queryKey: ["/api/admin/lesson-builder/release-readiness"],
  });

  const pilotLaunchQuery = useQuery<PilotLaunchSummary>({
    queryKey: ["/api/admin/pilot-launch/summary"],
  });

  const sourcesQuery = useQuery<{ sources: SourceRecord[]; taxonomyTerms: TaxonomyTerm[]; documents: any[]; archiveImports?: ArchiveImport[] }>({
    queryKey: ["/api/admin/lesson-builder/sources"],
  });

  const sourceDetailQuery = useQuery<SourceDetail>({
    queryKey: ["/api/admin/lesson-builder/sources", selectedSourceDetailId],
    enabled: Boolean(selectedSourceDetailId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/lesson-builder/sources/${selectedSourceDetailId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load source detail");
      return response.json();
    },
  });

  const packagesQuery = useQuery<{ packages: LessonPackage[] }>({
    queryKey: ["/api/admin/lesson-builder/packages"],
  });

  const agentStatusQuery = useQuery<{
    agentId: string;
    status: "workspace_agent_ready" | "openai_chat_completions_ready" | "agent_ready" | "agent_invalid_key" | "agent_missing" | "fallback_only" | string;
    aiMode?: string;
    aiReady?: boolean;
    credentialStatus?: string;
    fallbackAvailable?: boolean;
    fallbackMode?: string;
    configured: boolean;
    endpointConfigured: boolean;
    openAiFallbackConfigured?: boolean;
    authorizationConfigured: boolean;
    transport?: string;
  }>({
    queryKey: ["/api/admin/lesson-builder/agent-status"],
  });

  const detailQuery = useQuery<PackageDetail>({
    queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId],
    enabled: Boolean(selectedPackageId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/lesson-builder/packages/${selectedPackageId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load package detail");
      return response.json();
    },
  });

  const exportStatusQuery = useQuery<ExportStatus>({
    queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId, "export-status"],
    enabled: Boolean(selectedPackageId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/lesson-builder/packages/${selectedPackageId}/export-status?profile=harrity`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to inspect export status");
      return response.json();
    },
  });

  const pilotOutcomesQuery = useQuery<PilotOutcomes>({
    queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId, "pilot-outcomes"],
    enabled: Boolean(selectedPackageId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/lesson-builder/packages/${selectedPackageId}/pilot-outcomes`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load pilot outcomes");
      return response.json();
    },
  });

  const archiveJobQuery = useQuery<{ importJob: ArchiveImport; files: any[]; sources: SourceRecord[] }>({
    queryKey: ["/api/admin/lesson-builder/source-archives/jobs", lastArchiveImportId],
    enabled: Boolean(lastArchiveImportId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/lesson-builder/source-archives/jobs/${lastArchiveImportId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load archive import job");
      return response.json();
    },
  });

  const sources = sourcesQuery.data?.sources || [];
  const hiddenSmokeSourceCount = sources.filter((source) => source.approvalStatus === "rejected" && /^mvp-/i.test(source.title)).length;
  const visibleSources = sources.filter((source) => !(source.approvalStatus === "rejected" && /^mvp-/i.test(source.title)));
  const packages = packagesQuery.data?.packages || [];
  const archiveImports = sourcesQuery.data?.archiveImports || [];
  const health = healthQuery.data;
  const releaseReadiness = releaseReadinessQuery.data;
  const pilotLaunch = pilotLaunchQuery.data;
  const releaseBlockers = releaseReadiness?.blockers || [];
  const releaseFailCount = releaseBlockers.filter((blocker) => blocker.status === "fail").length;
  const releaseWarnCount = releaseBlockers.filter((blocker) => blocker.status === "warn").length;
  const agentStatus = health?.agent.status;
  const aiReady = Boolean(health?.aiReady || health?.agent.aiReady || agentStatusQuery.data?.aiReady);
  const aiMode = health?.aiMode || health?.agent.aiMode || agentStatusQuery.data?.aiMode || health?.agent.transport || "template_fallback";
  const directOpenAiConfigured = Boolean(health?.agent.openAiFallbackConfigured || agentStatusQuery.data?.openAiFallbackConfigured);
  const endpointConfigured = Boolean(health?.agent.endpointConfigured || agentStatusQuery.data?.endpointConfigured);
  const selectedSources = useMemo(
    () => sources.filter((source) => selectedSourceIds.includes(source.id)),
    [sources, selectedSourceIds]
  );

  const stats = {
    approvedSources: sources.filter((source) => source.approvalStatus === "approved").length,
    readySources: sources.filter((source) => source.ingestionStatus === "ready").length,
    driveDecks: sources.filter((source) => source.sourceKind === "drive_presentation").length,
    auditPatterns: sources.filter((source) => source.sourceKind === "sites_project").length,
    packages: packages.length,
    published: packages.filter((pkg) => pkg.status === "published").length,
  };
  const auditPatternSources = useMemo(
    () => sources.filter((source) => source.sourceKind === "sites_project"),
    [sources]
  );
  const driveDeckSources = useMemo(
    () => sources.filter((source) => source.sourceKind === "drive_presentation"),
    [sources]
  );
  const latestArchiveImport = archiveJobQuery.data?.importJob || archiveImports[0];
  const latestArchiveFileCount = archiveJobQuery.data?.files?.length ?? latestArchiveImport?.fileCount ?? 0;
  const selectedPackageGeneration = detailQuery.data ? packageGenerationSummary(detailQuery.data) : null;
  const currentAssessmentBridge = detailQuery.data
    ? detailQuery.data.package.manifest?.assessmentBridge
      || detailQuery.data.package.taxonomySnapshot?.assessmentBridge
      || detailQuery.data.package.deckModel?.assessmentBridge
      || null
    : null;
  const latestReview = detailQuery.data?.reviews?.[0];
  const learnerEvents = detailQuery.data?.learnerEvents || [];
  const learnerEventCounts = learnerEvents.reduce<Record<string, number>>((counts, event) => {
    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    return counts;
  }, {});
  const learnerFeedback = learnerEvents.filter((event) => event.eventType === "feedback_submitted");
  const assignments = detailQuery.data?.assignments || [];
  const pilotOutcomes = pilotOutcomesQuery.data;
  const assignmentTotals = assignments.reduce(
    (totals, assignment) => ({
      total: totals.total + (assignment.counts?.total || 0),
      assigned: totals.assigned + (assignment.counts?.assigned || 0),
      inProgress: totals.inProgress + (assignment.counts?.inProgress || 0),
      completed: totals.completed + (assignment.counts?.completed || 0),
      feedback: totals.feedback + (assignment.counts?.feedback || 0),
    }),
    { total: 0, assigned: 0, inProgress: 0, completed: 0, feedback: 0 }
  );

  useEffect(() => {
    if (!generationModeTouched && agentStatusQuery.data?.configured) {
      setLessonForm((current) => ({ ...current, generationMode: "agent_assisted" }));
    }
  }, [agentStatusQuery.data?.configured, generationModeTouched]);

  useEffect(() => {
    setEditingSlideId("");
    setEditingItemId("");
  }, [selectedPackageId]);

  useEffect(() => {
    const normalization = sourceDetailQuery.data?.normalization || sourceDetailQuery.data?.source.metadata?.normalization;
    if (!normalization) return;
    setNormalizationForm({
      officialPilot: Boolean(normalization.officialPilot),
      weakTopicsText: Array.isArray(normalization.weakTopics) ? normalization.weakTopics.join("\n") : "",
      atiCategoriesText: Array.isArray(normalization.taxonomyHints?.ati) ? normalization.taxonomyHints.ati.join("\n") : "",
      notes: normalization.notes || "",
    });
  }, [sourceDetailQuery.data?.source.id]);

  useEffect(() => {
    if (!currentAssessmentBridge) return;
    setAssessmentBridgeForm((current) => ({
      ...current,
      weakTopic: currentAssessmentBridge.weakTopic || current.weakTopic,
      atiCategory: currentAssessmentBridge.atiCategory || "",
      nclexCategory: currentAssessmentBridge.nclexCategory || "",
      cjmStep: currentAssessmentBridge.cjmStep || "",
      sourceId: currentAssessmentBridge.sourceId || "",
      note: currentAssessmentBridge.note || "",
      officialPilotPackage: Boolean(detailQuery.data?.package.manifest?.pilot?.officialPackage ?? current.officialPilotPackage),
    }));
  }, [selectedPackageId, currentAssessmentBridge?.attachedAt]);

  const refreshLaunchQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
  };

  const importSourceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-builder/sources/import", {
        ...sourceForm,
        approvalStatus: "approved",
        ingestionStatus: "ready",
        metadata: { registeredFrom: "lesson-builder-admin" },
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      refreshLaunchQueries();
      setSelectedSourceIds((ids) => ids.includes(data.source.id) ? ids : [...ids, data.source.id]);
      setSelectedMappingSourceId(data.source.id);
      setSourceForm({ title: "", sourceKind: "local_file", sourceType: "manual", subject: "", edition: "", sourceUri: "" });
      toast({ title: "Source registered", description: "The source is ready for taxonomy review." });
    },
  });

  const importArchiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-builder/source-archives/import", archiveForm, {
        timeout: 120000,
        retries: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      setLastArchiveImportId(data.importJob.id);
      if (Array.isArray(data.sources) && data.sources[0]?.id) {
        setSelectedSourceIds((ids) => ids.includes(data.sources[0].id) ? ids : [...ids, data.sources[0].id]);
        setSelectedMappingSourceId(data.sources[0].id);
      }
      toast({
        title: data.importJob.status === "duplicate" ? "Archive already registered" : "Archive imported",
        description: `${data.importJob.title} is ${data.importJob.status}.`,
      });
    },
  });

  const importPilotSetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-builder/source-archives/import-pilot-set", {}, {
        timeout: 180000,
        retries: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      const sourceIds = data.summary?.importedSourceIds || [];
      if (sourceIds.length > 0) {
        setSelectedSourceIds((ids) => Array.from(new Set([...ids, ...sourceIds])));
        if (!selectedMappingSourceId) setSelectedMappingSourceId(sourceIds[0]);
      }
      toast({
        title: "Pilot archive set checked",
        description: `${data.summary?.completed || 0} completed, ${data.summary?.duplicate || 0} duplicate, ${data.summary?.failed || 0} failed.`,
      });
    },
  });

  const importDrivePackageMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-builder/drive-packages/import", {
        ...drivePackageForm,
        approvalStatus: "pending",
      }, {
        timeout: 120000,
        retries: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      setLastArchiveImportId(data.importJob.id);
      if (Array.isArray(data.sources) && data.sources[0]?.id) {
        setSelectedSourceDetailId(data.sources[0].id);
        setSelectedMappingSourceId(data.sources[0].id);
      }
      toast({
        title: data.importJob.status === "duplicate" ? "Drive hub already registered" : "Drive hub imported",
        description: `${data.sources?.length || 0} source records and ${data.files?.length || 0} manifest entries are ${data.importJob.status}.`,
      });
    },
  });

  const importChatgptLibraryMutation = useMutation({
    mutationFn: async () => {
      const items = parseChatgptLibraryItems(chatgptLibraryForm.itemsText, chatgptLibraryForm.projectTitle);
      const response = await apiRequest("POST", "/api/admin/lesson-builder/chatgpt-library/import", {
        title: chatgptLibraryForm.title,
        libraryUrl: chatgptLibraryForm.libraryUrl,
        projectTitle: chatgptLibraryForm.projectTitle,
        projectUrl: chatgptLibraryForm.projectUrl,
        notes: chatgptLibraryForm.notes,
        approvalStatus: "pending",
        items,
      }, {
        timeout: 120000,
        retries: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      setLastArchiveImportId(data.importJob?.id || "");
      if (Array.isArray(data.sources) && data.sources[0]?.id) {
        setSelectedSourceDetailId(data.sources[0].id);
        setSelectedMappingSourceId(data.sources[0].id);
      }
      toast({
        title: data.importJob?.status === "duplicate" ? "ChatGPT pack already registered" : "ChatGPT pack registered",
        description: `${data.sources?.length || 0} source candidates and ${data.files?.length || 0} visible file records are ${data.importJob?.status || "registered"}.`,
      });
    },
  });

  const importOpenStaxMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-builder/openstax/import", {
        title: openStaxForm.title,
        subjectUrl: openStaxForm.subjectUrl,
        notes: openStaxForm.notes,
        approvalStatus: "pending",
      }, {
        timeout: 120000,
        retries: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      setLastArchiveImportId(data.importJob?.id || "");
      if (Array.isArray(data.sources) && data.sources[0]?.id) {
        setSelectedSourceDetailId(data.sources[0].id);
      }
      toast({
        title: data.importJob?.status === "duplicate" ? "OpenStax catalog already registered" : "OpenStax catalog registered",
        description: `${data.sources?.length || 0} catalog/book records are ${data.importJob?.status || "registered"} as link-only references.`,
      });
    },
  });

  const attachDocumentMutation = useMutation({
    mutationFn: async () => {
      const selectedDocument = sourcesQuery.data?.documents?.find((document) => document.id === documentSourceForm.documentId);
      const response = await apiRequest("POST", "/api/admin/lesson-builder/sources/attach-document", {
        ...documentSourceForm,
        title: selectedDocument?.title,
        approvalStatus: "approved",
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      if (data.source?.id) {
        setSelectedSourceIds((ids) => ids.includes(data.source.id) ? ids : [...ids, data.source.id]);
        setSelectedMappingSourceId(data.source.id);
      }
      toast({
        title: data.created ? "Knowledge document attached" : "Knowledge document source refreshed",
        description: `${data.chunkCount || 0} chunks are available for citation retrieval.`,
      });
    },
  });

  const normalizeSourceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSourceDetailId) throw new Error("Select a source first.");
      const response = await apiRequest("POST", `/api/admin/lesson-builder/sources/${selectedSourceDetailId}/normalize`, {
        method: "nursesbrain_pattern",
        officialPilot: normalizationForm.officialPilot,
        weakTopics: parseListText(normalizationForm.weakTopicsText),
        atiCategories: parseListText(normalizationForm.atiCategoriesText),
        notes: normalizationForm.notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources", selectedSourceDetailId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      toast({
        title: "Source normalized",
        description: `${data.normalization?.detected?.tableCount || 0} table/crosswalk signal${data.normalization?.detected?.tableCount === 1 ? "" : "s"} recorded.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Normalization failed", description: error?.message || "The selected source could not be normalized.", variant: "destructive" });
    },
  });

  const reviewMappingsMutation = useMutation({
    mutationFn: async () => {
      const sourceId = selectedMappingSourceId || selectedSourceIds[0];
      if (!sourceId) throw new Error("Choose a source first.");
      const response = await apiRequest("POST", "/api/admin/lesson-builder/mappings/review", {
        sourceId,
        mappings: mappingRows,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/sources"] });
      toast({ title: "Mappings saved", description: "Taxonomy review is ready for generation." });
      setActiveTab("generate");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/lesson-builder/generate", {
        title: lessonForm.title,
        topic: lessonForm.topic,
        audience: lessonForm.audience,
        sourceIds: selectedSourceIds,
        settings: {
          slideCount: Number(lessonForm.slideCount),
          difficulty: lessonForm.difficulty,
          includeGuidedNotes: lessonForm.includeGuidedNotes,
          generationMode: lessonForm.generationMode,
        },
      }, { timeout: 120000, retries: 0 });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      refreshLaunchQueries();
      setSelectedPackageId(data.package.id);
      setActiveTab("review");
      if (data.generation?.fallbackReason) {
        toast({
          title: "Generated with template fallback",
          description: data.generation.fallbackReason,
          variant: "destructive",
        });
      } else {
        toast({ title: "Lesson package generated", description: "QA ran automatically and the package is ready to review." });
      }
    },
  });

  const runQaMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/run-qa`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      toast({ title: "QA complete", description: "The quality gates have been refreshed." });
    },
  });

  const assessmentBridgeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPackageId) throw new Error("Select a package first.");
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/assessment-bridge`, assessmentBridgeForm);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      toast({
        title: "Assessment bridge saved",
        description: `Weak topic linked: ${data.assessmentBridge?.weakTopic || assessmentBridgeForm.weakTopic}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Bridge save failed", description: error?.message || "Check the weak topic fields.", variant: "destructive" });
    },
  });

  const validateContractMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/validate-contract?profile=harrity`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      toast({
        title: data.validationSummary?.failCount ? "Contract blocks publish" : "Contract validation passed",
        description: `${data.validationSummary?.failCount || 0} fail, ${data.validationSummary?.warningCount || 0} warn.`,
        variant: data.validationSummary?.failCount ? "destructive" : undefined,
      });
    },
  });

  const runAiReviewMutation = useMutation({
    mutationFn: async (packageId?: string) => {
      const targetPackageId = packageId || selectedPackageId;
      if (!targetPackageId) throw new Error("Select a package first.");
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${targetPackageId}/ai-review`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      toast({
        title: "AI review recorded",
        description: `Decision: ${String(data.review?.decision || "approved_for_pilot").replace(/_/g, " ")}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "AI review failed", description: error?.message || "Run QA and contract validation first.", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/publish`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      toast({ title: "Package published", description: "The lesson package passed QA and is marked published." });
    },
  });

  const duplicatePackageMutation = useMutation({
    mutationFn: async () => {
      const currentPackage = detailQuery.data?.package;
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/duplicate`, {
        title: currentPackage ? `${currentPackage.title} Regenerated` : undefined,
      }, { timeout: 120000, retries: 0 });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-launch/summary"] });
      if (data.package?.id) {
        setSelectedPackageId(data.package.id);
      }
      toast({
        title: "Package regenerated",
        description: "A new package was created from the selected package settings and sources.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Regeneration failed", description: error?.message || "The package could not be regenerated.", variant: "destructive" });
    },
  });

  const saveReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/faculty-review`, reviewForm);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      setReviewForm((current) => ({ ...current, comment: "" }));
      toast({
        title: "Premium faculty review saved",
        description: `Decision recorded as ${String(data.review?.decision || reviewForm.decision).replace(/_/g, " ")}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Review save failed", description: error?.message || "Add a reviewer note before saving.", variant: "destructive" });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async () => {
      const learners = parseAssignmentRoster(assignmentForm.rosterText);
      if (learners.length === 0) throw new Error("Add at least one learner.");
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/assignments`, {
        title: assignmentForm.title || undefined,
        cohortName: assignmentForm.cohortName,
        dueDate: assignmentForm.dueDate || undefined,
        learners,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      setAssignmentForm((current) => ({ ...current, title: "", rosterText: "" }));
      toast({
        title: "Pilot assignment created",
        description: `${data.learners?.length || 0} learner link${data.learners?.length === 1 ? "" : "s"} ready to share.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Assignment failed", description: error?.message || "Check the assignment roster.", variant: "destructive" });
    },
  });

  const saveSlideMutation = useMutation({
    mutationFn: async () => {
      const visibleContent = JSON.parse(slideEditForm.visibleContentText);
      const response = await apiRequest("PATCH", `/api/admin/lesson-builder/packages/${selectedPackageId}/slides/${editingSlideId}`, {
        title: slideEditForm.title,
        visibleContent,
        speakerNotes: slideEditForm.speakerNotes,
        guidedNotes: slideEditForm.guidedNotes,
        retrievalPrompt: slideEditForm.retrievalPrompt,
        nclexCategory: slideEditForm.nclexCategory,
        cjmStep: slideEditForm.cjmStep,
        nursingProcess: slideEditForm.nursingProcess,
        bloomLevel: slideEditForm.bloomLevel,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      setEditingSlideId("");
      toast({ title: "Slide saved", description: "QA and contract artifacts need to be rebuilt before publish." });
    },
    onError: (error: any) => {
      toast({ title: "Slide save failed", description: error?.message || "Check the visible content JSON.", variant: "destructive" });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const options = JSON.parse(itemEditForm.optionsText);
      const tags = JSON.parse(itemEditForm.tagsText);
      const response = await apiRequest("PATCH", `/api/admin/lesson-builder/packages/${selectedPackageId}/items/${editingItemId}`, {
        stem: itemEditForm.stem,
        options,
        correctAnswer: itemEditForm.correctAnswer,
        rationale: itemEditForm.rationale,
        tags,
        difficulty: itemEditForm.difficulty,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      setEditingItemId("");
      toast({ title: "Practice item saved", description: "QA and contract artifacts need to be rebuilt before publish." });
    },
    onError: (error: any) => {
      toast({ title: "Item save failed", description: error?.message || "Check the options/tags JSON.", variant: "destructive" });
    },
  });

  const rebuildArtifactsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${selectedPackageId}/rebuild-artifacts?profile=harrity`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      refreshLaunchQueries();
      toast({
        title: data.reviewStatus === "ready_to_publish" ? "Artifacts rebuilt" : "Rebuild found blockers",
        description: `${data.qa?.qaSummary?.failCount || 0} QA fail, ${data.validation?.validationSummary?.failCount || 0} contract fail.`,
        variant: data.reviewStatus === "ready_to_publish" ? undefined : "destructive",
      });
    },
  });

  const toggleSource = (sourceId: string) => {
    setSelectedSourceIds((ids) => {
      const next = ids.includes(sourceId) ? ids.filter((id) => id !== sourceId) : [...ids, sourceId];
      if (!selectedMappingSourceId && next.length > 0) setSelectedMappingSourceId(next[0]);
      return next;
    });
  };

  const exportPackage = async () => {
    if (!selectedPackageId) return;
    await exportStatusQuery.refetch();
    window.location.href = `/api/admin/lesson-builder/packages/${selectedPackageId}/export?profile=harrity`;
    window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId, "export-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] });
    }, 1500);
  };

  const exportPilotOutcomes = (format: "csv" | "json") => {
    if (!selectedPackageId) return;
    window.location.href = `/api/admin/lesson-builder/packages/${selectedPackageId}/pilot-outcomes/export?format=${format}`;
    window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", selectedPackageId, "pilot-outcomes"] });
      refreshLaunchQueries();
    }, 1200);
  };

  const exportPilotEvidence = async (packageId?: string, format: "json" | "markdown" = "json") => {
    const targetPackageId = packageId || selectedPackageId;
    if (!targetPackageId) return;

    setEvidenceExportingPackageId(targetPackageId);
    try {
      const response = await fetch(`/api/admin/lesson-builder/packages/${targetPackageId}/pilot-evidence-export${format === "markdown" ? "?format=markdown" : ""}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to export pilot evidence");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="?([^"]+)"?/i)?.[1] || `${targetPackageId}-pilot-evidence${format === "markdown" ? "-brief.md" : ".json"}`;
      let report: PilotEvidenceReport | null = null;
      let blob: Blob;
      if (format === "markdown") {
        blob = new Blob([await response.text()], { type: "text/markdown;charset=utf-8" });
      } else {
        report = (await response.json()) as PilotEvidenceReport;
        blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      const activeLaunch = pilotLaunch?.package?.id === targetPackageId ? pilotLaunch : null;
      const activeDetail = detailQuery.data?.package.id === targetPackageId ? detailQuery.data : null;
      const totals = report?.cohortOutcomes?.totals || activeLaunch?.outcomes?.totals || {};
      const generatedFiles = report?.lessonAssets?.generatedFiles || [];
      const exportSummary = {
        packageId: targetPackageId,
        packageTitle: report?.package?.title || activeLaunch?.package?.title || activeDetail?.package.title || "Pilot lesson package",
        fileName,
        reportKind: format,
        generatedAt: report?.generatedAt || new Date().toISOString(),
        artifactCount: report?.lessonAssets?.artifactCount || activeLaunch?.exportStatus?.fileCount || generatedFiles.length || 0,
        generatedFileCount: generatedFiles.length || activeLaunch?.exportStatus?.fileCount || 0,
        auditPatternCount: report?.relatedAuditPatterns?.length ?? stats.auditPatterns,
        deckExemplarCount: report?.relatedDeckExemplars?.length ?? stats.driveDecks,
        relatedAssetPolicyNote: report?.relatedAssetPolicy?.note || "Related Drive/Pearson assets are reference-only; lesson claims must cite approved source-truth records.",
        assignedCount: totals.assigned || 0,
        completedCount: totals.completed || 0,
        exportReady: report ? Boolean(report.readiness?.exportReady) : activeLaunch?.exportStatus?.status === "ready",
      };
      setLatestEvidenceExport(exportSummary);
      toast({
        title: format === "markdown" ? "Pilot evidence brief exported" : "Pilot evidence exported",
        description: `${exportSummary.generatedFileCount} files, ${exportSummary.auditPatternCount} audit pattern(s), ${exportSummary.deckExemplarCount} deck exemplar(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", targetPackageId] });
      refreshLaunchQueries();
    } catch (error: any) {
      toast({
        title: "Evidence export failed",
        description: error?.message || "The pilot evidence report could not be downloaded.",
        variant: "destructive",
      });
    } finally {
      setEvidenceExportingPackageId("");
    }
  };

  const openPilotEvidenceReport = (packageId?: string) => {
    const targetPackageId = packageId || selectedPackageId;
    if (!targetPackageId) return;
    window.open(`/api/admin/lesson-builder/packages/${targetPackageId}/pilot-evidence-export?format=html`, "_blank", "noopener,noreferrer");
  };

  const copyLearnerLink = async () => {
    if (!selectedPackageId) return;
    const url = `${window.location.origin}/lessons/${selectedPackageId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Learner link copied", description: url });
    } catch {
      toast({ title: "Copy unavailable", description: url });
    }
  };

  const copyAssignmentLink = async (linkPath: string) => {
    const url = `${window.location.origin}${linkPath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Assignment link copied", description: url });
    } catch {
      toast({ title: "Copy unavailable", description: url });
    }
  };

  const startSlideEdit = (slide: PackageDetail["slides"][number]) => {
    setEditingSlideId(slide.id);
    setSlideEditForm({
      title: slide.title || "",
      visibleContentText: JSON.stringify(slide.visibleContent || {}, null, 2),
      speakerNotes: slide.speakerNotes || "",
      guidedNotes: slide.guidedNotes || "",
      retrievalPrompt: slide.retrievalPrompt || "",
      nclexCategory: slide.nclexCategory || "",
      cjmStep: slide.cjmStep || "",
      nursingProcess: slide.nursingProcess || "",
      bloomLevel: slide.bloomLevel || "",
    });
  };

  const startItemEdit = (item: PackageDetail["items"][number]) => {
    setEditingItemId(item.id);
    setItemEditForm({
      stem: item.stem || "",
      optionsText: JSON.stringify(item.options || [], null, 2),
      correctAnswer: item.correctAnswer || "",
      rationale: item.rationale || "",
      tagsText: JSON.stringify(item.tags || {}, null, 2),
      difficulty: item.difficulty || "application",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-teal-700" />
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Lesson Builder</h1>
            </div>
            <p className="max-w-3xl text-sm text-slate-600">
              Build learner-facing active lesson packages from approved source truth, NCLEX/CJM mappings, guided notes, practice items, citations, and QA gates.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Approved", stats.approvedSources],
              ["Ready", stats.readySources],
              ["Drive Decks", stats.driveDecks],
              ["Audit Patterns", stats.auditPatterns],
              ["Packages", stats.packages],
              ["Published", stats.published],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border bg-white px-4 py-3">
                <div className="text-xl font-semibold text-slate-950">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-white p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Rocket className="h-5 w-5 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-950">Pilot Launch Console</h2>
                <StatusBadge value={pilotLaunch?.pilotReady ? "approved_for_pilot" : pilotLaunchQuery.isLoading ? "running" : "incomplete"} />
              </div>
              <div className="max-w-3xl text-sm text-slate-600">
                {pilotLaunch?.package
                  ? `${pilotLaunch.package.title} is the active launch package for the internal pilot.`
                  : "Publish a package to activate the cohort launch view."}
              </div>
              <div className="flex flex-wrap gap-2">
                {pilotLaunch?.package?.id ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedPackageId(pilotLaunch.package!.id);
                        setActiveTab("review");
                      }}
                    >
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Open Package
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPackageId(pilotLaunch.package!.id);
                        runAiReviewMutation.mutate(pilotLaunch.package!.id);
                      }}
                      disabled={runAiReviewMutation.isPending}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI Review
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(pilotLaunch.package!.learnerUrl, "_blank")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Learner
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportPilotEvidence(pilotLaunch.package!.id)}
                      disabled={evidenceExportingPackageId === pilotLaunch.package!.id}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {evidenceExportingPackageId === pilotLaunch.package!.id ? "Exporting..." : "Export Evidence"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportPilotEvidence(pilotLaunch.package!.id, "markdown")}
                      disabled={evidenceExportingPackageId === pilotLaunch.package!.id}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export Brief
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPilotEvidenceReport(pilotLaunch.package!.id)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Report
                    </Button>
                  </>
                ) : null}
                {pilotLaunch?.assignment?.firstLearnerLink ? (
                  <Button size="sm" variant="outline" onClick={() => copyAssignmentLink(pilotLaunch.assignment!.firstLearnerLink!)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Learner Link
                  </Button>
                ) : null}
              </div>
              {latestEvidenceExport ? (
                <div className="max-w-3xl rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Latest pilot evidence report</span>
                    <StatusBadge value={latestEvidenceExport.exportReady ? "export_ready" : "needs_export_check"} />
                  </div>
                  <div className="mt-1 text-xs leading-5 text-teal-900">
                    {latestEvidenceExport.fileName} downloaded as a {latestEvidenceExport.reportKind === "markdown" ? "director-ready brief" : "JSON evidence bundle"} for {latestEvidenceExport.packageTitle}. It references {latestEvidenceExport.generatedFileCount} generated file(s), {latestEvidenceExport.artifactCount} artifact(s), {latestEvidenceExport.auditPatternCount} audit pattern(s), {latestEvidenceExport.deckExemplarCount} deck exemplar(s), and {latestEvidenceExport.completedCount}/{latestEvidenceExport.assignedCount} completed learner(s).
                    <div className="mt-1 font-medium">{latestEvidenceExport.relatedAssetPolicyNote}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:min-w-[440px] xl:grid-cols-3">
              <div className="rounded-md bg-slate-50 px-3 py-2">AI: {pilotLaunch?.health.aiReady ? String(pilotLaunch.health.aiMode || aiMode).replace(/_/g, " ") : "not ready"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Drive decks: {stats.driveDecks}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Audit patterns: {stats.auditPatterns}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Assigned: {pilotLaunch?.outcomes?.totals.assigned ?? 0}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Completed: {pilotLaunch?.outcomes?.totals.completed ?? 0}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Export: {pilotLaunch?.exportStatus?.status?.replace(/_/g, " ") || "not checked"}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Readiness ladder</div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(pilotLaunch?.readinessSteps || []).map((step) => (
                  <div key={step.key} className="rounded-md border bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">{step.label}</div>
                      <StatusBadge value={step.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{step.detail}</div>
                  </div>
                ))}
                {!pilotLaunchQuery.isLoading && !pilotLaunch?.readinessSteps?.length ? (
                  <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">No launch package is ready yet.</div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Avatar solutions</div>
              <div className="grid gap-2">
                {(pilotLaunch?.avatars || []).map((avatar) => (
                  <div key={avatar.key} className="rounded-md border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{avatar.label}</div>
                        <div className="text-xs text-slate-500">{avatar.solution}</div>
                      </div>
                      <StatusBadge value={avatar.status} />
                    </div>
                    <div className="mt-2 text-xs text-slate-600">{avatar.nextAction}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {pilotLaunch?.nextActions?.length ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-semibold text-amber-950">Next actions</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {pilotLaunch.nextActions.map((action) => (
                  <div key={action.key} className="text-sm text-amber-900">
                    <span className="font-medium">{action.label}:</span> {action.detail}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {auditPatternSources.length || driveDeckSources.length ? (
            <div className="mt-4 flex gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              <div>
                <span className="font-semibold">Related assets are reference-only.</span> Drive decks and Pearson dashboards support lesson grammar, workflow review, traceability, and reporting; lesson claims must still cite approved source-truth records.
              </div>
            </div>
          ) : null}

          {auditPatternSources.length ? (
            <div className="mt-4 rounded-md border bg-slate-50 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Related audit patterns</div>
                  <div className="text-xs text-slate-500">Pearson dashboard references for premium review, traceability, and evidence reporting.</div>
                </div>
                <Badge variant="outline">{auditPatternSources.length} pattern{auditPatternSources.length === 1 ? "" : "s"}</Badge>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {auditPatternSources.map((source) => {
                  const patternUse = Array.isArray(source.metadata?.patternUse) ? source.metadata.patternUse.slice(0, 4) : [];
                  return (
                    <div key={source.id} className="rounded-md border bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-950">{source.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{source.subject || source.sourceType}</div>
                        </div>
                        {source.sourceUri ? (
                          <Button size="sm" variant="outline" onClick={() => window.open(source.sourceUri, "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">Sites pattern</Badge>
                        {source.metadata?.premiumWorkflowPattern ? <Badge variant="outline">premium review</Badge> : null}
                        {source.metadata?.sitesRole ? <Badge variant="outline">{String(source.metadata.sitesRole).replace(/_/g, " ")}</Badge> : null}
                      </div>
                      {patternUse.length ? (
                        <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                          {patternUse.map((use: string) => (
                            <div key={use} className="rounded bg-slate-50 px-2 py-1">{use}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {driveDeckSources.length ? (
            <div className="mt-4 rounded-md border bg-white p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Related deck exemplars</div>
                  <div className="text-xs text-slate-500">Google Drive PPT/Slides references for lesson grammar, pipeline framing, and chapter-deck structure.</div>
                </div>
                <Badge variant="outline">{driveDeckSources.length} deck{driveDeckSources.length === 1 ? "" : "s"}</Badge>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {driveDeckSources.slice(0, 6).map((source) => {
                  const role = source.metadata?.driveSourceRole ? String(source.metadata.driveSourceRole).replace(/_/g, " ") : source.sourceType.replace(/_/g, " ");
                  const deckFacts = [
                    source.metadata?.chapter,
                    source.metadata?.unit,
                    source.metadata?.slideCount ? `${source.metadata.slideCount} slides` : "",
                    source.metadata?.outlineSummary,
                  ].filter(Boolean).slice(0, 3);
                  return (
                    <div key={source.id} className="rounded-md border bg-slate-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-950">{source.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{source.subject || source.sourceType}</div>
                        </div>
                        {source.sourceUri ? (
                          <Button size="sm" variant="outline" onClick={() => window.open(source.sourceUri, "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">Drive deck</Badge>
                        <Badge variant="outline">{role}</Badge>
                        {source.metadata?.driveMimeType ? <Badge variant="outline">{String(source.metadata.driveMimeType).includes("presentation") ? "slides" : "pptx"}</Badge> : null}
                      </div>
                      {deckFacts.length ? (
                        <div className="mt-3 grid gap-1 text-xs text-slate-600">
                          {deckFacts.map((fact: string) => (
                            <div key={fact} className="rounded bg-white px-2 py-1">{fact}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-md border bg-white p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Full MVP build map</div>
                <div className="text-xs text-slate-500">How the Replit apps, Data Chunker Pro, OpenAI agents, Drive/MNN packages, and Pearson dashboards feed the launch product.</div>
              </div>
              <Badge variant="outline">Lesson Builder first</Badge>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {fullMvpBuildRails.map((rail) => (
                <div key={rail.label} className="rounded-md border bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-950">{rail.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{rail.source}</div>
                    </div>
                    <StatusBadge value={rail.status} />
                  </div>
                  <div className="mt-3 text-xs leading-5 text-slate-700">{rail.value}</div>
                  <div className="mt-3 rounded bg-white px-2 py-1 text-xs text-slate-600">{rail.next}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Activity className="h-4 w-4 text-slate-500" />
                Database
              </div>
              <StatusBadge value={health?.database.status || (healthQuery.isLoading ? "running" : "failed")} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{health?.database.configured ? "DB-backed runtime" : "Preview fallback available"}</div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Layers3 className="h-4 w-4 text-slate-500" />
                Sources
              </div>
              <StatusBadge value={health?.sourceRegistry.status || "running"} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{health?.sourceRegistry.sourceCount || 0} registered, {health?.sourceRegistry.archiveImportCount || 0} archives</div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Archive className="h-4 w-4 text-slate-500" />
                Ingestion
              </div>
              <StatusBadge value={health?.ingestion.status || "running"} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{health?.ingestion.documentCount || 0} knowledge documents</div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <FileCheck2 className="h-4 w-4 text-slate-500" />
                Export
              </div>
              <StatusBadge value={health?.export.status || "running"} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{health?.export.requiredFiles?.length || 0} Harrity files tracked</div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Sparkles className="h-4 w-4 text-slate-500" />
                Agent
              </div>
              <StatusBadge value={health?.agent.status || "agent_missing"} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {String(aiMode).replace(/_/g, " ")} mode
              {health?.agent.credentialStatus ? `, credential ${health.agent.credentialStatus.replace(/_/g, " ")}` : ""}
            </div>
          </div>
          <div className="rounded-md border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <ClipboardCheck className="h-4 w-4 text-slate-500" />
                Pilot
              </div>
              <StatusBadge value={health?.pilotReadiness?.status || "running"} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {health?.pilotReadiness?.documentBackedSourceCount || 0} document sources, {health?.pilotReadiness?.packageCount || 0} packages
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                <ClipboardCheck className="h-4 w-4 text-slate-500" />
                Pilot launch readiness
                <StatusBadge value={health?.pilotReadiness?.status || "running"} />
                {health?.pilotReadiness?.pilotLaunchReady ? <StatusBadge value="approved_for_pilot" /> : null}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Latest published package: {health?.pilotReadiness?.latestPublishedPackageTitle || "none"}.
              </div>
            </div>
            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-4 lg:grid-cols-7">
              <div className="rounded-md bg-slate-50 px-3 py-2">AI: {aiReady ? String(aiMode).replace(/_/g, " ") : "not ready"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Official source: {health?.pilotReadiness?.officialPilotSourceReady ? "ready" : "needed"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Normalized: {health?.pilotReadiness?.normalizedSourceCount ?? 0}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Weak topic: {health?.pilotReadiness?.assessmentBridgeReady ? "attached" : "needed"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">QA fails: {health?.pilotReadiness?.latestQaFailCount ?? 0}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Contract fails: {health?.pilotReadiness?.latestContractFailCount ?? 0}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Export: {health?.pilotReadiness?.exportReady ? "ready" : "not verified"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                Review: {health?.pilotReadiness?.aiReviewedPilotApproved
                  ? "AI reviewed"
                  : health?.pilotReadiness?.humanFacultyApproved
                    ? "faculty approved"
                    : (health?.pilotReadiness?.latestReviewDecision || "awaiting_review").replace(/_/g, " ")}
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Faculty: {health?.pilotReadiness?.humanFacultyApproved ? "approved" : "premium"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Assignment: {health?.pilotReadiness?.assignmentActive ? "active" : "needed"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Completion: {health?.pilotReadiness?.learnerCompletionPresent ? "recorded" : "not yet"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Learner events: {health?.pilotReadiness?.latestPackageLearnerEventCount ?? 0}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Feedback: {health?.pilotReadiness?.latestPackageFeedbackCount ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Pilot release readiness
                <StatusBadge value={releaseReadiness?.pilotReady ? "ready" : releaseReadinessQuery.isLoading ? "running" : "blocked"} />
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {releaseFailCount} blocker{releaseFailCount === 1 ? "" : "s"}, {releaseWarnCount} warning{releaseWarnCount === 1 ? "" : "s"}.
                TypeScript: {(releaseReadiness?.typecheckStatus || "unknown").replace(/_/g, " ")}.
              </div>
            </div>
            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md bg-slate-50 px-3 py-2">DB: {releaseReadiness?.dbReady ? "ready" : "missing"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Auth: {releaseReadiness?.authReady ? "ready" : "needs secret"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Registration: {releaseReadiness?.registrationReady ? "ready" : "blocked"}</div>
              <div className="rounded-md bg-slate-50 px-3 py-2">Export: {releaseReadiness?.exportReady ? "ready" : "not verified"}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {releaseBlockers.map((blocker) => (
              <div
                key={blocker.key}
                className={`rounded-md border px-3 py-2 text-sm ${
                  blocker.status === "fail"
                    ? "border-red-200 bg-red-50 text-red-950"
                    : blocker.status === "warn"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : "border-emerald-200 bg-emerald-50 text-emerald-950"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{blocker.label}</span>
                  <StatusBadge value={blocker.status} />
                </div>
                <div className="mt-1 text-xs opacity-80">{blocker.detail}</div>
              </div>
            ))}
            {!releaseReadinessQuery.isLoading && releaseBlockers.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Release readiness is unavailable. Refresh after the server finishes loading health data.
              </div>
            ) : null}
          </div>
        </div>

        {(agentStatus === "fallback_only" || agentStatus === "agent_invalid_key") && (
          <div className={`rounded-md border p-4 ${agentStatus === "agent_invalid_key" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
              <div className="space-y-1 text-sm">
                <div className="font-semibold">
                  {agentStatus === "agent_invalid_key"
                    ? "Live AI credential needs attention"
                    : directOpenAiConfigured && !endpointConfigured
                      ? "Workspace lesson-agent endpoint is not configured"
                      : "Generation is currently fallback-only"}
                </div>
                <div>
                  {agentStatus === "agent_invalid_key"
                    ? "Agent-assisted generation will use deterministic templates until the server-side OpenAI or lesson-agent key is replaced."
                    : directOpenAiConfigured && !endpointConfigured
                      ? "Direct OpenAI generation is configured for server-side live drafting; deterministic templates remain the fallback if a run cannot complete."
                      : "The MVP remains usable, but package generation will use deterministic templates until a valid server-side OpenAI or lesson-agent credential is configured."}
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:max-w-3xl">
            <TabsTrigger value="sources">
              <Layers3 className="mr-2 h-4 w-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="mappings">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Taxonomy
            </TabsTrigger>
            <TabsTrigger value="generate">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="review">
              <PackageCheck className="mr-2 h-4 w-4" />
              QA & Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Approved Source Registry</CardTitle>
                    {hiddenSmokeSourceCount > 0 && (
                      <div className="mt-1 text-xs text-slate-500">{hiddenSmokeSourceCount} rejected smoke-test source{hiddenSmokeSourceCount === 1 ? "" : "s"} hidden.</div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => sourcesQuery.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="w-12 px-3 py-2">Use</th>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Subject</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourcesQuery.isLoading ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading sources...</td>
                          </tr>
                        ) : visibleSources.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-slate-500">No approved sources yet.</td>
                          </tr>
                        ) : visibleSources.map((source) => (
                          <tr key={source.id} className="border-t">
                            <td className="px-3 py-3 align-top">
                              <Checkbox
                                checked={selectedSourceIds.includes(source.id)}
                                onCheckedChange={() => toggleSource(source.id)}
                                disabled={Boolean(source.metadata?.blockedForGeneration || source.metadata?.noLlmIngestionWithoutPermission)}
                                aria-label={`Select ${source.title}`}
                              />
                            </td>
                            <td className="px-3 py-3 align-top">
                              <div className="font-medium text-slate-900">{source.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{source.edition || source.sourceKind}</div>
                              <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                                {source.documentId && <Badge variant="outline">document chunks: {source.metadata?.chunkCount || "ready"}</Badge>}
                                {source.sourceKind === "drive_presentation" && <Badge variant="outline">Drive slides/PPT</Badge>}
                                {source.sourceKind === "drive_package_hub" && <Badge variant="outline">Drive package hub</Badge>}
                                {source.sourceKind === "drive_supporting_manifest" && <Badge variant="outline">Drive manifest/QA</Badge>}
                                {source.sourceKind === "drive_presentation_collection" && <Badge variant="outline">Drive deck collection</Badge>}
                                {source.sourceKind === "drive_chapter_source_candidate" && <Badge variant="outline">chapter candidate</Badge>}
                                {source.sourceKind === "drive_notes_pass" && <Badge variant="outline">notes pass candidate</Badge>}
                                {source.sourceKind === "chatgpt_library_reference_pack" && <Badge variant="outline">ChatGPT library pack</Badge>}
                                {source.metadata?.origin === "chatgpt_library" && <Badge variant="outline">ChatGPT origin</Badge>}
                                {source.metadata?.requiresExport && <Badge variant="outline">requires export review</Badge>}
                                {source.sourceKind === "openstax_nursing_catalog" && <Badge variant="outline">OpenStax catalog</Badge>}
                                {source.sourceKind === "openstax_book_reference" && <Badge variant="outline">OpenStax book link</Badge>}
                                {source.metadata?.origin === "openstax" && <Badge variant="outline">OpenStax origin</Badge>}
                                {source.metadata?.noLlmIngestionWithoutPermission && <Badge variant="outline">no AI ingest without permission</Badge>}
                                {source.metadata?.referenceOnly && <Badge variant="outline">reference-only</Badge>}
                                {source.sourceKind === "sites_project" && <Badge variant="outline">Sites audit pattern</Badge>}
                                {source.metadata?.premiumWorkflowPattern && <Badge variant="outline">premium review pattern</Badge>}
                                {source.metadata?.archiveRole && <Badge variant="outline">{String(source.metadata.archiveRole).replace(/_/g, " ")}</Badge>}
                                {source.metadata?.archiveRole && <Badge variant="outline">read-only contract</Badge>}
                                {Boolean(source.metadata?.archiveSummary?.importantFiles?.length) && (
                                  <Badge variant="outline">manifest files: {source.metadata?.archiveSummary?.importantFiles?.length}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Badge variant="secondary">{source.sourceType}</Badge>
                            </td>
                            <td className="px-3 py-3 align-top text-slate-600">{source.subject || "General nursing"}</td>
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-wrap gap-1">
                                <StatusBadge value={source.approvalStatus} />
                                <StatusBadge value={source.ingestionStatus} />
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Button
                                size="sm"
                                variant={selectedSourceDetailId === source.id ? "default" : "outline"}
                                onClick={() => setSelectedSourceDetailId(source.id)}
                              >
                                Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      Source Detail
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedSourceDetailId ? (
                      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                        Select Details on a source to inspect provenance, chunks, and generated packages.
                      </div>
                    ) : sourceDetailQuery.isLoading ? (
                      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Loading source detail...</div>
                    ) : sourceDetailQuery.data ? (
                      <>
                        <div>
                          <div className="font-medium text-slate-950">{sourceDetailQuery.data.source.title}</div>
                          <div className="mt-1 text-xs text-slate-500 break-all">{sourceDetailQuery.data.source.documentId || sourceDetailQuery.data.source.sourceUri || "No document/source URI"}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md bg-slate-50 p-2">
                            <div className="text-slate-500">Chunks</div>
                            <div className="font-medium text-slate-900">{sourceDetailQuery.data.chunkCount}</div>
                          </div>
                          <div className="rounded-md bg-slate-50 p-2">
                            <div className="text-slate-500">Packages</div>
                            <div className="font-medium text-slate-900">{sourceDetailQuery.data.generatedPackageCount}</div>
                          </div>
                          <div className="rounded-md bg-slate-50 p-2">
                            <div className="text-slate-500">Approval</div>
                            <StatusBadge value={sourceDetailQuery.data.source.approvalStatus} />
                          </div>
                          <div className="rounded-md bg-slate-50 p-2">
                            <div className="text-slate-500">Citation</div>
                            <div className="font-medium text-slate-900">{sourceDetailQuery.data.source.metadata?.citationPolicy || sourceDetailQuery.data.source.citationPolicy || "cite paraphrase"}</div>
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-slate-900">Source normalization</div>
                              <div className="text-xs text-slate-500">NursesBrain-style metadata review for tables, crosswalks, taxonomy hints, and pilot source status.</div>
                            </div>
                            <StatusBadge value={sourceDetailQuery.data.normalization?.status || "needs_review"} />
                          </div>
                          {sourceDetailQuery.data.normalization ? (
                            <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                              <div className="rounded-md bg-slate-50 px-2 py-1">Tables: {sourceDetailQuery.data.normalization.detected?.tableCount || 0}</div>
                              <div className="rounded-md bg-slate-50 px-2 py-1">Crosswalks: {sourceDetailQuery.data.normalization.detected?.crosswalkSignalCount || 0}</div>
                              <div className="rounded-md bg-slate-50 px-2 py-1">Official: {sourceDetailQuery.data.normalization.officialPilot ? "yes" : "no"}</div>
                              <div className="rounded-md bg-slate-50 px-2 py-1">Weak topics: {sourceDetailQuery.data.normalization.weakTopics?.length || 0}</div>
                            </div>
                          ) : null}
                          <div className="grid gap-3">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <Checkbox
                                checked={normalizationForm.officialPilot}
                                onCheckedChange={(checked) => setNormalizationForm({ ...normalizationForm, officialPilot: Boolean(checked) })}
                              />
                              Mark as official pilot source
                            </label>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Weak topics</Label>
                                <Textarea
                                  value={normalizationForm.weakTopicsText}
                                  onChange={(event) => setNormalizationForm({ ...normalizationForm, weakTopicsText: event.target.value })}
                                  rows={3}
                                  placeholder="One topic per line"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>ATI / category hints</Label>
                                <Textarea
                                  value={normalizationForm.atiCategoriesText}
                                  onChange={(event) => setNormalizationForm({ ...normalizationForm, atiCategoriesText: event.target.value })}
                                  rows={3}
                                  placeholder="One category per line"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Normalization note</Label>
                              <Textarea
                                value={normalizationForm.notes}
                                onChange={(event) => setNormalizationForm({ ...normalizationForm, notes: event.target.value })}
                                rows={2}
                              />
                            </div>
                            <Button onClick={() => normalizeSourceMutation.mutate()} disabled={!selectedSourceDetailId || normalizeSourceMutation.isPending}>
                              <FileCheck2 className="mr-2 h-4 w-4" />
                              Normalize Source
                            </Button>
                          </div>
                        </div>
                        {sourceDetailQuery.data.archiveFiles.length > 0 && (
                          <div className="rounded-md border p-3">
                            <div className="mb-2 text-sm font-medium text-slate-900">Archive manifest</div>
                            <div className="max-h-40 space-y-1 overflow-auto text-xs text-slate-600">
                              {sourceDetailQuery.data.archiveFiles.slice(0, 12).map((file) => (
                                <div key={file.id} className="break-all">{file.filePath}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {sourceDetailQuery.data.packages.length > 0 && (
                          <div className="rounded-md border p-3">
                            <div className="mb-2 text-sm font-medium text-slate-900">Generated packages</div>
                            <div className="space-y-2">
                              {sourceDetailQuery.data.packages.slice(0, 5).map((pkg) => (
                                <div key={pkg.id} className="flex items-start justify-between gap-2 text-xs">
                                  <div>
                                    <div className="font-medium text-slate-900">{pkg.title}</div>
                                    <div className="text-slate-500">{pkg.topic}</div>
                                  </div>
                                  <StatusBadge value={pkg.status} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">Source detail could not be loaded.</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers3 className="h-4 w-4" />
                      Import Drive Package Hub
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="drive-package-title">Package title</Label>
                      <Input
                        id="drive-package-title"
                        value={drivePackageForm.title}
                        onChange={(event) => setDrivePackageForm({ ...drivePackageForm, title: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="drive-package-url">Drive folder URL</Label>
                      <Textarea
                        id="drive-package-url"
                        value={drivePackageForm.folderUrl}
                        onChange={(event) => setDrivePackageForm({ ...drivePackageForm, folderUrl: event.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDrivePackageForm({
                          folderUrl: "https://drive.google.com/drive/folders/18DNf_F1E9rdHjEDHYlqDeHlSKULZgTmb",
                          title: "MNN Maternal-Newborn Package Hub",
                          packageKind: "mnn_package_hub",
                        })}
                      >
                        MNN hub preset
                      </Button>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                      Imports create reference-only package records, manifest rows, and chapter source candidates. Admin approval is still required before any Drive content becomes lesson source truth.
                    </div>
                    <Button
                      className="w-full"
                      disabled={!drivePackageForm.folderUrl || importDrivePackageMutation.isPending}
                      onClick={() => importDrivePackageMutation.mutate()}
                    >
                      <Layers3 className="mr-2 h-4 w-4" />
                      Import Drive Package Metadata
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers3 className="h-4 w-4" />
                      Register ChatGPT Library Pack
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="chatgpt-library-title">Pack title</Label>
                      <Input
                        id="chatgpt-library-title"
                        value={chatgptLibraryForm.title}
                        onChange={(event) => setChatgptLibraryForm({ ...chatgptLibraryForm, title: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatgpt-library-url">Library URL</Label>
                      <Input
                        id="chatgpt-library-url"
                        value={chatgptLibraryForm.libraryUrl}
                        onChange={(event) => setChatgptLibraryForm({ ...chatgptLibraryForm, libraryUrl: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatgpt-project-title">Project context</Label>
                      <Input
                        id="chatgpt-project-title"
                        value={chatgptLibraryForm.projectTitle}
                        onChange={(event) => setChatgptLibraryForm({ ...chatgptLibraryForm, projectTitle: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatgpt-project-url">Project URL</Label>
                      <Textarea
                        id="chatgpt-project-url"
                        value={chatgptLibraryForm.projectUrl}
                        onChange={(event) => setChatgptLibraryForm({ ...chatgptLibraryForm, projectUrl: event.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatgpt-library-items">Visible file inventory</Label>
                      <Textarea
                        id="chatgpt-library-items"
                        value={chatgptLibraryForm.itemsText}
                        onChange={(event) => setChatgptLibraryForm({ ...chatgptLibraryForm, itemsText: event.target.value })}
                        rows={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatgpt-library-notes">Review note</Label>
                      <Textarea
                        id="chatgpt-library-notes"
                        value={chatgptLibraryForm.notes}
                        onChange={(event) => setChatgptLibraryForm({ ...chatgptLibraryForm, notes: event.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                      Registers visible ChatGPT Library metadata as pending reference-pack records. Export and approve a file before using it as source truth.
                    </div>
                    <Button
                      className="w-full"
                      disabled={!chatgptLibraryForm.title || !chatgptLibraryForm.itemsText.trim() || importChatgptLibraryMutation.isPending}
                      onClick={() => importChatgptLibraryMutation.mutate()}
                    >
                      <Layers3 className="mr-2 h-4 w-4" />
                      Register {parseChatgptLibraryItems(chatgptLibraryForm.itemsText, chatgptLibraryForm.projectTitle).length} Library Files
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers3 className="h-4 w-4" />
                      Register OpenStax Nursing Catalog
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="openstax-title">Catalog title</Label>
                      <Input
                        id="openstax-title"
                        value={openStaxForm.title}
                        onChange={(event) => setOpenStaxForm({ ...openStaxForm, title: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openstax-url">OpenStax subject URL</Label>
                      <Textarea
                        id="openstax-url"
                        value={openStaxForm.subjectUrl}
                        onChange={(event) => setOpenStaxForm({ ...openStaxForm, subjectUrl: event.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openstax-notes">Permission note</Label>
                      <Textarea
                        id="openstax-notes"
                        value={openStaxForm.notes}
                        onChange={(event) => setOpenStaxForm({ ...openStaxForm, notes: event.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                      Registers 8 OpenStax nursing books as link-only metadata. These records are blocked from AI generation until OpenStax ingestion permission is confirmed.
                    </div>
                    <Button
                      className="w-full"
                      disabled={!openStaxForm.title || !openStaxForm.subjectUrl || importOpenStaxMutation.isPending}
                      onClick={() => importOpenStaxMutation.mutate()}
                    >
                      <Layers3 className="mr-2 h-4 w-4" />
                      Register OpenStax Catalog Links
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Archive className="h-4 w-4" />
                      Import Source Archive
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="archive-path">Local zip path</Label>
                      <Textarea
                        id="archive-path"
                        value={archiveForm.archivePath}
                        onChange={(event) => setArchiveForm({ ...archiveForm, archivePath: event.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Archive role</Label>
                      <Select value={archiveForm.role} onValueChange={(value) => setArchiveForm({ ...archiveForm, role: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="harrity_pipeline_contract">Harrity pipeline contract</SelectItem>
                          <SelectItem value="chapter_deck_schema">Chapter deck schema</SelectItem>
                          <SelectItem value="pilot_preflight_package">Pilot preflight package</SelectItem>
                          <SelectItem value="chunking_search_pattern">Chunking/search pattern</SelectItem>
                          <SelectItem value="base_app">Base app</SelectItem>
                          <SelectItem value="pattern_reference">Pattern reference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["Harrity", "C:\\Users\\bobby\\Downloads\\harrity_lesson_builder_pipeline_skill_v2_20260509.zip", "harrity_pipeline_contract"],
                        ["Deck", "C:\\Users\\bobby\\Downloads\\nursing-chapter-deck-builder.zip", "chapter_deck_schema"],
                        ["Pilot", "C:\\Users\\bobby\\Downloads\\20260528_NCC_AMS_preflight_package.zip", "pilot_preflight_package"],
                      ].map(([label, archivePath, role]) => (
                        <Button key={label} type="button" variant="outline" size="sm" onClick={() => setArchiveForm({ archivePath, role })}>
                          {label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      disabled={!archiveForm.archivePath || importArchiveMutation.isPending}
                      onClick={() => importArchiveMutation.mutate()}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Import Archive
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={importPilotSetMutation.isPending}
                      onClick={() => importPilotSetMutation.mutate()}
                    >
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Import Pilot Set
                    </Button>

                    {latestArchiveImport && (
                      <div className="rounded-md border bg-slate-50 p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-slate-900">{latestArchiveImport.title}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {latestArchiveImport.role} | {latestArchiveFileCount} files
                            </div>
                          </div>
                          <StatusBadge value={latestArchiveImport.status} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileCheck2 className="h-4 w-4" />
                      Attach Knowledge Document
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Ingested document</Label>
                      <Select
                        value={documentSourceForm.documentId}
                        onValueChange={(value) => setDocumentSourceForm({ ...documentSourceForm, documentId: value })}
                      >
                        <SelectTrigger><SelectValue placeholder="Choose knowledge-base document" /></SelectTrigger>
                        <SelectContent>
                          {(sourcesQuery.data?.documents || []).map((document) => (
                            <SelectItem key={document.id} value={document.id}>
                              {document.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Source type</Label>
                        <Select
                          value={documentSourceForm.sourceType}
                          onValueChange={(value) => setDocumentSourceForm({ ...documentSourceForm, sourceType: value })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nursing_content_source">Nursing content</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="textbook">Textbook</SelectItem>
                            <SelectItem value="review_topic_source">Review topic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="document-subject">Subject</Label>
                        <Input
                          id="document-subject"
                          value={documentSourceForm.subject}
                          onChange={(event) => setDocumentSourceForm({ ...documentSourceForm, subject: event.target.value })}
                        />
                      </div>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                      Generation uses attached document chunks first; archive metadata is only fallback provenance.
                    </div>
                    <Button
                      className="w-full"
                      disabled={!documentSourceForm.documentId || attachDocumentMutation.isPending}
                      onClick={() => attachDocumentMutation.mutate()}
                    >
                      <FileCheck2 className="mr-2 h-4 w-4" />
                      Attach as Approved Source
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FilePlus2 className="h-4 w-4" />
                      Register Source
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="source-title">Title</Label>
                    <Input
                      id="source-title"
                      value={sourceForm.title}
                      onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })}
                      placeholder="ATI Pharmacology Review Manual"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Kind</Label>
                      <Select value={sourceForm.sourceKind} onValueChange={(value) => setSourceForm({ ...sourceForm, sourceKind: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local_file">Local file</SelectItem>
                          <SelectItem value="drive_sheet">Drive sheet</SelectItem>
                          <SelectItem value="drive_presentation">Drive slides/PPT</SelectItem>
                          <SelectItem value="drive_package_hub">Drive package hub</SelectItem>
                          <SelectItem value="drive_chapter_source_candidate">Drive chapter candidate</SelectItem>
                          <SelectItem value="chatgpt_library_reference_pack">ChatGPT library pack</SelectItem>
                          <SelectItem value="openstax_nursing_catalog">OpenStax nursing catalog</SelectItem>
                          <SelectItem value="openstax_book_reference">OpenStax book reference</SelectItem>
                          <SelectItem value="sites_project">Sites audit dashboard</SelectItem>
                          <SelectItem value="document">Knowledge document</SelectItem>
                          <SelectItem value="taxonomy">Taxonomy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={sourceForm.sourceType} onValueChange={(value) => setSourceForm({ ...sourceForm, sourceType: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="textbook">Textbook</SelectItem>
                          <SelectItem value="blueprint">Blueprint</SelectItem>
                          <SelectItem value="crosswalk">Crosswalk</SelectItem>
                          <SelectItem value="golden_lesson_example">Golden lesson example</SelectItem>
                          <SelectItem value="drive_package_collection">Drive package collection</SelectItem>
                          <SelectItem value="maternal_newborn_chapter_candidate">MNN chapter candidate</SelectItem>
                          <SelectItem value="course_concept_audit_workflow_pattern">Course audit workflow pattern</SelectItem>
                          <SelectItem value="concept_course_audit_pattern">Concept audit pattern</SelectItem>
                          <SelectItem value="reference">Reference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source-subject">Subject</Label>
                    <Input
                      id="source-subject"
                      value={sourceForm.subject}
                      onChange={(event) => setSourceForm({ ...sourceForm, subject: event.target.value })}
                      placeholder="Pharmacology, Med-Surg, Fundamentals"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source-uri">Source URL or local note</Label>
                    <Textarea
                      id="source-uri"
                      value={sourceForm.sourceUri}
                      onChange={(event) => setSourceForm({ ...sourceForm, sourceUri: event.target.value })}
                      placeholder="Drive URL, local path note, or source handling note"
                      rows={3}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!sourceForm.title || importSourceMutation.isPending}
                    onClick={() => importSourceMutation.mutate()}
                  >
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Register Approved Source
                  </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mappings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Taxonomy Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label>Source to map</Label>
                    <Select value={selectedMappingSourceId || selectedSourceIds[0] || ""} onValueChange={setSelectedMappingSourceId}>
                      <SelectTrigger><SelectValue placeholder="Choose selected source" /></SelectTrigger>
                      <SelectContent>
                        {selectedSources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>{source.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">
                      {selectedSources.length} selected source{selectedSources.length === 1 ? "" : "s"} will be used for generation.
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Taxonomy</th>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Label</th>
                          <th className="px-3 py-2">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappingRows.map((row, index) => (
                          <tr key={`${row.taxonomy}-${row.code}-${index}`} className="border-t">
                            <td className="px-3 py-2">
                              <Input value={row.taxonomy} onChange={(event) => {
                                const next = [...mappingRows];
                                next[index] = { ...row, taxonomy: event.target.value };
                                setMappingRows(next);
                              }} />
                            </td>
                            <td className="px-3 py-2">
                              <Input value={row.code} onChange={(event) => {
                                const next = [...mappingRows];
                                next[index] = { ...row, code: event.target.value };
                                setMappingRows(next);
                              }} />
                            </td>
                            <td className="px-3 py-2">
                              <Input value={row.label} onChange={(event) => {
                                const next = [...mappingRows];
                                next[index] = { ...row, label: event.target.value };
                                setMappingRows(next);
                              }} />
                            </td>
                            <td className="px-3 py-2">
                              <Input type="number" min="0" max="1" step="0.05" value={row.confidence} onChange={(event) => {
                                const next = [...mappingRows];
                                next[index] = { ...row, confidence: Number(event.target.value) };
                                setMappingRows(next);
                              }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setMappingRows([...mappingRows, { taxonomy: "Review Topic", code: "", label: lessonForm.topic, confidence: 0.85 }])}>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Add Topic Mapping
                  </Button>
                  <Button disabled={selectedSources.length === 0 || reviewMappingsMutation.isPending} onClick={() => reviewMappingsMutation.mutate()}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Save Mapping Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    Generation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lesson-title">Package title</Label>
                    <Input id="lesson-title" value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lesson-topic">Lesson topic</Label>
                    <Input id="lesson-topic" value={lessonForm.topic} onChange={(event) => setLessonForm({ ...lessonForm, topic: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select value={lessonForm.audience} onValueChange={(value) => setLessonForm({ ...lessonForm, audience: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prelicensure RN">Prelicensure RN</SelectItem>
                        <SelectItem value="PN/VN">PN/VN</SelectItem>
                        <SelectItem value="RN remediation">RN remediation</SelectItem>
                        <SelectItem value="Faculty preview">Faculty preview</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Generation mode</Label>
                      <StatusBadge value={agentStatusQuery.data?.status || "agent_missing"} />
                    </div>
                    <Select
                      value={lessonForm.generationMode}
                      onValueChange={(value) => {
                        setGenerationModeTouched(true);
                        setLessonForm({ ...lessonForm, generationMode: value });
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="template">Template</SelectItem>
                        <SelectItem value="agent_assisted">Agent-assisted</SelectItem>
                      </SelectContent>
                    </Select>
                    {!aiReady && (
                      <p className="text-xs text-slate-500">
                        Agent-assisted is the product default. The server will use deterministic fallback when live AI is missing or the credential is invalid.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="slide-count">Slides</Label>
                      <Input id="slide-count" type="number" min="6" max="12" value={lessonForm.slideCount} onChange={(event) => setLessonForm({ ...lessonForm, slideCount: Number(event.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <Select value={lessonForm.difficulty} onValueChange={(value) => setLessonForm({ ...lessonForm, difficulty: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recognition">Recognition</SelectItem>
                          <SelectItem value="application">Application</SelectItem>
                          <SelectItem value="analysis">Analysis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                      checked={lessonForm.includeGuidedNotes}
                      onCheckedChange={(checked) => setLessonForm({ ...lessonForm, includeGuidedNotes: Boolean(checked) })}
                    />
                    <Label>Include guided notes in the package model</Label>
                  </div>
                  <Button
                    className="w-full"
                    disabled={selectedSourceIds.length === 0 || generateMutation.isPending}
                    onClick={() => generateMutation.mutate()}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Generate Lesson Package
                  </Button>
                </CardContent>
              </Card>

              <div className="rounded-md border bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Layers3 className="h-4 w-4" />
                  Selected Sources
                </div>
                {selectedSources.length === 0 ? (
                  <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                    Select approved source truth before generating.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedSources.map((source) => (
                      <div key={source.id} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">{source.title}</div>
                          <StatusBadge value={source.approvalStatus} />
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{source.subject || source.sourceType}</div>
                        {source.metadata?.archiveRole && (
                          <div className="mt-2 text-xs text-slate-500">
                            Archive role: {String(source.metadata.archiveRole).replace(/_/g, " ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Packages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {packages.length === 0 ? (
                    <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No generated packages yet.</div>
                  ) : packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`w-full rounded-md border p-3 text-left transition hover:bg-slate-50 ${selectedPackageId === pkg.id ? "border-teal-500 bg-teal-50/60" : "bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-900">{pkg.title}</div>
                          <div className="text-xs text-slate-500">{pkg.topic}</div>
                        </div>
                        <StatusBadge value={pkg.status} />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        QA: {pkg.qaSummary?.failCount || 0} fail, {pkg.qaSummary?.warningCount || 0} warn
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-4">
                {!selectedPackageId ? (
                  <div className="rounded-md border bg-white p-8 text-center text-sm text-slate-600">
                    Select a generated package to preview slides, QA, citations, and export files.
                  </div>
                ) : detailQuery.isLoading ? (
                  <div className="rounded-md border bg-white p-8 text-center text-sm text-slate-600">Loading package...</div>
                ) : detailQuery.data ? (
                  <>
                    <div className="rounded-md border bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-slate-950">{detailQuery.data.package.title}</h2>
                            <StatusBadge value={detailQuery.data.package.status} />
                          </div>
                          <div className="mt-1 text-sm text-slate-600">{detailQuery.data.package.topic} | {detailQuery.data.package.audience}</div>
                          {selectedPackageGeneration && (
                            <div className="mt-3 flex flex-col gap-2 rounded-md border bg-slate-50 p-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-slate-900">Generation</span>
                                  <StatusBadge value={selectedPackageGeneration.status} />
                                  <span>{selectedPackageGeneration.label}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {selectedPackageGeneration.detailText}
                                  {selectedPackageGeneration.fallbackReason ? ` Reason: ${selectedPackageGeneration.fallbackReason}` : ""}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {detailQuery.data.package.status === "published" && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => window.open(`/lessons/${detailQuery.data?.package.id}`, "_blank", "noopener,noreferrer")}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Learner Lesson
                              </Button>
                              <Button variant="outline" onClick={copyLearnerLink}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Link
                              </Button>
                            </>
                          )}
                          <Button variant="outline" onClick={() => runQaMutation.mutate()} disabled={runQaMutation.isPending}>
                            <FlaskConical className="mr-2 h-4 w-4" />
                            Run QA
                          </Button>
                          <Button variant="outline" onClick={() => validateContractMutation.mutate()} disabled={validateContractMutation.isPending}>
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            Validate Contract
                          </Button>
                          <Button variant="outline" onClick={() => runAiReviewMutation.mutate(selectedPackageId)} disabled={runAiReviewMutation.isPending}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            AI Review
                          </Button>
                          <Button variant="outline" onClick={() => rebuildArtifactsMutation.mutate()} disabled={rebuildArtifactsMutation.isPending}>
                            <Save className="mr-2 h-4 w-4" />
                            Rebuild Artifacts
                          </Button>
                          <Button variant="outline" onClick={() => duplicatePackageMutation.mutate()} disabled={duplicatePackageMutation.isPending}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Regenerate
                          </Button>
                          <Button variant="outline" onClick={exportPackage}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Harrity
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => exportPilotEvidence(selectedPackageId)}
                            disabled={evidenceExportingPackageId === selectedPackageId}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {evidenceExportingPackageId === selectedPackageId ? "Exporting..." : "Export Evidence"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => exportPilotEvidence(selectedPackageId, "markdown")}
                            disabled={evidenceExportingPackageId === selectedPackageId}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Export Brief
                          </Button>
                          <Button variant="outline" onClick={() => openPilotEvidenceReport(selectedPackageId)}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Report
                          </Button>
                          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                            <Rocket className="mr-2 h-4 w-4" />
                            Publish
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                            <Layers3 className="h-4 w-4 text-slate-500" />
                            Assessment Bridge
                            <StatusBadge value={currentAssessmentBridge?.status || "needs_review"} />
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Attach a weak topic or ATI category to this package so assessment gaps can lead to the right lesson.
                          </div>
                          {currentAssessmentBridge ? (
                            <div className="mt-2 text-xs text-slate-500">
                              Current weak topic: {currentAssessmentBridge.weakTopic || "none"}
                              {currentAssessmentBridge.sourceTitle ? ` | Source: ${currentAssessmentBridge.sourceTitle}` : ""}
                            </div>
                          ) : null}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={assessmentBridgeForm.officialPilotPackage}
                            onCheckedChange={(checked) => setAssessmentBridgeForm({ ...assessmentBridgeForm, officialPilotPackage: Boolean(checked) })}
                          />
                          Official pilot package
                        </label>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-2 xl:col-span-2">
                          <Label>Weak topic</Label>
                          <Input
                            value={assessmentBridgeForm.weakTopic}
                            onChange={(event) => setAssessmentBridgeForm({ ...assessmentBridgeForm, weakTopic: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ATI category</Label>
                          <Input
                            value={assessmentBridgeForm.atiCategory}
                            onChange={(event) => setAssessmentBridgeForm({ ...assessmentBridgeForm, atiCategory: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>NCLEX category</Label>
                          <Input
                            value={assessmentBridgeForm.nclexCategory}
                            onChange={(event) => setAssessmentBridgeForm({ ...assessmentBridgeForm, nclexCategory: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CJM step</Label>
                          <Input
                            value={assessmentBridgeForm.cjmStep}
                            onChange={(event) => setAssessmentBridgeForm({ ...assessmentBridgeForm, cjmStep: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_auto] lg:items-end">
                        <div className="space-y-2">
                          <Label>Evidence source</Label>
                          <Select value={assessmentBridgeForm.sourceId || "none"} onValueChange={(value) => setAssessmentBridgeForm({ ...assessmentBridgeForm, sourceId: value === "none" ? "" : value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No specific source</SelectItem>
                              {detailQuery.data.sources.map((source) => (
                                <SelectItem key={source.id} value={source.id}>{source.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Bridge note</Label>
                          <Input
                            value={assessmentBridgeForm.note}
                            onChange={(event) => setAssessmentBridgeForm({ ...assessmentBridgeForm, note: event.target.value })}
                          />
                        </div>
                        <Button onClick={() => assessmentBridgeMutation.mutate()} disabled={assessmentBridgeMutation.isPending || assessmentBridgeForm.weakTopic.trim().length < 2}>
                          <Save className="mr-2 h-4 w-4" />
                          Save Bridge
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <div className="rounded-md border bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                            AI / Faculty Review
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {health?.pilotReadiness?.aiReviewedPilotApproved ? <StatusBadge value="ai_reviewed" /> : null}
                            {!health?.pilotReadiness?.humanFacultyApproved ? <StatusBadge value="premium_feature" /> : null}
                            <StatusBadge value={latestReview?.decision || "awaiting_review"} />
                          </div>
                        </div>
                        <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-950">
                          AI-reviewed `approved_for_pilot` satisfies internal launch readiness. Human faculty review remains a premium feature for formal release support.
                        </div>
                        {latestReview ? (
                          <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">{latestReview.reviewerName}</span>
                              <span>{latestReview.reviewerRole.replace(/_/g, " ")}</span>
                              {latestReview.createdAt ? <span>{new Date(latestReview.createdAt).toLocaleString()}</span> : null}
                            </div>
                            <p className="mt-2 leading-6">{latestReview.comment}</p>
                          </div>
                        ) : (
                          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                            No human faculty review has been recorded for this package yet. AI review can approve MVP pilot use; faculty review is the premium release gate.
                          </div>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Reviewer</Label>
                            <Input value={reviewForm.reviewerName} onChange={(event) => setReviewForm({ ...reviewForm, reviewerName: event.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Input value={reviewForm.reviewerRole} onChange={(event) => setReviewForm({ ...reviewForm, reviewerRole: event.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Decision</Label>
                            <Select value={reviewForm.decision} onValueChange={(value) => setReviewForm({ ...reviewForm, decision: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="comment">Comment only</SelectItem>
                                <SelectItem value="changes_requested">Changes requested</SelectItem>
                                <SelectItem value="approved_for_pilot">Approved for pilot</SelectItem>
                                <SelectItem value="approved_for_release">Approved for release</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Focus</Label>
                            <Select value={reviewForm.focusArea} onValueChange={(value) => setReviewForm({ ...reviewForm, focusArea: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="overall">Overall</SelectItem>
                                <SelectItem value="accuracy">Accuracy</SelectItem>
                                <SelectItem value="learner_experience">Learner experience</SelectItem>
                                <SelectItem value="assessment">Assessment</SelectItem>
                                <SelectItem value="accessibility">Accessibility</SelectItem>
                                <SelectItem value="source_traceability">Source traceability</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <Label>Review note</Label>
                          <Textarea value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} rows={3} />
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button onClick={() => saveReviewMutation.mutate()} disabled={saveReviewMutation.isPending || reviewForm.comment.trim().length < 3}>
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            Save Premium Faculty Review
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-md border bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">Pilot Assignment Loop</div>
                          <StatusBadge value={detailQuery.data.package.status === "published" ? "published" : "blocked"} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div className="rounded-md bg-slate-50 px-3 py-2">Assigned: {assignmentTotals.total}</div>
                          <div className="rounded-md bg-slate-50 px-3 py-2">In progress: {assignmentTotals.inProgress}</div>
                          <div className="rounded-md bg-slate-50 px-3 py-2">Complete: {assignmentTotals.completed}</div>
                          <div className="rounded-md bg-slate-50 px-3 py-2">Feedback: {assignmentTotals.feedback}</div>
                          <div className="rounded-md bg-slate-50 px-3 py-2">Opened: {learnerEventCounts.lesson_opened || 0}</div>
                          <div className="rounded-md bg-slate-50 px-3 py-2">Practice attempts: {learnerEventCounts.practice_attempted || 0}</div>
                        </div>

                        {detailQuery.data.package.status === "published" ? (
                          <div className="mt-4 rounded-md border bg-slate-50 p-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Assignment title</Label>
                                <Input
                                  value={assignmentForm.title}
                                  onChange={(event) => setAssignmentForm({ ...assignmentForm, title: event.target.value })}
                                  placeholder={`${detailQuery.data.package.title} Pilot Assignment`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Cohort</Label>
                                <Input value={assignmentForm.cohortName} onChange={(event) => setAssignmentForm({ ...assignmentForm, cohortName: event.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Due date</Label>
                                <Input type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })} />
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              <Label>Learners</Label>
                              <Textarea
                                value={assignmentForm.rosterText}
                                onChange={(event) => setAssignmentForm({ ...assignmentForm, rosterText: event.target.value })}
                                rows={4}
                                placeholder="One learner per line: Name, email@example.com"
                              />
                            </div>
                            <div className="mt-3 flex justify-end">
                              <Button onClick={() => createAssignmentMutation.mutate()} disabled={createAssignmentMutation.isPending || parseAssignmentRoster(assignmentForm.rosterText).length === 0}>
                                <PackageCheck className="mr-2 h-4 w-4" />
                                Create Assignment
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                            Publish this package before assigning it to learners.
                          </div>
                        )}

                        <div className="mt-4 space-y-3">
                          <div className="text-xs font-semibold uppercase text-slate-500">Assignments</div>
                          {assignments.length === 0 ? (
                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">No pilot assignments yet.</div>
                          ) : assignments.map((assignment) => (
                            <div key={assignment.id} className="rounded-md border p-3 text-sm text-slate-700">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="font-medium text-slate-900">{assignment.title}</div>
                                  <div className="text-xs text-slate-500">
                                    {assignment.cohortName}
                                    {assignment.dueDate ? ` | Due ${new Date(assignment.dueDate).toLocaleDateString()}` : ""}
                                  </div>
                                </div>
                                <StatusBadge value={assignment.status} />
                              </div>
                              <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-600">
                                <div className="rounded-md bg-slate-50 px-2 py-1">Total {assignment.counts?.total || 0}</div>
                                <div className="rounded-md bg-slate-50 px-2 py-1">Started {assignment.counts?.inProgress || 0}</div>
                                <div className="rounded-md bg-slate-50 px-2 py-1">Done {assignment.counts?.completed || 0}</div>
                                <div className="rounded-md bg-slate-50 px-2 py-1">Notes {assignment.counts?.feedback || 0}</div>
                              </div>
                              <div className="mt-3 space-y-2">
                                {assignment.learners.slice(0, 8).map((learner) => (
                                  <div key={learner.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                                    <div className="min-w-0">
                                      <div className="font-medium text-slate-900">{learner.learnerName}</div>
                                      <div className="text-xs text-slate-500">
                                        {learner.learnerEmail || "No email"}
                                        {learner.completedAt ? ` | Completed ${new Date(learner.completedAt).toLocaleDateString()}` : ""}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <StatusBadge value={learner.status} />
                                      <Button variant="outline" size="sm" onClick={() => copyAssignmentLink(learner.linkPath)}>
                                        <Copy className="mr-2 h-3.5 w-3.5" />
                                        Link
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => window.open(learner.linkPath, "_blank", "noopener,noreferrer")}>
                                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                        Open
                                      </Button>
                                    </div>
                                    {learner.feedbackComment ? (
                                      <p className="basis-full text-xs leading-5 text-slate-600">{learner.feedbackComment}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-semibold uppercase text-slate-500">Recent feedback</div>
                          {learnerFeedback.length === 0 ? (
                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">No learner feedback yet.</div>
                          ) : learnerFeedback.slice(0, 3).map((event) => (
                            <div key={event.id} className="rounded-md border p-3 text-sm text-slate-700">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={String(event.payload?.rating || "comment")} />
                                {event.createdAt ? <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span> : null}
                              </div>
                              {event.payload?.comment ? <p className="mt-2 leading-6">{String(event.payload.comment)}</p> : null}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-semibold uppercase text-slate-500">Release audit</div>
                          {(detailQuery.data.releaseAuditEvents || []).length === 0 ? (
                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">No release audit events yet.</div>
                          ) : (detailQuery.data.releaseAuditEvents || []).slice(0, 4).map((event) => (
                            <div key={event.id} className="rounded-md border p-3 text-sm text-slate-700">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={event.eventType} />
                                {event.createdAt ? <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span> : null}
                              </div>
                              <p className="mt-1 leading-6">{event.summary}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">Pilot Outcomes</div>
                          <div className="text-xs text-slate-500">Completion, practice attempts, feedback, and follow-up needs for assigned learners.</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => pilotOutcomesQuery.refetch()} disabled={pilotOutcomesQuery.isFetching}>
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Refresh
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportPilotOutcomes("csv")} disabled={!pilotOutcomes}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            CSV
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportPilotOutcomes("json")} disabled={!pilotOutcomes}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            JSON
                          </Button>
                        </div>
                      </div>

                      {pilotOutcomesQuery.isLoading ? (
                        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Loading pilot outcomes...</div>
                      ) : !pilotOutcomes ? (
                        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Pilot outcomes are not available for this package yet.</div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-6">
                            <div className="rounded-md bg-slate-50 px-3 py-2">Assigned: {pilotOutcomes.totals.assigned}</div>
                            <div className="rounded-md bg-slate-50 px-3 py-2">Opened: {pilotOutcomes.totals.opened}</div>
                            <div className="rounded-md bg-slate-50 px-3 py-2">Practice: {pilotOutcomes.totals.practiceAttempted}</div>
                            <div className="rounded-md bg-slate-50 px-3 py-2">Complete: {pilotOutcomes.totals.completed}</div>
                            <div className="rounded-md bg-slate-50 px-3 py-2">Feedback: {pilotOutcomes.totals.feedbackSubmitted}</div>
                            <div className="rounded-md bg-slate-50 px-3 py-2">Needs review: {pilotOutcomes.totals.needsReview}</div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-3">
                            <div className="rounded-md border p-3">
                              <div className="text-xs font-semibold uppercase text-slate-500">Practice</div>
                              <div className="mt-2 text-sm text-slate-700">
                                {pilotOutcomes.practiceSummary.attempts} attempts, {pilotOutcomes.practiceSummary.correct} correct
                                {pilotOutcomes.practiceSummary.accuracy !== null && pilotOutcomes.practiceSummary.accuracy !== undefined
                                  ? ` (${pilotOutcomes.practiceSummary.accuracy}% accuracy)`
                                  : ""}
                              </div>
                            </div>
                            <div className="rounded-md border p-3">
                              <div className="text-xs font-semibold uppercase text-slate-500">Feedback ratings</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(pilotOutcomes.feedbackSummary.ratings || {}).map(([rating, count]) => (
                                  <span key={rating} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">{rating}: {count}</span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-md border p-3">
                              <div className="text-xs font-semibold uppercase text-slate-500">Cohorts</div>
                              <div className="mt-2 space-y-1 text-sm text-slate-700">
                                {pilotOutcomes.assignments.length === 0 ? "No cohorts assigned." : pilotOutcomes.assignments.map((assignment) => (
                                  <div key={assignment.id} className="flex justify-between gap-3">
                                    <span className="truncate">{assignment.cohortName}</span>
                                    <span>{assignment.totals.completed}/{assignment.totals.assigned} complete</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="rounded-md border p-3">
                              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Action queue</div>
                              {pilotOutcomes.actionQueue.length === 0 ? (
                                <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">No learner follow-up needed right now.</div>
                              ) : (
                                <div className="space-y-2">
                                  {pilotOutcomes.actionQueue.slice(0, 6).map((item) => (
                                    <div key={`${item.assignmentId}-${item.learnerId}`} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-slate-900">{item.learnerName}</span>
                                        <StatusBadge value={item.status} />
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {item.reasons.map((reason) => <StatusBadge key={reason} value={reason} />)}
                                      </div>
                                      <p className="mt-2 leading-6">{item.recommendedAction}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="overflow-x-auto rounded-md border">
                              <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Learner</th>
                                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                                    <th className="px-3 py-2 text-left font-semibold">Practice</th>
                                    <th className="px-3 py-2 text-left font-semibold">Feedback</th>
                                    <th className="px-3 py-2 text-left font-semibold">Last activity</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {pilotOutcomes.learners.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No assigned learners yet.</td>
                                    </tr>
                                  ) : pilotOutcomes.learners.slice(0, 12).map((learner) => (
                                    <tr key={learner.learnerId}>
                                      <td className="px-3 py-2">
                                        <div className="font-medium text-slate-900">{learner.learnerName}</div>
                                        <div className="text-xs text-slate-500">{learner.cohortName}</div>
                                      </td>
                                      <td className="px-3 py-2"><StatusBadge value={learner.status} /></td>
                                      <td className="px-3 py-2 text-slate-700">{learner.practice.attempts} attempts, {learner.practice.correct} correct</td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {learner.feedback.rating ? (
                                          <div>
                                            <StatusBadge value={String(learner.feedback.rating)} />
                                            {learner.feedback.comment ? <div className="mt-1 max-w-xs truncate text-xs text-slate-500">{learner.feedback.comment}</div> : null}
                                          </div>
                                        ) : "None"}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {learner.lastActivityAt ? new Date(learner.lastActivityAt).toLocaleString() : "No activity"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-md border bg-white p-4">
                        <div className="mb-3 font-semibold text-slate-900">QA Gates</div>
                        <div className="space-y-2">
                          {detailQuery.data.qaResults.map((result) => (
                            <div key={result.id} className="rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-900">{result.gateName}</div>
                                <StatusBadge value={result.status} />
                              </div>
                              <div className="mt-1 text-sm text-slate-600">{result.details}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-md border bg-white p-4">
                        <div className="mb-3 font-semibold text-slate-900">Practice Items</div>
                        <div className="space-y-3">
                          {detailQuery.data.items.map((item) => (
                            <div key={item.id} className="rounded-md border p-3">
                              {editingItemId === item.id ? (
                                <div className="space-y-3">
                                  <div className="space-y-2">
                                    <Label>Stem</Label>
                                    <Textarea value={itemEditForm.stem} onChange={(event) => setItemEditForm({ ...itemEditForm, stem: event.target.value })} rows={3} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Options JSON</Label>
                                    <Textarea value={itemEditForm.optionsText} onChange={(event) => setItemEditForm({ ...itemEditForm, optionsText: event.target.value })} rows={5} className="font-mono text-xs" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label>Correct answer</Label>
                                      <Input value={itemEditForm.correctAnswer} onChange={(event) => setItemEditForm({ ...itemEditForm, correctAnswer: event.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Difficulty</Label>
                                      <Input value={itemEditForm.difficulty} onChange={(event) => setItemEditForm({ ...itemEditForm, difficulty: event.target.value })} />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Rationale</Label>
                                    <Textarea value={itemEditForm.rationale} onChange={(event) => setItemEditForm({ ...itemEditForm, rationale: event.target.value })} rows={3} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Tags JSON</Label>
                                    <Textarea value={itemEditForm.tagsText} onChange={(event) => setItemEditForm({ ...itemEditForm, tagsText: event.target.value })} rows={4} className="font-mono text-xs" />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" onClick={() => saveItemMutation.mutate()} disabled={saveItemMutation.isPending}>
                                      <Save className="mr-2 h-4 w-4" />
                                      Save Item
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingItemId("")}>
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-sm font-medium text-slate-900">{item.stem}</div>
                                    <Button size="sm" variant="outline" onClick={() => startItemEdit(item)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </Button>
                                  </div>
                                  <Separator className="my-2" />
                                  <div className="text-sm text-slate-700">Answer: {item.correctAnswer}</div>
                                  <div className="mt-1 text-sm text-slate-600">{item.rationale}</div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {Object.entries(item.tags || {}).map(([key, value]) => (
                                      <Badge key={key} variant="secondary">{key}: {String(value)}</Badge>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-md border bg-white p-4">
                        <div className="mb-3 font-semibold text-slate-900">Contract Validation</div>
                        <div className="space-y-2">
                          {(detailQuery.data.contractValidations || []).length === 0 ? (
                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Run contract validation to refresh Harrity package gates.</div>
                          ) : (detailQuery.data.contractValidations || []).map((result) => (
                            <div key={result.id} className="rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-900">{result.validationName}</div>
                                <StatusBadge value={result.status} />
                              </div>
                              <div className="mt-1 text-sm text-slate-600">{result.details}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-md border bg-white p-4">
                        <div className="mb-3 font-semibold text-slate-900">Runs & Artifacts</div>
                        <div className="space-y-3">
                          {(detailQuery.data.generationRuns || []).slice(0, 2).map((run) => (
                            <div key={run.id} className="rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-slate-900">{run.generationMode.replace(/_/g, " ")}</div>
                                <StatusBadge value={run.status} />
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Contract: {String(run.validationSummary?.contract?.status || "not validated")}
                              </div>
                            </div>
                          ))}
                          <div className="rounded-md border p-3">
                            <div className="text-sm font-medium text-slate-900">Export artifacts</div>
                            {exportStatusQuery.data && (
                              <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge value={exportStatusQuery.data.status} />
                                  <span>{exportStatusQuery.data.fileCount} files</span>
                                  <span>{exportStatusQuery.data.includesDeckModel ? "deck model included" : "deck model missing"}</span>
                                </div>
                                <div className="mt-1">
                                  Required missing: {exportStatusQuery.data.missingRequiredFiles.length ? exportStatusQuery.data.missingRequiredFiles.join(", ") : "none"}
                                </div>
                                <div className="mt-1">Checked {new Date(exportStatusQuery.data.generatedAt).toLocaleString()}</div>
                                {exportStatusQuery.data.latestExportAudit?.createdAt ? (
                                  <div className="mt-1">Last export {new Date(exportStatusQuery.data.latestExportAudit.createdAt).toLocaleString()}</div>
                                ) : null}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(detailQuery.data.artifacts || []).length === 0 ? (
                                <span className="text-xs text-slate-500">No artifacts persisted yet.</span>
                              ) : (detailQuery.data.artifacts || []).map((artifact) => (
                                <Badge key={artifact.id} variant="secondary">{artifact.fileName}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border bg-white p-4">
                      <div className="mb-3 font-semibold text-slate-900">Learner Deck Preview</div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {detailQuery.data.slides.map((slide) => (
                          <div key={slide.id} className="rounded-md border p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase text-slate-500">Slide {slide.slideNumber} | {slide.slideType.replace(/_/g, " ")}</div>
                                <div className="font-semibold text-slate-950">{slide.title}</div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Badge variant="secondary">{slide.cjmStep || "CJM"}</Badge>
                                {editingSlideId !== slide.id && (
                                  <Button size="sm" variant="outline" onClick={() => startSlideEdit(slide)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                            {editingSlideId === slide.id ? (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label>Title</Label>
                                  <Input value={slideEditForm.title} onChange={(event) => setSlideEditForm({ ...slideEditForm, title: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Visible content JSON</Label>
                                  <Textarea value={slideEditForm.visibleContentText} onChange={(event) => setSlideEditForm({ ...slideEditForm, visibleContentText: event.target.value })} rows={8} className="font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                  <Label>Retrieval prompt</Label>
                                  <Textarea value={slideEditForm.retrievalPrompt} onChange={(event) => setSlideEditForm({ ...slideEditForm, retrievalPrompt: event.target.value })} rows={2} />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Speaker notes</Label>
                                    <Textarea value={slideEditForm.speakerNotes} onChange={(event) => setSlideEditForm({ ...slideEditForm, speakerNotes: event.target.value })} rows={4} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Guided notes</Label>
                                    <Textarea value={slideEditForm.guidedNotes} onChange={(event) => setSlideEditForm({ ...slideEditForm, guidedNotes: event.target.value })} rows={4} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <Input placeholder="NCLEX category" value={slideEditForm.nclexCategory} onChange={(event) => setSlideEditForm({ ...slideEditForm, nclexCategory: event.target.value })} />
                                  <Input placeholder="CJM step" value={slideEditForm.cjmStep} onChange={(event) => setSlideEditForm({ ...slideEditForm, cjmStep: event.target.value })} />
                                  <Input placeholder="Nursing process" value={slideEditForm.nursingProcess} onChange={(event) => setSlideEditForm({ ...slideEditForm, nursingProcess: event.target.value })} />
                                  <Input placeholder="Bloom level" value={slideEditForm.bloomLevel} onChange={(event) => setSlideEditForm({ ...slideEditForm, bloomLevel: event.target.value })} />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" onClick={() => saveSlideMutation.mutate()} disabled={saveSlideMutation.isPending}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Slide
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingSlideId("")}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-3">{renderVisibleContent(slide.visibleContent)}</div>
                                {slide.retrievalPrompt && (
                                  <div className="mt-3 rounded-md bg-teal-50 p-3 text-sm text-teal-900">
                                    {slide.retrievalPrompt}
                                  </div>
                                )}
                                {(slide.speakerNotes || slide.guidedNotes) && (
                                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                    {slide.guidedNotes && <div className="rounded-md bg-slate-50 p-2">Guided notes: {slide.guidedNotes}</div>}
                                    {slide.speakerNotes && <div className="rounded-md bg-slate-50 p-2">Speaker notes: {slide.speakerNotes}</div>}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border bg-white p-8 text-center text-sm text-red-600">Package could not be loaded.</div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
