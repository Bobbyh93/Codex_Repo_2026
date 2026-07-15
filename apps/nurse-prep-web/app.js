const today = new Date().toISOString().slice(0, 10);

const paths = {
  project: "/state/project_state.json",
  queue: "/state/work_queue.json",
  qa: "/state/qa_state.json",
  release: "/state/release_state.json",
  pipeline: "/state/pipeline_state.json",
  runtime: "/manifests/openai_runtime_check.json",
  tts: "/qa/tts_asset_verification_report.json",
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
  if (["pass", "complete", "ready_for_authenticated_probe", "ready_for_bounded_execution"].includes(status)) return "status-pass";
  if (["blocked", "not_ready", "blocked_or_planning_only"].includes(status)) return "status-blocked";
  return "status-planned";
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function itemStatus(status) {
  return `<span class="status-pill ${pillClass(status)}">${status || "unknown"}</span>`;
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
  const [project, queue, qa, release, pipeline, runtime, tts, workset] = await Promise.all([
    fetchJson(paths.project).catch(() => fallback.project),
    fetchJson(paths.queue).catch(() => fallback.queue),
    fetchJson(paths.qa).catch(() => fallback.qa),
    fetchJson(paths.release).catch(() => fallback.release),
    fetchJson(paths.pipeline).catch(() => fallback.pipeline),
    fetchJson(paths.runtime).catch(() => fallback.runtime),
    fetchJson(paths.tts).catch(() => fallback.tts),
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
  renderArtifacts(activePackage, release);
}

document.getElementById("refreshButton")?.addEventListener("click", () => loadState());
loadState().catch((error) => {
  document.querySelector(".main")?.insertAdjacentHTML("afterbegin", `<div class="empty-state">Repository state could not be loaded: ${error.message}</div>`);
});
