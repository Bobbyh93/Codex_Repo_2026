#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const checks = [
  ["Source manifest", ["scripts/live-launch-source-manifest.mjs"]],
  ["Secret scan", ["scripts/live-launch-secret-scan.mjs"]],
  ["Archive dry run", ["scripts/live-launch-archive.mjs"]],
  ["Live launch preflight", ["scripts/live-launch-preflight.mjs"]],
  ["Launch surface typecheck", ["scripts/launch-surface-typecheck.mjs"]],
  ["Launch surface smoke", ["scripts/launch-surface-smoke.mjs"]],
  ["Lesson Builder release smoke", ["scripts/lesson-builder-release-smoke.mjs"]],
  ["Commit plan", ["scripts/live-launch-commit-plan.mjs"]],
];

console.log("NurseStudy live launch gate");
console.log("");

for (const [label, args] of checks) {
  console.log(`Running ${label}...`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    if (!result.stdout.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    if (!result.stderr.endsWith("\n")) {
      process.stderr.write("\n");
    }
  }

  if (result.status !== 0) {
    console.error(`FAIL ${label} failed with exit code ${result.status ?? "unknown"}`);
    process.exit(result.status || 1);
  }

  console.log(`PASS ${label}`);
  console.log("");
}

console.log("PASS all live launch gates passed");
