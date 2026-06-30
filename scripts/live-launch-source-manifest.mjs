#!/usr/bin/env node

import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const bundledWindowsGit = process.env.USERPROFILE
  ? join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "git", "cmd", "git.exe")
  : "";
const gitCandidates = [
  process.env.GIT_BIN,
  process.env.GIT,
  "git",
  bundledWindowsGit,
].filter(Boolean);

const requiredFiles = [
  ".env.example",
  ".github/workflows/live-launch-check.yml",
  ".gitignore",
  "drizzle.config.ts",
  "LESSON_AGENT_AUDIT.md",
  "LESSON_BUILDER_MVP_HANDOFF.md",
  "LESSON_BUILDER_PRODUCTION_CHECKLIST.md",
  "LIVE_GITHUB_TARGET_DECISION.md",
  "LIVE_DEPLOYMENT_STATUS.md",
  "LIVE_LAUNCH_COMMIT_CHECKLIST.md",
  "LIVE_LAUNCH_RUNBOOK.md",
  "LIVE_RENDER_ENVIRONMENT_CHECKLIST.md",
  "package-lock.json",
  "package.json",
  "render.yaml",
  "scripts/lesson-builder-release-smoke.mjs",
  "scripts/live-launch-archive.mjs",
  "scripts/live-launch-commit-plan.mjs",
  "scripts/live-launch-gate.mjs",
  "scripts/live-launch-preflight.mjs",
  "scripts/live-launch-secret-scan.mjs",
  "scripts/live-launch-set-origin.mjs",
  "scripts/live-launch-source-manifest.mjs",
  "tsconfig.json",
  "vite.config.ts",
];

const requiredDirs = [
  "client/",
  "scripts/",
  "server/",
  "shared/",
];

const forbiddenPatterns = [
  /^\.env$/,
  /^\.env\./,
  /\.env$/,
  /^dist\//,
  /^node_modules\//,
  /^logs\//,
  /^server\.mvp\..*\.log$/,
  /^attached_assets\/.*\.env$/,
];

const allowedEnvTemplates = new Set([
  ".env.example",
]);

function runGit(args) {
  let lastResult = null;
  for (const gitBin of gitCandidates) {
    const result = spawnSync(gitBin, args, { cwd: root, encoding: "utf8" });
    lastResult = result;
    if (!result.error) {
      return result;
    }
  }
  return lastResult;
}

function gitFiles(args) {
  const result = runGit([...args, "-z"]);
  if (result.status !== 0) {
    console.error((result.stderr || result.stdout || "git command failed").trim());
    process.exit(1);
  }
  return result.stdout.split("\0").filter(Boolean);
}

function topLevel(path) {
  return path.includes("/") ? `${path.split("/")[0]}/` : "(root)";
}

const visibleFiles = gitFiles(["ls-files", "--cached", "--others", "--exclude-standard"])
  .filter((file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile());

const deletedFiles = gitFiles(["ls-files", "--deleted"]);
const visible = new Set(visibleFiles);

const missingFiles = requiredFiles.filter((file) => !visible.has(file));
const missingDirs = requiredDirs.filter((dir) => !visibleFiles.some((file) => file.startsWith(dir)));
const forbidden = visibleFiles.filter((file) => {
  if (allowedEnvTemplates.has(file)) {
    return false;
  }
  return forbiddenPatterns.some((pattern) => pattern.test(file));
});
const pendingDeletedEnvArtifacts = deletedFiles.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)));

const counts = new Map();
for (const file of visibleFiles) {
  const bucket = topLevel(file);
  counts.set(bucket, (counts.get(bucket) || 0) + 1);
}

console.log("NurseStudy live launch source manifest");
console.log("");
console.log(`Git-visible deploy candidate files: ${visibleFiles.length}`);
console.log("");
console.log("Top-level inventory:");
for (const [bucket, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`- ${bucket}: ${count}`);
}

console.log("");

if (pendingDeletedEnvArtifacts.length > 0) {
  console.log("Pending deletion of forbidden artifacts:");
  for (const file of pendingDeletedEnvArtifacts) {
    console.log(`- ${file}`);
  }
  console.log("");
}

const failures = [];

for (const file of missingFiles) {
  failures.push(`missing required file: ${file}`);
}

for (const dir of missingDirs) {
  failures.push(`missing required directory content: ${dir}`);
}

for (const file of forbidden) {
  failures.push(`forbidden deploy file visible to Git: ${file}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.log(`FAIL ${failure}`);
  }
  console.log("");
  console.log(`${failures.length} deployment manifest failure(s).`);
  process.exit(1);
}

console.log("PASS deployment source manifest is ready for GitHub handoff");
