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

  const studentHomePage = await request("/");
  record(
    "public root serves student app",
    studentHomePage.status === 200 && String(studentHomePage.contentType).includes("text/html"),
    `status ${studentHomePage.status}, content-type ${studentHomePage.contentType || "missing"}`
  );

  const studentHome = await request("/api/student/home");
  const studentHomeLessons = Array.isArray(studentHome.payload?.lessons) ? studentHome.payload.lessons : [];
  record(
    "student home API",
    studentHome.status === 200
      && isJson(studentHome)
<<<<<<< HEAD
      && Boolean(studentHome.payload?.featuredLesson?.id)
      && studentHomeLessons.length > 0,
=======
      && Array.isArray(studentHome.payload?.lessons),
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    `status ${studentHome.status}, lessons ${studentHomeLessons.length}, featured ${studentHome.payload?.featuredLesson?.id || "missing"}`
  );

  const studentLessons = await request("/api/student/lessons");
  const studentLessonList = Array.isArray(studentLessons.payload?.lessons) ? studentLessons.payload.lessons : [];
  const firstStudentLesson = studentLessonList[0] || studentHome.payload?.featuredLesson;
  record(
    "student lesson library API",
    studentLessons.status === 200
      && isJson(studentLessons)
<<<<<<< HEAD
      && studentLessonList.length > 0
=======
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
      && studentLessonList.every((lesson) => lesson.learnerUrl && lesson.practiceCount >= 0),
    `status ${studentLessons.status}, lessons ${studentLessonList.length}`
  );

  if (firstStudentLesson?.id) {
    const studentSummary = await request(`/api/student/lessons/${firstStudentLesson.id}/summary`);
    record(
      "student lesson summary API",
      studentSummary.status === 200
        && isJson(studentSummary)
        && studentSummary.payload?.lesson?.id === firstStudentLesson.id
        && studentSummary.payload?.lesson?.citationCount > 0,
      `status ${studentSummary.status}, lesson ${studentSummary.payload?.lesson?.id || "missing"}`
    );
  }

  const publicPilotEmail = `pilot-request-smoke-${Date.now()}@example.edu`;
  const publicPilotRequest = await request("/api/public/launch-interest", {
    method: "POST",
    clientIp: smokeClientIp,
    json: {
      contactName: "Release Smoke Reviewer",
      contactEmail: publicPilotEmail,
      companyName: "Release Smoke Nursing Program",
      jobTitle: "Course Lead",
      organizationType: "Nursing education",
      pilotGoal: "Verify the public pilot request queue captures and qualifies launch interest.",
      interestedTopics: ["Therapeutic Communication", "Clinical Judgment"],
    },
  });
  record(
    "public pilot request captured",
    publicPilotRequest.status === 201 && isJson(publicPilotRequest) && publicPilotRequest.payload?.success === true,
    `status ${publicPilotRequest.status}, lead ${publicPilotRequest.payload?.leadId || "missing"}`
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
  const csrfToken = adminLogin.payload?.csrfToken;

  const pilotRequests = await request("/api/admin/pilot-requests");
  const pilotRequestList = Array.isArray(pilotRequests.payload?.requests) ? pilotRequests.payload.requests : [];
  const smokePilotRequest = pilotRequestList.find((request) => request.contactEmail === publicPilotEmail);
  record(
    "admin pilot requests queue",
    pilotRequests.status === 200 && isJson(pilotRequests) && Boolean(smokePilotRequest),
    `status ${pilotRequests.status}, total ${pilotRequests.payload?.summary?.total ?? 0}`
  );

  if (smokePilotRequest?.id) {
    const updatePilotRequest = await request(`/api/admin/pilot-requests/${smokePilotRequest.id}`, {
      method: "PATCH",
      headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
      json: {
        status: "qualified",
        score: 72,
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        interestedTopics: ["Therapeutic Communication", "Clinical Judgment"],
        adminNotes: "Release smoke qualified this public pilot request.",
      },
    });
    record(
      "admin qualifies pilot request",
      updatePilotRequest.status === 200
        && isJson(updatePilotRequest)
        && updatePilotRequest.payload?.request?.status === "qualified"
        && updatePilotRequest.payload?.request?.adminNotes,
      `status ${updatePilotRequest.status}, request status ${updatePilotRequest.payload?.request?.status || "unknown"}`
    );
  }

  const pilotRequestCsv = await request("/api/admin/pilot-requests/export?format=csv");
  record(
    "pilot request CSV export",
    pilotRequestCsv.status === 200 && String(pilotRequestCsv.contentType).includes("text/csv"),
    `status ${pilotRequestCsv.status}, content-type ${pilotRequestCsv.contentType || "missing"}`
  );

  const pilotRequestJson = await request("/api/admin/pilot-requests/export?format=json");
  record(
    "pilot request JSON export",
    pilotRequestJson.status === 200 && isJson(pilotRequestJson) && Array.isArray(pilotRequestJson.payload?.requests),
    `status ${pilotRequestJson.status}, records ${pilotRequestJson.payload?.requests?.length ?? 0}`
  );

  const readiness = await request("/api/admin/lesson-builder/release-readiness");
  const blockers = Array.isArray(readiness.payload?.blockers) ? readiness.payload.blockers : [];
  const failingBlockers = blockers.filter((blocker) => blocker.status === "fail");
  const warningBlockers = blockers.filter((blocker) => blocker.status === "warn");
<<<<<<< HEAD
=======
  const pilotReadiness = readiness.payload?.health?.pilotReadiness || {};
  const emptyPreviewLibrary = studentLessonList.length === 0 && Number(pilotReadiness.packageCount || 0) === 0;
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
  record(
    "release readiness endpoint",
    readiness.status === 200 && isJson(readiness),
    `status ${readiness.status}`
  );
  record(
<<<<<<< HEAD
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
=======
    "release blockers match preview state",
    failingBlockers.length === 0 || emptyPreviewLibrary,
    emptyPreviewLibrary ? `${failingBlockers.length} expected blocker(s) with no preview packages` : `${failingBlockers.length} failing blocker(s)`
  );
  record(
    "pilot ready",
    readiness.payload?.pilotReady === true || emptyPreviewLibrary,
    emptyPreviewLibrary ? "empty preview library accepted before clinical approval" : `pilotReady=${String(readiness.payload?.pilotReady)}`
  );
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
  record(
    "official source normalized",
    pilotReadiness.normalizedSourceReady === true && pilotReadiness.officialPilotSourceReady === true,
    `normalized=${String(pilotReadiness.normalizedSourceReady)}, officialSource=${String(pilotReadiness.officialPilotSourceReady)}`
  );
  record(
    "assessment bridge attached",
<<<<<<< HEAD
    pilotReadiness.assessmentBridgeReady === true,
    pilotReadiness.assessmentBridge?.weakTopic
      ? `weak topic ${pilotReadiness.assessmentBridge.weakTopic}`
      : "missing weak topic bridge"
=======
    pilotReadiness.assessmentBridgeReady === true || emptyPreviewLibrary,
    pilotReadiness.assessmentBridge?.weakTopic
      ? `weak topic ${pilotReadiness.assessmentBridge.weakTopic}`
      : emptyPreviewLibrary ? "not required until a preview package exists" : "missing weak topic bridge"
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
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
    warningBlockers.every((blocker) => ["typescript", "assignment_loop", "live_completion", "faculty_review"].includes(blocker.key)),
    `${warningBlockers.length} warning(s): ${warningBlockers.map((blocker) => blocker.key).join(", ") || "none"}`,
    "warn"
  );

  const latestPackageId = readiness.payload?.latestPublishedPackageId;
  record(
    "published package id available",
<<<<<<< HEAD
    typeof latestPackageId === "string" && latestPackageId.length > 0,
    latestPackageId ? `package ${latestPackageId}` : "missing latestPublishedPackageId"
=======
    (typeof latestPackageId === "string" && latestPackageId.length > 0) || emptyPreviewLibrary,
    latestPackageId ? `package ${latestPackageId}` : "no published package expected before clinical approval"
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
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

    const lessonSignalSession = `student-smoke-${Date.now()}`;
    const emptyProgress = await request(`/api/student/progress?sessionId=${encodeURIComponent(lessonSignalSession)}`);
    record(
      "student progress starts empty",
      emptyProgress.status === 200
        && isJson(emptyProgress)
        && emptyProgress.payload?.totals?.recentLessons === 0,
      `status ${emptyProgress.status}, recent ${emptyProgress.payload?.totals?.recentLessons ?? "missing"}`
    );

    const lessonSaved = await request(`/api/lessons/${latestPackageId}/events`, {
      method: "POST",
      json: {
        sessionId: lessonSignalSession,
        eventType: "lesson_saved",
        payload: { source: "student_workspace_smoke" },
      },
    });
    record(
      "student lesson save records",
      lessonSaved.status === 200 && isJson(lessonSaved) && lessonSaved.payload?.recorded === true,
      `status ${lessonSaved.status}, recorded ${String(lessonSaved.payload?.recorded)}`
    );

    const lessonEvent = await request(`/api/lessons/${latestPackageId}/events`, {
      method: "POST",
      json: {
        sessionId: lessonSignalSession,
        eventType: "lesson_opened",
        payload: { source: "student_home_smoke" },
      },
    });
    record(
      "student lesson event records",
      lessonEvent.status === 200 && isJson(lessonEvent) && lessonEvent.payload?.recorded === true,
      `status ${lessonEvent.status}, recorded ${String(lessonEvent.payload?.recorded)}`
    );

    const practiceItem = Array.isArray(learnerApi.payload?.practiceItems) ? learnerApi.payload.practiceItems[0] : null;
    if (practiceItem?.id) {
      const practiceAttempt = await request(`/api/lessons/${latestPackageId}/events`, {
        method: "POST",
        json: {
          sessionId: lessonSignalSession,
          eventType: "practice_attempted",
          itemId: practiceItem.id,
          payload: {
            selectedAnswer: practiceItem.correctAnswer,
            correctAnswer: practiceItem.correctAnswer,
            isCorrect: true,
            difficulty: practiceItem.difficulty || null,
          },
        },
      });
      record(
        "student practice attempt records",
        practiceAttempt.status === 200 && isJson(practiceAttempt) && practiceAttempt.payload?.recorded === true,
        `status ${practiceAttempt.status}, recorded ${String(practiceAttempt.payload?.recorded)}`
      );
    }

    const lessonComplete = await request(`/api/lessons/${latestPackageId}/events`, {
      method: "POST",
      json: {
        sessionId: lessonSignalSession,
        eventType: "lesson_completed",
        payload: { source: "student_workspace_smoke" },
      },
    });
    record(
      "student completion records",
      lessonComplete.status === 200 && isJson(lessonComplete) && lessonComplete.payload?.recorded === true,
      `status ${lessonComplete.status}, recorded ${String(lessonComplete.payload?.recorded)}`
    );

    const lessonFeedback = await request(`/api/lessons/${latestPackageId}/feedback`, {
      method: "POST",
      json: {
        sessionId: lessonSignalSession,
        rating: "helpful",
        comment: "Release smoke confirms student feedback path.",
        payload: { source: "student_home_smoke" },
      },
    });
    record(
      "student lesson feedback records",
      lessonFeedback.status === 200 && isJson(lessonFeedback) && lessonFeedback.payload?.recorded === true,
      `status ${lessonFeedback.status}, recorded ${String(lessonFeedback.payload?.recorded)}`
    );

    const studentProgress = await request(`/api/student/progress?sessionId=${encodeURIComponent(lessonSignalSession)}`);
    record(
      "student progress reflects activity",
      studentProgress.status === 200
        && isJson(studentProgress)
        && studentProgress.payload?.totals?.savedLessons >= 1
        && studentProgress.payload?.totals?.completedLessons >= 1
        && studentProgress.payload?.totals?.practiceAttempts >= (practiceItem?.id ? 1 : 0)
        && studentProgress.payload?.totals?.feedbackSubmitted >= 1,
      `status ${studentProgress.status}, saved ${studentProgress.payload?.totals?.savedLessons ?? "missing"}, completed ${studentProgress.payload?.totals?.completedLessons ?? "missing"}`
    );

    const studentStudyPack = await request(`/api/student/study-pack?sessionId=${encodeURIComponent(lessonSignalSession)}`);
    record(
      "student study pack compiles",
      studentStudyPack.status === 200
        && isJson(studentStudyPack)
        && studentStudyPack.payload?.totals?.lessons >= 1
        && studentStudyPack.payload?.totals?.guidedNotes >= 1
        && studentStudyPack.payload?.totals?.citations >= 1,
      `status ${studentStudyPack.status}, lessons ${studentStudyPack.payload?.totals?.lessons ?? "missing"}, notes ${studentStudyPack.payload?.totals?.guidedNotes ?? "missing"}`
    );

    const learnerPage = await request(`/lessons/${latestPackageId}`);
    record(
      "published learner page",
      learnerPage.status === 200 && String(learnerPage.contentType).includes("text/html"),
      `status ${learnerPage.status}, content-type ${learnerPage.contentType || "missing"}`
    );

    const progressPage = await request("/student/progress");
    record(
      "student progress page",
      progressPage.status === 200 && String(progressPage.contentType).includes("text/html"),
      `status ${progressPage.status}, content-type ${progressPage.contentType || "missing"}`
    );

    const studyPackPage = await request("/student/study-pack");
    record(
      "student study pack page",
      studyPackPage.status === 200 && String(studyPackPage.contentType).includes("text/html"),
      `status ${studyPackPage.status}, content-type ${studyPackPage.contentType || "missing"}`
    );

    const exportStatus = await request(`/api/admin/lesson-builder/packages/${latestPackageId}/export-status?profile=harrity`);
    record(
      "Harrity export status ready",
      exportStatus.status === 200
        && isJson(exportStatus)
        && exportStatus.payload?.status === "ready"
        && exportStatus.payload?.includesDeckModel === true
        && Array.isArray(exportStatus.payload?.files)
        && exportStatus.payload.files.includes("control_plane_report.json")
        && Array.isArray(exportStatus.payload?.missingRequiredFiles)
        && exportStatus.payload.missingRequiredFiles.length === 0,
      `status ${exportStatus.status}, export ${exportStatus.payload?.status || "unknown"}, files ${exportStatus.payload?.fileCount || 0}`
    );
    const controlPlane = exportStatus.payload?.controlPlane || {};
    record(
      "Build Package 1 control-plane report available",
      exportStatus.status === 200
        && isJson(exportStatus)
        && controlPlane.hardRule === "NO CKM -> NO TAXONOMY -> NO LESSON BUILD"
        && Array.isArray(controlPlane.checks)
        && controlPlane.checks.length >= 8
        && controlPlane.summary?.checkCount === controlPlane.checks.length
        && controlPlane.status !== "blocked",
      `status ${controlPlane.status || "missing"}, checks ${controlPlane.checks?.length || 0}`
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
