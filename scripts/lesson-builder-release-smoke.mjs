#!/usr/bin/env node

const baseUrl = (process.env.APP_URL || "http://localhost:5000").replace(/\/+$/, "");
const adminEmail = process.env.ADMIN_EMAIL || "admin@nurseprep.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const smokeRunId = Date.now();
const smokeClientIp = process.env.SMOKE_CLIENT_IP || `198.51.${Math.floor(smokeRunId / 256) % 256}.${smokeRunId % 256}`;
const cookieJar = new Map();
const results = [];

function rememberCookies(headers) {
  const rawCookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : headers.get("set-cookie")
      ? [headers.get("set-cookie")]
      : [];

  for (const rawCookie of rawCookies) {
    for (const cookie of String(rawCookie).split(/,(?=\s*[^;,\s]+=)/)) {
      const [pair] = cookie.trim().split(";");
      const separator = pair.indexOf("=");
      if (separator > 0) {
        cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  }
}

function cookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.clientIp) {
    headers.set("x-forwarded-for", options.clientIp);
  }
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  const cookies = cookieHeader();
  if (cookies) headers.set("cookie", cookies);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    headers,
  });
  rememberCookies(response.headers);

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload = text;
  if (contentType.includes("application/json") && text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return {
    contentType,
    ok: response.ok,
    payload,
    status: response.status,
  };
}

function record(name, passed, detail, level = "fail") {
  results.push({
    name,
    status: passed ? "pass" : level,
    detail,
  });
}

function isJson(result) {
  return result.contentType.includes("application/json");
}

function learnerPayloadLooksComplete(payload) {
  const slides = payload?.slides || payload?.deck?.slides || [];
  const items = payload?.items || payload?.practiceItems || [];
  const citations = payload?.citations || [];
  return Boolean(
    payload?.package
    && Array.isArray(slides)
    && slides.length > 0
    && Array.isArray(items)
    && items.length > 0
    && Array.isArray(citations)
    && citations.length > 0
  );
}

async function run() {
  console.log(`NurseStudy Lesson Builder release smoke`);
  console.log(`Target: ${baseUrl}`);
  console.log("");

  const health = await request("/health");
  record("server health", health.status === 200 && isJson(health), `status ${health.status}`);

  const missingApi = await request(`/api/__lesson_builder_release_smoke_missing_${Date.now()}`);
  record(
    "unknown API returns JSON 404",
    missingApi.status === 404 && isJson(missingApi) && missingApi.payload?.error === "API route not found",
    `status ${missingApi.status}, content-type ${missingApi.contentType || "missing"}`
  );

  const professionalGuide = await request("/api/generate-professional-guide", {
    method: "POST",
    json: { reportId: "release-smoke" },
  });
  record(
    "professional guide controlled response",
    isJson(professionalGuide)
      && (
        (professionalGuide.status === 503 && professionalGuide.payload?.status === "post_mvp_disabled")
        || (professionalGuide.status === 200 && professionalGuide.payload?.success === true)
      ),
    `status ${professionalGuide.status}, mode ${professionalGuide.payload?.status || professionalGuide.payload?.message || "unknown"}`
  );

  const weakRegistration = await request("/api/auth/register", {
    method: "POST",
    clientIp: smokeClientIp,
    json: {
      email: `weak-release-smoke-${Date.now()}@example.com`,
      password: "short1",
      firstName: "Weak",
      lastName: "Smoke",
    },
  });
  record(
    "weak password rejected as JSON",
    weakRegistration.status === 400 && isJson(weakRegistration) && weakRegistration.payload?.error === "Validation failed",
    `status ${weakRegistration.status}`
  );

  const adminLogin = await request("/api/admin/login", {
    method: "POST",
    json: {
      email: adminEmail,
      password: adminPassword,
    },
  });
  record(
    "admin login",
    adminLogin.status === 200 && isJson(adminLogin),
    `status ${adminLogin.status}`
  );

  const readiness = await request("/api/admin/lesson-builder/release-readiness");
  const blockers = Array.isArray(readiness.payload?.blockers) ? readiness.payload.blockers : [];
  const failingBlockers = blockers.filter((blocker) => blocker.status === "fail");
  const warningBlockers = blockers.filter((blocker) => blocker.status === "warn");
  record(
    "release readiness endpoint",
    readiness.status === 200 && isJson(readiness),
    `status ${readiness.status}`
  );
  record(
    "no failing release blockers",
    failingBlockers.length === 0,
    `${failingBlockers.length} failing blocker(s)`
  );
  record(
    "pilot ready",
    readiness.payload?.pilotReady === true,
    `pilotReady=${String(readiness.payload?.pilotReady)}`
  );
  const pilotReadiness = readiness.payload?.health?.pilotReadiness || {};
  record(
    "official source normalized",
    pilotReadiness.normalizedSourceReady === true && pilotReadiness.officialPilotSourceReady === true,
    `normalized=${String(pilotReadiness.normalizedSourceReady)}, officialSource=${String(pilotReadiness.officialPilotSourceReady)}`
  );
  record(
    "assessment bridge attached",
    pilotReadiness.assessmentBridgeReady === true,
    pilotReadiness.assessmentBridge?.weakTopic
      ? `weak topic ${pilotReadiness.assessmentBridge.weakTopic}`
      : "missing weak topic bridge"
  );
  record(
    "active pilot assignment",
    pilotReadiness.assignmentActive === true,
    `${pilotReadiness.latestPackageActiveAssignmentCount || 0} active assignment(s)`,
    "warn"
  );
  record(
    "learner completion smoke",
    pilotReadiness.learnerCompletionPresent === true,
    `${pilotReadiness.latestPackageCompletionCount || 0} completion event(s)`,
    "warn"
  );
  record(
    "documented warnings only",
    warningBlockers.every((blocker) => ["typescript", "assignment_loop", "live_completion"].includes(blocker.key)),
    `${warningBlockers.length} warning(s): ${warningBlockers.map((blocker) => blocker.key).join(", ") || "none"}`,
    "warn"
  );

  const latestPackageId = readiness.payload?.latestPublishedPackageId;
  record(
    "published package id available",
    typeof latestPackageId === "string" && latestPackageId.length > 0,
    latestPackageId ? `package ${latestPackageId}` : "missing latestPublishedPackageId"
  );

  if (latestPackageId) {
    const learnerApi = await request(`/api/lessons/${latestPackageId}`);
    record(
      "published learner API",
      learnerApi.status === 200
        && isJson(learnerApi)
        && learnerPayloadLooksComplete(learnerApi.payload)
        && Boolean(learnerApi.payload?.package?.assessmentBridge?.weakTopic),
      `status ${learnerApi.status}, slides ${(learnerApi.payload?.slides || learnerApi.payload?.deck?.slides || []).length || 0}, items ${(learnerApi.payload?.items || learnerApi.payload?.practiceItems || []).length || 0}`
    );

    const learnerPage = await request(`/lessons/${latestPackageId}`);
    record(
      "published learner page",
      learnerPage.status === 200 && String(learnerPage.contentType).includes("text/html"),
      `status ${learnerPage.status}, content-type ${learnerPage.contentType || "missing"}`
    );

    const exportStatus = await request(`/api/admin/lesson-builder/packages/${latestPackageId}/export-status?profile=harrity`);
    record(
      "Harrity export status ready",
      exportStatus.status === 200
        && isJson(exportStatus)
        && exportStatus.payload?.status === "ready"
        && exportStatus.payload?.includesDeckModel === true
        && Array.isArray(exportStatus.payload?.missingRequiredFiles)
        && exportStatus.payload.missingRequiredFiles.length === 0,
      `status ${exportStatus.status}, export ${exportStatus.payload?.status || "unknown"}, files ${exportStatus.payload?.fileCount || 0}`
    );
  }

  console.log("Checks:");
  for (const result of results) {
    const marker = result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";
    console.log(`- ${marker} ${result.name}: ${result.detail}`);
  }

  const failures = results.filter((result) => result.status === "fail");
  const warnings = results.filter((result) => result.status === "warn");
  console.log("");
  console.log(`Summary: ${results.length - failures.length - warnings.length} passed, ${warnings.length} warning(s), ${failures.length} failure(s).`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Release smoke failed before checks completed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
