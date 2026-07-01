# NurseStudy Lesson Builder MVP Handoff

## Current MVP Status

The DB-backed Lesson Builder path is functional locally and is the live Render product path for the internal pilot:

- Admin Knowledge Base upload creates persisted document chunks.
- Approved sources can generate a Harrity web lesson package.
- Source detail now includes a NursesBrain-style normalization step for table/crosswalk signals, taxonomy hints, official pilot source status, and weak-topic metadata.
- Packages support edit, rebuild artifacts, QA, contract validation, publish, learner view, and Harrity zip export.
- Packages can carry an assessment bridge: weak topic, ATI category, NCLEX category, CJM step, and evidence source.
- Published learner lessons are available at `/lessons/:id`.
- Faculty reviewers can record package decisions: comment, changes requested, approved for pilot, or approved for release.
- Published learner lessons record anonymous open, slide, practice, completion, and feedback signals for pilot review.
- Publish, export, faculty review, and learner feedback events are available as release audit history on package detail.
- The live admin Lesson Builder includes a Pilot Launch Console with readiness ladder, active pilot package, AI review, premium faculty review status, assignment activity, learner link actions, and pilot evidence export.
- Google Drive nursing PPT/Slides assets are registered as reusable deck/source-pattern references, including the CH18 Harrity learner-facing deck, Harrity skill overview, California CNS lesson deck, and NCC RN2019/NCOC chapter decks.
- Pearson Course Audit and Pearson Concept Audit Sites dashboards are registered as related audit-pattern references for coverage review, reviewer state, premium faculty review workflow, and program-director evidence reporting.

The current local runtime is Neon-backed and usable for pilot validation. Direct server-side OpenAI Chat Completions is a valid live drafting path for the pilot. Workspace Agent endpoint support remains optional until a live API channel can be created and published.

## Official Pilot Source

Use `Therapeutic Communication Pilot Nursing Source` as the current MVP pilot source. It is paired with the required source contracts:

- Harrity Lesson Builder Pipeline Contract
- Nursing Chapter Deck Builder Schema
- NCC AMS Pilot Preflight Package

Smoke-test uploads named `mvp-*` are development artifacts, not official pilot sources.

For the live pilot, normalize the official source in Source Detail, keep it approved and ready, and attach its weak topic to the published pilot package through the Assessment Bridge panel.

Live Render pilot smoke has completed for package `bf472933-fdb6-4e67-b893-491c00c7bcd4`: official source normalized, Assessment Bridge attached, AI-reviewed `approved_for_pilot` recorded, internal smoke assignment completed, learner feedback recorded, Pilot Outcomes updated, and Harrity export verified. Human faculty review remains premium.

## Live Pilot Launch Console

The live Render app is deployed from `Bobbyh93/Codex_Repo_2026` on `main`. The Pilot Launch Console update was pushed in commit `0fda120` (`Add pilot launch console`) and verified on `https://nursestudy-lesson-builder.onrender.com/admin/lesson-builder`.

Verified live on Render:

- The app wakes successfully and redirects protected admin routes to `/admin/login`.
- The seeded admin login succeeds for the live smoke environment.
- `/admin/lesson-builder` renders the Pilot Launch Console.
- The console shows Drive deck count, Pearson audit-pattern count, active pilot package, learner link action, AI Review, Open Learner, Export Evidence, assignment counts, learner completion, and export readiness.
- Live AI Review was run for the active pilot package and the readiness ladder now reports `Latest AI review: approved for pilot`.
- Authenticated API smoke passed for `/api/admin/pilot-launch/summary`.
- Authenticated API smoke passed for `/api/admin/lesson-builder/packages/:id/pilot-evidence-export`.

Use the Pearson Sites projects as workflow models, not as nursing source truth:

- `Pearson Course Audit Workflow Dashboard`: course/concept coverage review, reviewer-state workflow, faculty approval pattern, and product-operator console inspiration.
- `Pearson Concept Audit Dashboard`: concept/course package audit, source-to-concept traceability, evidence summary, and program-director reporting pattern.

Use the Drive PPT/Slides assets as source/deck exemplars:

- CH18 Asthma Learner-Facing Lesson Package: golden Harrity learner-facing lesson grammar.
- Harrity Lesson Builder Skill Overview: package contract and pipeline framing.
- California CNS Harrity Lesson Deck: alternate Harrity deck pattern.
- NCC RN2019/NCOC chapter decks: nursing chapter structure and course-source pattern.

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
- Pilot launch readiness now separates AI-reviewed pilot approval from human faculty review. AI-reviewed `approved_for_pilot` satisfies internal MVP launch; human faculty review is a premium feature for formal release support.
- Pilot readiness now also reports official source readiness, source normalization, assessment bridge status, active assignment status, learner completion, and live verification completion.
- Pilot Launch Console is the preferred admin entry point for the internal cohort launch; use the broader Lesson Builder tabs for source/package debugging and audit drill-down.
- Google Drive decks and Pearson Sites dashboards are related supporting assets. They are registered for provenance and workflow-pattern reuse, but they should not replace approved nursing source documents.
- The admin Lesson Builder now includes a Pilot Release Readiness panel and `/api/admin/lesson-builder/release-readiness` blocker summary.
- Replit `NurseStudy` assessment workflows and `NursesBrain` autonomous extraction remain source patterns for future work. The MVP stays Lesson Builder-first until the live pilot loop is verified end to end.
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
- Normalize the official pilot source and confirm table/crosswalk/taxonomy hints are visible.
- Generate, edit, rebuild, QA, validate, publish, and open learner lesson.
- Attach one weak topic or ATI category to the package through Assessment Bridge.
- Record one AI-reviewed `approved_for_pilot` decision for internal launch; add human faculty review only for the premium release workflow.
- Open the learner lesson, mark complete, submit feedback, and confirm learner signals appear in admin package detail.
- Export Harrity bundle and verify required files are present.
- Open the Pilot Launch Console, confirm all readiness steps pass, and export Pilot Evidence for the program-director handoff.
- Run `npm run preflight:live-launch` before host connection or deployment.
- Run `npm run smoke:lesson-builder` or `node scripts/lesson-builder-release-smoke.mjs` before handoff.
- Confirm no secrets are present in tracked files or terminal summaries.
