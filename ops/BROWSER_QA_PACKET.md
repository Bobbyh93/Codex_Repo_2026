# Browser QA Packet

Generated: 2026-07-10T07:30:29.808Z
Base URL: https://nursestudy-lesson-builder.onrender.com
Browser status: checklist_ready
Browser note: Interactive browser verification should be recorded after the in-app Browser tab attaches successfully.

## Live Evidence

- Failed checks: 0
- Total topics: 77
- Needs mapping: 0
- Needs assets: 74
- Spend guard: ok
- Current topic: Contraception priority cues and patient teaching
- Current decision: pending

## Required Browser Checks

- page identity
- not blank
- no framework overlay
- console health
- screenshot evidence
- interaction proof

## Route Matrix

| Route | Surface | Mode | Expected rendered result | Interaction proof |
| --- | --- | --- | --- | --- |
| `/` | Student home | public | Student-facing NurseStudy entry, featured lesson, study path, and topic tiles. | Open featured lesson. |
| `/student/progress` | Student progress | public | Session-safe progress dashboard with recent/saved/completed lesson state. | Confirm empty/new-session state is helpful. |
| `/student/study-pack` | Student study pack | public | Guided notes, citations, weak-topic labels, and practice/rationale links. | Open a saved/opened lesson study pack when session data exists. |
| `/admin/topic-production` | Topic production | admin | Topic matrix with 77 mapped topics, asset gaps, and spend/media queues. | Check current visual decision row before queue changes. |
| `/admin/content-mapper` | Content mapper | admin | Task-oriented content block mapper for taxonomy review. | Open first unmapped or imported content block when available. |
| `/admin/lesson-builder` | Lesson builder | admin | Generate tab, template/agent-assisted mode, QA/export, publish workflow. | Generate only template/fallback package unless AI spend is approved. |

## Guardrails

- Public routes must not expose admin-only QA logs, source-management controls, session data, or faculty internals.
- Admin API routes should return 401 without a cookie session; this is expected security behavior, not a smoke failure.
- No next-spend, shorts, media, student-launch, or publish queue should open while the visual decision is pending.
- Browser QA should not submit forms, upload files, publish lessons, or trigger paid AI/media generation without explicit approval.

## Next Action

Run Browser verification on the route matrix when the in-app Browser tab attaches, then record findings in WORK_LOG.
