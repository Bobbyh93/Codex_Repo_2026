import { describe, expect, it } from "vitest";
import { isFullLessonCompletion, isSmokeLearnerEvent } from "../../shared/lesson-learner-signals";

describe("isSmokeLearnerEvent", () => {
  it.each([
    [{ smoke: true }],
    [{ source: "codex_smoke" }],
    [{ source: "live_smoke_retry" }],
    [{ source: "student_home_smoke" }],
  ])("flags %j as smoke", (payload) => {
    expect(isSmokeLearnerEvent(payload)).toBe(true);
  });

  it("flags unmarked payloads from a smoke session", () => {
    expect(isSmokeLearnerEvent({ isCorrect: true }, "student-smoke-1760000000000")).toBe(true);
    expect(isSmokeLearnerEvent({ isCorrect: true }, "student-abc")).toBe(false);
  });

  it("keeps ordinary learner events", () => {
    expect(isSmokeLearnerEvent({ rating: "confusing", slideNumber: 4 })).toBe(false);
    expect(isSmokeLearnerEvent(null)).toBe(false);
  });
});

describe("isFullLessonCompletion", () => {
  it("counts a completion when every slide was viewed", () => {
    expect(isFullLessonCompletion({ viewedSlideCount: 8, slideCount: 8 })).toBe(true);
  });

  it("does not count an early tap on complete", () => {
    expect(isFullLessonCompletion({ viewedSlideCount: 1, slideCount: 8 })).toBe(false);
  });

  it("does not count a completion without slide counts", () => {
    expect(isFullLessonCompletion({})).toBe(false);
    expect(isFullLessonCompletion({ viewedSlideCount: 0, slideCount: 0 })).toBe(false);
  });
});
