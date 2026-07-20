import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/admin-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, CircleDashed, Clipboard, ClipboardCheck, Download, ExternalLink, FileText, Package, Play, Search, Sparkles, Video } from "lucide-react";

type TopicPlacement = {
  contentKind: string;
  currentLocation: string;
  belongsIn: string;
  reviewSurface: string;
  nextBuildSurface: string;
  productionQueue: string;
  studentVisible: boolean;
};

type TopicProductionRow = {
  id: string;
  sourceType: "lesson_package" | "content_block" | "topic_candidate";
  topic: string;
  title: string;
  status: "ready" | "needs_mapping" | "needs_assets";
  packageStatus: string;
  concept: string;
  nursingSubject: string;
  weakTopic?: string;
  nclexCategory?: string;
  cjmStep?: string;
  sourceEvidence?: string;
  chunkCount?: number;
  childBlockIds?: string[];
  placement?: TopicPlacement;
  review?: {
    decision: ReviewDecision;
    reviewerNotes: string;
    reviewedAt: string | null;
    reviewedBy: string;
  };
  shorts?: {
    hook: string;
    scriptDraft: string;
    cta: string;
  };
  nextBuildApproved?: boolean;
  assets: Record<string, boolean>;
  missingLabels: string[];
  counts: {
    slides: number;
    studyGuideSlides: number;
    quizItems: number;
    citations: number;
    artifacts: number;
  };
  nextAction: string;
  updatedAt?: string;
};

type ReviewDecision = "unreviewed" | "approve_mapping" | "needs_edit" | "build_lesson" | "needs_visuals" | "needs_quiz" | "hold";
type DraftReviewDecision = "unreviewed" | "approve_polish" | "needs_fix" | "hold";
type PhaseThreeDecision = "unreviewed" | "approve_polish_pass" | "approve_short_planning" | "needs_fix" | "hold_spend";
type StudentLaunchDecision = "unreviewed" | "approve_student_preview" | "needs_fix" | "hold_release";
type MediaWorkOrderDecision = "unreviewed" | "approve_single_topic_scaffold" | "needs_revision" | "hold_spend";
type MediaScaffoldReviewDecision = "unreviewed" | "approve_ai_draft_checkpoint" | "needs_revision" | "hold_spend";
type MediaTextDraftReviewDecision = "unreviewed" | "approve_package_assembly_checkpoint" | "needs_revision" | "hold_spend";
type PackageReviewBlueprintDecision = "unreviewed" | "approve_review_package_build" | "needs_revision" | "hold_spend";
type PreviewReviewOutcome = "ready_for_release" | "needs_fix" | "hold_release";
type PublicReleaseDecision = "approve_public_release" | "needs_fix" | "hold_release";

type PhaseOneTopic = {
  key: string;
  subject: string;
  reason: string;
  found: boolean;
  sourceType: TopicProductionRow["sourceType"] | "";
  rowId: string;
  topic: string;
  title: string;
  concept: string;
  nursingSubject: string;
  status: TopicProductionRow["status"] | "missing_source";
  reviewDecision: ReviewDecision;
  nextBuildApproved: boolean;
  recommendedDecision: ReviewDecision;
  nextAction: string;
};

type DriveProjectAsset = {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  subject: string;
  concept: string;
  assetKeys: string[];
  belongsIn: string;
  nextAction: string;
  matchedToCurrentRows?: boolean;
};

type DriveProjectInventory = {
  id: string;
  title: string;
  url: string;
  sourceType: string;
  status: string;
  note: string;
  costPolicy: string;
  assetCount: number;
  matchedAssetCount: number;
  assets: DriveProjectAsset[];
};

type AirtableTrackerField = {
  name: string;
  type: string;
  required: boolean;
  source: string;
  notes: string;
};

type AirtableTrackerContract = {
  baseName: string;
  tableName: string;
  version: string;
  primaryField: string;
  importMode: string;
  costPolicy: string;
  requiredCsvHeaders: string[];
  fields: AirtableTrackerField[];
  recommendedViews: Array<{
    name: string;
    filter: string;
  }>;
};

type TopicProductionPayload = {
  rows: TopicProductionRow[];
  summary: {
    totalTopics: number;
    ready: number;
    needsMapping: number;
    needsAssets: number;
    packageRows: number;
    contentBlockRows: number;
    candidateRows?: number;
    requiredAssets: Record<string, string>;
  };
  driveProject?: DriveProjectInventory;
  airtableTracker?: AirtableTrackerContract;
  phaseOneCheckpoint?: {
    phase: string;
    label: string;
    budgetDollars: string;
    tokenRule: string;
    costPolicy: string;
    totalCount: number;
    foundCount: number;
    queuedCount: number;
    status: "ready" | "review_needed" | "missing_sources";
    topics: PhaseOneTopic[];
  };
  generatedAt: string;
};

type ReviewMutationInput = {
  row: TopicProductionRow;
  decision: ReviewDecision;
  reviewerNotes?: string;
};

type BuildPacketAsset = {
  assetKey: string;
  asset: string;
  status: "ready" | "needed";
  belongsIn: string;
  brief: string;
};

type TemplateDraft = {
  slideOutline: Array<{
    title: string;
    purpose: string;
    retrievalPrompt: string;
  }>;
  guidedNotesOutline: string[];
  practicePreview: {
    stem: string;
    correctAnswer: string;
    rationale: string;
  };
  reviewChecklist: string[];
};

type PacketReadiness = {
  readyForTemplateDraft: boolean;
  passedCount: number;
  totalCount: number;
  checks: Array<{
    key: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
};

type DraftPackageSummary = {
  packageId: string;
  title: string;
  status: string;
  slideCount: number;
  itemCount: number;
  citationCount: number;
  qaStatus?: string;
  failCount?: number;
  warnCount?: number;
  reviewChecklist?: Array<{
    key: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
  reviewPassedCount?: number;
  reviewTotalCount?: number;
  draftReview?: {
    decision: DraftReviewDecision;
    reviewerNotes?: string;
    reviewedAt?: string | null;
    reviewedBy?: string;
  };
  phaseThreeDecision?: {
    decision: PhaseThreeDecision;
    reviewerNotes?: string;
    reviewedAt?: string | null;
    reviewedBy?: string;
  };
  studentLaunchDecision?: {
    decision: StudentLaunchDecision;
    reviewerNotes?: string;
    reviewedAt?: string | null;
    reviewedBy?: string;
  };
  nextSpendApproved?: boolean;
  nextSpendRecommendation?: string;
  updatedAt?: string;
};

type CoverageContract = {
  readyCount: number;
  totalCount: number;
  studentReady: boolean;
  rows: Array<{
    key: string;
    label: string;
    status: "ready" | "draft" | "placeholder" | "needed";
    belongsIn: string;
    studentSurface: string;
    adminSurface: string;
    proof: string;
    nextAction: string;
  }>;
};

type TopicProductionBuildPacket = {
  buildOrder: number;
  topic: string;
  concept: string;
  nursingSubject: string;
  weakTopic?: string;
  nclexCategory?: string;
  cjmStep?: string;
  sourceType: string;
  sourceId: string;
  sourceTruth?: {
    sourceId: string;
    title: string;
    sourceType?: string;
    subject?: string;
    approvalStatus?: string;
    ingestionStatus?: string;
  } | null;
  sourceEvidence: string;
  reviewDecision: ReviewDecision;
  reviewerNotes: string;
  chunkCount: number;
  lessonBuilderInput: {
    slideTarget: number;
    minimumQuizItems: number;
    guidedNotesRequired: boolean;
    citationsRequired: boolean;
  };
  assetPlan: BuildPacketAsset[];
  driveProjectAssets?: DriveProjectAsset[];
  coverageContract?: CoverageContract;
  templateDraft?: TemplateDraft;
  draftPackage?: DraftPackageSummary | null;
  readiness?: PacketReadiness;
  shortsStarter: {
    hook: string;
    scriptDraft: string;
    cta: string;
  };
  humanReviewGate: string[];
  costGuardrail: string;
};

type BuildPacketsPayload = {
  generatedAt: string;
  queue: string;
  count: number;
  packets: TopicProductionBuildPacket[];
};

type DraftQualityReviewRecord = {
  "Review Stage": string;
  "Spend Window": string;
  "Topic": string;
  "Concept": string;
  "Nursing Subject": string;
  "Weak Topic": string;
  "NCLEX Category": string;
  "CJM Step": string;
  "Template Draft Package ID": string;
  "Lesson Builder Review URL": string;
  "Slide Count": number;
  "Quiz Count": number;
  "Citation Count": number;
  "QA Status": string;
  "QA Failures": number;
  "QA Warnings": number;
  "Checklist Summary": string;
  "Checklist Detail": string;
  "Slide Outline": string;
  "Guided Notes Outline": string;
  "Practice Stem": string;
  "Correct Answer": string;
  "Rationale": string;
  "Drive Project Assets": string;
  "Drive Asset Links": string;
  "Coverage Summary": string;
  "Human Review Questions": string;
  "Decision Options": string;
  "Cost Guardrail": string;
};

type DraftReviewPackPayload = {
  generatedAt: string;
  queue: string;
  costGuardrail: string;
  count: number;
  records: DraftQualityReviewRecord[];
};

type PhaseThreeHandoffRecord = Record<string, string | number | boolean>;

type HumanReviewPackRecord = Record<string, string | number | boolean>;

type HumanReviewPackPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  costGuardrail: string;
  count: number;
  reviewOptions: ReviewDecision[];
  records: HumanReviewPackRecord[];
};

type MediaPilotPackRecord = Record<string, string | number | boolean>;

type MediaPilotPackPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  nextAllowedSpend: string;
  costGuardrail: string;
  count: number;
  records: MediaPilotPackRecord[];
};

type MediaWorkOrderRecord = Record<string, string | number | boolean>;

type MediaWorkOrdersPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  costBasis: string;
  estimatedTokensPerTopic: number;
  estimatedDollarsPerTopic: number;
  approvalStatus: string;
  costGuardrail: string;
  count: number;
  records: MediaWorkOrderRecord[];
};

type MediaScaffoldPackRecord = Record<string, string | number | boolean>;

type MediaScaffoldPackPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  prerequisite: string;
  costGuardrail: string;
  count: number;
  records: MediaScaffoldPackRecord[];
};

type MediaTextDraftPackRecord = Record<string, string | number | boolean>;

type MediaTextDraftPackPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  prerequisite: string;
  costGuardrail: string;
  count: number;
  records: MediaTextDraftPackRecord[];
};

type PackageAssemblyPackRecord = Record<string, string | number | boolean>;

type PackageAssemblyPackPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  prerequisite: string;
  costGuardrail: string;
  count: number;
  records: PackageAssemblyPackRecord[];
};

type PackageReviewBlueprintRecord = Record<string, string | number | boolean>;

type PackageReviewBlueprintPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  prerequisite: string;
  costGuardrail: string;
  count: number;
  records: PackageReviewBlueprintRecord[];
};

type ReviewPackageBuildRecord = Record<string, string | number | boolean>;

type ReviewPackageBuildPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  prerequisite: string;
  costGuardrail: string;
  count: number;
  records: ReviewPackageBuildRecord[];
};

type PhaseThreeHandoffPayload = {
  generatedAt: string;
  queue: string;
  budgetWindow: string;
  nextAllowedSpend: string;
  costGuardrail: string;
  count: number;
  records: PhaseThreeHandoffRecord[];
};

type StudentLaunchReadinessRecord = Record<string, string | number | boolean>;

type StudentLaunchReadinessPayload = {
  generatedAt: string;
  queue: string;
  costGuardrail: string;
  count: number;
  records: StudentLaunchReadinessRecord[];
};

type PublishReadinessRecord = Record<string, string | number | boolean>;

type PublishReadinessPayload = {
  generatedAt: string;
  queue: string;
  costGuardrail: string;
  count: number;
  records: PublishReadinessRecord[];
};

const statusLabels: Record<string, string> = {
  ready: "Ready",
  needs_mapping: "Needs mapping",
  needs_assets: "Needs assets",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  needs_mapping: "destructive",
  needs_assets: "secondary",
};

const reviewLabels: Record<ReviewDecision, string> = {
  unreviewed: "Unreviewed",
  approve_mapping: "Approve mapping",
  needs_edit: "Needs edit",
  build_lesson: "Build lesson",
  needs_visuals: "Needs visuals",
  needs_quiz: "Needs quiz",
  hold: "Hold",
};

const draftReviewLabels: Record<DraftReviewDecision, string> = {
  unreviewed: "Awaiting review",
  approve_polish: "Approved for polish",
  needs_fix: "Needs fixes",
  hold: "Hold",
};

const phaseThreeDecisionLabels: Record<PhaseThreeDecision, string> = {
  unreviewed: "No Phase 3 decision",
  approve_polish_pass: "Approve polish pass",
  approve_short_planning: "Approve short planning",
  needs_fix: "Needs fixes",
  hold_spend: "Hold spend",
};

const phaseThreeDecisionVariants: Record<PhaseThreeDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_polish_pass: "default",
  approve_short_planning: "default",
  needs_fix: "destructive",
  hold_spend: "secondary",
};

const studentLaunchDecisionLabels: Record<StudentLaunchDecision, string> = {
  unreviewed: "Awaiting student gate",
  approve_student_preview: "Preview approved",
  needs_fix: "Needs fixes",
  hold_release: "Hold release",
};

const studentLaunchDecisionVariants: Record<StudentLaunchDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_student_preview: "default",
  needs_fix: "destructive",
  hold_release: "secondary",
};

const previewReviewOutcomeLabels: Record<PreviewReviewOutcome, string> = {
  ready_for_release: "Preview ready",
  needs_fix: "Preview needs fixes",
  hold_release: "Hold after preview",
};

const publicReleaseDecisionLabels: Record<PublicReleaseDecision, string> = {
  approve_public_release: "Release approved",
  needs_fix: "Release needs fixes",
  hold_release: "Release held",
};

const mediaWorkOrderDecisionLabels: Record<MediaWorkOrderDecision, string> = {
  unreviewed: "Awaiting budget decision",
  approve_single_topic_scaffold: "Approve one-topic scaffold",
  needs_revision: "Needs revision",
  hold_spend: "Hold spend",
};

const mediaWorkOrderDecisionVariants: Record<MediaWorkOrderDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_single_topic_scaffold: "default",
  needs_revision: "destructive",
  hold_spend: "secondary",
};

const mediaScaffoldReviewLabels: Record<MediaScaffoldReviewDecision, string> = {
  unreviewed: "Creator review required",
  approve_ai_draft_checkpoint: "Approve AI text draft",
  needs_revision: "Needs scaffold revision",
  hold_spend: "Hold spend",
};

const mediaScaffoldReviewVariants: Record<MediaScaffoldReviewDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_ai_draft_checkpoint: "default",
  needs_revision: "destructive",
  hold_spend: "secondary",
};

const mediaTextDraftReviewLabels: Record<MediaTextDraftReviewDecision, string> = {
  unreviewed: "Creator review required",
  approve_package_assembly_checkpoint: "Approve package assembly",
  needs_revision: "Needs text revision",
  hold_spend: "Hold spend",
};

const mediaTextDraftReviewVariants: Record<MediaTextDraftReviewDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_package_assembly_checkpoint: "default",
  needs_revision: "destructive",
  hold_spend: "secondary",
};

const packageReviewBlueprintLabels: Record<PackageReviewBlueprintDecision, string> = {
  unreviewed: "Creator review required",
  approve_review_package_build: "Approve review-package build",
  needs_revision: "Needs blueprint revision",
  hold_spend: "Hold spend",
};

const packageReviewBlueprintVariants: Record<PackageReviewBlueprintDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_review_package_build: "default",
  needs_revision: "destructive",
  hold_spend: "secondary",
};

const draftReviewVariants: Record<DraftReviewDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_polish: "default",
  needs_fix: "destructive",
  hold: "secondary",
};

const reviewVariants: Record<ReviewDecision, "default" | "secondary" | "destructive" | "outline"> = {
  unreviewed: "outline",
  approve_mapping: "default",
  needs_edit: "secondary",
  build_lesson: "default",
  needs_visuals: "secondary",
  needs_quiz: "secondary",
  hold: "destructive",
};

const budgetStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  complete: "default",
  ready: "secondary",
  next: "secondary",
  review_needed: "secondary",
  missing_sources: "destructive",
  hold: "outline",
};

const coverageStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  draft: "secondary",
  placeholder: "outline",
  needed: "destructive",
};

function rowKey(row: Pick<TopicProductionRow, "sourceType" | "id">) {
  return `${row.sourceType}:${row.id}`;
}

function readinessIcon(ready: boolean) {
  return ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />;
}

function isFirstBuildCandidate(row: TopicProductionRow) {
  const label = `${row.topic || ""} ${row.title || ""}`.toLowerCase();
  return label.includes("pediatrics asthma") || label.includes("maternal-newborn lesson guide");
}

function lessonBuilderHandoffUrl(packet: TopicProductionBuildPacket) {
  const params = new URLSearchParams({
    from: "topic-production",
    topic: packet.topic || "",
    title: `${packet.topic || "NurseStudy"} Lesson Package`,
    concept: packet.concept || "",
    subject: packet.nursingSubject || "",
    weakTopic: packet.weakTopic || "",
    nclexCategory: packet.nclexCategory || "",
    cjmStep: packet.cjmStep || "",
    slideCount: String(packet.lessonBuilderInput?.slideTarget || 8),
    audience: "Prelicensure RN",
    generationMode: "template",
    sourceType: packet.sourceType || "",
    sourceId: packet.sourceId || "",
  });
  return `/admin/lesson-builder?${params.toString()}`;
}

function lessonBuilderDraftReviewUrl(packet: TopicProductionBuildPacket) {
  if (!packet.draftPackage?.packageId) return lessonBuilderHandoffUrl(packet);
  const params = new URLSearchParams({
    tab: "review",
    packageId: packet.draftPackage.packageId,
  });
  return `/admin/lesson-builder?${params.toString()}`;
}

function templateDraftRequestBody(packet: TopicProductionBuildPacket) {
  return {
    title: `${packet.topic} Template Draft`,
    topic: packet.topic,
    audience: "Prelicensure RN",
    sourceIds: [packet.sourceTruth?.sourceId],
    settings: {
      slideCount: Number(packet.lessonBuilderInput?.slideTarget || 8),
      difficulty: "application",
      includeGuidedNotes: true,
      generationMode: "template",
      topicProductionPacket: {
        sourceId: packet.sourceId,
        buildOrder: packet.buildOrder,
        phase: "phase_2_template_draft",
      },
    },
  };
}

function assetBadge(label: string, ready: boolean) {
  return (
    <Badge key={label} variant={ready ? "default" : "outline"} className="gap-1">
      {readinessIcon(ready)}
      {label}
    </Badge>
  );
}

export default function TopicProductionMatrix() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("unreviewed");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [draftResults, setDraftResults] = useState<Record<string, { packageId: string; title: string }>>({});
  const { data, isLoading, error } = useQuery<TopicProductionPayload>({
    queryKey: ["/api/admin/topic-production-matrix"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load topic production matrix");
      return response.json();
    },
  });
  const { data: buildPacketData, isLoading: isBuildPacketsLoading } = useQuery<BuildPacketsPayload>({
    queryKey: ["/api/admin/topic-production-matrix/build-packets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/build-packets?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load build packets");
      return response.json();
    },
  });
  const { data: draftReviewPackData, isLoading: isDraftReviewPackLoading } = useQuery<DraftReviewPackPayload>({
    queryKey: ["/api/admin/topic-production-matrix/draft-review-pack"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/draft-review-pack?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load draft review pack");
      return response.json();
    },
  });
  const { data: humanReviewPackData, isLoading: isHumanReviewPackLoading } = useQuery<HumanReviewPackPayload>({
    queryKey: ["/api/admin/topic-production-matrix/human-review-pack"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/human-review-pack?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load human review pack");
      return response.json();
    },
  });
  const { data: mediaPilotPackData, isLoading: isMediaPilotPackLoading } = useQuery<MediaPilotPackPayload>({
    queryKey: ["/api/admin/topic-production-matrix/media-pilot-pack"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/media-pilot-pack?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load media pilot pack");
      return response.json();
    },
  });
  const { data: mediaWorkOrdersData, isLoading: isMediaWorkOrdersLoading } = useQuery<MediaWorkOrdersPayload>({
    queryKey: ["/api/admin/topic-production-matrix/media-work-orders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/media-work-orders?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load media work orders");
      return response.json();
    },
  });
  const { data: mediaScaffoldPackData, isLoading: isMediaScaffoldPackLoading } = useQuery<MediaScaffoldPackPayload>({
    queryKey: ["/api/admin/topic-production-matrix/media-scaffold-pack"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/media-scaffold-pack?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load media scaffold pack");
      return response.json();
    },
  });
  const { data: mediaTextDraftPackData, isLoading: isMediaTextDraftPackLoading } = useQuery<MediaTextDraftPackPayload>({
    queryKey: ["/api/admin/topic-production-matrix/media-text-draft-pack"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/media-text-draft-pack?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load media text draft pack");
      return response.json();
    },
  });
  const { data: packageAssemblyPackData, isLoading: isPackageAssemblyPackLoading } = useQuery<PackageAssemblyPackPayload>({
    queryKey: ["/api/admin/topic-production-matrix/package-assembly-pack"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/package-assembly-pack?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load package assembly pack");
      return response.json();
    },
  });
  const { data: packageReviewBlueprintData, isLoading: isPackageReviewBlueprintLoading } = useQuery<PackageReviewBlueprintPayload>({
    queryKey: ["/api/admin/topic-production-matrix/package-review-blueprint"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/package-review-blueprint?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load package review blueprint");
      return response.json();
    },
  });
  const { data: reviewPackageBuildData, isLoading: isReviewPackageBuildLoading } = useQuery<ReviewPackageBuildPayload>({
    queryKey: ["/api/admin/topic-production-matrix/review-package-builds"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/review-package-builds?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load review package builds");
      return response.json();
    },
  });
  const { data: phaseThreeHandoffData, isLoading: isPhaseThreeHandoffLoading } = useQuery<PhaseThreeHandoffPayload>({
    queryKey: ["/api/admin/topic-production-matrix/phase-3-handoff"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/phase-3-handoff?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load Phase 3 handoff");
      return response.json();
    },
  });
  const { data: studentLaunchReadinessData, isLoading: isStudentLaunchReadinessLoading } = useQuery<StudentLaunchReadinessPayload>({
    queryKey: ["/api/admin/topic-production-matrix/student-launch-readiness"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/student-launch-readiness?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load student launch readiness");
      return response.json();
    },
  });
  const { data: publishReadinessData, isLoading: isPublishReadinessLoading } = useQuery<PublishReadinessPayload>({
    queryKey: ["/api/admin/topic-production-matrix/publish-readiness"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/topic-production-matrix/publish-readiness?format=json", undefined, { retries: 1 });
      if (!response.ok) throw new Error("Failed to load publish readiness");
      return response.json();
    },
  });

  const rows = data?.rows || [];
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [rowKey(row), row])), [rows]);
  const phaseOneCheckpoint = data?.phaseOneCheckpoint;
  const driveProject = data?.driveProject;
  const airtableTracker = data?.airtableTracker;
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const subjectMatches = (row: TopicProductionRow) => {
      const subject = String(row.nursingSubject || "").toLowerCase();
      if (subjectFilter === "all") return true;
      if (subjectFilter === "pediatrics") return subject.includes("pediatric");
      if (subjectFilter === "maternal_newborn") return subject.includes("maternal") || subject.includes("newborn");
      if (subjectFilter === "curriculum") return subject.includes("curriculum");
      if (subjectFilter === "builder_operations") return subject.includes("builder");
      if (subjectFilter === "unknown") return !subject.trim();
      return true;
    };
    const assetMatches = (row: TopicProductionRow) => {
      if (assetFilter === "all") return true;
      if (assetFilter === "needs_deck") return !row.assets.slideDeck;
      if (assetFilter === "needs_study_guide") return !row.assets.studyGuide;
      if (assetFilter === "needs_visuals") return !row.assets.visuals;
      if (assetFilter === "needs_quiz") return !row.assets.quiz;
      if (assetFilter === "needs_citations") return !row.assets.citations;
      if (assetFilter === "approved_queue") return Boolean(row.nextBuildApproved);
      return true;
    };
    return rows
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter(subjectMatches)
      .filter(assetMatches)
      .filter((row) => {
        if (!needle) return true;
        return [
          row.topic,
          row.title,
          row.concept,
          row.nursingSubject,
          row.weakTopic,
          row.nclexCategory,
          row.cjmStep,
          row.sourceEvidence,
        ].filter(Boolean).join(" ").toLowerCase().includes(needle);
      });
  }, [assetFilter, query, rows, statusFilter, subjectFilter]);

  const selectedRow = useMemo(() => {
    if (!filteredRows.length) return null;
    return filteredRows.find((row) => rowKey(row) === selectedRowKey) || filteredRows[0];
  }, [filteredRows, selectedRowKey]);

  const firstBuildCandidates = useMemo(
    () => rows.filter(isFirstBuildCandidate),
    [rows]
  );
  const queuedFirstBuildCount = phaseOneCheckpoint?.queuedCount ?? firstBuildCandidates.filter((row) => row.nextBuildApproved).length;
  const budgetMilestones = useMemo(() => {
    const packetCount = buildPacketData?.count || 0;
    return [
      {
        phase: "Phase 1",
        label: "Map and queue",
        budget: "$100-$250",
        status: phaseOneCheckpoint?.status === "ready" || packetCount >= 2 ? "ready" : phaseOneCheckpoint?.status || (queuedFirstBuildCount > 0 ? "ready" : "next"),
        proof: `${queuedFirstBuildCount}/${phaseOneCheckpoint?.totalCount ?? 2} starter topics queued; ${phaseOneCheckpoint?.foundCount ?? firstBuildCandidates.length} found; ${packetCount} packet(s) available.`,
        next: "Review the two packets before generating any lesson content.",
      },
      {
        phase: "Phase 2",
        label: "Two-topic template drafts",
        budget: "$250-$500",
        status: packetCount >= 2 ? "ready" : "hold",
        proof: "Use Lesson Builder template mode only; no broad AI/video batch.",
        next: "Generate, QA, and inspect one Pediatrics and one Maternal-Newborn package.",
      },
      {
        phase: "Phase 3",
        label: "Airtable and shorts workflow",
        budget: "$250-$500",
        status: "hold",
        proof: "Wait until the two lesson drafts pass review.",
        next: "Then rebuild Airtable as a production tracker, not as the core app.",
      },
      {
        phase: "Phase 4",
        label: "Batch scale",
        budget: "$500 cap",
        status: "hold",
        proof: "No 5-10 topic batches until the two-topic slice is accepted.",
        next: "Scale only after quality and student UX are proven.",
      },
    ];
  }, [buildPacketData?.count, firstBuildCandidates.length, phaseOneCheckpoint, queuedFirstBuildCount]);
  const nextSpendPackets = useMemo(
    () => (buildPacketData?.packets || []).filter((packet) => packet.draftPackage?.nextSpendApproved),
    [buildPacketData?.packets]
  );
  const draftReviewRecords = draftReviewPackData?.records || [];
  const humanReviewRecords = humanReviewPackData?.records || [];
  const mediaPilotRecords = mediaPilotPackData?.records || [];
  const mediaWorkOrderRecords = mediaWorkOrdersData?.records || [];
  const mediaScaffoldRecords = mediaScaffoldPackData?.records || [];
  const mediaTextDraftRecords = mediaTextDraftPackData?.records || [];
  const packageAssemblyRecords = packageAssemblyPackData?.records || [];
  const packageReviewBlueprintRecords = packageReviewBlueprintData?.records || [];
  const reviewPackageBuildRecords = reviewPackageBuildData?.records || [];
  const phaseThreeHandoffRecords = phaseThreeHandoffData?.records || [];
  const studentLaunchReadinessRecords = studentLaunchReadinessData?.records || [];
  const publishReadinessRecords = publishReadinessData?.records || [];
  const phaseTwoReadyPackets = useMemo(
    () => (buildPacketData?.packets || [])
      .filter((packet) => packet.readiness?.readyForTemplateDraft && packet.sourceTruth?.sourceId && !packet.draftPackage?.packageId)
      .slice(0, 2),
    [buildPacketData?.packets]
  );
  const phaseTwoReviewPackets = useMemo(
    () => (buildPacketData?.packets || [])
      .filter((packet) => {
        const draft = packet.draftPackage;
        return Boolean(
          draft?.packageId
          && draft.reviewTotalCount
          && draft.reviewPassedCount === draft.reviewTotalCount
          && !draft.nextSpendApproved
        );
      })
      .slice(0, 2),
    [buildPacketData?.packets]
  );

  useEffect(() => {
    if (!selectedRow) return;
    setSelectedRowKey(rowKey(selectedRow));
    setReviewDecision(selectedRow.review?.decision || "unreviewed");
    setReviewerNotes(selectedRow.review?.reviewerNotes || "");
  }, [selectedRow?.id, selectedRow?.sourceType]);

  const reviewMutation = useMutation({
    mutationFn: async ({ row, decision, reviewerNotes: notes = "" }: ReviewMutationInput) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/${row.sourceType}/${encodeURIComponent(row.id)}/review`,
        { decision, reviewerNotes: notes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save review decision");
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/human-review-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-pilot-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-work-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-scaffold-pack"] });
      toast({
        title: "Review saved",
        description: "This topic is now placed in the right next-build queue.",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Review was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const phaseOneQueueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/admin/topic-production-matrix/phase-one/queue",
        { reviewerNotes: "Phase 1 starter topics queued for the $100-$250 checkpoint." },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to queue Phase 1 starter topics");
      return response.json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      toast({
        title: "Phase 1 queued",
        description: `${result.queuedCount || 0} starter topic(s) are ready for packet review.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Phase 1 was not queued",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const draftReviewMutation = useMutation({
    mutationFn: async ({ packet, decision }: { packet: TopicProductionBuildPacket; decision: DraftReviewDecision }) => {
      const packageId = packet.draftPackage?.packageId;
      if (!packageId) throw new Error("No draft package is available for review.");
      const reviewerNotes = decision === "approve_polish"
        ? "Approved for the next $100-$250 polish checkpoint after passing draft review checks."
        : decision === "needs_fix"
          ? "Needs fixes before spending on polish, visuals, audio, or video."
          : decision === "hold"
            ? "Hold this draft until the topic is re-prioritized."
            : "";
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/review`,
        { decision, reviewerNotes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save draft review decision");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/draft-review-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/phase-3-handoff"] });
      toast({
        title: "Draft review saved",
        description: `${variables.packet.topic} is marked ${draftReviewLabels[variables.decision].toLowerCase()}.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Draft review was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const phaseThreeDecisionMutation = useMutation({
    mutationFn: async ({ packageId, decision }: { packageId: string; decision: PhaseThreeDecision }) => {
      if (!packageId) throw new Error("No draft package is available for Phase 3 decision.");
      const reviewerNotes = decision === "approve_polish_pass"
        ? "Approved for one small polish pass only; no batch generation or video/audio spend."
        : decision === "approve_short_planning"
          ? "Approved for one short planning pass only; script/visual review remains required before production."
          : decision === "needs_fix"
            ? "Needs content fixes before additional spend."
            : decision === "hold_spend"
              ? "Hold spend until the draft is re-prioritized."
              : "";
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/phase-3-decision`,
        { decision, reviewerNotes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save Phase 3 decision");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/phase-3-handoff"] });
      toast({
        title: "Phase 3 decision saved",
        description: `${phaseThreeDecisionLabels[variables.decision]} is now recorded for this draft.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Phase 3 decision was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const studentLaunchDecisionMutation = useMutation({
    mutationFn: async ({ packageId, decision }: { packageId: string; decision: StudentLaunchDecision }) => {
      if (!packageId) throw new Error("No draft package is available for student launch decision.");
      const reviewerNotes = decision === "approve_student_preview"
        ? "Approved for controlled student preview review only; do not broadly publish until final review passes."
        : decision === "needs_fix"
          ? "Needs content or UX fixes before student preview."
          : decision === "hold_release"
            ? "Hold student release until this topic is re-prioritized."
            : "";
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/student-launch-decision`,
        { decision, reviewerNotes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save student launch decision");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/student-launch-readiness"] });
      toast({
        title: "Student launch decision saved",
        description: `${studentLaunchDecisionLabels[variables.decision]} is recorded for this draft.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Student launch decision was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const mediaWorkOrderReviewMutation = useMutation({
    mutationFn: async ({ workOrderId, decision, reviewerNotes: notes }: { workOrderId: string; decision: MediaWorkOrderDecision; reviewerNotes: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/media-work-orders/${encodeURIComponent(workOrderId)}/review`,
        { decision, reviewerNotes: notes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save media work order review");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-work-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-scaffold-pack"] });
      toast({
        title: "Budget gate saved",
        description: `${mediaWorkOrderDecisionLabels[variables.decision]} was recorded without running media generation.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Budget gate was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const mediaScaffoldReviewMutation = useMutation({
    mutationFn: async ({ workOrderId, decision, reviewerNotes: notes }: { workOrderId: string; decision: MediaScaffoldReviewDecision; reviewerNotes: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/media-scaffold-pack/${encodeURIComponent(workOrderId)}/review`,
        { decision, reviewerNotes: notes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save scaffold review");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-scaffold-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-text-draft-pack"] });
      toast({
        title: "Scaffold review saved",
        description: `${mediaScaffoldReviewLabels[variables.decision]} was recorded without running generation.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Scaffold review was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const mediaTextDraftReviewMutation = useMutation({
    mutationFn: async ({ workOrderId, decision, reviewerNotes: notes }: { workOrderId: string; decision: MediaTextDraftReviewDecision; reviewerNotes: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/media-text-draft-pack/${encodeURIComponent(workOrderId)}/review`,
        { decision, reviewerNotes: notes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save text draft review");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/media-text-draft-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/package-assembly-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/package-review-blueprint"] });
      toast({
        title: "Text draft review saved",
        description: `${mediaTextDraftReviewLabels[variables.decision]} was recorded without building media.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Text draft review was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const packageReviewBlueprintMutation = useMutation({
    mutationFn: async ({ workOrderId, decision, reviewerNotes: notes }: { workOrderId: string; decision: PackageReviewBlueprintDecision; reviewerNotes: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/package-review-blueprint/${encodeURIComponent(workOrderId)}/review`,
        { decision, reviewerNotes: notes },
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to save review blueprint decision");
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/package-review-blueprint"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/review-package-builds"] });
      toast({
        title: "Blueprint review saved",
        description: `${packageReviewBlueprintLabels[variables.decision]} was recorded without building or publishing a package.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Blueprint review was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const reviewPackagePromotionMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(workOrderId)}/promote`,
        {},
        { retries: 1 }
      );
      if (!response.ok) throw new Error("Failed to promote review package draft");
      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/review-package-builds"] });
      toast({
        title: data?.created ? "Unpublished draft created" : "Draft already exists",
        description: `${data?.package?.title || "Review package"} is in Lesson Builder as a creator-review draft.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Review package was not promoted",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const reviewPackageCreatorQaMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(workOrderId)}/creator-qa`,
        {},
        { retries: 1 }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.prerequisite || error?.error || "Failed to run creator QA gate");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/review-package-builds"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/publish-readiness"] });
      const gate = data?.creatorQaGate;
      toast({
        title: gate?.status === "ready_for_controlled_preview" ? "Creator QA passed" : "Creator QA needs revision",
        description: gate?.nextAllowedAction || "The unpublished draft was checked without publishing or starting media work.",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Creator QA was not run",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const reviewPackageControlledPreviewMutation = useMutation({
    mutationFn: async ({ workOrderId, decision }: { workOrderId: string; decision: StudentLaunchDecision }) => {
      const reviewerNotes = decision === "approve_student_preview"
        ? "Creator approved controlled preview for this QA-ready unpublished draft. Public publish, TTS, video, paid visuals, and batch generation remain blocked."
        : decision === "needs_fix"
          ? "Creator requested fixes before controlled preview. Public publish and media remain blocked."
          : "Creator held controlled preview/release. Public publish and media remain blocked.";
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(workOrderId)}/controlled-preview-decision`,
        { decision, reviewerNotes },
        { retries: 1 }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.blockers?.join(" | ") || error?.prerequisite || error?.error || "Failed to save controlled preview decision");
      }
      return response.json();
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/review-package-builds"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/student-launch-readiness"] });
      const previewUrl = data?.controlledPreviewDecision?.studentPreviewUrl;
      toast({
        title: studentLaunchDecisionLabels[variables.decision] || "Preview decision saved",
        description: previewUrl
          ? `Controlled preview is ready at ${absolutePreviewUrl(previewUrl)}. Public publish remains blocked.`
          : "Controlled preview decision was recorded. Public publish remains blocked.",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Preview decision was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const reviewPackagePreviewReviewMutation = useMutation({
    mutationFn: async ({ workOrderId, outcome }: { workOrderId: string; outcome: PreviewReviewOutcome }) => {
      const reviewerNotes = outcome === "ready_for_release"
        ? "Controlled preview review marked ready for release review. Public publish still requires a later explicit checkpoint."
        : outcome === "needs_fix"
          ? "Controlled preview review requested fixes before any release decision."
          : "Controlled preview review is on hold. Public publish and media remain blocked.";
      const response = await apiRequest(
        "PATCH",
        `/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(workOrderId)}/preview-review`,
        { outcome, reviewerNotes },
        { retries: 1 }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.blockers?.join(" | ") || error?.prerequisite || error?.error || "Failed to save preview review outcome");
      }
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/review-package-builds"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/student-launch-readiness"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/publish-readiness"] });
      toast({
        title: previewReviewOutcomeLabels[variables.outcome],
        description: "Controlled preview review was recorded. Public publish remains blocked until an explicit publish checkpoint.",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Preview review was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const publicReleaseDecisionMutation = useMutation({
    mutationFn: async ({ workOrderId, packageId, decision }: { workOrderId?: string; packageId: string; decision: PublicReleaseDecision }) => {
      const reviewerNotes = decision === "approve_public_release"
        ? "Creator approved this single lesson for the final public publish panel. Media, video, audio, paid visuals, and batch production remain separate approvals."
        : decision === "needs_fix"
          ? "Creator requested release fixes before exposing the public publish endpoint."
          : "Creator held public release. Do not publish or start media work.";
      const endpoint = workOrderId
        ? `/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(workOrderId)}/public-release-decision`
        : `/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/public-release-decision`;
      const response = await apiRequest(
        "PATCH",
        endpoint,
        { decision, reviewerNotes },
        { retries: 1 }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.blockers?.join(" | ") || error?.prerequisite || error?.error || "Failed to save public release decision");
      }
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/publish-readiness"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/student-launch-readiness"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/review-package-builds"] });
      toast({
        title: publicReleaseDecisionLabels[variables.decision],
        description: "Release decision was recorded. Media and batch production remain separate approvals.",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Release decision was not saved",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const phaseTwoApprovalMutation = useMutation({
    mutationFn: async () => {
      const packets = phaseTwoReviewPackets;
      if (packets.length < 2) throw new Error("Phase 2 needs two 5/5 template drafts before approving the next spend checkpoint.");

      const approved = [];
      for (const packet of packets) {
        const packageId = packet.draftPackage?.packageId;
        if (!packageId) throw new Error(`No draft package is available for ${packet.topic}.`);
        const response = await apiRequest(
          "PATCH",
          `/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/review`,
          {
            decision: "approve_polish",
            reviewerNotes: "Approved for the next $100-$250 checkpoint after both Phase 2 template drafts passed review checks.",
          },
          { retries: 1 }
        );
        if (!response.ok) throw new Error(`Could not approve ${packet.topic} for the next spend checkpoint.`);
        approved.push(await response.json());
      }
      return approved;
    },
    onSuccess: async (approved) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/draft-review-pack"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/phase-3-handoff"] });
      toast({
        title: "Phase 2 accepted",
        description: `${approved.length} draft(s) moved into the next spend queue.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Phase 2 was not accepted",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const templateDraftMutation = useMutation({
    mutationFn: async (packet: TopicProductionBuildPacket) => {
      if (!packet.readiness?.readyForTemplateDraft) throw new Error("Packet is not ready for Phase 2 template draft.");
      if (!packet.sourceTruth?.sourceId) throw new Error("Packet has no matched source truth.");
      const response = await apiRequest("POST", "/api/admin/lesson-builder/generate", templateDraftRequestBody(packet), { timeout: 120000, retries: 0 });
      if (!response.ok) throw new Error("Template draft could not be created");
      return response.json();
    },
    onSuccess: async (data, packet) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/draft-review-pack"] });
      setDraftResults((current) => ({
        ...current,
        [packet.sourceId]: { packageId: data.package?.id, title: data.package?.title || `${packet.topic} Template Draft` },
      }));
      toast({
        title: "Template draft created",
        description: `${packet.topic} is ready for QA review. No AI generation mode was used.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Template draft was not created",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const phaseTwoDraftMutation = useMutation({
    mutationFn: async () => {
      const packets = phaseTwoReadyPackets;
      if (packets.length < 2) throw new Error("Phase 2 needs two ready queued packets before creating drafts.");

      const created = [];
      for (const packet of packets) {
        const response = await apiRequest("POST", "/api/admin/lesson-builder/generate", templateDraftRequestBody(packet), { timeout: 120000, retries: 0 });
        if (!response.ok) throw new Error(`Template draft could not be created for ${packet.topic}`);
        const result = await response.json();
        created.push({ packet, result });
      }
      return created;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/build-packets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/topic-production-matrix/draft-review-pack"] });
      setDraftResults((current) => {
        const next = { ...current };
        for (const item of created) {
          next[item.packet.sourceId] = {
            packageId: item.result.package?.id,
            title: item.result.package?.title || `${item.packet.topic} Template Draft`,
          };
        }
        return next;
      });
      toast({
        title: "Phase 2 drafts created",
        description: `${created.length} template draft(s) are ready for QA review. No AI generation mode was used.`,
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Phase 2 drafts were not created",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const saveSelectedReview = () => {
    if (!selectedRow) {
      toast({
        title: "Choose a topic",
        description: "Select a topic before saving review.",
        variant: "destructive",
      });
      return;
    }
    reviewMutation.mutate({ row: selectedRow, decision: reviewDecision, reviewerNotes });
  };

  const queueFirstBuildCandidate = (row: TopicProductionRow) => {
    setSelectedRowKey(rowKey(row));
    reviewMutation.mutate({
      row,
      decision: "build_lesson",
      reviewerNotes: "First low-cost vertical-slice build candidate.",
    });
  };

  const downloadExport = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/export?format=${format}`;
  };

  const downloadNextBuildExport = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/next-build-export?format=${format}`;
  };

  const downloadBuildPackets = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/build-packets?format=${format}`;
  };

  const downloadDraftReviewPack = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/draft-review-pack?format=${format}`;
  };

  const downloadHumanReviewPack = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/human-review-pack?format=${format}`;
  };

  const downloadMediaPilotPack = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/media-pilot-pack?format=${format}`;
  };

  const downloadMediaWorkOrders = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/media-work-orders?format=${format}`;
  };

  const downloadMediaScaffoldPack = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/media-scaffold-pack?format=${format}`;
  };

  const downloadMediaTextDraftPack = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/media-text-draft-pack?format=${format}`;
  };

  const downloadPackageAssemblyPack = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/package-assembly-pack?format=${format}`;
  };

  const downloadPackageReviewBlueprint = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/package-review-blueprint?format=${format}`;
  };

  const downloadReviewPackageBuilds = (format: "csv" | "json" | "zip") => {
    window.location.href = `/api/admin/topic-production-matrix/review-package-builds?format=${format}`;
  };

  const downloadNextSpendQueue = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/next-spend-queue?format=${format}`;
  };

  const downloadShortsWorkflow = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/shorts-workflow?format=${format}`;
  };

  const downloadPhaseThreeHandoff = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/phase-3-handoff?format=${format}`;
  };

  const downloadStudentLaunchReadiness = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/student-launch-readiness?format=${format}`;
  };

  const downloadPublishReadiness = (format: "csv" | "json") => {
    window.location.href = `/api/admin/topic-production-matrix/publish-readiness?format=${format}`;
  };

  const absolutePreviewUrl = (previewUrl: string) => {
    if (!previewUrl) return "";
    try {
      return new URL(previewUrl, window.location.origin).toString();
    } catch {
      return previewUrl;
    }
  };

  const copyStudentPreviewUrl = async (previewUrl: string, topic: string) => {
    const reviewUrl = absolutePreviewUrl(previewUrl);
    if (!reviewUrl) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reviewUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = reviewUrl;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast({
        title: "Preview link copied",
        description: `${topic} is ready for controlled student review.`,
      });
    } catch {
      toast({
        title: "Could not copy link",
        description: reviewUrl,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Topic Production Matrix</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Every topic needs concept mapping, a nursing subject, a lesson slide deck, guided study support, visuals, and at least one quiz item before it is production-ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadExport("csv")}>
              <Download className="mr-2 h-4 w-4" />
              Airtable CSV
            </Button>
            <Button variant="outline" onClick={() => downloadExport("json")}>
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" onClick={() => downloadNextBuildExport("csv")}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Approved Queue CSV
            </Button>
            <Button variant="outline" onClick={() => downloadNextBuildExport("json")}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Queue JSON
            </Button>
            <Link href="/admin/content-mapper">
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Map Content
              </Button>
            </Link>
            <Link href="/admin/lesson-builder">
              <Button>
                <Package className="mr-2 h-4 w-4" />
                Build Lesson
              </Button>
            </Link>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total topics</CardDescription>
              <CardTitle className="text-3xl">{data?.summary.totalTopics ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ready</CardDescription>
              <CardTitle className="text-3xl">{data?.summary.ready ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Need mapping</CardDescription>
              <CardTitle className="text-3xl">{data?.summary.needsMapping ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Need assets</CardDescription>
              <CardTitle className="text-3xl">{data?.summary.needsAssets ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Candidate backlog</CardDescription>
              <CardTitle className="text-3xl">{data?.summary.candidateRows ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Cost Milestone Guardrails</CardTitle>
                <CardDescription>
                  Keep each checkpoint reviewable before moving into higher-cost generation, video, or batch production.
                </CardDescription>
              </div>
              <Badge variant="outline">2,500 tokens = $100</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-4">
            {budgetMilestones.map((milestone) => (
              <div key={milestone.phase} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">{milestone.phase}</Badge>
                  <Badge variant={budgetStatusVariants[milestone.status] || "outline"}>{milestone.status}</Badge>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-950">{milestone.label}</div>
                <div className="mt-1 text-sm font-medium text-slate-700">{milestone.budget}</div>
                <p className="mt-2 text-xs text-slate-600">{milestone.proof}</p>
                <p className="mt-2 text-xs font-medium text-slate-700">{milestone.next}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {driveProject ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Drive Project Asset Map</CardTitle>
                  <CardDescription>
                    Source-backed inventory from {driveProject.title}; review placement before any AI, audio, video, or batch spend.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{driveProject.matchedAssetCount}/{driveProject.assetCount} matched</Badge>
                  <a href={driveProject.url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">Open Drive Project</Button>
                  </a>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium text-slate-950">{driveProject.costPolicy}</div>
                <div className="mt-1">{driveProject.note}</div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {driveProject.assets.map((asset) => (
                  <div key={asset.id} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{asset.title}</div>
                        <div className="mt-1 text-xs text-slate-600">{asset.subject} / {asset.concept}</div>
                      </div>
                      <Badge variant={asset.matchedToCurrentRows ? "default" : "outline"}>
                        {asset.matchedToCurrentRows ? "matched" : "reference"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {asset.assetKeys.map((key) => (
                        <Badge key={`${asset.id}-${key}`} variant="outline">
                          {data?.summary.requiredAssets[key] || key}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-700">{asset.belongsIn}</p>
                    <p className="mt-2 text-xs font-medium text-slate-800">{asset.nextAction}</p>
                    <a className="mt-3 inline-flex text-xs font-medium text-blue-700 hover:underline" href={asset.url} target="_blank" rel="noreferrer">
                      Open source
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {phaseOneCheckpoint ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{phaseOneCheckpoint.label}</CardTitle>
                  <CardDescription>
                    Review one Maternal-Newborn topic and one Pediatrics topic before scaling production.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={budgetStatusVariants[phaseOneCheckpoint.status] || "outline"}>
                    {phaseOneCheckpoint.queuedCount}/{phaseOneCheckpoint.totalCount} queued
                  </Badge>
                  <Badge variant="outline">{phaseOneCheckpoint.budgetDollars}</Badge>
                  <Button
                    size="sm"
                    onClick={() => phaseOneQueueMutation.mutate()}
                    disabled={
                      phaseOneQueueMutation.isPending
                      || phaseOneCheckpoint.status === "ready"
                      || phaseOneCheckpoint.foundCount < phaseOneCheckpoint.totalCount
                    }
                  >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    {phaseOneQueueMutation.isPending ? "Queueing..." : phaseOneCheckpoint.status === "ready" ? "Queued" : "Queue Phase 1"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium text-slate-950">{phaseOneCheckpoint.tokenRule}</div>
                <div className="mt-1">{phaseOneCheckpoint.costPolicy}</div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {phaseOneCheckpoint.topics.map((topic) => (
                  <div key={topic.key} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{topic.subject}</Badge>
                      <Badge variant={topic.nextBuildApproved ? "default" : topic.found ? "secondary" : "destructive"}>
                        {topic.nextBuildApproved ? "queued" : topic.found ? "review needed" : "missing"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-950">
                      {topic.topic || topic.title || "Source not mapped yet"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{topic.reason}</div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700">
                      <div><span className="font-medium">Concept:</span> {topic.concept || "Needs confirmation"}</div>
                      <div><span className="font-medium">Review decision:</span> {topic.reviewDecision}</div>
                      <div><span className="font-medium">Recommended:</span> {topic.recommendedDecision}</div>
                      <div><span className="font-medium">Next:</span> {topic.nextAction}</div>
                    </div>
                    {topic.found ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setSelectedRowKey(`${topic.sourceType}:${topic.rowId}`);
                          setSubjectFilter(topic.key === "pediatrics" ? "pediatrics" : "maternal_newborn");
                        }}
                      >
                        Review row
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 3 Human Review Pack</CardTitle>
                <CardDescription>
                  Five-topic placement review before AI polish, visuals, narration, video, or batch expansion.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={humanReviewRecords.length ? "default" : "outline"}>
                  {isHumanReviewPackLoading ? "Loading" : `${humanReviewRecords.length} review row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadHumanReviewPack("csv")} disabled={!humanReviewRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Review CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadHumanReviewPack("json")} disabled={!humanReviewRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">{humanReviewPackData?.budgetWindow || "$100-$500"} checkpoint</div>
              <div className="mt-1">
                {humanReviewPackData?.costGuardrail || "Review placement first. Do not spend on AI polish, visuals, audio, or video until decisions are recorded."}
              </div>
            </div>
            {humanReviewRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No human review rows are available yet.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {humanReviewRecords.map((record) => {
                  const topic = String(record.Topic || "Untitled topic");
                  const sourceType = String(record["Source Type"] || "");
                  const sourceId = String(record["Source ID"] || "");
                  const reviewRow = rowsByKey.get(`${sourceType}:${sourceId}`);
                  const currentDecision = String(record["Review Decision"] || "unreviewed") as ReviewDecision;
                  const assetPlacement = String(record["Asset Placement"] || "").split(" | ").filter(Boolean);
                  const driveAssets = String(record["Drive Project Assets"] || "").split(" | ").filter(Boolean).slice(0, 4);
                  const saveHumanReview = (decision: ReviewDecision, notes: string) => {
                    if (!reviewRow) return;
                    reviewMutation.mutate({ row: reviewRow, decision, reviewerNotes: notes });
                  };
                  return (
                    <div key={`human-review-${sourceType}-${sourceId}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{topic}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge variant="outline">{String(record["Review Stage"] || "review")}</Badge>
                          <Badge variant={reviewVariants[currentDecision] || "outline"}>
                            {reviewLabels[currentDecision] || currentDecision}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                        <div className="rounded-md bg-slate-50 p-2">Weak topic: {String(record["Weak Topic"] || "needs review")}</div>
                        <div className="rounded-md bg-slate-50 p-2">CJM: {String(record["CJM Step"] || "needs review")}</div>
                        <div className="rounded-md bg-slate-50 p-2">NCLEX: {String(record["NCLEX Category"] || "needs review")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Student: {String(record["Student Visible"] || "no")}</div>
                      </div>
                      <div className="mt-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-950">Belongs in</div>
                        <p className="mt-1">{String(record["Belongs In"] || "Review queue")}</p>
                        <div className="mt-2 font-medium text-slate-950">Review question</div>
                        <p className="mt-1">{String(record["Immediate Review Question"] || "Review this topic placement.")}</p>
                        <div className="mt-2 font-medium text-slate-950">Next owner action</div>
                        <p className="mt-1">{String(record["Next Owner Action"] || "Choose approve, revise, or hold.")}</p>
                      </div>
                      {assetPlacement.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {assetPlacement.map((item) => (
                            <Badge key={`${topic}-${item}`} variant={item.includes("ready") ? "default" : "outline"}>{item}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {driveAssets.length ? (
                        <div className="mt-3 text-xs text-slate-700">
                          <div className="font-medium text-slate-950">Source/deck references</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {driveAssets.map((asset) => (
                              <Badge key={`${topic}-${asset}`} variant="outline">{asset}</Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                        {String(record["Cost Guardrail"] || "Hold spend until review.")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveHumanReview("approve_mapping", "Phase 3 human review approves the topic placement. Media spend remains held until a separate production decision.")}
                          disabled={reviewMutation.isPending || !reviewRow}
                        >
                          Approve placement
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveHumanReview("needs_edit", "Phase 3 human review requests taxonomy, source, quiz, or student-value revision before production.")}
                          disabled={reviewMutation.isPending || !reviewRow}
                        >
                          Revise
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveHumanReview("hold", "Phase 3 human review holds this topic and blocks media spend.")}
                          disabled={reviewMutation.isPending || !reviewRow}
                        >
                          Hold
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 9 Review Package Build</CardTitle>
                <CardDescription>
                  Builds the approved blueprint into review files you can inspect before publishing or media production.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={reviewPackageBuildRecords.length ? "default" : "outline"}>
                  {isReviewPackageBuildLoading ? "Loading" : `${reviewPackageBuildRecords.length} review bundle(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadReviewPackageBuilds("csv")} disabled={!reviewPackageBuildRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Build CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadReviewPackageBuilds("json")} disabled={!reviewPackageBuildRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadReviewPackageBuilds("zip")} disabled={!reviewPackageBuildRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  ZIP
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">{reviewPackageBuildData?.budgetWindow || "$100-$500 deterministic review-package checkpoint"}</div>
              <div className="mt-1">{reviewPackageBuildData?.prerequisite || "Approve the Phase 8 build gate before files appear."}</div>
              <div className="mt-1 text-xs font-medium text-amber-900">
                {reviewPackageBuildData?.costGuardrail || "No public publish, TTS, rendered video, paid visuals, or batch generation."}
              </div>
            </div>
            {reviewPackageBuildRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No review package is built yet. Use the Phase 8 buttons above to approve one deterministic unpublished build.
              </div>
            ) : (
              <div className="grid gap-3">
                {reviewPackageBuildRecords.map((record) => {
                  const workOrderId = String(record["Approved Work Order ID"] || "");
                  const files = String(record["Bundle Files"] || "").split(" | ").filter(Boolean);
                  const manifest = String(record["Review Manifest"] || "");
                  return (
                    <div key={String(record["Approved Work Order ID"] || record.Topic)} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{String(record["Lesson Package Title"] || record.Topic || "Untitled review package")}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")} / {String(record["NCLEX Category"] || "")}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Badge variant="default">{String(record["Build Stage"] || "phase 9")}</Badge>
                          <Badge variant="secondary">{String(record["Publish Status"] || "not_published")}</Badge>
                          <Badge variant="outline">{String(record["Media Status"] || "not_started")}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-3">
                        {files.map((fileName) => (
                          <div key={fileName} className="rounded-md bg-slate-50 p-2 font-medium text-slate-900">
                            {fileName}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-2">
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="font-medium text-slate-950">Manifest preview</div>
                          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">{manifest.slice(0, 700)}</pre>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="font-medium text-slate-950">Next allowed action</div>
                          <p className="mt-1">{String(record["Next Allowed Action"] || "Review files before continuing.")}</p>
                          <div className="mt-2 font-medium text-slate-950">Cost guardrail</div>
                          <p className="mt-1 text-amber-900">{String(record["Cost Guardrail"] || "No public publish or media work approved.")}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackagePromotionMutation.mutate(workOrderId)}
                          disabled={!workOrderId || reviewPackagePromotionMutation.isPending}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Promote unpublished draft
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackageCreatorQaMutation.mutate(workOrderId)}
                          disabled={!workOrderId || reviewPackageCreatorQaMutation.isPending}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Run creator QA
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackageControlledPreviewMutation.mutate({ workOrderId, decision: "approve_student_preview" })}
                          disabled={!workOrderId || reviewPackageControlledPreviewMutation.isPending}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Approve controlled preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackageControlledPreviewMutation.mutate({ workOrderId, decision: "needs_fix" })}
                          disabled={!workOrderId || reviewPackageControlledPreviewMutation.isPending}
                        >
                          Needs fixes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackageControlledPreviewMutation.mutate({ workOrderId, decision: "hold_release" })}
                          disabled={!workOrderId || reviewPackageControlledPreviewMutation.isPending}
                        >
                          Hold preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackagePreviewReviewMutation.mutate({ workOrderId, outcome: "ready_for_release" })}
                          disabled={!workOrderId || reviewPackagePreviewReviewMutation.isPending}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark preview ready
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackagePreviewReviewMutation.mutate({ workOrderId, outcome: "needs_fix" })}
                          disabled={!workOrderId || reviewPackagePreviewReviewMutation.isPending}
                        >
                          Preview needs fixes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewPackagePreviewReviewMutation.mutate({ workOrderId, outcome: "hold_release" })}
                          disabled={!workOrderId || reviewPackagePreviewReviewMutation.isPending}
                        >
                          Hold after preview
                        </Button>
                        <span className="text-xs font-medium text-slate-600">
                          Creates, checks, opens, and records controlled preview review only. Publish and media stay blocked.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 7 Review Blueprint</CardTitle>
                <CardDescription>
                  A learner-package blueprint for creator review before building, publishing, or spending on media.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={packageReviewBlueprintRecords.length ? "default" : "outline"}>
                  {isPackageReviewBlueprintLoading ? "Loading" : `${packageReviewBlueprintRecords.length} blueprint row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadPackageReviewBlueprint("csv")} disabled={!packageReviewBlueprintRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Blueprint CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPackageReviewBlueprint("json")} disabled={!packageReviewBlueprintRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">{packageReviewBlueprintData?.budgetWindow || "$100-$500 review-blueprint checkpoint"}</div>
              <div className="mt-1">{packageReviewBlueprintData?.prerequisite || "Approve package assembly before review blueprints appear."}</div>
              <div className="mt-1 text-xs font-medium text-amber-900">
                {packageReviewBlueprintData?.costGuardrail || "No package publish, TTS, rendered video, paid visuals, or batch generation."}
              </div>
            </div>
            {packageReviewBlueprintRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No review blueprint is ready yet. Approve one text draft for package assembly first.
              </div>
            ) : (
              <div className="grid gap-3">
                {packageReviewBlueprintRecords.map((record) => {
                  const workOrderId = String(record["Approved Work Order ID"] || "");
                  const blueprintDecision = String(record["Blueprint Review Decision"] || "unreviewed") as PackageReviewBlueprintDecision;
                  const buildApprovalStatus = String(record["Build Approval Status"] || "creator_review_required");
                  const saveBlueprintReview = (nextDecision: PackageReviewBlueprintDecision, notes: string) => {
                    if (!workOrderId) return;
                    packageReviewBlueprintMutation.mutate({ workOrderId, decision: nextDecision, reviewerNotes: notes });
                  };

                  return (
                  <div key={String(record["Approved Work Order ID"] || record.Topic)} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-950">{String(record["Lesson Package Title"] || record.Topic || "Untitled blueprint")}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")} / {String(record["NCLEX Category"] || "")}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge variant="default">{String(record["Blueprint Stage"] || "review blueprint")}</Badge>
                        <Badge variant={packageReviewBlueprintVariants[blueprintDecision] || "outline"}>
                          {packageReviewBlueprintLabels[blueprintDecision] || buildApprovalStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Learner outcome</div>
                      <p className="mt-1">{String(record["Learner Outcome"] || "Learner outcome pending.")}</p>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-2">
                      <div className="rounded-md bg-slate-50 p-2">Slides: {String(record["Slide Blueprint"] || "Slide blueprint pending.")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Guided notes: {String(record["Guided Notes Blueprint"] || "Guided notes blueprint pending.")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Practice: {String(record["Practice Blueprint"] || "Practice blueprint pending.")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Citations: {String(record["Citation Slot Blueprint"] || "Citation slots pending.")}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="font-medium text-slate-950">Visual placeholders</div>
                        <p className="mt-1">{String(record["Visual Placeholder Blueprint"] || "Use placeholders only.")}</p>
                        <div className="mt-2 font-medium text-slate-950">Export files</div>
                        <p className="mt-1">{String(record["Export File Blueprint"] || "Export blueprint pending.")}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="font-medium text-slate-950">Creator checklist</div>
                        <p className="mt-1">{String(record["Review Checklist"] || "Review checklist pending.")}</p>
                        <div className="mt-2 font-medium text-slate-950">Expert questions</div>
                        <p className="mt-1">{String(record["Human Expert Questions"] || "Expert questions pending.")}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Stop conditions</div>
                      <p className="mt-1">{String(record["Stop Conditions"] || "Stop if source, rationale, or student clarity is weak.")}</p>
                      <div className="mt-2 font-medium text-slate-950">Next allowed action</div>
                      <p className="mt-1">{String(record["Next Allowed Action"] || "Review before continuing.")}</p>
                    </div>
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                      {String(record["Cost Guardrail"] || "No package publish or media work approved.")}
                    </div>
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Phase 8 build approval gate</div>
                      <p className="mt-1">Status: {buildApprovalStatus}</p>
                      {record["Blueprint Review Notes"] ? (
                        <p className="mt-1 text-slate-600">Notes: {String(record["Blueprint Review Notes"])}</p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveBlueprintReview("approve_review_package_build", "Creator approved one deterministic unpublished review-package build only. Public publish, TTS, video, paid visuals, and batch generation remain blocked.")}
                        disabled={packageReviewBlueprintMutation.isPending || !workOrderId}
                      >
                        Approve review package build
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveBlueprintReview("needs_revision", "Creator requests blueprint revisions before any package build.")}
                        disabled={packageReviewBlueprintMutation.isPending || !workOrderId}
                      >
                        Revise blueprint
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveBlueprintReview("hold_spend", "Creator holds this blueprint and blocks package build, media production, and paid generation.")}
                        disabled={packageReviewBlueprintMutation.isPending || !workOrderId}
                      >
                        Hold spend
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 6 Package Assembly Pack</CardTitle>
                <CardDescription>
                  Shows where the approved text draft belongs before any publish, TTS, video, paid visual, or batch-production work.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={packageAssemblyRecords.length ? "default" : "outline"}>
                  {isPackageAssemblyPackLoading ? "Loading" : `${packageAssemblyRecords.length} assembly row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadPackageAssemblyPack("csv")} disabled={!packageAssemblyRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Assembly CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPackageAssemblyPack("json")} disabled={!packageAssemblyRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">{packageAssemblyPackData?.budgetWindow || "$100-$500 package assembly checkpoint"}</div>
              <div className="mt-1">{packageAssemblyPackData?.prerequisite || "Approve a Phase 5 text draft for package assembly before rows appear."}</div>
              <div className="mt-1 text-xs font-medium text-amber-900">
                {packageAssemblyPackData?.costGuardrail || "No TTS, rendered video, paid visuals, batch production, or public publish."}
              </div>
            </div>
            {packageAssemblyRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No package assembly is ready yet. Approve one text draft for package assembly to see the learner-package placement map.
              </div>
            ) : (
              <div className="grid gap-3">
                {packageAssemblyRecords.map((record) => (
                  <div key={String(record["Approved Work Order ID"] || record.Topic)} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-950">{String(record["Lesson Package Title"] || record.Topic || "Untitled package")}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")} / {String(record["CJM Step"] || "")}
                        </div>
                      </div>
                      <Badge variant="default">{String(record["Assembly Stage"] || "package assembly")}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-2">
                      <div className="rounded-md bg-slate-50 p-2">Slide deck: {String(record["Slide Assembly Plan"] || "No slide plan yet.")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Guided notes: {String(record["Guided Notes Assembly Plan"] || "No guided notes plan yet.")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Practice item: {String(record["Practice Item Assembly Plan"] || "No practice item plan yet.")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Citations: {String(record["Citation Plan"] || "No citation plan yet.")}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="font-medium text-slate-950">Learner surface</div>
                        <p className="mt-1">{String(record["Learner Surface Plan"] || "Hold until review.")}</p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="font-medium text-slate-950">Export and review</div>
                        <p className="mt-1">{String(record["Export Plan"] || "Export plan pending.")}</p>
                        <p className="mt-2">{String(record["Review Gate"] || "Creator review required.")}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Next allowed action</div>
                      <p className="mt-1">{String(record["Next Allowed Action"] || "Review before continuing.")}</p>
                    </div>
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                      {String(record["Cost Guardrail"] || "No media rendering or public publish approved.")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 5 Text Draft Pack</CardTitle>
                <CardDescription>
                  Reviewable slide copy, study-guide notes, quiz rationale, visual brief, and narration script for approved scaffold work.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={mediaTextDraftRecords.length ? "default" : "outline"}>
                  {isMediaTextDraftPackLoading ? "Loading" : `${mediaTextDraftRecords.length} draft row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadMediaTextDraftPack("csv")} disabled={!mediaTextDraftRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Draft CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMediaTextDraftPack("json")} disabled={!mediaTextDraftRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">{mediaTextDraftPackData?.budgetWindow || "$100-$500 text-draft checkpoint"}</div>
              <div className="mt-1">{mediaTextDraftPackData?.prerequisite || "Approve one scaffold for the AI text-draft checkpoint before rows appear."}</div>
              <div className="mt-1 text-xs font-medium text-amber-900">
                {mediaTextDraftPackData?.costGuardrail || "No TTS, rendered video, paid visuals, or batch generation."}
              </div>
            </div>
            {mediaTextDraftRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No text draft is ready yet. Approve a scaffold for the AI text-draft checkpoint first.
              </div>
            ) : (
              <div className="grid gap-3">
                {mediaTextDraftRecords.map((record) => {
                  const workOrderId = String(record["Approved Work Order ID"] || "");
                  const textDraftDecision = String(record["Text Draft Review Decision"] || "unreviewed") as MediaTextDraftReviewDecision;
                  const textDraftApprovalStatus = String(record["Text Draft Approval Status"] || "creator_review_required");
                  const saveTextDraftReview = (nextDecision: MediaTextDraftReviewDecision, notes: string) => {
                    if (!workOrderId) return;
                    mediaTextDraftReviewMutation.mutate({ workOrderId, decision: nextDecision, reviewerNotes: notes });
                  };

                  return (
                  <div key={String(record["Approved Work Order ID"] || record.Topic)} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-950">{String(record.Topic || "Untitled topic")}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")} / {String(record["CJM Step"] || "")}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge variant="default">{String(record["Draft Stage"] || "text draft")}</Badge>
                        <Badge variant={mediaTextDraftReviewVariants[textDraftDecision] || "outline"}>
                          {mediaTextDraftReviewLabels[textDraftDecision] || textDraftApprovalStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 lg:grid-cols-2">
                      <div className="rounded-md bg-slate-50 p-2">Slides: {String(record["Slide Deck Text Draft"] || "draft unavailable")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Study guide: {String(record["Study Guide Text Draft"] || "draft unavailable")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Quiz/rationale: {String(record["Quiz/Rationale Text Draft"] || "draft unavailable")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Narration: {String(record["Narration Script Draft"] || "draft unavailable")}</div>
                    </div>
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Visual brief</div>
                      <p className="mt-1">{String(record["Visual Brief Text"] || "Visual brief unavailable.")}</p>
                    </div>
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Creator review questions</div>
                      <p className="mt-1">{String(record["Creator Review Questions"] || "Review source evidence, student value, and next spend approval.")}</p>
                      <div className="mt-2 font-medium text-slate-950">Next checkpoint</div>
                      <p className="mt-1">{String(record["Next Allowed Action"] || "Review before continuing.")}</p>
                      {record["Text Draft Review Notes"] ? (
                        <p className="mt-1 text-slate-600">Notes: {String(record["Text Draft Review Notes"])}</p>
                      ) : null}
                    </div>
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                      {String(record["Cost Guardrail"] || "No media rendering approved.")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveTextDraftReview("approve_package_assembly_checkpoint", "Creator approved the text draft for lesson-package assembly only. TTS, video, paid visuals, and batch generation remain blocked.")}
                        disabled={mediaTextDraftReviewMutation.isPending || !workOrderId}
                      >
                        Approve package assembly
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveTextDraftReview("needs_revision", "Creator requests text revisions before lesson-package assembly.")}
                        disabled={mediaTextDraftReviewMutation.isPending || !workOrderId}
                      >
                        Revise text
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveTextDraftReview("hold_spend", "Creator holds this text draft and blocks package assembly, media production, and paid generation.")}
                        disabled={mediaTextDraftReviewMutation.isPending || !workOrderId}
                      >
                        Hold spend
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 4 Scaffold Pack</CardTitle>
                <CardDescription>
                  Deterministic slide, study-guide, visual, quiz, and narration outline for approved one-topic scaffold work.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={mediaScaffoldRecords.length ? "default" : "outline"}>
                  {isMediaScaffoldPackLoading ? "Loading" : `${mediaScaffoldRecords.length} scaffold row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadMediaScaffoldPack("csv")} disabled={!mediaScaffoldRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Scaffold CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMediaScaffoldPack("json")} disabled={!mediaScaffoldRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">{mediaScaffoldPackData?.budgetWindow || "$100-$500"} scaffold review</div>
              <div className="mt-1">{mediaScaffoldPackData?.prerequisite || "Approve one Phase 4 work order before scaffold rows appear."}</div>
              <div className="mt-1 text-xs font-medium text-amber-900">
                {mediaScaffoldPackData?.costGuardrail || "No AI generation, TTS, rendered video, or paid visual generation."}
              </div>
            </div>
            {mediaScaffoldRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No scaffold is ready yet. Approve one Phase 4 work order scaffold to create the deterministic outline.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {mediaScaffoldRecords.map((record) => {
                  const workOrderId = String(record["Approved Work Order ID"] || "");
                  const scaffoldDecision = String(record["Scaffold Review Decision"] || "unreviewed") as MediaScaffoldReviewDecision;
                  const scaffoldApprovalStatus = String(record["Scaffold Approval Status"] || "creator_review_required");
                  const saveScaffoldReview = (nextDecision: MediaScaffoldReviewDecision, notes: string) => {
                    if (!workOrderId) return;
                    mediaScaffoldReviewMutation.mutate({ workOrderId, decision: nextDecision, reviewerNotes: notes });
                  };

                  return (
                  <div key={String(record["Approved Work Order ID"] || record.Topic)} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-950">{String(record.Topic || "Untitled topic")}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge variant="default">{String(record["Scaffold Stage"] || "scaffold")}</Badge>
                        <Badge variant={mediaScaffoldReviewVariants[scaffoldDecision] || "outline"}>
                          {mediaScaffoldReviewLabels[scaffoldDecision] || scaffoldApprovalStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                      <div className="rounded-md bg-slate-50 p-2">Deck: {String(record["Slide Deck Scaffold"] || "outline unavailable")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Study guide: {String(record["Study Guide Scaffold"] || "outline unavailable")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Quiz: {String(record["Quiz Scaffold"] || "outline unavailable")}</div>
                      <div className="rounded-md bg-slate-50 p-2">Narration: {String(record["Narration Outline"] || "outline unavailable")}</div>
                    </div>
                    <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Visual storyboard</div>
                      <p className="mt-1">{String(record["Visual Storyboard"] || "Storyboard unavailable.")}</p>
                    </div>
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                      {String(record["Cost Guardrail"] || "No media rendering approved.")}
                    </div>
                    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-950">Creator checkpoint</div>
                      <div className="mt-1">{String(record["Next Allowed Action"] || "Review before continuing.")}</div>
                      {record["Scaffold Review Notes"] ? (
                        <div className="mt-1 text-slate-600">Notes: {String(record["Scaffold Review Notes"])}</div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveScaffoldReview("approve_ai_draft_checkpoint", "Creator approved this scaffold for the next AI text-draft checkpoint only. TTS, video, batch generation, and paid visuals remain blocked.")}
                        disabled={mediaScaffoldReviewMutation.isPending || !workOrderId}
                      >
                        Approve AI text draft
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveScaffoldReview("needs_revision", "Creator requests scaffold revisions before any AI text-draft checkpoint.")}
                        disabled={mediaScaffoldReviewMutation.isPending || !workOrderId}
                      >
                        Revise scaffold
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveScaffoldReview("hold_spend", "Creator holds this scaffold and blocks AI drafting, TTS, video, and paid visual generation.")}
                        disabled={mediaScaffoldReviewMutation.isPending || !workOrderId}
                      >
                        Hold spend
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 4 Budget Gate</CardTitle>
                <CardDescription>
                  Shows the one-topic dollar work order before any generation, audio, video, or visual spend; detailed media slots appear below.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={mediaWorkOrderRecords.length ? "default" : "outline"}>
                  {isMediaWorkOrdersLoading ? "Loading" : `${mediaWorkOrderRecords.length} work order(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadMediaWorkOrders("csv")} disabled={!mediaWorkOrderRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Cost CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMediaWorkOrders("json")} disabled={!mediaWorkOrderRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs font-medium uppercase text-slate-500">Planning rate</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{mediaWorkOrdersData?.costBasis || "2,500 tokens = $100"}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs font-medium uppercase text-slate-500">Per-topic estimate</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  {mediaWorkOrdersData ? `$${mediaWorkOrdersData.estimatedDollarsPerTopic}` : "$140"} / {mediaWorkOrdersData?.estimatedTokensPerTopic || 3500} tokens
                </div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-medium uppercase text-amber-700">Approval status</div>
                <div className="mt-1 text-lg font-semibold text-amber-950">
                  {mediaWorkOrdersData?.approvalStatus || "manual_approval_required"}
                </div>
              </div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {mediaWorkOrdersData?.costGuardrail || "Dollarized work order only. No AI generation, TTS, rendered video, paid visual generation, or batch production."}
            </div>
            {mediaWorkOrderRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No work order is ready yet. Approve one Phase 3 placement to create the first dollarized work order.
              </div>
            ) : (
              <div className="space-y-3">
                {mediaWorkOrderRecords.map((record) => {
                  const workOrderId = String(record["Work Order ID"] || "");
                  const decision = String(record["Work Order Review Decision"] || "unreviewed") as MediaWorkOrderDecision;
                  const saveWorkOrderReview = (nextDecision: MediaWorkOrderDecision, notes: string) => {
                    if (!workOrderId) return;
                    mediaWorkOrderReviewMutation.mutate({ workOrderId, decision: nextDecision, reviewerNotes: notes });
                  };
                  return (
                    <div key={workOrderId || String(record.Topic)} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{String(record.Topic || "Untitled topic")}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{String(record["Estimated Dollar Budget"] || "$140")}</Badge>
                          <Badge variant={mediaWorkOrderDecisionVariants[decision] || "outline"}>
                            {mediaWorkOrderDecisionLabels[decision] || decision}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div className="rounded-md bg-slate-50 p-2">Tokens: {String(record["Estimated Token Budget"] || "3500")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Status: {String(record["Approval Status"] || "manual_approval_required")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Reviewed: {String(record["Work Order Reviewed At"] || "not yet")}</div>
                      </div>
                      <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-950">Line items</div>
                        <p className="mt-1">{String(record["Production Line Items"] || "Line items unavailable.")}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                        <div className="rounded-md bg-slate-50 p-2">Deck: {String(record["Slide Deck Work"] || "planned")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Study guide: {String(record["Study Guide Work"] || "planned")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Quiz: {String(record["Quiz Work"] || "planned")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Narration: {String(record["Narration Work"] || "planned")}</div>
                      </div>
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                        {String(record["Cost Guardrail"] || "Manual approval required before spend.")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveWorkOrderReview("approve_single_topic_scaffold", "Approved for one-topic scaffold planning only. No media rendering, TTS, video, or batch generation is approved.")}
                          disabled={mediaWorkOrderReviewMutation.isPending || !workOrderId}
                        >
                          Approve scaffold
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveWorkOrderReview("needs_revision", "Revise work order scope, evidence, rationale, or learner value before approving spend.")}
                          disabled={mediaWorkOrderReviewMutation.isPending || !workOrderId}
                        >
                          Revise order
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveWorkOrderReview("hold_spend", "Hold Phase 4 spend for this work order.")}
                          disabled={mediaWorkOrderReviewMutation.isPending || !workOrderId}
                        >
                          Hold spend
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 4 Media Pilot Pack</CardTitle>
                <CardDescription>
                  Approved topic placements become a no-spend production map for slide decks, study guides, visuals, quizzes, narration, and future video.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={mediaPilotRecords.length ? "default" : "outline"}>
                  {isMediaPilotPackLoading ? "Loading" : `${mediaPilotRecords.length} pilot row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadMediaPilotPack("csv")} disabled={!mediaPilotRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Pilot CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMediaPilotPack("json")} disabled={!mediaPilotRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium">{mediaPilotPackData?.budgetWindow || "$100-$500"} checkpoint</div>
              <div className="mt-1">
                {mediaPilotPackData?.costGuardrail || "This pack organizes approved content only. It does not generate visuals, audio, video, or batch lesson media."}
              </div>
              <div className="mt-1 text-xs">
                {mediaPilotPackData?.nextAllowedSpend || "Approve one Phase 3 placement first."}
              </div>
            </div>
            {mediaPilotRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Approve one Phase 3 placement first. The media pilot pack stays empty until a topic is ready for controlled production planning.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {mediaPilotRecords.map((record) => {
                  const topic = String(record.Topic || "Untitled topic");
                  return (
                    <div key={`media-pilot-${String(record["Source Type"] || "source")}-${String(record["Source ID"] || topic)}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{topic}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                          </div>
                        </div>
                        <Badge variant="default">{String(record["Pilot Stage"] || "media pilot")}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                        <div className="rounded-md bg-slate-50 p-2">Weak topic: {String(record["Weak Topic"] || "needs review")}</div>
                        <div className="rounded-md bg-slate-50 p-2">CJM: {String(record["CJM Step"] || "needs review")}</div>
                        <div className="rounded-md bg-slate-50 p-2">NCLEX: {String(record["NCLEX Category"] || "needs review")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Video: {String(record["Video Status"] || "not started")}</div>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-slate-700">
                        <div>
                          <div className="font-medium text-slate-950">Slide deck</div>
                          <p className="mt-1">{String(record["Slide Deck Plan"] || "Create or attach a learner slide deck.")}</p>
                        </div>
                        <div>
                          <div className="font-medium text-slate-950">Study guide</div>
                          <p className="mt-1">{String(record["Study Guide Plan"] || "Create a guided note or study guide.")}</p>
                        </div>
                        <div>
                          <div className="font-medium text-slate-950">Visuals</div>
                          <p className="mt-1">{String(record["Visual Plan"] || "Plan a cue map or decision visual.")}</p>
                        </div>
                        <div>
                          <div className="font-medium text-slate-950">Quiz and rationale</div>
                          <p className="mt-1">{String(record["Quiz/Rationale Plan"] || "Attach at least one practice item with rationales.")}</p>
                        </div>
                        <div>
                          <div className="font-medium text-slate-950">Narration</div>
                          <p className="mt-1">{String(record["Narration Script Plan"] || "Draft speaker notes only.")}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                        {String(record["Required Human Approval"] || record["Cost Guardrail"] || "Manual approval required before media generation.")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 2 Draft Quality Review Pack</CardTitle>
                <CardDescription>
                  Human-review packet for the first two template drafts before any paid polish, audio, visuals, or video work.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={draftReviewRecords.length ? "default" : "outline"}>
                  {isDraftReviewPackLoading ? "Loading" : `${draftReviewRecords.length} draft record(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadDraftReviewPack("csv")} disabled={!draftReviewRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Review CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadDraftReviewPack("json")} disabled={!draftReviewRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {draftReviewRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Create the two Phase 2 template drafts first. This pack will then show slide outlines, guided notes, quiz/rationale, citations, Drive assets, and the human review questions for the next spending decision.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {draftReviewRecords.map((record) => {
                  const slideTitles = String(record["Slide Outline"] || "").split(" | ").filter(Boolean).slice(0, 4);
                  const assetTitles = String(record["Drive Project Assets"] || "").split(" | ").filter(Boolean).slice(0, 4);
                  const reviewUrl = record["Lesson Builder Review URL"];
                  return (
                    <div key={`${record.Topic}-${record["Template Draft Package ID"]}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{record.Topic}</div>
                          <div className="mt-1 text-sm text-slate-600">{record.Concept} / {record["Nursing Subject"]}</div>
                        </div>
                        <Badge variant={record["Review Stage"] === "approved_for_next_checkpoint" ? "default" : "outline"}>
                          {record["Review Stage"] === "approved_for_next_checkpoint" ? "approved" : "review needed"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div className="rounded-md bg-slate-50 p-2">{record["Slide Count"] || 0} slides</div>
                        <div className="rounded-md bg-slate-50 p-2">{record["Quiz Count"] || 0} quiz item(s)</div>
                        <div className="rounded-md bg-slate-50 p-2">{record["Citation Count"] || 0} citations</div>
                      </div>
                      <div className="mt-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-950">Checklist: {record["Checklist Summary"]}</div>
                        <div className="mt-2 font-medium text-slate-950">Practice preview</div>
                        <p className="mt-1">{record["Practice Stem"] || "No practice item captured yet."}</p>
                        <p className="mt-1"><span className="font-medium">Rationale:</span> {record.Rationale || "Needs review."}</p>
                      </div>
                      {slideTitles.length ? (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-slate-950">Slide outline</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
                            {slideTitles.map((title) => (
                              <li key={`${record.Topic}-${title}`}>{title}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {assetTitles.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {assetTitles.map((asset) => (
                            <Badge key={`${record.Topic}-${asset}`} variant="outline">{asset}</Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                        {record["Cost Guardrail"]}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {reviewUrl ? (
                          <Link href={reviewUrl}>
                            <Button size="sm" variant="outline">
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              Review draft
                            </Button>
                          </Link>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => downloadDraftReviewPack("csv")}>
                          <Download className="mr-2 h-4 w-4" />
                          Export review
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Next Spend Queue</CardTitle>
                <CardDescription>
                  Only drafts explicitly approved for the next $100-$250 checkpoint appear here.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={nextSpendPackets.length ? "default" : "outline"}>{nextSpendPackets.length} approved</Badge>
                <Badge variant={phaseTwoReviewPackets.length >= 2 ? "default" : "outline"}>{phaseTwoReviewPackets.length}/2 review-passed</Badge>
                <Button
                  size="sm"
                  onClick={() => phaseTwoApprovalMutation.mutate()}
                  disabled={phaseTwoApprovalMutation.isPending || phaseTwoReviewPackets.length < 2}
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {phaseTwoApprovalMutation.isPending ? "Approving..." : "Approve Phase 2"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadNextSpendQueue("csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  Polish CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadNextSpendQueue("json")}>
                  <Download className="mr-2 h-4 w-4" />
                  Polish JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {nextSpendPackets.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                No draft has earned the next spend checkpoint yet. Mark a 5/5 draft as approved after review.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {nextSpendPackets.map((packet) => (
                  <div key={`next-spend-${packet.sourceId}`} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-950">{packet.topic}</div>
                        <div className="mt-1 text-sm text-slate-600">{packet.concept} / {packet.nursingSubject}</div>
                        <p className="mt-2 text-xs font-medium text-slate-700">{packet.draftPackage?.nextSpendRecommendation}</p>
                      </div>
                      <Badge variant="default">Approved $100-$250</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                      <div className="rounded-md bg-slate-50 p-2">{packet.draftPackage?.slideCount || 0} slides</div>
                      <div className="rounded-md bg-slate-50 p-2">{packet.draftPackage?.itemCount || 0} quiz item(s)</div>
                      <div className="rounded-md bg-slate-50 p-2">{packet.draftPackage?.citationCount || 0} citations</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={lessonBuilderDraftReviewUrl(packet)}>
                        <Button size="sm" variant="outline">
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          Review draft
                        </Button>
                      </Link>
                      <Link href={lessonBuilderHandoffUrl(packet)}>
                        <Button size="sm" variant="outline">
                          <Package className="mr-2 h-4 w-4" />
                          Open builder
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 3 Shorts/Airtable Handoff</CardTitle>
                <CardDescription>
                  One tracker row per approved draft, with hook, script, asset coverage, and the next production action.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={nextSpendPackets.length ? "default" : "outline"}>{nextSpendPackets.length} tracker row(s)</Badge>
                <Button variant="outline" size="sm" onClick={() => downloadShortsWorkflow("csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  Shorts CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadShortsWorkflow("json")}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {nextSpendPackets.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Approve Phase 2 before creating the shorts/Airtable handoff.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {nextSpendPackets.map((packet) => {
                  const coverage = (key: string) => (packet.coverageContract?.rows || []).find((item) => item.key === key);
                  return (
                    <div key={`shorts-${packet.sourceId}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-950">{packet.topic}</div>
                        <Badge variant="outline">$100-$250 handoff</Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900">{packet.shortsStarter.hook}</p>
                      <p className="mt-2 text-sm text-slate-700">{packet.shortsStarter.scriptDraft}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div className="rounded-md bg-slate-50 p-2">Deck: {coverage("lessonDeck")?.status || "needed"}</div>
                        <div className="rounded-md bg-slate-50 p-2">Quiz: {coverage("quiz")?.status || "needed"}</div>
                        <div className="rounded-md bg-slate-50 p-2">Citations: {coverage("citations")?.status || "needed"}</div>
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-700">
                        Next: review the hook/script, choose one visual direction, then approve only one short for polish.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Phase 3 Production Handoff</CardTitle>
                <CardDescription>
                  Approved draft rows organized into the next owner action before any audio, video, or batch production spend.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={phaseThreeHandoffRecords.length ? "default" : "outline"}>
                  {isPhaseThreeHandoffLoading ? "Loading" : `${phaseThreeHandoffRecords.length} handoff row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadPhaseThreeHandoff("csv")} disabled={!phaseThreeHandoffRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Handoff CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPhaseThreeHandoff("json")} disabled={!phaseThreeHandoffRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">
                {phaseThreeHandoffData?.nextAllowedSpend || "Next allowed spend appears after Phase 2 is accepted."}
              </div>
              <div className="mt-1">
                {phaseThreeHandoffData?.costGuardrail || "No paid polish, audio, visuals, or video until the accepted draft rows are visible here."}
              </div>
            </div>
            {phaseThreeHandoffRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Approve the two Phase 2 template drafts first. The handoff will then show the exact review action, student surface, Airtable status, Drive assets, and hold triggers for each topic.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {phaseThreeHandoffRecords.map((record) => {
                  const topic = String(record.Topic || "Untitled topic");
                  const packageId = String(record["Template Draft Package ID"] || "");
                  const coverageItems = String(record["Current Asset Coverage"] || "").split(" | ").filter(Boolean);
                  const driveAssets = String(record["Drive Project Assets"] || "").split(" | ").filter(Boolean).slice(0, 5);
                  const recordedDecision = (String(record["Recorded Decision"] || "unreviewed") as PhaseThreeDecision);
                  const decisionLabel = phaseThreeDecisionLabels[recordedDecision] || phaseThreeDecisionLabels.unreviewed;
                  const decisionVariant = phaseThreeDecisionVariants[recordedDecision] || "outline";
                  return (
                    <div key={`${topic}-${packageId}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{topic}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge variant="outline">{String(record["Spend Window"] || "$100-$250")}</Badge>
                          <Badge variant={decisionVariant}>{decisionLabel}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                        <div className="rounded-md bg-slate-50 p-2">Airtable: {String(record["Airtable Tracker Row"] || "pending")}</div>
                        <div className="rounded-md bg-slate-50 p-2">Shorts: {String(record["Shorts Workflow Row"] || "pending")}</div>
                      </div>
                      {coverageItems.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {coverageItems.map((item) => (
                            <Badge key={`${topic}-${item}`} variant="outline">{item}</Badge>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        {String(record["Immediate Human Decision"] || "Review before spend.")}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{String(record["Next Owner Action"] || "")}</p>
                      <p className="mt-2 text-xs text-slate-700">
                        <span className="font-medium">Hold if:</span> {String(record["Hold Trigger"] || "")}
                      </p>
                      {driveAssets.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {driveAssets.map((asset) => (
                            <Badge key={`${topic}-${asset}`} variant="secondary">{asset}</Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs font-medium text-amber-900">
                        {String(record["Cost Guardrail"] || "No batch generation until reviewed.")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => phaseThreeDecisionMutation.mutate({ packageId, decision: "approve_polish_pass" })}
                          disabled={phaseThreeDecisionMutation.isPending || !packageId}
                        >
                          Approve polish
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => phaseThreeDecisionMutation.mutate({ packageId, decision: "approve_short_planning" })}
                          disabled={phaseThreeDecisionMutation.isPending || !packageId}
                        >
                          Approve short
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => phaseThreeDecisionMutation.mutate({ packageId, decision: "needs_fix" })}
                          disabled={phaseThreeDecisionMutation.isPending || !packageId}
                        >
                          Needs fixes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => phaseThreeDecisionMutation.mutate({ packageId, decision: "hold_spend" })}
                          disabled={phaseThreeDecisionMutation.isPending || !packageId}
                        >
                          Hold spend
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Student Launch Readiness Gate</CardTitle>
                <CardDescription>
                  Final admin decision before a draft can move toward a controlled student preview or public lesson release.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={studentLaunchReadinessRecords.length ? "default" : "outline"}>
                  {isStudentLaunchReadinessLoading ? "Loading" : `${studentLaunchReadinessRecords.length} readiness row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadStudentLaunchReadiness("csv")} disabled={!studentLaunchReadinessRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Readiness CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadStudentLaunchReadiness("json")} disabled={!studentLaunchReadinessRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">Controlled preview gate</div>
              <div className="mt-1">
                {studentLaunchReadinessData?.costGuardrail || "No broad public launch, video/audio, or batch production until this gate is approved."}
              </div>
            </div>
            {studentLaunchReadinessRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Record Phase 3 decisions first. This gate will then show blockers, student preview URLs, public visibility, and the final launch decision for each draft.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {studentLaunchReadinessRecords.map((record) => {
                  const topic = String(record.Topic || "Untitled topic");
                  const packageId = String(record["Template Draft Package ID"] || "");
                  const decision = (String(record["Student Launch Decision"] || "unreviewed") as StudentLaunchDecision);
                  const status = String(record["Launch Gate Status"] || "student_review_needed");
                  const previewUrl = String(record["Student Preview URL"] || "");
                  const previewReviewOutcome = String(record["Preview Review Outcome"] || "not_recorded");
                  const previewReviewNotes = String(record["Preview Review Notes"] || "");
                  const previewReviewRecordedAt = String(record["Preview Review Recorded At"] || "");
                  const blockers = String(record.Blockers || "").split(" | ").filter(Boolean);
                  return (
                    <div key={`student-launch-${topic}-${packageId}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{topic}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge variant={status === "approved_for_student_preview" ? "default" : status === "blocked" ? "destructive" : "outline"}>
                            {status}
                          </Badge>
                          <Badge variant={studentLaunchDecisionVariants[decision] || "outline"}>
                            {studentLaunchDecisionLabels[decision] || studentLaunchDecisionLabels.unreviewed}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div className="rounded-md bg-slate-50 p-2">{String(record["Package Status"] || "draft")}</div>
                        <div className="rounded-md bg-slate-50 p-2">{String(record["Public Visibility"] || "admin only")}</div>
                        <div className="rounded-md bg-slate-50 p-2">{String(record["Phase 3 Decision"] || "unreviewed")}</div>
                      </div>
                      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium uppercase text-slate-500">Preview review outcome</span>
                          <Badge variant={previewReviewOutcome === "ready_for_release" ? "default" : previewReviewOutcome === "not_recorded" ? "outline" : "secondary"}>
                            {previewReviewOutcome.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        {previewReviewNotes ? (
                          <div className="mt-2 text-slate-800">{previewReviewNotes}</div>
                        ) : null}
                        {previewReviewRecordedAt ? (
                          <div className="mt-2 text-slate-500">Recorded {new Date(previewReviewRecordedAt).toLocaleString()}</div>
                        ) : null}
                      </div>
                      {previewUrl ? (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <div className="text-xs font-medium uppercase text-slate-500">Controlled review link</div>
                            <div className="mt-1 break-all text-xs text-slate-700">{absolutePreviewUrl(previewUrl)}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link href={previewUrl}>
                              <Button size="sm" variant="outline">
                                <Play className="mr-2 h-4 w-4" />
                                Open controlled preview
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyStudentPreviewUrl(previewUrl, topic)}
                            >
                              <Clipboard className="mr-2 h-4 w-4" />
                              Copy review link
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {blockers.length ? (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                          <div className="font-semibold">Blockers</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {blockers.map((blocker) => (
                              <li key={`${topic}-${blocker}`}>{blocker}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-900">
                          No readiness blockers are listed for controlled student preview.
                        </div>
                      )}
                      <p className="mt-3 text-sm text-slate-700">{String(record["Next Action"] || "")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => studentLaunchDecisionMutation.mutate({ packageId, decision: "approve_student_preview" })}
                          disabled={studentLaunchDecisionMutation.isPending || !packageId || blockers.length > 0}
                        >
                          Approve preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => studentLaunchDecisionMutation.mutate({ packageId, decision: "needs_fix" })}
                          disabled={studentLaunchDecisionMutation.isPending || !packageId}
                        >
                          Needs fixes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => studentLaunchDecisionMutation.mutate({ packageId, decision: "hold_release" })}
                          disabled={studentLaunchDecisionMutation.isPending || !packageId}
                        >
                          Hold release
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Final Publish Readiness</CardTitle>
                <CardDescription>
                  Read-only gate for drafts that passed controlled preview review and can move to the existing Lesson Builder publish panel.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={publishReadinessRecords.length ? "default" : "outline"}>
                  {isPublishReadinessLoading ? "Loading" : `${publishReadinessRecords.length} row(s)`}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => downloadPublishReadiness("csv")} disabled={!publishReadinessRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Publish CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadPublishReadiness("json")} disabled={!publishReadinessRecords.length}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-950">Final confirmation gate</div>
              <div className="mt-1">
                {publishReadinessData?.costGuardrail || "Publishing uses existing package artifacts; no paid video/audio or batch production is part of this gate."}
              </div>
            </div>
            {publishReadinessRecords.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Complete the controlled preview review first. Publish readiness will then show whether each draft can be sent to the Lesson Builder publish panel.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {publishReadinessRecords.map((record) => {
                  const topic = String(record.Topic || "Untitled topic");
                  const workOrderId = String(record["Approved Work Order ID"] || "");
                  const packageId = String(record["Template Draft Package ID"] || "");
                  const status = String(record["Publish Gate Status"] || "blocked");
                  const blockers = String(record["Publish Blockers"] || "").split(" | ").filter(Boolean);
                  const publishUrl = String(record["Lesson Builder Publish URL"] || "");
                  const publishEndpoint = String(record["Publish Endpoint"] || "");
                  const releaseAuditEndpoint = String(record["Release Audit Endpoint"] || "");
                  const studentReleaseQaEndpoint = String(record["Student Release QA Endpoint"] || "");
                  const publicLessonUrl = String(record["Public Lesson URL"] || "");
                  const statusVariant = status === "ready_for_public_publish"
                    ? "default"
                    : status === "published"
                      ? "secondary"
                      : status === "release_decision_needed"
                        ? "outline"
                        : "destructive";

                  return (
                    <div key={`publish-readiness-${topic}-${packageId}`} className="rounded-md border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-950">{topic}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {String(record.Concept || "")} / {String(record["Nursing Subject"] || "")}
                          </div>
                        </div>
                        <Badge variant={statusVariant}>{status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-4">
                        <div className="rounded-md bg-slate-50 p-2">{packageId || "No package id"}</div>
                        <div className="rounded-md bg-slate-50 p-2">{String(record["Package Status"] || "draft")}</div>
                        <div className="rounded-md bg-slate-50 p-2">{String(record["Preview Review Outcome"] || "not recorded")}</div>
                        <div className="rounded-md bg-slate-50 p-2">{String(record["Public Release Decision"] || "unreviewed")}</div>
                      </div>
                      {publicLessonUrl ? (
                        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                          <div>Public lesson is live at {publicLessonUrl}</div>
                          <div className="mt-2">
                            <Link href={publicLessonUrl}>
                              <Button size="sm" variant="outline">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open public lesson
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : null}
                      {blockers.length ? (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                          <div className="font-semibold">Publish blockers</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {blockers.map((blocker) => (
                              <li key={`${packageId}-${blocker}`}>{blocker}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-900">
                          No publish blockers listed after controlled review.
                        </div>
                      )}
                      <p className="mt-3 text-sm text-slate-700">{String(record["Next Action"] || "")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publicReleaseDecisionMutation.mutate({ workOrderId, packageId, decision: "approve_public_release" })}
                          disabled={!packageId || publicReleaseDecisionMutation.isPending || status === "published"}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve release gate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publicReleaseDecisionMutation.mutate({ workOrderId, packageId, decision: "needs_fix" })}
                          disabled={!packageId || publicReleaseDecisionMutation.isPending || status === "published"}
                        >
                          Release needs fixes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publicReleaseDecisionMutation.mutate({ workOrderId, packageId, decision: "hold_release" })}
                          disabled={!packageId || publicReleaseDecisionMutation.isPending || status === "published"}
                        >
                          Hold release
                        </Button>
                        {publishUrl ? (
                          <Link href={publishUrl}>
                            <Button size="sm" variant="outline">
                              <Package className="mr-2 h-4 w-4" />
                              Open final publish panel
                            </Button>
                          </Link>
                        ) : null}
                        {releaseAuditEndpoint ? (
                          <a href={releaseAuditEndpoint} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              <FileText className="mr-2 h-4 w-4" />
                              Release audit snapshot
                            </Button>
                          </a>
                        ) : null}
                        {studentReleaseQaEndpoint ? (
                          <a href={studentReleaseQaEndpoint} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              Student release QA
                            </Button>
                          </a>
                        ) : null}
                        {publishEndpoint ? (
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            Publish endpoint is ready; use Lesson Builder publish button for final confirmation.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {airtableTracker ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Airtable Tracker Contract</CardTitle>
                  <CardDescription>
                    Import-ready schema for the viral shorts workflow; no Airtable write happens until you pick the base.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{airtableTracker.tableName}</Badge>
                  <Badge variant="outline">{airtableTracker.fields.length} fields</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium text-slate-950">{airtableTracker.costPolicy}</div>
                <div className="mt-1">{airtableTracker.importMode}</div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border p-4">
                  <div className="text-sm font-semibold text-slate-950">Required CSV headers</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {airtableTracker.requiredCsvHeaders.map((header) => (
                      <Badge key={header} variant="outline">{header}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="text-sm font-semibold text-slate-950">Recommended views</div>
                  <div className="mt-3 space-y-2">
                    {airtableTracker.recommendedViews.map((view) => (
                      <div key={view.name} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                        <div className="font-medium text-slate-950">{view.name}</div>
                        <div>{view.filter}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {airtableTracker.fields.filter((field) => field.required).slice(0, 12).map((field) => (
                  <div key={field.name} className="rounded-md border p-3 text-xs text-slate-700">
                    <div className="font-semibold text-slate-950">{field.name}</div>
                    <div className="mt-1">{field.type} / {field.source}</div>
                    <div className="mt-1">{field.notes}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Where Content Belongs</CardTitle>
            <CardDescription>
              Use this as the review map before building more assets.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-4">
              <div className="text-sm font-semibold">Processed sources</div>
              <p className="mt-1 text-sm text-slate-600">Imported PPTX, Data Chunker, PDF, and text chunks belong in Content Mapper until taxonomy is reviewed.</p>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm font-semibold">Generated lessons</div>
              <p className="mt-1 text-sm text-slate-600">Decks, guided notes, practice items, rationales, and citations belong in Lesson Builder for QA, export, and publish.</p>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm font-semibold">Student materials</div>
              <p className="mt-1 text-sm text-slate-600">Published lesson packages become the student lesson page, study pack, quiz practice, and progress surface.</p>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-sm font-semibold">Shorts/video queue</div>
              <p className="mt-1 text-sm text-slate-600">Ready topics can move to the Airtable CSV/JSON queue for hooks, scripts, visuals, audio, and video production review.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>First Build Candidates</CardTitle>
                <CardDescription>
                  Queue only the first pediatrics and maternal/newborn examples before spending on batch content generation.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={queuedFirstBuildCount === firstBuildCandidates.length && firstBuildCandidates.length > 0 ? "default" : "outline"}>
                  {queuedFirstBuildCount}/{firstBuildCandidates.length || 2} queued
                </Badge>
                <Button size="sm" variant="outline" onClick={() => downloadBuildPackets("csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  Build Packets CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadBuildPackets("json")}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {firstBuildCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Import or map the pediatrics asthma and maternal/newborn guide sources to create the first build queue.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {firstBuildCandidates.map((row) => (
                  <div key={`first-build-${rowKey(row)}`} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{row.topic || row.title}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {[row.concept, row.nursingSubject].filter(Boolean).join(" / ") || "Needs mapping review"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {row.chunkCount ? <Badge variant="outline">{row.chunkCount} chunks</Badge> : null}
                          <Badge variant={reviewVariants[row.review?.decision || "unreviewed"] || "outline"}>
                            {reviewLabels[row.review?.decision || "unreviewed"]}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={row.nextBuildApproved ? "outline" : "default"}
                        onClick={() => queueFirstBuildCandidate(row)}
                        disabled={reviewMutation.isPending || row.nextBuildApproved}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        {row.nextBuildApproved ? "Queued" : "Queue build"}
                      </Button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{row.nextAction}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Queued Build Packets</CardTitle>
                <CardDescription>
                  Review the asset-level instructions before spending on AI generation, deck production, visuals, or video.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={buildPacketData?.count ? "default" : "outline"}>
                  {buildPacketData?.count ?? 0} packet(s)
                </Badge>
                <Badge variant={phaseTwoReadyPackets.length >= 2 ? "default" : "outline"}>
                  {phaseTwoReadyPackets.length}/2 draft-ready
                </Badge>
                <Button
                  size="sm"
                  onClick={() => phaseTwoDraftMutation.mutate()}
                  disabled={phaseTwoDraftMutation.isPending || phaseTwoReadyPackets.length < 2}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {phaseTwoDraftMutation.isPending ? "Creating..." : "Create Phase 2 drafts"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isBuildPacketsLoading ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Loading build packets...
              </div>
            ) : !buildPacketData?.packets?.length ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-600">
                Queue one or two topics as Build lesson to see deck, study guide, visuals, quiz, citations, and shorts instructions here.
              </div>
            ) : (
              <div className="space-y-4">
                {buildPacketData.packets.map((packet) => {
                  const draftPackage = packet.draftPackage;
                  const localDraft = draftResults[packet.sourceId];
                  const draftReady = Boolean(draftPackage || localDraft);
                  const draftButtonLabel = draftPackage ? "Draft ready" : localDraft ? "Draft created" : "Create template draft";

                  return (
                  <div key={`${packet.sourceType}-${packet.sourceId}`} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">#{packet.buildOrder}</Badge>
                          <h3 className="font-semibold text-slate-950">{packet.topic}</h3>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {packet.concept ? <Badge variant="outline">{packet.concept}</Badge> : null}
                          {packet.nursingSubject ? <Badge variant="outline">{packet.nursingSubject}</Badge> : null}
                          {packet.nclexCategory ? <Badge variant="outline">{packet.nclexCategory}</Badge> : null}
                          {packet.cjmStep ? <Badge variant="outline">{packet.cjmStep}</Badge> : null}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600">
                        {packet.lessonBuilderInput.slideTarget} slides / {packet.lessonBuilderInput.minimumQuizItems} quiz minimum
                      </div>
                      <Badge variant="outline">$100 review checkpoint</Badge>
                      {draftReady ? (
                        <Badge variant="default">Draft ready</Badge>
                      ) : null}
                      {packet.readiness ? (
                        <Badge variant={packet.readiness.readyForTemplateDraft ? "default" : "secondary"}>
                          {packet.readiness.passedCount}/{packet.readiness.totalCount} ready
                        </Badge>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => templateDraftMutation.mutate(packet)}
                        disabled={
                          templateDraftMutation.isPending
                          || draftReady
                          || !packet.readiness?.readyForTemplateDraft
                          || !packet.sourceTruth?.sourceId
                        }
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {draftButtonLabel}
                      </Button>
                      <Link href={lessonBuilderHandoffUrl(packet)}>
                        <Button size="sm">
                          <Package className="mr-2 h-4 w-4" />
                          Open in Lesson Builder
                        </Button>
                      </Link>
                    </div>

                    {packet.driveProjectAssets?.length ? (
                      <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
                        <div className="text-sm font-semibold text-blue-950">Drive sources for this packet</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {packet.driveProjectAssets.map((asset) => (
                            <div key={`${packet.sourceId}-${asset.id}`} className="rounded-md bg-white/70 p-2 text-xs text-blue-950">
                              <div className="font-medium">{asset.title}</div>
                              <div className="mt-1 text-blue-800">{asset.belongsIn}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {asset.assetKeys.map((key) => (
                                  <Badge key={`${asset.id}-${key}`} variant="outline">
                                    {data?.summary.requiredAssets[key] || key}
                                  </Badge>
                                ))}
                              </div>
                              <a className="mt-2 inline-flex font-medium text-blue-700 hover:underline" href={asset.url} target="_blank" rel="noreferrer">
                                Open source
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {draftPackage ? (
                      <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-emerald-950">Template draft is ready for review</div>
                              {draftPackage.reviewTotalCount ? (
                                <Badge variant={draftPackage.reviewPassedCount === draftPackage.reviewTotalCount ? "default" : "secondary"}>
                                  {draftPackage.reviewPassedCount}/{draftPackage.reviewTotalCount} review checks
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-emerald-900">{draftPackage.title}</p>
                            <p className="mt-1 text-xs text-emerald-800">
                              {draftPackage.status} / {draftPackage.qaStatus || "qa pending"} / {draftPackage.slideCount} slides / {draftPackage.itemCount} quiz item(s) / {draftPackage.citationCount} citations
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant={draftReviewVariants[draftPackage.draftReview?.decision || "unreviewed"]}>
                                {draftReviewLabels[draftPackage.draftReview?.decision || "unreviewed"]}
                              </Badge>
                              {draftPackage.nextSpendApproved ? (
                                <Badge variant="default">Next spend approved</Badge>
                              ) : null}
                            </div>
                            {draftPackage.nextSpendRecommendation ? (
                              <p className="mt-2 text-xs font-medium text-emerald-950">{draftPackage.nextSpendRecommendation}</p>
                            ) : null}
                          </div>
                          <Link href={lessonBuilderDraftReviewUrl(packet)}>
                            <Button size="sm" variant="outline">
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              Open QA & Export
                            </Button>
                          </Link>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => draftReviewMutation.mutate({ packet, decision: "approve_polish" })}
                            disabled={draftReviewMutation.isPending || draftPackage.reviewPassedCount !== draftPackage.reviewTotalCount}
                          >
                            Approve next $100-$250
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => draftReviewMutation.mutate({ packet, decision: "needs_fix" })}
                            disabled={draftReviewMutation.isPending}
                          >
                            Needs fixes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => draftReviewMutation.mutate({ packet, decision: "hold" })}
                            disabled={draftReviewMutation.isPending}
                          >
                            Hold spend
                          </Button>
                        </div>
                        {draftPackage.reviewChecklist?.length ? (
                          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                            {draftPackage.reviewChecklist.map((check) => (
                              <div key={check.key} className="rounded-md bg-white/70 p-2 text-xs text-emerald-950">
                                <div className="flex items-center gap-1.5 font-medium">
                                  {check.passed ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <CircleDashed className="h-3.5 w-3.5 text-amber-600" />
                                  )}
                                  {check.label}
                                </div>
                                <div className="mt-1 text-emerald-800">{check.detail}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : localDraft ? (
                      <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        Template draft created in this session. Refresh build packets to load QA counts before spending the next checkpoint.
                      </div>
                    ) : null}

                    {packet.coverageContract ? (
                      <div className="mt-4 rounded-md border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-semibold text-slate-950">Minimum product coverage</div>
                            <p className="mt-1 text-xs text-slate-600">
                              Shows where each AI-generated or processed asset belongs before student release.
                            </p>
                          </div>
                          <Badge variant={packet.coverageContract.studentReady ? "default" : "secondary"}>
                            {packet.coverageContract.readyCount}/{packet.coverageContract.totalCount} reviewable
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {packet.coverageContract.rows.map((item) => (
                            <div key={`${packet.sourceId}-coverage-${item.key}`} className="rounded-md bg-slate-50 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium text-slate-950">{item.label}</div>
                                <Badge variant={coverageStatusVariants[item.status] || "outline"}>{item.status}</Badge>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">Belongs in</div>
                              <div className="text-xs font-medium text-slate-800">{item.belongsIn}</div>
                              <div className="mt-2 text-xs text-slate-500">Student surface</div>
                              <div className="text-xs text-slate-700">{item.studentSurface}</div>
                              <div className="mt-2 text-xs text-slate-500">Proof</div>
                              <div className="text-xs text-slate-700">{item.proof}</div>
                              <div className="mt-2 text-xs font-medium text-slate-700">{item.nextAction}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {packet.assetPlan.map((asset) => (
                        <div key={`${packet.sourceId}-${asset.assetKey}`} className="rounded-md border bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">{asset.asset}</div>
                            <Badge variant={asset.status === "ready" ? "default" : "outline"}>{asset.status}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{asset.belongsIn}</div>
                          <p className="mt-2 text-sm text-slate-700">{asset.brief}</p>
                        </div>
                      ))}
                    </div>

                    {packet.templateDraft ? (
                      <div className="mt-4 rounded-md border p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-semibold text-slate-950">No-spend template draft skeleton</div>
                          <Badge variant="outline">Review before Generate</Badge>
                        </div>
                        <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="space-y-2">
                            {packet.templateDraft.slideOutline.map((slide, index) => (
                              <div key={`${packet.sourceId}-slide-${index}`} className="rounded-md bg-slate-50 p-3">
                                <div className="text-sm font-medium text-slate-900">{index + 1}. {slide.title}</div>
                                <p className="mt-1 text-xs text-slate-600">{slide.purpose}</p>
                                <p className="mt-1 text-xs font-medium text-slate-700">Prompt: {slide.retrievalPrompt}</p>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-3">
                            <div className="rounded-md bg-slate-50 p-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Guided notes shape</div>
                              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                {packet.templateDraft.guidedNotesOutline.map((note) => (
                                  <li key={note}>- {note}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-md bg-slate-50 p-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Quiz/rationale slot</div>
                              <p className="mt-2 text-sm text-slate-700">{packet.templateDraft.practicePreview.stem}</p>
                              <p className="mt-2 text-xs text-slate-600">{packet.templateDraft.practicePreview.rationale}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {packet.readiness ? (
                      <div className="mt-4 rounded-md border p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-semibold text-slate-950">Template draft readiness</div>
                          <Badge variant={packet.readiness.readyForTemplateDraft ? "default" : "secondary"}>
                            {packet.readiness.readyForTemplateDraft ? "Ready for Phase 2" : "Needs review"}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {packet.readiness.checks.map((check) => (
                            <div key={check.key} className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm">
                              {check.passed ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                              ) : (
                                <CircleDashed className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
                              )}
                              <div>
                                <div className="font-medium text-slate-900">{check.label}</div>
                                <div className="text-xs text-slate-600">{check.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Short/video starter</div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{packet.shortsStarter.hook}</p>
                        <p className="mt-2 text-sm text-slate-700">{packet.shortsStarter.scriptDraft}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Review gate</div>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {packet.humanReviewGate.map((gate) => (
                            <li key={gate}>- {gate}</li>
                          ))}
                        </ul>
                        <p className="mt-3 text-xs font-medium text-slate-600">{packet.costGuardrail}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Initial Content Review</CardTitle>
                <CardDescription>
                  Select a topic below, confirm where it belongs, then choose the next build decision.
                </CardDescription>
              </div>
              {selectedRow?.review?.decision ? (
                <Badge variant={reviewVariants[selectedRow.review.decision] || "outline"}>
                  {reviewLabels[selectedRow.review.decision] || selectedRow.review.decision}
                </Badge>
              ) : (
                <Badge variant="outline">Unreviewed</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRow ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-slate-600">
                Import or map content to create the first review row.
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-4">
                  <div>
                  <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-950">{selectedRow.topic || selectedRow.title}</h2>
                      <Badge variant="outline">{selectedRow.placement?.contentKind || selectedRow.sourceType}</Badge>
                      {selectedRow.chunkCount ? <Badge variant="outline">{selectedRow.chunkCount} chunks</Badge> : null}
                      <Badge variant={statusVariants[selectedRow.status] || "outline"}>
                        {statusLabels[selectedRow.status] || selectedRow.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{selectedRow.nextAction}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current location</div>
                      <div className="mt-1 font-medium text-slate-900">{selectedRow.placement?.currentLocation || "Review queue"}</div>
                      <div className="mt-2 text-xs text-slate-500">Review surface</div>
                      <div className="font-medium text-slate-800">{selectedRow.placement?.reviewSurface || "Admin"}</div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Belongs in</div>
                      <div className="mt-1 font-medium text-slate-900">{selectedRow.placement?.belongsIn || "Review queue"}</div>
                      <div className="mt-2 text-xs text-slate-500">Next build surface</div>
                      <div className="font-medium text-slate-800">{selectedRow.placement?.nextBuildSurface || selectedRow.nextAction}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-slate-500">Concept</div>
                      <div className="mt-1 font-medium">{selectedRow.concept || "Not mapped"}</div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-slate-500">Nursing subject</div>
                      <div className="mt-1 font-medium">{selectedRow.nursingSubject || "Not mapped"}</div>
                    </div>
                    <div className="rounded-md border p-4">
                      <div className="text-xs text-slate-500">NCLEX / CJM</div>
                      <div className="mt-1 font-medium">{[selectedRow.nclexCategory, selectedRow.cjmStep].filter(Boolean).join(" / ") || "Not mapped"}</div>
                    </div>
                  </div>

                  <div className="rounded-md border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Source evidence</div>
                    <p className="mt-2 text-sm text-slate-700">{selectedRow.sourceEvidence || "No source evidence summary attached yet."}</p>
                  </div>

                  <div className="rounded-md border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">AI-processed short/video starter</div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{selectedRow.shorts?.hook || "No hook generated yet."}</p>
                    <p className="mt-2 text-sm text-slate-700">{selectedRow.shorts?.scriptDraft || "No short script draft generated yet."}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {assetBadge("Deck", selectedRow.assets.slideDeck)}
                    {assetBadge("Study guide", selectedRow.assets.studyGuide)}
                    {assetBadge("Visuals", selectedRow.assets.visuals)}
                    {assetBadge("Quiz", selectedRow.assets.quiz)}
                    {assetBadge("Citations", selectedRow.assets.citations)}
                  </div>
                </div>

                <div className="space-y-4 rounded-md border p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">Review decision</div>
                    <p className="mt-1 text-xs text-slate-600">This controls the approved next-build export.</p>
                  </div>
                  <Select value={reviewDecision} onValueChange={(value) => setReviewDecision(value as ReviewDecision)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unreviewed">Unreviewed</SelectItem>
                      <SelectItem value="approve_mapping">Approve mapping</SelectItem>
                      <SelectItem value="build_lesson">Build lesson</SelectItem>
                      <SelectItem value="needs_visuals">Needs visuals</SelectItem>
                      <SelectItem value="needs_quiz">Needs quiz</SelectItem>
                      <SelectItem value="needs_edit">Needs edit</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={reviewerNotes}
                    onChange={(event) => setReviewerNotes(event.target.value)}
                    placeholder="Reviewer notes: what to fix, build, or verify next..."
                    className="min-h-28"
                  />
                  <Button
                    className="w-full"
                    onClick={saveSelectedReview}
                    disabled={reviewMutation.isPending}
                  >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    {reviewMutation.isPending ? "Saving..." : "Save Review"}
                  </Button>
                  <div className="grid gap-2">
                    <Link href="/admin/content-mapper">
                      <Button variant="outline" className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        Open Content Mapper
                      </Button>
                    </Link>
                    <Link href="/admin/lesson-builder">
                      <Button variant="outline" className="w-full">
                        <Package className="mr-2 h-4 w-4" />
                        Open Lesson Builder
                      </Button>
                    </Link>
                  </div>
                  {selectedRow.review?.reviewedAt ? (
                    <p className="text-xs text-slate-500">
                      Last reviewed {new Date(selectedRow.review.reviewedAt).toLocaleString()} by {selectedRow.review.reviewedBy || "admin"}.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Production Readiness</CardTitle>
                <CardDescription>
                  Showing {filteredRows.length} of {rows.length} source/topic rows.
                </CardDescription>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search topic, concept, subject..."
                    className="w-full pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="needs_mapping">Needs mapping</SelectItem>
                    <SelectItem value="needs_assets">Needs assets</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    <SelectItem value="pediatrics">Pediatrics</SelectItem>
                    <SelectItem value="maternal_newborn">Maternal/Newborn</SelectItem>
                    <SelectItem value="curriculum">Curriculum</SelectItem>
                    <SelectItem value="builder_operations">Builder Ops</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={assetFilter} onValueChange={setAssetFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Asset filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assets</SelectItem>
                    <SelectItem value="needs_deck">Needs deck</SelectItem>
                    <SelectItem value="needs_study_guide">Needs study guide</SelectItem>
                    <SelectItem value="needs_visuals">Needs visuals</SelectItem>
                    <SelectItem value="needs_quiz">Needs quiz</SelectItem>
                    <SelectItem value="needs_citations">Needs citations</SelectItem>
                    <SelectItem value="approved_queue">Approved queue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-slate-600">
                Loading topic production matrix...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-900">No matching topics</p>
                <p className="mt-1 text-sm text-slate-600">Adjust the filters or import/map content first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1240px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-3 pr-4 font-medium">Topic</th>
                      <th className="py-3 pr-4 font-medium">Placement</th>
                      <th className="py-3 pr-4 font-medium">Mapping</th>
                      <th className="py-3 pr-4 font-medium">Assets</th>
                      <th className="py-3 pr-4 font-medium">Counts</th>
                      <th className="py-3 pr-4 font-medium">Review</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 font-medium">Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={`${row.sourceType}-${row.id}`}
                        className={`cursor-pointer border-b align-top last:border-0 hover:bg-slate-50 ${selectedRow && rowKey(row) === rowKey(selectedRow) ? "bg-slate-50" : ""}`}
                        onClick={() => setSelectedRowKey(rowKey(row))}
                      >
                        <td className="py-4 pr-4">
                          <div className="flex items-start gap-2">
                            {row.sourceType === "lesson_package" ? (
                              <Video className="mt-0.5 h-4 w-4 text-slate-500" />
                            ) : (
                              <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                            )}
                            <div>
                              <div className="font-medium text-slate-950">{row.topic || row.title}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {row.sourceType === "lesson_package" ? `Lesson package: ${row.packageStatus}` : `${row.chunkCount || 1} imported chunk(s)`}
                              </div>
                              {row.sourceEvidence ? (
                                <div className="mt-1 max-w-xs truncate text-xs text-slate-500">{row.sourceEvidence}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="max-w-xs space-y-1 text-xs">
                            <Badge variant="outline">{row.placement?.contentKind || row.sourceType}</Badge>
                            <div className="font-medium text-slate-800">{row.placement?.currentLocation || "Current workflow"}</div>
                            <div className="text-slate-500">Belongs in: {row.placement?.belongsIn || "Review queue"}</div>
                            <div className="text-slate-500">Review: {row.placement?.reviewSurface || "Admin"}</div>
                            <div className="text-slate-500">
                              Student visible: {row.placement?.studentVisible ? "Yes" : "No"}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">Concept</div>
                            <div className="font-medium">{row.concept || "Not mapped"}</div>
                            <div className="text-xs text-slate-500">Subject / specialty</div>
                            <div className="font-medium">{row.nursingSubject || "Not mapped"}</div>
                            {row.nclexCategory || row.cjmStep ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {row.nclexCategory ? <Badge variant="outline">{row.nclexCategory}</Badge> : null}
                                {row.cjmStep ? <Badge variant="outline">{row.cjmStep}</Badge> : null}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {assetBadge("Deck", row.assets.slideDeck)}
                            {assetBadge("Study guide", row.assets.studyGuide)}
                            {assetBadge("Visuals", row.assets.visuals)}
                            {assetBadge("Quiz", row.assets.quiz)}
                            {assetBadge("Citations", row.assets.citations)}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-xs text-slate-600">
                          <div>{row.counts.slides} slides</div>
                          <div>{row.counts.studyGuideSlides} note slides</div>
                          <div>{row.counts.quizItems} quiz item(s)</div>
                          <div>{row.counts.citations} citation(s)</div>
                        </td>
                        <td className="py-4 pr-4">
                          <Badge variant={reviewVariants[row.review?.decision || "unreviewed"] || "outline"}>
                            {reviewLabels[row.review?.decision || "unreviewed"]}
                          </Badge>
                          {row.nextBuildApproved ? (
                            <div className="mt-2 text-xs font-medium text-emerald-700">Approved queue</div>
                          ) : null}
                          {row.review?.reviewerNotes ? (
                            <div className="mt-2 max-w-44 truncate text-xs text-slate-500">{row.review.reviewerNotes}</div>
                          ) : null}
                        </td>
                        <td className="py-4 pr-4">
                          <Badge variant={statusVariants[row.status] || "outline"}>
                            {statusLabels[row.status] || row.status}
                          </Badge>
                          {row.missingLabels.length > 0 ? (
                            <div className="mt-2 text-xs text-slate-500">
                              Missing: {row.missingLabels.join(", ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-4">
                          <div className="max-w-xs text-sm text-slate-700">{row.nextAction}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
