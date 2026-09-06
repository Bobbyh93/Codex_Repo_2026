export const STORAGE_KEY = "harrity-nursing-cat-attempts-v1";
export const MAX_ATTEMPTS = 10;
export const ATTEMPTS_API_ENDPOINT = "/api/cat-attempts";

export function loadAttempts(storage = getDefaultStorage()) {
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeAttempt).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveAttempt(attempt, storage = getDefaultStorage()) {
  const normalized = normalizeAttempt(attempt);
  if (!normalized) return loadAttempts(storage);

  const attempts = [normalized, ...loadAttempts(storage).filter((existing) => existing.id !== normalized.id)].slice(0, MAX_ATTEMPTS);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    return attempts;
  }
  return attempts;
}

export function clearAttempts(storage = getDefaultStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  return [];
}

export async function loadPersistentAttempts(options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const localAttempts = loadAttempts(storage);
  const result = await requestPersistentAttempts({
    ...options,
    method: "GET",
    fallbackAttempts: localAttempts,
  });

  mirrorAttempts(result.attempts, storage);
  return result;
}

export async function savePersistentAttempt(attempt, options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const localAttempts = saveAttempt(attempt, storage);
  const result = await requestPersistentAttempts({
    ...options,
    method: "POST",
    body: { attempt },
    fallbackAttempts: localAttempts,
  });

  mirrorAttempts(result.attempts, storage);
  return result;
}

export async function clearPersistentAttempts(options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const localAttempts = clearAttempts(storage);
  const result = await requestPersistentAttempts({
    ...options,
    method: "DELETE",
    fallbackAttempts: localAttempts,
  });

  mirrorAttempts(result.attempts, storage);
  return result;
}

export function formatAttemptSummary(attempt) {
  const completedAt = attempt.completedAt ? new Date(attempt.completedAt) : null;
  const completedLabel = completedAt && !Number.isNaN(completedAt.valueOf()) ? completedAt.toLocaleString() : "Unknown completion time";
  const itemCount = attempt.itemIds.length;
  const weakCount = attempt.weakConcepts.length;

  return {
    title: `${attempt.scorePercent}% score | ability ${attempt.finalAbilityEstimate.toFixed(2)}`,
    detail: `${itemCount} item${itemCount === 1 ? "" : "s"} completed | ${weakCount} weak concept${weakCount === 1 ? "" : "s"}`,
    meta: completedLabel,
  };
}

export function normalizeAttempt(attempt) {
  if (!attempt || typeof attempt !== "object") return null;
  const itemIds = Array.isArray(attempt.itemIds) ? attempt.itemIds.filter(Boolean) : [];
  const weakConcepts = Array.isArray(attempt.weakConcepts) ? attempt.weakConcepts.filter(Boolean) : [];
  const exposureItemIds = Array.isArray(attempt.exposureItemIds) ? attempt.exposureItemIds.filter(Boolean) : [];
  const responses = Array.isArray(attempt.responses) ? attempt.responses.map(normalizeResponse).filter(Boolean) : [];
  const stopping = normalizeStopping(attempt.stopping);

  return {
    id: String(attempt.id || `CAT-${Date.now()}`),
    learnerId: String(attempt.learnerId || "prototype-learner"),
    sessionId: String(attempt.sessionId || attempt.id || `CAT-${Date.now()}`),
    completedAt: attempt.completedAt || new Date().toISOString(),
    itemIds,
    completedItems: Number.isFinite(Number(attempt.completedItems)) ? Number(attempt.completedItems) : itemIds.length,
    scorePercent: Number.isFinite(Number(attempt.scorePercent)) ? Number(attempt.scorePercent) : 0,
    finalAbilityEstimate: Number.isFinite(Number(attempt.finalAbilityEstimate)) ? Number(attempt.finalAbilityEstimate) : 0,
    weakConcepts,
    exposureItemIds,
    responses,
    coverage: normalizeCoverage(attempt.coverage),
    stopping,
  };
}

export function normalizeAttempts(attempts) {
  return Array.isArray(attempts) ? attempts.map(normalizeAttempt).filter(Boolean).slice(0, MAX_ATTEMPTS) : [];
}

function normalizeStopping(stopping) {
  if (!stopping || typeof stopping !== "object") {
    return { stop: false, code: "unknown", label: "Unknown", detail: "No stopping evidence saved." };
  }

  return {
    stop: Boolean(stopping.stop),
    code: String(stopping.code || "unknown"),
    label: String(stopping.label || "Unknown"),
    detail: String(stopping.detail || ""),
  };
}

function normalizeResponse(response) {
  if (!response || typeof response !== "object" || !response.itemId) return null;

  return {
    itemId: String(response.itemId),
    selected: String(response.selected || response.selectedResponse || ""),
    correct: Boolean(response.correct),
  };
}

function normalizeCoverage(coverage) {
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) return {};

  return Object.fromEntries(
    Object.entries(coverage)
      .filter(([category]) => category)
      .map(([category, count]) => [category, Number.isFinite(Number(count)) ? Number(count) : 0]),
  );
}

async function requestPersistentAttempts({ endpoint = ATTEMPTS_API_ENDPOINT, fetchImpl = getDefaultFetch(), method, body = null, fallbackAttempts = [] }) {
  if (!canUseRemotePersistence(endpoint, fetchImpl)) {
    return persistenceResult(fallbackAttempts, "local", "Browser local storage fallback");
  }

  try {
    const response = await fetchImpl(endpoint, {
      method,
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response?.ok) {
      throw new Error(`Persistence request failed with ${response?.status || "unknown"} status`);
    }

    const payload = await response.json();
    return persistenceResult(payload.attempts, payload.source || "server", payload.detail || "Server-backed attempt history");
  } catch (error) {
    return persistenceResult(fallbackAttempts, "local", `Local fallback: ${error.message}`);
  }
}

function persistenceResult(attempts, source, detail) {
  return {
    attempts: normalizeAttempts(attempts),
    source,
    detail,
  };
}

function mirrorAttempts(attempts, storage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeAttempts(attempts)));
  } catch {
    // Keep the API result even when browser storage is restricted.
  }
}

function canUseRemotePersistence(endpoint, fetchImpl) {
  if (!fetchImpl || typeof fetchImpl !== "function") return false;
  if (String(endpoint).startsWith("/") && globalThis.location?.protocol === "file:") return false;
  return true;
}

function getDefaultStorage() {
  return globalThis.localStorage || null;
}

function getDefaultFetch() {
  return globalThis.fetch || null;
}
