#!/usr/bin/env node

const baseUrl = (process.env.APP_URL || "https://nursestudy-lesson-builder.onrender.com").replace(/\/+$/, "");
const adminEmail = process.env.ADMIN_EMAIL || "admin@nurseprep.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const cookieJar = [];

function rememberCookie(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return;
  const [pair] = raw.split(";");
  if (pair) cookieJar.push(pair);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.json !== undefined) headers.set("content-type", "application/json");
  if (cookieJar.length) headers.set("cookie", cookieJar.join("; "));

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });
  rememberCookie(response.headers);

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json")
    ? await response.json().catch(() => null)
    : await response.text();

  return { status: response.status, contentType, payload };
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function summarizeTopicMatrix(rows) {
  const missing = {
    concept: 0,
    nursingSubject: 0,
    weakTopic: 0,
    nclexCategory: 0,
    cjmStep: 0,
    sourceEvidence: 0,
    slideDeck: 0,
    studyGuide: 0,
    visuals: 0,
    quiz: 0,
  };

  for (const row of rows) {
    if (!hasValue(row.concept)) missing.concept += 1;
    if (!hasValue(row.nursingSubject)) missing.nursingSubject += 1;
    if (!hasValue(row.weakTopic)) missing.weakTopic += 1;
    if (!hasValue(row.nclexCategory)) missing.nclexCategory += 1;
    if (!hasValue(row.cjmStep)) missing.cjmStep += 1;
    if (!hasValue(row.sourceEvidence)) missing.sourceEvidence += 1;

    const assets = row.assets || {};
    const counts = row.counts || {};
    if (assets.slideDeck !== true && !hasValue(assets.deck)) missing.slideDeck += 1;
    if (assets.studyGuide !== true && !hasValue(assets.guidedNotes)) missing.studyGuide += 1;
    if (assets.visuals !== true && !hasValue(assets.visualPlan)) missing.visuals += 1;
    if (assets.quiz !== true && !hasValue(assets.practiceItem) && Number(counts.practiceItems || 0) <= 0) {
      missing.quiz += 1;
    }
  }

  const nextAssetRows = rows
    .filter((row) => row.status === "needs_assets" || row.packageStatus === "needs_assets")
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      topic: row.topic,
      nursingSubject: row.nursingSubject || "",
      concept: row.concept || "",
      weakTopic: row.weakTopic || "",
      missingLabels: row.missingLabels || [],
      nextAction: row.nextAction || "",
    }));

  const nextMappingRows = rows
    .filter((row) => !hasValue(row.weakTopic) || !hasValue(row.nclexCategory) || !hasValue(row.cjmStep))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      topic: row.topic,
      nursingSubject: row.nursingSubject || "",
      concept: row.concept || "",
      missing: [
        !hasValue(row.weakTopic) ? "weakTopic" : null,
        !hasValue(row.nclexCategory) ? "nclexCategory" : null,
        !hasValue(row.cjmStep) ? "cjmStep" : null,
      ].filter(Boolean),
    }));

  return { missing, nextAssetRows, nextMappingRows };
}

async function main() {
  const checks = [];

  const health = await request("/health");
  checks.push({ name: "health", ok: health.status === 200, status: health.status });

  const studentHome = await request("/api/student/home");
  const featuredLesson = studentHome.payload?.featuredLesson || null;
  checks.push({
    name: "student-home",
    ok: studentHome.status === 200 && Boolean(featuredLesson),
    status: studentHome.status,
    featuredLesson: featuredLesson?.id || null,
  });

  const topicPage = await request("/admin/topic-production");
  checks.push({ name: "topic-production-page", ok: topicPage.status === 200, status: topicPage.status });

  const login = await request("/api/admin/login", {
    method: "POST",
    json: { email: adminEmail, password: adminPassword },
  });
  checks.push({ name: "admin-login", ok: login.status === 200, status: login.status });

  const matrix = login.status === 200
    ? await request("/api/admin/topic-production-matrix")
    : { status: 0, payload: null };
  const rows = Array.isArray(matrix.payload?.rows) ? matrix.payload.rows : [];
  const topicSummary = rows.length ? summarizeTopicMatrix(rows) : null;

  checks.push({
    name: "topic-production-matrix",
    ok: matrix.status === 200 && rows.length > 0,
    status: matrix.status,
    rows: rows.length,
  });

  const failed = checks.filter((check) => !check.ok);
  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks,
    failed: failed.length,
    topicMatrix: matrix.payload?.summary || null,
    driveProject: matrix.payload?.driveProject?.id || null,
    topicAudit: topicSummary,
    nextPacket: topicSummary?.nextMappingRows?.length
      ? "Map weakTopic, NCLEX category, and CJM step for the first 3-5 nextMappingRows."
      : "Review visuals for the first needs_assets package rows.",
  };

  console.log(JSON.stringify(result, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exit(1);
});
