import { z } from "zod";

export const governanceGateSchema = z.enum([
  "taxonomy",
  "objectives",
  "outline",
  "script",
  "accessibility",
]);

const administrativeSchema = z.object({
  courseId: z.string().trim().max(120).default(""),
  courseName: z.string().trim().max(240).default(""),
  programLevel: z.string().trim().max(120).default(""),
  contentOwner: z.string().trim().max(160).default(""),
  facultyReviewer: z.string().trim().max(160).default(""),
});

const sourceGovernanceSchema = z.object({
  organizingClinicalQuestion: z.string().trim().max(1000).default(""),
  coverageComplete: z.boolean().default(false),
});

const taxonomyFieldsSchema = z.object({
  concept: z.string().trim().max(240).default(""),
  nclexClientNeed: z.string().trim().max(240).default(""),
  bodySystem: z.string().trim().max(240).default(""),
  priorityFramework: z.string().trim().max(240).default(""),
  bloomLevels: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  qsenDomains: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  aacnCompetencies: z.array(z.string().trim().min(1).max(240)).max(24).default([]),
  ncjmmFunctions: z.array(z.string().trim().min(1).max(120)).max(6).default([]),
});

const learningOutcomeSchema = z.object({
  objectiveId: z.string().trim().regex(/^LO-[0-9]{2,3}$/),
  statement: z.string().trim().min(1).max(1000),
  bloomLevel: z.string().trim().min(1).max(120),
  assessmentMethod: z.string().trim().min(1).max(500),
});

const accessibilitySchema = z.object({
  readingOrderChecked: z.boolean().default(false),
  contrastChecked: z.boolean().default(false),
  meaningNotColorOnly: z.boolean().default(false),
  transcriptAvailable: z.boolean().default(false),
});

const slideTraceSchema = z.object({
  slideId: z.string().trim().min(1).max(120),
  objectiveIds: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  accessibility: accessibilitySchema,
});

export const governanceEditableSchema = z.object({
  lessonId: z.string().trim().min(1).max(160),
  administrative: administrativeSchema,
  sourceGovernance: sourceGovernanceSchema,
  taxonomy: taxonomyFieldsSchema,
  learningOutcomes: z.array(learningOutcomeSchema).max(40).default([]),
  slideTraceability: z.array(slideTraceSchema).max(200).default([]),
});

const approvalStampSchema = z.object({
  gate: governanceGateSchema,
  decision: z.enum(["approved", "revoked"]),
  note: z.string().trim().min(3).max(2000),
  actorId: z.string().nullable().default(null),
  actorLabel: z.string().trim().max(160).default("Admin reviewer"),
  decidedAt: z.string().datetime(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export const governanceRecordSchema = governanceEditableSchema.extend({
  contractVersion: z.literal(1),
  revision: z.number().int().min(0),
  taxonomyStatus: z.enum(["draft", "locked"]),
  approvals: z.array(approvalStampSchema).default([]),
  updatedAt: z.string().datetime(),
});

export const governanceUpdateSchema = governanceEditableSchema.extend({
  expectedRevision: z.number().int().min(0),
}).strict();

export const governanceApprovalRequestSchema = z.object({
  expectedRevision: z.number().int().min(0),
  gate: governanceGateSchema,
  decision: z.enum(["approved", "revoked"]),
  note: z.string().trim().min(3).max(2000),
}).strict();

export type GovernanceGate = z.infer<typeof governanceGateSchema>;
export type GovernanceEditable = z.infer<typeof governanceEditableSchema>;
export type GovernanceRecordV1 = z.infer<typeof governanceRecordSchema>;

export type GovernanceEvaluationContext = {
  sourceStatuses: string[];
  slideIds: string[];
  citedSlideIds: string[];
  unknownSourceReferenceIds: string[];
  failedQaCount: number;
  mediaReady: boolean;
  playbackPassed: boolean;
  facultyPilotApproved: boolean;
  facultyReleaseApproved: boolean;
  facultyReviewFingerprint?: string | null;
  releaseReviewFingerprint?: string | null;
};

export type GovernanceBlocker = {
  stage: "intake_complete" | "faculty_review" | "production_ready" | "release_ready";
  code: string;
  location: string;
  message: string;
};

export type GovernanceEvaluation = {
  fingerprint: string;
  stages: Array<{
    key: GovernanceBlocker["stage"];
    status: "pass" | "blocked";
    blockerCount: number;
  }>;
  blockers: GovernanceBlocker[];
  metrics: Record<string, number | boolean>;
  currentApprovals: Partial<Record<GovernanceGate, boolean>>;
};

const STAGE_ORDER: GovernanceBlocker["stage"][] = [
  "intake_complete",
  "faculty_review",
  "production_ready",
  "release_ready",
];

export const GOVERNANCE_GATE_ORDER: GovernanceGate[] = [
  "taxonomy",
  "objectives",
  "outline",
  "script",
  "accessibility",
];

export function defaultGovernanceRecord(packageId: string, slideIds: string[] = []): GovernanceRecordV1 {
  return {
    contractVersion: 1,
    revision: 0,
    lessonId: `LESSON-${packageId}`,
    administrative: {
      courseId: "",
      courseName: "",
      programLevel: "",
      contentOwner: "",
      facultyReviewer: "",
    },
    sourceGovernance: {
      organizingClinicalQuestion: "",
      coverageComplete: false,
    },
    taxonomy: {
      concept: "",
      nclexClientNeed: "",
      bodySystem: "",
      priorityFramework: "",
      bloomLevels: [],
      qsenDomains: [],
      aacnCompetencies: [],
      ncjmmFunctions: [],
    },
    learningOutcomes: [],
    slideTraceability: slideIds.map((slideId) => ({
      slideId,
      objectiveIds: [],
      accessibility: {
        readingOrderChecked: false,
        contrastChecked: false,
        meaningNotColorOnly: false,
        transcriptAvailable: false,
      },
    })),
    taxonomyStatus: "draft",
    approvals: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function currentApprovalMap(record: GovernanceRecordV1, fingerprints: string | Record<GovernanceGate, string>) {
  const current: Partial<Record<GovernanceGate, boolean>> = {};
  for (const gate of GOVERNANCE_GATE_ORDER) {
    const latest = record.approvals.find((approval) => approval.gate === gate);
    const expected = typeof fingerprints === "string" ? fingerprints : fingerprints[gate];
    current[gate] = latest?.decision === "approved" && latest.fingerprint === expected;
  }
  return current;
}

export function invalidateApprovals(
  approvals: GovernanceRecordV1["approvals"],
  changedAreas: GovernanceGate[],
) {
  if (changedAreas.length === 0) return approvals;
  const earliest = Math.min(...changedAreas.map((gate) => GOVERNANCE_GATE_ORDER.indexOf(gate)));
  const invalidated = new Set(GOVERNANCE_GATE_ORDER.slice(earliest));
  return approvals.filter((approval) => !invalidated.has(approval.gate));
}

export function evaluateGovernance(
  record: GovernanceRecordV1,
  fingerprint: string,
  context: GovernanceEvaluationContext,
  approvalFingerprints: Record<GovernanceGate, string> | string = fingerprint,
): GovernanceEvaluation {
  const blockers: GovernanceBlocker[] = [];
  const add = (stage: GovernanceBlocker["stage"], code: string, location: string, message: string) => {
    blockers.push({ stage, code, location, message });
  };
  const requiredAdmin = Object.entries(record.administrative);
  for (const [key, value] of requiredAdmin) {
    if (!value.trim()) add("intake_complete", "required_value", `administrative.${key}`, "Required administrative value is missing.");
  }
  if (!record.sourceGovernance.organizingClinicalQuestion.trim()) {
    add("intake_complete", "clinical_question", "sourceGovernance.organizingClinicalQuestion", "Organizing clinical question is required.");
  }
  if (!record.sourceGovernance.coverageComplete) {
    add("intake_complete", "source_coverage", "sourceGovernance.coverageComplete", "Source coverage is not confirmed complete.");
  }
  if (context.sourceStatuses.length === 0 || context.sourceStatuses.some((status) => status !== "approved")) {
    add("intake_complete", "source_approval", "sources", "Every registered source must be approved.");
  }
  if (context.unknownSourceReferenceIds.length > 0) {
    add("faculty_review", "unknown_source", "citations.sourceId", `Unknown source IDs: ${context.unknownSourceReferenceIds.join(", ")}.`);
  }

  const taxonomyValues: Array<[string, string | string[]]> = Object.entries(record.taxonomy) as Array<[string, string | string[]]>;
  for (const [key, value] of taxonomyValues) {
    if ((typeof value === "string" && !value.trim()) || (Array.isArray(value) && value.length === 0)) {
      add("faculty_review", "taxonomy", `taxonomy.${key}`, "Taxonomy value is required.");
    }
  }
  if (record.learningOutcomes.length === 0) {
    add("faculty_review", "learning_outcomes", "learningOutcomes", "At least one learning outcome is required.");
  }
  const objectiveIds = record.learningOutcomes.map((outcome) => outcome.objectiveId);
  if (new Set(objectiveIds).size !== objectiveIds.length) {
    add("faculty_review", "duplicate_id", "learningOutcomes", "Learning outcome IDs must be unique.");
  }
  const traces = new Map(record.slideTraceability.map((trace) => [trace.slideId, trace]));
  if (traces.size !== record.slideTraceability.length) {
    add("faculty_review", "duplicate_id", "slideTraceability", "Slide traceability IDs must be unique.");
  }
  const unknownSlideIds = record.slideTraceability.map((trace) => trace.slideId).filter((slideId) => !context.slideIds.includes(slideId));
  if (unknownSlideIds.length > 0) {
    add("faculty_review", "unknown_slide", "slideTraceability", `Unknown slide IDs: ${unknownSlideIds.join(", ")}.`);
  }
  for (const slideId of context.slideIds) {
    const trace = traces.get(slideId);
    if (!trace) {
      add("faculty_review", "missing_trace", `slideTraceability.${slideId}`, "Slide has no governance trace.");
      continue;
    }
    if (trace.objectiveIds.length === 0) add("faculty_review", "missing_objective_mapping", `slideTraceability.${slideId}.objectiveIds`, "Slide must map to at least one learning outcome.");
    if (new Set(trace.objectiveIds).size !== trace.objectiveIds.length) add("faculty_review", "duplicate_id", `slideTraceability.${slideId}.objectiveIds`, "Slide objective mappings must be unique.");
    const unknown = trace.objectiveIds.filter((id) => !objectiveIds.includes(id));
    if (unknown.length > 0) add("faculty_review", "unknown_objective", `slideTraceability.${slideId}.objectiveIds`, `Unknown objective IDs: ${unknown.join(", ")}.`);
    if (!context.citedSlideIds.includes(slideId)) add("faculty_review", "citation", `slides.${slideId}`, "Slide has no source citation.");
  }

  const currentApprovals = currentApprovalMap(record, approvalFingerprints);
  for (const gate of GOVERNANCE_GATE_ORDER) {
    if (!currentApprovals[gate]) add("production_ready", "approval", `approvals.${gate}`, `${gate} approval is missing, revoked, or stale.`);
  }
  if (record.taxonomyStatus !== "locked") add("production_ready", "taxonomy_lock", "taxonomyStatus", "Taxonomy is not locked.");
  for (const trace of record.slideTraceability) {
    for (const [key, passed] of Object.entries(trace.accessibility)) {
      if (!passed) add("production_ready", "accessibility", `slideTraceability.${trace.slideId}.accessibility.${key}`, "Accessibility check has not passed.");
    }
  }
  if (!context.facultyPilotApproved || context.facultyReviewFingerprint !== fingerprint) {
    add("production_ready", "faculty_review", "reviews.faculty", "A current faculty approval is required.");
  }

  if (!context.facultyReleaseApproved || context.releaseReviewFingerprint !== fingerprint) {
    add("release_ready", "licensed_rn_release", "reviews.release", "A current licensed-RN release approval is required.");
  }
  if (context.failedQaCount > 0) add("release_ready", "qa", "qaResults", "Failing QA results remain.");
  if (!context.mediaReady) add("release_ready", "media", "artifacts", "Required media artifacts are not ready.");
  if (!context.playbackPassed) add("release_ready", "playback", "artifacts.playback", "Playback evidence has not passed.");

  const stages = STAGE_ORDER.map((stage, index) => {
    const applicable = new Set(STAGE_ORDER.slice(0, index + 1));
    const blockerCount = blockers.filter((blocker) => applicable.has(blocker.stage)).length;
    return { key: stage, status: blockerCount === 0 ? "pass" as const : "blocked" as const, blockerCount };
  });
  return {
    fingerprint,
    stages,
    blockers,
    metrics: {
      sourceCount: context.sourceStatuses.length,
      slideCount: context.slideIds.length,
      citedSlideCount: context.citedSlideIds.length,
      objectiveCount: record.learningOutcomes.length,
      failedQaCount: context.failedQaCount,
      mediaReady: context.mediaReady,
      playbackPassed: context.playbackPassed,
    },
    currentApprovals,
  };
}
