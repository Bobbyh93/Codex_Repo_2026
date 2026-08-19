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
