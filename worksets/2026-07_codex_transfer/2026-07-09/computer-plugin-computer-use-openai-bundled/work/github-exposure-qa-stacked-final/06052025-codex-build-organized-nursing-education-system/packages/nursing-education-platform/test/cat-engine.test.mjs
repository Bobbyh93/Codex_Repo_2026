import assert from "node:assert/strict";

import { blueprint, items } from "../public/data.js";
import {
  buildCoverageMatrix,
  buildRemediationPlan,
  buildSessionExport,
  createAttemptRecord,
  createSession,
  evaluateExposureReadiness,
  evaluateGates,
  evaluateStoppingRule,
  getExposureItemIds,
  getRemainingEligibleItems,
  getScopedItems,
  recordResponse,
  selectNextItem,
  summarizeSession,
} from "../public/cat-engine.js";

function next(session, answer, expectedItemId) {
  const selection = selectNextItem({ items, blueprint, session });
  assert.equal(selection.item.id, expectedItemId);
  session.used.push(selection.item.id);
  return recordResponse(session, selection.item, answer);
}

const session = createSession({ id: "CAT-TEST", length: 4, startingAbility: 0 });

next(session, "A", "ITEM-001");
assert.equal(Number(session.ability.toFixed(2)), 0.24);

next(session, "B", "ITEM-002");
assert.equal(Number(session.ability.toFixed(2)), 0.55);

next(session, "B", "ITEM-003");
assert.equal(Number(session.ability.toFixed(2)), 0.81);

next(session, "B", "ITEM-004");
assert.equal(Number(session.ability.toFixed(2)), 1.08);

const summary = summarizeSession(session, items);
assert.deepEqual(summary, {
  completedItems: 4,
  correctItems: 4,
  scorePercent: 100,
  finalAbilityEstimate: 1.08,
  missedItems: [],
  weakConcepts: [],
});

const exportPayload = buildSessionExport({ session, items });
assert.equal(exportPayload.responses.length, 4);
assert.equal(exportPayload.responses[0].itemId, "ITEM-001");
assert.equal(exportPayload.responses[0].selectedResponse, "A");
assert.equal(exportPayload.responses[0].correctResponse, "A");
assert.deepEqual(exportPayload.abilityHistory, [0, 0.24, 0.55, 0.81, 1.08]);
assert.deepEqual(exportPayload.exposure.withheldItemIds, []);
assert.equal(exportPayload.stopping.code, "max_items");

const remediation = buildRemediationPlan(session, items);
assert.equal(remediation.length, 3);
assert.equal(remediation[0].title, "Maintain proficiency");

const firstAttempt = createAttemptRecord(session, items, "2026-07-10T00:00:00.000Z");
assert.deepEqual(firstAttempt.itemIds, ["ITEM-001", "ITEM-002", "ITEM-003", "ITEM-004"]);
assert.equal(firstAttempt.completedItems, 4);
assert.equal(firstAttempt.stopping.code, "max_items");

const exposureItemIds = getExposureItemIds([firstAttempt]);
assert.deepEqual(exposureItemIds, ["ITEM-001", "ITEM-002", "ITEM-003", "ITEM-004"]);

const exposureReadiness = evaluateExposureReadiness(items, [firstAttempt]);
assert.equal(exposureReadiness.eligible, 4);
assert.equal(exposureReadiness.excluded, 4);
assert.equal(exposureReadiness.pass, true);

const secondSession = createSession({ id: "CAT-SECOND", length: 4, startingAbility: 0, exposureItemIds });
next(secondSession, "B", "ITEM-005");
next(secondSession, "B", "ITEM-008");
next(secondSession, "B", "ITEM-007");
next(secondSession, "A", "ITEM-006");
assert.equal(secondSession.responses.every((response) => !exposureItemIds.includes(response.itemId)), true);

const secondExport = buildSessionExport({ session: secondSession, items });
assert.deepEqual(secondExport.exposure.withheldItemIds, exposureItemIds);
assert.deepEqual(secondExport.responses.map((response) => response.itemId), ["ITEM-005", "ITEM-008", "ITEM-007", "ITEM-006"]);

const secondAttempt = createAttemptRecord(secondSession, items, "2026-07-10T00:10:00.000Z");
const saturatedReadiness = evaluateExposureReadiness(items, [secondAttempt, firstAttempt]);
assert.equal(saturatedReadiness.eligible, 0);
assert.equal(saturatedReadiness.excluded, 8);
assert.equal(saturatedReadiness.pass, false);

const masterySession = createSession({
  id: "CAT-MASTERY",
  length: 4,
  startingAbility: 0,
  stoppingRules: { maxItems: 4, minItems: 3, masteryAbility: 0.8 },
});
next(masterySession, "A", "ITEM-001");
assert.equal(evaluateStoppingRule(masterySession, { eligibleCount: 7 }).stop, false);
next(masterySession, "B", "ITEM-002");
assert.equal(evaluateStoppingRule(masterySession, { eligibleCount: 6 }).stop, false);
next(masterySession, "B", "ITEM-003");
const masteryStop = evaluateStoppingRule(masterySession, { eligibleCount: 5 });
assert.equal(masteryStop.stop, true);
assert.equal(masteryStop.code, "mastery_threshold");
assert.equal(masteryStop.label, "Mastery threshold");

const precisionSession = createSession({
  id: "CAT-PRECISION",
  length: 8,
  startingAbility: 0,
  stoppingRules: { maxItems: 8, minItems: 3, precisionTarget: 0.03, precisionWindow: 3 },
});
precisionSession.responses = [{}, {}, {}];
precisionSession.ability = 0.025;
precisionSession.abilityHistory = [0, 0.01, 0.02, 0.025];
const precisionStop = evaluateStoppingRule(precisionSession, { eligibleCount: 5 });
assert.equal(precisionStop.stop, true);
assert.equal(precisionStop.code, "precision_target");

const exhaustedSession = createSession({ id: "CAT-EXHAUSTED", length: 4, startingAbility: 0 });
next(exhaustedSession, "A", "ITEM-001");
const exhaustedStop = evaluateStoppingRule(exhaustedSession, { eligibleCount: 0 });
assert.equal(exhaustedStop.stop, true);
assert.equal(exhaustedStop.code, "eligible_pool_exhausted");

const remainingAfterExposure = getRemainingEligibleItems({
  items,
  session: secondSession,
  exposureItemIds,
});
assert.equal(remainingAfterExposure.length, 0);

const weakSession = createSession({ id: "CAT-WEAK", length: 1, startingAbility: 0 });
const weakSelection = selectNextItem({ items, blueprint, session: weakSession });
weakSession.used.push(weakSelection.item.id);
recordResponse(weakSession, weakSelection.item, "B");
const weakSummary = summarizeSession(weakSession, items);
assert.deepEqual(weakSummary.weakConcepts, ["delegation", "wound-care", "scope-of-practice"]);
assert.equal(getScopedItems(items, "weak", weakSummary.weakConcepts).length, 1);

const gates = evaluateGates(items, blueprint);
assert.equal(gates.length, 6);
assert.equal(gates.every((gate) => gate.pass), true);

const matrix = buildCoverageMatrix(items, blueprint);
assert.equal(matrix.length, 8);
assert.equal(matrix.every((entry) => entry.count === 1), true);

console.log("CAT engine tests passed");
