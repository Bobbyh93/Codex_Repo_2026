import assert from "node:assert/strict";

import { blueprint, items } from "../public/data.js";
import {
  buildCoverageMatrix,
  buildRemediationPlan,
  buildSessionExport,
  createSession,
  evaluateGates,
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

const remediation = buildRemediationPlan(session, items);
assert.equal(remediation.length, 3);
assert.equal(remediation[0].title, "Maintain proficiency");

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
