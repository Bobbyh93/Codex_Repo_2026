export const STORAGE_KEY = "harrity-nursing-cat-attempts-v1";
export const MAX_ATTEMPTS = 10;

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

function normalizeAttempt(attempt) {
  if (!attempt || typeof attempt !== "object") return null;
  const itemIds = Array.isArray(attempt.itemIds) ? attempt.itemIds.filter(Boolean) : [];
  const weakConcepts = Array.isArray(attempt.weakConcepts) ? attempt.weakConcepts.filter(Boolean) : [];
  const exposureItemIds = Array.isArray(attempt.exposureItemIds) ? attempt.exposureItemIds.filter(Boolean) : [];
  const stopping = normalizeStopping(attempt.stopping);

  return {
    id: String(attempt.id || `CAT-${Date.now()}`),
    completedAt: attempt.completedAt || new Date().toISOString(),
    itemIds,
    completedItems: Number.isFinite(Number(attempt.completedItems)) ? Number(attempt.completedItems) : itemIds.length,
    scorePercent: Number.isFinite(Number(attempt.scorePercent)) ? Number(attempt.scorePercent) : 0,
    finalAbilityEstimate: Number.isFinite(Number(attempt.finalAbilityEstimate)) ? Number(attempt.finalAbilityEstimate) : 0,
    weakConcepts,
    exposureItemIds,
    stopping,
  };
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

function getDefaultStorage() {
  return globalThis.localStorage || null;
}
