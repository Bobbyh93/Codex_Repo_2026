#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, sep } from "node:path";

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

const skipDirs = new Set([
  ".git",
  ".config",
  ".local",
  "dist",
  "logs",
  "node_modules",
]);

const skipFileNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const allowedEnvFiles = new Set([
  ".env.example",
]);

const secretPatterns = [
  {
    name: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "SendGrid API key",
    pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    name: "Postgres URL with credentials",
    pattern: /\bpostgres(?:ql)?:\/\/[^/\s:"'<>]+:[^@\s"'<>]+@[^/\s"'<>]+/gi,
  },
  {
    name: "Neon URL with credentials",
    pattern: /\bpostgres(?:ql)?:\/\/[^/\s:"'<>]+:[^@\s"'<>]+@[^/\s"'<>]*neon\.tech\b/gi,
  },
];

function isProbablyText(path) {
  const buffer = readFileSync(path);
  if (buffer.includes(0)) {
    return false;
  }
  return true;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(root, path);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (!skipDirs.has(entry)) {
        walk(path, files);
      }
      continue;
    }

    if (skipFileNames.has(entry)) {
      continue;
    }

    files.push({ path, rel });
  }
  return files;
}

function gitVisibleFiles() {
  let result = null;
  for (const gitBin of gitCandidates) {
    result = spawnSync(
      gitBin,
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8" }
    );
    if (!result.error) {
      break;
    }
  }

  if (!result || result.status !== 0 || !result.stdout) {
    return null;
  }

  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map((rel) => ({ path: join(root, rel), rel }))
    .filter((file) => existsSync(file.path) && statSync(file.path).isFile());
}

function isEnvArtifact(rel) {
  const normalized = rel.split(sep).join("/");
  const base = normalized.split("/").pop() || "";
  if (allowedEnvFiles.has(base)) {
    return false;
  }
  return base === ".env" || base.endsWith(".env") || base.startsWith(".env.");
}

const findings = [];

if (!existsSync(root)) {
  console.error(`Root path does not exist: ${root}`);
  process.exit(1);
}

const files = gitVisibleFiles() || walk(root).filter((file) => !isEnvArtifact(file.rel));

for (const file of files) {
  if (isEnvArtifact(file.rel)) {
    findings.push({
      file: file.rel,
      issue: "Env artifact should not be committed",
    });
    continue;
  }

  if (!isProbablyText(file.path)) {
    continue;
  }

  const text = readFileSync(file.path, "utf8");
  for (const matcher of secretPatterns) {
    matcher.pattern.lastIndex = 0;
    if (matcher.pattern.test(text)) {
      findings.push({
        file: file.rel,
        issue: matcher.name,
      });
    }
  }
}

console.log("NurseStudy live launch secret scan");
console.log("");

if (findings.length === 0) {
  console.log("PASS no deploy-blocking secret patterns or env artifacts found");
  process.exit(0);
}

for (const finding of findings) {
  console.log(`FAIL ${finding.file}: ${finding.issue}`);
}

console.log("");
console.log(`${findings.length} launch secret safety finding(s). Remove the file/value before pushing to GitHub.`);
process.exit(1);
