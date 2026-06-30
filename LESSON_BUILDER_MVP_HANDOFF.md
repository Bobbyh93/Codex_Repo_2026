# NurseStudy Lesson Builder MVP Handoff

## Current MVP Status

The DB-backed Lesson Builder path is functional locally:

- Admin Knowledge Base upload creates persisted document chunks.
- Approved sources can generate a Harrity web lesson package.
- Packages support edit, rebuild artifacts, QA, contract validation, publish, learner view, and Harrity zip export.
- Published learner lessons are available at `/lessons/:id`.
- Faculty reviewers can record package decisions: comment, changes requested, approved for pilot, or approved for release.
- Published learner lessons record anonymous open, slide, practice, completion, and feedback signals for pilot review.
- Publish, export, faculty review, and learner feedback events are available as release audit history on package detail.

The current local runtime is Neon-backed and usable for pilot validation. Direct server-side OpenAI Chat Completions is a valid live drafting path for the pilot. Workspace Agent endpoint support remains optional until a live API channel can be created and published.

## Official Pilot Source

Use `Therapeutic Communication Pilot Nursing Source` as the current MVP pilot source. It is paired with the required source contracts:

- Harrity Lesson Builder Pipeline Contract
- Nursing Chapter Deck Builder Schema
- NCC AMS Pilot Preflight Package

Smoke-test uploads named `mvp-*` are development artifacts, not official pilot sources.

## Production Environment

Set these as server-side secrets in the production host. Do not place real values in tracked files.

- `DATABASE_URL`: pooled Neon app connection string.
- `SESSION_SECRET`: strong 32+ character session secret.
- `OPENAI_API_KEY` or `NURSING_CURRICULUM_AGENT_API_KEY`: required for live AI generation.
- `NURSING_CURRICULUM_AGENT_ENDPOINT`: required only when using the workspace lesson-agent endpoint.
- `NURSING_CURRICULUM_AGENT_ID`: defaults to the audited MVP builder agent, `agt_69f192d4f1908191baa41586bb0df9ea`.
- `SENDGRID_API_KEY`: required if production email validation remains enabled.
- `FROM_EMAIL`, `FROM_NAME`, `APP_URL`, `NODE_ENV`, and `PORT`: production app settings.

Use a direct Neon connection string only for migration/admin commands, not app runtime.

## Release Notes

- If health shows `openai_chat_completions_ready` or `workspace_agent_ready`, package generation may use live agent-assisted drafting.
- If health shows `fallback_only` or `agent_invalid_key`, the MVP is still functional but generation uses deterministic template fallback.
- Pilot launch readiness now separates technical readiness from faculty approval. A package can be technically ready while still awaiting faculty review.
- The admin Lesson Builder now includes a Pilot Release Readiness panel and `/api/admin/lesson-builder/release-readiness` blocker summary.
- Learner dashboard routes are token-gated; published `/lessons/:id` remains the learner-facing share route for published lessons.
- Password registration accepts current first-name/last-name payloads, derives username from email when needed, and keeps password-strength validation.
- Professional Study Guide is quarantined as post-MVP by default with a controlled JSON response unless `ENABLE_PROFESSIONAL_STUDY_GUIDE=true`.
- Unknown `/api/*` routes return JSON 404 responses instead of the frontend HTML shell.
- `npm run preflight:live-launch` checks the Render blueprint, production env contract, secret ignore rules, runbook, Node version, and build output.
- `npm run smoke:lesson-builder` runs the focused pilot release smoke against `APP_URL` or `http://localhost:5000`.
- Live launch is documented in `LIVE_LAUNCH_RUNBOOK.md`; the default target is Render Web Service using `render.yaml`.
- Agent audit is recorded in `LESSON_AGENT_AUDIT.md`; no audited agent had a live API channel at the time of review.
- Full production hardening should include app-wide TypeScript cleanup; the focused Lesson Builder build path passes, while full `tsc --noEmit` still reports existing unrelated errors.
- Production deployment requirements are summarized in `LESSON_BUILDER_PRODUCTION_CHECKLIST.md`.

## Handoff Checklist

- Run frontend build and server bundle.
- Verify `/admin/lesson-builder` health cards.
- Upload one approved pilot source and confirm document/source readiness.
- Generate, edit, rebuild, QA, validate, publish, and open learner lesson.
- Record one faculty review decision and confirm it appears in package detail plus pilot readiness.
- Open the learner lesson, mark complete, submit feedback, and confirm learner signals appear in admin package detail.
- Export Harrity bundle and verify required files are present.
- Run `npm run preflight:live-launch` before host connection or deployment.
- Run `npm run smoke:lesson-builder` or `node scripts/lesson-builder-release-smoke.mjs` before handoff.
- Confirm no secrets are present in tracked files or terminal summaries.
