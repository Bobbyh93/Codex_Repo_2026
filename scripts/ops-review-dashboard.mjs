#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = process.env.OPS_DASHBOARD_OUT_DIR || "ops";
const hourlyScript = process.env.HOURLY_CHECK_SCRIPT || "scripts/hourly-ops-check.mjs";

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runHourlyCheck() {
  const output = execFileSync(process.execPath, [hourlyScript], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function queueLine(queue) {
  if (!queue) return "missing";
  return `${queue.ok ? "ok" : "fail"} / HTTP ${queue.status} / ${queue.count} queued`;
}

function buildSpendGuard(queues, decisionStatus) {
  const guardedQueues = [
    "nextSpend",
    "shortsWorkflow",
    "mediaWorkOrders",
    "studentLaunchReadiness",
    "publishReadiness",
  ];
  const openQueues = guardedQueues
    .map((name) => ({
      name,
      count: Number(queues?.[name]?.count || 0),
    }))
    .filter((queue) => queue.count > 0);
  const decisionPending = decisionStatus === "pending" || decisionStatus === "missing";

  if (decisionPending && openQueues.length > 0) {
    return {
      status: "attention",
      openQueues,
      message: "Spend/media queue is non-empty while visual decision remains pending. Review VISUAL_DECISION_TEMPLATE before spending.",
    };
  }

  return {
    status: "ok",
    openQueues,
    message: decisionPending
      ? "No spend/media queue is open while decision is pending."
      : "Spend/media queue guard passed for the recorded visual decision.",
  };
}

function buildDashboard(hourly, assetPacket, visualPacket, decisionTemplate) {
  const selectedAssetRow = assetPacket?.rows?.[0] || null;
  const selectedVisualRow = visualPacket?.selectedRow || null;
  const decision = decisionTemplate?.decision || {};
  const topicMatrix = hourly.topicMatrix || {};
  const missing = hourly.topicAudit?.missing || {};
  const queues = hourly.assetQueues || {};
  const decisionStatus = decision.status || "missing";
  const spendGuard = buildSpendGuard(queues, decisionStatus);
  const nextAction = decisionStatus === "approve_visual_planning"
    ? "Record the approval in /admin/topic-production, then run hourly check to confirm next-spend/media queue movement."
    : decisionStatus === "needs_revision"
      ? "Revise VISUAL_REVIEW_PACKET before any production queue opens."
      : decisionStatus === "hold_no_spend"
        ? "Keep the row out of spend/media queues and record the hold reason."
        : "Review VISUAL_DECISION_TEMPLATE and choose approve_visual_planning, needs_revision, or hold_no_spend.";

  return {
    generatedAt: new Date().toISOString(),
    source: {
      hourlyScript,
      assetPacketPath: "ops/NEXT_ASSET_APPROVAL_PACKET.json",
      visualPacketPath: "ops/VISUAL_REVIEW_PACKET.json",
      decisionTemplatePath: "ops/VISUAL_DECISION_TEMPLATE.json",
    },
    live: {
      baseUrl: hourly.baseUrl,
      failedChecks: hourly.failed,
      checks: hourly.checks,
      totalTopics: topicMatrix.totalTopics || 0,
      ready: topicMatrix.ready || 0,
      needsMapping: topicMatrix.needsMapping || 0,
      needsAssets: topicMatrix.needsAssets || 0,
      missing,
      queueSummary: {
        nextSpend: queues.nextSpend || null,
        shortsWorkflow: queues.shortsWorkflow || null,
        mediaWorkOrders: queues.mediaWorkOrders || null,
        studentLaunchReadiness: queues.studentLaunchReadiness || null,
        publishReadiness: queues.publishReadiness || null,
      },
    },
    currentReview: {
      assetTopic: selectedAssetRow?.topic || "",
      visualTopic: selectedVisualRow?.topic || "",
      subject: selectedVisualRow?.nursingSubject || selectedAssetRow?.nursingSubject || "",
      weakTopic: selectedVisualRow?.weakTopic || selectedAssetRow?.weakTopic || "",
      missingLabels: selectedVisualRow?.missingLabels || selectedAssetRow?.missingLabels || [],
      visualType: visualPacket?.visualPlan?.type || "",
      decisionStatus,
      decisionReviewer: decision.reviewer || "",
      liveMutation: decisionTemplate?.liveMutation?.performed === true,
    },
    spendGuard,
    nextAction,
  };
}

function markdown(dashboard) {
  const live = dashboard.live;
  const current = dashboard.currentReview;
  const queues = live.queueSummary || {};
  const lines = [
    "# Ops Review Dashboard",
    "",
    `Generated: ${dashboard.generatedAt}`,
    `Live app: ${live.baseUrl}`,
    "",
    "## Live Status",
    "",
    `- Failed checks: ${live.failedChecks}`,
    `- Topics: ${live.totalTopics}`,
    `- Ready: ${live.ready}`,
    `- Needs mapping: ${live.needsMapping}`,
    `- Needs assets: ${live.needsAssets}`,
    `- Missing visuals: ${live.missing.visuals ?? "unknown"}`,
    "",
    "## Queues",
    "",
    `- Next spend: ${queueLine(queues.nextSpend)}`,
    `- Shorts workflow: ${queueLine(queues.shortsWorkflow)}`,
    `- Media work orders: ${queueLine(queues.mediaWorkOrders)}`,
    `- Student launch readiness: ${queueLine(queues.studentLaunchReadiness)}`,
    `- Publish readiness: ${queueLine(queues.publishReadiness)}`,
    "",
    "## Current Review",
    "",
    `- Topic: ${current.visualTopic || current.assetTopic}`,
    `- Subject: ${current.subject}`,
    `- Weak topic: ${current.weakTopic}`,
    `- Missing: ${(current.missingLabels || []).join(", ") || "None"}`,
    `- Visual type: ${current.visualType || "pending"}`,
    `- Decision: ${current.decisionStatus}`,
    `- Live mutation performed: ${current.liveMutation ? "yes" : "no"}`,
    "",
    "## Spend Guard",
    "",
    `- Status: ${dashboard.spendGuard.status}`,
    `- Open guarded queues: ${dashboard.spendGuard.openQueues.length}`,
    `- Message: ${dashboard.spendGuard.message}`,
    "",
    "## Next Action",
    "",
    dashboard.nextAction,
    "",
    "## Source Files",
    "",
    "- `ops/NEXT_ASSET_APPROVAL_PACKET.md`",
    "- `ops/VISUAL_REVIEW_PACKET.md`",
    "- `ops/VISUAL_DECISION_TEMPLATE.md`",
    "- `ops/WORK_LOG.md`",
    "",
  ];
  return lines.join("\n");
}

function main() {
  const hourly = runHourlyCheck();
  const assetPacket = readJsonIfExists("ops/NEXT_ASSET_APPROVAL_PACKET.json");
  const visualPacket = readJsonIfExists("ops/VISUAL_REVIEW_PACKET.json");
  const decisionTemplate = readJsonIfExists("ops/VISUAL_DECISION_TEMPLATE.json");
  const dashboard = buildDashboard(hourly, assetPacket, visualPacket, decisionTemplate);

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "OPS_REVIEW_DASHBOARD.json");
  const markdownPath = path.join(outDir, "OPS_REVIEW_DASHBOARD.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(dashboard, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown(dashboard));

  console.log(JSON.stringify({
    generatedAt: dashboard.generatedAt,
    failedChecks: dashboard.live.failedChecks,
    needsMapping: dashboard.live.needsMapping,
    needsAssets: dashboard.live.needsAssets,
    currentTopic: dashboard.currentReview.visualTopic || dashboard.currentReview.assetTopic,
    decision: dashboard.currentReview.decisionStatus,
    spendGuard: dashboard.spendGuard.status,
    jsonPath,
    markdownPath,
  }, null, 2));
}

main();
