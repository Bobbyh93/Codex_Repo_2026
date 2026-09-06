import { blueprint, buildPath, items } from "./data.js";
import {
  buildCoverageMatrix,
  buildRemediationPlan,
  buildSessionExport,
  createAttemptRecord,
  createSession,
  evaluateExposureReadiness,
  evaluateGates,
  evaluateStoppingRule,
  findItem,
  getExposureItemIds,
  getRemainingEligibleItems,
  getScopedItems,
  recordResponse,
  selectNextItem,
  summarizeSession,
} from "./cat-engine.js";
import { buildImportTemplate, validateItemBank, validateItemImportPayload } from "./item-validation.js";
import { clearAttempts, clearPersistentAttempts, formatAttemptSummary, loadAttempts, loadPersistentAttempts, saveAttempt, savePersistentAttempt } from "./storage.js";

const state = {
  view: "practice",
  session: null,
  current: null,
  selected: null,
  lastResults: null,
  weakScope: null,
  exportOpen: false,
  attemptHistory: [],
  importValidation: null,
  persistence: {
    source: "local",
    detail: "Browser local storage fallback",
  },
};

const els = {
  views: [...document.querySelectorAll(".view")],
  nav: [...document.querySelectorAll(".nav button")],
  buildPath: document.querySelector("#buildPath"),
  scope: document.querySelector("#scopeSelect"),
  length: document.querySelector("#lengthSelect"),
  startAbility: document.querySelector("#startAbility"),
  stopping: document.querySelector("#stoppingRule"),
  start: document.querySelector("#startButton"),
  reset: document.querySelector("#resetButton"),
  clearHistory: document.querySelector("#clearHistoryButton"),
  setup: document.querySelector("#setupScreen"),
  exam: document.querySelector("#examScreen"),
  status: document.querySelector("#sessionStatus"),
  readiness: document.querySelector("#readinessList"),
  attemptList: document.querySelector("#attemptList"),
  exposureSummary: document.querySelector("#exposureSummary"),
  progress: document.querySelector("#progressTitle"),
  reason: document.querySelector("#selectionReason"),
  ability: document.querySelector("#abilityPill"),
  meta: document.querySelector("#questionMeta"),
  stem: document.querySelector("#stem"),
  options: document.querySelector("#options"),
  rationale: document.querySelector("#rationaleBox"),
  confirm: document.querySelector("#confirmButton"),
  next: document.querySelector("#nextButton"),
  end: document.querySelector("#endButton"),
  empty: document.querySelector("#resultsEmpty"),
  content: document.querySelector("#resultsContent"),
  score: document.querySelector("#scoreMetric"),
  finalAbility: document.querySelector("#abilityMetric"),
  weak: document.querySelector("#weakMetric"),
  stop: document.querySelector("#stopMetric"),
  remediation: document.querySelector("#remediationPlan"),
  exportButton: document.querySelector("#exportButton"),
  exportPanel: document.querySelector("#exportPanel"),
  exportText: document.querySelector("#sessionExport"),
  retest: document.querySelector("#retestButton"),
  coverage: document.querySelector("#coverageBars"),
  trend: document.querySelector("#abilityTrend"),
  review: document.querySelector("#reviewList"),
  map: document.querySelector("#itemMap"),
  controlGates: document.querySelector("#controlGates"),
  coverageMatrix: document.querySelector("#coverageMatrix"),
  gateButton: document.querySelector("#gateButton"),
  importInput: document.querySelector("#itemImportInput"),
  importSummary: document.querySelector("#importValidationSummary"),
  importIssues: document.querySelector("#importValidationIssues"),
  validateImport: document.querySelector("#validateImportButton"),
  resetImport: document.querySelector("#resetImportButton"),
  navResults: document.querySelector("#navResults"),
  navControl: document.querySelector("#navControl"),
};

init();

function init() {
  state.attemptHistory = loadAttempts();
  renderScopeOptions();
  renderBuildPath();
  renderAttemptHistory();
  renderGates();
  renderMapping();
  resetImportDraft();
  bindEvents();
  refreshPersistentAttempts();
}

function bindEvents() {
  els.nav.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  els.start.addEventListener("click", startSession);
  els.reset.addEventListener("click", resetPrototype);
  els.clearHistory.addEventListener("click", clearAttemptHistory);
  els.confirm.addEventListener("click", confirmAnswer);
  els.next.addEventListener("click", advanceItem);
  els.end.addEventListener("click", () =>
    finishSession({
      stop: true,
      code: "learner_ended",
      label: "Learner ended",
      detail: "Session ended manually before a configured stopping rule fired.",
    }),
  );
  els.exportButton.addEventListener("click", toggleExport);
  els.retest.addEventListener("click", startWeakRetest);
  els.gateButton.addEventListener("click", renderGates);
  els.validateImport.addEventListener("click", validateImportDraft);
  els.resetImport.addEventListener("click", resetImportDraft);
  els.scope.addEventListener("change", () => {
    if (els.scope.value !== "weak") state.weakScope = null;
  });
}

function renderScopeOptions() {
  const weakEnabled = Array.isArray(state.weakScope) && state.weakScope.length > 0;
  els.scope.innerHTML = [
    `<option value="full">Full RN blueprint</option>`,
    `<option value="weak"${weakEnabled ? "" : " disabled"}>Weak concepts retest${weakEnabled ? ` (${state.weakScope.length})` : ""}</option>`,
    ...blueprint.map((entry) => `<option value="${entry.category}">${entry.category}</option>`),
  ].join("");
  if (weakEnabled) els.scope.value = "weak";
}

function setView(view) {
  state.view = view;
  els.views.forEach((node) => node.classList.toggle("hidden", node.id !== `view-${view}`));
  els.nav.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (view === "results") renderResults();
  if (view === "control") renderGates();
}

function renderBuildPath() {
  els.buildPath.innerHTML = buildPath
    .map(([name, detail]) => `<div class="path-row"><div><h3>${name}</h3><p class="muted small">${detail}</p></div><span class="status pass">ok</span></div>`)
    .join("");
}

function startSession() {
  const exposureItemIds = getExposureItemIds(state.attemptHistory);
  const exposed = new Set(exposureItemIds);
  const scopedPool = getScopedItems(items, els.scope.value, state.weakScope || []);
  const eligiblePool = scopedPool.filter((item) => !exposed.has(item.id));

  if (!scopedPool.length) {
    els.status.textContent = "No eligible items for scope";
    return;
  }

  if (!eligiblePool.length) {
    els.status.textContent = "Exposure pool exhausted";
    renderAttemptHistory();
    return;
  }

  const length = Math.min(Number(els.length.value), eligiblePool.length);
  state.session = createSession({
    length,
    startingAbility: Number(els.startAbility.value),
    exposureItemIds,
    stoppingRules: buildStoppingRules(length),
  });
  state.selected = null;
  state.exportOpen = false;
  els.setup.classList.add("hidden");
  els.exam.classList.remove("hidden");
  els.status.textContent = exposureItemIds.length ? "Session in progress; exposure active" : "Session in progress";
  advanceItem();
}

function advanceItem() {
  if (!state.session) return;

  if (state.session.stop?.stop || state.session.responses.length >= state.session.length) {
    state.session.stop ||= evaluateCurrentStoppingRule();
    finishSession();
    return;
  }

  const stop = evaluateCurrentStoppingRule();
  if (stop.stop) {
    state.session.stop = stop;
    finishSession();
    return;
  }

  const selection = selectNextItem({
    items,
    blueprint,
    session: state.session,
    scope: els.scope.value,
    weakConcepts: state.weakScope || [],
    exposureItemIds: state.session.exposureItemIds,
  });

  if (!selection) {
    state.session.stop = evaluateStoppingRule(state.session, { eligibleCount: 0 });
    finishSession();
    return;
  }

  state.current = selection;
  state.selected = null;
  state.session.used.push(selection.item.id);
  renderCurrentItem();
}

function renderCurrentItem() {
  const { item, reason } = state.current;
  const number = state.session.responses.length + 1;
  els.progress.textContent = `Item ${number} of ${state.session.length}`;
  els.reason.textContent = reason;
  els.ability.textContent = `ability ${state.session.ability.toFixed(2)}`;
  els.meta.innerHTML = [item.category, item.step.replaceAll("_", " "), `difficulty ${item.difficulty.toFixed(1)}`, ...item.concepts]
    .map((text) => `<span class="tag">${text}</span>`)
    .join("");
  els.stem.textContent = item.stem;
  els.options.innerHTML = item.options
    .map((option) => `<button class="option" type="button" data-option="${option.id}"><span class="key">${option.id}</span><span>${option.text}</span></button>`)
    .join("");
  els.options.querySelectorAll(".option").forEach((button) => {
    button.addEventListener("click", () => {
      state.selected = button.dataset.option;
      els.options.querySelectorAll(".option").forEach((node) => node.classList.toggle("selected", node === button));
      els.confirm.disabled = false;
    });
  });
  els.rationale.classList.add("hidden");
  els.confirm.disabled = true;
  els.confirm.classList.remove("hidden");
  els.next.classList.add("hidden");
}

function confirmAnswer() {
  if (!state.current || !state.selected) return;
  const item = state.current.item;
  const result = recordResponse(state.session, item, state.selected);

  els.options.querySelectorAll(".option").forEach((button) => {
    button.disabled = true;
    if (button.dataset.option === item.answer) button.classList.add("correct");
    if (button.dataset.option === state.selected && !result.correct) button.classList.add("incorrect");
  });
  els.rationale.classList.remove("hidden");
  const stop = evaluateCurrentStoppingRule();
  if (stop.stop) state.session.stop = stop;
  const stopLine = stop.stop ? `<p class="small" style="margin-top: 8px"><strong>Stopping rule:</strong> ${stop.detail}</p>` : "";
  els.rationale.innerHTML = `<h3>${result.correct ? "Correct" : "Needs review"}</h3><p class="muted small" style="margin-top: 6px">${item.rationale}</p><p class="small" style="margin-top: 8px"><strong>Ability:</strong> ${result.before.toFixed(2)} to ${result.after.toFixed(2)}</p>${stopLine}`;
  els.confirm.classList.add("hidden");
  els.next.classList.remove("hidden");
  els.next.textContent = stop.stop || state.session.responses.length >= state.session.length ? "Finish and review" : "Next item";
}

function finishSession(stopOverride = null) {
  if (!state.session) return;

  const finishedSession = state.session;
  const hasResponses = finishedSession.responses.length > 0;
  if (hasResponses) {
    finishedSession.stop = stopOverride || finishedSession.stop || evaluateCurrentStoppingRule(finishedSession);
  }
  state.lastResults = hasResponses ? finishedSession : null;

  if (hasResponses) {
    const attempt = createAttemptRecord(finishedSession, items);
    state.attemptHistory = saveAttempt(attempt);
    renderAttemptHistory();
    renderGates();
    persistAttempt(attempt);
  }

  state.session = null;
  state.current = null;
  state.selected = null;
  els.setup.classList.remove("hidden");
  els.exam.classList.add("hidden");
  els.status.textContent = "Prototype mode";
  els.navResults.textContent = hasResponses ? "ready" : "empty";
  setView(hasResponses ? "results" : "practice");
}

function renderResults() {
  if (!state.lastResults) {
    els.empty.classList.remove("hidden");
    els.content.classList.add("hidden");
    els.exportButton.disabled = true;
    els.retest.disabled = true;
    return;
  }

  const summary = summarizeSession(state.lastResults, items);
  els.empty.classList.add("hidden");
  els.content.classList.remove("hidden");
  els.score.textContent = `${summary.scorePercent}%`;
  els.finalAbility.textContent = summary.finalAbilityEstimate.toFixed(2);
  els.weak.textContent = summary.weakConcepts.length;
  const stop = state.lastResults.stop || evaluateStoppingRule(state.lastResults);
  els.stop.textContent = stop.label;
  els.stop.title = stop.detail;
  els.exportButton.disabled = false;
  els.retest.disabled = summary.weakConcepts.length === 0;
  els.retest.textContent = summary.weakConcepts.length ? "Retest weak concepts" : "No weak concepts to retest";
  renderRemediation();
  renderCoverage();
  renderTrend();
  renderReview();
  renderExport();
}

function renderRemediation() {
  els.remediation.innerHTML = buildRemediationPlan(state.lastResults, items)
    .map((card) => `<article class="remediation-card"><h3>${card.title}</h3><p class="card-value">${card.value}</p><p class="muted small">${card.detail}</p></article>`)
    .join("");
}

function renderCoverage() {
  const total = state.lastResults.responses.length;
  els.coverage.innerHTML = blueprint
    .map((entry) => {
      const count = state.lastResults.coverage[entry.category] || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return `<div><div class="bar-label"><span>${entry.category}</span><span>${count} item${count === 1 ? "" : "s"} target ${entry.target}%</span></div><div class="bar-track"><div class="bar-fill" style="width: ${pct}%"></div></div></div>`;
    })
    .join("");
}

function renderTrend() {
  els.trend.innerHTML = state.lastResults.abilityHistory
    .map((value) => `<div class="trend-bar" title="${value.toFixed(2)}" style="height: ${Math.max(8, ((value + 3) / 6) * 100)}%"></div>`)
    .join("");
}

function renderReview() {
  els.review.innerHTML = state.lastResults.responses
    .map((response) => {
      const item = findItem(items, response.itemId);
      return `<article class="result-row"><div class="section-head"><div><h3>${item.id} - ${item.category}</h3><p class="muted small">${item.stem}</p></div><span class="status ${response.correct ? "pass" : "fail"}">${response.correct ? "correct" : "missed"}</span></div><p class="small"><strong>Rationale:</strong> ${item.rationale}</p><div class="tag-list">${item.concepts.map((concept) => `<span class="tag">${concept}</span>`).join("")}<span class="tag">${item.lesson}</span></div></article>`;
    })
    .join("");
}

function toggleExport() {
  state.exportOpen = !state.exportOpen;
  renderExport();
}

function renderExport() {
  if (!state.lastResults || !state.exportOpen) {
    els.exportPanel.classList.add("hidden");
    els.exportButton.textContent = "Export session";
    return;
  }
  els.exportPanel.classList.remove("hidden");
  els.exportButton.textContent = "Hide export";
  els.exportText.textContent = JSON.stringify(buildSessionExport({ session: state.lastResults, items }), null, 2);
}

function startWeakRetest() {
  if (!state.lastResults) return;
  const summary = summarizeSession(state.lastResults, items);
  if (!summary.weakConcepts.length) return;
  state.weakScope = summary.weakConcepts;
  renderScopeOptions();
  setView("practice");
}

function renderMapping() {
  els.map.innerHTML = items
    .map((item) => `<article class="map-row"><h3>${item.id} - ${item.category}</h3><p class="muted small" style="margin-top: 4px">${item.stem}</p><div class="tag-list"><span class="tag">${item.step.replaceAll("_", " ")}</span><span class="tag">difficulty ${item.difficulty.toFixed(1)}</span>${item.concepts.map((concept) => `<span class="tag">${concept}</span>`).join("")}<span class="tag">${item.lesson}</span></div></article>`)
    .join("");
}

function renderGates() {
  const exposure = evaluateExposureReadiness(items, state.attemptHistory);
  const itemValidation = validateItemBank(items, blueprint);
  const gates = [
    ...evaluateGates(items, blueprint),
    {
      name: "Exposure control",
      pass: exposure.pass,
      detail: `${exposure.detail}; ${exposure.excluded} recently exposed item${exposure.excluded === 1 ? "" : "s"} withheld`,
    },
    {
      name: "Stopping rules",
      pass: true,
      detail: "max item, mastery threshold, stable estimate, and eligible-pool exhaustion stops available",
    },
    {
      name: "Persistent learner records",
      pass: state.persistence.source === "server",
      detail:
        state.persistence.source === "server"
          ? state.persistence.detail
          : `${state.persistence.detail}; use npm run dev for JSON-backed session history`,
    },
    {
      name: "Item import contract",
      pass: itemValidation.pass,
      detail: `${itemValidation.readyItems} of ${itemValidation.totalItems} seeded items ready; ${itemValidation.errorCount} error${itemValidation.errorCount === 1 ? "" : "s"}, ${itemValidation.warningCount} warning${itemValidation.warningCount === 1 ? "" : "s"}`,
    },
  ];
  const html = gates.map((gate) => `<article class="gate-row"><div class="section-head"><div><h3>${gate.name}</h3><p class="muted small">${gate.detail}</p></div><span class="status ${gate.pass ? "pass" : "fail"}">${gate.pass ? "pass" : "blocked"}</span></div></article>`).join("");
  els.readiness.innerHTML = html;
  els.controlGates.innerHTML = html;
  els.navControl.textContent = gates.every((gate) => gate.pass) ? "pass" : "blocked";
  renderCoverageMatrix();
}

function renderCoverageMatrix() {
  els.coverageMatrix.innerHTML = buildCoverageMatrix(items, blueprint)
    .map((entry) => `<article class="coverage-row"><span><strong>${entry.category}</strong><br><span class="muted small">Target midpoint ${entry.target}%</span></span><span>${entry.count}</span><span><span class="muted small">${entry.status}</span><span class="depth-meter"><span class="depth-fill" style="width: ${entry.depthPercent}%"></span></span></span></article>`)
    .join("");
}

function renderAttemptHistory() {
  const exposure = evaluateExposureReadiness(items, state.attemptHistory);
  const excluded = exposure.exposureItemIds.length;
  const persistenceLabel = state.persistence.source === "server" ? "Server persistence active" : "Local history fallback";
  els.exposureSummary.textContent = excluded
    ? `${excluded} recently exposed item${excluded === 1 ? "" : "s"} withheld; ${exposure.eligible} unexposed approved item${exposure.eligible === 1 ? "" : "s"} available. ${persistenceLabel}.`
    : `No saved attempts yet; all approved items are eligible. ${persistenceLabel}.`;
  els.clearHistory.disabled = state.attemptHistory.length === 0;

  if (!state.attemptHistory.length) {
    els.attemptList.innerHTML = `<article class="attempt-row"><div><h3>No saved attempts</h3><p class="muted small">Complete a CAT practice session to activate cross-session exposure control.</p></div><span class="status pass">open</span></article>`;
    return;
  }

  els.attemptList.innerHTML = state.attemptHistory
    .map((attempt) => {
      const summary = formatAttemptSummary(attempt);
      const stopping = attempt.stopping?.label ? `${attempt.stopping.label} stop` : "stop saved";
      return `<article class="attempt-row"><div><h3>${summary.title}</h3><p class="muted small">${summary.detail}</p><p class="muted small">${summary.meta}</p><p class="muted small">${stopping}</p></div><span class="status pass">saved</span></article>`;
    })
    .join("");
}

function resetImportDraft() {
  els.importInput.value = JSON.stringify(buildImportTemplate(blueprint), null, 2);
  state.importValidation = validateItemImportPayload(els.importInput.value, blueprint, items);
  renderImportValidation();
}

function validateImportDraft() {
  state.importValidation = validateItemImportPayload(els.importInput.value, blueprint, items);
  renderImportValidation();
}

function renderImportValidation() {
  const result = state.importValidation || validateItemBank(items, blueprint);
  els.importSummary.innerHTML = [
    validationCard("Items", result.totalItems, result.pass ? "Ready for review" : "Needs revision"),
    validationCard("Ready", result.readyItems, `${result.errorCount} error${result.errorCount === 1 ? "" : "s"}`),
    validationCard("Warnings", result.warningCount, `${result.issueCount} total issue${result.issueCount === 1 ? "" : "s"}`),
  ].join("");

  if (!result.issues.length) {
    els.importIssues.innerHTML = `<article class="issue-row"><div><h3>Import ready</h3><p class="muted small">All item metadata passed the current contract checks.</p></div><span class="status pass">pass</span></article>`;
    return;
  }

  const visibleIssues = result.issues.slice(0, 8);
  const overflow = result.issues.length > visibleIssues.length ? `<article class="issue-row"><div><h3>Additional issues</h3><p class="muted small">${result.issues.length - visibleIssues.length} more issue${result.issues.length - visibleIssues.length === 1 ? "" : "s"} hidden from this preview.</p></div><span class="status fail">more</span></article>` : "";
  els.importIssues.innerHTML = `${visibleIssues
    .map(
      (entry) =>
        `<article class="issue-row"><div><h3>${escapeHtml(entry.itemId)} - ${escapeHtml(entry.field)}</h3><p class="muted small">${escapeHtml(entry.message)}</p></div><span class="status ${entry.severity === "error" ? "fail" : "warn"}">${escapeHtml(entry.severity)}</span></article>`,
    )
    .join("")}${overflow}`;
}

function validationCard(label, value, detail) {
  return `<article class="validation-card"><p class="muted small">${escapeHtml(label)}</p><p class="metric-value compact-value">${escapeHtml(String(value))}</p><p class="muted small">${escapeHtml(detail)}</p></article>`;
}

function clearAttemptHistory() {
  state.attemptHistory = clearAttempts();
  renderAttemptHistory();
  renderGates();
  els.status.textContent = "Attempt history cleared";
  clearPersistentAttempts().then(applyPersistenceResult);
}

function resetPrototype() {
  state.session = null;
  state.current = null;
  state.selected = null;
  state.lastResults = null;
  state.weakScope = null;
  state.exportOpen = false;
  renderScopeOptions();
  els.scope.value = "full";
  els.setup.classList.remove("hidden");
  els.exam.classList.add("hidden");
  els.status.textContent = "Prototype mode";
  els.navResults.textContent = "empty";
  setView("practice");
}

function buildStoppingRules(maxItems) {
  if (els.stopping.value === "mastery") {
    return { maxItems, minItems: Math.min(3, maxItems), masteryAbility: 0.8 };
  }

  if (els.stopping.value === "precision") {
    return { maxItems, minItems: Math.min(3, maxItems), precisionTarget: 0.08, precisionWindow: 3 };
  }

  return { maxItems, minItems: maxItems };
}

function evaluateCurrentStoppingRule(session = state.session) {
  return evaluateStoppingRule(session, { eligibleCount: getRemainingEligibleCount(session) });
}

function getRemainingEligibleCount(session = state.session) {
  return getRemainingEligibleItems({
    items,
    session,
    scope: els.scope.value,
    weakConcepts: state.weakScope || [],
    exposureItemIds: session.exposureItemIds,
  }).length;
}

function refreshPersistentAttempts() {
  loadPersistentAttempts().then(applyPersistenceResult);
}

function persistAttempt(attempt) {
  savePersistentAttempt(attempt).then(applyPersistenceResult);
}

function applyPersistenceResult(result) {
  state.attemptHistory = result.attempts;
  state.persistence = {
    source: result.source,
    detail: result.detail,
  };
  renderAttemptHistory();
  renderGates();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
