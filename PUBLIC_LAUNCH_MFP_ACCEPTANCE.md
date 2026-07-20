# NurseStudy Public Launch MFP Acceptance

Date: July 3, 2026

## Accepted Internal Pilot Baseline

The internal pilot is accepted as the baseline for public-launch MFP work. Do not rebuild the pilot loop unless one of these acceptance checks fails.

- Live app: `https://nursestudy-lesson-builder.onrender.com/`
- Accepted internal-pilot baseline commit: `473adb7`
- Public MFP entry commit: `105b71a`
- Student Learning Interface commit: `5438f58`
- Student Study Workspace v1 commit: pending current build
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

Public launch is now student-learning first plus the protected admin workflow. It is not a signup-first sales funnel and it is not a full public student account platform.

Included:

- Student-facing NurseStudy home at `/`, with a published-lesson library, featured lesson, topic filters, guided-notes/practice/citation signals, and links into `/lessons/:id`.
- Anonymous student study workspace with browser-session progress, saved lessons, completed lessons, practice attempt counts, feedback counts, `/student/progress`, and `/student/study-pack`.
- Pilot request capture remains available as optional operations support at `/pilot-request` and `/public-launch`, with admin-only review at `/admin/pilot-requests`.
- Deploy/version proof endpoint.
- Protected admin workflow: Knowledge Base/source intake -> Content Import -> Content Mapper -> Lesson Builder -> QA/export/publish.
- Learner assignment dashboard and published lesson view.
- Pilot outcomes and evidence exports.

Core student-facing product direction:

- Nursing students now enter through a learning interface: lessons, guided notes, quizzes, rationales, citations, progress-friendly lesson structure, and source-backed study materials.
- The creator/operator backend can continue to organize Data Chunker output, decks, videos, source catalogs, and guides, but those workflows should remain behind admin controls.
- Public learner APIs are available at `/api/student/home`, `/api/student/lessons`, `/api/student/lessons/:id/summary`, `/api/student/progress?sessionId=...`, and `/api/student/study-pack?sessionId=...`, and they expose only published learner-safe package data.

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
- `/` loads the student-facing NurseStudy home, not the pilot signup page.
- `/api/student/home` returns featured published lesson data.
- `/api/student/lessons` returns only published learner-safe lesson summaries.
- `/api/student/progress?sessionId=...` reflects anonymous opened, saved, practice, completed, and feedback events.
- `/api/student/study-pack?sessionId=...` compiles guided notes, practice rationales, and citations for saved/opened/completed lessons.
- `/student/progress` and `/student/study-pack` render without admin controls on desktop and mobile.
- `/api/public/launch-interest` still creates a lead from the secondary pilot request page.
- `/admin/pilot-requests` lets an admin qualify, note, follow up, and export public MFP requests without exposing learner assignment keys.
- `/admin/lesson-builder`, `/admin/content-import`, and `/admin/content-mapper` remain protected and reachable after admin login.
- Learner assignment and `/lessons/:id` routes remain learner-facing.
- Production build and focused smoke pass.
- Full TypeScript debt is either fixed for launch surfaces or documented as non-blocking legacy debt.
