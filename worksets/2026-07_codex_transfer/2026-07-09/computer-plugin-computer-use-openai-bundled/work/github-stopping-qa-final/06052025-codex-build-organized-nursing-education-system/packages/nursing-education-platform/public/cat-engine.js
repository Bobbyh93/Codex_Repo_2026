export function getScopedItems(items, scope = "full", weakConcepts = []) {
  const approved = items.filter((item) => item.status === "approved");
  if (scope === "full") return approved;
  if (scope === "weak") {
    return approved.filter((item) => item.concepts.some((concept) => weakConcepts.includes(concept)));
  }
  return approved.filter((item) => item.category === scope);
}

export function getExposureItemIds(attempts = [], { lookbackAttempts = 2 } = {}) {
  return [
    ...new Set(
      attempts
        .slice(0, lookbackAttempts)
        .flatMap((attempt) => attempt.itemIds || attempt.responses?.map((response) => response.itemId) || []),
    ),
  ];
}

export function applyExposureControls(items, exposureItemIds = []) {
  const exposed = new Set(exposureItemIds);
  return {
    eligible: items.filter((item) => !exposed.has(item.id)),
    excluded: items.filter((item) => exposed.has(item.id)),
  };
}

export function getRemainingEligibleItems({ items, session, scope = "full", weakConcepts = [], exposureItemIds = session.exposureItemIds || [] }) {
  const scopedPool = getScopedItems(items, scope, weakConcepts).filter((item) => !session.used.includes(item.id));
  return applyExposureControls(scopedPool, exposureItemIds).eligible;
}

export function normalizeStoppingRules(rules = {}, fallbackLength = 4) {
  const maxItems = normalizePositiveInteger(rules.maxItems ?? rules.length, fallbackLength || 4);
  const minItems = Math.min(normalizePositiveInteger(rules.minItems, 1), maxItems);
  const precisionWindow = Math.max(2, normalizePositiveInteger(rules.precisionWindow, 3));

  return {
    maxItems,
    minItems,
    masteryAbility: normalizeNullableNumber(rules.masteryAbility),
    precisionTarget: normalizeNullableNumber(rules.precisionTarget),
    precisionWindow,
  };
}

export function createSession({ id = `CAT-${Date.now()}`, length, startingAbility = 0, exposureItemIds = [], stoppingRules = {} }) {
  const normalizedStoppingRules = normalizeStoppingRules({ ...stoppingRules, maxItems: stoppingRules.maxItems ?? length }, length);

  return {
    id,
    length: normalizedStoppingRules.maxItems,
    ability: startingAbility,
    abilityHistory: [startingAbility],
    responses: [],
    used: [],
    coverage: {},
    exposureItemIds,
    stoppingRules: normalizedStoppingRules,
    stop: null,
  };
}

export function selectNextItem({ items, blueprint, session, scope = "full", weakConcepts = [], exposureItemIds = session.exposureItemIds || [] }) {
  const scopedPool = getScopedItems(items, scope, weakConcepts).filter((item) => !session.used.includes(item.id));
  const { eligible, excluded } = applyExposureControls(scopedPool, exposureItemIds);
  const pool = eligible;
  if (!pool.length) return null;

  const totalSeen = Object.values(session.coverage).reduce((sum, count) => sum + count, 0);
  const rankedCategories = blueprint
    .map((entry) => {
      const seen = session.coverage[entry.category] || 0;
      const observedShare = totalSeen ? seen / totalSeen : 0;
      return { ...entry, gap: entry.target / 100 - observedShare };
    })
    .sort((a, b) => b.gap - a.gap);

  for (const category of rankedCategories) {
    const candidates = pool
      .filter((item) => item.category === category.category)
      .sort((a, b) => Math.abs(a.difficulty - session.ability) - Math.abs(b.difficulty - session.ability));

    if (candidates.length) {
      const exposureNote = excluded.length ? ` ${excluded.length} recently exposed item${excluded.length === 1 ? " was" : "s were"} withheld.` : "";
      return {
        item: candidates[0],
        reason: `Selected ${category.category} because it is under target coverage; difficulty ${candidates[0].difficulty.toFixed(1)} is closest to ability ${session.ability.toFixed(2)}.${exposureNote}`,
      };
    }
  }

  const fallback = pool.sort((a, b) => Math.abs(a.difficulty - session.ability) - Math.abs(b.difficulty - session.ability))[0];
  return {
    item: fallback,
    reason: `Fallback selection by difficulty match near ability ${session.ability.toFixed(2)}; recently exposed items remain withheld.`,
  };
}

export function recordResponse(session, item, selected) {
  const correct = selected === item.answer;
  const before = session.ability;
  const after = updateAbility(before, item.difficulty, correct);

  session.ability = after;
  session.abilityHistory.push(after);
  session.coverage[item.category] = (session.coverage[item.category] || 0) + 1;
  session.responses.push({ itemId: item.id, selected, correct, before, after });

  return { correct, before, after };
}

export function evaluateStoppingRule(session, { eligibleCount = null } = {}) {
  const rules = normalizeStoppingRules(session.stoppingRules || {}, session.length);
  const completed = session.responses.length;

  if (!completed) {
    return continueOutcome(`0 of ${rules.maxItems} item${rules.maxItems === 1 ? "" : "s"} completed`);
  }

  if (completed >= rules.minItems && rules.masteryAbility !== null && session.ability >= rules.masteryAbility) {
    return stopOutcome(
      "mastery_threshold",
      "Mastery threshold",
      `Ability ${session.ability.toFixed(2)} reached threshold ${rules.masteryAbility.toFixed(2)} after ${completed} item${completed === 1 ? "" : "s"}.`,
    );
  }

  if (completed >= Math.max(rules.minItems, rules.precisionWindow) && rules.precisionTarget !== null) {
    const recentChanges = recentAbilityChanges(session.abilityHistory, rules.precisionWindow);
    const maxRecentChange = recentChanges.length ? Math.max(...recentChanges) : Infinity;
    if (recentChanges.length >= rules.precisionWindow && maxRecentChange <= rules.precisionTarget) {
      return stopOutcome(
        "precision_target",
        "Stable estimate",
        `Recent ability movement stayed within ${rules.precisionTarget.toFixed(2)} over ${rules.precisionWindow} updates.`,
      );
    }
  }

  if (completed >= rules.maxItems) {
    return stopOutcome("max_items", "Max items", `${completed} of ${rules.maxItems} configured items completed.`);
  }

  if (eligibleCount === 0) {
    return stopOutcome("eligible_pool_exhausted", "Eligible pool exhausted", "No eligible unexposed approved items remain for this session scope.");
  }

  return continueOutcome(`${completed} of ${rules.maxItems} configured items completed`);
}

export function updateAbility(ability, difficulty, correct) {
  const mismatch = Math.abs(difficulty - ability);
  const base = 0.22 + Math.min(0.18, mismatch * 0.08);
  const challengeBoost = correct && difficulty > ability ? 0.08 : 0;
  const missPenalty = !correct && difficulty < ability ? 0.08 : 0;
  return clamp(ability + (correct ? 1 : -1) * (base + challengeBoost + missPenalty), -3, 3);
}

export function summarizeSession(session, items) {
  const correctItems = session.responses.filter((response) => response.correct).length;
  const missedItems = session.responses.filter((response) => !response.correct).map((response) => findItem(items, response.itemId));
  const weakConcepts = [...new Set(missedItems.flatMap((item) => item.concepts))];

  return {
    completedItems: session.responses.length,
    correctItems,
    scorePercent: session.responses.length ? Math.round((correctItems / session.responses.length) * 100) : 0,
    finalAbilityEstimate: Number(session.ability.toFixed(2)),
    missedItems,
    weakConcepts,
  };
}

export function createAttemptRecord(session, items, completedAt = new Date().toISOString()) {
  const summary = summarizeSession(session, items);
  const stopping = session.stop || evaluateStoppingRule(session);
  return {
    id: session.id,
    completedAt,
    itemIds: session.responses.map((response) => response.itemId),
    completedItems: summary.completedItems,
    scorePercent: summary.scorePercent,
    finalAbilityEstimate: summary.finalAbilityEstimate,
    weakConcepts: summary.weakConcepts,
    exposureItemIds: session.exposureItemIds || [],
    stopping,
  };
}

export function buildRemediationPlan(session, items) {
  const summary = summarizeSession(session, items);

  if (!summary.missedItems.length) {
    return [
      { title: "Maintain proficiency", value: "0", detail: "No weak concepts detected in this session." },
      { title: "Next practice", value: "Full", detail: "Run a longer mixed session to increase blueprint coverage evidence." },
      { title: "Instructor note", value: "Ready", detail: "Learner can move to higher difficulty items or readiness review." },
    ];
  }

  const lessons = [...new Set(summary.missedItems.map((item) => item.lesson))];
  const retestPool = getScopedItems(items, "weak", summary.weakConcepts).length;

  return [
    { title: "Priority concepts", value: String(summary.weakConcepts.length), detail: summary.weakConcepts.join(", ") },
    { title: "Linked lessons", value: String(lessons.length), detail: lessons.join(", ") },
    { title: "Retest pool", value: String(retestPool), detail: "Use weak-concepts retest for targeted reassessment." },
  ];
}

export function buildSessionExport({ session, items }) {
  const summary = summarizeSession(session, items);
  const stopping = session.stop || evaluateStoppingRule(session);

  return {
    sessionId: session.id,
    boundary: "Educational CAT-style simulator; not official NCLEX scoring equivalence.",
    summary: {
      completedItems: summary.completedItems,
      correctItems: summary.correctItems,
      scorePercent: summary.scorePercent,
      finalAbilityEstimate: summary.finalAbilityEstimate,
      weakConcepts: summary.weakConcepts,
    },
    exposure: {
      withheldItemIds: session.exposureItemIds || [],
    },
    stopping,
    coverage: session.coverage,
    abilityHistory: session.abilityHistory.map((value) => Number(value.toFixed(2))),
    responses: session.responses.map((response) => {
      const item = findItem(items, response.itemId);
      return {
        itemId: item.id,
        selectedResponse: response.selected,
        correctResponse: item.answer,
        correct: response.correct,
        category: item.category,
        clinicalJudgmentStep: item.step,
        concepts: item.concepts,
        lesson: item.lesson,
      };
    }),
  };
}

export function evaluateGates(items, blueprint) {
  const approved = items.filter((item) => item.status === "approved");
  const categories = new Set(approved.map((item) => item.category));

  return [
    gate("Approved item pool", approved.length >= blueprint.length, `${approved.length} approved items available`),
    gate("Blueprint mapping", categories.size === blueprint.length, `${categories.size} of ${blueprint.length} categories represented`),
    gate("Concept mapping", approved.every((item) => item.concepts.length), "all approved items mapped to concepts"),
    gate("Lesson remediation links", approved.every((item) => item.lesson), "all approved items link to lessons"),
    gate("Rationales", approved.every((item) => item.rationale), "all approved items include rationales"),
    gate("Scoring metadata", approved.every((item) => item.answer), "all approved items include answer metadata"),
  ];
}

export function evaluateExposureReadiness(items, attempts, { lookbackAttempts = 2 } = {}) {
  const exposureItemIds = getExposureItemIds(attempts, { lookbackAttempts });
  const eligible = applyExposureControls(getScopedItems(items), exposureItemIds).eligible.length;
  return {
    exposureItemIds,
    eligible,
    excluded: exposureItemIds.length,
    pass: eligible > 0,
    detail: eligible ? `${eligible} unexposed approved items available` : "clear attempt history or add new approved items",
  };
}

export function buildCoverageMatrix(items, blueprint) {
  return blueprint.map((entry) => {
    const count = items.filter((item) => item.status === "approved" && item.category === entry.category).length;
    return {
      category: entry.category,
      target: entry.target,
      count,
      status: count ? "pilot-seeded" : "needs items",
      depthPercent: Math.min(100, count * 100),
    };
  });
}

export function findItem(items, id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

function gate(name, pass, detail) {
  return { name, pass, detail };
}

function stopOutcome(code, label, detail) {
  return { stop: true, code, label, detail };
}

function continueOutcome(detail) {
  return { stop: false, code: "continue", label: "Continue", detail };
}

function recentAbilityChanges(history, windowSize) {
  const recent = history.slice(-1 * (windowSize + 1));
  return recent.slice(1).map((value, index) => Number(Math.abs(value - recent[index]).toFixed(4)));
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
