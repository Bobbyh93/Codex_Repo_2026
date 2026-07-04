#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const results = [];

function record(name, passed, detail, level = "fail") {
  results.push({
    name,
    status: passed ? "pass" : level,
    detail,
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function hasAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function nodeMajor() {
  return Number.parseInt(process.versions.node.split(".")[0] || "0", 10);
}

const pkgPath = join(root, "package.json");
const packageLockPath = join(root, "package-lock.json");
const renderPath = join(root, "render.yaml");
const githubWorkflowPath = join(root, ".github", "workflows", "live-launch-check.yml");
const archivePath = join(root, "scripts", "live-launch-archive.mjs");
const commitPlanPath = join(root, "scripts", "live-launch-commit-plan.mjs");
const gatePath = join(root, "scripts", "live-launch-gate.mjs");
const remoteSetupPath = join(root, "scripts", "live-launch-set-origin.mjs");
const secretScanPath = join(root, "scripts", "live-launch-secret-scan.mjs");
const sourceManifestPath = join(root, "scripts", "live-launch-source-manifest.mjs");
const envExamplePath = join(root, ".env.example");
const gitignorePath = join(root, ".gitignore");
const githubTargetDecisionPath = join(root, "LIVE_GITHUB_TARGET_DECISION.md");
const renderEnvChecklistPath = join(root, "LIVE_RENDER_ENVIRONMENT_CHECKLIST.md");
const runbookPath = join(root, "LIVE_LAUNCH_RUNBOOK.md");
const commitChecklistPath = join(root, "LIVE_LAUNCH_COMMIT_CHECKLIST.md");
const deploymentStatusPath = join(root, "LIVE_DEPLOYMENT_STATUS.md");

const packageJson = existsSync(pkgPath) ? readJson(pkgPath) : null;
const renderYaml = existsSync(renderPath) ? readText(renderPath) : "";
const githubWorkflow = existsSync(githubWorkflowPath) ? readText(githubWorkflowPath) : "";
const envExample = existsSync(envExamplePath) ? readText(envExamplePath) : "";
const gitignore = existsSync(gitignorePath) ? readText(gitignorePath) : "";
const githubTargetDecision = existsSync(githubTargetDecisionPath) ? readText(githubTargetDecisionPath) : "";
const renderEnvChecklist = existsSync(renderEnvChecklistPath) ? readText(renderEnvChecklistPath) : "";
const runbook = existsSync(runbookPath) ? readText(runbookPath) : "";
const commitChecklist = existsSync(commitChecklistPath) ? readText(commitChecklistPath) : "";
const deploymentStatus = existsSync(deploymentStatusPath) ? readText(deploymentStatusPath) : "";

record("package.json present", Boolean(packageJson), pkgPath);
record(
  "npm lockfile present",
  existsSync(packageLockPath),
  "Render build uses npm ci, so package-lock.json must be committed"
);
record(
  "node runtime compatible",
  nodeMajor() >= 20 && nodeMajor() < 25,
  `current Node ${process.versions.node}; package engines ${packageJson?.engines?.node || "missing"}`
);
record(
  "package scripts ready",
  Boolean(packageJson?.scripts?.build
    && packageJson?.scripts?.start
    && packageJson?.scripts?.["check:launch"]
    && packageJson?.scripts?.["smoke:launch-surfaces"]
    && packageJson?.scripts?.["smoke:lesson-builder"]
    && packageJson?.scripts?.["archive:live-launch"]
    && packageJson?.scripts?.["gate:live-launch"]
    && packageJson?.scripts?.["plan:live-launch-commit"]
    && packageJson?.scripts?.["remote:live-launch"]
    && packageJson?.scripts?.["manifest:live-launch-source"]
    && packageJson?.scripts?.["scan:live-launch-secrets"]
    && packageJson?.scripts?.["db:push"]),
  "requires build, start, check:launch, smoke:launch-surfaces, smoke:lesson-builder, archive:live-launch, gate:live-launch, plan:live-launch-commit, remote:live-launch, manifest:live-launch-source, scan:live-launch-secrets, db:push"
);

record("render.yaml present", existsSync(renderPath), renderPath);
record("GitHub launch workflow present", existsSync(githubWorkflowPath), githubWorkflowPath);
record("live archive script present", existsSync(archivePath), archivePath);
record("live commit plan script present", existsSync(commitPlanPath), commitPlanPath);
record("live launch gate script present", existsSync(gatePath), gatePath);
record("live remote setup script present", existsSync(remoteSetupPath), remoteSetupPath);
record("live secret scan script present", existsSync(secretScanPath), secretScanPath);
record("live source manifest script present", existsSync(sourceManifestPath), sourceManifestPath);
record(
  "render blueprint service fields",
  hasAll(renderYaml, [
    "type: web",
    "runtime: node",
    "region: oregon",
    "buildCommand: npm ci --include=dev && npm run build",
    "startCommand: npm run start",
    "healthCheckPath: /health",
  ]),
  "web service, Node runtime, Oregon region, build/start commands, health path"
);
record(
  "GitHub launch workflow gates",
  hasAll(githubWorkflow, [
    "npm ci",
    "npm run manifest:live-launch-source",
    "npm run scan:live-launch-secrets",
    "npm run build",
    "npm run check:launch",
    "npm run smoke:launch-surfaces",
    "npm run preflight:live-launch",
  ]),
  "workflow installs clean dependencies, checks deploy source, scans secrets, builds, runs launch checks, and runs preflight"
);
record(
  "render blueprint secret placeholders",
  hasAll(renderYaml, [
    "key: DATABASE_URL",
    "sync: false",
    "key: SESSION_SECRET",
    "key: OPENAI_API_KEY",
    "key: APP_URL",
    "key: ENABLE_EMAIL_DELIVERY",
    "value: \"false\"",
  ]),
  "DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, APP_URL are host-managed; pilot email delivery is disabled"
);

record(
  "production env documented",
  hasAll(envExample, [
    "DATABASE_URL=",
    "SESSION_SECRET=",
    "OPENAI_API_KEY=",
    "APP_URL=",
    "ENABLE_EMAIL_DELIVERY=false",
    "NURSING_CURRICULUM_AGENT_ID=",
  ]),
  ".env.example includes runtime, lesson-agent, and optional email settings"
);
record(
  "local secrets ignored",
  hasAll(gitignore, [
    ".env",
    ".env.local",
    ".env.*",
    "!.env.example",
    "*.env",
    "attached_assets/**/*.env",
  ]),
  ".gitignore protects local env and attached env artifacts"
);

const secretScan = existsSync(secretScanPath)
  ? spawnSync(process.execPath, [secretScanPath], { cwd: root, encoding: "utf8" })
  : null;

const sourceManifest = existsSync(sourceManifestPath)
  ? spawnSync(process.execPath, [sourceManifestPath], { cwd: root, encoding: "utf8" })
  : null;

record(
  "live secret scan clean",
  Boolean(secretScan && secretScan.status === 0),
  secretScan?.status === 0
    ? "no deploy-blocking secret patterns or env artifacts found"
    : (secretScan?.stdout || secretScan?.stderr || "secret scan did not run").trim()
);
record(
  "live source manifest ready",
  Boolean(sourceManifest && sourceManifest.status === 0),
  sourceManifest?.status === 0
    ? "required Render/GitHub handoff files are present and forbidden local files are absent"
    : (sourceManifest?.stdout || sourceManifest?.stderr || "source manifest did not run").trim()
);
record(
  "live launch runbook present",
  hasAll(runbook, [
    "Render Setup",
    "Required Production Environment",
    "Database Launch Step",
    "First Deploy Verification",
    "Pilot Cutover",
    "ENABLE_EMAIL_DELIVERY=false",
  ]),
  "runbook covers setup, env, database, verification, and cutover"
);
record(
  "GitHub target decision documented",
  hasAll(githubTargetDecision, [
    "Repository Candidates Checked",
    "Bobbyh93/Codex_Repo_2026",
    "HarrityTeam/chatrepo09262025",
    "Selected Target",
    "Current pushed source",
    "Push Safety",
    "Remote Setup",
  ]),
  "target decision doc records checked repos, selected target, pushed source, push safety, and remote setup commands"
);
record(
  "Render environment checklist present",
  hasAll(renderEnvChecklist, [
    "Required Render Variables",
    "DATABASE_URL",
    "SESSION_SECRET",
    "OPENAI_API_KEY",
    "ENABLE_EMAIL_DELIVERY",
    "Neon Rule",
    "Render Verification",
  ]),
  "Render checklist covers required keys, Neon URL handling, and live verification"
);
record(
  "live launch commit checklist present",
  hasAll(commitChecklist, [
    "Before Staging",
    "Files That Must Be Included",
    "Files That Must Not Be Included",
    "Commit Sequence",
    "After Push",
    "Render Boundary",
  ]),
  "commit checklist covers staging checks, required files, forbidden files, push sequence, GitHub Actions, and Render secrets"
);
record(
  "live deployment status present",
  hasAll(deploymentStatus, [
    "Current State",
    "GitHub Status",
    "Required Render Secrets",
    "First Live Verification",
    "Stop Point",
  ]),
  "status handoff covers current state, GitHub/Render requirements, verification, and stop point"
);

record(
  "production build output present",
  existsSync(join(root, "dist", "index.js")) && existsSync(join(root, "dist", "public", "index.html")),
  "run npm run build before deploy if this fails",
  "warn"
);

console.log("NurseStudy live launch preflight");
console.log("");
for (const result of results) {
  const marker = result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";
  console.log(`- ${marker} ${result.name}: ${result.detail}`);
}

const failures = results.filter((result) => result.status === "fail");
const warnings = results.filter((result) => result.status === "warn");
console.log("");
console.log(`Summary: ${results.length - failures.length - warnings.length} passed, ${warnings.length} warning(s), ${failures.length} failure(s).`);

if (failures.length > 0) {
  process.exitCode = 1;
}
