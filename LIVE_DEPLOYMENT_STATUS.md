# NurseStudy Live Deployment Status

## Current State

NurseStudy is live on Render as a Node Web Service.

- Live URL: https://nursestudy-lesson-builder.onrender.com
- Render service: `nursestudy-lesson-builder`
- Render service ID: `srv-d925n4p9rddc7384d0cg`
- GitHub source: `Bobbyh93/Codex_Repo_2026`
- Branch: `main`
- Latest launch fix commit: `601fa85d3ab60dfceb497302177e178dec92dbb6`
- Runtime: Node
- Region: Oregon
- Instance: Render Free
- Health check path: `/health`

The first Render deploy failed because `NODE_ENV=production` caused `npm ci` to skip dev dependencies, so `vite` was unavailable during build. The Render build command and `render.yaml` now use:

```bash
npm ci --include=dev && npm run build
```

The corrected deploy built successfully and Render reported the service live at the primary URL.

## Verified Live Checks

- `GET /health`: `200`, JSON status `ok`.
- `GET /`: `200`.
- `GET /admin/login`: `200`.
- `GET /api/admin/lesson-builder/health` without admin session: protected JSON response `SESSION_EXPIRED`, expected for an admin-only endpoint.

## Launch-Critical Files

These files are included in the GitHub repository used by Render:

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

## Render Configuration

Render is configured with:

- Runtime: Node
- Region: Oregon
- Root directory: blank, because the GitHub repository contains the NurseStudy app at repo root
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm run start`
- Health check path: `/health`
- `APP_URL`: `https://nursestudy-lesson-builder.onrender.com`
- Email delivery disabled for pilot launch
- Professional Study Guide disabled for pilot launch

Required secrets are stored only in Render environment variables and are not tracked in the repository.

## Required Render Secrets

These must remain configured in Render for production runtime:

```text
DATABASE_URL=<pooled Neon app connection string>
SESSION_SECRET=<strong 32+ char secret>
JWT_SECRET=<strong secret>
OPENAI_API_KEY=<server-side OpenAI key>
APP_URL=https://nursestudy-lesson-builder.onrender.com
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

## Remaining Pilot Verification

Before inviting pilot users, complete the product-path smoke on the live host:

1. Sign in at `/admin/login`.
2. Open `/admin/lesson-builder`.
3. Confirm health shows DB ready, OpenAI ready, export ready, and latest published package.
4. Open the published learner route `/lessons/:id`.
5. Confirm Harrity export downloads.
6. Complete one pilot assignment as a learner and confirm Pilot Outcomes updates.

## Local Launch Gates Previously Passed

Before live deployment, the local pilot runtime passed:

- Frontend production build.
- Server bundle.
- Live launch preflight: 25 passed, 0 warnings, 0 failures.
- Lesson Builder release smoke: 13 passed, 0 warnings, 0 failures.
- Pilot readiness endpoint: `pilotReady=true`.
- Launch secret scan.
- Deployment source manifest.
- Published learner route smoke for package `7bfc6660-e78e-452e-8aff-9366a9851ce3`.
