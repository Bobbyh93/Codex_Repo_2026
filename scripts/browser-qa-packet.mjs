#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outDir = process.env.OPS_BROWSER_QA_OUT_DIR || "ops";
const generatedAt = new Date().toISOString();

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function route(pathname, label, mode, expected, interaction = "") {
  return { pathname, label, mode, expected, interaction };
}

function buildPacket() {
  const dashboard = readJsonIfExists("ops/OPS_REVIEW_DASHBOARD.json", {});
  const syncPacket = readJsonIfExists("ops/EXTERNAL_SYNC_PACKET.json", {});
  const baseUrl = dashboard.live?.baseUrl || syncPacket.liveUrl || "https://nursestudy-lesson-builder.onrender.com";
  const browserStatus = process.env.BROWSER_QA_STATUS || "checklist_ready";
  const browserNote = process.env.BROWSER_QA_NOTE || "Interactive browser verification should be recorded after the in-app Browser tab attaches successfully.";

  const routes = [
    route("/", "Student home", "public", "Student-facing NurseStudy entry, featured lesson, study path, and topic tiles.", "Open featured lesson."),
    route("/student/progress", "Student progress", "public", "Session-safe progress dashboard with recent/saved/completed lesson state.", "Confirm empty/new-session state is helpful."),
    route("/student/study-pack", "Student study pack", "public", "Guided notes, citations, weak-topic labels, and practice/rationale links.", "Open a saved/opened lesson study pack when session data exists."),
    route("/admin/topic-production", "Topic production", "admin", "Topic matrix with 77 mapped topics, asset gaps, and spend/media queues.", "Check current visual decision row before queue changes."),
    route("/admin/content-mapper", "Content mapper", "admin", "Task-oriented content block mapper for taxonomy review.", "Open first unmapped or imported content block when available."),
    route("/admin/lesson-builder", "Lesson builder", "admin", "Generate tab, template/agent-assisted mode, QA/export, publish workflow.", "Generate only template/fallback package unless AI spend is approved."),
  ];

  return {
    generatedAt,
    baseUrl,
    browser: {
      preferredTool: "Codex in-app Browser",
      status: browserStatus,
      note: browserNote,
      requiredChecks: [
        "page identity",
        "not blank",
        "no framework overlay",
        "console health",
        "screenshot evidence",
        "interaction proof",
      ],
    },
    liveEvidence: {
      failedChecks: dashboard.live?.failedChecks ?? null,
      totalTopics: dashboard.live?.totalTopics ?? null,
      needsMapping: dashboard.live?.needsMapping ?? null,
      needsAssets: dashboard.live?.needsAssets ?? null,
      spendGuard: dashboard.spendGuard?.status || "missing",
      currentTopic: dashboard.currentReview?.visualTopic || dashboard.currentReview?.assetTopic || "",
      currentDecision: dashboard.currentReview?.decisionStatus || "",
    },
    routes,
    guardrails: [
      "Public routes must not expose admin-only QA logs, source-management controls, session data, or faculty internals.",
      "Admin API routes should return 401 without a cookie session; this is expected security behavior, not a smoke failure.",
      "No next-spend, shorts, media, student-launch, or publish queue should open while the visual decision is pending.",
      "Browser QA should not submit forms, upload files, publish lessons, or trigger paid AI/media generation without explicit approval.",
    ],
    nextAction: "Run Browser verification on the route matrix when the in-app Browser tab attaches, then record findings in WORK_LOG.",
    filesOut: {
      markdown: "ops/BROWSER_QA_PACKET.md",
      json: "ops/BROWSER_QA_PACKET.json",
    },
  };
}

function markdown(packet) {
  const lines = [
    "# Browser QA Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Base URL: ${packet.baseUrl}`,
    `Browser status: ${packet.browser.status}`,
    `Browser note: ${packet.browser.note}`,
    "",
    "## Live Evidence",
    "",
    `- Failed checks: ${packet.liveEvidence.failedChecks}`,
    `- Total topics: ${packet.liveEvidence.totalTopics}`,
    `- Needs mapping: ${packet.liveEvidence.needsMapping}`,
    `- Needs assets: ${packet.liveEvidence.needsAssets}`,
    `- Spend guard: ${packet.liveEvidence.spendGuard}`,
    `- Current topic: ${packet.liveEvidence.currentTopic}`,
    `- Current decision: ${packet.liveEvidence.currentDecision}`,
    "",
    "## Required Browser Checks",
    "",
    ...packet.browser.requiredChecks.map((check) => `- ${check}`),
    "",
    "## Route Matrix",
    "",
    "| Route | Surface | Mode | Expected rendered result | Interaction proof |",
    "| --- | --- | --- | --- | --- |",
    ...packet.routes.map((item) => `| \`${item.pathname}\` | ${item.label} | ${item.mode} | ${item.expected} | ${item.interaction || "View-only"} |`),
    "",
    "## Guardrails",
    "",
    ...packet.guardrails.map((rule) => `- ${rule}`),
    "",
    "## Next Action",
    "",
    packet.nextAction,
    "",
  ];
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const packet = buildPacket();
  fs.writeFileSync(path.join(outDir, "BROWSER_QA_PACKET.json"), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "BROWSER_QA_PACKET.md"), markdown(packet));

  console.log(JSON.stringify({
    generatedAt,
    browserStatus: packet.browser.status,
    routes: packet.routes.length,
    failedChecks: packet.liveEvidence.failedChecks,
    spendGuard: packet.liveEvidence.spendGuard,
    markdownPath: "ops/BROWSER_QA_PACKET.md",
    jsonPath: "ops/BROWSER_QA_PACKET.json",
  }, null, 2));
}

main();
