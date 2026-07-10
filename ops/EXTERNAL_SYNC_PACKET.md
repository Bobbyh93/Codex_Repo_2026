# External Sync Packet

Generated: 2026-07-10T07:30:29.750Z
Mode: local_sync_packet
Live app: https://nursestudy-lesson-builder.onrender.com

## Drive

- Project: NursePrep Platform Development
- Project ID: 1c0Ayvgi8Av0c8M4SdOrwvHGhieXz553k
- Status: held_unverified_destination
- Destination verified: no
- Rule: Do not upload or replace Drive files until the destination is explicitly verified and approved.

## Calendar

- Timezone: America/Los_Angeles
- First cycle date: 2026-07-10
- Event count: 6
- Import file: `ops/HOURLY_CADENCE.ics`
- Status: ready_for_import_or_connector_create

## Current Launch State

- Failed checks: 0
- Total topics: 77
- Needs mapping: 0
- Needs assets: 74
- Spend guard: ok
- Current topic: Contraception priority cues and patient teaching
- Current decision: pending
- WBS packages: 8

## Files For Sync

| File | Exists | Bytes | Target | Purpose |
| --- | --- | ---: | --- | --- |
| `ops/OPS_REVIEW_DASHBOARD.md` | yes | 1123 | Google Drive | Single-file hourly review status |
| `ops/OPS_REVIEW_DASHBOARD.json` | yes | 4181 | Google Drive | Machine-readable hourly review status |
| `ops/LAUNCH_WBS.md` | yes | 3571 | Google Drive | Human-readable WBS with evidence map |
| `ops/LAUNCH_WBS.json` | yes | 4668 | Google Drive | Machine-readable WBS |
| `ops/HOURLY_CADENCE.md` | yes | 1198 | Google Drive | Human-readable hourly schedule |
| `ops/HOURLY_CADENCE.json` | yes | 1932 | Google Drive | Machine-readable hourly schedule |
| `ops/HOURLY_CADENCE.ics` | yes | 3769 | Google Calendar | Calendar import file with six work blocks |
| `ops/WORK_LOG.md` | yes | 24469 | Google Drive | Append-only work log |
| `ops/NEXT_ASSET_APPROVAL_PACKET.md` | yes | 5241 | Google Drive | No-spend asset approval packet |
| `ops/VISUAL_REVIEW_PACKET.md` | yes | 2858 | Google Drive | Visual review plan packet |
| `ops/VISUAL_DECISION_TEMPLATE.md` | yes | 1715 | Google Drive | Reviewer decision capture template |
| `ops/BROWSER_QA_PACKET.md` | yes | 2439 | Google Drive | Browser route QA checklist and guardrails |
| `ops/BROWSER_QA_PACKET.json` | yes | 3206 | Google Drive | Machine-readable browser QA route matrix |

## Calendar Events

| Event | Start | Duration | Budget | Command |
| --- | --- | ---: | ---: | --- |
| NurseStudy: Health check and launch queue triage | 2026-07-10 09:00 America/Los_Angeles | 25 min | $50 | `npm run ops:hourly-check` |
| NurseStudy: Asset approval packet | 2026-07-10 10:00 America/Los_Angeles | 45 min | $100 | `npm run ops:asset-packet` |
| NurseStudy: Package build packet | 2026-07-10 11:00 America/Los_Angeles | 45 min | $100 | `npm run ops:visual-packet` |
| NurseStudy: QA/export check | 2026-07-10 12:00 America/Los_Angeles | 25 min | $50 | `npm run ops:review-dashboard` |
| NurseStudy: Airtable/shorts tracker packet | 2026-07-10 13:00 America/Los_Angeles | 45 min | $100 | `npm run ops:visual-decision` |
| NurseStudy: Log, Drive sync, next queue | 2026-07-10 14:00 America/Los_Angeles | 25 min | $50 | `npm run ops:hourly-run` |

## Exclusions

- .env
- database dumps
- learner private data
- admin session data
- raw API keys or service credentials
- paid media outputs generated without approval

## Next Action

Verify the Drive destination, then approve the exact files/events before connector writes.
