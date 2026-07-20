# NurseStudy Live Launch Commit Checklist

Use this checklist when the GitHub repository target is selected. The goal is to commit the pilot-ready NurseStudy app without leaking local secrets or losing launch-critical files.

## Before Staging

Run these from the NurseStudy app folder:

```bash
npm run plan:live-launch-commit
npm run manifest:live-launch-source
npm run scan:live-launch-secrets
npm run archive:live-launch
npm run preflight:live-launch
npm run check:launch
npm run smoke:launch-surfaces
npm run smoke:lesson-builder
npm run gate:live-launch
```

Expected evidence before staging:

- Source manifest passes.
- Commit plan confirms the required old env artifact deletion is present.
- Secret scan passes.
- Archive dry run reports the expected Git-visible deploy file count.
- Live launch preflight has zero failures.
- Launch-surface typecheck passes.
- Fast launch-surface smoke has zero failures.
- Lesson Builder release smoke has zero failures.
- Live launch gate passes.
- Production build output exists in `dist/` from a recent build.

## Files That Must Be Included

The launch commit must include the full pilot app and deployment handoff, including:

- `.github/workflows/live-launch-check.yml`
- `.env.example`
- `.gitignore`
- `client/`
- `server/`
- `shared/`
- `scripts/`
- `drizzle.config.ts`
- `package.json`
- `package-lock.json`
- `render.yaml`
- `LIVE_DEPLOYMENT_STATUS.md`
- `LIVE_LAUNCH_RUNBOOK.md`
- `LESSON_BUILDER_PRODUCTION_CHECKLIST.md`
- `LESSON_BUILDER_MVP_HANDOFF.md`
- `LESSON_AGENT_AUDIT.md`

The launch commit should also include deletion of any old attached `.env` artifact that Git already knows about, including:

```text
attached_assets/HARRITY_PROJECT_API_KEY_1778448728681.env
```

## Files That Must Not Be Included

Do not commit:

- `.env`
- `.env.local`
- `.env.*`
- `*.env` except `.env.example`
- Neon direct or pooled URLs
- OpenAI keys
- SendGrid keys
- Render secrets
- local logs or generated local config folders

## Commit Sequence

After a GitHub repo is selected or created:

```bash
git status --short
npm run remote:live-launch -- --repo=<owner>/<repo>
npm run remote:live-launch -- --repo=<owner>/<repo> --apply
git add -A
npm run scan:live-launch-secrets
npm run manifest:live-launch-source
npm run plan:live-launch-commit
npm run archive:live-launch
npm run check:launch
npm run smoke:launch-surfaces
npm run gate:live-launch
git status --short
git commit -m "Launch NurseStudy Lesson Builder pilot"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

If the GitHub remote already exists, use:

```bash
npm run remote:live-launch -- --repo=<owner>/<repo> --apply
git push -u origin main
```

## After Push

Confirm GitHub Actions runs `Live Launch Check` successfully. That workflow should:

- Install dependencies with `npm ci`.
- Verify the deployment source manifest.
- Scan for deploy-blocking secrets.
- Build the production app.
- Run launch-surface typecheck.
- Start the local preview and run launch-surface smoke.
- Run live-launch preflight.

Only after GitHub Actions passes should Render be connected to the repository.

## Render Boundary

Do not enter secrets into GitHub-tracked files. Set production values only in Render:

```text
DATABASE_URL
SESSION_SECRET
OPENAI_API_KEY
APP_URL
NODE_ENV=production
ENABLE_EMAIL_DELIVERY=false
ENABLE_PROFESSIONAL_STUDY_GUIDE=false
```

Use the Neon direct URL only for `npm run db:push`; use the pooled URL for Render runtime.
