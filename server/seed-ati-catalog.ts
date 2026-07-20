import { db } from "./db";
import { textbooks, textbookChapters, textbookSections } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

const NCLEX_CATEGORIES_1307 = [
  "Safety and Infection Control",
  "Basic Care and Comfort",
  "Pharmacological and Parenteral Therapies",
  "Physiological Adaptation",
  "Health Promotion and Maintenance",
  "Psychosocial Integrity",
  "Reduction of Risk Potential",
  "Management of Care",
];

const NCLEX_CATEGORY_NORMALIZE: Record<string, string> = {
  "Safety and Infection Control (10-16%)": "Safety and Infection Control",
  "Basic Care and Comfort (6-12%)": "Basic Care and Comfort",
  "Pharmacological and Parenteral Therapies (13-19%)": "Pharmacological and Parenteral Therapies",
  "Physiological Adaptation (6-12%)": "Physiological Adaptation",
  "Health Promotion and Maintenance (6-12%)": "Health Promotion and Maintenance",
  "Psychosocial Integrity (6-12%)": "Psychosocial Integrity",
  "Reduction of Risk Potential (9-15%)": "Reduction of Risk Potential",
  "Management of Care (15-21%)": "Management of Care",
};

const EXCLUDED_MODULES = new Set(["Other Books for Complete Partners"]);

const CHAPTER_ONLY_MODULES = new Set([
  "Swift River Virtual Clinicals",
]);

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  "Learning System 3.0: Practice, Final and Dynamic Quizzing": "Learning System 3.0",
  "Learning System 3.0: Practice  Final and Dynamic Quizzing": "Learning System 3.0",
};

interface ParsedTutorial {
  name: string;
  categories: string[];
}

interface ParsedModule {
  csvName: string;
  displayName: string;
  moduleCategories: string[];
  tutorials: ParsedTutorial[];
}

function readCsvRows(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
}

function extractXMarkCategories(row: string[], startCol = 2): string[] {
  const cats: string[] = [];
  for (let i = 0; i < NCLEX_CATEGORIES_1307.length; i++) {
    const cell = (row[startCol + i] ?? "").trim().toLowerCase();
    if (cell === "x") cats.push(NCLEX_CATEGORIES_1307[i]);
  }
  return cats;
}

function normalizeTitle(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

function parse1307(filePath: string): ParsedModule[] {
  const rows = readCsvRows(filePath);
  const modules: ParsedModule[] = [];
  let currentModule: ParsedModule | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const col0 = normalizeTitle(row[0] ?? "");
    const col1 = normalizeTitle(row[1] ?? "");

    const col0Empty = col0 === "";
    const isShowcase =
      col0.toLowerCase().includes("showcase") ||
      col0.toLowerCase().includes("overview");

    if (!col0Empty && !isShowcase) {
      if (EXCLUDED_MODULES.has(col0)) {
        currentModule = null;
        continue;
      }
      const cats = extractXMarkCategories(row);
      const displayName = MODULE_DISPLAY_NAMES[col0] ?? col0;
      currentModule = {
        csvName: col0,
        displayName,
        moduleCategories: cats,
        tutorials: [],
      };
      modules.push(currentModule);
    } else if (isShowcase && col1 && currentModule) {
      if (CHAPTER_ONLY_MODULES.has(currentModule.csvName)) continue;
      const cats = extractXMarkCategories(row);
      currentModule.tutorials.push({ name: col1, categories: cats });
    } else if (col0Empty && col1 && currentModule) {
      if (CHAPTER_ONLY_MODULES.has(currentModule.csvName)) continue;
      const cats = extractXMarkCategories(row);
      currentModule.tutorials.push({ name: col1, categories: cats });
    }
  }

  return modules;
}

function parse1308TutorialMap(filePath: string): Map<string, string[]> {
  const rows = readCsvRows(filePath);
  const map = new Map<string, string[]>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawCategory = normalizeTitle(row[0] ?? "");
    const module = normalizeTitle(row[1] ?? "");
    const tutorial = normalizeTitle(row[2] ?? "");
    if (!module || !rawCategory || !tutorial) continue;
    const category = NCLEX_CATEGORY_NORMALIZE[rawCategory] ?? rawCategory;
    const key = `${module}|||${tutorial}`;
    const existing = map.get(key) ?? [];
    if (!existing.includes(category)) map.set(key, [...existing, category]);
  }

  return map;
}

function parse1308ModuleMap(filePath: string): Map<string, string[]> {
  const rows = readCsvRows(filePath);
  const map = new Map<string, string[]>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawCategory = normalizeTitle(row[0] ?? "");
    const module = normalizeTitle(row[1] ?? "");
    if (!module || !rawCategory) continue;
    const category = NCLEX_CATEGORY_NORMALIZE[rawCategory] ?? rawCategory;
    const existing = map.get(module) ?? [];
    if (!existing.includes(category)) map.set(module, [...existing, category]);
  }

  return map;
}

function deriveModuleNclex(
  mod: ParsedModule,
  moduleMap: Map<string, string[]>
): string {
  if (mod.moduleCategories.length > 0) {
    return mod.moduleCategories.join(", ");
  }

  const fromTutorials = new Set<string>();
  for (const tut of mod.tutorials) {
    for (const cat of tut.categories) fromTutorials.add(cat);
  }
  if (fromTutorials.size > 0) return [...fromTutorials].join(", ");

  const from1308 =
    moduleMap.get(mod.csvName) ?? moduleMap.get(mod.displayName);
  if (from1308 && from1308.length > 0) return from1308.join(", ");

  return "Management of Care";
}

function resolveTutorialNclex(
  tut: ParsedTutorial,
  mod: ParsedModule,
  tutorialMap: Map<string, string[]>,
  moduleNclex: string
): string {
  if (tut.categories.length > 0) return tut.categories.join(", ");

  const key = `${mod.csvName}|||${tut.name}`;
  const fromFallback = tutorialMap.get(key);
  if (fromFallback && fromFallback.length > 0) return fromFallback.join(", ");

  return moduleNclex;
}

export async function seedAtiCatalog(): Promise<{
  inserted: number;
  skipped: number;
}> {
  let inserted = 0;
  let skipped = 0;

  const csv1307 = path.resolve(
    process.cwd(),
    "attached_assets",
    "solution_table_1778073061307.csv"
  );
  const csv1308 = path.resolve(
    process.cwd(),
    "attached_assets",
    "Solutions_Table_1778073061308.csv"
  );

  const modules = parse1307(csv1307);
  const tutorialMap = parse1308TutorialMap(csv1308);
  const moduleMap = parse1308ModuleMap(csv1308);

  const TEXTBOOK_TITLE = "ATI Digital Learning Suite";

  const existing = await db
    .select({ id: textbooks.id })
    .from(textbooks)
    .where(eq(textbooks.title, TEXTBOOK_TITLE));

  let textbookId: string;
  if (existing.length > 0) {
    textbookId = existing[0].id;
    skipped++;
  } else {
    const [book] = await db
      .insert(textbooks)
      .values({
        title: TEXTBOOK_TITLE,
        publisher: "ATI Nursing Education",
        edition: "Current",
        primarySubject: "All Subjects",
        description:
          "ATI's comprehensive digital learning platform covering all eight NCLEX-RN client need categories through interactive modules, tutorials, and practice assessments.",
        isActive: true,
      })
      .returning();
    textbookId = book.id;
    inserted++;
  }

  const existingChapters = await db
    .select({ id: textbookChapters.id, title: textbookChapters.title })
    .from(textbookChapters)
    .where(eq(textbookChapters.textbookId, textbookId));
  const existingChapterMap = new Map(
    existingChapters.map((c) => [c.title, c.id])
  );

  for (let mi = 0; mi < modules.length; mi++) {
    const mod = modules[mi];
    const chapterNclex = deriveModuleNclex(mod, moduleMap);

    let chapterId: string;
    const existingId = existingChapterMap.get(mod.displayName);
    if (existingId) {
      chapterId = existingId;
      skipped++;
    } else {
      const [chapter] = await db
        .insert(textbookChapters)
        .values({
          textbookId,
          chapterNumber: String(mi + 1),
          title: mod.displayName,
          subjectTag: "ATI",
          nclexCategoryTag: chapterNclex,
        })
        .returning();
      chapterId = chapter.id;
      inserted++;
    }

    if (mod.tutorials.length === 0) continue;

    const existingSections = await db
      .select({ title: textbookSections.title })
      .from(textbookSections)
      .where(eq(textbookSections.chapterId, chapterId));
    const existingTitles = new Set(existingSections.map((s) => s.title));

    for (let ti = 0; ti < mod.tutorials.length; ti++) {
      const tut = mod.tutorials[ti];
      const sectionNclex = resolveTutorialNclex(
        tut,
        mod,
        tutorialMap,
        chapterNclex
      );

      if (existingTitles.has(tut.name)) {
        skipped++;
      } else {
        await db.insert(textbookSections).values({
          chapterId,
          sectionNumber: `${mi + 1}.${ti + 1}`,
          title: tut.name,
          nclexCategoryTag: sectionNclex,
        });
        inserted++;
      }
    }
  }

  return { inserted, skipped };
}
