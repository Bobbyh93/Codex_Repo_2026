# Hourly Cadence Export

Generated: 2026-07-10T07:20:04.368Z
Timezone: America/Los_Angeles
First cycle date: 2026-07-10
Live app: https://nursestudy-lesson-builder.onrender.com

Use this file with `ops/HOURLY_CADENCE.ics` to keep the launch work in small, reviewable, no-spend packets.

| Time | Job | Budget cap | Command | Output |
| --- | --- | ---: | --- | --- |
| 09:00 | Health check and launch queue triage | $50 | `npm run ops:hourly-check` | Live status note with queue counts |
| 10:00 | Asset approval packet | $100 | `npm run ops:asset-packet` | 1-2 rows approved or held with reason |
| 11:00 | Package build packet | $100 | `npm run ops:visual-packet` | 1 student-ready draft package or visual/study-guide packet |
| 12:00 | QA/export check | $50 | `npm run ops:review-dashboard` | Smoke result and issue list |
| 13:00 | Airtable/shorts tracker packet | $100 | `npm run ops:visual-decision` | Tracker rows or sync contract |
| 14:00 | Log, Drive sync, next queue | $50 | `npm run ops:hourly-run` | Updated work log and next packet |

## Guardrail

Do not open next-spend, shorts, media work-order, student-launch, or publish queues while the current visual decision remains pending.
