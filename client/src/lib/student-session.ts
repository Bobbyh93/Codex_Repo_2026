const STUDENT_SESSION_STORAGE_KEY = "nursestudy.student.session";
const LAST_UPLOADED_REPORT_STORAGE_KEY = "nursestudy.lastUploadedReport";

export type LastUploadedReport = {
  reportId: string;
  uploadedAt: string;
  topicsFound?: number | null;
  nextStep?: string | null;
};

function createStudentSessionId() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `student-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getStudentSessionId() {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
    if (existing) return existing;

    const generated = createStudentSessionId();
    window.localStorage.setItem(STUDENT_SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return createStudentSessionId();
  }
}

export function getSavedLessonIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem("nursestudy.savedLessons");
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

export function rememberSavedLesson(lessonId: string) {
  if (typeof window === "undefined") return;
  try {
    const saved = getSavedLessonIds();
    saved.add(lessonId);
    window.localStorage.setItem("nursestudy.savedLessons", JSON.stringify(Array.from(saved)));
  } catch {
    // Local persistence is helpful, but server-side learner events remain the source of progress truth.
  }
}

export function rememberLastUploadedReport(upload: { reportId?: string; topicsFound?: number; nextStep?: string }) {
  if (typeof window === "undefined" || !upload.reportId) return;
  try {
    const record: LastUploadedReport = {
      reportId: upload.reportId,
      uploadedAt: new Date().toISOString(),
      topicsFound: typeof upload.topicsFound === "number" ? upload.topicsFound : null,
      nextStep: upload.nextStep || `/professional-study-guide/${upload.reportId}`,
    };
    window.localStorage.setItem(LAST_UPLOADED_REPORT_STORAGE_KEY, JSON.stringify(record));
    window.localStorage.setItem("lastReportId", record.reportId);
    window.localStorage.setItem("lastReportTime", Date.now().toString());
  } catch {
    // Browser storage is a convenience layer; the report id is still returned by the upload response.
  }
}

export function getLastUploadedReport(): LastUploadedReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_UPLOADED_REPORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.reportId) return parsed;
    }

    const legacyReportId = window.localStorage.getItem("lastReportId");
    if (!legacyReportId) return null;
    const timestamp = Number(window.localStorage.getItem("lastReportTime") || 0);
    return {
      reportId: legacyReportId,
      uploadedAt: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      topicsFound: null,
      nextStep: `/professional-study-guide/${legacyReportId}`,
    };
  } catch {
    return null;
  }
}
