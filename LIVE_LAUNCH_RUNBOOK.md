# NurseStudy Live Launch Runbook

## Goal

Launch the DB-backed NurseStudy Lesson Builder as a public web app, not a localhost preview and not the old static Sites prototype. The app requires a Node/Express runtime, Neon Postgres, server-side OpenAI access, sessions, uploads, and production environment variables.

Default launch target: Render Web Service using the included `render.yaml` blueprint.

For the current handoff state, open `LIVE_DEPLOYMENT_STATUS.md` first.

## Launch Execution Tracker

Use this as the practical go-live queue. Each gate should have evidence before moving to the next one.

| Stage | Action | Evidence |
| --- | --- | --- |
| 1 | Run `npm run preflight:live-launch` from the NurseStudy app folder. | Preflight reports zero failures. |
| 2 | Push the NurseStudy app to GitHub. | GitHub repo contains `package.json`, `package-lock.json`, `render.yaml`, `server/`, `client/`, `shared/`, and `scripts/`. |
| 3 | Connect Render to the GitHub repo. | Render service is created as a Node web service in Oregon. |
| 4 | Set Render secrets. | `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, `APP_URL`, and `NODE_ENV=production` are present in Render and not committed. |
| 5 | Push schema to Neon with the direct URL. | `npm run db:push` succeeds against the direct Neon connection string. |
| 6 | Deploy the Render service. | `/health` returns JSON status `ok`. |
| 7 | Run live Lesson Builder smoke. | `APP_URL="https://<live-hostname>" npm run smoke:lesson-builder` passes. |
| 8 | Complete pilot cutover. | Admin can publish/export, learner can open the lesson, assignment completion records, and Pilot Outcomes updates. |

Current repo status for launch:

- `render.yaml` exists and targets a Render Node web service.
- `package-lock.json` exists, so `npm ci` is the intended Render install command.
- Email delivery is disabled for pilot launch by default with `ENABLE_EMAIL_DELIVERY=false`.
- SendGrid is optional until email delivery is intentionally enabled.
- Validation still must be rerun after any deployment-setting change.

## Why Not Static Sites

This is not a static-only site. It serves:

- Express APIs under `/api/*`.
- Admin sessions and CSRF-backed admin controls.
- Neon-backed persistence for sources, packages, assignments, learner events, QA, and exports.
- Server-side OpenAI lesson generation.
- File upload/processing and Harrity export bundles.

Use a Node web service host such as Render, Railway, Fly, or Replit Deployments. The included launch config targets Render.

## Render Setup

1. Run local preflight:

   ```bash
   npm run preflight:live-launch
   ```

2. Push the NurseStudy app folder to a GitHub repository.
3. In Render, create a Blueprint/Web Service from the repo.
4. If the repository root is the wider Codex workspace, set Render's root directory to:

   ```text
   work/NurseStudy/NurseStudy
   ```

   If the NurseStudy app is moved to its own repository, leave the root directory blank.

5. Use the checked-in `render.yaml`, or configure manually:

   ```text
   Runtime: Node
   Region: Oregon
   Build command: npm ci && npm run build
   Start command: npm run start
   Health check path: /health
   ```

6. Set all host-managed secrets before the first production deploy.

## Required Production Environment

Set these in the host dashboard. Do not commit real values.

```text
DATABASE_URL=<pooled Neon app connection string>
SESSION_SECRET=<strong 32+ char secret>
OPENAI_API_KEY=<server-side OpenAI key>
APP_URL=https://<live-hostname>
NODE_ENV=production
```

Recommended or conditional:

```text
ENABLE_EMAIL_DELIVERY=false
SENDGRID_API_KEY=<required only when ENABLE_EMAIL_DELIVERY=true>
FROM_EMAIL=noreply@nurseprep.app
FROM_NAME=NursePrep Analytics
NURSING_CURRICULUM_AGENT_ID=agt_69f192d4f1908191baa41586bb0df9ea
NURSING_CURRICULUM_AGENT_ENDPOINT=<optional workspace agent endpoint>
NURSING_CURRICULUM_AGENT_API_KEY=<optional workspace agent key>
NURSING_CURRICULUM_AGENT_MODEL=gpt-4o-mini
ENABLE_PROFESSIONAL_STUDY_GUIDE=false
```

Use the pooled Neon URL for app runtime. Use a direct Neon URL only for migration/admin commands.

## Database Launch Step

Before opening the app to pilot users, push the current schema to Neon using the direct Neon connection string in a secure local shell or one-off migration job:

```bash
DATABASE_URL="<direct Neon URL>" npm run db:push
```

Then make sure the deployed app's `DATABASE_URL` is the pooled Neon URL.

## First Deploy Verification

After Render reports the service as live:

1. Open:

   ```text
   https://<live-hostname>/health
   ```

2. Update the host `APP_URL` to the final live URL if Render assigned it after creation.
3. From a secure local shell, run:

   ```bash
   APP_URL="https://<live-hostname>" npm run smoke:lesson-builder
   ```

   If the live admin password differs from the local default, run:

   ```bash
   APP_URL="https://<live-hostname>" ADMIN_EMAIL="<admin email>" ADMIN_PASSWORD="<admin password>" npm run smoke:lesson-builder
   ```

4. Open:

   ```text
   https://<live-hostname>/admin/login
   https://<live-hostname>/admin/lesson-builder
   ```

5. Confirm release readiness:

   ```text
   /api/admin/lesson-builder/release-readiness
   ```

Expected first-launch result:

- DB ready.
- AI mode `openai_chat_completions` or `workspace_agent`.
- No failing release blockers.
- Only allowed warning: documented app-wide TypeScript debt.
- Published learner lesson opens at `/lessons/:id`.
- Harrity export still downloads.

## Pilot Cutover

When the Render URL passes smoke:

1. Assign the official pilot package from the live admin.
2. Open the assignment learner link from a non-admin browser session.
3. Complete the lesson, submit feedback, and confirm Pilot Outcomes updates.
4. Export the Harrity bundle and inspect required files.
5. Attach a custom domain only after the generated Render URL passes smoke.
6. Update `APP_URL` to the custom domain and rerun `npm run smoke:lesson-builder`.

## Rollback

If live smoke fails:

- Keep localhost/Neon dev runtime as the working pilot fallback.
- Roll back the Render deployment to the previous successful deploy.
- Do not rotate or expose secrets in logs.
- Check `/health`, Render logs, Neon connection mode, and `/api/admin/lesson-builder/release-readiness`.

## Known Non-Blocker

Full `npm run check` still reports app-wide TypeScript debt outside the Lesson Builder launch path. The release smoke and production build are the pilot launch gates until the broad TypeScript cleanup becomes the active workstream.
