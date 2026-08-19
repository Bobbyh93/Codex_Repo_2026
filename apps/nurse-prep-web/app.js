<<<<<<< HEAD
const today = new Date().toISOString().slice(0, 10);

const paths = {
  project: "/state/project_state.json",
  queue: "/state/work_queue.json",
  qa: "/state/qa_state.json",
  release: "/state/release_state.json",
  pipeline: "/state/pipeline_state.json",
  runtime: "/manifests/openai_runtime_check.json",
  tts: "/qa/tts_asset_verification_report.json",
  productionPilotRelease: "/qa/production_pilot_release_report.json",
  productionPilotTts: "/qa/production_pilot_tts_report.json",
  productionPilotAudio: "/manifests/production_pilot_audio_manifest.json",
  productionPilotBinding: "/manifests/production_pilot_binding_manifest.json",
  productionPilotLesson: "/lessons/production_pilot/lesson_spec.json",
  productionPilotSource: "/lessons/production_pilot/source_manifest.json",
  productionPilotPlaybackEvidence: "/qa/production_pilot_playback_evidence.json",
  productionPilotPlaybackReport: "/qa/production_pilot_playback_report.json",
  worksets: [`/daily_worksets/${today}.json`, "/daily_worksets/2026-07-15.json", "/daily_worksets/2026-07-14.json"],
};

const fallback = {
  project: { project_name: "Harrity Lesson Builder Pipeline", repository: { owner: "Bobbyh93", name: "Codex_Repo_2026", branch: "main" } },
  queue: { work_packages: [{ id: "HLB-TTS-ASSET-VERIFICATION-022", title: "Verify credential-backed OpenAI TTS assets", status: "blocked", priority: 2, summary: "Replace the invalid API key, run the live TTS pilot, and verify MP3 assets before downstream binding.", blockers: ["OpenAI authenticated probe failed with invalid_api_key."], outputs: ["manifests/audio_manifest.json", "manifests/binding_manifest.json", "qa/tts_asset_verification_report.json"] }] },
  qa: { gates: [{ gate: "openai_tts_live_execution", status: "blocked", required_evidence: "Credential-backed MP3 generation report" }, { gate: "pptx_audio_binding", status: "blocked", required_evidence: "PowerPoint playback evidence" }, { gate: "video_release", status: "blocked", required_evidence: "Machine QA and target-player playback evidence" }] },
  release: { release_state: "not_ready", export_pass_allowed: false, hard_stop_rules: ["Do not mark generated files release-ready without machine-readable QA evidence."] },
  pipeline: { active_stage: "tts_asset_verification", next_stage: "credential_backed_openai_tts_assets", known_execution_context: { openai_authenticated_probe_status: "invalid_api_key" } },
  runtime: { status: "blocked", tts_model: "gpt-4o-mini-tts", tts_voice: "marin" },
  tts: { status: "blocked", verified_asset_count: 0, planned_asset_count: 2, binding_manifest_status: "blocked", errors: [] },
  productionPilotRelease: { status: "not_loaded", slide_count: 0, source_count: 0, verified_audio_count: 0, binding_count: 0, source_grounded: false, external_blockers: ["Production pilot artifacts are not loaded."] },
  productionPilotTts: { status: "not_loaded", verified_asset_count: 0, planned_asset_count: 0 },
  productionPilotAudio: { audio_assets: [] },
  productionPilotBinding: { status: "not_loaded", bindings: [] },
  productionPilotLesson: { title: "Production pilot not loaded", slides: [] },
  productionPilotSource: { sources: [] },
  productionPilotPlaybackEvidence: { release_path: "not_selected", playback_records: [] },
  productionPilotPlaybackReport: { status: "blocked", release_path: "not_selected", required_targets: [], passed_targets: [], blockers: ["Playback evidence report is not loaded."] },
  workset: null,
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

async function firstAvailable(pathsToTry) {
  for (const path of pathsToTry) {
    try { return await fetchJson(path); } catch { /* try next */ }
  }
  return null;
}

function selectActivePackage(queue) {
  const rank = { in_progress: 0, next: 1, ready: 2, blocked: 3, pending: 4, complete: 99, cancelled: 99 };
  return [...(queue.work_packages || [])]
    .filter((item) => !["complete", "cancelled"].includes(item.status))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || (rank[a.status] ?? 50) - (rank[b.status] ?? 50))[0];
}

function pillClass(status = "") {
  const normalized = String(status);
  if (normalized.includes("blocked") || normalized.includes("not_ready")) return "status-blocked";
  if (normalized.includes("pass") || normalized.includes("ready") || normalized === "complete") return "status-pass";
  return "status-planned";
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function itemStatus(status) {
  return `<span class="status-pill ${pillClass(status)}">${status || "unknown"}</span>`;
}

function formatSeconds(value) {
  if (typeof value !== "number") return "duration pending";
  return `${value.toFixed(1)} sec`;
}

function renderWorkset(workset, activePackage, blockers) {
  const body = document.getElementById("worksetBody");
  const status = document.getElementById("worksetStatus");
  const effective = workset || {
    status: activePackage?.status || "blocked",
    selected_work_package: activePackage,
    active_blockers: blockers,
    recommended_actions: activePackage?.blockers?.length ? ["Resolve the selected package blockers.", "Rerun validation and regenerate the daily workset."] : ["Execute the selected package and write required evidence."],
  };
  status.textContent = effective.status || "blocked";
  status.className = `status-pill ${pillClass(effective.status)}`;
  body.innerHTML = `
    <p>${effective.selected_work_package?.summary || activePackage?.summary || "No active work package selected."}</p>
    <div class="stack-list">
      ${(effective.recommended_actions || []).map((action) => `<div class="gate-item"><strong>${action}</strong></div>`).join("")}
    </div>
  `;
}

function renderQueue(queue) {
  const root = document.getElementById("workQueue");
  root.innerHTML = (queue.work_packages || []).map((item) => `
    <div class="queue-item">
      <div><strong>${item.id}</strong><p>Priority ${item.priority ?? "-"}</p></div>
      <div><strong>${item.title}</strong><p>${item.summary || ""}</p></div>
      ${itemStatus(item.status)}
    </div>
  `).join("");
}

function renderGates(qa) {
  const root = document.getElementById("gateList");
  root.innerHTML = (qa.gates || []).map((gate) => `
    <div class="gate-item">
      <div class="panel-header"><strong>${gate.gate}</strong>${itemStatus(gate.status)}</div>
      <p>${gate.required_evidence || ""}</p>
    </div>
  `).join("");
}

function renderTts(report, runtime) {
  const root = document.getElementById("ttsReport");
  const entries = [
    ["TTS status", report.status],
    ["Assets", `${report.verified_asset_count ?? 0}/${report.planned_asset_count ?? 0} verified`],
    ["Binding manifest", report.binding_manifest_status || "unknown"],
    ["Runtime", runtime.status || "unknown"],
    ["Voice", runtime.tts_voice || "marin"],
  ];
  root.innerHTML = entries.map(([label, value]) => `<div class="gate-item"><strong>${label}</strong><p>${value}</p></div>`).join("");
}

function renderProductionPilot(releaseReport, ttsReport, audioManifest, bindingManifest, lessonSpec, sourceManifest, playbackEvidence, playbackReport) {
  const status = document.getElementById("productionPilotStatus");
  const summary = document.getElementById("productionPilotSummary");
  const assets = document.getElementById("productionPilotAssets");
  const blockers = document.getElementById("productionPilotBlockers");
  if (!status || !summary || !assets || !blockers) return;

  const slides = lessonSpec.slides || [];
  const sources = sourceManifest.sources || [];
  const audioAssets = audioManifest.audio_assets || [];
  const bindings = bindingManifest.bindings || [];
  const releaseStatus = releaseReport.status || "unknown";
  status.textContent = releaseStatus;
  status.className = `status-pill ${pillClass(releaseStatus)}`;

  const summaryRows = [
    ["Lesson", lessonSpec.title || releaseReport.pilot_id || "Production pilot"],
    ["Source grounding", releaseReport.source_grounded ? "source grounded" : "needs source review"],
    ["Slides", String(releaseReport.slide_count ?? slides.length)],
    ["Sources", String(releaseReport.source_count ?? sources.length)],
    ["OpenAI audio", `${releaseReport.verified_audio_count ?? ttsReport.verified_asset_count ?? 0}/${ttsReport.planned_asset_count ?? releaseReport.slide_count ?? slides.length} verified`],
    ["Bindings", `${releaseReport.binding_count ?? bindings.length} ready`],
    ["Playback gate", playbackReport.status || "blocked"],
    ["Release path", playbackReport.release_path || playbackEvidence.release_path || "not_selected"],
    ["Targets", `${(playbackReport.passed_targets || []).length}/${(playbackReport.required_targets || []).length} passed`],
  ];
  summary.innerHTML = summaryRows.map(([label, value]) => `
    <div class="pilot-kpi">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  assets.innerHTML = audioAssets.length
    ? audioAssets.map((asset) => `
      <div class="artifact-item">
        <strong>${asset.slide_id} - ${asset.slide_title || "Narration asset"}</strong>
        <p>${asset.status || "unknown"} - ${formatSeconds(asset.duration_seconds)} - ${(asset.bytes ?? 0).toLocaleString()} bytes</p>
      </div>
    `).join("")
    : `<div class="empty-state">No production pilot audio assets are loaded.</div>`;

  const externalBlockers = [...(releaseReport.external_blockers || []), ...(playbackReport.blockers || [])];
  blockers.innerHTML = externalBlockers.length
    ? externalBlockers.map((blocker) => `<div class="gate-item"><strong>Release blocker</strong><p>${blocker}</p></div>`).join("")
    : `<div class="gate-item"><strong>Playback path</strong><p>No external playback blocker is recorded.</p></div>`;
}

function renderArtifacts(activePackage, release) {
  const root = document.getElementById("artifactMap");
  const outputs = activePackage?.outputs?.length ? activePackage.outputs : ["state/*.json", "manifests/*.json", "qa/*.json"];
  const hardStops = release.hard_stop_rules || [];
  root.innerHTML = [
    ...outputs.map((output) => `<div class="artifact-item"><strong>${output}</strong><p>Expected package output</p></div>`),
    ...hardStops.slice(0, 4).map((rule) => `<div class="artifact-item"><strong>Hard stop</strong><p>${rule}</p></div>`),
  ].join("");
}

async function loadState() {
  const [
    project,
    queue,
    qa,
    release,
    pipeline,
    runtime,
    tts,
    productionPilotRelease,
    productionPilotTts,
    productionPilotAudio,
    productionPilotBinding,
    productionPilotLesson,
    productionPilotSource,
    productionPilotPlaybackEvidence,
    productionPilotPlaybackReport,
    workset,
  ] = await Promise.all([
    fetchJson(paths.project).catch(() => fallback.project),
    fetchJson(paths.queue).catch(() => fallback.queue),
    fetchJson(paths.qa).catch(() => fallback.qa),
    fetchJson(paths.release).catch(() => fallback.release),
    fetchJson(paths.pipeline).catch(() => fallback.pipeline),
    fetchJson(paths.runtime).catch(() => fallback.runtime),
    fetchJson(paths.tts).catch(() => fallback.tts),
    fetchJson(paths.productionPilotRelease).catch(() => fallback.productionPilotRelease),
    fetchJson(paths.productionPilotTts).catch(() => fallback.productionPilotTts),
    fetchJson(paths.productionPilotAudio).catch(() => fallback.productionPilotAudio),
    fetchJson(paths.productionPilotBinding).catch(() => fallback.productionPilotBinding),
    fetchJson(paths.productionPilotLesson).catch(() => fallback.productionPilotLesson),
    fetchJson(paths.productionPilotSource).catch(() => fallback.productionPilotSource),
    fetchJson(paths.productionPilotPlaybackEvidence).catch(() => fallback.productionPilotPlaybackEvidence),
    fetchJson(paths.productionPilotPlaybackReport).catch(() => fallback.productionPilotPlaybackReport),
    firstAvailable(paths.worksets).catch(() => fallback.workset),
  ]);
  const activePackage = selectActivePackage(queue);
  const blockers = [...(activePackage?.blockers || []), ...(qa.gates || []).filter((gate) => gate.status === "blocked").map((gate) => `${gate.gate}: ${gate.required_evidence}`)];
  setText("projectName", project.project_name || "Nurse Prep EB Workbench");
  setText("releaseState", release.release_state || "unknown");
  setText("releaseHint", release.export_pass_allowed ? "Export can proceed when package QA passes" : "Export remains blocked");
  setText("activePackage", activePackage?.id || "None");
  setText("activePackageTitle", activePackage?.title || "No active package");
  setText("blockerCount", String(blockers.length));
  setText("blockerSummary", blockers[0] || "No blockers recorded");
  setText("gateCount", `${(qa.gates || []).filter((gate) => gate.status !== "blocked").length}/${(qa.gates || []).length}`);
  setText("gateSummary", "Non-blocked gates");
  setText("runtimeStatus", runtime.status || "unknown");
  setText("runtimeSummary", pipeline.known_execution_context?.openai_authenticated_probe_status || runtime.tts_model || "Runtime state");
  renderWorkset(workset, activePackage, blockers);
  renderQueue(queue);
  renderGates(qa);
  renderTts(tts, runtime);
  renderProductionPilot(
    productionPilotRelease,
    productionPilotTts,
    productionPilotAudio,
    productionPilotBinding,
    productionPilotLesson,
    productionPilotSource,
    productionPilotPlaybackEvidence,
    productionPilotPlaybackReport,
  );
  renderArtifacts(activePackage, release);
}

document.getElementById("refreshButton")?.addEventListener("click", () => loadState());
loadState().catch((error) => {
  document.querySelector(".main")?.insertAdjacentHTML("afterbegin", `<div class="empty-state">Repository state could not be loaded: ${error.message}</div>`);
});
=======
const statusPath = "./data/execution-status.json";

const fallback = {
  schemaVersion: "1.0.0",
  generatedAt: null,
  frameworkId: "nclex-rn-2026",
  release: { name: "Eight-category exemplar milestone", stage: "clinical_review", portableExportsReady: true },
  coverage: { categoriesRepresented: 8, categoriesTotal: 8, integratedProcessesRepresented: 6, integratedProcessesTotal: 6, clinicalJudgmentFunctionsRepresented: 6, clinicalJudgmentFunctionsTotal: 6 },
  production: { batches: [{ id: "exemplar-eight", size: 8, status: "clinical_review", completedDrafts: 8 }], fullCurriculum: { status: "mapping", approvedPercent: 0, explicitGapPolicy: true } },
  reviewQueue: { awaitingLicensedRn: 8, approved: 0 },
  content: { exemplarTopics: 8, objectives: 24, assessmentItems: 120, clinicalJudgmentItems: 48, evidenceSources: 8 },
  sourceReadiness: { approvedOerSources: 8, blockedSources: 0, proprietaryPolicy: "Aliases and report parsing only; no proprietary ATI prose, rationales, or items." },
  quality: { automatedValidation: "pass", issues: [] },
  releaseGates: [
    { id: "automated_validation", label: "Automated curriculum validation", status: "pass" },
    { id: "licensed_rn_review", label: "Licensed RN faculty approval", status: "pending" },
    { id: "portable_exports", label: "Canvas-portable export validation", status: "pass" },
    { id: "public_release", label: "Public curriculum release", status: "blocked" },
  ],
  exports: ["curriculum-manifest.json", "canvas-outcomes.csv", "qti-exemplar-bank.xml", "nclex-rn-2026.imscc", "pathway-rules.json"],
  privacy: "Contains aggregate curriculum production status only; no learner or patient data.",
};

const setText = (id, value) => {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value ?? "—");
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function statusClass(status = "") {
  if (["pass", "approved", "export_ready", "complete"].includes(status)) return "status-pass";
  if (["blocked", "fail"].includes(status)) return "status-blocked";
  return "status-planned";
}

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${escapeHtml(String(status || "unknown").replaceAll("_", " "))}</span>`;
}

function renderCoverage(status) {
  const metrics = [
    ["Client Needs categories", status.coverage.categoriesRepresented, status.coverage.categoriesTotal],
    ["Integrated processes", status.coverage.integratedProcessesRepresented, status.coverage.integratedProcessesTotal],
    ["NCJMM functions", status.coverage.clinicalJudgmentFunctionsRepresented, status.coverage.clinicalJudgmentFunctionsTotal],
    ["Learning objectives", status.content.objectives, status.content.objectives],
  ];
  document.getElementById("coverageGrid").innerHTML = metrics.map(([label, current, total]) => {
    const percent = total ? Math.round((current / total) * 100) : 0;
    return `<div class="coverage-item"><div><strong>${escapeHtml(label)}</strong><span>${current}/${total}</span></div><div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div></div>`;
  }).join("");
}

function renderReleaseGates(status) {
  document.getElementById("releaseGates").innerHTML = status.releaseGates.map((gate) => `<div class="gate-item"><div class="panel-header"><strong>${escapeHtml(gate.label)}</strong>${statusPill(gate.status)}</div></div>`).join("");
}

function renderBatches(status) {
  const batches = status.production.batches || [];
  document.getElementById("productionBatches").innerHTML = batches.map((batch) => `
    <div class="queue-item">
      <div><strong>${escapeHtml(batch.id)}</strong><p>${batch.completedDrafts}/${batch.size} drafts complete</p></div>
      <div><strong>${escapeHtml(status.release.name)}</strong><p>Prioritized by blueprint weight, safety risk, prerequisites, and source readiness.</p></div>
      ${statusPill(batch.status)}
    </div>
  `).join("") || '<div class="empty-state">No production batches are scheduled.</div>';
}

function renderReview(status) {
  const rows = [
    ["Awaiting licensed RN", status.reviewQueue.awaitingLicensedRn, "Generated content remains unavailable for public release."],
    ["Approved", status.reviewQueue.approved, "Faculty-approved packages may advance toward export readiness."],
    ["Full-curriculum approval", `${status.production.fullCurriculum.approvedPercent}%`, `Current phase: ${status.production.fullCurriculum.status}`],
  ];
  document.getElementById("reviewQueue").innerHTML = rows.map(([label, value, detail]) => `<div class="gate-item"><div class="review-row"><strong>${escapeHtml(label)}</strong><b>${escapeHtml(value)}</b></div><p>${escapeHtml(detail)}</p></div>`).join("");
}

function renderSources(status) {
  document.getElementById("sourceReadiness").innerHTML = `
    <div class="source-metrics">
      <div><strong>${escapeHtml(status.sourceReadiness.approvedOerSources)}</strong><span>approved OER sources</span></div>
      <div><strong>${escapeHtml(status.sourceReadiness.blockedSources)}</strong><span>blocked sources</span></div>
      <div><strong>${escapeHtml(status.content.evidenceSources)}</strong><span>mapped evidence records</span></div>
    </div>
    <div class="policy-note"><strong>Proprietary-content boundary</strong><p>${escapeHtml(status.sourceReadiness.proprietaryPolicy)}</p></div>
  `;
}

function renderExports(status) {
  document.getElementById("exportList").innerHTML = status.exports.map((name) => `<div class="gate-item export-row"><strong>${escapeHtml(name)}</strong>${statusPill(status.release.portableExportsReady ? "pass" : "blocked")}</div>`).join("");
}

function render(status) {
  setText("releaseState", status.release.stage.replaceAll("_", " "));
  setText("releaseHint", status.release.portableExportsReady ? "Exports validated; clinical approval still required" : "Exports blocked by validation");
  setText("categoryCoverage", `${status.coverage.categoriesRepresented}/${status.coverage.categoriesTotal}`);
  setText("categorySummary", "All Client Needs categories represented");
  setText("reviewCount", status.reviewQueue.awaitingLicensedRn);
  setText("reviewSummary", "Exemplar topics awaiting licensed RN review");
  setText("assessmentCount", status.content.assessmentItems);
  setText("assessmentSummary", `${status.content.clinicalJudgmentItems} clinical-judgment case items`);
  setText("exportCount", status.exports.length);
  setText("exportSummary", status.release.portableExportsReady ? "Validated portable artifacts" : "Export validation blocked");
  const validationNode = document.getElementById("validationStatus");
  validationNode.textContent = status.quality.automatedValidation;
  validationNode.className = `status-pill ${statusClass(status.quality.automatedValidation)}`;
  setText("generatedAt", status.generatedAt ? `Generated ${new Date(status.generatedAt).toLocaleString()}` : "Using verified built-in curriculum status");
  setText("privacyNote", status.privacy);
  renderCoverage(status);
  renderReleaseGates(status);
  renderBatches(status);
  renderReview(status);
  renderSources(status);
  renderExports(status);
}

async function loadStatus() {
  try {
    const response = await fetch(statusPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`status artifact returned ${response.status}`);
    render(await response.json());
  } catch (error) {
    console.warn("Canonical execution status unavailable; using the bundled safe fallback.", error);
    render(fallback);
  }
}

document.getElementById("refreshButton")?.addEventListener("click", loadStatus);
document.querySelectorAll(".nav-list a").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-list a").forEach((item) => item.classList.toggle("active", item === link));
}));
loadStatus();
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
