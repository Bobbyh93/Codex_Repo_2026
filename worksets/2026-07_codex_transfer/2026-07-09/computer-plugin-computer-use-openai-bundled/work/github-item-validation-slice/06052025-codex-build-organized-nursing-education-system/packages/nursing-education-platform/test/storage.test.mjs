import assert from "node:assert/strict";

import {
  clearAttempts,
  clearPersistentAttempts,
  formatAttemptSummary,
  loadAttempts,
  loadPersistentAttempts,
  saveAttempt,
  savePersistentAttempt,
  STORAGE_KEY,
} from "../public/storage.js";

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
    stopping: { stop: true, code: "max_items", label: "Max items", detail: "2 of 2 configured items completed." },
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
    stopping: { stop: true, code: "mastery_threshold", label: "Mastery threshold", detail: "Ability reached threshold." },
  },
  storage,
);
assert.deepEqual(second.map((attempt) => attempt.id), ["CAT-B", "CAT-A"]);

const reloaded = loadAttempts(storage);
assert.deepEqual(reloaded.map((attempt) => attempt.id), ["CAT-B", "CAT-A"]);
assert.deepEqual(reloaded[0].exposureItemIds, ["ITEM-001", "ITEM-002"]);
assert.equal(reloaded[0].stopping.code, "mastery_threshold");
assert.equal(reloaded[1].stopping.label, "Max items");

const summary = formatAttemptSummary(reloaded[0]);
assert.equal(summary.title, "100% score | ability 0.40");
assert.equal(summary.detail, "1 item completed | 0 weak concepts");

storage.setItem(STORAGE_KEY, "not-json");
assert.deepEqual(loadAttempts(storage), []);

saveAttempt({ id: "CAT-C", itemIds: [], scorePercent: 0, finalAbilityEstimate: 0 }, storage);
assert.equal(loadAttempts(storage).length, 1);
clearAttempts(storage);
assert.deepEqual(loadAttempts(storage), []);

const apiStorage = createMemoryStorage();
const apiAttempt = {
  id: "CAT-API",
  completedAt: "2026-07-10T00:20:00.000Z",
  itemIds: ["ITEM-004"],
  scorePercent: 100,
  finalAbilityEstimate: 0.55,
  weakConcepts: [],
  exposureItemIds: ["ITEM-001"],
  responses: [{ itemId: "ITEM-004", selected: "B", correct: true }],
  coverage: { "Safe and Effective Care Environment": 1 },
  stopping: { stop: true, code: "max_items", label: "Max items", detail: "1 of 1 configured items completed." },
};

const fetchCalls = [];
const fetchImpl = async (endpoint, options = {}) => {
  fetchCalls.push({ endpoint, options });
  if (options.method === "GET") {
    return jsonResponse({ source: "server", detail: "test server", attempts: [apiAttempt] });
  }
  if (options.method === "POST") {
    const parsed = JSON.parse(options.body);
    return jsonResponse({ source: "server", detail: "test server", attempts: [parsed.attempt] });
  }
  if (options.method === "DELETE") {
    return jsonResponse({ source: "server", detail: "test server", attempts: [] });
  }
  return jsonResponse({ error: "bad method" }, false, 405);
};

const loaded = await loadPersistentAttempts({ fetchImpl, storage: apiStorage });
assert.equal(loaded.source, "server");
assert.equal(loaded.attempts[0].id, "CAT-API");
assert.equal(loaded.attempts[0].responses[0].itemId, "ITEM-004");
assert.equal(loadAttempts(apiStorage)[0].id, "CAT-API");

const saved = await savePersistentAttempt({ ...apiAttempt, id: "CAT-POST" }, { fetchImpl, storage: apiStorage });
assert.equal(saved.source, "server");
assert.equal(saved.attempts[0].id, "CAT-POST");
assert.equal(fetchCalls.at(-1).options.method, "POST");

const cleared = await clearPersistentAttempts({ fetchImpl, storage: apiStorage });
assert.equal(cleared.source, "server");
assert.deepEqual(cleared.attempts, []);

const fallbackStorage = createMemoryStorage();
const fallback = await savePersistentAttempt(apiAttempt, {
  fetchImpl: async () => {
    throw new Error("offline");
  },
  storage: fallbackStorage,
});
assert.equal(fallback.source, "local");
assert.equal(fallback.attempts[0].id, "CAT-API");

console.log("CAT storage tests passed");

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}
