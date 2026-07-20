#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const sourcePath = process.env.VISUAL_PACKET_PATH || "ops/VISUAL_REVIEW_PACKET.json";
const outDir = process.env.VISUAL_DECISION_OUT_DIR || "ops";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function allowedDecision(value) {
  return ["pending", "approve_visual_planning", "needs_revision", "hold_no_spend"].includes(value);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildDecisionTemplate(packet) {
  const requestedDecision = clean(process.env.VISUAL_DECISION || "pending") || "pending";
  const decision = allowedDecision(requestedDecision) ? requestedDecision : "pending";
  const row = packet.selectedRow || {};
  const visualPlan = packet.visualPlan || {};
  const notes = clean(process.env.VISUAL_DECISION_NOTES || "");
  const reviewer = clean(process.env.VISUAL_REVIEWER || "");

  return {
    generatedAt: new Date().toISOString(),
    sourcePacketPath: sourcePath,
    sourcePacketGeneratedAt: packet.generatedAt,
    budgetWindow: "$0-$50 review only",
    costGuardrail: "This decision record does not generate visuals, approve spend, publish lessons, or mutate live app data.",
    row: {
      id: row.id || "",
      sourceType: row.sourceType || "",
      topic: row.topic || "",
      nursingSubject: row.nursingSubject || "",
      concept: row.concept || "",
      weakTopic: row.weakTopic || "",
      nclexCategory: row.nclexCategory || "",
      cjmStep: row.cjmStep || "",
      reviewUrl: row.reviewUrl || "",
      missingLabels: row.missingLabels || [],
      readyAssets: row.readyAssets || [],
    },
    visualPlan: {
      type: visualPlan.type || "",
      prompt: visualPlan.prompt || "",
      elements: visualPlan.elements || [],
      accessibilityNotes: visualPlan.accessibilityNotes || [],
      reviewQuestions: visualPlan.reviewQuestions || [],
    },
    decision: {
      status: decision,
      reviewer,
      notes,
      allowedStatuses: ["approve_visual_planning", "needs_revision", "hold_no_spend"],
      approvedNextStep: decision === "approve_visual_planning"
        ? "Record the approval in /admin/topic-production, then allow one no-spend/low-spend visual planning task."
        : "",
      revisionNextStep: decision === "needs_revision"
        ? "Revise the visual plan before any production queue is opened."
        : "",
      holdNextStep: decision === "hold_no_spend"
        ? "Keep the row out of next-spend/media queues and document the hold reason."
        : "",
    },
    liveMutation: {
      performed: false,
      endpoint: "",
      reason: "Local decision capture only. Live topic-production review must be performed deliberately after human approval.",
    },
  };
}

function markdown(template) {
  const row = template.row;
  const decision = template.decision;
  const lines = [
    "# Visual Decision Template",
    "",
    `Generated: ${template.generatedAt}`,
    `Budget: ${template.budgetWindow}`,
    "",
    template.costGuardrail,
    "",
    "## Row",
    "",
    `- Topic: ${row.topic}`,
    `- Subject: ${row.nursingSubject}`,
    `- Concept: ${row.concept}`,
    `- Weak topic: ${row.weakTopic}`,
    `- NCLEX/CJM: ${row.nclexCategory} / ${row.cjmStep}`,
    `- Review URL: ${row.reviewUrl}`,
    `- Missing: ${(row.missingLabels || []).join(", ")}`,
    `- Ready assets: ${(row.readyAssets || []).join(", ")}`,
    "",
    "## Proposed Visual",
    "",
    `- Type: ${template.visualPlan.type}`,
    `- Prompt: ${template.visualPlan.prompt}`,
    "",
    "## Decision",
    "",
    `- Status: ${decision.status}`,
    `- Reviewer: ${decision.reviewer || "pending"}`,
    `- Notes: ${decision.notes || "pending"}`,
    "",
    "Allowed statuses:",
    "",
    "- approve_visual_planning",
    "- needs_revision",
    "- hold_no_spend",
    "",
    "## Review Questions",
    "",
  ];

  for (const question of template.visualPlan.reviewQuestions || []) lines.push(`- ${question}`);

  lines.push("");
  lines.push("## Live Mutation");
  lines.push("");
  lines.push("- Performed: false");
  lines.push(`- Reason: ${template.liveMutation.reason}`);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const packet = readJson(sourcePath);
  const template = buildDecisionTemplate(packet);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "VISUAL_DECISION_TEMPLATE.json");
  const markdownPath = path.join(outDir, "VISUAL_DECISION_TEMPLATE.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(template, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown(template));

  console.log(JSON.stringify({
    generatedAt: template.generatedAt,
    topic: template.row.topic,
    status: template.decision.status,
    jsonPath,
    markdownPath,
    liveMutation: template.liveMutation.performed,
  }, null, 2));
}

main();
