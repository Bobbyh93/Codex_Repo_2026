#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const sourcePath = process.env.ASSET_PACKET_PATH || "ops/NEXT_ASSET_APPROVAL_PACKET.json";
const outDir = process.env.VISUAL_PACKET_OUT_DIR || "ops";
const rowIndex = Math.max(0, Number(process.env.VISUAL_PACKET_ROW_INDEX || 0));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function conceptLabel(row) {
  return clean(row.concept) || "clinical judgment";
}

function visualType(row) {
  const topic = clean(row.topic).toLowerCase();
  if (/contraception|family planning|birth control/.test(topic)) return "comparison table plus cue-to-teaching flow";
  if (/therapeutic communication|psychosocial|mental health/.test(topic)) return "communication decision flow";
  if (/asthma|respiratory|airway|oxygen/.test(topic)) return "cue escalation flow";
  if (/medication|injection|iv|haloperidol|diuretic/.test(topic)) return "medication safety decision card";
  return "cue map and safe-action checklist";
}

function visualElements(row) {
  const topic = clean(row.topic);
  const subject = clean(row.nursingSubject) || "Nursing";
  const concept = conceptLabel(row);
  const weakTopic = clean(row.weakTopic) || topic;
  return [
    {
      label: "Header",
      content: `${weakTopic}: priority cues and safe nursing action`,
      purpose: "Names the student task in learner language.",
    },
    {
      label: "Cue Cluster",
      content: `3-5 signs, assessment findings, or patient statements that matter for ${topic}.`,
      purpose: "Helps the student recognize what data belongs together.",
    },
    {
      label: "Interpretation",
      content: `One short sentence explaining why the cue cluster matters for ${concept}.`,
      purpose: "Connects cues to clinical judgment instead of memorization.",
    },
    {
      label: "Safe Action",
      content: `One first nursing action and one patient-teaching point for ${subject}.`,
      purpose: "Makes the visual useful in practice and NCLEX-style reasoning.",
    },
    {
      label: "Common Trap",
      content: "One misconception or distractor path to avoid.",
      purpose: "Supports quiz rationale and wrong-answer review.",
    },
  ];
}

function accessibilityNotes(row) {
  const weakTopic = clean(row.weakTopic) || clean(row.topic);
  return [
    `Alt text should summarize the decision path for ${weakTopic}, not describe decoration.`,
    "Use text labels in the graphic; do not rely on color alone.",
    "Keep reading order: cue cluster, interpretation, safe action, common trap.",
    "Use simple icons only when they reinforce the written label.",
  ];
}

function packetForRow(row, sourcePacket) {
  const type = visualType(row);
  const elements = visualElements(row);
  return {
    generatedAt: new Date().toISOString(),
    sourcePacketGeneratedAt: sourcePacket.generatedAt,
    sourcePacketPath: sourcePath,
    budgetWindow: "$0-$50 review only",
    costGuardrail: "No paid visuals, AI image generation, TTS, video rendering, batch production, or public publish is performed by this packet.",
    selectedRow: {
      rank: row.rank,
      id: row.id,
      sourceType: row.sourceType,
      topic: row.topic,
      nursingSubject: row.nursingSubject,
      concept: row.concept,
      weakTopic: row.weakTopic,
      nclexCategory: row.nclexCategory,
      cjmStep: row.cjmStep,
      reviewUrl: row.reviewUrl,
      missingLabels: row.missingLabels,
      readyAssets: row.readyAssets,
    },
    visualPlan: {
      type,
      learnerSurface: "Lesson slide deck, guided study pack, and optional future short/video storyboard.",
      belongsIn: "Visual asset queue after creator approval.",
      prompt: [
        `Create a clean nursing-student learning visual using a ${type}.`,
        `Topic: ${row.topic}.`,
        `Audience: prelicensure nursing students.`,
        `Show: ${elements.map((element) => element.label).join(" -> ")}.`,
        "Style: simple instructional diagram, high contrast, plain labels, no stock-photo realism, no decorative clutter.",
      ].join(" "),
      elements,
      accessibilityNotes: accessibilityNotes(row),
      reviewQuestions: [
        "Is the clinical framing accurate enough for a first student-facing visual?",
        "Does this visual clarify the lesson rather than decorate it?",
        "Does the common trap match the existing quiz rationale?",
        "Should this be approved for visual production, revised, or held?",
      ],
      approvalOptions: [
        "approve_visual_planning",
        "needs_revision",
        "hold_no_spend",
      ],
    },
    nextAction: "Human reviewer chooses approve_visual_planning, needs_revision, or hold_no_spend before any visual generation or media spend.",
  };
}

function markdown(packet) {
  const row = packet.selectedRow;
  const lines = [
    "# Visual Review Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Budget: ${packet.budgetWindow}`,
    "",
    packet.costGuardrail,
    "",
    "## Selected Row",
    "",
    `- Topic: ${row.topic}`,
    `- Subject: ${row.nursingSubject}`,
    `- Concept: ${row.concept}`,
    `- Weak topic: ${row.weakTopic}`,
    `- NCLEX/CJM: ${row.nclexCategory} / ${row.cjmStep}`,
    `- Missing asset: ${(row.missingLabels || []).join(", ")}`,
    `- Ready assets: ${(row.readyAssets || []).join(", ")}`,
    `- Review URL: ${row.reviewUrl}`,
    "",
    "## Visual Plan",
    "",
    `- Type: ${packet.visualPlan.type}`,
    `- Learner surface: ${packet.visualPlan.learnerSurface}`,
    `- Belongs in: ${packet.visualPlan.belongsIn}`,
    "",
    "### Prompt",
    "",
    packet.visualPlan.prompt,
    "",
    "### Elements",
    "",
  ];

  for (const element of packet.visualPlan.elements) {
    lines.push(`- ${element.label}: ${element.content}`);
    lines.push(`  Purpose: ${element.purpose}`);
  }

  lines.push("");
  lines.push("### Accessibility Notes");
  lines.push("");
  for (const note of packet.visualPlan.accessibilityNotes) lines.push(`- ${note}`);
  lines.push("");
  lines.push("### Review Questions");
  lines.push("");
  for (const question of packet.visualPlan.reviewQuestions) lines.push(`- ${question}`);
  lines.push("");
  lines.push("## Next Action");
  lines.push("");
  lines.push(packet.nextAction);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const sourcePacket = readJson(sourcePath);
  const row = sourcePacket.rows?.[rowIndex];
  if (!row) throw new Error(`No row at index ${rowIndex} in ${sourcePath}`);

  const packet = packetForRow(row, sourcePacket);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "VISUAL_REVIEW_PACKET.json");
  const markdownPath = path.join(outDir, "VISUAL_REVIEW_PACKET.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown(packet));

  console.log(JSON.stringify({
    generatedAt: packet.generatedAt,
    topic: packet.selectedRow.topic,
    visualType: packet.visualPlan.type,
    jsonPath,
    markdownPath,
    nextAction: packet.nextAction,
  }, null, 2));
}

main();
