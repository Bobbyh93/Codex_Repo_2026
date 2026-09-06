# Drafts

Output landing zone for the `harrity-lesson-builder-pipeline` Claude skill
(`.claude/skills/harrity-lesson-builder-pipeline/`).

Everything under this directory is a **draft**: reasoning-only output with no paid API spend,
never wired into the live topic-production matrix (`shared/schema.ts`,
`/admin/topic-production`), and never exposed on a student-facing route. `package_status` on
every manifest here is `draft-only` or `faculty-review-needed` — never `release-ready`.

Promoting a draft into the real app (topic-production matrix, student catalog, live audio/video
generation) is a separate, human-directed step, per `TOPIC_PRODUCTION_MILESTONES.md` and
`ops/HARRITY_MVP_WBS.md` (WBS-3.4: "Promote only one reviewed packet per hourly cycle").

## Layout

- `QUEUE.json`: the bounded list of topic candidates the autonomous pipeline is allowed to
  draft, and each one's status. Sourced from `TOPIC_PRODUCTION_MILESTONES.md` Phase 2. The
  autonomous run does not invent new candidates beyond this list — adding topics to the queue
  is a human decision (editing `QUEUE.json` directly, or asking Claude to add one
  interactively).
- `<topic-slug>/`: one directory per drafted package — `blueprint.md`, `outline.json`,
  `script.json`, `assessment_map.csv`, `lesson_manifest.json`, `qa_log.md`.

## Automation

A daily scheduled Claude Code session drafts the next `not_started` topic in `QUEUE.json` and
pushes directly to the `content/autonomous-drafts` branch (never `main`, which auto-deploys to
production on every commit). See the repo's Routines / scheduled triggers for the exact cadence.
