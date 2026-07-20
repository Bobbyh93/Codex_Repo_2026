import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const launchSurfacePrefixes = [
  "client/src/App.tsx",
  "client/src/components/admin/admin-layout.tsx",
  "client/src/components/knowledge-base/",
  "client/src/components/study-guide/professional-study-guide.tsx",
  "client/src/components/charts/gap-analysis-chart.tsx",
  "client/src/hooks/use-knowledge-base.ts",
  "client/src/lib/admin-auth.ts",
  "client/src/lib/queryClient.ts",
  "client/src/lib/student-session.ts",
  "client/src/pages/admin/content-import.tsx",
  "client/src/pages/admin/content-mapper.tsx",
  "client/src/pages/admin/knowledge-base",
  "client/src/pages/admin/lesson-builder.tsx",
  "client/src/pages/admin/topic-production-matrix.tsx",
  "client/src/pages/lesson-package.tsx",
  "client/src/pages/student-progress.tsx",
  "client/src/pages/student-study-pack.tsx",
  "server/ai-content-analyzer.ts",
  "server/content-import-routes.ts",
  "server/data-chunker-importer.ts",
  "server/routes/lesson-builder-routes.ts",
  "shared/file-validation.ts",
];

function normalize(fileName) {
  return path.relative(root, fileName).replace(/\\/g, "/");
}

function isLaunchSurface(fileName) {
  const relative = normalize(fileName);
  return launchSurfacePrefixes.some((prefix) => relative === prefix || relative.startsWith(prefix));
}

function diagnosticLocation(diagnostic) {
  if (!diagnostic.file || diagnostic.start === undefined) return "";
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${normalize(diagnostic.file.fileName)}:${line + 1}:${character + 1}`;
}

const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
  console.error("No tsconfig.json found.");
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: {
    ...parsed.options,
    noEmit: true,
  },
});

const diagnostics = ts.getPreEmitDiagnostics(program);
const launchDiagnostics = diagnostics.filter((diagnostic) => diagnostic.file && isLaunchSurface(diagnostic.file.fileName));

if (launchDiagnostics.length > 0) {
  console.error(`Launch surface typecheck failed with ${launchDiagnostics.length} diagnostic(s).`);
  for (const diagnostic of launchDiagnostics) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const location = diagnosticLocation(diagnostic);
    console.error(`${location ? `${location} - ` : ""}${message}`);
  }
  process.exit(1);
}

const legacyCount = diagnostics.length - launchDiagnostics.length;
console.log(`Launch surface typecheck passed. ${legacyCount} legacy diagnostic(s) remain outside the launch surface.`);
