import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createFileBackedAttemptStore } from "../persistence-store.mjs";

const dataDir = await mkdtemp(join(tmpdir(), "cat-persistence-"));

try {
  const store = createFileBackedAttemptStore({ dataDir, maxAttempts: 2 });
  assert.deepEqual(await store.listAttempts(), []);

  const firstAttempt = {
    id: "CAT-PERSIST-1",
    learnerId: "learner-001",
    sessionId: "CAT-PERSIST-1",
    completedAt: "2026-07-10T01:00:00.000Z",
    itemIds: ["ITEM-001", "ITEM-002"],
    scorePercent: 50,
    finalAbilityEstimate: 0.18,
    weakConcepts: ["delegation"],
    exposureItemIds: ["ITEM-009"],
    responses: [
      { itemId: "ITEM-001", selected: "A", correct: true },
      { itemId: "ITEM-002", selected: "C", correct: false },
    ],
    coverage: { "Safe and Effective Care Environment": 1 },
    stopping: { stop: true, code: "max_items", label: "Max items", detail: "2 of 2 configured items completed." },
  };

  const saved = await store.saveAttempt(firstAttempt);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].learnerId, "learner-001");
  assert.equal(saved[0].responses.length, 2);
  assert.equal(saved[0].coverage["Safe and Effective Care Environment"], 1);

  const reloadedStore = createFileBackedAttemptStore({ dataDir, maxAttempts: 2 });
  const reloaded = await reloadedStore.listAttempts();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, "CAT-PERSIST-1");

  await reloadedStore.saveAttempt({ ...firstAttempt, id: "CAT-PERSIST-2", itemIds: ["ITEM-003"], responses: [{ itemId: "ITEM-003", selected: "B", correct: true }] });
  await reloadedStore.saveAttempt({ ...firstAttempt, id: "CAT-PERSIST-3", itemIds: ["ITEM-004"], responses: [{ itemId: "ITEM-004", selected: "D", correct: false }] });
  const capped = await reloadedStore.listAttempts();
  assert.deepEqual(
    capped.map((attempt) => attempt.id),
    ["CAT-PERSIST-3", "CAT-PERSIST-2"],
  );

  assert.deepEqual(await reloadedStore.clearAttempts(), []);
  assert.deepEqual(await reloadedStore.listAttempts(), []);
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

console.log("CAT persistence store tests passed");
