import assert from "node:assert/strict";

import { clearAttempts, formatAttemptSummary, loadAttempts, saveAttempt, STORAGE_KEY } from "../public/storage.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const storage = createMemoryStorage();
assert.deepEqual(loadAttempts(storage), []);

const first = saveAttempt(
  {
    id: "CAT-A",
    completedAt: "2026-07-10T00:00:00.000Z",
    itemIds: ["ITEM-001", "ITEM-002"],
    scorePercent: 50,
    finalAbilityEstimate: 0.18,
    weakConcepts: ["delegation"],
    exposureItemIds: [],
  },
  storage,
);
assert.equal(first.length, 1);
assert.equal(first[0].completedItems, 2);

const second = saveAttempt(
  {
    id: "CAT-B",
    completedAt: "2026-07-10T00:10:00.000Z",
    itemIds: ["ITEM-003"],
    scorePercent: 100,
    finalAbilityEstimate: 0.4,
    weakConcepts: [],
    exposureItemIds: ["ITEM-001", "ITEM-002"],
  },
  storage,
);
assert.deepEqual(second.map((attempt) => attempt.id), ["CAT-B", "CAT-A"]);

const reloaded = loadAttempts(storage);
assert.deepEqual(reloaded.map((attempt) => attempt.id), ["CAT-B", "CAT-A"]);
assert.deepEqual(reloaded[0].exposureItemIds, ["ITEM-001", "ITEM-002"]);

const summary = formatAttemptSummary(reloaded[0]);
assert.equal(summary.title, "100% score | ability 0.40");
assert.equal(summary.detail, "1 item completed | 0 weak concepts");

storage.setItem(STORAGE_KEY, "not-json");
assert.deepEqual(loadAttempts(storage), []);

saveAttempt({ id: "CAT-C", itemIds: [], scorePercent: 0, finalAbilityEstimate: 0 }, storage);
assert.equal(loadAttempts(storage).length, 1);
clearAttempts(storage);
assert.deepEqual(loadAttempts(storage), []);

console.log("CAT storage tests passed");
