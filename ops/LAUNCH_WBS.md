# NurseStudy Launch WBS

Generated: 2026-07-10T07:20:04.423Z
Live app: https://nursestudy-lesson-builder.onrender.com
Current topic: Contraception priority cues and patient teaching
Daily soft cap: $450
Hard stop: $500 unless explicitly approved
Spend guard: ok

## Summary

- Failed live checks: 0
- Topics: 77
- Ready: 3
- Needs mapping: 0
- Needs assets: 74
- Current decision: pending

## Work Packages

| ID | Work package | Owner | Status | Budget cap | Next action |
| --- | --- | --- | --- | ---: | --- |
| WBS-1 | Live product health | Ops | ready | $50/check | Keep checking hourly. |
| WBS-2 | Student public learning surface | Product | ready | $50/check | Keep student route smoke in the hourly check. |
| WBS-3 | Topic taxonomy and content mapping | Content Ops | ready | $100/packet | Protect mapping completeness while asset work continues. |
| WBS-4 | Lesson package assets | Content Ops | in_progress | $100/packet before approval | Review asset gaps: slide decks 68, study guides 68, visuals 74, quizzes 68. |
| WBS-5 | No-spend visual decision gate | Reviewer | ready_for_decision | $0 until approved | Review Contraception priority cues and patient teaching and choose approve, revise, or hold. |
| WBS-6 | Airtable viral shorts handoff | Marketing Ops | held | $100-$250 only after approval | Keep held until visual decision approval. |
| WBS-7 | Calendar and Drive operating record | Ops | local_ready | $0 local artifact | Import or sync calendar/Drive artifacts only after connector access is available and approved. |
| WBS-8 | Deployment and source control | Engineering | ready | $50/check | Continue small commits after each verified ops packet. |

## Evidence Map

### WBS-1 Live product health

Acceptance: Live health, student home, admin login, topic matrix, and queue checks pass.

Evidence: `ops/OPS_REVIEW_DASHBOARD.json`, `scripts/hourly-ops-check.mjs`

### WBS-2 Student public learning surface

Acceptance: Student home returns a featured lesson and learner-safe lesson data.

Evidence: `GET /api/student/home`, `ops/OPS_REVIEW_DASHBOARD.json`

### WBS-3 Topic taxonomy and content mapping

Acceptance: Every topic has concept, nursing subject, weak topic, NCLEX category, CJM step, and source evidence.

Evidence: `ops/OPS_REVIEW_DASHBOARD.json`, `/admin/topic-production`

### WBS-4 Lesson package assets

Acceptance: Each launch topic has slide deck, study guide, visuals, quiz, citations, and learner-safe package data.

Evidence: `ops/NEXT_ASSET_APPROVAL_PACKET.md`, `ops/VISUAL_REVIEW_PACKET.md`

### WBS-5 No-spend visual decision gate

Acceptance: No spend/media queue opens while visual decision is pending.

Evidence: `ops/VISUAL_DECISION_TEMPLATE.md`, `ops/OPS_REVIEW_DASHBOARD.json`

### WBS-6 Airtable viral shorts handoff

Acceptance: Only approved topics enter the shorts tracker; no batch production runs before review.

Evidence: `ops/OPS_REVIEW_DASHBOARD.json`, `phase_3_shorts_airtable_handoff queue`

### WBS-7 Calendar and Drive operating record

Acceptance: Hourly cadence, work log, and review artifacts are ready for Calendar/Drive sync.

Evidence: `ops/HOURLY_CADENCE.ics`, `ops/HOURLY_CADENCE.md`, `ops/WORK_LOG.md`

### WBS-8 Deployment and source control

Acceptance: Build gates pass, commit is pushed, and live smoke confirms deployable launch surface.

Evidence: `git main`, `production build`, `ops/OPS_REVIEW_HISTORY.jsonl`

## Next Action

Review VISUAL_DECISION_TEMPLATE and choose approve_visual_planning, needs_revision, or hold_no_spend.
