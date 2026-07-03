# NurseStudy Public Launch MFP Acceptance

Date: July 3, 2026

## Accepted Internal Pilot Baseline

The internal pilot is accepted as the baseline for public-launch MFP work. Do not rebuild the pilot loop unless one of these acceptance checks fails.

- Live app: `https://nursestudy-lesson-builder.onrender.com/`
- Accepted commit: `473adb7`
- Live bundle observed: `assets/index-Ut4B9InS.js`
- Active pilot package: `bf472933-fdb6-4e67-b893-491c00c7bcd4`
- Pilot package title: `Therapeutic Communication Live AI MVP Release Smoke`
- MVP approval model: AI-reviewed `approved_for_pilot`; human/faculty review remains premium.

## Functional Pilot Capabilities

- Admin Lesson Builder includes the Pilot Launch Console.
- Official pilot source is approved, normalized, and connected to package generation.
- Lesson package supports slides, guided notes, practice item, citations, QA, contract validation, publish state, and Harrity export.
- Assignment dashboard is token-gated and learner-facing.
- Learner route opens published lessons without admin controls.
- Learner completion, practice activity, and feedback feed Pilot Outcomes.
- Pilot Evidence export supports JSON, Markdown brief, printable report, executive report, and slide outline.
- Content Import and Content Mapper are the canonical launch-path review surfaces for source-to-lesson preparation.

## Public Launch MFP Boundary

Public launch is a controlled product entry plus the protected admin workflow. It is not a full public student platform.

Included:

- Public launch page and pilot request capture.
- Deploy/version proof endpoint.
- Protected admin workflow: Knowledge Base/source intake -> Content Import -> Content Mapper -> Lesson Builder -> QA/export/publish.
- Learner assignment dashboard and published lesson view.
- Pilot outcomes and evidence exports.

Post-MFP:

- Full student accounts and dashboards.
- Email/SMS invites.
- LMS integration.
- ATI report auto-assignment.
- Full NursesBrain extraction/canonicalization engine.
- Marketplace or multi-tenant content approval.
- Broad Resources, Topics Queue, analytics, and generic admin suite completion.

## Supporting Systems

- Data Chunker Pro is the workstation preprocessing path for large PDF textbooks, manuals, and chapter sets before NurseStudy registration.
- Replit `NurseStudy` is a future source pattern for ATI report upload, weak-topic study plans, and progress tracking.
- `NursesBrain` is a future source pattern for robust extraction, table normalization, canonical schema processing, and CSV/JSON exports.
- Google Drive decks, ChatGPT project assets, Pearson dashboards, OpenStax, and OSF links are supporting references until reviewed and promoted through source approval.

## Next Acceptance Checks

- Render serves the accepted commit or newer public-launch commit.
- `/api/public/deploy-proof` returns environment, commit, service, and internal pilot acceptance.
- `/api/public/launch-interest` creates a lead from the public launch page.
- `/admin/lesson-builder`, `/admin/content-import`, and `/admin/content-mapper` remain protected and reachable after admin login.
- Learner assignment and `/lessons/:id` routes remain learner-facing.
- Production build and focused smoke pass.
- Full TypeScript debt is either fixed for launch surfaces or documented as non-blocking legacy debt.
