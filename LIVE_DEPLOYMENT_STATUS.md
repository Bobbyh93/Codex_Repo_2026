# NurseStudy Live Deployment Status

## Current State

NurseStudy is live on Render at `https://nursestudy-lesson-builder.onrender.com/` and is backed by the GitHub deployment source `Bobbyh93/Codex_Repo_2026`. Render and GitHub are connected; production environment secrets must stay server-side only.

The current pilot release path is Lesson Builder-first: normalized official source -> generated package -> Assessment Bridge -> QA/contract/faculty approval -> publish -> assignment -> learner completion/feedback -> Pilot Outcomes -> Harrity export.

The local and live pilot runtimes have passed or support the launch gates below:

- Frontend production build: passed.
- Server bundle: passed.
- Live launch preflight: 25 passed, 0 warnings, 0 failures.
- Lesson Builder release smoke: 13 passed, 0 warnings, 0 failures.
- Pilot readiness endpoint: reports DB, AI mode, source readiness, official source normalization, Assessment Bridge, faculty approval, assignment activity, learner completion, and export state.
- Launch secret scan: passed.
- Deployment source manifest: passed; 466 Git-visible deploy candidate files.
- GitHub launch workflow: added at `.github/workflows/live-launch-check.yml`.
- Launch commit checklist: added at `LIVE_LAUNCH_COMMIT_CHECKLIST.md`.
- Launch commit plan: passed; current branch is `main`, GitHub target confirmed, required old env deletion resolved.
- Published learner route smoke: passed for package `7bfc6660-e78e-452e-8aff-9366a9851ce3` with 8 slides, 1 practice item, HTML learner page, and Harrity export status ready with 12 files.
- GitHub CLI: not installed on this machine.
- GitHub connector: authenticated repository access is available; `Bobbyh93/Codex_Repo_2026` is private, empty, and writable.
- GitHub remote helper: available with `npm run remote:live-launch -- --repo=<owner>/<repo>`; it dry-runs by default and only updates `origin` with `--apply`.
- GitHub target decision: see `LIVE_GITHUB_TARGET_DECISION.md`; selected target is `Bobbyh93/Codex_Repo_2026`.
- GitHub push method: completed with a clean deployment snapshot built from the current verified source files, not the old local Git history. This prevents prior local history and deleted artifacts from being exported.
- GitHub remote branch: `main` is populated and ready for Render.
- Launch archive helper: available with `npm run archive:live-launch`; use `-- --create` only when a zip handoff is needed.
- Live launch gate: available with `npm run gate:live-launch`; runs source manifest, secret scan, archive dry run, preflight, release smoke, and commit plan.
- Launch archive helper: use `npm run archive:live-launch -- --create` to create a fresh ignored zip handoff after the final launch commit. The `launch-artifacts/` folder is ignored and should not be committed.
- Sites hosting metadata: `.openai/hosting.json` is absent in the NurseStudy app. The app requires a Node/Express runtime with Neon, sessions, uploads, and server-side OpenAI, so Render/GitHub remains the production launch path instead of static Sites deployment.
- Render environment checklist: see `LIVE_RENDER_ENVIRONMENT_CHECKLIST.md` for required Render keys, secret handling, Neon URL rules, and first deploy verification.
- One-command launch gate: `npm run gate:live-launch` passed; it runs source manifest, secret scan, archive dry run, preflight, release smoke, and commit plan.

## Live Pilot Completion Gap

Live signed-in smoke on Render has been run against package `bf472933-fdb6-4e67-b893-491c00c7bcd4`:

- Official source normalized: `Therapeutic Communication Pilot Nursing Source`.
- Assessment Bridge attached: weak topic `Therapeutic communication`, ATI/NCLEX category `Psychosocial Integrity`, CJM step `Analyze Cues`.
- Internal smoke assignment created and completed by `Live Pilot Learner`.
- Learner feedback submitted and visible through Pilot Outcomes.
- Harrity export status reports ready with required files plus `deck_model.json`.
- Focused live smoke result: 16 passed, 1 documented warning, 0 failures. The remaining warning record covers human faculty review and known full-app TypeScript debt.

Remaining before inviting a real cohort:

1. Record a real faculty review decision, preferably `approved_for_pilot`.
2. Replace or supplement the smoke learner with the actual pilot learner/cohort.
3. Export the final Harrity bundle after faculty review and archive it for the pilot handoff.

## Launch-Critical Files

These files should be included in the GitHub repository used by Render:

- `package.json`
- `package-lock.json`
- `.github/workflows/live-launch-check.yml`
- `render.yaml`
- `server/`
- `client/`
- `shared/`
- `scripts/`
- `drizzle.config.ts`
- `.env.example`
- `LIVE_GITHUB_TARGET_DECISION.md`
- `LIVE_LAUNCH_COMMIT_CHECKLIST.md`
- `LIVE_LAUNCH_RUNBOOK.md`
- `LIVE_RENDER_ENVIRONMENT_CHECKLIST.md`
- `LESSON_BUILDER_PRODUCTION_CHECKLIST.md`
- `LESSON_BUILDER_MVP_HANDOFF.md`
- `LESSON_AGENT_AUDIT.md`

Do not commit local `.env` files, copied credentials, Render secrets, Neon URLs, or OpenAI keys.

Before pushing to GitHub, run:

```bash
npm run gate:live-launch
npm run plan:live-launch-commit
npm run manifest:live-launch-source
npm run scan:live-launch-secrets
npm run archive:live-launch
```

The old attached `.env` artifact has been removed from the launch source snapshot. The secret scan should stay clean before every push.

After the clean deployment snapshot is pushed, GitHub Actions should run `Live Launch Check`. It installs with `npm ci`, verifies the deployment source manifest, scans for deploy-blocking secrets, builds the production app, and runs live-launch preflight.

Use `LIVE_LAUNCH_COMMIT_CHECKLIST.md` for the exact staging, commit, and push sequence. For this launch, prefer a clean one-commit staging repository created from the verified source manifest instead of pushing the existing local repository history.

The release smoke now also verifies the latest published package through `/api/lessons/:id`, `/lessons/:id`, and `/api/admin/lesson-builder/packages/:id/export-status?profile=harrity`.

## GitHub Status

Current branch: `main`.

The local `origin` remote is configured to `Bobbyh93/Codex_Repo_2026`. Existing Replit/local backup remotes are not suitable as the Render public deployment source.

GitHub CLI is not available on this machine. The GitHub connector can see repositories, and `Bobbyh93/Codex_Repo_2026` has been explicitly approved as the deployment target.

Current GitHub deployment source:

- Repository: `Bobbyh93/Codex_Repo_2026`
- Branch: `main`
- Source state: clean deployment snapshot plus launch handoff documentation

Next required action:

- Connect Render to `Bobbyh93/Codex_Repo_2026`.
- Set the required production environment variables.

## Render Target

Default target: Render Node Web Service using `render.yaml`.

Render should use:

- Runtime: Node
- Region: Oregon
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/health`

If the GitHub repository root is the wider Codex workspace, set Render root directory to:

```text
work/NurseStudy/NurseStudy
```

If the GitHub repository contains only the NurseStudy app, leave Render root directory blank.

## Required Render Secrets

Set these in Render before first production deploy:

```text
DATABASE_URL=<pooled Neon app connection string>
SESSION_SECRET=<strong 32+ char secret>
OPENAI_API_KEY=<server-side OpenAI key>
APP_URL=https://<live-hostname>
NODE_ENV=production
ENABLE_EMAIL_DELIVERY=false
ENABLE_PROFESSIONAL_STUDY_GUIDE=false
```

Optional later:

```text
SENDGRID_API_KEY=<required only when ENABLE_EMAIL_DELIVERY=true>
FROM_EMAIL=noreply@nurseprep.app
FROM_NAME=NursePrep Analytics
NURSING_CURRICULUM_AGENT_ENDPOINT=<optional workspace agent endpoint>
NURSING_CURRICULUM_AGENT_API_KEY=<optional workspace agent key>
```

## Database Step

Before pilot users enter the live app, push schema to Neon with the direct connection string:

```bash
DATABASE_URL="<direct Neon URL>" npm run db:push
```

The deployed app must use the pooled Neon connection string as `DATABASE_URL`.

## First Live Verification

After Render deploys:

1. Open `https://<live-hostname>/health`.
2. Confirm JSON status `ok`.
3. Update `APP_URL` in Render if the final hostname changed.
4. Run:

   ```bash
   APP_URL="https://<live-hostname>" npm run smoke:lesson-builder
   ```

5. Open `/admin/login`, `/admin/lesson-builder`, and the published learner route `/lessons/:id`.
6. Confirm Harrity export downloads.
7. Complete one pilot assignment as a learner and confirm Pilot Outcomes updates.

## Stop Point

The remaining blocker is Render/production environment setup, not local product readiness:

- Render must be connected to that repository.
- Production secrets must be entered in Render.
- Neon schema push must run against the direct connection string.
