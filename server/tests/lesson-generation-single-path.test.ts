import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "..", "routes", "lesson-builder-routes.ts"), "utf8");

function handlerBody(route: string) {
  const start = source.indexOf(`app.post("${route}"`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\n  app.", start + 1);
  return source.slice(start, next);
}

describe("lesson generation has a single code path", () => {
  it("drafts and persists lessons only inside generateLessonPackageFromData", () => {
    const runInserts = source.match(/db\.insert\(lessonGenerationRuns\)/g) ?? [];
    expect(runInserts).toHaveLength(1);
    const fn = source.indexOf("export async function generateLessonPackageFromData(");
    expect(source.indexOf("db.insert(lessonGenerationRuns)")).toBeGreaterThan(fn);
  });

  it.each(["/api/admin/lesson-builder/generate", "/api/admin/lesson-builder/packages/:id/duplicate"])(
    "%s delegates to the shared generator",
    (route) => {
      const body = handlerBody(route);
      expect(body).toContain("generateLessonPackageFromData(data, req.session.adminUser?.userId)");
      expect(body).not.toContain("db.insert(lessonPackages)");
      expect(body).not.toContain("buildSlideDrafts(");
    },
  );

  it("maps the no-source refusal to the same 400 the inline handler returned", () => {
    expect(source).toContain('throw new LessonGenerationInputError("At least one approved source is required")');
    expect(handlerBody("/api/admin/lesson-builder/generate")).toContain("res.status(error.status).json({ error: error.message })");
  });
});
