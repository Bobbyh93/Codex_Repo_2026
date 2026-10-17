/**
 * Learner-event filters shared by analytics and release readiness.
 *
 * Smoke scripts post real learner events. They mark themselves either with
 * `smoke: true` or with a `source` containing "smoke" (codex_smoke,
 * live_smoke, live_smoke_retry, student_home_smoke, ...). Those events prove a
 * pathway works; they are not learner evidence.
 */
export function isSmokeLearnerEvent(
  payload: Record<string, any> | null | undefined,
  sessionId?: string | null,
): boolean {
  // Some smoke events (e.g. practice_attempted) carry no marker in the payload
  // but always run under a `student-smoke-*` session.
  if (sessionId && /smoke/i.test(sessionId)) return true;
  if (!payload || typeof payload !== "object") return false;
  if (payload.smoke === true || payload.smoke === "true") return true;
  return /smoke/i.test(String(payload.source || ""));
}

/**
 * A `lesson_completed` event counts as a full completion only when the
 * learner viewed every slide. Learners may still tap "complete" early; that
 * event is kept, but it is not counted as a completed lesson.
 */
export function isFullLessonCompletion(payload: Record<string, any> | null | undefined): boolean {
  if (!payload || typeof payload !== "object") return false;
  const viewed = Number(payload.viewedSlideCount);
  const total = Number(payload.slideCount);
  return Number.isFinite(viewed) && Number.isFinite(total) && total > 0 && viewed >= total;
}
