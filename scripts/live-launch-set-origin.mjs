#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const repoArg = args.find((arg) => arg.startsWith("--repo="))?.slice("--repo=".length)
  || process.env.GITHUB_REPOSITORY
  || process.env.LAUNCH_GITHUB_REPOSITORY
  || "";

const bundledWindowsGit = process.env.USERPROFILE
  ? join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "git", "cmd", "git.exe")
  : "";
const gitCandidates = [
  process.env.GIT_BIN,
  process.env.GIT,
  "git",
  bundledWindowsGit,
].filter(Boolean);

function runGit(argsToRun) {
  let lastResult = null;
  for (const gitBin of gitCandidates) {
    const result = spawnSync(gitBin, argsToRun, { cwd: root, encoding: "utf8" });
    lastResult = result;
    if (!result.error) {
      return result;
    }
  }
  return lastResult;
}

function gitText(argsToRun) {
  const result = runGit(argsToRun);
  if (!result || result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function normalizeRepo(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  const fullNameMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (fullNameMatch) {
    return `${fullNameMatch[1]}/${fullNameMatch[2]}`;
  }

  return null;
}

const repoFullName = normalizeRepo(repoArg);
if (!repoFullName) {
  fail("Provide a GitHub repo as --repo=owner/name, GITHUB_REPOSITORY=owner/name, or a github.com clone URL.");
}

const remoteUrl = `https://github.com/${repoFullName}.git`;
const remotes = gitText(["remote"]);
const hasOrigin = remotes.split(/\r?\n/).includes("origin");

console.log("NurseStudy live launch GitHub remote setup");
console.log("");
console.log(`Repository: ${repoFullName}`);
console.log(`Remote URL: ${remoteUrl}`);
console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
console.log("");

if (!apply) {
  console.log("Dry run only. To set origin, run:");
  console.log(`node scripts/live-launch-set-origin.mjs --repo=${repoFullName} --apply`);
  process.exit(0);
}

const result = hasOrigin
  ? runGit(["remote", "set-url", "origin", remoteUrl])
  : runGit(["remote", "add", "origin", remoteUrl]);

if (!result || result.status !== 0) {
  fail((result?.stderr || result?.stdout || "git remote update failed").trim());
}

console.log(hasOrigin ? "PASS origin remote updated" : "PASS origin remote added");

