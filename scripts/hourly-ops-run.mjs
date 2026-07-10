#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = process.env.OPS_RUN_OUT_DIR || "ops";
const historyPath = path.join(outDir, "OPS_REVIEW_HISTORY.jsonl");

const steps = [
  {
    name: "asset_packet",
    script: "scripts/asset-approval-packet.mjs",
  },
  {
    name: "visual_packet",
    script: "scripts/visual-review-packet.mjs",
  },
  {
    name: "visual_decision",
    script: "scripts/visual-decision-template.mjs",
  },
  {
    name: "review_dashboard",
    script: "scripts/ops-review-dashboard.mjs",
  },
  {
    name: "schedule_export",
    script: "scripts/hourly-cadence-export.mjs",
  },
  {
    name: "wbs_export",
    script: "scripts/launch-wbs-export.mjs",
  },
];

function runScript(step) {
  const output = execFileSync(process.execPath, [step.script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  let payload = output;
  try {
    payload = JSON.parse(output);
  } catch {
    // Keep raw output if a future script prints plain text.
  }
  return {
    name: step.name,
    script: step.script,
    ok: true,
    payload,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildHistoryRecord(results) {
  const dashboard = readJson(path.join(outDir, "OPS_REVIEW_DASHBOARD.json"));
  return {
    generatedAt: new Date().toISOString(),
    baseUrl: dashboard.live?.baseUrl || "",
    failedChecks: dashboard.live?.failedChecks ?? null,
    totalTopics: dashboard.live?.totalTopics ?? null,
    needsMapping: dashboard.live?.needsMapping ?? null,
    needsAssets: dashboard.live?.needsAssets ?? null,
    missingVisuals: dashboard.live?.missing?.visuals ?? null,
    currentTopic: dashboard.currentReview?.visualTopic || dashboard.currentReview?.assetTopic || "",
    decisionStatus: dashboard.currentReview?.decisionStatus || "",
    liveMutation: dashboard.currentReview?.liveMutation === true,
    queueCounts: Object.fromEntries(Object.entries(dashboard.live?.queueSummary || {}).map(([key, value]) => [key, value?.count ?? null])),
    spendGuard: dashboard.spendGuard || null,
    wbsPath: "ops/LAUNCH_WBS.json",
    cadencePath: "ops/HOURLY_CADENCE.json",
    steps: results.map((result) => ({
      name: result.name,
      ok: result.ok,
    })),
    nextAction: dashboard.nextAction || "",
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const results = steps.map(runScript);
  const history = buildHistoryRecord(results);
  fs.appendFileSync(historyPath, `${JSON.stringify(history)}\n`);

  console.log(JSON.stringify({
    generatedAt: history.generatedAt,
    failedChecks: history.failedChecks,
    needsMapping: history.needsMapping,
    needsAssets: history.needsAssets,
    currentTopic: history.currentTopic,
    decisionStatus: history.decisionStatus,
    liveMutation: history.liveMutation,
    spendGuard: history.spendGuard?.status || "missing",
    historyPath,
    steps: results.map((result) => result.name),
  }, null, 2));
}

main();
