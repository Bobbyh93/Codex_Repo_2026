# Hourly Work Jobs

Purpose: keep NurseStudy development moving in small, reviewable packets with proof and low cost.

Timezone: America/Los_Angeles  
First scheduled cycle: Friday, 2026-07-10

## Default Daily Blocks

| Time | Job | Budget cap | Output |
| --- | --- | ---: | --- |
| 09:00-09:25 | Health check and launch queue triage | $50 | Live status note with queue counts |
| 10:00-10:45 | Asset approval packet | $100 | 1-2 rows approved or held with reason |
| 11:00-11:45 | Package build packet | $100 | 1 student-ready draft package or visual/study-guide packet |
| 12:00-12:25 | QA/export check | $50 | Smoke result and issue list |
| 13:00-13:45 | Airtable/shorts tracker packet | $100 | Tracker rows or sync contract |
| 14:00-14:25 | Log, Drive sync, next queue | $50 | Updated work log and next packet |

Daily soft cap: $450. Stop at $500 unless the next packet is explicitly approved.

## Hourly Job Template

Copy this into `WORK_LOG.md` after each work packet.

```text
### YYYY-MM-DD HH:MM PT - Job title

Budget cap:
Actual estimate:
WBS:
Scope:
Actions:
Evidence:
Result:
Next action:
Risks/blockers:
```

## Next 6 Packets

1. Live health plus admin topic-production verification.
2. Confirm the topic matrix still has `0` mapping gaps.
3. Review the first 1-2 `needs_assets` package rows and choose approve/hold before spending.
4. Confirm the approved row has a study guide, slide deck, visuals plan, quiz item, and citations.
5. Verify next-spend, Airtable shorts, media work-order, student launch, and publish-readiness queues.
6. Sync WBS/log artifacts to Drive and schedule the next daily cadence.

## Hourly Automation Coverage

`npm run ops:hourly-check` verifies the live app health, student home, admin login, topic-production matrix, and the non-mutating launch queues:

- next-spend polish queue
- Airtable/shorts workflow queue
- media work-order queue
- student-launch readiness queue
- final publish-readiness queue

An empty queue with HTTP `200` means no row has been explicitly approved for that next paid/review step yet; it is not a route failure.

`npm run ops:asset-packet` creates the no-spend approval packet:

- `ops/NEXT_ASSET_APPROVAL_PACKET.md`
- `ops/NEXT_ASSET_APPROVAL_PACKET.json`

This packet selects the first reviewable `needs_assets` rows, records missing assets, includes no-spend visual briefs, and gives the reviewer a direct topic-production URL. It does not approve rows, generate paid media, publish lessons, or mutate live data.

`npm run ops:visual-packet` creates the first focused visual review packet:

- `ops/VISUAL_REVIEW_PACKET.md`
- `ops/VISUAL_REVIEW_PACKET.json`

This packet turns the first selected approval row into a concrete visual plan with diagram type, visual elements, accessibility notes, and approve/revise/hold options. It is review-only and does not generate images or update live decisions.

`npm run ops:visual-decision` creates a local decision template:

- `ops/VISUAL_DECISION_TEMPLATE.md`
- `ops/VISUAL_DECISION_TEMPLATE.json`

This template records the pending approve/revise/hold choice for the current visual packet. It does not mutate the live app; the live `/admin/topic-production` decision should be recorded only after the reviewer chooses.

`npm run ops:review-dashboard` creates the single-file review dashboard:

- `ops/OPS_REVIEW_DASHBOARD.md`
- `ops/OPS_REVIEW_DASHBOARD.json`

This dashboard runs the live hourly check and summarizes the current asset packet, visual packet, decision template, and queue state. Use it as the first file to open during hourly review.

## Quality Gate Per Packet

Each packet must answer:

- What changed?
- Where is the proof?
- What did it cost?
- What is the next smallest useful move?
