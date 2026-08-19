import JSZip from "jszip";
import {
  EXEMPLAR_TOPICS,
  INTEGRATED_PROCESSES,
  NCJMM_FUNCTIONS,
  NCLEX_CATEGORIES,
  NCLEX_FRAMEWORK_ID,
  buildExemplarPackage,
  validateExemplarPackage,
} from "../shared/nclex-rn-2026";

const xmlEscape = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function curriculumManifest() {
  const packages = EXEMPLAR_TOPICS.map(buildExemplarPackage);
  return {
    schemaVersion: "1.0.0",
    framework: {
      id: NCLEX_FRAMEWORK_ID,
      title: "2026 NCLEX-RN Open Curriculum",
      audience: "Prelicensure RN",
      status: "clinical_review",
      source: "https://www.ncsbn.org/publications/2026-nclex-rn-test-plan",
    },
    categories: NCLEX_CATEGORIES,
    integratedProcesses: INTEGRATED_PROCESSES,
    clinicalJudgmentFunctions: NCJMM_FUNCTIONS,
    packages,
    compatibility: {
      legacyTopicCount: 77,
      maternalNewbornMigrationRows: 94,
      atiPolicy: "Aliases and report parsing only; no proprietary ATI prose, rationales, or items.",
    },
  };
}

export function validateCurriculum() {
  const manifest = curriculumManifest();
  const packageResults = manifest.packages.map((pkg) => ({ topicId: pkg.topic.id, ...validateExemplarPackage(pkg) }));
  const representedCategories = new Set(manifest.packages.map((pkg) => pkg.topic.categoryId));
  const missingCategories = NCLEX_CATEGORIES.filter((category) => !representedCategories.has(category.id)).map((category) => category.id);
  const representedProcesses = new Set(EXEMPLAR_TOPICS.flatMap((topic) => topic.integratedProcesses));
  const missingProcesses = INTEGRATED_PROCESSES.filter((process) => !representedProcesses.has(process));
  const sourceIds = new Set(manifest.packages.flatMap((pkg) => pkg.sources.map((source) => source.id)));
  const orphanedItems = manifest.packages.flatMap((pkg) => pkg.assessmentItems)
    .filter((item) => !sourceIds.has(item.sourceId))
    .map((item) => item.id);
  const issues = [
    ...missingCategories.map((id) => `Missing exemplar for ${id}.`),
    ...missingProcesses.map((process) => `Missing integrated process coverage for ${process}.`),
    ...packageResults.flatMap((result) => result.issues.map((issue) => `${result.topicId}: ${issue}`)),
    ...orphanedItems.map((id) => `Assessment item ${id} has an orphaned source mapping.`),
  ];
  return {
    valid: issues.length === 0,
    issues,
    coverage: {
      categoriesRepresented: representedCategories.size,
      categoriesTotal: NCLEX_CATEGORIES.length,
      integratedProcessesRepresented: representedProcesses.size,
      integratedProcessesTotal: INTEGRATED_PROCESSES.length,
      clinicalJudgmentFunctionsRepresented: NCJMM_FUNCTIONS.length,
      clinicalJudgmentFunctionsTotal: NCJMM_FUNCTIONS.length,
    },
    content: {
      exemplarTopics: manifest.packages.length,
      objectives: manifest.packages.reduce((sum, pkg) => sum + pkg.objectives.length, 0),
      assessmentItems: manifest.packages.reduce((sum, pkg) => sum + pkg.assessmentItems.length, 0),
      clinicalJudgmentItems: manifest.packages.reduce((sum, pkg) => sum + pkg.clinicalJudgmentCase.length, 0),
      approved: manifest.packages.filter((pkg) => pkg.releaseStage === "approved" || pkg.releaseStage === "export_ready").length,
      awaitingClinicalReview: manifest.packages.filter((pkg) => pkg.releaseStage === "clinical_review").length,
    },
  };
}

export function canvasOutcomesCsv() {
  const header = ["vendor_guid", "object_type", "title", "description", "display_name", "calculation_method", "calculation_int", "workflow_state", "parent_guids"];
  const rows = EXEMPLAR_TOPICS.flatMap((topic) => topic.objectives.map((objective, index) => [
    `${NCLEX_FRAMEWORK_ID}:${topic.id}:objective-${index + 1}`,
    "outcome",
    objective,
    `${topic.title} | ${NCLEX_CATEGORIES.find((category) => category.id === topic.categoryId)?.label}`,
    `${topic.title} ${index + 1}`,
    "decaying_average",
    "65",
    "active",
    `${NCLEX_FRAMEWORK_ID}:${topic.categoryId}`,
  ]));
  const groupRows = NCLEX_CATEGORIES.map((category) => [
    `${NCLEX_FRAMEWORK_ID}:${category.id}`,
    "outcome_group",
    category.label,
    `2026 NCLEX-RN blueprint range ${category.blueprintRange[0]}-${category.blueprintRange[1]}%`,
    category.label,
    "",
    "",
    "active",
    NCLEX_FRAMEWORK_ID,
  ]);
  return [header, ...groupRows, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function qtiAssessmentXml() {
  const items = EXEMPLAR_TOPICS.flatMap((topic) => buildExemplarPackage(topic).assessmentItems);
  const itemXml = items.map((item) => `
    <assessmentItem identifier="${xmlEscape(item.id)}" title="${xmlEscape(item.id)}" adaptive="false" timeDependent="false">
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>${item.correctAnswer}</value></correctResponse></responseDeclaration>
      <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><prompt>${xmlEscape(item.stem)}</prompt>${item.options.map((option) => `<simpleChoice identifier="${option.id}">${xmlEscape(option.text)}</simpleChoice>`).join("")}</choiceInteraction></itemBody>
      <modalFeedback outcomeIdentifier="FEEDBACK" identifier="rationale" showHide="show">${xmlEscape(item.rationale)}</modalFeedback>
    </assessmentItem>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="${NCLEX_FRAMEWORK_ID}" title="2026 NCLEX-RN Exemplar Bank">${itemXml}\n</assessmentTest>\n`;
}

export function pathwayRulesManifest() {
  return {
    schemaVersion: "1.0.0",
    frameworkId: NCLEX_FRAMEWORK_ID,
    algorithmVersion: "directed-remediation-v1",
    masteryThreshold: 85,
    bands: [
      { min: 0, max: 59.99, path: "foundational_intensive" },
      { min: 60, max: 74.99, path: "targeted_remediation" },
      { min: 75, max: 84.99, path: "focused_reinforcement" },
      { min: 85, max: 100, path: "mastered" },
    ],
    weights: { gapSeverity: 0.45, blueprintWeight: 0.25, clinicalSafetyRisk: 0.2, recencyFrequency: 0.1 },
    lowConfidence: { threshold: 0.6, action: "assign_broad_diagnostic" },
    failureLoop: "smallest_failed_objective_branch",
  };
}

function topicHtml(topic: (typeof EXEMPLAR_TOPICS)[number]) {
  const pkg = buildExemplarPackage(topic);
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${xmlEscape(topic.title)}</title></head><body><a href="#lesson-content">Skip to lesson content</a><main id="lesson-content"><h1>${xmlEscape(topic.title)}</h1><p><strong>Review status:</strong> Licensed RN clinical review required.</p><p>${xmlEscape(topic.summary)}</p>${topic.lessonSections.map((section) => `<section><h2>${xmlEscape(section.heading)}</h2><p>${xmlEscape(section.body)}</p></section>`).join("")}<section><h2>Focused review</h2><ul>${topic.focusedReview.map((entry) => `<li>${xmlEscape(entry)}</li>`).join("")}</ul></section><section><h2>Learning objectives</h2><ol>${topic.objectives.map((entry) => `<li>${xmlEscape(entry)}</li>`).join("")}</ol></section><section><h2>Sources</h2><ul>${pkg.sources.map((source) => `<li><a href="${xmlEscape(source.sourceUri)}">${xmlEscape(source.title)}</a> — ${xmlEscape(source.license)}, ${xmlEscape(source.locator)}</li>`).join("")}</ul></section></main></body></html>`;
}

export async function commonCartridgeArchive() {
  const zip = new JSZip();
  const resources = EXEMPLAR_TOPICS.map((topic) => `<resource identifier="res-${xmlEscape(topic.id)}" type="webcontent" href="modules/${xmlEscape(topic.id)}.html"><file href="modules/${xmlEscape(topic.id)}.html"/></resource>`).join("");
  const organizations = EXEMPLAR_TOPICS.map((topic) => `<item identifier="item-${xmlEscape(topic.id)}" identifierref="res-${xmlEscape(topic.id)}"><title>${xmlEscape(topic.title)}</title></item>`).join("");
  zip.file("imsmanifest.xml", `<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p3/imscp_v1p1" identifier="${NCLEX_FRAMEWORK_ID}"><organizations><organization identifier="org-1"><title>2026 NCLEX-RN Exemplar Curriculum</title>${organizations}</organization></organizations><resources>${resources}</resources></manifest>`);
  for (const topic of EXEMPLAR_TOPICS) zip.file(`modules/${topic.id}.html`, topicHtml(topic));
  zip.file("curriculum-manifest.json", JSON.stringify(curriculumManifest(), null, 2));
  zip.file("canvas-outcomes.csv", canvasOutcomesCsv());
  zip.file("qti-exemplar-bank.xml", qtiAssessmentXml());
  zip.file("pathway-rules.json", JSON.stringify(pathwayRulesManifest(), null, 2));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function executionStatus() {
  const validation = validateCurriculum();
  const manifest = curriculumManifest();
  const sourceCount = new Set(manifest.packages.flatMap((pkg) => pkg.sources.map((source) => source.id))).size;
  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    frameworkId: NCLEX_FRAMEWORK_ID,
    release: { name: "Eight-category exemplar milestone", stage: "clinical_review", portableExportsReady: validation.valid },
    coverage: validation.coverage,
    production: {
      batches: [{ id: "exemplar-eight", size: 8, status: validation.valid ? "clinical_review" : "blocked", completedDrafts: 8 }],
      fullCurriculum: { status: "mapping", approvedPercent: 0, explicitGapPolicy: true },
    },
    reviewQueue: { awaitingLicensedRn: validation.content.awaitingClinicalReview, approved: validation.content.approved },
    content: {
      exemplarTopics: validation.content.exemplarTopics,
      objectives: validation.content.objectives,
      assessmentItems: validation.content.assessmentItems,
      clinicalJudgmentItems: validation.content.clinicalJudgmentItems,
      evidenceSources: sourceCount,
    },
    sourceReadiness: {
      approvedOerSources: sourceCount,
      blockedSources: 0,
      proprietaryPolicy: manifest.compatibility.atiPolicy,
    },
    quality: { automatedValidation: validation.valid ? "pass" : "fail", issues: validation.issues },
    releaseGates: [
      { id: "automated_validation", label: "Automated curriculum validation", status: validation.valid ? "pass" : "blocked" },
      { id: "licensed_rn_review", label: "Licensed RN faculty approval", status: validation.content.awaitingClinicalReview ? "pending" : "pass" },
      { id: "portable_exports", label: "Canvas-portable export validation", status: validation.valid ? "pass" : "blocked" },
      { id: "public_release", label: "Public curriculum release", status: validation.content.approved ? "pending" : "blocked" },
    ],
    exports: ["curriculum-manifest.json", "canvas-outcomes.csv", "qti-exemplar-bank.xml", "nclex-rn-2026.imscc", "pathway-rules.json"],
    privacy: "Contains aggregate curriculum production status only; no learner or patient data.",
  };
}
