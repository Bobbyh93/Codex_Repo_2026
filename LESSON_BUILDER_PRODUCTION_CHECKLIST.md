# NurseStudy Lesson Builder Production Checklist

Live deployment steps are in `LIVE_LAUNCH_RUNBOOK.md`, and the current handoff state is in `LIVE_DEPLOYMENT_STATUS.md`. The default public launch target is a Render Node Web Service using `render.yaml`.

## Required Server Secrets

- `DATABASE_URL`: pooled Neon app connection string.
- `SESSION_SECRET`: strong 32+ character session secret.
- `OPENAI_API_KEY`: enables direct server-side OpenAI lesson drafting.
- `NURSING_CURRICULUM_AGENT_ENDPOINT`: optional Workspace Agent endpoint.
- `NURSING_CURRICULUM_AGENT_API_KEY`: optional Workspace Agent authorization key.
- `NURSING_CURRICULUM_AGENT_ID`: defaults to `agt_69f192d4f1908191baa41586bb0df9ea`.
- `ENABLE_EMAIL_DELIVERY`: set to `false` for the pilot unless SendGrid is fully configured.
- `SENDGRID_API_KEY`: required only when `ENABLE_EMAIL_DELIVERY=true`.
- `FROM_EMAIL`, `FROM_NAME`, `APP_URL`, `PORT`, `NODE_ENV`: production app settings.
- `ENABLE_PROFESSIONAL_STUDY_GUIDE`: optional; leave unset for the Lesson Builder pilot because Professional Study Guide is post-MVP.

Use a direct Neon URL only for migration/admin commands. Use the pooled URL for app runtime.

## Pilot Release Checks

- `/admin/lesson-builder` health reports `runtime=db_backed`.
- `npm run preflight:live-launch` passes before connecting/deploying the public host.
- `/api/admin/lesson-builder/release-readiness` reports no high-severity release blockers.
- `aiMode` is `openai_chat_completions` or `workspace_agent`.
- Pilot source is approved, ready, and has document chunks.
- Latest published package has zero QA failures and zero contract failures.
- Learner route `/lessons/:id` loads without admin-only QA or source-management controls.
- Learner dashboard routes redirect unauthenticated users to login.
- Password registration accepts first/last name fields and rejects weak passwords with JSON validation errors.
- Missing `/api/*` routes return JSON 404 responses.
- Harrity export status reports all required files plus `deck_model.json`.
- Faculty review has at least one explicit decision for the pilot package; `approved_for_pilot` or `approved_for_release` is required before expanding beyond internal review.
- Learner pilot signals are recording anonymous lesson opens, slide views, practice views, completions, and feedback.
- Package detail shows release audit events for publish, faculty review, learner feedback, and Harrity export download.
- `npm run smoke:lesson-builder` passes against the target `APP_URL`; the only allowed warning is the documented app-wide TypeScript debt.

## Release Notes

- Direct OpenAI Chat Completions is an accepted live drafting path for the pilot.
- Workspace Agent endpoint support remains optional until an API channel can be created and published.
- Deterministic template fallback remains available for demos and resilience, but fallback-created packages must be clearly labeled in package detail.
- Faculty review approval is a human release gate; QA/contract pass alone means the package is technically ready, not necessarily approved for pilot expansion.
