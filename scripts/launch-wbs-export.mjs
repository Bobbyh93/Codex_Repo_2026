#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outDir = process.env.OPS_WBS_OUT_DIR || "ops";
const generatedAt = new Date().toISOString();

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function statusLabel(condition, fallback = "needs_review") {
  return condition ? "ready" : fallback;
}

function buildWbs(dashboard, cadence) {
  const live = dashboard?.live || {};
  const current = dashboard?.currentReview || {};
  const missing = live.missing || {};
  const queues = live.queueSummary || {};
  const spendGuard = dashboard?.spendGuard || { status: "missing" };
  const queueOpen = Object.values(queues).some((queue) => Number(queue?.count || 0) > 0);

  const workPackages = [
    {
      id: "WBS-1",
      name: "Live product health",
      owner: "Ops",
      status: statusLabel(live.failedChecks === 0, "blocked"),
      budgetCap: "$50/check",
      evidence: ["ops/OPS_REVIEW_DASHBOARD.json", "ops/BROWSER_QA_PACKET.md", "scripts/hourly-ops-check.mjs"],
      acceptance: "Live health, student home, admin login, topic matrix, and queue checks pass.",
      nextAction: live.failedChecks === 0 ? "Keep checking hourly." : "Fix failed live check before asset work.",
    },
    {
      id: "WBS-2",
      name: "Student public learning surface",
      owner: "Product",
      status: statusLabel(Boolean(live.checks?.find((check) => check.name === "student-home" && check.ok)), "blocked"),
      budgetCap: "$50/check",
      evidence: ["GET /api/student/home", "ops/OPS_REVIEW_DASHBOARD.json", "ops/BROWSER_QA_PACKET.md"],
      acceptance: "Student home returns a featured lesson and learner-safe lesson data.",
      nextAction: "Keep student route smoke in the hourly check.",
    },
    {
      id: "WBS-3",
      name: "Topic taxonomy and content mapping",
      owner: "Content Ops",
      status: statusLabel(Number(live.needsMapping || 0) === 0, "needs_mapping"),
      budgetCap: "$100/packet",
      evidence: ["ops/OPS_REVIEW_DASHBOARD.json", "/admin/topic-production"],
      acceptance: "Every topic has concept, nursing subject, weak topic, NCLEX category, CJM step, and source evidence.",
      nextAction: Number(live.needsMapping || 0) === 0
        ? "Protect mapping completeness while asset work continues."
        : "Map the first incomplete topic row.",
    },
    {
      id: "WBS-4",
      name: "Lesson package assets",
      owner: "Content Ops",
      status: Number(live.needsAssets || 0) > 0 ? "in_progress" : "ready",
      budgetCap: "$100/packet before approval",
      evidence: ["ops/NEXT_ASSET_APPROVAL_PACKET.md", "ops/VISUAL_REVIEW_PACKET.md"],
      acceptance: "Each launch topic has slide deck, study guide, visuals, quiz, citations, and learner-safe package data.",
      nextAction: `Review asset gaps: slide decks ${missing.slideDeck ?? "unknown"}, study guides ${missing.studyGuide ?? "unknown"}, visuals ${missing.visuals ?? "unknown"}, quizzes ${missing.quiz ?? "unknown"}.`,
    },
    {
      id: "WBS-5",
      name: "No-spend visual decision gate",
      owner: "Reviewer",
      status: spendGuard.status === "ok" ? "ready_for_decision" : "attention",
      budgetCap: "$0 until approved",
      evidence: ["ops/VISUAL_DECISION_TEMPLATE.md", "ops/OPS_REVIEW_DASHBOARD.json"],
      acceptance: "No spend/media queue opens while visual decision is pending.",
      nextAction: current.decisionStatus === "pending"
        ? `Review ${current.visualTopic || current.assetTopic || "current visual packet"} and choose approve, revise, or hold.`
        : "Record reviewed decision in the live admin workflow.",
    },
    {
      id: "WBS-6",
      name: "Airtable viral shorts handoff",
      owner: "Marketing Ops",
      status: queueOpen ? "queued" : "held",
      budgetCap: "$100-$250 only after approval",
      evidence: ["ops/OPS_REVIEW_DASHBOARD.json", "phase_3_shorts_airtable_handoff queue"],
      acceptance: "Only approved topics enter the shorts tracker; no batch production runs before review.",
      nextAction: queueOpen ? "Work only approved queue rows." : "Keep held until visual decision approval.",
    },
    {
      id: "WBS-7",
      name: "Calendar and Drive operating record",
      owner: "Ops",
      status: exists("ops/HOURLY_CADENCE.ics") && exists("ops/HOURLY_CADENCE.md") ? "local_ready" : "needs_export",
      budgetCap: "$0 local artifact",
      evidence: ["ops/HOURLY_CADENCE.ics", "ops/HOURLY_CADENCE.md", "ops/WORK_LOG.md"],
      acceptance: "Hourly cadence, work log, and review artifacts are ready for Calendar/Drive sync.",
      nextAction: "Import or sync calendar/Drive artifacts only after connector access is available and approved.",
    },
    {
      id: "WBS-8",
      name: "Deployment and source control",
      owner: "Engineering",
      status: "ready",
      budgetCap: "$50/check",
      evidence: ["git main", "production build", "ops/OPS_REVIEW_HISTORY.jsonl"],
      acceptance: "Build gates pass, commit is pushed, and live smoke confirms deployable launch surface.",
      nextAction: "Continue small commits after each verified ops packet.",
    },
  ];

  return {
    generatedAt,
    liveUrl: live.baseUrl || "",
    currentTopic: current.visualTopic || current.assetTopic || "",
    dailySoftCap: cadence?.dailySoftCap || "$450",
    hardStop: cadence?.hardStop || "$500 unless explicitly approved",
    spendGuard,
    summary: {
      failedChecks: live.failedChecks ?? null,
      totalTopics: live.totalTopics ?? null,
      ready: live.ready ?? null,
      needsMapping: live.needsMapping ?? null,
      needsAssets: live.needsAssets ?? null,
      currentDecision: current.decisionStatus || "",
    },
    workPackages,
    nextAction: dashboard?.nextAction || "",
    files: {
      markdown: "ops/LAUNCH_WBS.md",
      json: "ops/LAUNCH_WBS.json",
    },
  };
}

function markdown(wbs) {
  const lines = [
    "# NurseStudy Launch WBS",
    "",
    `Generated: ${wbs.generatedAt}`,
    `Live app: ${wbs.liveUrl}`,
    `Current topic: ${wbs.currentTopic}`,
    `Daily soft cap: ${wbs.dailySoftCap}`,
    `Hard stop: ${wbs.hardStop}`,
    `Spend guard: ${wbs.spendGuard.status}`,
    "",
    "## Summary",
    "",
    `- Failed live checks: ${wbs.summary.failedChecks}`,
    `- Topics: ${wbs.summary.totalTopics}`,
    `- Ready: ${wbs.summary.ready}`,
    `- Needs mapping: ${wbs.summary.needsMapping}`,
    `- Needs assets: ${wbs.summary.needsAssets}`,
    `- Current decision: ${wbs.summary.currentDecision}`,
    "",
    "## Work Packages",
    "",
    "| ID | Work package | Owner | Status | Budget cap | Next action |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...wbs.workPackages.map((item) => `| ${item.id} | ${item.name} | ${item.owner} | ${item.status} | ${item.budgetCap} | ${item.nextAction} |`),
    "",
    "## Evidence Map",
    "",
    ...wbs.workPackages.flatMap((item) => [
      `### ${item.id} ${item.name}`,
      "",
      `Acceptance: ${item.acceptance}`,
      "",
      `Evidence: ${item.evidence.map((entry) => `\`${entry}\``).join(", ")}`,
      "",
    ]),
    "## Next Action",
    "",
    wbs.nextAction,
    "",
  ];
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const dashboard = readJsonIfExists("ops/OPS_REVIEW_DASHBOARD.json", {});
  const cadence = readJsonIfExists("ops/HOURLY_CADENCE.json", {});
  const wbs = buildWbs(dashboard, cadence);

  fs.writeFileSync(path.join(outDir, "LAUNCH_WBS.json"), `${JSON.stringify(wbs, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "LAUNCH_WBS.md"), markdown(wbs));

  console.log(JSON.stringify({
    generatedAt,
    workPackages: wbs.workPackages.length,
    failedChecks: wbs.summary.failedChecks,
    needsMapping: wbs.summary.needsMapping,
    needsAssets: wbs.summary.needsAssets,
    spendGuard: wbs.spendGuard.status,
    markdownPath: "ops/LAUNCH_WBS.md",
    jsonPath: "ops/LAUNCH_WBS.json",
  }, null, 2));
}

main();
