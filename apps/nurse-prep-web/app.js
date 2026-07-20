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
