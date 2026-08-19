const baseUrl = (process.env.APP_URL || "http://127.0.0.1:5055").replace(/\/$/, "");

const checks = [];

function record(name, passed, detail = "") {
  checks.push({ name, status: passed ? "pass" : "fail", detail });
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
  });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload = null;
  if (contentType.includes("application/json")) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  return {
    path,
    status: response.status,
    ok: response.ok,
    contentType,
    text,
    payload,
  };
}

function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

async function main() {
  const pageRoutes = [
    "/",
    "/student/progress",
    "/student/study-pack",
    "/admin/topic-production",
    "/admin/content-mapper",
    "/admin/lesson-builder",
  ];

  for (const route of pageRoutes) {
    const response = await request(route);
    record(
      `page ${route}`,
      response.status === 200 && response.text.includes("root"),
      `status ${response.status}, bytes ${response.text.length}`
    );
  }

  const studentHome = await request("/api/student/home");
  const home = studentHome.payload || {};
<<<<<<< HEAD
  record(
    "student home API",
    studentHome.status === 200
      && Array.isArray(home.lessons)
      && home.lessons.length >= 1
      && home.featuredLesson?.learnerUrl?.startsWith("/lessons/")
      && Array.isArray(home.topicTiles)
      && home.topicTiles.length >= 1,
=======
  const homeHasPublishedLessons = Array.isArray(home.lessons)
    && home.lessons.length >= 1
    && home.featuredLesson?.learnerUrl?.startsWith("/lessons/")
    && Array.isArray(home.topicTiles)
    && home.topicTiles.length >= 1;
  const homeHasValidEmptyLibrary = Array.isArray(home.lessons)
    && home.lessons.length === 0
    && home.featuredLesson === null
    && Array.isArray(home.topicTiles)
    && home.topicTiles.length === 0
    && home.metrics?.publishedLessons === 0;
  record(
    "student home API",
    studentHome.status === 200
      && (homeHasPublishedLessons || homeHasValidEmptyLibrary),
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    `status ${studentHome.status}, lessons ${home.lessons?.length || 0}, topics ${home.topicTiles?.length || 0}`
  );

  const studentLessons = await request("/api/student/lessons");
  const lessons = Array.isArray(studentLessons.payload?.lessons) ? studentLessons.payload.lessons : [];
  const lessonText = JSON.stringify(studentLessons.payload || {});
  record(
    "student lessons API learner safe",
    studentLessons.status === 200
<<<<<<< HEAD
      && lessons.length >= 1
=======
      && Array.isArray(studentLessons.payload?.lessons)
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
      && lessons.every((lesson) => typeof lesson.id === "string" && lesson.learnerUrl?.startsWith("/lessons/"))
      && !/qaSummary|sourceRegistry|sourceManagement|adminOnly/i.test(lessonText),
    `status ${studentLessons.status}, lessons ${lessons.length}`
  );

  const sessionId = `launch-surface-smoke-${Date.now()}`;
  const progress = await request(`/api/student/progress?sessionId=${encodeURIComponent(sessionId)}`);
  const totals = progress.payload?.totals || {};
  record(
    "student progress API empty-session safe",
    progress.status === 200
      && progress.payload?.sessionId === sessionId
      && numberValue(totals.savedLessons)
      && numberValue(totals.completedLessons)
      && Array.isArray(progress.payload?.recommendedLessons),
    `status ${progress.status}, recommended ${progress.payload?.recommendedLessons?.length || 0}`
  );

  const studyPack = await request(`/api/student/study-pack?sessionId=${encodeURIComponent(sessionId)}`);
  record(
    "student study pack API empty-session safe",
    studyPack.status === 200
      && studyPack.payload?.sessionId === sessionId
      && Array.isArray(studyPack.payload?.lessons)
      && numberValue(studyPack.payload?.totals?.lessons),
    `status ${studyPack.status}, lessons ${studyPack.payload?.lessons?.length || 0}`
  );

  const topicMatrix = await request("/api/admin/topic-production-matrix?format=json");
  const rows = Array.isArray(topicMatrix.payload?.rows) ? topicMatrix.payload.rows : [];
  record(
    "topic production matrix API",
    topicMatrix.status === 200
      && rows.length >= 5
      && rows.some((row) => row.topic === "Postpartum Hemorrhage Priorities" || row.Topic === "Postpartum Hemorrhage Priorities")
      && rows.some((row) => row.topic === "Maternal-Newborn Lesson Guide" || row.Topic === "Maternal-Newborn Lesson Guide"),
    `status ${topicMatrix.status}, rows ${rows.length}`
  );

  const humanReviewPack = await request("/api/admin/topic-production-matrix/human-review-pack?format=json");
  const records = Array.isArray(humanReviewPack.payload?.records) ? humanReviewPack.payload.records : [];
  record(
    "human review pack API",
    humanReviewPack.status === 200
      && records.length >= 5
      && records.every((record) => record.Topic && record.Concept && record["Nursing Subject"]),
    `status ${humanReviewPack.status}, records ${records.length}`
  );

  const failed = checks.filter((check) => check.status === "fail");
  const summary = {
    name: "NurseStudy launch surface smoke",
    baseUrl,
    generatedAt: new Date().toISOString(),
    checks,
    totals: {
      checks: checks.length,
      failed: failed.length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    console.error("Launch surface smoke failed.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Launch surface smoke failed before checks completed.");
  console.error(error);
  process.exitCode = 1;
});
