#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const outDir = process.env.OPS_SCHEDULE_OUT_DIR || "ops";
const generatedAt = new Date().toISOString();
const timezone = "America/Los_Angeles";
const firstCycleDate = process.env.OPS_FIRST_CYCLE_DATE || "2026-07-10";
const liveUrl = process.env.APP_URL || "https://nursestudy-lesson-builder.onrender.com";

const blocks = [
  {
    time: "09:00",
    durationMinutes: 25,
    title: "Health check and launch queue triage",
    budgetCap: "$50",
    output: "Live status note with queue counts",
    command: "npm run ops:hourly-check",
  },
  {
    time: "10:00",
    durationMinutes: 45,
    title: "Asset approval packet",
    budgetCap: "$100",
    output: "1-2 rows approved or held with reason",
    command: "npm run ops:asset-packet",
  },
  {
    time: "11:00",
    durationMinutes: 45,
    title: "Package build packet",
    budgetCap: "$100",
    output: "1 student-ready draft package or visual/study-guide packet",
    command: "npm run ops:visual-packet",
  },
  {
    time: "12:00",
    durationMinutes: 25,
    title: "QA/export check",
    budgetCap: "$50",
    output: "Smoke result and issue list",
    command: "npm run ops:review-dashboard",
  },
  {
    time: "13:00",
    durationMinutes: 45,
    title: "Airtable/shorts tracker packet",
    budgetCap: "$100",
    output: "Tracker rows or sync contract",
    command: "npm run ops:visual-decision",
  },
  {
    time: "14:00",
    durationMinutes: 25,
    title: "Log, Drive sync, next queue",
    budgetCap: "$50",
    output: "Updated work log and next packet",
    command: "npm run ops:hourly-run",
  },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function localToUtcStamp(date, time, addMinutes = 0) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour + 7, minute + addMinutes, 0));
  return [
    utc.getUTCFullYear(),
    pad(utc.getUTCMonth() + 1),
    pad(utc.getUTCDate()),
    "T",
    pad(utc.getUTCHours()),
    pad(utc.getUTCMinutes()),
    "00Z",
  ].join("");
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function wrapIcsLine(line) {
  const chunks = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function buildIcs() {
  const stamp = generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NurseStudy//Hourly Launch Ops//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:NurseStudy Launch Ops Cadence",
    `X-WR-TIMEZONE:${timezone}`,
  ];

  for (const [index, block] of blocks.entries()) {
    const description = [
      `Budget cap: ${block.budgetCap}`,
      `Output: ${block.output}`,
      `Command: ${block.command}`,
      `Live app: ${liveUrl}`,
      "Guardrail: no paid AI/media work unless the current decision packet is explicitly approved.",
    ].join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:nursestudy-launch-ops-${index + 1}@harrity`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localToUtcStamp(firstCycleDate, block.time)}`,
      `DTEND:${localToUtcStamp(firstCycleDate, block.time, block.durationMinutes)}`,
      "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      `SUMMARY:${escapeIcs(`NurseStudy: ${block.title}`)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT5M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(block.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(wrapIcsLine).join("\r\n")}\r\n`;
}

function buildMarkdown() {
  const lines = [
    "# Hourly Cadence Export",
    "",
    `Generated: ${generatedAt}`,
    `Timezone: ${timezone}`,
    `First cycle date: ${firstCycleDate}`,
    `Live app: ${liveUrl}`,
    "",
    "Use this file with `ops/HOURLY_CADENCE.ics` to keep the launch work in small, reviewable, no-spend packets.",
    "",
    "| Time | Job | Budget cap | Command | Output |",
    "| --- | --- | ---: | --- | --- |",
    ...blocks.map((block) => `| ${block.time} | ${block.title} | ${block.budgetCap} | \`${block.command}\` | ${block.output} |`),
    "",
    "## Guardrail",
    "",
    "Do not open next-spend, shorts, media work-order, student-launch, or publish queues while the current visual decision remains pending.",
    "",
  ];
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    generatedAt,
    timezone,
    firstCycleDate,
    liveUrl,
    dailySoftCap: "$450",
    hardStop: "$500 unless explicitly approved",
    guardrail: "No paid AI/media work unless the current decision packet is explicitly approved.",
    blocks,
    files: {
      markdown: "ops/HOURLY_CADENCE.md",
      calendar: "ops/HOURLY_CADENCE.ics",
      json: "ops/HOURLY_CADENCE.json",
    },
  };

  fs.writeFileSync(path.join(outDir, "HOURLY_CADENCE.json"), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "HOURLY_CADENCE.md"), buildMarkdown());
  fs.writeFileSync(path.join(outDir, "HOURLY_CADENCE.ics"), buildIcs());

  console.log(JSON.stringify({
    generatedAt,
    blocks: blocks.length,
    markdownPath: "ops/HOURLY_CADENCE.md",
    calendarPath: "ops/HOURLY_CADENCE.ics",
    jsonPath: "ops/HOURLY_CADENCE.json",
  }, null, 2));
}

main();
