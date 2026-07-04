const STUDENT_SESSION_STORAGE_KEY = "nursestudy.student.session";

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
