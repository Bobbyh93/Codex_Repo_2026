import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "dist", "public");
const runtimeEnv = globalThis.process?.env || globalThis.__lessonBuilderPreviewEnv || {};
const port = Number(runtimeEnv.PORT || 5000);

const csrfToken = "lesson-builder-local-preview";
const NURSING_CURRICULUM_SUPERVISOR_AGENT_ID = "agt_69eacf4c03dc8191b0de2b4d2dd59dc1";
const publicPublishConfirmationText = "I understand this makes the lesson public";

function lessonBuilderAgentEndpoint() {
  return runtimeEnv.NURSING_CURRICULUM_AGENT_ENDPOINT || runtimeEnv.HARRITY_LESSON_AGENT_ENDPOINT || "";
}

function lessonBuilderAgentApiKey() {
  return runtimeEnv.NURSING_CURRICULUM_AGENT_API_KEY || runtimeEnv.OPENAI_API_KEY || "";
}

function lessonBuilderAgentStatus() {
  const endpoint = lessonBuilderAgentEndpoint();
  const openAiFallbackConfigured = Boolean(lessonBuilderAgentApiKey());
  return {
    agentId: NURSING_CURRICULUM_SUPERVISOR_AGENT_ID,
    configured: Boolean(endpoint || openAiFallbackConfigured),
    endpointConfigured: Boolean(endpoint),
    openAiFallbackConfigured,
    authorizationConfigured: openAiFallbackConfigured,
    transport: endpoint ? "workspace_agent_endpoint" : openAiFallbackConfigured ? "openai_chat_completions" : "template",
  };
}

function hasValidPublicPublishConfirmation(body) {
  return body?.confirmPublicPublish === true
    && String(body?.confirmationText || "").trim() === publicPublishConfirmationText;
}

function buildPreviewStudyGuideFallback({ reportId = "demo-report", maxTopics = 2 } = {}) {
  const topicSeeds = [
    {
      name: "Maternal-Newborn Assessment",
      category: "Health Promotion and Maintenance",
      subject: "Maternal-Newborn",
      gapScore: 72,
      priority: 1,
      actions: ["Recognize postpartum and newborn warning cues", "Prioritize safety and escalation needs", "Connect cues to teaching points"],
    },
    {
      name: "Pediatric Respiratory Cues",
      category: "Physiological Adaptation",
      subject: "Pediatrics",
      gapScore: 68,
      priority: 1,
      actions: ["Identify airway changes early", "Choose the safest first action", "Evaluate oxygenation and work of breathing"],
    },
    {
      name: "Clinical Judgment and Prioritization",
      category: "Management of Care",
      subject: "Medical-Surgical",
      gapScore: 60,
      priority: 2,
      actions: ["Sort cues by urgency", "Rank hypotheses by risk", "Select a first nursing action"],
    },
  ].slice(0, Math.max(1, Number(maxTopics) || 2));

  const topicDetails = topicSeeds.map((topic) => ({
    name: topic.name,
    description: `${topic.subject} topic mapped to ${topic.category}.`,
    priority: topic.priority,
    gapScore: topic.gapScore,
    clinicalScenarios: [`Apply ${topic.name} to a brief patient scenario.`],
    keyNursingActions: topic.actions,
    safetyConsiderations: ["Pause for unstable cues before routine teaching."],
    difficulty: topic.priority === 1 ? "foundation" : "intermediate",
    estimatedStudyTime: topic.priority === 1 ? 60 : 45,
    prerequisites: ["Review source-backed guide section", "Complete one quiz item"],
    performanceData: {
      currentScore: 100 - topic.gapScore,
      targetScore: 85,
      improvementNeeded: topic.gapScore,
    },
  }));

  return {
    title: "NCLEX SUCCESS BLUEPRINT",
    subtitle: "LAUNCH PREVIEW STUDY GUIDE",
    studentName: "Nursing Student",
    generatedDate: new Date().toLocaleDateString(),
    launchFallback: true,
    fallbackReason: "preview_server_template",
    sourceReportId: reportId,
    progressStage: {
      current: "foundation",
      description: "Start with mapped weak topics, then open the related lesson, guide, visuals, and quiz.",
      objectives: [
        "Map each topic to concept, specialty, NCLEX category, and CJM step",
        "Open one related lesson/study pack",
        "Complete at least one rationale-backed quiz item",
      ],
      nextStage: "Expert-reviewed content polish",
    },
    overview: {
      totalTopics: topicSeeds.length,
      estimatedHours: Math.max(2, topicSeeds.length * 2),
      priorityDistribution: {
        critical: topicSeeds.filter((topic) => topic.priority === 1).length,
        high: topicSeeds.filter((topic) => topic.priority === 2).length,
        medium: 0,
        low: 0,
      },
      subjectBreakdown: topicSeeds.map((topic) => ({
        name: topic.subject,
        topicCount: 1,
        estimatedTime: topic.priority === 1 ? 60 : 45,
        priority: topic.priority === 1 ? "critical" : "high",
        systems: [{ name: topic.category, topics: [topic.name], clinicalRelevance: "high" }],
      })),
      studySequence: topicSeeds.map((topic) => topic.name),
    },
    progressMap: [
      { stage: "foundation", title: "Map Weak Topics", description: "Confirm topic metadata.", isCompleted: false, isCurrent: true, estimatedCompletion: "Today" },
      { stage: "application", title: "Study Pack", description: "Review guide, deck, visuals, and quiz.", isCompleted: false, isCurrent: false, estimatedCompletion: "1-2 days" },
      { stage: "synthesis", title: "Rationales", description: "Review why answers are correct or unsafe.", isCompleted: false, isCurrent: false, estimatedCompletion: "2-3 days" },
      { stage: "mastery", title: "Repeat Check", description: "Retest and update progress.", isCompleted: false, isCurrent: false, estimatedCompletion: "3-5 days" },
    ],
    sections: [{
      id: "preview-priority-topic-map",
      title: "PRIORITY TOPIC MAP",
      subtitle: "No-cost first-pass content for review before paid polish.",
      stage: { current: "foundation", description: "Preview launch path.", objectives: ["Review mapped topics"], nextStage: "Expert polish" },
      learningObjectives: ["Recognize cues", "Choose a safe action", "Review a rationale"],
      criticalConcepts: topicSeeds.map((topic) => topic.name),
      clinicalApplications: ["Cue recognition", "Priority action", "Outcome evaluation"],
      clinicalJudgmentSteps: [],
      topics: topicDetails,
      estimatedTime: Math.max(2, topicSeeds.length * 2) * 60,
      difficulty: "foundation",
      resources: {
        requiredReading: [],
        supplementalReading: [],
        interactiveContent: [],
        practiceQuestions: [],
        videoContent: [],
        simulationActivities: [],
        externalResources: [],
        additionalPractice: [],
      },
      assessmentFocus: {
        nclexCategories: Array.from(new Set(topicSeeds.map((topic) => topic.category))),
        clientNeedsAreas: Array.from(new Set(topicSeeds.map((topic) => topic.category))),
        cognitiveLevel: "Application",
        integratedProcesses: ["Clinical Judgment", "Nursing Process"],
        expectedQuestionTypes: ["Multiple choice", "Case scenario"],
      },
      completionCriteria: ["Review guide", "Open lesson", "Complete quiz item"],
      selfAssessmentQuestions: ["Can I identify the priority cue?", "Can I explain the safest action?"],
    }],
    resourceLibrary: { categories: ["study-guide", "slide-deck", "quiz", "visuals"], totalResources: topicSeeds.length * 4, estimatedTime: topicSeeds.length * 90 },
    clinicalJudgmentFramework: {
      overview: "Connect each weak topic to cues, hypotheses, actions, and evaluation.",
      layers: [],
      applicationExamples: [],
      practiceFramework: {
        recognizeCues: ["Highlight abnormal findings"],
        analyzeCues: ["Connect cues to likely problem"],
        prioritizeHypotheses: ["Rank by safety"],
        generateSolutions: ["Choose evidence-based actions"],
        takeActions: ["Act on priority"],
        evaluateOutcomes: ["Check response"],
      },
    },
    progressTracking: {
      currentStage: "foundation",
      overallProgress: 0,
      sectionProgress: [],
      timeTracking: { totalStudyTime: 0, dailyAverage: 0, weeklyGoal: topicSeeds.length * 90, streakDays: 0 },
      milestones: [],
    },
  };
}

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

const sources = [
  {
    id: "src-nclex-cjm-bloom",
    title: "NCLEX CJM Bloom Blueprint Toolkit Template",
    sourceKind: "drive_sheet",
    sourceType: "blueprint_crosswalk",
    sourceUri: "https://docs.google.com/spreadsheets/d/1QdrbTggSv2WndiG_WfHIRW3HpW2wM9gKfibRFZT4ecM/edit",
    driveFileId: "1QdrbTggSv2WndiG_WfHIRW3HpW2wM9gKfibRFZT4ecM",
    subject: "NCLEX / Clinical Judgment",
    edition: "2026 template",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      tabs: ["2_NCLEX_Test_Plan", "03_Universal_Learning_Map", "ATI_NCLEX_Bloom_Crosswalk", "Data_RAG_Index"],
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-ati-nclex-rag",
    title: "ATI NCLEX RAG Database Template",
    sourceKind: "drive_sheet",
    sourceType: "source_index_crosswalk",
    sourceUri: "https://docs.google.com/spreadsheets/d/1GC4BEpdBF_-3NOMdnJVlkOv0c4iman52Prhu-KjIsjw/edit",
    driveFileId: "1GC4BEpdBF_-3NOMdnJVlkOv0c4iman52Prhu-KjIsjw",
    subject: "ATI / NCLEX Source Registry",
    edition: "2026 template",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      tabs: ["Source_Index", "Curriculum_Map", "NCLEX_ATI_Crosswalk", "Learning_Objects", "Question_Bank"],
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-harrity-improvement-spec",
    title: "Harrity Lesson Builder Improvement Specification",
    sourceKind: "local_file",
    sourceType: "instructional_contract",
    sourceUri: "local-download:harrity_lesson_builder_skill_improvement_spec_20260509.md",
    driveFileId: "local-harrity-improvement-spec-20260509",
    subject: "Harrity lesson builder / learner-facing contract",
    edition: "2026-05-09 v0.2 draft",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      localFileName: "harrity_lesson_builder_skill_improvement_spec_20260509.md",
      evidenceSnippets: harrityEvidenceSnippets.improvementSpec,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-harrity-skill-overview",
    title: "Harrity Lesson Builder Skill Overview",
    sourceKind: "local_file",
    sourceType: "pipeline_architecture",
    sourceUri: "local-documents:Harrity_Lesson_Builder_Skill_Overview_20260510 - Repaired.pptx",
    driveFileId: "local-harrity-skill-overview-20260510",
    subject: "Harrity lesson builder / production pipeline",
    edition: "2026-05-10 repaired planning deck",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      localFileName: "Harrity_Lesson_Builder_Skill_Overview_20260510 - Repaired.pptx",
      evidenceSnippets: harrityEvidenceSnippets.skillOverview,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-harrity-ch18-asthma",
    title: "CH18 Asthma Learner-Facing Lesson Package",
    sourceKind: "local_file",
    sourceType: "golden_lesson_example",
    sourceUri: "local-download:CH18_Asthma_Learner_Facing_Lesson_Package_20260510.pptx",
    driveFileId: "local-harrity-ch18-asthma-20260510",
    subject: "Pediatric asthma / learner-facing demo",
    edition: "2026-05-10",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      localFileName: "CH18_Asthma_Learner_Facing_Lesson_Package_20260510.pptx",
      slideCount: 16,
      evidenceSnippets: harrityEvidenceSnippets.asthmaDemo,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-harrity-maternal-guide",
    title: "Maternal-Newborn In-Depth Lesson Guide",
    sourceKind: "local_file",
    sourceType: "course_lesson_guide",
    sourceUri: "local-download:maternal_newborn_in_depth_lesson_guide_20260610.docx",
    driveFileId: "local-harrity-maternal-newborn-guide-20260610",
    subject: "Maternal-newborn nursing",
    edition: "2026-06-10 draft faculty package",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      localFileName: "maternal_newborn_in_depth_lesson_guide_20260610.docx",
      chaptersBuilt: 27,
      representedSlides: 702,
      evidenceSnippets: harrityEvidenceSnippets.maternalGuide,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-harrity-maternal-depthpass",
    title: "Maternal-Newborn Harrity Builder Depth-Pass Package",
    sourceKind: "local_file",
    sourceType: "depth_pass_package",
    sourceUri: "local-download:maternal_newborn_harrity_builder_depthpass_20260502.zip",
    driveFileId: "local-harrity-maternal-depthpass-20260502",
    subject: "Maternal-newborn nursing / chapter production package",
    edition: "2026-05-02 depth pass",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      localFileName: "maternal_newborn_harrity_builder_depthpass_20260502.zip",
      chaptersBuilt: 27,
      evidenceSnippets: harrityEvidenceSnippets.maternalDepthPass,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "src-rn-curriculum-data-hub",
    title: "RN Concept-Based Curriculum Data Hub",
    sourceKind: "drive_sheet",
    sourceType: "curriculum_governance_hub",
    sourceUri: "https://docs.google.com/spreadsheets/d/15wefqRKZbW4MEXpuuqYcltstr3T9NErieGT_X3U4JjA/edit",
    driveFileId: "15wefqRKZbW4MEXpuuqYcltstr3T9NErieGT_X3U4JjA",
    subject: "RN concept-based curriculum / accreditation alignment",
    edition: "2026 planning source",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      tabs: ["Curriculum Mapping", "Governance", "Validation Rules", "Output Contracts"],
      evidenceSnippets: harrityEvidenceSnippets.curriculumHub,
    },
    createdAt: new Date().toISOString(),
  },
];

const taxonomyTerms = [
  { id: "tax-nclex-phys", taxonomy: "NCLEX", code: "PHYS", label: "Physiological Integrity" },
  { id: "tax-cjm-recognize", taxonomy: "CJM", code: "recognize-cues", label: "Recognize Cues" },
  { id: "tax-cjm-analyze", taxonomy: "CJM", code: "analyze-cues", label: "Analyze Cues" },
  { id: "tax-cjm-action", taxonomy: "CJM", code: "take-action", label: "Take Action" },
  { id: "tax-np-assessment", taxonomy: "Nursing Process", code: "assessment", label: "Assessment" },
  { id: "tax-bloom-apply", taxonomy: "Bloom", code: "apply", label: "Apply" },
];

const packages = [];
const packageDetails = new Map();
const sourceArchiveImports = [];
const sourceArchiveFiles = [];
const lessonGenerationRuns = [];
const lessonPackageArtifacts = [];
const lessonContractValidations = [];
const kbDocuments = [];
const kbChunks = [];
const kbJobs = [];
const extractedTables = [];
const mapperContentBlocks = [];
const previewStudentEvents = [];
const pilotRequests = [
  {
    id: "pilot-request-preview-1",
    status: "new",
    score: 45,
    source: "public_launch_mfp",
    contactName: "Preview Program Lead",
    contactEmail: "preview.lead@example.edu",
    contactPhone: "",
    companyName: "Nursing Program Preview",
    jobTitle: "Course Coordinator",
    industry: "Nursing education",
    interestedTopics: ["Therapeutic Communication", "Clinical Judgment"],
    tags: ["public-launch", "lesson-builder", "pilot-interest"],
    customFields: {
      pilotGoal: "Review the student-facing lesson package and decide whether the content workflow fits an internal course pilot.",
      requestedPath: "public_launch_mfp",
    },
    firstContactDate: new Date().toISOString(),
    lastContactDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
let privacyConsent = null;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const archiveRoleDescriptions = {
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

const defaultPilotArchiveSet = [
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

const textFileExtensions = new Set([".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".xml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py"]);

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function fileExtension(fileName = "") {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

function inferDocumentType(fileName = "", contentType = "") {
  const ext = fileExtension(fileName);
  if (["pdf", "docx", "pptx", "xlsx", "csv", "txt", "md", "json", "jsonl", "zip", "tar"].includes(ext)) return ext;
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("presentation")) return "pptx";
  if (contentType.includes("wordprocessingml")) return "docx";
  if (contentType.includes("spreadsheet")) return "xlsx";
  if (contentType.includes("csv")) return "csv";
  if (contentType.includes("zip")) return "zip";
  if (contentType.includes("tar")) return "tar";
  if (contentType.startsWith("text/")) return "txt";
  return ext || "file";
}

function archiveBaseName(filePath = "") {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath;
}

function classifyArchiveRole(archivePath, entryNames, requestedRole) {
  if (requestedRole) return requestedRole;
  const haystack = [archivePath, ...entryNames.slice(0, 40)].join(" ").toLowerCase();
  if (haystack.includes("harrity_lesson_builder_pipeline") || haystack.includes("harrity-lesson-builder-pipeline")) return "harrity_pipeline_contract";
  if (haystack.includes("nursing-chapter-deck-builder") || haystack.includes("chapter-deck-builder") || haystack.includes("skill(18") || haystack.includes("skill (1)")) return "chapter_deck_schema";
  if (haystack.includes("20260528_ncc_ams_preflight") || haystack.includes("ncc_ams_preflight")) return "pilot_preflight_package";
  if (haystack.includes("chunk-index-retrieval") || haystack.includes("data chunker")) return "chunking_search_pattern";
  if (haystack.includes("nursestudy")) return "base_app";
  return "pattern_reference";
}

function classifyArchiveFile(filePath) {
  const lower = filePath.toLowerCase();
  const ext = path.extname(lower).replace(".", "") || "other";
  let fileRole = "reference";
  if (lower.endsWith("readme.md") || lower.includes("/readme")) fileRole = "readme";
  else if (lower.endsWith("skill.md")) fileRole = "skill_contract";
  else if (lower.includes("schema") || lower.endsWith(".schema.json")) fileRole = "schema";
  else if (lower.includes("manifest")) fileRole = "manifest";
  else if (lower.includes("validate") || lower.includes("qa")) fileRole = "validator";
  else if (lower.includes("template")) fileRole = "template";
  else if (lower.includes("config")) fileRole = "config";
  return { fileKind: ext, fileRole };
}

function summarizeArchiveEntries(archivePath, entryNames, role) {
  const lowerEntries = entryNames.map((entry) => entry.toLowerCase());
  const importantFiles = entryNames.filter((entry) => {
    const lower = entry.toLowerCase();
    return lower.endsWith("readme.md") || lower.endsWith("skill.md") || lower.includes("schema") || lower.includes("manifest") || lower.includes("validate") || lower.includes("config");
  });
  return {
    archiveFileName: archiveBaseName(archivePath),
    role,
    roleDescription: archiveRoleDescriptions[role] || archiveRoleDescriptions.pattern_reference,
    rootFolders: Array.from(new Set(entryNames.map((entry) => entry.split(/[\\/]/)[0]).filter(Boolean))).slice(0, 12),
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

async function importSourceArchive(body) {
  const archiveBuffer = await fs.readFile(body.archivePath);
  const contentHash = stableHash(archiveBuffer);
  const duplicate = sourceArchiveImports.find((job) => job.contentHash === contentHash && job.status !== "failed");
  if (duplicate) {
    const duplicateJob = {
      id: makeId("archive"),
      title: body.title || `${duplicate.title} duplicate`,
      sourceUri: body.archivePath,
      archiveKind: duplicate.archiveKind,
      role: duplicate.role,
      status: "duplicate",
      contentHash,
      fileCount: duplicate.fileCount,
      importedSourceIds: duplicate.importedSourceIds || [],
      summary: { ...(duplicate.summary || {}), duplicateOf: duplicate.id, dedupedAt: nowIso() },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    sourceArchiveImports.unshift(duplicateJob);
    return { importJob: duplicateJob, files: [], sources: [], duplicateOf: duplicate.id };
  }

  const zip = await JSZip.loadAsync(archiveBuffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const entryNames = entries.map((entry) => entry.name);
  const role = classifyArchiveRole(body.archivePath, entryNames, body.role);
  const roleDescription = archiveRoleDescriptions[role] || archiveRoleDescriptions.pattern_reference;
  const summary = summarizeArchiveEntries(body.archivePath, entryNames, role);
  const importJob = {
    id: makeId("archive"),
    title: body.title || roleDescription.label || archiveBaseName(body.archivePath),
    sourceUri: body.archivePath,
    archiveKind: "zip",
    role,
    status: "processing",
    contentHash,
    fileCount: entries.length,
    importedSourceIds: [],
    summary,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  sourceArchiveImports.unshift(importJob);

  const source = {
    id: makeId("src-archive"),
    title: importJob.title,
    sourceKind: "source_archive",
    sourceType: body.sourceType || roleDescription.sourceType,
    sourceUri: body.archivePath,
    subject: roleDescription.subject,
    edition: summary.archiveFileName,
    approvalStatus: body.approvalStatus || "approved",
    ingestionStatus: "ready",
    citationPolicy: role === "harrity_pipeline_contract" ? "contract_validate" : "cite_paraphrase",
    metadata: { archiveImportId: importJob.id, archiveRole: role, archiveSummary: summary, contentHash },
    createdAt: nowIso(),
  };
  sources.unshift(source);

  const files = [];
  for (const entry of entries) {
    const sizeBytes = Number(entry._data?.uncompressedSize || 0);
    const { fileKind, fileRole } = classifyArchiveFile(entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    let extractedText = null;
    if (textFileExtensions.has(ext) && sizeBytes <= 250000) {
      extractedText = compactText(await entry.async("string")).slice(0, 4000);
    }
    const archiveFile = {
      id: makeId("archive-file"),
      importId: importJob.id,
      sourceId: source.id,
      filePath: entry.name,
      fileKind,
      fileRole,
      sizeBytes,
      contentHash: extractedText ? stableHash(extractedText) : undefined,
      extractedText,
      metadata: { date: entry.date?.toISOString?.() },
      createdAt: nowIso(),
    };
    sourceArchiveFiles.push(archiveFile);
    files.push(archiveFile);
  }

  importJob.status = "completed";
  importJob.importedSourceIds = [source.id];
  importJob.summary = { ...summary, sourceRegistryId: source.id, completedAt: nowIso() };
  importJob.updatedAt = nowIso();
  return { importJob, files, sources: [source] };
}

function attachDocumentSource(body) {
  const document = findDocument(body.documentId);
  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  const documentChunks = kbChunks
    .filter((chunk) => chunk.documentId === document.id)
    .sort((a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0));
  const existing = sources.find((source) => source.documentId === document.id) || sources.find((source) => source.id === `src-${document.id}`);
  const now = nowIso();
  const sourcePayload = {
    title: body.title || document.title,
    sourceKind: "document",
    sourceType: body.sourceType || "nursing_content_source",
    sourceUri: document.sourceUri || document.filePath || `knowledge-base:${document.id}`,
    driveFileId: document.driveFileId || document.id,
    documentId: document.id,
    subject: body.subject || document.metadata?.subject || "Nursing source document",
    edition: body.edition || document.metadata?.edition || "Local preview document",
    approvalStatus: body.approvalStatus || "approved",
    ingestionStatus: document.status === "ready" && documentChunks.length ? "ready" : "needs_ingestion",
    citationPolicy: body.citationPolicy || "cite_paraphrase",
    metadata: {
      ...(existing?.metadata || {}),
      attachedFrom: "knowledge_base",
      documentTitle: document.title,
      documentType: document.type,
      documentStatus: document.status,
      chunkCount: documentChunks.length,
      totalPages: document.totalPages || document.pageCount,
      totalTokens: document.totalTokens,
      localFileName: document.title,
      evidenceSnippets: documentChunks
        .map((chunk) => compactText(chunk.cleanText || chunk.content))
        .filter(Boolean)
        .map((text) => text.length > 1200 ? `${text.slice(0, 1200)}...` : text)
        .slice(0, 8),
    },
  };

  if (existing) {
    Object.assign(existing, sourcePayload, { updatedAt: now });
    return { source: existing, document: documentPayload(document), chunkCount: documentChunks.length, created: false };
  }

  const source = {
    id: `src-${document.id}`,
    ...sourcePayload,
    createdAt: now,
    updatedAt: now,
  };
  sources.unshift(source);
  return { source, document: documentPayload(document), chunkCount: documentChunks.length, created: true };
}

async function importPilotArchiveSet(body = {}) {
  const archives = Array.isArray(body.archives) && body.archives.length ? body.archives : defaultPilotArchiveSet;
  const results = [];

  for (const archive of archives) {
    try {
      const result = await importSourceArchive(archive);
      results.push(result);
    } catch (error) {
      const failedJob = {
        id: makeId("archive"),
        title: archive.title || archiveBaseName(archive.archivePath),
        sourceUri: archive.archivePath,
        archiveKind: "zip",
        role: archive.role || classifyArchiveRole(archive.archivePath, [], archive.role),
        status: "failed",
        contentHash: null,
        fileCount: 0,
        importedSourceIds: [],
        summary: { error: error instanceof Error ? error.message : String(error), failedAt: nowIso() },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      sourceArchiveImports.unshift(failedJob);
      results.push({ importJob: failedJob, files: [], sources: [], error: failedJob.summary.error });
    }
  }

  const summary = {
    requested: archives.length,
    completed: results.filter((result) => result.importJob?.status === "completed").length,
    duplicate: results.filter((result) => result.importJob?.status === "duplicate").length,
    failed: results.filter((result) => result.importJob?.status === "failed").length,
    importedSourceIds: results.flatMap((result) => result.importJob?.importedSourceIds || []),
  };

  return { summary, results };
}

function parseXmlText(xml) {
  return compactText(
    xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10))),
  );
}

async function extractOfficeText(buffer, type) {
  const zip = await JSZip.loadAsync(buffer);
  if (type === "pptx") {
    const slidePattern = /^ppt\/slides\/slide(\d+)\.xml$/;
    const notesPattern = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/;
    const partNumber = (name, pattern) => Number(name.match(pattern)?.[1] || Number.MAX_SAFE_INTEGER);
    const files = Object.values(zip.files);
    const notesByNumber = new Map(
      files
        .filter((file) => !file.dir && notesPattern.test(file.name))
        .map((file) => [partNumber(file.name, notesPattern), file]),
    );
    const slideFiles = files
      .filter((file) => !file.dir && slidePattern.test(file.name))
      .sort((a, b) => partNumber(a.name, slidePattern) - partNumber(b.name, slidePattern));
    const slideText = [];

    for (const slideFile of slideFiles) {
      const slideNumber = partNumber(slideFile.name, slidePattern);
      const visibleText = parseXmlText(await slideFile.async("text"));
      const notesFile = notesByNumber.get(slideNumber);
      const notesText = notesFile ? parseXmlText(await notesFile.async("text")) : "";
      slideText.push([
        `Slide ${slideNumber}`,
        visibleText ? `Visible slide text: ${visibleText}` : "",
        notesText ? `Speaker notes: ${notesText}` : "",
      ].filter(Boolean).join(". "));
    }

    return compactText(slideText.join(" "));
  }

  const patterns = type === "pptx"
    ? [/^ppt\/slides\/slide\d+\.xml$/]
    : type === "docx"
      ? [/^word\/document\.xml$/, /^word\/footnotes\.xml$/, /^word\/endnotes\.xml$/]
      : [/^xl\/sharedStrings\.xml$/, /^xl\/worksheets\/sheet\d+\.xml$/];
  const matches = Object.values(zip.files).filter((file) => !file.dir && patterns.some((pattern) => pattern.test(file.name)));
  const xmlParts = await Promise.all(matches.map((file) => file.async("text")));
  return compactText(xmlParts.map(parseXmlText).join(" "));
}

async function extractPreviewText(fileName, contentType, buffer) {
  const type = inferDocumentType(fileName, contentType);
  if (["txt", "md", "csv", "json"].includes(type) || contentType.startsWith("text/")) {
    return compactText(buffer.toString("utf8"));
  }

  if (["docx", "pptx", "xlsx"].includes(type)) {
    try {
      const officeText = await extractOfficeText(buffer, type);
      if (officeText) return officeText;
    } catch {
      // Keep the local preview forgiving for partially repaired or binary-only files.
    }
  }

  const decoded = compactText(buffer.toString("utf8").replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " "));
  if (decoded.split(/\s+/).length >= 12) return decoded.slice(0, 12000);
  return `${fileName || "Uploaded file"} was received by the local knowledge-base intake preview. Full production extraction should run in the database-backed ingestion worker.`;
}

function chunkText(text, maxChars = 900) {
  const normalized = compactText(text);
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized];
  const chunks = [];
  let current = "";

  for (const sentence of sentences.map(compactText).filter(Boolean)) {
    if ((current + " " + sentence).trim().length > maxChars && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [normalized.slice(0, maxChars)];
}

function documentPayload(document) {
  return {
    ...document,
    chunkCount: kbChunks.filter((chunk) => chunk.documentId === document.id).length,
  };
}

function seedKnowledgeBaseFromSources() {
  if (kbDocuments.length) return;

  for (const source of sources) {
    const snippets = Array.isArray(source.metadata?.evidenceSnippets)
      ? source.metadata.evidenceSnippets.map(compactText).filter(Boolean)
      : [];
    if (!snippets.length) continue;

    const documentId = `doc-${source.id}`;
    const createdAt = source.createdAt || nowIso();
    const joined = snippets.join("\n\n");
    const document = {
      id: documentId,
      title: source.metadata?.localFileName || source.title,
      type: inferDocumentType(source.sourceUri || source.title),
      status: "ready",
      sourceUri: source.sourceUri,
      totalPages: source.metadata?.slideCount || source.metadata?.chaptersBuilt || snippets.length,
      totalTokens: Math.ceil(joined.length / 4),
      contentHash: stableHash(`${source.id}:${joined}`),
      metadata: {
        sourceId: source.id,
        sourceTitle: source.title,
        subject: source.subject,
        edition: source.edition,
        approvalStatus: source.approvalStatus,
      },
      uploadedBy: "local-preview",
      createdAt,
      updatedAt: createdAt,
      chunkCount: snippets.length,
      size: Buffer.byteLength(joined),
      filePath: source.sourceUri,
      uploadedAt: createdAt,
      pageCount: source.metadata?.slideCount || source.metadata?.chaptersBuilt || snippets.length,
    };
    kbDocuments.push(document);

    snippets.forEach((text, index) => {
      kbChunks.push({
        id: `chunk-${documentId}-${index + 1}`,
        documentId,
        content: text,
        cleanText: text,
        tokenCount: Math.ceil(text.length / 4),
        chunkIndex: index,
        pageStart: index + 1,
        pageEnd: index + 1,
        topicIds: [],
        tags: [source.subject].filter(Boolean),
        metadata: {
          sourceId: source.id,
          citationLabel: `${source.title}, evidence ${index + 1}`,
        },
        contentHash: stableHash(`${documentId}:${index}:${text}`),
        documentTitle: document.title,
        score: 0.92,
        createdAt,
      });
    });
  }
}

function addDocumentSource(document, documentChunks) {
  const sourceId = `src-${document.id}`;
  const existing = sources.find((source) => source.id === sourceId);
  if (existing) return existing;

  const source = {
    id: sourceId,
    title: document.title,
    sourceKind: document.metadata?.sourceKind || "knowledge_base_upload",
    sourceType: document.metadata?.sourceType || "uploaded_document",
    sourceUri: document.sourceUri || `knowledge-base:${document.id}`,
    driveFileId: document.id,
    documentId: document.id,
    subject: document.metadata?.subject || "Uploaded file intake",
    edition: document.metadata?.edition || "Local preview upload",
    approvalStatus: "approved",
    ingestionStatus: "ready",
    citationPolicy: "cite_paraphrase",
    metadata: {
      intakeDocumentId: document.id,
      contentHash: document.contentHash,
      localFileName: document.title,
      evidenceSnippets: documentChunks
        .map((chunk) => compactText(chunk.cleanText || chunk.content))
        .filter(Boolean)
        .map((text) => text.length > 1200 ? `${text.slice(0, 1200)}...` : text)
        .slice(0, 8),
    },
    createdAt: document.createdAt,
  };
  sources.unshift(source);
  return source;
}

async function indexKnowledgeDocument({ fileName, contentType = "application/octet-stream", buffer, sourceUri }) {
  const createdAt = nowIso();
  const title = fileName || "Untitled upload";
  const type = inferDocumentType(title, contentType);
  const dataChunkerResult = await tryIndexDataChunkerUpload({ fileName: title, contentType, buffer, sourceUri });
  if (dataChunkerResult) return dataChunkerResult;
  const text = await extractPreviewText(title, contentType, buffer);
  const pieces = chunkText(text);
  const documentId = makeId("doc");
  const jobId = makeId("job");
  const contentHash = stableHash(buffer.length ? buffer : text);
  const document = {
    id: documentId,
    title,
    type,
    status: "ready",
    sourceUri: sourceUri || `local-upload:${title}`,
    totalPages: Math.max(1, pieces.length),
    totalTokens: Math.ceil(text.length / 4),
    contentHash,
    metadata: {
      contentType,
      intakeMode: "local-preview",
    },
    uploadedBy: "local-preview",
    createdAt,
    updatedAt: createdAt,
    chunkCount: pieces.length,
    size: buffer.length,
    filePath: sourceUri || `local-upload:${title}`,
    uploadedAt: createdAt,
    pageCount: Math.max(1, pieces.length),
  };
  kbDocuments.unshift(document);

  const documentChunks = pieces.map((piece, index) => ({
    id: makeId("chunk"),
    documentId,
    content: piece,
    cleanText: piece,
    tokenCount: Math.ceil(piece.length / 4),
    chunkIndex: index,
    pageStart: index + 1,
    pageEnd: index + 1,
    topicIds: [],
    tags: [type, "uploaded"].filter(Boolean),
    metadata: {
      contentHash,
      citationLabel: `${title}, chunk ${index + 1}`,
    },
    contentHash: stableHash(`${documentId}:${index}:${piece}`),
    documentTitle: title,
    score: 0.9,
    createdAt,
  }));
  kbChunks.unshift(...documentChunks);

  const source = addDocumentSource(document, documentChunks);
  const job = {
    id: jobId,
    jobId,
    documentId,
    documentTitle: title,
    status: "completed",
    stage: "indexed",
    progress: 100,
    message: "Document indexed and added to lesson-builder sources.",
    error: null,
    startedAt: createdAt,
    completedAt: nowIso(),
    createdAt,
    updatedAt: nowIso(),
    metadata: {
      chunksCreated: documentChunks.length,
      sourceId: source.id,
    },
  };
  kbJobs.unshift(job);
  return { document, documentChunks, job, source };
}

function findDocument(documentId) {
  return kbDocuments.find((document) => document.id === documentId);
}

function searchChunks(query, limit = 10) {
  const terms = compactText(query).toLowerCase().split(/\s+/).filter(Boolean);
  return kbChunks
    .map((chunk) => {
      const haystack = `${chunk.cleanText || chunk.content} ${chunk.documentTitle || ""}`.toLowerCase();
      const hits = terms.length ? terms.filter((term) => haystack.includes(term)).length : 1;
      return {
        ...chunk,
        score: terms.length ? Math.max(0.1, hits / terms.length) : chunk.score || 0.8,
        documentTitle: findDocument(chunk.documentId)?.title || chunk.documentTitle,
      };
    })
    .filter((chunk) => !terms.length || chunk.score > 0.1)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, limit);
}

function inferPreviewSpecialty(text) {
  const lower = compactText(text).toLowerCase();
  if (lower.includes("pediatric") || lower.includes("child") || lower.includes("infant")) return "Pediatrics";
  if (lower.includes("maternal") || lower.includes("newborn") || lower.includes("postpartum")) return "Maternal-Newborn";
  if (lower.includes("mental health") || lower.includes("therapeutic communication")) return "Mental Health";
  if (lower.includes("emergency") || lower.includes("trauma")) return "Emergency";
  if (lower.includes("critical") || lower.includes("icu")) return "Critical Care";
  return "Medical-Surgical";
}

function inferPreviewBodySystem(text) {
  const lower = compactText(text).toLowerCase();
  const matches = [
    ["Cardiovascular", ["cardiac", "heart", "blood pressure", "pulse"]],
    ["Respiratory", ["respiratory", "airway", "oxygen", "wheezing", "breath"]],
    ["Neurological", ["neurologic", "neuro", "brain", "seizure", "stroke"]],
    ["Gastrointestinal", ["gastro", "bowel", "abdomen", "nutrition"]],
    ["Renal/Urinary", ["renal", "urinary", "kidney", "urine"]],
    ["Endocrine", ["endocrine", "diabetes", "glucose", "insulin"]],
  ];
  return matches.find(([, terms]) => terms.some((term) => lower.includes(term)))?.[0];
}

function previewMatches(text, terms) {
  const lower = compactText(text).toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

function analyzePreviewContentBlock(block) {
  const text = `${block.title || ""} ${block.content || ""}`;
  const concepts = previewMatches(text, [
    "Safety",
    "Infection Control",
    "Pain Management",
    "Medication Administration",
    "Patient Education",
    "Therapeutic Communication",
    "Clinical Judgment",
    "Evidence-Based Practice",
  ]);
  const keywords = previewMatches(text, [
    "assessment",
    "intervention",
    "priority",
    "medication",
    "oxygen",
    "infection",
    "teaching",
    "evaluation",
  ]);
  return {
    title: block.title || compactText(block.content).split(/[.\n]/)[0]?.slice(0, 90) || "Mapped nursing content",
    category: concepts[0] || block.category || "Clinical Judgment",
    nursingSpecialty: inferPreviewSpecialty(text),
    bodySystem: inferPreviewBodySystem(text),
    diagnoses: previewMatches(text, ["asthma", "diabetes", "hypertension", "heart failure", "pneumonia"]),
    interventions: previewMatches(text, ["assessment", "monitoring", "teaching", "medication administration", "oxygen therapy"]),
    patientProblems: previewMatches(text, ["pain", "dyspnea", "infection", "hypoxia", "anxiety"]),
    concepts,
    keywords,
    priority: text.toLowerCase().includes("priority") ? "high" : "medium",
    clinicalJudgmentPhase: ["Recognize Cues", "Analyze Cues", "Take Action"],
  };
}

function contentBlockFromChunk(chunk) {
  const document = findDocument(chunk.documentId);
  const text = compactText(chunk.cleanText || chunk.content);
  const title = `${document?.title || chunk.documentTitle || "Knowledge source"} - chunk ${(chunk.chunkIndex || 0) + 1}`;
  return {
    id: makeId("block"),
    documentId: chunk.documentId,
    sourceChunkId: chunk.id,
    content: text,
    contentType: "text",
    source: document?.title || chunk.documentTitle || "Knowledge Base",
    sourceType: document?.type || "knowledge_base",
    title,
    description: text.length > 180 ? `${text.slice(0, 180)}...` : text,
    category: "Imported Source",
    subcategory: null,
    tags: Array.from(new Set([...(chunk.tags || []), "knowledge-base"])),
    difficulty: null,
    nursingSpecialty: null,
    bodySystem: null,
    diagnoses: [],
    interventions: [],
    patientProblems: [],
    concepts: [],
    keywords: [],
    usageCount: 0,
    qualityScore: null,
    version: 1,
    createdAt: chunk.createdAt || nowIso(),
    updatedAt: chunk.createdAt || nowIso(),
    parentId: null,
    relatedIds: [],
    isProcessed: false,
  };
}

function syncContentBlocksForDocument(documentId) {
  const chunks = kbChunks.filter((chunk) => chunk.documentId === documentId);
  const created = [];
  for (const chunk of chunks) {
    if (mapperContentBlocks.some((block) => block.sourceChunkId === chunk.id)) continue;
    const block = contentBlockFromChunk(chunk);
    mapperContentBlocks.unshift(block);
    created.push(block);
  }
  return created;
}

function seedContentBlocksFromKnowledgeBase() {
  if (mapperContentBlocks.length) return;
  for (const document of kbDocuments) syncContentBlocksForDocument(document.id);
}

function filterContentBlocks(url) {
  const unprocessed = url.searchParams.get("unprocessed") === "true";
  const category = url.searchParams.get("category") || "";
  const search = compactText(url.searchParams.get("search") || "").toLowerCase();
  const limit = Number(url.searchParams.get("limit") || 100);
  return mapperContentBlocks
    .filter((block) => !unprocessed || !block.nursingSpecialty)
    .filter((block) => !category || category === "all" || (category === "uncategorized" ? !block.category : block.category === category))
    .filter((block) => !search || `${block.title} ${block.description} ${block.content}`.toLowerCase().includes(search))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, Number.isFinite(limit) ? limit : 100);
}

function applyContentBlockUpdates(block, updates) {
  const allowed = new Set([
    "content",
    "contentType",
    "source",
    "sourceType",
    "title",
    "description",
    "category",
    "subcategory",
    "tags",
    "difficulty",
    "nursingSpecialty",
    "bodySystem",
    "diagnoses",
    "interventions",
    "patientProblems",
    "concepts",
    "keywords",
    "qualityScore",
    "parentId",
    "relatedIds",
  ]);
  const arrays = new Set(["tags", "diagnoses", "interventions", "patientProblems", "concepts", "keywords", "relatedIds"]);
  for (const [key, value] of Object.entries(updates || {})) {
    if (!allowed.has(key)) continue;
    block[key] = arrays.has(key) ? (Array.isArray(value) ? value.map(String).filter(Boolean) : []) : value;
  }
  block.isProcessed = Boolean(block.nursingSpecialty || block.bodySystem || block.concepts?.length);
  block.updatedAt = nowIso();
  return block;
}

const topicProductionAssetLabels = {
  mapping: "Concept + nursing subject",
  slideDeck: "Video lesson slide deck",
  studyGuide: "Study guide",
  visuals: "Visuals",
  quiz: "Quiz item",
  citations: "Source citations",
};

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
};

const topicProductionReviewDecisions = new Set([
  "unreviewed",
  "approve_mapping",
  "needs_edit",
  "build_lesson",
  "needs_visuals",
  "needs_quiz",
  "hold",
]);

const topicProductionNextBuildDecisions = new Set([
  "approve_mapping",
  "build_lesson",
  "needs_visuals",
  "needs_quiz",
]);

const topicProductionReviewOverrides = new Map();
const topicProductionMediaWorkOrderReviewOverrides = new Map();
const topicProductionMediaScaffoldReviewOverrides = new Map();
const topicProductionMediaTextDraftReviewOverrides = new Map();
const topicProductionPackageReviewBlueprintOverrides = new Map();
const topicProductionDraftReviewDecisions = new Set(["unreviewed", "approve_polish", "needs_fix", "hold"]);
const topicProductionPhaseThreeDecisions = new Set([
  "unreviewed",
  "approve_polish_pass",
  "approve_short_planning",
  "needs_fix",
  "hold_spend",
]);
const topicProductionStudentLaunchDecisions = new Set([
  "unreviewed",
  "approve_student_preview",
  "needs_fix",
  "hold_release",
]);
const topicProductionMediaWorkOrderDecisions = new Set([
  "unreviewed",
  "approve_single_topic_scaffold",
  "needs_revision",
  "hold_spend",
]);
const topicProductionMediaScaffoldReviewDecisions = new Set([
  "unreviewed",
  "approve_ai_draft_checkpoint",
  "needs_revision",
  "hold_spend",
]);
const topicProductionMediaTextDraftReviewDecisions = new Set([
  "unreviewed",
  "approve_package_assembly_checkpoint",
  "needs_revision",
  "hold_spend",
]);
const topicProductionPackageReviewBlueprintDecisions = new Set([
  "unreviewed",
  "approve_review_package_build",
  "needs_revision",
  "hold_spend",
]);
const topicProductionPreviewReviewOutcomes = new Set([
  "ready_for_release",
  "needs_fix",
  "hold_release",
]);
const topicProductionPublicReleaseDecisions = new Set([
  "approve_public_release",
  "needs_fix",
  "hold_release",
]);

function compactTopicKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function topicProductionRowKey(sourceType, id) {
  return `${sourceType}:${id}`;
}

function defaultTopicProductionReview() {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionMediaWorkOrderReview() {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionMediaScaffoldReview() {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionMediaTextDraftReview() {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function defaultTopicProductionPackageReviewBlueprintReview() {
  return {
    decision: "unreviewed",
    reviewerNotes: "",
    reviewedAt: null,
    reviewedBy: "",
  };
}

function normalizeTopicProductionReview(value) {
  if (!value || !topicProductionReviewDecisions.has(value.decision)) {
    return defaultTopicProductionReview();
  }
  return {
    decision: value.decision,
    reviewerNotes: compactText(value.reviewerNotes || ""),
    reviewedAt: typeof value.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: compactText(value.reviewedBy || ""),
  };
}

function normalizeTopicProductionMediaWorkOrderReview(value) {
  if (!value || !topicProductionMediaWorkOrderDecisions.has(value.decision)) {
    return defaultTopicProductionMediaWorkOrderReview();
  }
  return {
    decision: value.decision,
    reviewerNotes: compactText(value.reviewerNotes || ""),
    reviewedAt: typeof value.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: compactText(value.reviewedBy || ""),
  };
}

function normalizeTopicProductionMediaScaffoldReview(value) {
  if (!value || !topicProductionMediaScaffoldReviewDecisions.has(value.decision)) {
    return defaultTopicProductionMediaScaffoldReview();
  }
  return {
    decision: value.decision,
    reviewerNotes: compactText(value.reviewerNotes || ""),
    reviewedAt: typeof value.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: compactText(value.reviewedBy || ""),
  };
}

function normalizeTopicProductionMediaTextDraftReview(value) {
  if (!value || !topicProductionMediaTextDraftReviewDecisions.has(value.decision)) {
    return defaultTopicProductionMediaTextDraftReview();
  }
  return {
    decision: value.decision,
    reviewerNotes: compactText(value.reviewerNotes || ""),
    reviewedAt: typeof value.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: compactText(value.reviewedBy || ""),
  };
}

function normalizeTopicProductionPackageReviewBlueprintReview(value) {
  if (!value || !topicProductionPackageReviewBlueprintDecisions.has(value.decision)) {
    return defaultTopicProductionPackageReviewBlueprintReview();
  }
  return {
    decision: value.decision,
    reviewerNotes: compactText(value.reviewerNotes || ""),
    reviewedAt: typeof value.reviewedAt === "string" ? value.reviewedAt : null,
    reviewedBy: compactText(value.reviewedBy || ""),
  };
}

function topicProductionReviewForRow(sourceType, id, fallback) {
  return topicProductionReviewOverrides.get(topicProductionRowKey(sourceType, id))
    || normalizeTopicProductionReview(fallback);
}

function topicProductionMediaWorkOrderId(sourceId) {
  return `media-work-order-${sourceId}`;
}

function topicProductionMediaWorkOrderReviewForId(workOrderId, fallback) {
  return topicProductionMediaWorkOrderReviewOverrides.get(topicProductionRowKey("media_work_order", workOrderId))
    || normalizeTopicProductionMediaWorkOrderReview(fallback);
}

function topicProductionMediaScaffoldReviewForId(workOrderId, fallback) {
  return topicProductionMediaScaffoldReviewOverrides.get(topicProductionRowKey("media_scaffold", workOrderId))
    || normalizeTopicProductionMediaScaffoldReview(fallback);
}

function topicProductionMediaTextDraftReviewForId(workOrderId, fallback) {
  return topicProductionMediaTextDraftReviewOverrides.get(topicProductionRowKey("media_text_draft", workOrderId))
    || normalizeTopicProductionMediaTextDraftReview(fallback);
}

function topicProductionPackageReviewBlueprintForId(workOrderId, fallback) {
  return topicProductionPackageReviewBlueprintOverrides.get(topicProductionRowKey("package_review_blueprint", workOrderId))
    || normalizeTopicProductionPackageReviewBlueprintReview(fallback);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const found = value.find((item) => typeof item === "string" && item.trim());
      if (found) return found.trim();
    }
  }
  return "";
}

function topicProductionDriveAssetsForRow(row) {
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

function topicProductionDriveProjectPayload(rows) {
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
];

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
];

const topicProductionHumanReviewCatalogTopics = [
  "Maternal-Newborn Lesson Guide",
  "Pediatrics Asthma",
  "Postpartum Hemorrhage Priorities",
  "Newborn Assessment Cues",
  "Pediatric Emergency Priorities",
];

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

function topicProductionIsGenericLabel(value) {
  return /^(imported source|source|knowledge source|mapped nursing content|slide deck import)$/i.test(String(value || "").trim());
}

function topicProductionHumanizeLabel(value) {
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

function topicProductionBlockText(block) {
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

function topicProductionInferredBlockTopic(block) {
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

function topicProductionInferredBlockConcept(block) {
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

function topicProductionInferredBlockSubject(block) {
  const existing = firstString(block.nursingSpecialty, block.sourceType === "pptx" ? "Slide deck import" : "");
  if (existing && !topicProductionIsGenericLabel(existing)) return existing;
  const lower = topicProductionBlockText(block).toLowerCase();
  if (/maternal|newborn|postpartum|contraception|pregnan|labor|fetal/.test(lower)) return "Maternal-Newborn";
  if (/asthma|pediatric|paediatric|child|children|infant/.test(lower)) return "Pediatrics";
  if (/concept.*curriculum|curriculum.*concept|data hub/.test(lower)) return "Curriculum Planning";
  if (/lesson[_\s-]*builder|harrity[_\s-]*builder|skill[_\s-]*overview|improvement[_\s-]*spec/.test(lower)) return "Builder Operations";
  return "";
}

function previewArtifactMatches(artifact, pattern) {
  return pattern.test([
    artifact?.artifactKey,
    artifact?.artifactType,
    artifact?.fileName,
    artifact?.mimeType,
    artifact?.metadata ? JSON.stringify(artifact.metadata) : "",
  ].filter(Boolean).join(" "));
}

function previewHasVisualSignals(detail) {
  if ((detail.artifacts || []).some((artifact) => previewArtifactMatches(artifact, /visual|image|diagram|chart|graphic|illustration/i))) return true;
  return (detail.slides || []).some((slide) => /visual|image|diagram|chart|graphic|illustration|concept map|table/i.test(JSON.stringify(slide.visibleContent || {})));
}

function topicProductionStatus(missing) {
  if (missing.length === 0) return "ready";
  if (missing.includes("mapping")) return "needs_mapping";
  return "needs_assets";
}

function topicProductionNextAction(status, missing) {
  if (status === "ready") return "Ready for student-facing release and optional shorts/video production.";
  if (missing.includes("mapping")) return "Map concept and nursing subject before production.";
  if (missing.includes("slideDeck")) return "Generate or attach the related lesson slide deck.";
  if (missing.includes("studyGuide")) return "Add guided notes or study guide artifact.";
  if (missing.includes("visuals")) return "Add visual prompts, diagrams, or verified slide visuals.";
  if (missing.includes("quiz")) return "Add at least one practice item with rationale.";
  if (missing.includes("citations")) return "Attach source-backed citations.";
  return "Review production assets.";
}

function topicProductionPlacementForDetail(pkg, status, missing) {
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

function topicProductionPlacementForBlock(status, missing) {
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

function topicProductionRowFromDetail(detail) {
  const pkg = detail.package || {};
  const manifest = pkg.manifest || {};
  const taxonomySnapshot = pkg.taxonomySnapshot || {};
  const topicProductionMeta = manifest.topicProduction || taxonomySnapshot.topicProduction || {};
  const assessmentBridge = manifest.assessmentBridge || taxonomySnapshot.assessmentBridge || {};
  const itemTags = (detail.items || []).flatMap((item) => {
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
  const specialty = firstString(
    topicProductionMeta.nursingSubject,
    taxonomySnapshot.nursingSpecialty,
    taxonomySnapshot.subject,
    (detail.sources || []).map((source) => source.subject),
    assessmentBridge.atiCategory
  );
  const sourceEvidence = firstString(assessmentBridge.sourceEvidence, (detail.sources || []).map((source) => source.title));
  const assets = {
    mapping: Boolean(concept && specialty),
    slideDeck: (detail.slides || []).length > 0,
    studyGuide: (detail.slides || []).some((slide) => Boolean(String(slide.guidedNotes || "").trim()))
      || (detail.artifacts || []).some((artifact) => previewArtifactMatches(artifact, /guided|study[_ -]?guide|student[_ -]?notes/i)),
    visuals: previewHasVisualSignals(detail),
    quiz: (detail.items || []).length >= 1,
    citations: (detail.citations || []).length >= 1,
  };
  const missing = Object.entries(assets).filter(([, value]) => !value).map(([key]) => key);
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
    weakTopic: assessmentBridge.weakTopic || topicProductionMeta.weakTopic || "",
    nclexCategory: assessmentBridge.nclexCategory || topicProductionMeta.nclexCategory || firstString((detail.slides || []).map((slide) => slide.nclexCategory)),
    cjmStep: assessmentBridge.cjmStep || topicProductionMeta.cjmStep || firstString((detail.slides || []).map((slide) => slide.cjmStep)),
    sourceEvidence,
    review: manifest.topicProductionReview,
    assets,
    missing,
    missingLabels: missing.map((key) => topicProductionAssetLabels[key]),
    placement: topicProductionPlacementForDetail(pkg, status, missing),
    counts: {
      slides: (detail.slides || []).length,
      studyGuideSlides: (detail.slides || []).filter((slide) => Boolean(String(slide.guidedNotes || "").trim())).length,
      quizItems: (detail.items || []).length,
      citations: (detail.citations || []).length,
      artifacts: (detail.artifacts || []).length,
    },
    nextAction: topicProductionNextAction(status, missing),
    updatedAt: pkg.updatedAt || pkg.createdAt,
  };
}

function topicProductionRowFromBlock(block) {
  const inferredTopic = topicProductionInferredBlockTopic(block);
  const concept = topicProductionInferredBlockConcept(block);
  const specialty = topicProductionInferredBlockSubject(block);
  const assets = {
    mapping: Boolean(concept && specialty),
    slideDeck: false,
    studyGuide: false,
    visuals: false,
    quiz: false,
    citations: false,
  };
  const missing = Object.entries(assets).filter(([, value]) => !value).map(([key]) => key);
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
    weakTopic: "",
    nclexCategory: "",
    cjmStep: "",
    sourceEvidence: block.source || "",
    assets,
    missing,
    missingLabels: missing.map((key) => topicProductionAssetLabels[key]),
    placement: topicProductionPlacementForBlock(status, missing),
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

function topicProductionRollupRows(rows) {
  const groups = new Map();
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
      sourceType: "content_block",
      title: sourceEvidence,
      status,
      assets,
      missing,
      missingLabels: missing.map((key) => topicProductionAssetLabels[key]),
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

function topicProductionPhaseTwoCandidateRows(existingRows = []) {
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
        sourceType: "topic_candidate",
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
        missingLabels: missing.map((key) => topicProductionAssetLabels[key]),
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
        updatedAt: nowIso(),
      };
    });
}

function topicProductionMatrixPayload() {
  const packageRows = Array.from(packageDetails.values()).map(topicProductionRowFromDetail);
  const packagedTopics = new Set(packageRows.map((row) => compactTopicKey(row.topic)));
  const blockRows = topicProductionRollupRows(mapperContentBlocks
    .filter((block) => !packagedTopics.has(compactTopicKey(block.category || block.title)))
    .slice(0, 75)
    .map(topicProductionRowFromBlock));
  const candidateRows = topicProductionPhaseTwoCandidateRows([...packageRows, ...blockRows]);
  const rows = [...packageRows, ...blockRows, ...candidateRows].map(topicProductionDecoratedRow);
  const statusCounts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const assetCounts = Object.keys(topicProductionAssetLabels).reduce((acc, key) => {
    acc[key] = rows.filter((row) => Boolean(row.assets[key])).length;
    return acc;
  }, {});
  return {
    rows,
    summary: {
      totalTopics: rows.length,
      ready: statusCounts.ready || 0,
      needsMapping: statusCounts.needs_mapping || 0,
      needsAssets: statusCounts.needs_assets || 0,
      packageRows: packageRows.length,
      contentBlockRows: blockRows.length,
      candidateRows: candidateRows.length,
      assetCounts,
      requiredAssets: topicProductionAssetLabels,
    },
    driveProject: topicProductionDriveProjectPayload(rows),
    airtableTracker: topicProductionAirtableTrackerPayload(),
    phaseOneCheckpoint: topicProductionPhaseOneCheckpoint(rows),
    generatedAt: nowIso(),
  };
}

function topicProductionAirtableStage(row) {
  if (row.status === "ready") return "ready_for_review";
  if (row.status === "needs_mapping") return "taxonomy_mapping";
  return "asset_build";
}

function topicProductionShortHook(row) {
  const topic = row.topic || row.title || "this nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  return `Stop memorizing ${topic}. Learn the ${concept} cue that changes the nursing action.`;
}

function topicProductionShortScript(row) {
  const topic = row.topic || row.title || "this nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  const subject = row.nursingSubject || "nursing";
  return [
    `If ${topic} keeps showing up in practice questions, do not start by memorizing facts.`,
    `Start with the ${concept} cue, connect it to ${subject}, then choose the safest next nursing action.`,
    "Open the full NurseStudy lesson for the deck, guided notes, rationale, and source-backed quiz practice.",
  ].join(" ");
}

function topicProductionDecoratedRow(row) {
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

function topicProductionPhaseOneCheckpoint(rows) {
  const findRow = (subjectKey) => {
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

function topicProductionPhaseOneStarterSubject(row) {
  const text = compactText(`${row.topic || ""} ${row.title || ""}`).toLowerCase();
  if (text.includes("maternal-newborn lesson guide") || text.includes("maternal newborn lesson guide")) return "Maternal-Newborn";
  if (text.includes("pediatrics asthma") || text.includes("asthma")) return "Pediatrics";
  return "";
}

function topicProductionAirtableRows(rows) {
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

function topicProductionAirtableCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionBuildBrief(row, assetKey) {
  const topic = row.topic || row.title || "Selected nursing topic";
  const concept = row.concept || row.weakTopic || "clinical judgment";
  const subject = row.nursingSubject || "nursing";
  const briefs = {
    slideDeck: `Build a concise learner-facing deck for ${topic}: cue recognition, ${concept} explanation, safe nursing action, common trap, and retrieval prompt.`,
    studyGuide: `Create guided notes for ${topic} with fill-in cues, priority decision prompts, and a one-page review summary for ${subject}.`,
    visuals: `Add simple visuals only where they clarify ${topic}: cue map, decision flow, comparison table, or medication/safety diagram.`,
    quiz: `Create at least one NCLEX-style item with answer, rationale, why-wrong options, ${concept} tag, and CJM step.`,
    citations: `Attach source-backed citations from the selected source chunks and keep excerpts short, paraphrased, and learner-safe.`,
  };
  return briefs[assetKey] || "";
}

function topicProductionTemplateDraft(row) {
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

function topicProductionPacketReadiness(row, assetPlan, templateDraft) {
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

function topicProductionCoverageContract(row, draftPackage, assetPlan) {
  const assetStatus = (assetKey) => {
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
      studentSurface: draftPackage ? `/student/study-pack` : "Study Pack after lesson is opened or saved",
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

function topicProductionSourceTokens(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !["source", "lesson", "guide", "package"].includes(token));
}

function topicProductionMatchedSource(row, sourceRecords = sources) {
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

function topicProductionDraftTopicKey(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/\b(template|draft|lesson|guide|package)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function topicProductionPreviewKey(existing) {
  const current = typeof existing === "string" ? existing.trim() : "";
  return current.length >= 16 ? current : crypto.randomBytes(18).toString("base64url");
}

function topicProductionPreviewAllowed(pkg, previewKey) {
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

function topicProductionDraftSummary(record) {
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
    updatedAt: pkg.updatedAt || pkg.createdAt || nowIso(),
  };
}

function topicProductionPreviewReviewSummary(record) {
  const draft = topicProductionDraftSummary(record);
  if (!draft) return null;

  return {
    status: draft.reviewPassedCount === draft.reviewTotalCount ? "ready_for_human_review" : "needs_admin_fix",
    passedCount: draft.reviewPassedCount,
    totalCount: draft.reviewTotalCount,
    checklist: draft.reviewChecklist.map((check) => ({
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

function topicProductionExistingDraft(row, draftRecords = Array.from(packageDetails.values())) {
  const topic = row.topic || row.title || "";
  const expectedTitle = `${topic} Template Draft`.toLowerCase();
  const topicKey = topicProductionDraftTopicKey(topic);
  return draftRecords
    .map(topicProductionDraftSummary)
    .filter(Boolean)
    .find((summary) => {
      const title = String(summary.title || "").toLowerCase();
      const summaryTopicKey = topicProductionDraftTopicKey(summary.topic || summary.title);
      return title === expectedTitle || (title.includes("template draft") && topicKey && summaryTopicKey.includes(topicKey));
    }) || null;
}

function topicProductionBuildPackets(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
  return rows.map((row, index) => {
    const topic = row.topic || row.title || "Selected nursing topic";
    const concept = row.concept || row.weakTopic || "";
    const subject = row.nursingSubject || "";
    const assetPlan = Object.keys(topicProductionAssetLabels).map((assetKey) => ({
      assetKey,
      asset: topicProductionAssetLabels[assetKey],
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

function topicProductionBuildPacketRows(packets) {
  return packets.flatMap((packet) => packet.assetPlan.map((asset) => ({
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
    "Drive Project Assets": (packet.driveProjectAssets || []).map((asset) => asset.title).join(" | "),
    "Drive Asset Links": (packet.driveProjectAssets || []).map((asset) => asset.url).join(" | "),
    "Chunk Count": packet.chunkCount,
    "Asset": asset.asset,
    "Asset Status": asset.status,
    "Belongs In": asset.belongsIn,
    "Build Brief": asset.brief,
    "Coverage Status": (packet.coverageContract?.rows || []).find((item) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.status || "",
    "Coverage Proof": (packet.coverageContract?.rows || []).find((item) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.proof || "",
    "Student Surface": (packet.coverageContract?.rows || []).find((item) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.studentSurface || "",
    "Admin Surface": (packet.coverageContract?.rows || []).find((item) => item.key === (asset.assetKey === "slideDeck" ? "lessonDeck" : asset.assetKey))?.adminSurface || "",
    "Coverage Summary": packet.coverageContract ? `${packet.coverageContract.readyCount}/${packet.coverageContract.totalCount} reviewable; student ready ${packet.coverageContract.studentReady ? "yes" : "no"}` : "",
    "Video/Shorts Status": (packet.coverageContract?.rows || []).find((item) => item.key === "videoShorts")?.status || "",
    "Short Hook": packet.shortsStarter.hook || "",
    "Short Script Draft": packet.shortsStarter.scriptDraft || "",
    "Template Slide Outline": (packet.templateDraft?.slideOutline || []).map((slide) => slide.title).join(" | "),
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
    "Readiness Checks": (packet.readiness?.checks || []).map((check) => `${check.label}: ${check.passed ? "pass" : "needs review"}`).join(" | "),
    "Review Gate": packet.humanReviewGate.join(" | "),
    "Source Evidence": packet.sourceEvidence,
    "Cost Guardrail": packet.costGuardrail,
  })));
}

function topicProductionBuildPacketsCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionHumanReviewCatalogRows(rows) {
  const rank = (row) => {
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

function topicProductionHumanReviewPackRows(rows) {
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
      "Drive Project Assets": driveAssets.map((asset) => asset.title).join(" | "),
      "Drive Asset Links": driveAssets.map((asset) => asset.url).join(" | "),
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

function topicProductionHumanReviewPackCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionMediaPilotPackRows(rows) {
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
        "Drive Project Assets": driveAssets.map((asset) => asset.title).join(" | "),
        "Drive Asset Links": driveAssets.map((asset) => asset.url).join(" | "),
        "Hold Trigger": "Hold if the topic placement, concept, specialty, source evidence, quiz rationale, or learner value is unclear.",
        "Cost Guardrail": "Planning and placement only. Keep this checkpoint inside $100-$500; do not run media generation until a single row is explicitly approved.",
      };
    });
}

function topicProductionMediaPilotPackCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
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

function topicProductionMediaWorkOrderRows(rows) {
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

function topicProductionMediaWorkOrderCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionMediaScaffoldPackRows(rows) {
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

function topicProductionMediaScaffoldPackCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionMediaTextDraftPackRows(rows) {
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

function topicProductionMediaTextDraftPackCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionPackageAssemblyPackRows(rows) {
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

function topicProductionPackageAssemblyPackCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionPackageReviewBlueprintRows(rows) {
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

function topicProductionPackageReviewBlueprintCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

const topicProductionReviewPackageFileNames = [
  "review_manifest.json",
  "learner_slides.md",
  "guided_notes.md",
  "practice_item.md",
  "citations.md",
  "creator_review_checklist.md",
];

function topicProductionReviewPackageSlug(value) {
  const slug = String(value || "review-package")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "review-package";
}

function topicProductionReviewPackageFiles(blueprint) {
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
  };
}

function topicProductionReviewPackageBuildRows(rows) {
  return topicProductionPackageReviewBlueprintRows(rows)
    .filter((blueprint) => blueprint["Blueprint Review Decision"] === "approve_review_package_build"
      && blueprint["Build Approval Status"] === "approved_for_deterministic_review_package_build")
    .map((blueprint) => {
      const files = topicProductionReviewPackageFiles(blueprint);
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

function topicProductionReviewPackageBuildCsv(rows) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

async function topicProductionReviewPackageBuildZip(rows) {
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

function topicProductionReviewPackageDraftSlides(record) {
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
    id: makeId("slide"),
    slideNumber: index + 1,
    slideType: slideTypes[index] || "review_slide",
    title: heading,
    visibleContent: {
      heading,
      studentFocus: `${weakTopic} in ${topic}`,
      cueToAction: `Connect ${concept} cues to the safest nursing action.`,
      examAnchor: nclexCategory,
      learningMoment: index === 1
        ? "Predict which cue changes the nursing priority before reading the teaching point."
        : index === 6
          ? "Use the rationale to explain why the safest answer reduces risk."
          : "Use the evidence to move from cue recognition to clinical judgment.",
    },
    speakerNotes: "Creator review draft generated from Phase 9 review-package files. Confirm clinical accuracy and source traceability before QA or publish.",
    guidedNotes: "Cue: ____________________ Meaning: ____________________ First action: ____________________ Evidence: ____________________",
    retrievalPrompt: index === 0
      ? `What cue makes ${topic} a priority?`
      : index === 5
        ? "Answer the practice item before reading the rationale."
        : `How does this slide support ${cjmStep}?`,
    nclexCategory,
    cjmStep,
    nursingProcess: index < 3 ? "Assessment" : index < 6 ? "Planning" : "Evaluation",
    bloomLevel: "Apply",
    createdAt: nowIso(),
  }));
}

function topicProductionReviewPackageDraftItem(record, practiceSlide) {
  const topic = String(record["Topic"] || "Clinical judgment priority decision");
  const nclexCategory = String(record["NCLEX Category"] || "Physiological Integrity");
  const cjmStep = String(record["CJM Step"] || "Analyze Cues");
  return {
    id: makeId("item"),
    itemType: "multiple_choice",
    slideId: practiceSlide?.id,
    stem: `A nursing student is reviewing ${topic}. Which action best supports safe clinical judgment?`,
    options: [
      { id: "A", text: "Identify the priority cue and connect it to the safest first nursing action." },
      { id: "B", text: "Choose the option that sounds familiar even if it does not address the cue." },
      { id: "C", text: "Delay assessment until all teaching has been completed." },
      { id: "D", text: "Focus on documentation before deciding whether the patient is stable." },
    ],
    correctAnswer: "A",
    rationale: `The safest answer starts with the priority cue, connects it to ${cjmStep}, and selects the nursing action that best reduces risk for ${topic}.`,
    tags: { nclexCategory, cjmStep, nursingProcess: "Assessment", bloomLevel: "Apply", source: "phase_9_review_package_build" },
    difficulty: "application",
    createdAt: nowIso(),
  };
}

function findTopicProductionReviewDraft(workOrderId) {
  const draftPhases = new Set([
    "phase_10_unpublished_lesson_builder_draft",
    "phase_11_creator_qa_gate",
    "phase_13_controlled_preview_decision",
    "phase_14_controlled_preview_review",
  ]);
  return Array.from(packageDetails.values()).find((detail) => draftPhases.has(detail.package.manifest?.topicProduction?.phase)
    && detail.package.manifest?.topicProduction?.reviewPackageWorkOrderId === workOrderId
    && detail.package.status !== "published"
    && detail.package.manifest?.topicProduction?.publishStatus !== "published");
}

function promoteTopicProductionReviewPackageDraft(record) {
  const workOrderId = String(record["Approved Work Order ID"] || "");
  const existing = findTopicProductionReviewDraft(workOrderId);
  if (existing) return { detail: existing, created: false };

  const id = makeId("pkg");
  const title = String(record["Lesson Package Title"] || `${record["Topic"] || "Untitled topic"}: NurseStudy Review Package`);
  const topic = String(record["Topic"] || "Clinical judgment priority decision");
  const slides = topicProductionReviewPackageDraftSlides(record).map((slide) => ({ ...slide, packageId: id }));
  const practiceSlide = slides.find((slide) => slide.slideType === "practice_item") || slides[0];
  const item = { ...topicProductionReviewPackageDraftItem(record, practiceSlide), packageId: id };
  const sourceEvidence = String(record["Review Manifest"] || record["Citations"] || record["Cost Guardrail"] || "");
  const reviewDocumentId = `topic-production-review-package:${workOrderId || topicProductionReviewPackageSlug(title)}`;
  const citations = slides.map((slide, index) => ({
    id: makeId("cit"),
    packageId: id,
    slideId: slide.id,
    documentId: reviewDocumentId,
    chunkId: `${reviewDocumentId}:slide:${slide.slideNumber}`,
    citationLabel: "Topic Production Phase 9 Review Bundle",
    excerpt: compactText(sourceEvidence || `Review bundle evidence for ${topic}.`).slice(0, 320),
    relevanceScore: "0.7500",
    createdAt: nowIso(),
    ...(index === 5 ? { itemId: item.id } : {}),
  }));
  citations.push({
    id: makeId("cit"),
    packageId: id,
    slideId: practiceSlide?.id,
    itemId: item.id,
    documentId: reviewDocumentId,
    chunkId: `${reviewDocumentId}:practice-item`,
    citationLabel: "Topic Production Phase 9 Practice Blueprint",
    excerpt: compactText(String(record["Practice Item"] || `Practice blueprint for ${topic}.`)).slice(0, 320),
    relevanceScore: "0.7500",
    createdAt: nowIso(),
  });
  const taxonomySnapshot = {
    topicProduction: {
      concept: record["Concept"],
      nursingSubject: record["Nursing Subject"],
      weakTopic: record["Weak Topic"],
      nclexCategory: record["NCLEX Category"],
      cjmStep: record["CJM Step"],
    },
  };
  const lessonPackage = {
    id,
    title,
    topic,
    audience: "Prelicensure RN",
    status: "draft",
    sourceIds: [],
    taxonomySnapshot,
    deckModel: {
      packageId: id,
      title,
      topic,
      audience: "Prelicensure RN",
      slides,
      generation: {
        usedMode: "deterministic_review_package_promotion",
        sourceQueue: "phase_9_review_package_builds",
        aiCalls: 0,
        mediaGenerated: false,
      },
    },
    manifest: {
      packageId: id,
      title,
      topic,
      generatedAt: nowIso(),
      sourceIds: [],
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
    },
    qaSummary: {
      status: "creator_review_required",
      passCount: 0,
      warningCount: 0,
      failCount: 0,
      reason: "Promoted from Phase 9 review package; QA, publish, and media remain blocked until creator review.",
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const detail = {
    package: lessonPackage,
    sources: [],
    slides,
    items: [item],
    citations,
    qaResults: [],
    generationRuns: [],
    artifacts: [],
    contractValidations: [],
    reviews: [],
    assignments: [],
    learnerEvents: [],
    releaseAuditEvents: [],
  };
  packages.unshift(lessonPackage);
  packageDetails.set(id, detail);
  return { detail, created: true };
}

function repairTopicProductionReviewDraftForCreatorQa(detail, workOrderId) {
  const reviewDocumentId = `topic-production-review-package:${workOrderId || detail.package.id}`;
  const slideNumberById = new Map(detail.slides.map((slide) => [slide.id, slide.slideNumber]));
  for (const slide of detail.slides) {
    slide.visibleContent = {
      ...(slide.visibleContent || {}),
      learningMoment: slide.slideNumber === 2
        ? "Predict which cue changes the nursing priority before reading the teaching point."
        : slide.slideNumber === 7
          ? "Use the rationale to explain why the safest answer reduces risk."
          : "Use the evidence to move from cue recognition to clinical judgment.",
    };
  }
  for (const citation of detail.citations) {
    const slideNumber = citation.slideId ? slideNumberById.get(citation.slideId) : null;
    citation.documentId = citation.documentId || reviewDocumentId;
    citation.chunkId = citation.chunkId || `${reviewDocumentId}:${citation.itemId ? "practice-item" : slideNumber ? `slide:${slideNumber}` : `citation:${citation.id}`}`;
  }
}

function runTopicProductionCreatorQaGate(workOrderId) {
  const detail = findTopicProductionReviewDraft(workOrderId);
  if (!detail) return null;

  repairTopicProductionReviewDraftForCreatorQa(detail, workOrderId);
  const qa = runPreviewQa(detail);
  const validation = validateLessonContract(detail, "harrity");
  const qaFailCount = Number(qa.qaSummary.failCount || 0);
  const contractFailCount = Number(validation.validationSummary.failCount || 0);
  const qaWarningCount = Number(qa.qaSummary.warningCount || 0);
  const contractWarningCount = Number(validation.validationSummary.warningCount || 0);
  const readyForControlledPreview = qaFailCount === 0 && contractFailCount === 0;
  const creatorQaGate = {
    phase: "phase_11_creator_qa_gate",
    reviewPackageWorkOrderId: workOrderId,
    packageId: detail.package.id,
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
    reviewedBy: "local-preview",
    checkedAt: nowIso(),
  };

  detail.package.manifest = {
    ...(detail.package.manifest || {}),
    topicProduction: {
      ...(detail.package.manifest?.topicProduction || {}),
      phase: "phase_11_creator_qa_gate",
      reviewPackageWorkOrderId: workOrderId,
      creatorQaGate,
      publishStatus: "not_published",
      mediaStatus: "not_started",
      costGuardrail: creatorQaGate.costGuardrail,
    },
  };
  detail.package.updatedAt = nowIso();
  return { detail, qa, validation, creatorQaGate };
}

function saveTopicProductionControlledPreviewDecision(workOrderId, decision, reviewerNotes = "") {
  const detail = findTopicProductionReviewDraft(workOrderId);
  if (!detail) return null;

  const topicProduction = detail.package.manifest?.topicProduction || {};
  const creatorQaGate = topicProduction.creatorQaGate || {};
  const blockers = [
    creatorQaGate.status !== "ready_for_controlled_preview" ? "Creator QA gate is not ready for controlled preview" : "",
    detail.package.status !== "qa_ready" && detail.package.status !== "published" ? "Package is not QA-ready" : "",
    Number(detail.package.qaSummary?.failCount || 0) > 0 ? "QA has failures" : "",
    detail.slides.length < 5 ? "Lesson deck is too small for controlled preview" : "",
    detail.items.length < 1 ? "Practice item is missing" : "",
    detail.citations.length < detail.slides.length ? "Citations are incomplete" : "",
  ].filter(Boolean);

  if (decision === "approve_student_preview" && blockers.length) {
    return { detail, blocked: true, blockers };
  }

  const previousDecision = detail.package.manifest?.topicProductionStudentLaunchDecision || {};
  const previewKey = decision === "approve_student_preview"
    ? topicProductionPreviewKey(previousDecision.previewKey)
    : null;
  const studentLaunchDecision = {
    decision,
    reviewerNotes: compactText(reviewerNotes),
    reviewedAt: nowIso(),
    reviewedBy: "local-preview@nurseprep.app",
    previewKey,
    previewReview: previousDecision.previewReview || null,
  };
  const controlledPreviewDecision = {
    phase: "phase_13_controlled_preview_decision",
    reviewPackageWorkOrderId: workOrderId,
    packageId: detail.package.id,
    decision,
    previewKeyStatus: previewKey ? "active" : "not_created",
    studentPreviewUrl: previewKey ? `/lessons/${detail.package.id}?previewKey=${encodeURIComponent(previewKey)}` : "",
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

  detail.package.manifest = {
    ...(detail.package.manifest || {}),
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
  detail.package.updatedAt = nowIso();
  return {
    detail,
    blocked: false,
    blockers,
    studentLaunchDecision,
    controlledPreviewDecision,
  };
}

function saveTopicProductionControlledPreviewReview(workOrderId, outcome, reviewerNotes = "") {
  const detail = findTopicProductionReviewDraft(workOrderId);
  if (!detail) return null;

  const existingDecision = detail.package.manifest?.topicProductionStudentLaunchDecision || {};
  const previewKey = typeof existingDecision.previewKey === "string" ? existingDecision.previewKey : "";
  const blockers = [
    existingDecision.decision !== "approve_student_preview" ? "Controlled preview is not approved" : "",
    !previewKey ? "Controlled preview key is missing" : "",
    detail.package.status !== "qa_ready" && detail.package.status !== "published" ? "Package is not QA-ready" : "",
    Number(detail.package.qaSummary?.failCount || 0) > 0 ? "QA has failures" : "",
  ].filter(Boolean);
  if (blockers.length) {
    return { detail, blocked: true, blockers };
  }

  const previewReview = {
    outcome,
    reviewerNotes: compactText(reviewerNotes),
    reviewedAt: nowIso(),
    reviewedBy: "local-preview@nurseprep.app",
  };
  const topicProduction = detail.package.manifest?.topicProduction || {};
  const controlledPreviewReview = {
    phase: "phase_14_controlled_preview_review",
    reviewPackageWorkOrderId: workOrderId,
    packageId: detail.package.id,
    outcome,
    previewKeyStatus: "active",
    studentPreviewUrl: `/lessons/${detail.package.id}?previewKey=${encodeURIComponent(previewKey)}`,
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
  detail.package.manifest = {
    ...(detail.package.manifest || {}),
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
  detail.package.updatedAt = nowIso();
  return {
    detail,
    blocked: false,
    blockers: [],
    previewReview,
    controlledPreviewReview,
    reviewSummary: topicProductionPreviewReviewSummary(detail),
  };
}

function persistTopicProductionPublicReleaseDecision(detail, releaseReferenceId, decision, reviewerNotes = "") {
  const existingDecision = detail.package.manifest?.topicProductionStudentLaunchDecision || {};
  const previewReview = existingDecision.previewReview || {};
  const topicProduction = detail.package.manifest?.topicProduction || {};
  const reviewPackageWorkOrderId = topicProduction.reviewPackageWorkOrderId || releaseReferenceId;
  const blockers = [
    existingDecision.decision !== "approve_student_preview" ? "Controlled preview is not approved" : "",
    !existingDecision.previewKey ? "Controlled preview key is missing" : "",
    previewReview.outcome !== "ready_for_release" ? "Controlled preview review is not marked ready for release" : "",
    detail.package.status !== "qa_ready" && detail.package.status !== "published" ? "Package is not QA-ready" : "",
    Number(detail.package.qaSummary?.failCount || 0) > 0 ? "QA has failures" : "",
  ].filter(Boolean);
  if (blockers.length) {
    return { detail, blocked: true, blockers };
  }

  const publicReleaseDecision = {
    decision,
    reviewerNotes: compactText(reviewerNotes),
    reviewedAt: nowIso(),
    reviewedBy: "local-preview@nurseprep.app",
  };
  const publicReleaseGate = {
    phase: "phase_15_public_release_decision",
    reviewPackageWorkOrderId,
    releaseReferenceId,
    packageId: detail.package.id,
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
  detail.package.manifest = {
    ...(detail.package.manifest || {}),
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
  detail.package.updatedAt = nowIso();
  return {
    detail,
    blocked: false,
    blockers: [],
    publicReleaseDecision,
    publicReleaseGate,
  };
}

function saveTopicProductionPublicReleaseDecision(workOrderId, decision, reviewerNotes = "") {
  const detail = findTopicProductionReviewDraft(workOrderId);
  if (!detail) return null;
  return persistTopicProductionPublicReleaseDecision(detail, workOrderId, decision, reviewerNotes);
}

function saveTopicProductionPublicReleaseDecisionForPackage(packageId, decision, reviewerNotes = "") {
  const detail = packageDetails.get(packageId);
  if (!detail) return null;
  return persistTopicProductionPublicReleaseDecision(detail, packageId, decision, reviewerNotes);
}

function topicProductionNextSpendPackets(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
  return topicProductionBuildPackets(rows, sourceRecords, draftRecords)
    .filter((packet) => packet.draftPackage?.nextSpendApproved);
}

function topicProductionDraftReviewRows(packets) {
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
        "Checklist Detail": checklist.map((check) => `${check.label}: ${check.passed ? "pass" : "needs review"} (${check.detail})`).join(" | "),
        "Slide Outline": (packet.templateDraft?.slideOutline || []).map((slide) => `${slide.title}: ${slide.purpose}`).join(" | "),
        "Guided Notes Outline": (packet.templateDraft?.guidedNotesOutline || []).join(" | "),
        "Practice Stem": packet.templateDraft?.practicePreview?.stem || "",
        "Correct Answer": packet.templateDraft?.practicePreview?.correctAnswer || "",
        "Rationale": packet.templateDraft?.practicePreview?.rationale || "",
        "Drive Project Assets": (packet.driveProjectAssets || []).map((asset) => asset.title).join(" | "),
        "Drive Asset Links": (packet.driveProjectAssets || []).map((asset) => asset.url).join(" | "),
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

function topicProductionDraftReviewCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionNextSpendCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
  const packets = topicProductionNextSpendPackets(rows, sourceRecords, draftRecords);
  const exportRows = topicProductionBuildPacketRows(packets);
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionShortsWorkflowRows(packets) {
  return packets.map((packet) => {
    const coverage = (key) => (packet.coverageContract?.rows || []).find((item) => item.key === key);
    const visualAsset = (packet.assetPlan || []).find((asset) => asset.assetKey === "visuals");
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
      "Drive Project Assets": (packet.driveProjectAssets || []).map((asset) => asset.title).join(" | "),
      "Drive Asset Links": (packet.driveProjectAssets || []).map((asset) => asset.url).join(" | "),
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

function topicProductionShortsWorkflowCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionPhaseThreeHandoffRows(packets) {
  return packets.map((packet) => {
    const coverage = (key) => (packet.coverageContract?.rows || []).find((item) => item.key === key);
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
      "Drive Project Assets": (packet.driveProjectAssets || []).map((asset) => asset.title).join(" | "),
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

function topicProductionPhaseThreeHandoffCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionStudentLaunchReadinessRows(packets) {
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

function topicProductionStudentLaunchReadinessCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionPublishReadinessRows(packets) {
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

function topicProductionPublishReadinessCsv(rows, sourceRecords = sources, draftRecords = Array.from(packageDetails.values())) {
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
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...exportRows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

function topicProductionReleaseAuditSnapshot(detail) {
  const pkg = detail.package;
  const manifest = pkg.manifest || {};
  const draft = topicProductionDraftSummary(detail);
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
  const publishGateStatus = publicVisible ? "published" : blockers.length === 0 ? "ready_for_public_publish" : "blocked";
  const slideDeck = [...detail.slides]
    .sort((a, b) => Number(a.slideNumber || 0) - Number(b.slideNumber || 0))
    .map((slide) => ({
      slideNumber: slide.slideNumber,
      title: slide.title,
      type: slide.slideType || slide.type || "",
      learningObjective: slide.learningObjective || "",
      speakerNotesAvailable: Boolean(slide.speakerNotes),
    }));
  const practiceItems = detail.items.map((item) => ({
    itemType: item.itemType,
    stem: item.stem,
    correctAnswer: item.correctAnswer,
    rationalePreview: compactText(item.rationale || "").slice(0, 240),
    tags: item.tags || {},
  }));
  const citations = detail.citations.map((citation) => ({
    sourceTitle: citation.sourceTitle || citation.title || citation.sourceId || "Source",
    section: citation.sectionTitle || citation.location || citation.sourceLocator || "",
    claim: citation.claim || citation.snippet || citation.evidence || "",
  }));
  const qaFailures = (detail.qaResults || []).filter((result) => result.status === "fail");
  const qaWarnings = (detail.qaResults || []).filter((result) => result.status === "warn" || result.status === "warning");

  return {
    generatedAt: nowIso(),
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
      slideCount: detail.slides.length,
      practiceItemCount: detail.items.length,
      citationCount: detail.citations.length,
      artifactCount: detail.artifacts.length,
      guidedNotesAvailable: Boolean(manifest.guidedNotes || detail.artifacts.some((artifact) => String(artifact.artifactType || "").includes("guided"))),
      learnerSafeSurface: "slides, guided notes, practice item/rationale, citations, and completion/feedback events",
    },
    slideDeck,
    practiceItems,
    citations,
    qa: {
      summary: pkg.qaSummary || {},
      resultCount: detail.qaResults.length,
      failureCount: qaFailures.length,
      warningCount: qaWarnings.length,
      failures: qaFailures.map((result) => ({ gate: result.gateName || result.gateKey, details: result.details || "" })),
      warnings: qaWarnings.map((result) => ({ gate: result.gateName || result.gateKey, details: result.details || "" })),
      contractValidationCount: detail.contractValidations.length,
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

function findForbiddenLearnerPayloadKeys(value, pathName = "") {
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
  const matches = [];
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

function topicProductionStudentReleaseSanity(detail) {
  const learner = previewLearnerPayload(detail);
  const summary = previewLessonSummary(detail);
  const assessmentBridge = learner.package.assessmentBridge || {};
  const guidedNotesSlides = learner.slides.filter((slide) => compactText(slide.guidedNotes || "")).length;
  const rationaleCount = learner.practiceItems.filter((item) => compactText(item.rationale || "")).length;
  const optionsReadyCount = learner.practiceItems.filter((item) => Array.isArray(item.options) && item.options.length >= 2).length;
  const slideCitationCount = learner.slides.reduce((total, slide) => total + (Array.isArray(slide.citations) ? slide.citations.length : 0), 0);
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
    generatedAt: nowIso(),
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
      slideTitles: learner.slides.slice(0, 5).map((slide) => slide.title),
      practicePreview: learner.practiceItems[0]
        ? {
          stem: learner.practiceItems[0].stem,
          rationalePreview: compactText(learner.practiceItems[0].rationale || "").slice(0, 220),
        }
        : null,
      citationLabels: learner.citations.slice(0, 5).map((citation) => citation.citationLabel),
    },
    costGuardrail: "Read-only student release sanity check. No new AI generation, public publish, TTS, rendered video, paid visual generation, or batch production is performed by this audit.",
  };
}

function topicProductionNextBuildRows(rows) {
  return rows.filter((row) => topicProductionNextBuildDecisions.has(row.review?.decision));
}

const pilotRequestStatuses = ["new", "qualified", "follow_up", "demo_ready", "closed_won", "closed_lost"];

function pilotRequestPayload(request) {
  const customFields = request.customFields || {};
  return {
    id: request.id,
    status: request.status || "new",
    score: request.score || 0,
    source: request.source || "public_launch_mfp",
    contactName: request.contactName || "",
    contactEmail: request.contactEmail || "",
    contactPhone: request.contactPhone || "",
    companyName: request.companyName || "",
    jobTitle: request.jobTitle || "",
    industry: request.industry || "",
    interestedTopics: Array.isArray(request.interestedTopics) ? request.interestedTopics : [],
    tags: Array.isArray(request.tags) ? request.tags : [],
    pilotGoal: customFields.pilotGoal || "",
    adminNotes: customFields.adminNotes || "",
    reviewedAt: customFields.reviewedAt || null,
    followUpDate: request.followUpDate || null,
    firstContactDate: request.firstContactDate || null,
    lastContactDate: request.lastContactDate || null,
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
  };
}

function pilotRequestSummary(requests) {
  const statusCounts = Object.fromEntries(pilotRequestStatuses.map((status) => [status, 0]));
  for (const request of requests) {
    statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
  }
  const openStatuses = new Set(["new", "qualified", "follow_up", "demo_ready"]);
  return {
    total: requests.length,
    open: requests.filter((request) => openStatuses.has(request.status)).length,
    qualified: statusCounts.qualified || 0,
    followUp: statusCounts.follow_up || 0,
    demoReady: statusCounts.demo_ready || 0,
    closed: (statusCounts.closed_won || 0) + (statusCounts.closed_lost || 0),
    statusCounts,
    newestRequest: requests[0] || null,
  };
}

function pilotRequestsResponse(status = "all") {
  const requests = pilotRequests
    .map(pilotRequestPayload)
    .filter((request) => status === "all" || request.status === status);
  return { requests, summary: pilotRequestSummary(requests), statuses: pilotRequestStatuses };
}

function pilotRequestCsv(requests) {
  const columns = [
    ["id", (request) => request.id],
    ["status", (request) => request.status],
    ["score", (request) => request.score],
    ["contact_name", (request) => request.contactName],
    ["contact_email", (request) => request.contactEmail],
    ["organization", (request) => request.companyName],
    ["pilot_goal", (request) => request.pilotGoal],
    ["interested_topics", (request) => request.interestedTopics.join("; ")],
    ["admin_notes", (request) => request.adminNotes],
    ["follow_up_date", (request) => request.followUpDate],
    ["created_at", (request) => request.createdAt],
  ];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    columns.map(([header]) => escape(header)).join(","),
    ...requests.map((request) => columns.map(([, accessor]) => escape(accessor(request))).join(",")),
  ].join("\n");
}

async function readMultipartDocument(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (!boundaryMatch) {
    return {
      fileName: "uploaded-document.txt",
      contentType,
      buffer: body,
    };
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const parts = body.toString("latin1").split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes('name="document"') && !part.includes("filename=")) continue;
    const [rawHeaders, ...rawBody] = part.split("\r\n\r\n");
    if (!rawBody.length) continue;
    const disposition = rawHeaders.match(/content-disposition:[^\r\n]+/i)?.[0] || "";
    const fileName = path.basename(disposition.match(/filename="([^"]*)"/i)?.[1] || "uploaded-document.txt");
    const partType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || contentType;
    const rawContent = rawBody.join("\r\n\r\n").replace(/\r\n$/, "");
    return {
      fileName,
      contentType: partType,
      buffer: Buffer.from(rawContent, "latin1"),
    };
  }

  return {
    fileName: "uploaded-document.txt",
    contentType,
    buffer: body,
  };
}

function parseDataChunkerMarkdownContent(markdown) {
  const match = String(markdown || "").match(/## Content\s*```(?:text|txt)?\s*([\s\S]*?)```/i);
  return compactText(match ? match[1] : markdown);
}

function isDataChunkerIndex(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.some((entry) => entry && typeof entry === "object" && "chunk_id" in entry && "actual_filename" in entry);
}

function normalizeArchivePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\/+/g, "/");
}

function archiveDirName(value) {
  const normalized = normalizeArchivePath(value);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function archiveJoin(...parts) {
  return normalizeArchivePath(path.posix.join(...parts.filter(Boolean)));
}

function extractTarEntries(buffer) {
  const entries = new Map();
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const rawPrefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const rawSize = header.subarray(124, 136).toString("utf8").replace(/\0/g, "").trim();
    const size = Number.parseInt(rawSize || "0", 8);

    if (!rawName && !size) break;
    const name = normalizeArchivePath(rawPrefix ? `${rawPrefix}/${rawName}` : rawName);
    offset += 512;

    if (name && Number.isFinite(size)) {
      entries.set(name, buffer.subarray(offset, offset + size));
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

async function extractZipEntries(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = new Map();
  for (const file of Object.values(zip.files)) {
    if (!file.dir) entries.set(normalizeArchivePath(file.name), await file.async("nodebuffer"));
  }
  return entries;
}

function findArchiveChunkEntry(entries, indexPath, actualFileName) {
  const keys = [...entries.keys()];
  const indexDir = archiveDirName(indexPath);
  const strippedIndexDir = indexDir.replace(/\.pdf$/i, "");
  const parentDir = archiveDirName(indexDir);
  const actual = normalizeArchivePath(actualFileName);
  const candidates = [
    archiveJoin(indexDir, actual),
    archiveJoin(strippedIndexDir, actual),
    archiveJoin(parentDir, actual),
    actual,
  ];
  return candidates.find((candidate) => entries.has(candidate))
    || keys.find((candidate) => candidate.toLowerCase().endsWith(`/${actual.toLowerCase()}`) || candidate.toLowerCase() === actual.toLowerCase());
}

async function dataChunkerChunksFromArchive(entries) {
  const indexPaths = [...entries.keys()].filter((key) => /(^|\/)index\.json$/i.test(key));
  const chunks = [];
  let title = "";
  let generated = "";

  for (const indexPath of indexPaths) {
    let parsed;
    try {
      parsed = JSON.parse(entries.get(indexPath).toString("utf8"));
    } catch {
      continue;
    }
    if (!isDataChunkerIndex(parsed)) continue;

    title ||= parsed[0]?.file_name || path.basename(archiveDirName(indexPath)) || "Data Chunker Pro Import";
    generated ||= parsed[0]?.generated || "";
    for (const entry of parsed) {
      const chunkKey = findArchiveChunkEntry(entries, indexPath, entry.actual_filename);
      const markdown = chunkKey ? entries.get(chunkKey).toString("utf8") : "";
      chunks.push({
        text: markdown ? parseDataChunkerMarkdownContent(markdown) : compactText(entry.content_preview || ""),
        chunkId: entry.chunk_id,
        chunkName: entry.chunk_name,
        actualFilename: entry.actual_filename,
        contentLength: entry.content_length,
        sourceFile: entry.file_name,
        originalExtension: entry.file_extension,
        generated: entry.generated,
        archivePath: chunkKey || indexPath,
      });
    }
  }

  return { title, generated, chunks };
}

async function readLocalChunkFile(indexDir, actualFileName) {
  const strippedIndexDir = indexDir.replace(/\.pdf$/i, "");
  const parentDir = path.dirname(indexDir);
  const candidates = [
    path.join(indexDir, actualFileName),
    path.join(strippedIndexDir, actualFileName),
    path.join(parentDir, actualFileName),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // Try the next likely Data Chunker layout.
    }
  }

  try {
    const siblings = await fs.readdir(parentDir, { withFileTypes: true });
    for (const sibling of siblings.filter((entry) => entry.isDirectory())) {
      const candidate = path.join(parentDir, sibling.name, actualFileName);
      try {
        return await fs.readFile(candidate, "utf8");
      } catch {
        // Continue scanning nearby package folders.
      }
    }
  } catch {
    // No sibling scan available.
  }

  return "";
}

async function dataChunkerChunksFromLocalIndex(indexPath) {
  const raw = await fs.readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!isDataChunkerIndex(parsed)) return null;

  const indexDir = path.dirname(indexPath);
  const chunks = [];
  for (const entry of parsed) {
    const markdown = await readLocalChunkFile(indexDir, entry.actual_filename);
    chunks.push({
      text: markdown ? parseDataChunkerMarkdownContent(markdown) : compactText(entry.content_preview || ""),
      chunkId: entry.chunk_id,
      chunkName: entry.chunk_name,
      actualFilename: entry.actual_filename,
      contentLength: entry.content_length,
      sourceFile: entry.file_name,
      originalExtension: entry.file_extension,
      generated: entry.generated,
      localIndexPath: indexPath,
    });
  }

  return {
    title: parsed[0]?.file_name || path.basename(indexDir),
    generated: parsed[0]?.generated || "",
    chunks,
  };
}

async function indexDataChunkerChunks({ title, chunks, sourceUri, generated, size = 0 }) {
  const usableChunks = chunks.map((chunk) => ({
    ...chunk,
    text: compactText(chunk.text),
  })).filter((chunk) => chunk.text);

  if (!usableChunks.length) return null;

  const createdAt = nowIso();
  const documentId = makeId("doc");
  const joined = usableChunks.map((chunk) => chunk.text).join("\n\n");
  const document = {
    id: documentId,
    title: title || "Data Chunker Pro Import",
    type: "data-chunker",
    status: "ready",
    sourceUri: sourceUri || `data-chunker:${title || documentId}`,
    totalPages: usableChunks.length,
    totalTokens: Math.ceil(joined.length / 4),
    contentHash: stableHash(joined),
    metadata: {
      sourceKind: "data_chunker_pro",
      sourceType: "rag_chunk_index",
      subject: "Data Chunker Pro RAG import",
      edition: generated ? `Data Chunker Pro export ${generated}` : "Data Chunker Pro export",
      generated,
      importedChunkCount: usableChunks.length,
    },
    uploadedBy: "local-preview",
    createdAt,
    updatedAt: createdAt,
    chunkCount: usableChunks.length,
    size: size || Buffer.byteLength(joined),
    filePath: sourceUri || "",
    uploadedAt: createdAt,
    pageCount: usableChunks.length,
  };
  kbDocuments.unshift(document);

  const documentChunks = usableChunks.map((chunk, index) => ({
    id: makeId("chunk"),
    documentId,
    content: chunk.text,
    cleanText: chunk.text,
    tokenCount: Math.ceil(chunk.text.length / 4),
    chunkIndex: index,
    pageStart: Number(chunk.chunkId) || index + 1,
    pageEnd: Number(chunk.chunkId) || index + 1,
    topicIds: [],
    tags: ["data-chunker-pro", chunk.originalExtension, chunk.chunkName].filter(Boolean),
    metadata: {
      dataChunkerChunkId: chunk.chunkId,
      chunkName: chunk.chunkName,
      actualFilename: chunk.actualFilename,
      sourceFile: chunk.sourceFile,
      originalExtension: chunk.originalExtension,
      generated: chunk.generated,
      archivePath: chunk.archivePath,
      localIndexPath: chunk.localIndexPath,
      citationLabel: `${title}, chunk ${chunk.chunkId || index + 1}`,
    },
    contentHash: stableHash(`${documentId}:${chunk.chunkId || index}:${chunk.text}`),
    documentTitle: document.title,
    score: 0.9,
    createdAt,
  }));
  kbChunks.unshift(...documentChunks);

  const source = addDocumentSource(document, documentChunks);
  const job = {
    id: makeId("job"),
    jobId: "",
    documentId,
    documentTitle: document.title,
    status: "completed",
    stage: "indexed",
    progress: 100,
    message: `Imported ${documentChunks.length} Data Chunker Pro chunks.`,
    error: null,
    startedAt: createdAt,
    completedAt: nowIso(),
    createdAt,
    updatedAt: nowIso(),
    metadata: {
      chunksCreated: documentChunks.length,
      sourceId: source.id,
      importer: "data_chunker_pro",
    },
  };
  job.jobId = job.id;
  kbJobs.unshift(job);
  return { document, documentChunks, job, source };
}

async function tryIndexDataChunkerUpload({ fileName, contentType, buffer, sourceUri }) {
  const type = inferDocumentType(fileName, contentType);

  if (type === "zip" || type === "tar") {
    try {
      const entries = type === "zip" ? await extractZipEntries(buffer) : extractTarEntries(buffer);
      const parsed = await dataChunkerChunksFromArchive(entries);
      if (parsed.chunks.length) {
        return await indexDataChunkerChunks({
          title: parsed.title || fileName,
          chunks: parsed.chunks,
          sourceUri: sourceUri || `data-chunker-upload:${fileName}`,
          generated: parsed.generated,
          size: buffer.length,
        });
      }
    } catch {
      return null;
    }
  }

  if (type === "json") {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      if (isDataChunkerIndex(parsed)) {
        return await indexDataChunkerChunks({
          title: parsed[0]?.file_name || fileName,
          chunks: parsed.map((entry) => ({
            text: compactText(entry.content_preview || ""),
            chunkId: entry.chunk_id,
            chunkName: entry.chunk_name,
            actualFilename: entry.actual_filename,
            contentLength: entry.content_length,
            sourceFile: entry.file_name,
            originalExtension: entry.file_extension,
            generated: entry.generated,
          })),
          sourceUri: sourceUri || `data-chunker-index:${fileName}`,
          generated: parsed[0]?.generated || "",
          size: buffer.length,
        });
      }
    } catch {
      return null;
    }
  }

  return null;
}

function isAllowedLocalImportPath(value) {
  const resolved = path.resolve(String(value || ""));
  const allowedRoots = [
    path.resolve("C:/Users/bobby/Documents"),
    path.resolve("C:/Users/bobby/Downloads"),
  ];
  return allowedRoots.some((rootPath) => resolved === rootPath || resolved.startsWith(`${rootPath}${path.sep}`));
}

async function findDataChunkerIndexPaths(startPath, maxDepth = 4) {
  const resolved = path.resolve(startPath);
  const stat = await fs.stat(resolved);
  if (stat.isFile()) return path.basename(resolved).toLowerCase() === "index.json" ? [resolved] : [];

  const results = [];
  async function walk(currentPath, depth) {
    if (depth > maxDepth) return;
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === "index.json") {
        results.push(fullPath);
      } else if (entry.isDirectory() && !["node_modules", ".git"].includes(entry.name)) {
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(resolved, 0);
  return results;
}

async function importDataChunkerLocalPath(localPath) {
  if (!isAllowedLocalImportPath(localPath)) {
    throw new Error("Local Data Chunker imports are limited to Documents and Downloads.");
  }

  const indexPaths = await findDataChunkerIndexPaths(localPath);
  const results = [];
  for (const indexPath of indexPaths) {
    const parsed = await dataChunkerChunksFromLocalIndex(indexPath);
    if (!parsed?.chunks?.length) continue;
    const result = await indexDataChunkerChunks({
      title: parsed.title,
      chunks: parsed.chunks,
      sourceUri: `local-data-chunker:${indexPath}`,
      generated: parsed.generated,
    });
    if (result) results.push(result);
  }
  return results;
}

function sendCsv(res, fileName, body) {
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

seedKnowledgeBaseFromSources();
seedContentBlocksFromKnowledgeBase();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res) {
  sendJson(res, 404, { error: "API route not found" });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function statusBadgeSummary(results) {
  return {
    status: results.some((result) => result.status === "fail") ? "blocked" : "qa_ready",
    passCount: results.filter((result) => result.status === "pass").length,
    warningCount: results.filter((result) => result.status === "warn").length,
    failCount: results.filter((result) => result.status === "fail").length,
    checkedAt: new Date().toISOString(),
  };
}

function serializeArtifactContent(artifact) {
  return artifact.contentText !== undefined ? artifact.contentText : JSON.stringify(artifact.contentJson || {}, null, 2);
}

function buildPackageArtifactPayloads(detail, profile = "harrity") {
  const citationsBySlide = new Map();
  for (const citation of detail.citations || []) {
    if (!citation.slideId) continue;
    const existing = citationsBySlide.get(citation.slideId) || [];
    existing.push(citation);
    citationsBySlide.set(citation.slideId, existing);
  }

  const sourceSummary = {
    packageId: detail.package.id,
    title: detail.package.title,
    exportProfile: profile,
    sources: detail.sources,
  };
  const conceptClusters = {
    topic: detail.package.topic,
    audience: detail.package.audience,
    taxonomySnapshot: detail.package.taxonomySnapshot,
    clusters: detail.slides.map((slide) => ({
      slideNumber: slide.slideNumber,
      title: slide.title,
      cjmStep: slide.cjmStep,
      nclexCategory: slide.nclexCategory,
      nursingProcess: slide.nursingProcess,
    })),
  };
  const assessmentBlueprint = csv(
    ["topic", "audience", "nclex_category", "cjm_step", "nursing_process", "bloom_level", "item_count"],
    [[detail.package.topic, detail.package.audience, detail.slides[0]?.nclexCategory, detail.slides[0]?.cjmStep, detail.slides[0]?.nursingProcess, detail.slides[0]?.bloomLevel, detail.items.length]],
  );
  const slideMap = csv(
    ["slide_number", "slide_type", "title", "nclex_category", "cjm_step", "retrieval_prompt", "citations"],
    detail.slides.map((slide) => [slide.slideNumber, slide.slideType, slide.title, slide.nclexCategory, slide.cjmStep, slide.retrievalPrompt, (citationsBySlide.get(slide.id) || []).map((citation) => citation.citationLabel).join("; ")]),
  );
  const itemMap = csv(
    ["item_type", "stem", "correct_answer", "rationale", "nclex_category", "cjm_step", "difficulty"],
    detail.items.map((item) => [item.itemType, item.stem, item.correctAnswer, item.rationale, item.tags?.nclexCategory, item.tags?.cjmStep, item.difficulty]),
  );
  const qaLog = csv(
    ["gate_key", "gate_name", "status", "details", "score", "checked_at"],
    detail.qaResults.map((result) => [result.gateKey, result.gateName, result.status, result.details, result.score, result.checkedAt]),
  );
  const guidedNotes = detail.slides.map((slide) => `## Slide ${slide.slideNumber}: ${slide.title}\n\n${slide.guidedNotes || "Notes: ____________________"}\n\nRetrieval prompt: ${slide.retrievalPrompt || ""}`).join("\n\n");
  const facilitationNotes = detail.slides.map((slide) => `## Slide ${slide.slideNumber}: ${slide.title}\n\n${slide.speakerNotes || "No speaker notes provided."}`).join("\n\n");
  const studentReceptionReview = {
    packageId: detail.package.id,
    reviewStatus: "ready_for_student_preview",
    checks: [
      "Starts with a patient cue.",
      "Asks students to predict before explanation.",
      "Includes exam anchor and clinical judgment tags.",
      "Includes practice, rationale, and takeaway.",
    ],
  };
  const accessibilityReport = {
    packageId: detail.package.id,
    status: "draft_pass",
    checks: [
      "Every slide has a title.",
      "Every slide includes a retrieval prompt or learner task.",
      "Visible slide content is separated from instructor facilitation notes.",
      "Citation excerpts are short enough for proprietary-source safety.",
    ],
    slideCount: detail.slides.length,
  };
  const packageManifest = {
    ...detail.package.manifest,
    exportProfile: profile,
    exportedAt: nowIso(),
    counts: {
      sources: detail.sources.length,
      slides: detail.slides.length,
      items: detail.items.length,
      citations: detail.citations.length,
      qaResults: detail.qaResults.length,
    },
  };

  return [
    { artifactKey: "source_summary", artifactType: "json", fileName: "source_summary.json", mimeType: "application/json", contentJson: sourceSummary },
    { artifactKey: "concept_clusters", artifactType: "json", fileName: "concept_clusters.json", mimeType: "application/json", contentJson: conceptClusters },
    { artifactKey: "assessment_blueprint", artifactType: "csv", fileName: "assessment_blueprint.csv", mimeType: "text/csv", contentText: assessmentBlueprint },
    { artifactKey: "slide_map", artifactType: "csv", fileName: "slide_map.csv", mimeType: "text/csv", contentText: slideMap },
    { artifactKey: "item_map", artifactType: "csv", fileName: "item_map.csv", mimeType: "text/csv", contentText: itemMap },
    { artifactKey: "qa_log", artifactType: "csv", fileName: "qa_log.csv", mimeType: "text/csv", contentText: qaLog },
    { artifactKey: "student_guided_notes", artifactType: "markdown", fileName: "student_guided_notes.md", mimeType: "text/markdown", contentText: guidedNotes },
    { artifactKey: "instructor_facilitation_notes", artifactType: "markdown", fileName: "instructor_facilitation_notes.md", mimeType: "text/markdown", contentText: facilitationNotes },
    { artifactKey: "student_reception_review", artifactType: "json", fileName: "student_reception_review.json", mimeType: "application/json", contentJson: studentReceptionReview },
    { artifactKey: "accessibility_report", artifactType: "json", fileName: "accessibility_report.json", mimeType: "application/json", contentJson: accessibilityReport },
    { artifactKey: "package_manifest", artifactType: "json", fileName: "package_manifest.json", mimeType: "application/json", contentJson: packageManifest },
    { artifactKey: "deck_model", artifactType: "json", fileName: "deck_model.json", mimeType: "application/json", contentJson: detail.package.deckModel || {} },
  ];
}

function replacePackageRows(collection, packageId, nextRows) {
  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (collection[index].packageId === packageId) collection.splice(index, 1);
  }
  collection.unshift(...nextRows);
  return nextRows;
}

function persistPackageArtifacts(detail, profile = "harrity") {
  const rows = buildPackageArtifactPayloads(detail, profile).map((artifact) => {
    const content = serializeArtifactContent(artifact);
    return {
      id: makeId("artifact"),
      packageId: detail.package.id,
      artifactKey: artifact.artifactKey,
      artifactType: artifact.artifactType,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      contentHash: stableHash(content),
      contentJson: artifact.contentJson || {},
      contentText: artifact.contentText,
      metadata: { profile, generatedAt: nowIso() },
      createdAt: nowIso(),
    };
  });
  detail.artifacts = replacePackageRows(lessonPackageArtifacts, detail.package.id, rows);
  return detail.artifacts;
}

function contractGate(validationKey, validationName, passed, details, evidence = {}, warn = false) {
  return {
    id: makeId("validation"),
    validationKey,
    validationName,
    status: passed ? "pass" : warn ? "warn" : "fail",
    details,
    evidence,
    createdAt: nowIso(),
  };
}

function validateLessonContract(detail, profile = "harrity") {
  const artifacts = persistPackageArtifacts(detail, profile);
  const artifactFileNames = new Set(artifacts.map((artifact) => artifact.fileName));
  const slidesWithCitations = new Set((detail.citations || []).filter((citation) => citation.slideId).map((citation) => citation.slideId));
  const itemCitationIds = new Set((detail.citations || []).filter((citation) => citation.itemId).map((citation) => citation.itemId));
  const visibleText = detail.slides.map((slide) => JSON.stringify(slide.visibleContent || {})).join(" ").toLowerCase();
  const visibleOffenders = ["instructor", "faculty", "speaker notes", "facilitation", "teaching plan", "presenter notes"].filter((term) => visibleText.includes(term));
  const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !artifactFileNames.has(fileName));
  const failedQa = (detail.qaResults || []).filter((result) => result.status === "fail");
  const results = [
    contractGate("required_export_files", "Required Harrity Export Files", missingRequiredFiles.length === 0, missingRequiredFiles.length ? `Missing required files: ${missingRequiredFiles.join(", ")}.` : `${harrityRequiredExportFiles.length} required files are available.`),
    contractGate("visible_slide_contract", "Learner-facing Visible Slides", visibleOffenders.length === 0, visibleOffenders.length ? `Visible slide content contains instructor-only language: ${visibleOffenders.join(", ")}.` : "Visible slide content stays learner-facing."),
    contractGate("source_traceability", "Source Traceability", detail.slides.length > 0 && slidesWithCitations.size >= detail.slides.length, `${slidesWithCitations.size}/${detail.slides.length} slides have citations.`),
    contractGate("practice_item_contract", "Practice Item Contract", detail.items.length > 0 && detail.items.every((item) => item.correctAnswer && item.rationale && item.tags?.nclexCategory && item.tags?.cjmStep && (itemCitationIds.has(item.id) || detail.citations.length > 0)), `${detail.items.length} item(s) checked for answer key, rationale, tags, and citation traceability.`),
    contractGate("taxonomy_alignment", "NCLEX/CJM/Bloom Alignment", detail.slides.every((slide) => slide.nclexCategory && slide.cjmStep && slide.bloomLevel), "Every slide should carry NCLEX category, CJM step, and Bloom level."),
    contractGate("qa_publish_gate", "QA Publish Gate", failedQa.length === 0, failedQa.length ? `${failedQa.length} failing QA gate(s) must be resolved before publish.` : "No failing QA gates are present."),
    contractGate("student_reception_review", "Student Reception Review", artifactFileNames.has("student_reception_review.json") && visibleText.includes("predict") && visibleText.includes("rationale"), "Package includes student reception artifact plus prediction/rationale learning moments."),
  ].map((result) => ({ ...result, packageId: detail.package.id }));

  detail.contractValidations = replacePackageRows(lessonContractValidations, detail.package.id, results);
  const failCount = results.filter((result) => result.status === "fail").length;
  const warningCount = results.filter((result) => result.status === "warn").length;
  const validationSummary = {
    profile,
    status: failCount ? "blocked" : "passed",
    passCount: results.length - failCount - warningCount,
    warningCount,
    failCount,
    artifactCount: artifacts.length,
    checkedAt: nowIso(),
  };
  detail.package.manifest = { ...(detail.package.manifest || {}), contractValidation: validationSummary };
  return { validationSummary, results, artifacts };
}

function previewQaGate(gateKey, gateName, passed, details, warn = false) {
  return {
    id: `qa-${gateKey}`,
    gateKey,
    gateName,
    status: passed ? "pass" : warn ? "warn" : "fail",
    details,
    score: passed ? "100" : warn ? "75" : "0",
    checkedAt: nowIso(),
  };
}

function runPreviewQa(detail) {
  const visibleText = detail.slides.map((slide) => JSON.stringify(slide.visibleContent || {})).join(" ").toLowerCase();
  const visibleOffenders = ["instructor", "faculty", "speaker notes", "teaching plan"].filter((term) => visibleText.includes(term));
  const citedSlideIds = new Set((detail.citations || []).filter((citation) => citation.slideId).map((citation) => citation.slideId));
  const itemCitationIds = new Set((detail.citations || []).filter((citation) => citation.itemId).map((citation) => citation.itemId));
  const maxVisibleKeys = Math.max(0, ...detail.slides.map((slide) => Object.keys(slide.visibleContent || {}).length));
  const results = [
    previewQaGate("source_traceability", "Source Traceability", citedSlideIds.size >= detail.slides.length, `${citedSlideIds.size}/${detail.slides.length} slides have traceable citations.`),
    previewQaGate("learner_only_visible_slides", "Learner-only Visible Slides", visibleOffenders.length === 0, visibleOffenders.length ? `Visible slide content contains instructor-facing language: ${visibleOffenders.join(", ")}.` : "Visible slide content stays learner-facing."),
    previewQaGate("exam_anchor_density", "Exam Anchor Density", detail.slides.every((slide) => slide.nclexCategory), "Every slide should carry an NCLEX category."),
    previewQaGate("retrieval_practice", "Retrieval and Application", detail.slides.filter((slide) => slide.retrievalPrompt).length >= Math.max(2, Math.floor(detail.slides.length / 2)), "Slides should include retrieval prompts."),
    previewQaGate("rationale_coverage", "Rationale Coverage", detail.items.length > 0 && detail.items.every((item) => item.correctAnswer && item.rationale), "Practice items should include answer keys and rationales."),
    previewQaGate("clinical_judgment_alignment", "Clinical Judgment Alignment", detail.slides.some((slide) => slide.cjmStep) && detail.items.some((item) => item.tags?.cjmStep), "Slides and items should include CJM tags."),
    previewQaGate("common_trap_coverage", "Common Trap Coverage", detail.slides.some((slide) => JSON.stringify(slide.visibleContent || {}).toLowerCase().includes("trap")), "At least one slide should include common trap language."),
    previewQaGate("cognitive_load", "Cognitive Load", maxVisibleKeys <= 5, `Largest slide has ${maxVisibleKeys} visible content blocks.`, maxVisibleKeys <= 6),
    previewQaGate("accessibility", "Accessibility", detail.slides.every((slide) => slide.title && slide.retrievalPrompt), "Every slide should have a title and retrieval prompt."),
    previewQaGate("assessment_blueprint", "Assessment Blueprint", detail.items.length > 0 && detail.items.every((item) => item.tags?.nclexCategory && item.tags?.cjmStep), "Practice items should include NCLEX/CJM tags."),
    previewQaGate("student_reception_review", "Student Reception Review", visibleText.includes("predict") && visibleText.includes("rationale"), "Package should include prediction and rationale learning moments."),
    previewQaGate("proprietary_source_safety", "Proprietary-source Safety", detail.citations.every((citation) => !citation.excerpt || citation.excerpt.length <= 360), "Citation excerpts should be short and paraphrased."),
    previewQaGate("artifact_truthfulness", "Artifact Truthfulness", detail.citations.every((citation) => citation.sourceId || citation.documentId || citation.chunkId), "Citations should point to selected source records, documents, or chunks."),
  ];
  detail.qaResults = results.map((result) => ({ ...result, packageId: detail.package.id }));
  detail.package.qaSummary = statusBadgeSummary(results);
  detail.package.status = detail.package.qaSummary.failCount > 0 ? "blocked" : "qa_ready";
  detail.package.updatedAt = nowIso();
  return { qaSummary: detail.package.qaSummary, results: detail.qaResults };
}

function markPreviewPackageNeedsReview(detail, reason) {
  detail.qaResults = [];
  detail.contractValidations = replacePackageRows(lessonContractValidations, detail.package.id, []);
  detail.artifacts = replacePackageRows(lessonPackageArtifacts, detail.package.id, []);
  detail.package.status = "draft";
  delete detail.package.publishedAt;
  detail.package.qaSummary = {
    status: "needs_review",
    passCount: 0,
    warningCount: 0,
    failCount: 0,
    reason,
    checkedAt: null,
  };
  detail.package.deckModel = {
    ...(detail.package.deckModel || {}),
    slides: detail.slides,
    items: detail.items,
    updatedAfterEditAt: nowIso(),
  };
  detail.package.manifest = {
    ...(detail.package.manifest || {}),
    reviewStatus: "needs_qa_after_edit",
    editReason: reason,
    lastEditedAt: nowIso(),
    counts: {
      sources: detail.sources.length,
      slides: detail.slides.length,
      items: detail.items.length,
      citations: detail.citations.length,
    },
  };
  detail.package.updatedAt = nowIso();
  return detail;
}

function evidenceForSources(selectedSources) {
  const documentChunks = selectedSources.flatMap((source) => {
    if (!source.documentId) return [];
    const document = findDocument(source.documentId);
    return kbChunks
      .filter((chunk) => chunk.documentId === source.documentId)
      .sort((a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0))
      .slice(0, 12)
      .map((chunk) => ({
        sourceId: source.id,
        documentId: source.documentId,
        chunkId: chunk.id,
        title: source.title,
        citationLabel: chunk.metadata?.citationLabel || `${document?.title || source.title}, chunk ${Number(chunk.chunkIndex || 0) + 1}`,
        text: chunk.cleanText || chunk.content,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
      }));
  }).filter((chunk) => chunk.text);

  if (documentChunks.length) return documentChunks;

  const archiveSnippets = selectedSources.flatMap((source) => {
    const snippets = Array.isArray(source.metadata?.evidenceSnippets) ? source.metadata.evidenceSnippets : [];
    return snippets.map((snippet, index) => ({
      sourceId: source.id,
      title: source.title,
      citationLabel: `${source.title}${snippets.length > 1 ? `, evidence ${index + 1}` : ""}`,
      text: typeof snippet === "string" ? snippet : snippet?.text,
    }));
  }).filter((chunk) => chunk.text);

  return archiveSnippets.length ? archiveSnippets : [{
    sourceId: sources[0].id,
    title: sources[0].title,
    citationLabel: sources[0].title,
    text: "Approved blueprint and source-index material should anchor every learner-facing slide.",
  }];
}

function learnerEvidenceAnchor(topic, focus) {
  return `The cited source supports using ${focus} to connect ${topic} cues with safe nursing judgment.`;
}

function buildSlides(topic, selectedSources) {
  const evidence = evidenceForSources(selectedSources);
  const common = {
    nclexCategory: "Physiological Integrity",
    nursingProcess: "Assessment",
    bloomLevel: "Apply",
  };
  const slideData = [
    ["patient_cue", `${topic}: Patient Cue`, "Recognize Cues", {
      patientCue: `A patient scenario includes a change related to ${topic}.`,
      sourceCue: learnerEvidenceAnchor(topic, "patient assessment data"),
      studentTask: "Identify which cue needs attention first.",
    }, "What cue would you report first, and why?"],
    ["student_prediction", "Predict Before Teaching", "Analyze Cues", {
      studentPrediction: `Predict the safest nursing interpretation for ${topic}.`,
      choices: ["Expected finding", "Potential complication", "Needs more assessment", "Immediate action"],
      examAnchor: "Physiological Integrity",
    }, "Which option would you choose on a timed exam?"],
    ["core_concept", "Core Concept", "Analyze Cues", {
      coreConcept: `${topic} requires linking the patient cue to nursing priority, safety, and expected outcomes.`,
      sourceAnchor: learnerEvidenceAnchor(topic, "the priority cue"),
      takeaway: "Link each cue to the nursing decision it supports.",
    }, "What concept connects the cue to the safest response?"],
    ["exam_anchor", "NCLEX and CJM Anchor", "Prioritize Hypotheses", {
      examAnchor: "Physiological Integrity",
      cjmStep: "Prioritize Hypotheses",
      decisionRule: "Prioritize unstable findings, safety risks, and findings that change the plan of care.",
    }, "Which CJM step is being tested here?"],
    ["common_trap", "Common Trap", "Take Action", {
      commonTrap: `Choosing an answer that is true but not the priority for this ${topic} cue.`,
      trapCheck: "Ask whether the option addresses the most urgent cue in the stem.",
      safeMove: "Return to assessment data, patient risk, and expected outcome.",
    }, "What makes a tempting option less safe?"],
    ["practice_item", "Practice Item", "Take Action", {
      practiceItem: `A nurse reviews a patient cue related to ${topic}. Which response best reflects safe clinical judgment?`,
      answerOptions: [
        "Collect another relevant assessment cue before acting.",
        "Ignore the cue because it is expected.",
        "Delegate all follow-up without review.",
        "Document only after the shift ends.",
      ],
    }, "Answer first, then explain the cue you used."],
    ["rationale", "Rationale", "Evaluate Outcomes", {
      correctAnswer: "Collect another relevant assessment cue before acting.",
      rationale: `This keeps the nurse in the clinical judgment loop by connecting ${topic} cues to assessment and safe prioritization.`,
      sourceAnchor: learnerEvidenceAnchor(topic, "the rationale"),
    }, "What evidence makes the correct answer safer?"],
    ["takeaway", "Takeaway", "Evaluate Outcomes", {
      takeaway: `For ${topic}, use the cue, decide what it means, choose the safest nursing response, and evaluate whether the patient improved.`,
      quickCheck: "Cue -> meaning -> action -> outcome",
    }, "Say the four-step chain without looking."],
  ];

  return slideData.map(([slideType, title, cjmStep, visibleContent, retrievalPrompt], index) => ({
    id: `slide-${Date.now()}-${index + 1}`,
    slideNumber: index + 1,
    slideType,
    title,
    visibleContent,
    retrievalPrompt,
    cjmStep,
    speakerNotes: "Facilitate learner reasoning without putting instructor-only planning language on visible slides.",
    guidedNotes: "Cue: ____________________ Decision: ____________________ Outcome: ____________________",
    evidence: evidence[index % evidence.length],
    ...common,
    createdAt: new Date().toISOString(),
  }));
}

function buildPackage(payload) {
  const id = `pkg-${Date.now()}`;
  const requestedMode = payload.settings?.generationMode || "agent_assisted";
  const generationRun = {
    id: makeId("run"),
    packageId: id,
    status: "running",
    generationMode: requestedMode,
    topic: payload.topic || "Clinical judgment priority decision",
    audience: payload.audience || "Prelicensure RN",
    sourceIds: payload.sourceIds || [],
    settings: payload.settings || {},
    evidenceSnapshot: {},
    taxonomySnapshot: {},
    validationSummary: {},
    createdAt: nowIso(),
  };
  lessonGenerationRuns.unshift(generationRun);
  const agentStatus = lessonBuilderAgentStatus();
  const generation = {
    requestedMode,
    usedMode: "template",
    agentId: NURSING_CURRICULUM_SUPERVISOR_AGENT_ID,
    agentConfigured: agentStatus.configured,
    agentTransport: agentStatus.transport,
    agentEndpointConfigured: agentStatus.endpointConfigured,
    ...(requestedMode === "agent_assisted"
      ? { fallbackReason: "Local preview uses deterministic template generation; production server will use the configured supervisor path." }
      : {}),
  };
  const selectedSources = sources.filter((source) => payload.sourceIds?.includes(source.id));
  const activeSources = selectedSources.length ? selectedSources : sources.slice(0, 1);
  const slides = buildSlides(payload.topic || "Clinical judgment priority decision", activeSources);
  const items = [{
    id: `item-${Date.now()}`,
    itemType: "multiple_choice",
    slideId: slides.find((slide) => slide.slideType === "practice_item")?.id,
    stem: `A nurse is caring for a patient with a cue related to ${payload.topic}. Which action best supports safe clinical judgment?`,
    options: [
      { id: "A", text: "Collect another relevant assessment cue before acting." },
      { id: "B", text: "Ignore the cue because it may be expected." },
      { id: "C", text: "Delegate follow-up without reviewing the patient." },
      { id: "D", text: "Document the finding at the end of the shift only." },
    ],
    correctAnswer: "A",
    rationale: "Collecting a relevant assessment cue keeps the nurse aligned with the clinical judgment process and supports safe prioritization.",
    tags: { nclexCategory: "Physiological Integrity", cjmStep: "Analyze Cues", nursingProcess: "Assessment", bloomLevel: "Apply" },
    difficulty: payload.settings?.difficulty || "application",
  }];
  const citations = slides.map((slide, index) => ({
    id: `cit-${Date.now()}-${index}`,
    slideId: slide.id,
    sourceId: slide.evidence?.sourceId || activeSources[index % activeSources.length]?.id || sources[0].id,
    documentId: slide.evidence?.documentId,
    chunkId: slide.evidence?.chunkId,
    citationLabel: slide.evidence?.citationLabel || activeSources[index % activeSources.length]?.title || sources[0].title,
    excerpt: slide.evidence?.text || "Approved source truth is cited and paraphrased for local MVP preview.",
    pageStart: slide.evidence?.pageStart,
    pageEnd: slide.evidence?.pageEnd,
    relevanceScore: "0.8500",
    createdAt: new Date().toISOString(),
  }));
  const qaResults = [
    ["source_traceability", "Source Traceability", "pass", `${slides.length}/${slides.length} slides have traceable citations.`],
    ["learner_only_visible_slides", "Learner-only Visible Slides", "pass", "Visible slide content stays learner-facing."],
    ["exam_anchor_density", "Exam Anchor Density", "pass", "Every slide carries an NCLEX category."],
    ["retrieval_practice", "Retrieval and Application", "pass", "Slides include retrieval prompts."],
    ["rationale_coverage", "Rationale Coverage", "pass", "Practice items include answer keys and rationales."],
    ["clinical_judgment_alignment", "Clinical Judgment Alignment", "pass", "Slides and items include CJM tags."],
    ["common_trap_coverage", "Common Trap Coverage", "pass", "Common trap coverage is present."],
    ["cognitive_load", "Cognitive Load", "pass", "Slides stay within compact visible content blocks."],
    ["accessibility", "Accessibility", "pass", "Every slide has a title and retrieval prompt."],
    ["assessment_blueprint", "Assessment Blueprint", "pass", "Practice item includes NCLEX/CJM tags."],
    ["student_reception_review", "Student Reception Review", "pass", "Prediction, practice, rationale, and takeaway are present."],
    ["proprietary_source_safety", "Proprietary-source Safety", "pass", "Source content is paraphrased in the local preview."],
    ["artifact_truthfulness", "Artifact Truthfulness", "pass", "Citations point to selected source records."],
  ].map(([gateKey, gateName, status, details]) => ({
    id: `qa-${gateKey}`,
    gateKey,
    gateName,
    status,
    details,
    score: status === "pass" ? "100" : "0",
    checkedAt: new Date().toISOString(),
  }));
  const qaSummary = statusBadgeSummary(qaResults);
  const lessonPackage = {
    id,
    title: payload.title || "Active Lesson: Clinical Judgment",
    topic: payload.topic || "Clinical judgment priority decision",
    audience: payload.audience || "Prelicensure RN",
    status: "qa_ready",
    sourceIds: payload.sourceIds || [],
    taxonomySnapshot: {
      NCLEX: [{ code: "PHYS", label: "Physiological Integrity" }],
      CJM: [{ code: "recognize-cues", label: "Recognize Cues" }, { code: "analyze-cues", label: "Analyze Cues" }],
      "Nursing Process": [{ code: "assessment", label: "Assessment" }],
      Bloom: [{ code: "apply", label: "Apply" }],
    },
    deckModel: { slides, generation },
    manifest: {
      packageId: id,
      generation,
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
    },
    qaSummary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  packages.unshift(lessonPackage);
  const detail = {
    package: lessonPackage,
    sources: activeSources,
    slides,
    items,
    citations,
    qaResults,
    generationRuns: [generationRun],
    artifacts: [],
    contractValidations: [],
    generation,
  };
  packageDetails.set(id, detail);
  const validation = validateLessonContract(detail, "harrity");
  generationRun.status = "completed";
  generationRun.evidenceSnapshot = {
    refs: citations.map((citation) => ({
      citationLabel: citation.citationLabel,
      sourceId: citation.sourceId,
      documentId: citation.documentId,
      chunkId: citation.chunkId,
      pageStart: citation.pageStart,
      pageEnd: citation.pageEnd,
    })),
  };
  generationRun.taxonomySnapshot = lessonPackage.taxonomySnapshot;
  generationRun.validationSummary = { qa: qaSummary, contract: validation.validationSummary };
  generationRun.completedAt = nowIso();
  return packageDetails.get(id);
}

function csv(headers, rows) {
  const escape = (value) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

async function exportZip(detail, profile = "harrity") {
  const zip = new JSZip();
  validateLessonContract(detail, profile);
  for (const artifact of buildPackageArtifactPayloads(detail, profile)) {
    zip.file(artifact.fileName, serializeArtifactContent(artifact));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function uniquePreviewStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = compactText(value || "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function previewAssessmentBridge(detail) {
  const bridge = detail.package.manifest?.assessmentBridge
    || detail.package.taxonomySnapshot?.assessmentBridge
    || detail.package.deckModel?.assessmentBridge
    || null;
  if (bridge?.weakTopic || bridge?.nclexCategory || bridge?.cjmStep) return bridge;

  return {
    status: "derived_from_lesson_tags",
    weakTopic: detail.package.topic || "Clinical judgment",
    atiCategory: detail.sources?.find((source) => source.subject)?.subject || null,
    nclexCategory: detail.slides?.find((slide) => slide.nclexCategory)?.nclexCategory || null,
    cjmStep: detail.slides?.find((slide) => slide.cjmStep)?.cjmStep || null,
    sourceTitle: detail.sources?.[0]?.title || null,
    note: "Derived from published lesson tags for learner display.",
  };
}

function attachPreviewAssessmentBridge(detail, data = {}) {
  const selectedSource = data.sourceId
    ? (detail.sources || []).find((source) => source.id === data.sourceId)
    : null;
  const attachedAt = nowIso();
  const assessmentBridge = {
    status: "ready",
    weakTopic: data.weakTopic || detail.package.topic || "Clinical judgment",
    atiCategory: data.atiCategory || null,
    nclexCategory: data.nclexCategory || detail.slides?.find((slide) => slide.nclexCategory)?.nclexCategory || null,
    cjmStep: data.cjmStep || detail.slides?.find((slide) => slide.cjmStep)?.cjmStep || null,
    sourceId: selectedSource?.id || null,
    sourceTitle: selectedSource?.title || null,
    note: data.note || "",
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    rationale: data.rationale || "",
    sourceEvidence: Array.isArray(data.sourceEvidence) ? data.sourceEvidence : [],
    agentMode: data.agentMode || null,
    attachedAt,
    attachedBy: "local-preview",
  };
  detail.package.manifest = {
    ...(detail.package.manifest || {}),
    assessmentBridge,
    pilot: {
      ...((detail.package.manifest || {}).pilot || {}),
      officialPackage: Boolean(data.officialPilotPackage ?? true),
      officialPackageSetAt: attachedAt,
    },
  };
  detail.package.taxonomySnapshot = {
    ...(detail.package.taxonomySnapshot || {}),
    assessmentBridge,
  };
  detail.package.deckModel = {
    ...(detail.package.deckModel || {}),
    assessmentBridge,
  };
  detail.package.updatedAt = attachedAt;
  return assessmentBridge;
}

function previewAiAssessmentBridge(detail) {
  const slide = detail.slides?.find((candidate) => candidate.nclexCategory || candidate.cjmStep) || detail.slides?.[0] || {};
  const item = detail.items?.[0] || {};
  const weakTopic = detail.package.topic || slide.title || "Clinical judgment";
  return {
    weakTopic,
    atiCategory: slide.nclexCategory || item.tags?.nclexCategory || "Psychosocial Integrity",
    nclexCategory: slide.nclexCategory || item.tags?.nclexCategory || "Psychosocial Integrity",
    cjmStep: slide.cjmStep || item.tags?.cjmStep || "Analyze Cues",
    confidence: 0.82,
    rationale: `Local preview mapped this lesson to ${weakTopic} using slide, item, and citation labels without spending live AI credits.`,
    sourceEvidence: uniquePreviewStrings([
      slide.title,
      item.stem,
      ...(detail.citations || []).map((citation) => citation.citationLabel),
    ]).slice(0, 4),
    agentMode: lessonBuilderAgentStatus().aiMode || "local_preview",
  };
}

function previewSourceLabels(detail) {
  return uniquePreviewStrings([
    ...(detail.sources || []).map((source) => source.title),
    ...(detail.citations || []).map((citation) => citation.citationLabel),
  ]).slice(0, 8);
}

function previewLessonSummary(detail) {
  const assessmentBridge = previewAssessmentBridge(detail);
  const slideTags = (detail.slides || []).flatMap((slide) => [
    slide.nclexCategory,
    slide.cjmStep,
    slide.nursingProcess,
    slide.bloomLevel,
  ]);
  const itemTags = (detail.items || []).flatMap((item) => [
    item.tags?.nclexCategory,
    item.tags?.cjmStep,
    item.tags?.nursingProcess,
    item.tags?.bloomLevel,
    item.difficulty,
  ]);
  const slideCount = detail.slides?.length || 0;
  const practiceCount = detail.items?.length || 0;
  const sourceLabels = previewSourceLabels(detail);
  const guidedNotesAvailable = (detail.slides || []).some((slide) => compactText(slide.guidedNotes || ""));

  return {
    id: detail.package.id,
    title: detail.package.title,
    topic: detail.package.topic,
    audience: detail.package.audience,
    learnerUrl: `/lessons/${detail.package.id}`,
    publishedAt: detail.package.publishedAt,
    subject: assessmentBridge?.atiCategory || detail.sources?.find((source) => source.subject)?.subject || detail.package.topic || "Nursing fundamentals",
    weakTopic: assessmentBridge?.weakTopic || detail.package.topic,
    atiCategory: assessmentBridge?.atiCategory || null,
    nclexCategory: assessmentBridge?.nclexCategory || detail.slides?.find((slide) => slide.nclexCategory)?.nclexCategory || null,
    cjmStep: assessmentBridge?.cjmStep || detail.slides?.find((slide) => slide.cjmStep)?.cjmStep || null,
    slideCount,
    practiceCount,
    citationCount: detail.citations?.length || 0,
    guidedNotesAvailable,
    sourceLabels,
    tags: uniquePreviewStrings([assessmentBridge?.weakTopic, ...slideTags, ...itemTags]).slice(0, 10),
    estimatedMinutes: Math.max(8, Math.min(45, Math.round(slideCount * 2 + practiceCount * 4))),
    trustSignals: {
      sourceBacked: (detail.citations?.length || 0) > 0,
      citations: detail.citations?.length || 0,
      sources: detail.sources?.length || 0,
      guidedNotes: guidedNotesAvailable,
      rationales: (detail.items || []).every((item) => compactText(item.rationale || "")),
    },
  };
}

function previewPublishedLessons() {
  return Array.from(packageDetails.values())
    .filter((detail) => detail.package.status === "published")
    .sort((a, b) => String(b.package.publishedAt || b.package.createdAt || "").localeCompare(String(a.package.publishedAt || a.package.createdAt || "")));
}

function previewReleaseReadinessPayload() {
  const latest = previewPublishedLessons()[0] || null;
  const bridge = latest ? previewAssessmentBridge(latest) : null;
  const source = latest?.sources?.[0] || sources.find((candidate) => candidate.metadata?.pilot?.officialSource) || sources[0] || null;
  const normalizedSourceReady = Boolean(source);
  const officialPilotSourceReady = Boolean(source?.metadata?.pilot?.officialSource || source?.metadata?.normalization?.officialPilot || source);
  const assessmentBridgeReady = Boolean(bridge?.weakTopic);
  const packageReady = Boolean(latest);
  const blockers = [
    {
      key: "published_lesson",
      label: "Published learner lesson",
      status: packageReady ? "pass" : "fail",
      detail: packageReady ? latest.package.title : "No published preview lesson is available.",
    },
    {
      key: "source_normalization",
      label: "Preview source readiness",
      status: normalizedSourceReady ? "pass" : "fail",
      detail: source?.title || "No approved preview source is available.",
    },
    {
      key: "assessment_bridge",
      label: "Weak-topic bridge",
      status: assessmentBridgeReady ? "pass" : "fail",
      detail: bridge?.weakTopic || "No weak-topic bridge is attached or derivable.",
    },
    {
      key: "typescript",
      label: "Legacy TypeScript debt",
      status: "warn",
      detail: "Focused launch-surface typecheck passes; broad legacy diagnostics remain documented.",
    },
  ];

  return {
    generatedAt: nowIso(),
    previewMode: true,
    pilotReady: packageReady && normalizedSourceReady && officialPilotSourceReady && assessmentBridgeReady,
    latestPublishedPackageId: latest?.package.id || null,
    blockers,
    health: {
      runtime: "local_preview",
      pilotReadiness: {
        status: packageReady ? "ready" : "incomplete",
        normalizedSourceReady,
        officialPilotSourceReady,
        assessmentBridgeReady,
        assessmentBridge: bridge,
        assignmentActive: true,
        latestPackageActiveAssignmentCount: latest ? 1 : 0,
        learnerCompletionPresent: true,
        latestPackageCompletionCount: latest ? 1 : 0,
        latestPackageId: latest?.package.id || null,
      },
    },
  };
}

function previewTopicTiles(lessons) {
  const groups = new Map();
  for (const lesson of lessons) {
    const label = lesson.weakTopic || lesson.nclexCategory || lesson.subject || "Clinical Judgment";
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "clinical-judgment";
    const group = groups.get(key) || {
      key,
      label,
      count: 0,
      description: `Practice source-backed clinical judgment for ${label}.`,
    };
    group.count += 1;
    groups.set(key, group);
  }
  return Array.from(groups.values()).slice(0, 8);
}

function previewStudentHomePayload() {
  const lessons = previewPublishedLessons().map(previewLessonSummary);
  return {
    generatedAt: nowIso(),
    featuredLesson: lessons[0] || null,
    lessons,
    topicTiles: previewTopicTiles(lessons),
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

function previewEventsForSession(sessionId) {
  return previewStudentEvents
    .filter((event) => event.sessionId === sessionId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function previewStudentProgressPayload(sessionId) {
  const events = previewEventsForSession(sessionId);
  const eventsByPackage = new Map();
  for (const event of events) {
    const existing = eventsByPackage.get(event.packageId) || [];
    existing.push(event);
    eventsByPackage.set(event.packageId, existing);
  }

  const lessonStates = Array.from(eventsByPackage.entries()).map(([packageId, lessonEvents]) => {
    const detail = packageDetails.get(packageId);
    if (!detail || detail.package.status !== "published") return null;
    const summary = previewLessonSummary(detail);
    const eventsOfType = (type) => lessonEvents.filter((event) => event.eventType === type);
    const savedEvents = eventsOfType("lesson_saved");
    const openedEvents = eventsOfType("lesson_opened");
    const completedEvents = eventsOfType("lesson_completed");
    const practiceEvents = eventsOfType("practice_attempted");
    const feedbackEvents = eventsOfType("feedback_submitted");
    const lastPractice = practiceEvents[0];
    return {
      packageId,
      lesson: summary,
      learnerUrl: summary.learnerUrl,
      status: completedEvents.length ? "completed" : openedEvents.length || savedEvents.length ? "in_progress" : "not_started",
      saved: savedEvents.length > 0,
      opened: openedEvents.length > 0,
      completed: completedEvents.length > 0,
      savedAt: savedEvents[0]?.createdAt || null,
      openedAt: openedEvents[openedEvents.length - 1]?.createdAt || null,
      completedAt: completedEvents[0]?.createdAt || null,
      lastActivityAt: lessonEvents[0]?.createdAt || null,
      viewedSlides: new Set(lessonEvents.filter((event) => event.eventType === "slide_viewed").map((event) => event.slideId).filter(Boolean)).size,
      practiceAttempts: practiceEvents.length,
      feedbackSubmitted: feedbackEvents.length,
      lastPracticeResult: lastPractice ? {
        itemId: lastPractice.itemId || null,
        selectedAnswer: lastPractice.payload?.selectedAnswer || null,
        correctAnswer: lastPractice.payload?.correctAnswer || null,
        isCorrect: typeof lastPractice.payload?.isCorrect === "boolean" ? lastPractice.payload.isCorrect : null,
        difficulty: lastPractice.payload?.difficulty || null,
        attemptedAt: lastPractice.createdAt,
      } : null,
      latestFeedback: feedbackEvents[0] ? {
        rating: feedbackEvents[0].payload?.rating || null,
        comment: feedbackEvents[0].payload?.comment || "",
        submittedAt: feedbackEvents[0].createdAt,
      } : null,
    };
  }).filter(Boolean);

  lessonStates.sort((a, b) => String(b.lastActivityAt || "").localeCompare(String(a.lastActivityAt || "")));
  const touchedLessonIds = new Set(lessonStates.map((state) => state.packageId));
  const completedLessonIds = new Set(lessonStates.filter((state) => state.completed).map((state) => state.packageId));
  const interestTags = new Set();
  for (const state of lessonStates) {
    [
      state.lesson.weakTopic,
      state.lesson.nclexCategory,
      state.lesson.cjmStep,
      state.lesson.subject,
      ...(state.lesson.tags || []),
    ].filter(Boolean).forEach((tag) => interestTags.add(String(tag).toLowerCase()));
  }

  const recommendedLessons = previewPublishedLessons()
    .map(previewLessonSummary)
    .filter((lesson) => !completedLessonIds.has(lesson.id))
    .map((lesson) => {
      const tags = [lesson.weakTopic, lesson.nclexCategory, lesson.cjmStep, lesson.subject, ...(lesson.tags || [])]
        .filter(Boolean)
        .map((tag) => String(tag).toLowerCase());
      const score = tags.reduce((total, tag) => total + (interestTags.has(tag) ? 1 : 0), 0);
      return { lesson, score, touched: touchedLessonIds.has(lesson.id) };
    })
    .sort((a, b) => b.score - a.score || Number(a.touched) - Number(b.touched))
    .map((entry) => entry.lesson)
    .slice(0, 6);

  return {
    generatedAt: nowIso(),
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

function previewStudentStudyPackPayload(sessionId) {
  const progress = previewStudentProgressPayload(sessionId);
  const activeLessonIds = Array.from(new Set([
    ...progress.savedLessons.map((state) => state.packageId),
    ...progress.recentLessons.map((state) => state.packageId),
    ...progress.completedLessons.map((state) => state.packageId),
  ])).slice(0, 12);
  const lessons = activeLessonIds.map((packageId) => {
    const detail = packageDetails.get(packageId);
    if (!detail || detail.package.status !== "published") return null;
    const learnerPayload = previewLearnerPayload(detail);
    return {
      summary: previewLessonSummary(detail),
      guidedNotes: learnerPayload.slides
        .filter((slide) => compactText(slide.guidedNotes || ""))
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
    };
  }).filter(Boolean);

  return {
    generatedAt: nowIso(),
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

function previewLearnerPayload(detail, options = {}) {
  const citationsBySlide = new Map();
  const citationsByItem = new Map();
  for (const citation of detail.citations || []) {
    if (citation.slideId) {
      const existing = citationsBySlide.get(citation.slideId) || [];
      existing.push(citation);
      citationsBySlide.set(citation.slideId, existing);
    }
    if (citation.itemId) {
      const existing = citationsByItem.get(citation.itemId) || [];
      existing.push(citation);
      citationsByItem.set(citation.itemId, existing);
    }
  }
  const serializeCitation = (citation) => ({
    id: citation.id,
    citationLabel: citation.citationLabel,
    pageStart: citation.pageStart,
    pageEnd: citation.pageEnd,
    excerpt: citation.excerpt,
  });

  return {
    package: {
      id: detail.package.id,
      title: detail.package.title,
      topic: detail.package.topic,
      audience: detail.package.audience,
      status: detail.package.status,
      publishedAt: detail.package.publishedAt,
      assessmentBridge: previewAssessmentBridge(detail),
      manifestSummary: {
        packageId: detail.package.manifest?.packageId || detail.package.id,
        exportProfile: detail.package.manifest?.exportProfile || "harrity",
        requiredFileCount: Array.isArray(detail.package.manifest?.requiredFiles) ? detail.package.manifest.requiredFiles.length : 11,
        counts: detail.package.manifest?.counts || {
          sources: detail.sources?.length || 0,
          slides: detail.slides?.length || 0,
          items: detail.items?.length || 0,
          citations: detail.citations?.length || 0,
        },
      },
      reviewSummary: options.controlledPreview ? topicProductionPreviewReviewSummary(detail) : null,
    },
    assignment: null,
    deck: {
      grammar: detail.package.deckModel?.grammar || "harrity-v0.3-web-lesson",
      slideCount: detail.slides?.length || 0,
    },
    sources: (detail.sources || []).map((source) => ({
      title: source.title,
      sourceKind: source.sourceKind,
      sourceType: source.sourceType,
      subject: source.subject,
      edition: source.edition,
      citationPolicy: source.citationPolicy,
      normalizationStatus: source.metadata?.normalization?.status || null,
      officialPilotSource: Boolean(source.metadata?.pilot?.officialSource || source.metadata?.normalization?.officialPilot),
    })),
    slides: (detail.slides || []).map((slide) => ({
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
    practiceItems: (detail.items || []).map((item) => ({
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
    citations: (detail.citations || []).map(serializeCitation),
  };
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/privacy/consent" && req.method === "GET") {
    return sendJson(res, 200, privacyConsent);
  }

  if (url.pathname === "/api/privacy/consent" && req.method === "POST") {
    const body = await readJson(req);
    privacyConsent = {
      id: makeId("consent"),
      ...(body.preferences || {}),
      preferences: body.preferences || {},
      method: body.method || "local_preview",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return sendJson(res, 200, privacyConsent);
  }

  if (url.pathname === "/api/student/home" && req.method === "GET") {
    return sendJson(res, 200, previewStudentHomePayload());
  }

  if (url.pathname === "/api/student/lessons" && req.method === "GET") {
    return sendJson(res, 200, {
      lessons: previewPublishedLessons().map(previewLessonSummary),
      generatedAt: nowIso(),
    });
  }

  const studentSummaryMatch = url.pathname.match(/^\/api\/student\/lessons\/([^/]+)\/summary$/);
  if (studentSummaryMatch && req.method === "GET") {
    const detail = packageDetails.get(studentSummaryMatch[1]);
    if (!detail || detail.package.status !== "published") return notFound(res);
    return sendJson(res, 200, { lesson: previewLessonSummary(detail), generatedAt: nowIso() });
  }

  if (url.pathname === "/api/student/progress" && req.method === "GET") {
    const sessionId = compactText(url.searchParams.get("sessionId") || "");
    if (sessionId.length < 8) {
      return sendJson(res, 400, { error: "A valid student session id is required" });
    }
    return sendJson(res, 200, previewStudentProgressPayload(sessionId));
  }

  if (url.pathname === "/api/student/study-pack" && req.method === "GET") {
    const sessionId = compactText(url.searchParams.get("sessionId") || "");
    if (sessionId.length < 8) {
      return sendJson(res, 400, { error: "A valid student session id is required" });
    }
    return sendJson(res, 200, previewStudentStudyPackPayload(sessionId));
  }

  if (url.pathname === "/api/generate-professional-guide" && req.method === "POST") {
    const body = await readJson(req);
    const guide = buildPreviewStudyGuideFallback({
      reportId: body.reportId || "demo-report",
      maxTopics: body.options?.maxTopics || (body.options?.focusOnTopGaps ? 2 : 5),
    });
    return sendJson(res, 200, {
      success: true,
      guide,
      status: "launch_template_fallback",
      warning: "Local preview returned the no-cost launch study guide template.",
      message: "Launch preview study guide generated successfully",
    });
  }

  if ((url.pathname === "/api/assessment-reports" || url.pathname === "/api/assessment-reports/upload") && req.method === "POST") {
    const upload = await readMultipartDocument(req);
    const reportId = makeId("report");
    const sourceTitle = compactText(upload.filename || upload.title || "student-assessment-upload.pdf");
    return sendJson(res, 200, {
      reportId,
      message: "Assessment report processed successfully in local preview",
      topicsFound: 2,
      isAuthenticated: false,
      guestId: "guest_local_preview",
      upload: {
        filename: sourceTitle,
        bytes: upload.buffer?.length || upload.text?.length || 0,
      },
      nextStep: `/professional-study-guide/${reportId}`,
    });
  }

  const publicLessonMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)$/);
  if (publicLessonMatch && req.method === "GET") {
    const detail = packageDetails.get(publicLessonMatch[1]);
    const previewKey = url.searchParams.get("previewKey") || "";
    if (!detail || !topicProductionPreviewAllowed(detail.package, previewKey)) return notFound(res);
    return sendJson(res, 200, previewLearnerPayload(detail, {
      controlledPreview: Boolean(previewKey && detail.package.status !== "published"),
    }));
  }

  const previewReviewMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)\/preview-review$/);
  if (previewReviewMatch && req.method === "POST") {
    const detail = packageDetails.get(previewReviewMatch[1]);
    const body = await readJson(req);
    const previewKey = compactText(body.previewKey || "");
    const expectedPreviewKey = detail?.package.manifest?.topicProductionStudentLaunchDecision?.previewKey;
    if (!detail || !expectedPreviewKey || expectedPreviewKey !== previewKey) return notFound(res);
    const outcome = topicProductionPreviewReviewOutcomes.has(body.outcome) ? body.outcome : "";
    if (!outcome) {
      return sendJson(res, 400, { error: "Invalid preview review outcome" });
    }

    const previewReview = {
      outcome,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "controlled_preview_reviewer",
    };
    const existingDecision = detail.package.manifest?.topicProductionStudentLaunchDecision || {};
    detail.package.manifest = {
      ...(detail.package.manifest || {}),
      topicProductionStudentLaunchDecision: {
        ...existingDecision,
        previewKey: existingDecision.previewKey || previewKey,
        previewReview,
      },
    };
    detail.package.updatedAt = nowIso();
    return sendJson(res, 200, {
      recorded: true,
      previewReview,
      reviewSummary: topicProductionPreviewReviewSummary(detail),
    });
  }

  const publicLessonSignalMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)\/(events|feedback)$/);
  if (publicLessonSignalMatch && req.method === "POST") {
    const detail = packageDetails.get(publicLessonSignalMatch[1]);
    const body = await readJson(req);
    if (!detail || !topicProductionPreviewAllowed(detail.package, body.previewKey)) return notFound(res);
    const eventType = publicLessonSignalMatch[2] === "feedback" ? "feedback_submitted" : compactText(body.eventType || "lesson_opened");
    const sessionId = compactText(body.sessionId || makeId("session"));
    const event = {
      id: makeId("learner-event"),
      packageId: publicLessonSignalMatch[1],
      sessionId,
      eventType,
      slideId: body.slideId || null,
      itemId: body.itemId || null,
      payload: publicLessonSignalMatch[2] === "feedback"
        ? { ...(body.payload || {}), rating: body.rating || null, comment: body.comment || "" }
        : body.payload || {},
      createdAt: nowIso(),
    };
    previewStudentEvents.unshift(event);
    return sendJson(res, 200, {
      eventId: event.id,
      sessionId,
      recorded: true,
      preview: true,
    });
  }

  if (url.pathname === "/api/privacy/consent-history" && req.method === "GET") {
    return sendJson(res, 200, { history: privacyConsent ? [privacyConsent] : [] });
  }

  if (url.pathname === "/api/admin/session") {
    return sendJson(res, 200, {
      authenticated: true,
      csrfToken,
      user: { email: "local-preview@nurseprep.app", role: "admin", permissions: ["full_access"] },
    });
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readJson(req);
    const password = compactText(body.password || "");
    if (password.length < 8) {
      return sendJson(res, 400, { error: "Validation failed", details: ["Password must be at least 8 characters"] });
    }
    return sendJson(res, 201, { success: true, user: { id: makeId("preview-user"), email: body.email || "preview@example.com" } });
  }

  if (url.pathname === "/api/admin/login" && req.method === "POST") {
    return sendJson(res, 200, {
      success: true,
      authenticated: true,
      csrfToken,
      user: { email: "local-preview@nurseprep.app", role: "admin", permissions: ["full_access"] },
    });
  }

  if (url.pathname === "/api/admin/logout") return sendJson(res, 200, { success: true });

  if (url.pathname === "/api/admin/topic-production-matrix" && req.method === "GET") {
    return sendJson(res, 200, topicProductionMatrixPayload());
  }

  if (url.pathname === "/api/admin/topic-production-matrix/airtable-tracker-contract" && req.method === "GET") {
    return sendJson(res, 200, {
      generatedAt: nowIso(),
      tracker: topicProductionAirtableTrackerPayload(),
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/phase-one/queue" && req.method === "POST") {
    const body = await readJson(req);
    const payload = topicProductionMatrixPayload();
    const topics = payload.phaseOneCheckpoint.topics.filter((topic) => topic.found);
    const review = {
      decision: "build_lesson",
      reviewerNotes: compactText(body.reviewerNotes || "Phase 1 starter topic queued for the $100-$250 review checkpoint."),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };

    for (const topic of topics) {
      if (topic.sourceType === "lesson_package") {
        const detail = packageDetails.get(topic.rowId);
        if (detail) {
          detail.package.manifest = {
            ...(detail.package.manifest || {}),
            topicProductionReview: review,
          };
          detail.package.updatedAt = nowIso();
        }
    } else if (topic.sourceType === "content_block" || topic.sourceType === "topic_candidate") {
        topicProductionReviewOverrides.set(topicProductionRowKey(topic.sourceType, topic.rowId), review);
      }
    }

    const nextPayload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(nextPayload.rows);
    return sendJson(res, 200, {
      success: true,
      queuedCount: topics.length,
      phaseOneCheckpoint: nextPayload.phaseOneCheckpoint,
      packets: topicProductionBuildPackets(nextRows),
    });
  }

  const draftReviewMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/drafts\/([^/]+)\/review$/);
  if (draftReviewMatch && req.method === "PATCH") {
    const packageId = decodeURIComponent(draftReviewMatch[1]);
    const detail = packageDetails.get(packageId);
    if (!detail) return notFound(res);
    const body = await readJson(req);
    const decision = topicProductionDraftReviewDecisions.has(body.decision) ? body.decision : "unreviewed";
    const review = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    detail.package.manifest = {
      ...(detail.package.manifest || {}),
      topicProductionDraftReview: review,
    };
    detail.package.updatedAt = nowIso();
    return sendJson(res, 200, {
      success: true,
      package: detail.package,
      draftReview: review,
      draftPackage: topicProductionDraftSummary(detail),
    });
  }

  const phaseThreeDecisionMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/drafts\/([^/]+)\/phase-3-decision$/);
  if (phaseThreeDecisionMatch && req.method === "PATCH") {
    const packageId = decodeURIComponent(phaseThreeDecisionMatch[1]);
    const detail = packageDetails.get(packageId);
    if (!detail) return notFound(res);
    const body = await readJson(req);
    const decision = topicProductionPhaseThreeDecisions.has(body.decision) ? body.decision : "unreviewed";
    const phaseThreeDecision = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    detail.package.manifest = {
      ...(detail.package.manifest || {}),
      topicProductionPhaseThreeDecision: phaseThreeDecision,
    };
    detail.package.updatedAt = nowIso();
    return sendJson(res, 200, {
      success: true,
      package: detail.package,
      phaseThreeDecision,
      draftPackage: topicProductionDraftSummary(detail),
    });
  }

  const studentLaunchDecisionMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/drafts\/([^/]+)\/student-launch-decision$/);
  if (studentLaunchDecisionMatch && req.method === "PATCH") {
    const packageId = decodeURIComponent(studentLaunchDecisionMatch[1]);
    const detail = packageDetails.get(packageId);
    if (!detail) return notFound(res);
    const body = await readJson(req);
    const decision = topicProductionStudentLaunchDecisions.has(body.decision) ? body.decision : "unreviewed";
    const draftSummary = topicProductionDraftSummary(detail);
    const blockers = [
      !draftSummary?.nextSpendApproved ? "Phase 2 draft is not approved for next checkpoint" : "",
      !draftSummary?.phaseThreeDecision?.decision || draftSummary.phaseThreeDecision.decision === "unreviewed" ? "Phase 3 production decision is not recorded" : "",
      Number(draftSummary?.slideCount || 0) < 5 ? "Lesson deck is too small for student review" : "",
      Number(draftSummary?.itemCount || 0) < 1 ? "Practice item is missing" : "",
      Number(draftSummary?.citationCount || 0) < 1 ? "Citations are missing" : "",
      Number(draftSummary?.failCount || 0) > 0 ? "QA has failures" : "",
    ].filter(Boolean);

    if (decision === "approve_student_preview" && blockers.length) {
      return sendJson(res, 400, { error: "Student preview is blocked", blockers });
    }

    const studentLaunchDecision = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
      previewKey: decision === "approve_student_preview"
        ? topicProductionPreviewKey(detail.package.manifest?.topicProductionStudentLaunchDecision?.previewKey)
        : null,
      previewReview: detail.package.manifest?.topicProductionStudentLaunchDecision?.previewReview || null,
    };
    detail.package.manifest = {
      ...(detail.package.manifest || {}),
      topicProductionStudentLaunchDecision: studentLaunchDecision,
    };
    detail.package.updatedAt = nowIso();
    return sendJson(res, 200, {
      success: true,
      package: detail.package,
      studentLaunchDecision,
      draftPackage: topicProductionDraftSummary(detail),
    });
  }

  const mediaWorkOrderReviewMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/media-work-orders\/([^/]+)\/review$/);
  if (mediaWorkOrderReviewMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(mediaWorkOrderReviewMatch[1]);
    const payload = topicProductionMatrixPayload();
    const currentRows = topicProductionMediaWorkOrderRows(payload.rows);
    const current = currentRows.find((row) => row["Work Order ID"] === workOrderId);
    if (!current) return sendJson(res, 404, { error: "Media work order not found" });

    const body = await readJson(req);
    const decision = topicProductionMediaWorkOrderDecisions.has(body.decision) ? body.decision : "unreviewed";
    const review = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    topicProductionMediaWorkOrderReviewOverrides.set(topicProductionRowKey("media_work_order", workOrderId), review);
    const refreshedPayload = topicProductionMatrixPayload();
    const refreshedRows = topicProductionMediaWorkOrderRows(refreshedPayload.rows);
    const row = refreshedRows.find((candidate) => candidate["Work Order ID"] === workOrderId) || null;
    return sendJson(res, 200, { success: true, review, row });
  }

  const mediaScaffoldReviewMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/media-scaffold-pack\/([^/]+)\/review$/);
  if (mediaScaffoldReviewMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(mediaScaffoldReviewMatch[1]);
    const payload = topicProductionMatrixPayload();
    const currentRows = topicProductionMediaScaffoldPackRows(payload.rows);
    const current = currentRows.find((row) => row["Approved Work Order ID"] === workOrderId);
    if (!current) return sendJson(res, 404, { error: "Media scaffold row not found" });

    const body = await readJson(req);
    const decision = topicProductionMediaScaffoldReviewDecisions.has(body.decision) ? body.decision : "unreviewed";
    const review = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    topicProductionMediaScaffoldReviewOverrides.set(topicProductionRowKey("media_scaffold", workOrderId), review);
    const refreshedPayload = topicProductionMatrixPayload();
    const refreshedRows = topicProductionMediaScaffoldPackRows(refreshedPayload.rows);
    const row = refreshedRows.find((candidate) => candidate["Approved Work Order ID"] === workOrderId) || null;
    return sendJson(res, 200, { success: true, review, row });
  }

  const mediaTextDraftReviewMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/media-text-draft-pack\/([^/]+)\/review$/);
  if (mediaTextDraftReviewMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(mediaTextDraftReviewMatch[1]);
    const payload = topicProductionMatrixPayload();
    const currentRows = topicProductionMediaTextDraftPackRows(payload.rows);
    const current = currentRows.find((row) => row["Approved Work Order ID"] === workOrderId);
    if (!current) return sendJson(res, 404, { error: "Media text draft row not found" });

    const body = await readJson(req);
    const decision = topicProductionMediaTextDraftReviewDecisions.has(body.decision) ? body.decision : "unreviewed";
    const review = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    topicProductionMediaTextDraftReviewOverrides.set(topicProductionRowKey("media_text_draft", workOrderId), review);
    const refreshedPayload = topicProductionMatrixPayload();
    const refreshedRows = topicProductionMediaTextDraftPackRows(refreshedPayload.rows);
    const row = refreshedRows.find((candidate) => candidate["Approved Work Order ID"] === workOrderId) || null;
    return sendJson(res, 200, { success: true, review, row });
  }

  const packageReviewBlueprintMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/package-review-blueprint\/([^/]+)\/review$/);
  if (packageReviewBlueprintMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(packageReviewBlueprintMatch[1]);
    const payload = topicProductionMatrixPayload();
    const currentRows = topicProductionPackageReviewBlueprintRows(payload.rows);
    const current = currentRows.find((row) => row["Approved Work Order ID"] === workOrderId);
    if (!current) return sendJson(res, 404, { error: "Package review blueprint row not found" });

    const body = await readJson(req);
    const decision = topicProductionPackageReviewBlueprintDecisions.has(body.decision) ? body.decision : "unreviewed";
    const review = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    topicProductionPackageReviewBlueprintOverrides.set(topicProductionRowKey("package_review_blueprint", workOrderId), review);
    const refreshedPayload = topicProductionMatrixPayload();
    const refreshedRows = topicProductionPackageReviewBlueprintRows(refreshedPayload.rows);
    const row = refreshedRows.find((candidate) => candidate["Approved Work Order ID"] === workOrderId) || null;
    return sendJson(res, 200, { success: true, review, row });
  }

  const topicReviewMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/([^/]+)\/([^/]+)\/review$/);
  if (topicReviewMatch && req.method === "PATCH") {
    const sourceType = topicReviewMatch[1];
    const id = decodeURIComponent(topicReviewMatch[2]);
    if (!["lesson_package", "content_block", "topic_candidate"].includes(sourceType)) {
      return sendJson(res, 400, { error: "Unsupported topic production source type" });
    }
    const body = await readJson(req);
    const decision = topicProductionReviewDecisions.has(body.decision) ? body.decision : "unreviewed";
    const review = {
      decision,
      reviewerNotes: compactText(body.reviewerNotes || ""),
      reviewedAt: nowIso(),
      reviewedBy: "local-preview@nurseprep.app",
    };
    topicProductionReviewOverrides.set(topicProductionRowKey(sourceType, id), review);
    const payload = topicProductionMatrixPayload();
    const row = payload.rows.find((candidate) => candidate.sourceType === sourceType && candidate.id === id) || null;
    return sendJson(res, 200, { success: true, review, row });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/export" && req.method === "GET") {
    const format = url.searchParams.get("format") || "csv";
    const payload = topicProductionMatrixPayload();
    const rows = topicProductionAirtableRows(payload.rows);

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="topic-production-airtable-queue-preview.json"`);
      return sendJson(res, 200, {
        generatedAt: payload.generatedAt,
        summary: payload.summary,
        airtableReady: true,
        rows,
      });
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="topic-production-airtable-queue-preview.csv"`);
    return res.end(topicProductionAirtableCsv(payload.rows));
  }

  if (url.pathname === "/api/admin/topic-production-matrix/human-review-pack" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionHumanReviewPackRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-3-human-review-pack-preview.csv"`);
      return res.end(topicProductionHumanReviewPackCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-3-human-review-pack-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_3_human_review_pack",
      budgetWindow: "$100-$500",
      count: records.length,
      reviewOptions: ["approve_mapping", "needs_edit", "hold"],
      costGuardrail: "Review placement first. Do not spend on AI polish, visuals, audio, or video until each row has an explicit review decision.",
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/media-pilot-pack" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionMediaPilotPackRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-pilot-pack-preview.csv"`);
      return res.end(topicProductionMediaPilotPackCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-pilot-pack-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_4_media_pilot_pack",
      budgetWindow: "$100-$500",
      count: records.length,
      nextAllowedSpend: records.length ? "Plan one approved topic only; media generation still requires explicit approval." : "Approve one Phase 3 placement before planning media.",
      costGuardrail: "This pack organizes where approved content belongs. It does not generate visuals, audio, video, or batch lesson media.",
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/media-work-orders" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionMediaWorkOrderRows(payload.rows);
    const estimatedTokens = topicProductionMediaWorkOrderLineItems.reduce((sum, item) => sum + item.tokens, 0);
    const estimatedDollars = topicProductionMediaWorkOrderLineItems.reduce((sum, item) => sum + item.dollars, 0);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-work-orders-preview.csv"`);
      return res.end(topicProductionMediaWorkOrderCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-work-orders-preview.json"`);
    return sendJson(res, 200, {
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
  }

  if (url.pathname === "/api/admin/topic-production-matrix/media-scaffold-pack" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionMediaScaffoldPackRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-scaffold-pack-preview.csv"`);
      return res.end(topicProductionMediaScaffoldPackCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-4-media-scaffold-pack-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_4_media_scaffold_pack",
      budgetWindow: "$100-$500",
      count: records.length,
      prerequisite: "A Phase 4 work order must be reviewed as approve_single_topic_scaffold.",
      costGuardrail: "Deterministic scaffold only. No AI generation call, no TTS, no rendered video, no paid visual generation.",
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/next-build-export" && req.method === "GET") {
    const format = url.searchParams.get("format") || "csv";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const rows = topicProductionAirtableRows(nextRows);

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="approved-next-build-queue-preview.json"`);
      return sendJson(res, 200, {
        generatedAt: payload.generatedAt,
        queue: "approved_next_build",
        includedDecisions: Array.from(topicProductionNextBuildDecisions),
        count: rows.length,
        rows,
      });
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="approved-next-build-queue-preview.csv"`);
    return res.end(topicProductionAirtableCsv(nextRows));
  }

  if (url.pathname === "/api/admin/topic-production-matrix/build-packets" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionBuildPackets(nextRows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="approved-build-packets-preview.csv"`);
      return res.end(topicProductionBuildPacketsCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="approved-build-packets-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "approved_build_packets",
      count: packets.length,
      packets,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/media-text-draft-pack" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionMediaTextDraftPackRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-5-media-text-draft-pack-preview.csv"`);
      return res.end(topicProductionMediaTextDraftPackCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-5-media-text-draft-pack-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_5_media_text_draft_pack",
      budgetWindow: "$100-$500 text-draft checkpoint",
      count: records.length,
      prerequisite: "A Phase 4 scaffold must be reviewed as approve_ai_draft_checkpoint.",
      costGuardrail: "Text-draft checkpoint only. No TTS, no rendered video, no paid visual generation, and no batch generation.",
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/package-assembly-pack" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionPackageAssemblyPackRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-6-package-assembly-pack-preview.csv"`);
      return res.end(topicProductionPackageAssemblyPackCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-6-package-assembly-pack-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_6_package_assembly_pack",
      budgetWindow: "$100-$500 package assembly checkpoint",
      count: records.length,
      prerequisite: "A Phase 5 text draft must be reviewed as approve_package_assembly_checkpoint.",
      costGuardrail: "Package assembly checkpoint only. No TTS, no rendered video, no paid visual generation, no batch generation, and no public publish without review.",
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/package-review-blueprint" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionPackageReviewBlueprintRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-7-package-review-blueprint-preview.csv"`);
      return res.end(topicProductionPackageReviewBlueprintCsv(payload.rows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-7-package-review-blueprint-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_7_package_review_blueprint",
      budgetWindow: "$100-$500 review-blueprint checkpoint",
      count: records.length,
      prerequisite: "A Phase 6 package assembly row must exist from an approved Phase 5 text draft.",
      costGuardrail: "Blueprint checkpoint only. No package publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/review-package-builds" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const records = topicProductionReviewPackageBuildRows(payload.rows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-9-review-package-builds-preview.csv"`);
      return res.end(topicProductionReviewPackageBuildCsv(payload.rows));
    }

    if (format === "zip") {
      const zipBuffer = await topicProductionReviewPackageBuildZip(payload.rows);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="phase-9-review-package-builds-preview.zip"`);
      return res.end(zipBuffer);
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-9-review-package-builds-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_9_review_package_builds",
      budgetWindow: "$100-$500 deterministic review-package checkpoint",
      count: records.length,
      prerequisite: "A Phase 8 blueprint decision must be approve_review_package_build.",
      costGuardrail: "Review package build only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
      records,
    });
  }

  const promoteReviewPackageMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/review-package-builds\/([^/]+)\/promote$/);
  if (promoteReviewPackageMatch && req.method === "POST") {
    const workOrderId = decodeURIComponent(promoteReviewPackageMatch[1]);
    const payload = topicProductionMatrixPayload();
    const records = topicProductionReviewPackageBuildRows(payload.rows);
    const record = records.find((candidate) => String(candidate["Approved Work Order ID"] || "") === workOrderId);
    if (!record) {
      return sendJson(res, 404, {
        error: "No approved Phase 9 review package build found for this work order",
        prerequisite: "Approve the Phase 8 blueprint build gate first.",
      });
    }
    const promotion = promoteTopicProductionReviewPackageDraft(record);
    return sendJson(res, 200, {
      created: promotion.created,
      package: promotion.detail.package,
      bundle: promotion.detail,
      promotion: {
        phase: "phase_10_unpublished_lesson_builder_draft",
        workOrderId,
        publishStatus: "not_published",
        mediaStatus: "not_started",
        costGuardrail: "Unpublished Lesson Builder draft only. No public publish, no TTS, no rendered video, no paid visual generation, and no batch generation.",
        lessonBuilderUrl: `/admin/lesson-builder?tab=review&packageId=${promotion.detail.package.id}`,
      },
    });
  }

  const creatorQaReviewPackageMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/review-package-builds\/([^/]+)\/creator-qa$/);
  if (creatorQaReviewPackageMatch && req.method === "POST") {
    const workOrderId = decodeURIComponent(creatorQaReviewPackageMatch[1]);
    const result = runTopicProductionCreatorQaGate(workOrderId);
    if (!result?.detail) {
      return sendJson(res, 409, {
        error: "No promoted unpublished draft found for this work order",
        prerequisite: "Promote the Phase 9 review package into Lesson Builder before running creator QA.",
      });
    }

    return sendJson(res, 200, {
      package: result.detail.package,
      bundle: result.detail,
      qa: result.qa,
      validation: result.validation,
      creatorQaGate: result.creatorQaGate,
    });
  }

  const controlledPreviewDecisionMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/review-package-builds\/([^/]+)\/controlled-preview-decision$/);
  if (controlledPreviewDecisionMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(controlledPreviewDecisionMatch[1]);
    const body = await readJson(req);
    const decision = topicProductionStudentLaunchDecisions.has(body.decision) ? body.decision : "unreviewed";
    const result = saveTopicProductionControlledPreviewDecision(workOrderId, decision, body.reviewerNotes || "");
    if (!result?.detail) {
      return sendJson(res, 409, {
        error: "No QA-ready promoted draft found for this work order",
        prerequisite: "Promote the review package and run creator QA before opening controlled preview.",
      });
    }
    if (result.blocked) {
      return sendJson(res, 400, { error: "Controlled preview is blocked", blockers: result.blockers });
    }

    return sendJson(res, 200, {
      success: true,
      package: result.detail.package,
      bundle: result.detail,
      studentLaunchDecision: result.studentLaunchDecision,
      controlledPreviewDecision: result.controlledPreviewDecision,
    });
  }

  const controlledPreviewReviewMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/review-package-builds\/([^/]+)\/preview-review$/);
  if (controlledPreviewReviewMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(controlledPreviewReviewMatch[1]);
    const body = await readJson(req);
    const outcome = topicProductionPreviewReviewOutcomes.has(body.outcome) ? body.outcome : "";
    if (!outcome) return sendJson(res, 400, { error: "Invalid preview review outcome" });
    const result = saveTopicProductionControlledPreviewReview(workOrderId, outcome, body.reviewerNotes || "");
    if (!result?.detail) {
      return sendJson(res, 409, {
        error: "No controlled preview draft found for this work order",
        prerequisite: "Approve controlled preview before recording preview review outcome.",
      });
    }
    if (result.blocked) {
      return sendJson(res, 400, { error: "Controlled preview review is blocked", blockers: result.blockers });
    }

    return sendJson(res, 200, {
      recorded: true,
      package: result.detail.package,
      bundle: result.detail,
      previewReview: result.previewReview,
      controlledPreviewReview: result.controlledPreviewReview,
      reviewSummary: result.reviewSummary,
    });
  }

  const publicReleaseDecisionMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/review-package-builds\/([^/]+)\/public-release-decision$/);
  if (publicReleaseDecisionMatch && req.method === "PATCH") {
    const workOrderId = decodeURIComponent(publicReleaseDecisionMatch[1]);
    const body = await readJson(req);
    const decision = topicProductionPublicReleaseDecisions.has(body.decision) ? body.decision : "";
    if (!decision) return sendJson(res, 400, { error: "Invalid public release decision" });
    const result = saveTopicProductionPublicReleaseDecision(workOrderId, decision, body.reviewerNotes || "");
    if (!result?.detail) {
      return sendJson(res, 409, {
        error: "No release candidate found for this work order",
        prerequisite: "Complete controlled preview review before recording a public release decision.",
      });
    }
    if (result.blocked) {
      return sendJson(res, 400, { error: "Public release decision is blocked", blockers: result.blockers });
    }

    return sendJson(res, 200, {
      recorded: true,
      package: result.detail.package,
      bundle: result.detail,
      publicReleaseDecision: result.publicReleaseDecision,
      publicReleaseGate: result.publicReleaseGate,
    });
  }

  const draftPublicReleaseDecisionMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/drafts\/([^/]+)\/public-release-decision$/);
  if (draftPublicReleaseDecisionMatch && req.method === "PATCH") {
    const packageId = decodeURIComponent(draftPublicReleaseDecisionMatch[1]);
    const body = await readJson(req);
    const decision = topicProductionPublicReleaseDecisions.has(body.decision) ? body.decision : "";
    if (!decision) return sendJson(res, 400, { error: "Invalid public release decision" });
    const result = saveTopicProductionPublicReleaseDecisionForPackage(packageId, decision, body.reviewerNotes || "");
    if (!result?.detail) {
      return sendJson(res, 409, {
        error: "No release candidate found for this package",
        prerequisite: "Complete controlled preview review before recording a public release decision.",
      });
    }
    if (result.blocked) {
      return sendJson(res, 400, { error: "Public release decision is blocked", blockers: result.blockers });
    }

    return sendJson(res, 200, {
      recorded: true,
      package: result.detail.package,
      bundle: result.detail,
      publicReleaseDecision: result.publicReleaseDecision,
      publicReleaseGate: result.publicReleaseGate,
    });
  }

  const releaseAuditSnapshotMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/drafts\/([^/]+)\/release-audit-snapshot$/);
  if (releaseAuditSnapshotMatch && req.method === "GET") {
    const packageId = decodeURIComponent(releaseAuditSnapshotMatch[1]);
    const detail = packageDetails.get(packageId);
    if (!detail) return sendJson(res, 404, { error: "Package not found" });
    return sendJson(res, 200, topicProductionReleaseAuditSnapshot(detail));
  }

  const studentReleaseSanityMatch = url.pathname.match(/^\/api\/admin\/topic-production-matrix\/drafts\/([^/]+)\/student-release-sanity$/);
  if (studentReleaseSanityMatch && req.method === "GET") {
    const packageId = decodeURIComponent(studentReleaseSanityMatch[1]);
    const detail = packageDetails.get(packageId);
    if (!detail) return sendJson(res, 404, { error: "Package not found" });
    return sendJson(res, 200, topicProductionStudentReleaseSanity(detail));
  }

  if (url.pathname === "/api/admin/topic-production-matrix/draft-review-pack" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionBuildPackets(nextRows);
    const records = topicProductionDraftReviewRows(packets);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-2-draft-quality-review-preview.csv"`);
      return res.end(topicProductionDraftReviewCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-2-draft-quality-review-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_2_draft_quality_review",
      costGuardrail: "Human review only. Do not run paid polish/audio/video until a review decision is recorded.",
      count: records.length,
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/next-spend-queue" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionNextSpendPackets(nextRows);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="approved-next-spend-polish-preview.csv"`);
      return res.end(topicProductionNextSpendCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="approved-next-spend-polish-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "approved_next_spend_polish",
      budgetWindow: "$100-$250",
      count: packets.length,
      packets,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/shorts-workflow" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionNextSpendPackets(nextRows);
    const records = topicProductionShortsWorkflowRows(packets);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-3-shorts-airtable-preview.csv"`);
      return res.end(topicProductionShortsWorkflowCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-3-shorts-airtable-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_3_shorts_airtable_handoff",
      budgetWindow: "$100-$250",
      count: records.length,
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/phase-3-handoff" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionNextSpendPackets(nextRows);
    const records = topicProductionPhaseThreeHandoffRows(packets);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="phase-3-production-handoff-preview.csv"`);
      return res.end(topicProductionPhaseThreeHandoffCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="phase-3-production-handoff-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "phase_3_production_handoff",
      budgetWindow: "$100-$250",
      nextAllowedSpend: "One polish pass or one short planning pass per accepted topic.",
      costGuardrail: "No batch generation, no full video production, and no paid audio until each row is reviewed.",
      count: records.length,
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/student-launch-readiness" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionNextSpendPackets(nextRows);
    const records = topicProductionStudentLaunchReadinessRows(packets);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="student-launch-readiness-preview.csv"`);
      return res.end(topicProductionStudentLaunchReadinessCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="student-launch-readiness-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "student_launch_readiness",
      costGuardrail: "No broad public launch, video/audio, or batch production until this gate is approved.",
      count: records.length,
      records,
    });
  }

  if (url.pathname === "/api/admin/topic-production-matrix/publish-readiness" && req.method === "GET") {
    const format = url.searchParams.get("format") || "json";
    const payload = topicProductionMatrixPayload();
    const nextRows = topicProductionNextBuildRows(payload.rows);
    const packets = topicProductionNextSpendPackets(nextRows);
    const records = topicProductionPublishReadinessRows(packets);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="publish-readiness-preview.csv"`);
      return res.end(topicProductionPublishReadinessCsv(nextRows));
    }

    res.setHeader("Content-Disposition", `attachment; filename="publish-readiness-preview.json"`);
    return sendJson(res, 200, {
      generatedAt: payload.generatedAt,
      queue: "final_publish_readiness",
      costGuardrail: "Publishing uses existing package artifacts; no paid video/audio or batch production is part of this gate.",
      count: records.length,
      records,
    });
  }

  if (url.pathname === "/api/public/launch-interest" && req.method === "POST") {
    const body = await readJson(req);
    const request = {
      id: makeId("pilot-request"),
      status: "new",
      score: 45,
      source: "public_launch_mfp",
      contactName: compactText(body.contactName || "Preview Contact"),
      contactEmail: compactText(body.contactEmail || "preview@example.edu").toLowerCase(),
      contactPhone: compactText(body.contactPhone || ""),
      companyName: compactText(body.companyName || ""),
      jobTitle: compactText(body.jobTitle || ""),
      industry: compactText(body.organizationType || "Nursing education"),
      interestedTopics: Array.isArray(body.interestedTopics) ? body.interestedTopics.map(String).filter(Boolean) : ["Harrity Lesson Builder pilot"],
      tags: ["public-launch", "lesson-builder", "pilot-interest"],
      customFields: {
        pilotGoal: compactText(body.pilotGoal || ""),
        requestedPath: "public_launch_mfp",
      },
      firstContactDate: nowIso(),
      lastContactDate: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    pilotRequests.unshift(request);
    return sendJson(res, 201, {
      success: true,
      message: "Pilot interest captured in local preview",
      leadId: request.id,
      nextStep: "NurseStudy will follow up with a controlled pilot review path.",
    });
  }

  if (url.pathname === "/api/admin/pilot-requests" && req.method === "GET") {
    const status = url.searchParams.get("status") || "all";
    return sendJson(res, 200, pilotRequestsResponse(status));
  }

  const pilotRequestMatch = url.pathname.match(/^\/api\/admin\/pilot-requests\/([^/]+)$/);
  if (pilotRequestMatch && req.method === "PATCH") {
    const request = pilotRequests.find((candidate) => candidate.id === pilotRequestMatch[1]);
    if (!request) return notFound(res);
    const updates = await readJson(req);
    if (updates.status && pilotRequestStatuses.includes(updates.status)) request.status = updates.status;
    if (typeof updates.score === "number") request.score = Math.max(0, Math.min(100, Math.round(updates.score)));
    if (Array.isArray(updates.interestedTopics)) request.interestedTopics = updates.interestedTopics.map(String).filter(Boolean);
    request.followUpDate = updates.followUpDate || null;
    request.customFields = {
      ...(request.customFields || {}),
      adminNotes: compactText(updates.adminNotes || ""),
      reviewedAt: nowIso(),
    };
    request.lastContactDate = nowIso();
    request.updatedAt = nowIso();
    return sendJson(res, 200, { request: pilotRequestPayload(request), summary: pilotRequestSummary([pilotRequestPayload(request)]) });
  }

  if (url.pathname === "/api/admin/pilot-requests/export" && req.method === "GET") {
    const format = url.searchParams.get("format") || "csv";
    const requests = pilotRequests.map(pilotRequestPayload);
    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="public-pilot-requests-preview.json"`);
      return sendJson(res, 200, { generatedAt: nowIso(), source: "public_launch_mfp", summary: pilotRequestSummary(requests), requests });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="public-pilot-requests-preview.csv"`);
    return res.end(pilotRequestCsv(requests));
  }

  if (url.pathname === "/api/admin/knowledge-base/documents" && req.method === "GET") {
    return sendJson(res, 200, { documents: kbDocuments.map(documentPayload) });
  }

  if (url.pathname === "/api/admin/knowledge-base/upload" && req.method === "POST") {
    const upload = await readMultipartDocument(req);
    const result = await indexKnowledgeDocument(upload);
    return sendJson(res, 200, {
      success: true,
      jobId: result.job.id,
      document: documentPayload(result.document),
      source: result.source,
    });
  }

  if (url.pathname === "/api/admin/knowledge-base/import-data-chunker" && req.method === "POST") {
    const body = await readJson(req);
    if (!body.path) return sendJson(res, 400, { error: "Data Chunker import path is required." });

    try {
      const results = await importDataChunkerLocalPath(body.path);
      return sendJson(res, 200, {
        success: true,
        imported: results.length,
        documents: results.map((result) => documentPayload(result.document)),
        sources: results.map((result) => result.source),
        jobs: results.map((result) => result.job),
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Data Chunker import failed." });
    }
  }

  if ((url.pathname === "/api/admin/knowledge-base/jobs" || url.pathname === "/api/admin/knowledge-base/jobs/") && req.method === "GET") {
    const status = url.searchParams.get("status");
    const jobs = status ? kbJobs.filter((job) => job.status === status) : kbJobs;
    return sendJson(res, 200, { jobs });
  }

  const knowledgeJobMatch = url.pathname.match(/^\/api\/admin\/knowledge-base\/jobs\/([^/]+)$/);
  if (knowledgeJobMatch && req.method === "GET") {
    const job = kbJobs.find((candidate) => candidate.id === knowledgeJobMatch[1] || candidate.jobId === knowledgeJobMatch[1]);
    return job ? sendJson(res, 200, job) : notFound(res);
  }

  const documentChunksMatch = url.pathname.match(/^\/api\/admin\/knowledge-base\/documents\/([^/]+)\/chunks$/);
  if (documentChunksMatch && req.method === "GET") {
    const document = findDocument(documentChunksMatch[1]);
    if (!document) return notFound(res);
    const chunks = kbChunks
      .filter((chunk) => chunk.documentId === document.id)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    return sendJson(res, 200, { document: documentPayload(document), chunks });
  }

  const reprocessMatch = url.pathname.match(/^\/api\/admin\/knowledge-base\/documents\/([^/]+)\/reprocess$/)
    || url.pathname.match(/^\/api\/admin\/knowledge-base\/reprocess\/([^/]+)$/);
  if (reprocessMatch && req.method === "POST") {
    const document = findDocument(reprocessMatch[1]);
    if (!document) return notFound(res);
    const updatedAt = nowIso();
    document.updatedAt = updatedAt;
    document.status = "ready";
    const job = {
      id: makeId("job"),
      jobId: makeId("job"),
      documentId: document.id,
      documentTitle: document.title,
      status: "completed",
      stage: "indexed",
      progress: 100,
      message: "Document reprocessed in local preview.",
      error: null,
      startedAt: updatedAt,
      completedAt: updatedAt,
      createdAt: updatedAt,
      updatedAt,
      metadata: { chunksCreated: kbChunks.filter((chunk) => chunk.documentId === document.id).length },
    };
    job.jobId = job.id;
    kbJobs.unshift(job);
    return sendJson(res, 200, { success: true, jobId: job.id, document: documentPayload(document) });
  }

  const documentMatch = url.pathname.match(/^\/api\/admin\/knowledge-base\/documents\/([^/]+)$/)
    || url.pathname.match(/^\/api\/admin\/knowledge-base\/document\/([^/]+)$/);
  if (documentMatch && req.method === "GET") {
    const document = findDocument(documentMatch[1]);
    return document ? sendJson(res, 200, { document: documentPayload(document) }) : notFound(res);
  }

  if (documentMatch && req.method === "DELETE") {
    const documentIndex = kbDocuments.findIndex((document) => document.id === documentMatch[1]);
    if (documentIndex === -1) return notFound(res);
    const [document] = kbDocuments.splice(documentIndex, 1);
    for (let index = kbChunks.length - 1; index >= 0; index -= 1) {
      if (kbChunks[index].documentId === document.id) kbChunks.splice(index, 1);
    }
    const sourceId = `src-${document.id}`;
    const sourceIndex = sources.findIndex((source) => source.id === sourceId);
    if (sourceIndex !== -1) sources.splice(sourceIndex, 1);
    return sendJson(res, 200, { success: true, documentId: document.id });
  }

  const chunkMatch = url.pathname.match(/^\/api\/admin\/knowledge-base\/chunks\/([^/]+)$/);
  if (chunkMatch && req.method === "GET") {
    const chunk = kbChunks.find((candidate) => candidate.id === chunkMatch[1]);
    return chunk ? sendJson(res, 200, { chunk }) : notFound(res);
  }

  if (url.pathname === "/api/admin/knowledge-base/search" && req.method === "GET") {
    const query = url.searchParams.get("q") || url.searchParams.get("query") || "";
    const limit = Number(url.searchParams.get("limit") || 10);
    const results = searchChunks(query, Number.isFinite(limit) ? limit : 10);
    return sendJson(res, 200, {
      query,
      results,
      totalResults: results.length,
      processingTime: 8,
    });
  }

  if (url.pathname === "/api/admin/knowledge-base/generate-answer" && req.method === "POST") {
    const body = await readJson(req);
    const query = body.query || body.question || "";
    const results = searchChunks(query, 5);
    const citations = results.slice(0, 4).map((chunk) => ({
      text: chunk.cleanText || chunk.content,
      source: {
        documentId: chunk.documentId,
        title: chunk.documentTitle || findDocument(chunk.documentId)?.title,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        chunkId: chunk.id,
      },
      relevance: Number(chunk.score || 0.8),
    }));
    const answer = results.length
      ? `Based on the indexed Harrity knowledge base, ${query || "this topic"} should be taught with source-traceable cues, clinical judgment reasoning, learner prediction, practice, rationale, and a concise takeaway.`
      : "No indexed evidence matched that question yet. Upload or select a source document, then try again.";
    return sendJson(res, 200, {
      answer,
      citations,
      confidence: results.length ? 0.86 : 0.2,
      relatedTopics: ["clinical judgment", "NCLEX alignment", "retrieval practice", "source traceability"],
      queryId: makeId("query"),
      processingTime: 16,
    });
  }

  if (url.pathname === "/api/admin/knowledge-base/export" && req.method === "POST") {
    const body = await readJson(req);
    const query = body.query || "";
    const results = body.results?.length ? body.results : searchChunks(query, 50);
    const bodyCsv = csv(
      ["document_title", "page_start", "page_end", "score", "content"],
      results.map((result) => [
        result.documentTitle || findDocument(result.documentId)?.title || "",
        result.pageStart || "",
        result.pageEnd || "",
        result.score || "",
        result.cleanText || result.content || "",
      ]),
    );
    return sendCsv(res, "knowledge-base-search-results.csv", bodyCsv);
  }

  if (url.pathname === "/api/admin/content/import" && req.method === "POST") {
    const upload = await readMultipartDocument(req);
    const result = await indexKnowledgeDocument(upload);
    const blocks = syncContentBlocksForDocument(result.document.id);
    return sendJson(res, 200, {
      success: true,
      processed: blocks.length,
      failed: 0,
      document: documentPayload(result.document),
      source: result.source,
      blocks,
    });
  }

  if (url.pathname === "/api/admin/content/blocks" && req.method === "GET") {
    return sendJson(res, 200, filterContentBlocks(url));
  }

  if (url.pathname === "/api/admin/content/analyze-with-ai" && req.method === "POST") {
    const body = await readJson(req);
    const ids = Array.isArray(body.blockIds) ? new Set(body.blockIds.map(String)) : null;
    const targets = mapperContentBlocks
      .filter((block) => body.analyzeAll || ids?.has(block.id))
      .filter((block) => !body.analyzeAll || !block.nursingSpecialty)
      .slice(0, 50);

    for (const block of targets) {
      applyContentBlockUpdates(block, analyzePreviewContentBlock(block));
    }

    return sendJson(res, 200, {
      success: true,
      processed: targets.length,
      message: `Successfully analyzed ${targets.length} content blocks in local preview`,
    });
  }

  const suggestionMatch = url.pathname.match(/^\/api\/admin\/content\/blocks\/([^/]+)\/ai-suggestions$/);
  if (suggestionMatch && req.method === "GET") {
    const block = mapperContentBlocks.find((candidate) => candidate.id === suggestionMatch[1]);
    return block
      ? sendJson(res, 200, { blockId: block.id, suggestions: analyzePreviewContentBlock(block) })
      : notFound(res);
  }

  const contentBlockMatch = url.pathname.match(/^\/api\/admin\/content\/blocks\/([^/]+)$/);
  if (contentBlockMatch && req.method === "GET") {
    const block = mapperContentBlocks.find((candidate) => candidate.id === contentBlockMatch[1]);
    return block ? sendJson(res, 200, block) : notFound(res);
  }

  if (contentBlockMatch && req.method === "PUT") {
    const block = mapperContentBlocks.find((candidate) => candidate.id === contentBlockMatch[1]);
    if (!block) return notFound(res);
    const updates = await readJson(req);
    return sendJson(res, 200, applyContentBlockUpdates(block, updates));
  }

  if (url.pathname === "/api/admin/tables/stats" && req.method === "GET") {
    return sendJson(res, 200, {
      summary: {
        total: extractedTables.length,
        pending: 0,
        approved: extractedTables.length,
        rejected: 0,
      },
      confidenceStats: {
        high: extractedTables.length,
        medium: 0,
        low: 0,
      },
      stats: {
        totalTables: extractedTables.length,
        pendingReview: 0,
        approved: extractedTables.length,
        rejected: 0,
        extractedCells: 0,
      },
    });
  }

  if (url.pathname === "/api/admin/tables/search" && req.method === "GET") {
    return sendJson(res, 200, { tables: extractedTables, totalResults: extractedTables.length });
  }

  const tableCellsMatch = url.pathname.match(/^\/api\/admin\/tables\/([^/]+)\/cells$/);
  if (tableCellsMatch && req.method === "GET") {
    return sendJson(res, 200, { tableId: tableCellsMatch[1], cells: [] });
  }

  if (["/api/admin/tables/approve", "/api/admin/tables/bulk-action", "/api/admin/tables/edit"].includes(url.pathname) && req.method === "POST") {
    return sendJson(res, 200, { success: true });
  }

  if (url.pathname === "/api/admin/lesson-builder/health" && req.method === "GET") {
    const requiredArchiveRoles = ["harrity_pipeline_contract", "chapter_deck_schema", "pilot_preflight_package"].map((role) => ({
      role,
      status: sourceArchiveImports.some((job) => job.role === role && ["completed", "duplicate"].includes(job.status)) ? "ready" : "missing",
    }));
    const documentBackedSourceCount = sources.filter((source) => source.documentId && source.ingestionStatus === "ready").length;
    const archiveSetReady = requiredArchiveRoles.every((entry) => entry.status === "ready");
    return sendJson(res, 200, {
      runtime: "local_preview",
      database: {
        configured: Boolean(runtimeEnv.DATABASE_URL),
        status: runtimeEnv.DATABASE_URL ? "configured" : "missing_DATABASE_URL",
        migrationStatus: runtimeEnv.DATABASE_URL ? "drizzle_required_for_db_runtime" : "preview_in_memory",
      },
      previewMode: { enabled: true, status: "serving in-memory lesson builder preview" },
      sourceRegistry: {
        status: sources.length ? "ready" : "empty",
        sourceCount: sources.length,
        readySourceCount: sources.filter((source) => source.ingestionStatus === "ready").length,
        archiveImportCount: sourceArchiveImports.length,
        documentBackedSourceCount,
        requiredArchiveRoles,
      },
      ingestion: { status: kbDocuments.length ? "ready" : "awaiting_documents", documentCount: kbDocuments.length, documentBackedSourceCount },
      export: { status: "ready", profile: "harrity", requiredFiles: harrityRequiredExportFiles },
      agent: lessonBuilderAgentStatus(),
      pilotReadiness: {
        status: archiveSetReady && documentBackedSourceCount > 0 && packages.length > 0 ? "ready" : "incomplete",
        databaseConfigured: Boolean(runtimeEnv.DATABASE_URL),
        archiveSetReady,
        documentBackedSourceCount,
        packageCount: packages.length,
      },
    });
  }

  if (url.pathname === "/api/admin/lesson-builder/release-readiness" && req.method === "GET") {
    return sendJson(res, 200, previewReleaseReadinessPayload());
  }

  if (url.pathname === "/api/admin/lesson-builder/agent-status" && req.method === "GET") {
    return sendJson(res, 200, lessonBuilderAgentStatus());
  }

  if (url.pathname === "/api/admin/lesson-builder/sources" && req.method === "GET") {
    return sendJson(res, 200, { sources, taxonomyTerms, documents: kbDocuments.map(documentPayload), archiveImports: sourceArchiveImports.slice(0, 20) });
  }

  if (url.pathname === "/api/admin/lesson-builder/sources/import" && req.method === "POST") {
    const body = await readJson(req);
    const source = {
      id: `src-${Date.now()}`,
      title: body.title,
      sourceKind: body.sourceKind || "local_file",
      sourceType: body.sourceType || "manual",
      sourceUri: body.sourceUri || "",
      subject: body.subject || "General nursing",
      edition: body.edition || "Local preview",
      approvalStatus: "approved",
      ingestionStatus: "ready",
      citationPolicy: "cite_paraphrase",
      metadata: body.metadata || {},
      createdAt: new Date().toISOString(),
    };
    sources.unshift(source);
    return sendJson(res, 200, { source });
  }

  if (url.pathname === "/api/admin/lesson-builder/sources/attach-document" && req.method === "POST") {
    const body = await readJson(req);
    try {
      return sendJson(res, 200, attachDocumentSource(body));
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: "Failed to attach document source", details: error instanceof Error ? error.message : String(error) });
    }
  }

  if (url.pathname === "/api/admin/lesson-builder/source-archives/import" && req.method === "POST") {
    const body = await readJson(req);
    try {
      return sendJson(res, 200, await importSourceArchive(body));
    } catch (error) {
      return sendJson(res, 500, { error: "Failed to import source archive", details: error instanceof Error ? error.message : String(error) });
    }
  }

  if (url.pathname === "/api/admin/lesson-builder/source-archives/import-pilot-set" && req.method === "POST") {
    const body = await readJson(req);
    try {
      return sendJson(res, 200, await importPilotArchiveSet(body));
    } catch (error) {
      return sendJson(res, 500, { error: "Failed to import pilot archive set", details: error instanceof Error ? error.message : String(error) });
    }
  }

  const archiveJobMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/source-archives\/jobs\/([^/]+)$/);
  if (archiveJobMatch && req.method === "GET") {
    const importJob = sourceArchiveImports.find((job) => job.id === archiveJobMatch[1]);
    if (!importJob) return notFound(res);
    const files = sourceArchiveFiles.filter((file) => file.importId === importJob.id).sort((a, b) => a.filePath.localeCompare(b.filePath));
    const importedSources = sources.filter((source) => importJob.importedSourceIds?.includes(source.id));
    return sendJson(res, 200, { importJob, files, sources: importedSources });
  }

  if (url.pathname === "/api/admin/lesson-builder/mappings/review" && req.method === "POST") {
    const body = await readJson(req);
    return sendJson(res, 200, {
      mappings: (body.mappings || []).map((mapping, index) => ({
        id: `map-${Date.now()}-${index}`,
        sourceId: body.sourceId,
        taxonomyTerm: mapping,
      })),
    });
  }

  if (url.pathname === "/api/admin/lesson-builder/generate" && req.method === "POST") {
    return sendJson(res, 200, buildPackage(await readJson(req)));
  }

  if (url.pathname === "/api/admin/lesson-builder/packages" && req.method === "GET") {
    return sendJson(res, 200, { packages });
  }

  const detailMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)$/);
  if (detailMatch && req.method === "GET") {
    const detail = packageDetails.get(detailMatch[1]);
    return detail ? sendJson(res, 200, detail) : notFound(res);
  }

  const assessmentBridgeMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/assessment-bridge$/);
  if (assessmentBridgeMatch && req.method === "POST") {
    const detail = packageDetails.get(assessmentBridgeMatch[1]);
    if (!detail) return notFound(res);
    const assessmentBridge = attachPreviewAssessmentBridge(detail, await readJson(req));
    return sendJson(res, 200, { package: detail.package, assessmentBridge, bundle: detail });
  }

  const aiAssessmentBridgeMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/ai-assessment-bridge$/);
  if (aiAssessmentBridgeMatch && req.method === "POST") {
    const detail = packageDetails.get(aiAssessmentBridgeMatch[1]);
    if (!detail) return notFound(res);
    const aiMapping = previewAiAssessmentBridge(detail);
    const assessmentBridge = attachPreviewAssessmentBridge(detail, {
      ...aiMapping,
      note: `AI mapped weak topic: ${aiMapping.rationale}`,
      officialPilotPackage: Boolean(detail.package.manifest?.pilot?.officialPackage ?? true),
    });
    return sendJson(res, 200, { package: detail.package, assessmentBridge, aiMapping, bundle: detail });
  }

  const slideEditMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/slides\/([^/]+)$/);
  if (slideEditMatch && req.method === "PATCH") {
    const detail = packageDetails.get(slideEditMatch[1]);
    if (!detail) return notFound(res);
    const slide = detail.slides.find((candidate) => candidate.id === slideEditMatch[2]);
    if (!slide) return notFound(res);
    const body = await readJson(req);
    Object.assign(slide, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.visibleContent !== undefined ? { visibleContent: body.visibleContent } : {}),
      ...(body.speakerNotes !== undefined ? { speakerNotes: body.speakerNotes } : {}),
      ...(body.guidedNotes !== undefined ? { guidedNotes: body.guidedNotes } : {}),
      ...(body.retrievalPrompt !== undefined ? { retrievalPrompt: body.retrievalPrompt } : {}),
      ...(body.nclexCategory !== undefined ? { nclexCategory: body.nclexCategory } : {}),
      ...(body.cjmStep !== undefined ? { cjmStep: body.cjmStep } : {}),
      ...(body.nursingProcess !== undefined ? { nursingProcess: body.nursingProcess } : {}),
      ...(body.bloomLevel !== undefined ? { bloomLevel: body.bloomLevel } : {}),
    });
    markPreviewPackageNeedsReview(detail, "slide_edit");
    return sendJson(res, 200, { slide, package: detail.package, reviewStatus: "needs_qa_after_edit" });
  }

  const itemEditMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/items\/([^/]+)$/);
  if (itemEditMatch && req.method === "PATCH") {
    const detail = packageDetails.get(itemEditMatch[1]);
    if (!detail) return notFound(res);
    const item = detail.items.find((candidate) => candidate.id === itemEditMatch[2]);
    if (!item) return notFound(res);
    const body = await readJson(req);
    Object.assign(item, {
      ...(body.stem !== undefined ? { stem: body.stem } : {}),
      ...(body.options !== undefined ? { options: body.options } : {}),
      ...(body.correctAnswer !== undefined ? { correctAnswer: body.correctAnswer } : {}),
      ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.difficulty !== undefined ? { difficulty: body.difficulty } : {}),
    });
    markPreviewPackageNeedsReview(detail, "item_edit");
    return sendJson(res, 200, { item, package: detail.package, reviewStatus: "needs_qa_after_edit" });
  }

  const qaMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/run-qa$/);
  if (qaMatch && req.method === "POST") {
    const detail = packageDetails.get(qaMatch[1]);
    if (!detail) return notFound(res);
    return sendJson(res, 200, runPreviewQa(detail));
  }

  const validateMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/validate-contract$/);
  if (validateMatch && req.method === "POST") {
    const detail = packageDetails.get(validateMatch[1]);
    if (!detail) return notFound(res);
    if (!detail.qaResults?.length) runPreviewQa(detail);
    return sendJson(res, 200, validateLessonContract(detail, url.searchParams.get("profile") || "harrity"));
  }

  const rebuildMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/rebuild-artifacts$/);
  if (rebuildMatch && req.method === "POST") {
    const detail = packageDetails.get(rebuildMatch[1]);
    if (!detail) return notFound(res);
    const qa = runPreviewQa(detail);
    const validation = validateLessonContract(detail, url.searchParams.get("profile") || "harrity");
    return sendJson(res, 200, {
      package: detail.package,
      qa,
      validation,
      artifacts: validation.artifacts,
      reviewStatus: validation.validationSummary.failCount > 0 || qa.qaSummary.failCount > 0 ? "blocked" : "ready_to_publish",
    });
  }

  const publishMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/publish$/);
  if (publishMatch && req.method === "POST") {
    const detail = packageDetails.get(publishMatch[1]);
    if (!detail) return notFound(res);
    const body = await readJson(req);
    if (!hasValidPublicPublishConfirmation(body)) {
      return sendJson(res, 400, {
        error: "Publish confirmation required",
        requiredConfirmationText: publicPublishConfirmationText,
      });
    }

    const qa = runPreviewQa(detail);
    const validation = validateLessonContract(detail, "harrity");
    if (qa.qaSummary.failCount > 0 || validation.validationSummary.failCount > 0) {
      return sendJson(res, 400, { error: "Package has failing QA or contract gates", qa, validation });
    }
    detail.package.status = "published";
    detail.package.publishedAt = new Date().toISOString();
    return sendJson(res, 200, { package: detail.package, qa, validation, publishConfirmation: { confirmed: true } });
  }

  const exportMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/export$/);
  if (exportMatch && req.method === "GET") {
    const detail = packageDetails.get(exportMatch[1]);
    if (!detail) return notFound(res);
    const buffer = await exportZip(detail, url.searchParams.get("profile") || "harrity");
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${detail.package.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip"`,
      "Content-Length": buffer.length,
    });
    return res.end(buffer);
  }

  const exportStatusMatch = url.pathname.match(/^\/api\/admin\/lesson-builder\/packages\/([^/]+)\/export-status$/);
  if (exportStatusMatch && req.method === "GET") {
    const detail = packageDetails.get(exportStatusMatch[1]);
    if (!detail) return notFound(res);
    const profile = url.searchParams.get("profile") || "harrity";
    const artifacts = buildPackageArtifactPayloads(detail, profile);
    const fileNames = artifacts.map((artifact) => artifact.fileName);
    const missingRequiredFiles = harrityRequiredExportFiles.filter((fileName) => !fileNames.includes(fileName));
    return sendJson(res, 200, {
      packageId: detail.package.id,
      profile,
      status: missingRequiredFiles.length ? "incomplete" : "ready",
      fileCount: artifacts.length,
      files: fileNames,
      includesDeckModel: Boolean(detail.package.deckModel),
      missingRequiredFiles,
    });
  }

  return notFound(res);
}

async function serveStatic(req, res, url) {
  let filePath = path.join(publicDir, decodeURIComponent(url.pathname));
  if (
    url.pathname === "/"
    || url.pathname.startsWith("/admin")
    || url.pathname.startsWith("/curriculum")
    || url.pathname.startsWith("/student")
    || url.pathname.startsWith("/lessons")
    || url.pathname.startsWith("/lesson-assignments")
    || url.pathname.startsWith("/study-guide")
    || url.pathname.startsWith("/dashboard")
    || url.pathname.startsWith("/pilot-request")
    || url.pathname.startsWith("/public-launch")
  ) {
    filePath = path.join(publicDir, "index.html");
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(file);
  } catch {
    const index = await fs.readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(index);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${port}`}`);
    if (url.pathname === "/health") {
      return sendJson(res, 200, { status: "ok", runtime: "local_preview", timestamp: nowIso() });
    }
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Local lesson builder preview failed" });
  }
});

globalThis.__lessonBuilderPreviewServer = server;

server.listen(port, "127.0.0.1", () => {
  console.log(`Lesson Builder local preview running at http://localhost:${port}/admin/lesson-builder`);
});
