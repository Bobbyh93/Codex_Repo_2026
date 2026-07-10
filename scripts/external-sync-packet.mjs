#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outDir = process.env.OPS_SYNC_OUT_DIR || "ops";
const generatedAt = new Date().toISOString();
const driveProjectId = process.env.GOOGLE_DRIVE_PROJECT_ID || "1c0Ayvgi8Av0c8M4SdOrwvHGhieXz553k";
const driveProjectName = "NursePrep Platform Development";

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readTextIfExists(filePath, fallback = "") {
  if (!fs.existsSync(filePath)) return fallback;
  return fs.readFileSync(filePath, "utf8");
}

function fileEntry(filePath, purpose, target) {
  const exists = fs.existsSync(filePath);
  const stat = exists ? fs.statSync(filePath) : null;
  return {
    path: filePath,
    exists,
    bytes: stat?.size || 0,
    purpose,
    target,
  };
}

function buildPacket() {
  const dashboard = readJsonIfExists("ops/OPS_REVIEW_DASHBOARD.json", {});
  const cadence = readJsonIfExists("ops/HOURLY_CADENCE.json", {});
  const wbs = readJsonIfExists("ops/LAUNCH_WBS.json", {});
  const driveStatus = readTextIfExists("ops/DRIVE_SYNC_STATUS.md");
  const destinationVerified = !/access_not_verified/i.test(driveStatus);
  const cadenceBlocks = Array.isArray(cadence.blocks) ? cadence.blocks : [];

  const files = [
    fileEntry("ops/OPS_REVIEW_DASHBOARD.md", "Single-file hourly review status", "Google Drive"),
    fileEntry("ops/OPS_REVIEW_DASHBOARD.json", "Machine-readable hourly review status", "Google Drive"),
    fileEntry("ops/LAUNCH_WBS.md", "Human-readable WBS with evidence map", "Google Drive"),
    fileEntry("ops/LAUNCH_WBS.json", "Machine-readable WBS", "Google Drive"),
    fileEntry("ops/HOURLY_CADENCE.md", "Human-readable hourly schedule", "Google Drive"),
    fileEntry("ops/HOURLY_CADENCE.json", "Machine-readable hourly schedule", "Google Drive"),
    fileEntry("ops/HOURLY_CADENCE.ics", "Calendar import file with six work blocks", "Google Calendar"),
    fileEntry("ops/WORK_LOG.md", "Append-only work log", "Google Drive"),
    fileEntry("ops/NEXT_ASSET_APPROVAL_PACKET.md", "No-spend asset approval packet", "Google Drive"),
    fileEntry("ops/VISUAL_REVIEW_PACKET.md", "Visual review plan packet", "Google Drive"),
    fileEntry("ops/VISUAL_DECISION_TEMPLATE.md", "Reviewer decision capture template", "Google Drive"),
    fileEntry("ops/BROWSER_QA_PACKET.md", "Browser route QA checklist and guardrails", "Google Drive"),
    fileEntry("ops/BROWSER_QA_PACKET.json", "Machine-readable browser QA route matrix", "Google Drive"),
  ];

  const calendarEvents = cadenceBlocks.map((block) => ({
    title: `NurseStudy: ${block.title}`,
    timezone: cadence.timezone || "America/Los_Angeles",
    firstCycleDate: cadence.firstCycleDate || "",
    localStartTime: block.time,
    durationMinutes: block.durationMinutes,
    recurrence: "Weekdays",
    budgetCap: block.budgetCap,
    command: block.command,
    guardrail: cadence.guardrail || "",
  }));

  return {
    generatedAt,
    mode: "local_sync_packet",
    liveUrl: dashboard.live?.baseUrl || cadence.liveUrl || "",
    drive: {
      projectId: driveProjectId,
      projectName: driveProjectName,
      destinationVerified,
      status: destinationVerified ? "ready_for_explicit_write" : "held_unverified_destination",
      rule: destinationVerified
        ? "Connector write still requires explicit approval before replacing Drive files."
        : "Do not upload or replace Drive files until the destination is explicitly verified and approved.",
    },
    calendar: {
      timezone: cadence.timezone || "America/Los_Angeles",
      firstCycleDate: cadence.firstCycleDate || "",
      eventCount: calendarEvents.length,
      importFile: "ops/HOURLY_CADENCE.ics",
      status: fs.existsSync("ops/HOURLY_CADENCE.ics") ? "ready_for_import_or_connector_create" : "missing_ics",
      events: calendarEvents,
    },
    currentLaunchState: {
      failedChecks: dashboard.live?.failedChecks ?? null,
      totalTopics: dashboard.live?.totalTopics ?? null,
      needsMapping: dashboard.live?.needsMapping ?? null,
      needsAssets: dashboard.live?.needsAssets ?? null,
      spendGuard: dashboard.spendGuard?.status || "missing",
      currentTopic: dashboard.currentReview?.visualTopic || dashboard.currentReview?.assetTopic || "",
      currentDecision: dashboard.currentReview?.decisionStatus || "",
      wbsPackages: Array.isArray(wbs.workPackages) ? wbs.workPackages.length : 0,
    },
    files,
    exclusions: [
      ".env",
      "database dumps",
      "learner private data",
      "admin session data",
      "raw API keys or service credentials",
      "paid media outputs generated without approval",
    ],
    nextAction: destinationVerified
      ? "Ask for explicit approval before connector writes to Drive or Calendar."
      : "Verify the Drive destination, then approve the exact files/events before connector writes.",
    filesOut: {
      markdown: "ops/EXTERNAL_SYNC_PACKET.md",
      json: "ops/EXTERNAL_SYNC_PACKET.json",
    },
  };
}

function markdown(packet) {
  const lines = [
    "# External Sync Packet",
    "",
    `Generated: ${packet.generatedAt}`,
    `Mode: ${packet.mode}`,
    `Live app: ${packet.liveUrl}`,
    "",
    "## Drive",
    "",
    `- Project: ${packet.drive.projectName}`,
    `- Project ID: ${packet.drive.projectId}`,
    `- Status: ${packet.drive.status}`,
    `- Destination verified: ${packet.drive.destinationVerified ? "yes" : "no"}`,
    `- Rule: ${packet.drive.rule}`,
    "",
    "## Calendar",
    "",
    `- Timezone: ${packet.calendar.timezone}`,
    `- First cycle date: ${packet.calendar.firstCycleDate}`,
    `- Event count: ${packet.calendar.eventCount}`,
    `- Import file: \`${packet.calendar.importFile}\``,
    `- Status: ${packet.calendar.status}`,
    "",
    "## Current Launch State",
    "",
    `- Failed checks: ${packet.currentLaunchState.failedChecks}`,
    `- Total topics: ${packet.currentLaunchState.totalTopics}`,
    `- Needs mapping: ${packet.currentLaunchState.needsMapping}`,
    `- Needs assets: ${packet.currentLaunchState.needsAssets}`,
    `- Spend guard: ${packet.currentLaunchState.spendGuard}`,
    `- Current topic: ${packet.currentLaunchState.currentTopic}`,
    `- Current decision: ${packet.currentLaunchState.currentDecision}`,
    `- WBS packages: ${packet.currentLaunchState.wbsPackages}`,
    "",
    "## Files For Sync",
    "",
    "| File | Exists | Bytes | Target | Purpose |",
    "| --- | --- | ---: | --- | --- |",
    ...packet.files.map((file) => `| \`${file.path}\` | ${file.exists ? "yes" : "no"} | ${file.bytes} | ${file.target} | ${file.purpose} |`),
    "",
    "## Calendar Events",
    "",
    "| Event | Start | Duration | Budget | Command |",
    "| --- | --- | ---: | ---: | --- |",
    ...packet.calendar.events.map((event) => `| ${event.title} | ${event.firstCycleDate} ${event.localStartTime} ${event.timezone} | ${event.durationMinutes} min | ${event.budgetCap} | \`${event.command}\` |`),
    "",
    "## Exclusions",
    "",
    ...packet.exclusions.map((item) => `- ${item}`),
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
  fs.writeFileSync(path.join(outDir, "EXTERNAL_SYNC_PACKET.json"), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "EXTERNAL_SYNC_PACKET.md"), markdown(packet));

  console.log(JSON.stringify({
    generatedAt,
    driveStatus: packet.drive.status,
    calendarEvents: packet.calendar.eventCount,
    files: packet.files.length,
    failedChecks: packet.currentLaunchState.failedChecks,
    spendGuard: packet.currentLaunchState.spendGuard,
    markdownPath: "ops/EXTERNAL_SYNC_PACKET.md",
    jsonPath: "ops/EXTERNAL_SYNC_PACKET.json",
  }, null, 2));
}

main();
