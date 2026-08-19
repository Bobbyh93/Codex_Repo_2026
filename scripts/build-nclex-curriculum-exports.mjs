import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "curriculum_exports", "nclex-rn-2026");
const dashboardDataDir = resolve(root, "apps", "nurse-prep-web", "data");
await mkdir(outputDir, { recursive: true });
await mkdir(dashboardDataDir, { recursive: true });

// Load TypeScript through the project's existing tsx runtime.
const service = await import(pathToFileURL(resolve(root, "server", "nclex-curriculum-service.ts")).href);
const validation = service.validateCurriculum();
if (!validation.valid) {
  throw new Error(`Curriculum validation failed:\n${validation.issues.join("\n")}`);
}

const artifacts = [
  ["curriculum-manifest.json", JSON.stringify(service.curriculumManifest(), null, 2)],
  ["canvas-outcomes.csv", service.canvasOutcomesCsv()],
  ["qti-exemplar-bank.xml", service.qtiAssessmentXml()],
  ["pathway-rules.json", JSON.stringify(service.pathwayRulesManifest(), null, 2)],
  ["execution-status.json", JSON.stringify(service.executionStatus(), null, 2)],
  ["nclex-rn-2026.imscc", await service.commonCartridgeArchive()],
];

for (const [name, content] of artifacts) await writeFile(resolve(outputDir, name), content);
await writeFile(resolve(dashboardDataDir, "execution-status.json"), artifacts.find(([name]) => name === "execution-status.json")[1]);
console.log(JSON.stringify({ outputDir, artifacts: artifacts.map(([name]) => name), validation }, null, 2));
