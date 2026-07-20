#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const args = process.argv.slice(2);
const create = args.includes("--create");
const outDir = join(root, "launch-artifacts");
const bundledWindowsGit = process.env.USERPROFILE
  ? join(process.env.USERPROFILE, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "git", "cmd", "git.exe")
  : "";
const gitCandidates = [
  process.env.GIT_BIN,
  process.env.GIT,
  "git",
  bundledWindowsGit,
].filter(Boolean);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8" });
  return result;
}

function runNodeScript(scriptPath) {
  const result = run(process.execPath, [scriptPath]);
  if (result.status !== 0) {
    console.error(result.stdout || result.stderr || `${scriptPath} failed`);
    process.exit(1);
  }
}

function runGit(argsToRun) {
  let lastResult = null;
  for (const gitBin of gitCandidates) {
    const result = spawnSync(gitBin, argsToRun, { cwd: root, encoding: "utf8" });
    lastResult = result;
    if (!result.error) {
      return result;
    }
  }
  return lastResult;
}

function gitVisibleFiles() {
  const result = runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  if (!result || result.status !== 0) {
    console.error((result?.stderr || result?.stdout || "git ls-files failed").trim());
    process.exit(1);
  }
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile())
    .sort();
}

runNodeScript(join(root, "scripts", "live-launch-source-manifest.mjs"));
runNodeScript(join(root, "scripts", "live-launch-secret-scan.mjs"));

const files = gitVisibleFiles();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const archiveName = `nursestudy-live-launch-${timestamp}.zip`;
const manifest = {
  createdAt: new Date().toISOString(),
  fileCount: files.length,
  source: "git ls-files --cached --others --exclude-standard",
  requiredChecks: [
    "live-launch-source-manifest",
    "live-launch-secret-scan",
  ],
  files,
};

console.log("NurseStudy live launch archive");
console.log("");
console.log(`Mode: ${create ? "create" : "dry-run"}`);
console.log(`Files: ${files.length}`);
console.log(`Archive: launch-artifacts/${archiveName}`);

if (!create) {
  console.log("");
  console.log("Dry run only. To create the zip archive, run:");
  console.log("node scripts/live-launch-archive.mjs --create");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const zip = new JSZip();
for (const file of files) {
  zip.file(file, readFileSync(join(root, file)));
}
zip.file("LIVE_ARCHIVE_MANIFEST.json", JSON.stringify(manifest, null, 2));

const archive = await zip.generateAsync({
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
  type: "nodebuffer",
});

const archivePath = join(outDir, archiveName);
writeFileSync(archivePath, archive);

console.log("");
console.log(`PASS archive created: ${archivePath}`);

