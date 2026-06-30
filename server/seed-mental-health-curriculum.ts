/**
 * Seed script for Mental Health Nursing curriculum catalog.
 * Reads NUR2200 blueprint Excel and upserts into curriculum_* tables.
 * "NUR2200" is internal only — display name is always "Mental Health Nursing".
 * Idempotent: safe to call on every startup.
 */

import * as path from "path";
import { db } from "./db";
import {
  curriculumObjectives,
  curriculumAssessments,
  curriculumObjectiveAssessments,
} from "@shared/schema";
import { createRequire } from "module";

const EXCEL_PATH = path.resolve(
  process.cwd(),
  "attached_assets/NUR2200_Curriculum_Mapping_v1_Blueprints_(1)_1778448709010.xlsx"
);

const COURSE_CODE = "NUR2200";
const MODULE_DISPLAY_NAME = "Mental Health Nursing";

export async function seedMentalHealthCurriculum(): Promise<{
  objectives: { inserted: number; skipped: number };
  assessments: { inserted: number; skipped: number };
  mappings: { inserted: number; skipped: number };
}> {
  // Use createRequire so xlsx loads as CJS (avoids ESM .default wrapping)
  const _require = createRequire(import.meta.url);
  let xlsx: typeof import("xlsx");
  try {
    xlsx = _require("xlsx") as typeof import("xlsx");
  } catch {
    console.warn("[curriculum-seed] xlsx package not available — skipping");
    return { objectives: { inserted: 0, skipped: 0 }, assessments: { inserted: 0, skipped: 0 }, mappings: { inserted: 0, skipped: 0 } };
  }

  let workbook: ReturnType<typeof xlsx.readFile>;
  try {
    workbook = xlsx.readFile(EXCEL_PATH);
  } catch (err) {
    console.warn("[curriculum-seed] Failed to read Excel at", EXCEL_PATH, err);
    return { objectives: { inserted: 0, skipped: 0 }, assessments: { inserted: 0, skipped: 0 }, mappings: { inserted: 0, skipped: 0 } };
  }

  const result = {
    objectives: { inserted: 0, skipped: 0 },
    assessments: { inserted: 0, skipped: 0 },
    mappings: { inserted: 0, skipped: 0 },
  };

  // ── Sheet 1: 10_Weekly_Objectives ──────────────────────────────────────────
  // Col indices (0-based):
  //  0  Course_ID
  //  1  Week_No
  //  3  Objective_ID
  //  4  Objective_Text_Exact
  //  5  Bloom_Level
  //  6  Bloom_Knowledge
  //  7  NCJMM_Operation
  //  8  NCLEX_Category
  //  9  NCLEX_Subcategory
  // 10  Topic/Module Title (semicolon-separated)
  // 12  ATI_Textbook_Chapter(s)

  const objSheet = workbook.Sheets["10_Weekly_Objectives"];
  if (objSheet) {
    const rows = xlsx.utils.sheet_to_json<any[]>(objSheet, { header: 1, defval: null });
    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const objectiveId = row[3];
      if (!objectiveId || !row[4]) continue; // skip empty rows

      const topics: string[] = row[10]
        ? String(row[10]).split(";").map((t: string) => t.trim()).filter(Boolean)
        : [];

      try {
        await db
          .insert(curriculumObjectives)
          .values({
            courseCode: String(row[0] || COURSE_CODE),
            moduleDisplayName: MODULE_DISPLAY_NAME,
            weekNo: row[1] ? Number(row[1]) : null,
            objectiveId: String(objectiveId),
            objectiveText: String(row[4]),
            bloomLevel: row[5] ? String(row[5]) : null,
            bloomKnowledge: row[6] ? String(row[6]) : null,
            ncjmmOperation: row[7] ? String(row[7]) : null,
            nclexCategory: row[8] ? String(row[8]) : null,
            nclexSubcategory: row[9] ? String(row[9]) : null,
            topics,
            atiChapters: row[12] ? String(row[12]) : null,
          })
          .onConflictDoUpdate({
            target: curriculumObjectives.objectiveId,
            set: {
              objectiveText: String(row[4]),
              bloomLevel: row[5] ? String(row[5]) : null,
              bloomKnowledge: row[6] ? String(row[6]) : null,
              ncjmmOperation: row[7] ? String(row[7]) : null,
              nclexCategory: row[8] ? String(row[8]) : null,
              nclexSubcategory: row[9] ? String(row[9]) : null,
              topics,
              atiChapters: row[12] ? String(row[12]) : null,
            },
          });
        result.objectives.inserted++;
      } catch (err) {
        console.error("[curriculum-seed] Failed to upsert objective", objectiveId, err);
        result.objectives.skipped++;
      }
    }
  }

  // ── Sheet 2: 11_Assessments ────────────────────────────────────────────────
  // Col indices:
  //  0  Course_ID
  //  1  Assessment_ID
  //  2  Assessment_Name
  //  3  Assessment_Type
  //  4  Week(s)_Covered
  //  5  Due_Date
  //  6  Points
  //  7  Weight_%
  //  9  Cumulative (Y/N)

  const asmSheet = workbook.Sheets["11_Assessments"];
  if (asmSheet) {
    const rows = xlsx.utils.sheet_to_json<any[]>(asmSheet, { header: 1, defval: null });
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const assessmentId = row[1];
      if (!assessmentId || !row[2]) continue;

      try {
        await db
          .insert(curriculumAssessments)
          .values({
            courseCode: String(row[0] || COURSE_CODE),
            assessmentId: String(assessmentId),
            assessmentName: String(row[2]),
            assessmentType: row[3] ? String(row[3]) : null,
            weeksCovered: row[4] ? String(row[4]) : null,
            points: row[6] != null ? Number(row[6]) : null,
            weightPercent: row[7] != null ? String(Number(row[7])) : null,
            isCumulative: String(row[9] || "").toUpperCase() === "Y",
          })
          .onConflictDoUpdate({
            target: curriculumAssessments.assessmentId,
            set: {
              assessmentName: String(row[2]),
              assessmentType: row[3] ? String(row[3]) : null,
              weeksCovered: row[4] ? String(row[4]) : null,
              points: row[6] != null ? Number(row[6]) : null,
              weightPercent: row[7] != null ? String(Number(row[7])) : null,
              isCumulative: String(row[9] || "").toUpperCase() === "Y",
            },
          });
        result.assessments.inserted++;
      } catch (err) {
        console.error("[curriculum-seed] Failed to upsert assessment", assessmentId, err);
        result.assessments.skipped++;
      }
    }
  }

  // ── Sheet 3: 12_Objective_Assessment_Map ──────────────────────────────────
  // Col indices:
  //  2  Objective_ID
  //  3  Assessment_ID
  //  4  Map_Role (Primary/Secondary)

  const mapSheet = workbook.Sheets["12_Objective_Assessment_Map"];
  if (mapSheet) {
    const rows = xlsx.utils.sheet_to_json<any[]>(mapSheet, { header: 1, defval: null });

    // Clear existing mappings then re-insert (simpler than conflict detection on composite key)
    await db.delete(curriculumObjectiveAssessments);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const objectiveId = row[2];
      const assessmentId = row[3];
      if (!objectiveId || !assessmentId) continue;

      try {
        await db.insert(curriculumObjectiveAssessments).values({
          objectiveId: String(objectiveId),
          assessmentId: String(assessmentId),
          mapRole: row[4] ? String(row[4]) : null,
        });
        result.mappings.inserted++;
      } catch (err) {
        console.error("[curriculum-seed] Failed to insert mapping", objectiveId, "->", assessmentId, err);
        result.mappings.skipped++;
      }
    }
  }

  return result;
}
