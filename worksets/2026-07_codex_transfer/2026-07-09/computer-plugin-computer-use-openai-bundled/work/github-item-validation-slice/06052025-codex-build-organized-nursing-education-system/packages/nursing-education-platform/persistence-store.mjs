import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_ATTEMPTS, normalizeAttempt, normalizeAttempts } from "./public/storage.js";

export function createFileBackedAttemptStore(options = {}) {
  const defaultDataDir = fileURLToPath(new URL("./.data", import.meta.url));
  const dataDir = resolve(options.dataDir || process.env.CAT_DATA_DIR || defaultDataDir);
  const filePath = resolve(options.filePath || join(dataDir, "cat-attempts.json"));
  const maxAttempts = Number.isFinite(Number(options.maxAttempts)) ? Number(options.maxAttempts) : MAX_ATTEMPTS;

  async function listAttempts() {
    const state = await readState(filePath);
    return state.attempts.slice(0, maxAttempts);
  }

  async function saveAttempt(attempt) {
    const normalized = normalizeAttempt(attempt);
    if (!normalized) return listAttempts();

    const existing = await listAttempts();
    const attempts = [normalized, ...existing.filter((candidate) => candidate.id !== normalized.id)].slice(0, maxAttempts);
    await writeState(filePath, attempts);
    return attempts;
  }

  async function clearAttempts() {
    await writeState(filePath, []);
    return [];
  }

  return {
    filePath,
    listAttempts,
    saveAttempt,
    clearAttempts,
  };
}

async function readState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const attempts = Array.isArray(parsed) ? parsed : parsed.attempts;
    return { attempts: normalizeAttempts(attempts) };
  } catch (error) {
    if (error.code === "ENOENT") return { attempts: [] };
    return { attempts: [] };
  }
}

async function writeState(filePath, attempts) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        attempts: normalizeAttempts(attempts),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
