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
  sendJson(res, 404, { error: "Not found" });
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
  return detail.package.manifest?.assessmentBridge
    || detail.package.taxonomySnapshot?.assessmentBridge
    || detail.package.deckModel?.assessmentBridge
    || null;
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

function previewLearnerPayload(detail) {
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

  const publicLessonMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)$/);
  if (publicLessonMatch && req.method === "GET") {
    const detail = packageDetails.get(publicLessonMatch[1]);
    if (!detail || detail.package.status !== "published") return notFound(res);
    return sendJson(res, 200, previewLearnerPayload(detail));
  }

  const publicLessonSignalMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)\/(events|feedback)$/);
  if (publicLessonSignalMatch && req.method === "POST") {
    const detail = packageDetails.get(publicLessonSignalMatch[1]);
    if (!detail || detail.package.status !== "published") return notFound(res);
    const body = await readJson(req);
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

  if (url.pathname === "/api/admin/logout") return sendJson(res, 200, { success: true });

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
    const qa = runPreviewQa(detail);
    const validation = validateLessonContract(detail, "harrity");
    if (qa.qaSummary.failCount > 0 || validation.validationSummary.failCount > 0) {
      return sendJson(res, 400, { error: "Package has failing QA or contract gates", qa, validation });
    }
    detail.package.status = "published";
    detail.package.publishedAt = new Date().toISOString();
    return sendJson(res, 200, { package: detail.package, qa, validation });
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
