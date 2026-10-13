#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.env.APP_URL || "https://nursestudy-lesson-builder.onrender.com").replace(/\/+$/, "");
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set; there is no default.");
  process.exit(1);
}
const limit = Math.max(1, Number(process.env.ASSET_PACKET_LIMIT || 5));
const outDir = process.env.ASSET_PACKET_OUT_DIR || "ops";
const cookieJar = [];

function rememberCookie(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return;
  const [pair] = raw.split(";");
  if (pair) cookieJar.push(pair);
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.json !== undefined) headers.set("content-type", "application/json");
  if (cookieJar.length) headers.set("cookie", cookieJar.join("; "));

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });
  rememberCookie(response.headers);

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload = text;
  if (contentType.includes("json") && text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: response.status, contentType, payload };
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function rowUrl(row) {
  const params = new URLSearchParams({
    focus: row.id || "",
    sourceType: row.sourceType || "",
  });
  return `${baseUrl}/admin/topic-production?${params.toString()}`;
}

function readyAssetCount(row) {
  return Object.values(row.assets || {}).filter(Boolean).length;
}

function rankRow(row) {
  const missing = Array.isArray(row.missingLabels) ? row.missingLabels : [];
  const topic = String(row.topic || "").toLowerCase();
  let score = 0;
  if (row.sourceType === "lesson_package") score += 100;
  if (row.packageStatus === "published") score += 30;
  if (missing.length === 1 && missing.includes("Visuals")) score += 25;
  if (/contraception|therapeutic communication/.test(topic)) score += 15;
  score += readyAssetCount(row) * 4;
  score -= missing.length * 2;
  return score;
}

function assetDecisionPrompt(row) {
  const missing = Array.isArray(row.missingLabels) ? row.missingLabels : [];
  if (missing.length === 1 && missing[0] === "Visuals") {
    return "Approve no-spend visual prompt/diagram planning, or hold if the current lesson content needs revision first.";
  }
  if (missing.includes("Video lesson slide deck") || missing.includes("Study guide") || missing.includes("Quiz item")) {
    return "Hold paid media. Build or attach the missing lesson package assets before visuals/shorts/audio/video.";
  }
  return "Review asset coverage and choose approve, needs edit, or hold before any paid production.";
}

function visualBrief(row) {
  const subject = row.nursingSubject || "Nursing";
  const concept = row.concept || "clinical judgment";
  const weakTopic = row.weakTopic || row.topic || "priority cues";
  return [
    `Create a simple ${subject} learner visual for ${weakTopic}.`,
    `Show cue -> interpretation -> safe nursing action, tied to ${concept}.`,
    "Use plain icons, a decision flow, or a comparison table. Avoid decorative stock imagery.",
    "Keep it review-only until a human content expert approves the clinical framing.",
  ].join(" ");
}

function packetRow(row, index) {
  const missingLabels = Array.isArray(row.missingLabels) ? row.missingLabels : [];
  return {
    rank: index + 1,
    id: row.id,
    sourceType: row.sourceType,
    topic: row.topic || row.title || "",
    nursingSubject: row.nursingSubject || "",
    concept: row.concept || "",
    weakTopic: row.weakTopic || "",
    nclexCategory: row.nclexCategory || "",
    cjmStep: row.cjmStep || "",
    sourceEvidence: row.sourceEvidence || "",
    status: row.status || "",
    packageStatus: row.packageStatus || "",
    missingLabels,
    readyAssets: Object.entries(row.assets || {})
      .filter(([, ready]) => Boolean(ready))
      .map(([asset]) => asset),
    counts: row.counts || {},
    reviewUrl: rowUrl(row),
    decisionPrompt: assetDecisionPrompt(row),
    noSpendVisualBrief: visualBrief(row),
    recommendedNextAction: missingLabels.length === 1 && missingLabels[0] === "Visuals"
      ? "Approve visual planning only, then create one reviewed visual prompt/diagram for this package."
      : row.nextAction || "Review missing assets before approving spend.",
  };
}

function markdownPacket(packet) {
  const lines = [
    "# Asset Approval Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Source: ${packet.baseUrl}`,
    `Budget: ${packet.budgetWindow}`,
    "",
    packet.costGuardrail,
    "",
    "## Queue State",
    "",
    `- Topics: ${packet.matrixSummary.totalTopics}`,
    `- Needs mapping: ${packet.matrixSummary.needsMapping}`,
    `- Needs assets: ${packet.matrixSummary.needsAssets}`,
    `- Selected rows: ${packet.rows.length}`,
    "",
    "## Rows To Review",
    "",
  ];

  for (const row of packet.rows) {
    lines.push(`### ${row.rank}. ${row.topic}`);
    lines.push("");
    lines.push(`- Subject: ${row.nursingSubject}`);
    lines.push(`- Concept: ${row.concept}`);
    lines.push(`- Weak topic: ${row.weakTopic}`);
    lines.push(`- NCLEX/CJM: ${row.nclexCategory} / ${row.cjmStep}`);
    lines.push(`- Missing: ${row.missingLabels.join(", ") || "None"}`);
    lines.push(`- Ready assets: ${row.readyAssets.join(", ") || "None"}`);
    lines.push(`- Review URL: ${row.reviewUrl}`);
    lines.push(`- Decision prompt: ${row.decisionPrompt}`);
    lines.push(`- No-spend visual brief: ${row.noSpendVisualBrief}`);
    lines.push("");
  }

  lines.push("## Next Action");
  lines.push("");
  lines.push(packet.nextAction);
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const login = await request("/api/admin/login", {
    method: "POST",
    json: { email: adminEmail, password: adminPassword },
  });
  if (login.status !== 200) {
    throw new Error(`Admin login failed with HTTP ${login.status}`);
  }

  const matrix = await request("/api/admin/topic-production-matrix");
  if (matrix.status !== 200 || !Array.isArray(matrix.payload?.rows)) {
    throw new Error(`Topic matrix failed with HTTP ${matrix.status}`);
  }

  const rows = matrix.payload.rows
    .filter((row) => row.status === "needs_assets" || row.packageStatus === "needs_assets")
    .filter((row) => hasValue(row.concept) && hasValue(row.nursingSubject) && hasValue(row.weakTopic))
    .sort((a, b) => rankRow(b) - rankRow(a))
    .slice(0, limit)
    .map(packetRow);

  const packet = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    budgetWindow: "$0-$50 review only",
    costGuardrail: "No AI generation, paid visuals, TTS, video rendering, batch production, or public publish is performed by this packet.",
    matrixSummary: matrix.payload.summary || {},
    rows,
    nextAction: rows.length
      ? "Review these rows in order. Approve exactly one no-spend visual/asset planning step or hold with a reason before opening any paid production queue."
      : "No mapped needs-assets rows are available for approval review.",
  };

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "NEXT_ASSET_APPROVAL_PACKET.json");
  const markdownPath = path.join(outDir, "NEXT_ASSET_APPROVAL_PACKET.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdownPacket(packet));

  console.log(JSON.stringify({
    generatedAt: packet.generatedAt,
    baseUrl,
    selectedRows: rows.length,
    jsonPath,
    markdownPath,
    firstTopic: rows[0]?.topic || null,
    nextAction: packet.nextAction,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exit(1);
});
