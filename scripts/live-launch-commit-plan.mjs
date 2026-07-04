#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

const requiredDeletion = "attached_assets/HARRITY_PROJECT_API_KEY_1778448728681.env";
const launchCriticalRoots = [
  ".github/",
  "client/",
  "scripts/",
  "server/",
  "shared/",
];
const launchCriticalFiles = new Set([
  ".env.example",
  ".gitignore",
  "drizzle.config.ts",
  "package.json",
  "package-lock.json",
  "render.yaml",
  "LESSON_AGENT_AUDIT.md",
  "LESSON_BUILDER_MVP_HANDOFF.md",
  "LESSON_BUILDER_PRODUCTION_CHECKLIST.md",
  "LIVE_DEPLOYMENT_STATUS.md",
  "LIVE_GITHUB_TARGET_DECISION.md",
  "LIVE_LAUNCH_COMMIT_CHECKLIST.md",
  "LIVE_LAUNCH_RUNBOOK.md",
  "LIVE_RENDER_ENVIRONMENT_CHECKLIST.md",
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

function gitRaw(args) {
  const result = runGit(args);
  if (!result || result.status !== 0) {
    return "";
  }
  return result.stdout;
}

function gitText(args) {
  return gitRaw(args).trim();
}

function gitRawLines(args) {
  const output = gitRaw(args);
  if (!output) {
    return [];
  }
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function statusPath(line) {
  return line.slice(3).trim().replace(/\\/g, "/");
}

function isLaunchCritical(path) {
  return launchCriticalFiles.has(path) || launchCriticalRoots.some((rootPath) => path.startsWith(rootPath));
}

const branch = gitText(["branch", "--show-current"]) || "(unknown)";
const remotes = gitText(["remote", "-v"]);
const statusLines = gitRawLines(["status", "--short"]);

const githubRemotes = remotes
  .split(/\r?\n/)
  .filter((line) => /github\.com[:/]/i.test(line));

const changedLaunchFiles = statusLines
  .map((line) => ({ line, path: statusPath(line) }))
  .filter((entry) => isLaunchCritical(entry.path));

const requiredDeletionStatus = statusLines.find((line) => statusPath(line) === requiredDeletion);
const requiredDeletionTracked = runGit(["ls-files", "--error-unmatch", requiredDeletion]);
const requiredDeletionExists = existsSync(join(root, requiredDeletion));
const requiredDeletionState = (() => {
  if (requiredDeletionStatus && requiredDeletionStatus.slice(0, 2).includes("D")) {
    return "pending deletion";
  }
  if (requiredDeletionTracked?.status === 0) {
    return "tracked - delete before launch";
  }
  if (requiredDeletionExists) {
    return "local artifact present - remove before launch";
  }
  return "resolved";
})();

console.log("NurseStudy live launch commit plan");
console.log("");
console.log(`Branch: ${branch}`);
console.log(`Changed files: ${statusLines.length}`);
console.log(`Launch-critical changed files: ${changedLaunchFiles.length}`);
console.log(`GitHub remote: ${githubRemotes.length > 0 ? "configured" : "missing"}`);
console.log(`Required old env deletion: ${requiredDeletionState}`);
console.log("");

if (githubRemotes.length > 0) {
  console.log("GitHub remote candidates:");
  for (const remote of githubRemotes) {
    console.log(`- ${remote}`);
  }
} else {
  console.log("Action required before push:");
  console.log("- Select or create the GitHub repository that Render should deploy from.");
  console.log("- Add or set the GitHub remote before running the final push.");
}

console.log("");
console.log("Recommended pre-push command sequence:");
console.log("1. npm run manifest:live-launch-source");
console.log("2. npm run scan:live-launch-secrets");
console.log("3. npm run preflight:live-launch");
console.log("4. npm run check:launch");
console.log("5. npm run smoke:launch-surfaces");
console.log("6. npm run smoke:lesson-builder");
console.log("7. git add -A");
console.log("8. git commit -m \"Launch NurseStudy Lesson Builder pilot\"");
console.log("9. git push -u origin main");
console.log("");

if (changedLaunchFiles.length > 0) {
  console.log("Launch-critical pending changes:");
  for (const entry of changedLaunchFiles.slice(0, 80)) {
    console.log(`- ${entry.line}`);
  }
  if (changedLaunchFiles.length > 80) {
    console.log(`- ... ${changedLaunchFiles.length - 80} more`);
  }
  console.log("");
}

console.log("PASS commit plan generated");
