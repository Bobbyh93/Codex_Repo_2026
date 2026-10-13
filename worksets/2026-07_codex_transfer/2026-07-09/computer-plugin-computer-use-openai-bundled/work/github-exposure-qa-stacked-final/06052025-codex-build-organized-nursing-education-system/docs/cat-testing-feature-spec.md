# CAT Testing Feature Specification

## Purpose

Build the CAT testing feature as the assessment engine for the Harrity nursing education platform. The feature must connect item delivery, concept diagnosis, remediation, and educator readiness controls.

## Current Prototype

The runnable prototype lives at:

- `packages/nursing-education-platform/public/index.html`

It demonstrates:

- NCLEX-RN client-needs category mapping
- CAT-style next-item selection by blueprint gap and difficulty match
- Ability estimate changes after each response
- Result summary, weak concepts, remediation plan, and review queue
- Local attempt history in browser storage
- Cross-session exposure prevention for recently delivered items
- Configurable stopping rules for fixed length, mastery threshold, stable estimate, and eligible-pool exhaustion
- Session evidence export as JSON
- Educator gates, exposure readiness, and blueprint coverage matrix

## Current Implementation Structure

- `public/data.js`: seeded NCLEX blueprint categories, build path, and sample item bank.
- `public/cat-engine.js`: deterministic CAT selector, scoring, stopping, remediation, export, exposure, gate, and coverage functions.
- `public/storage.js`: local attempt save/load/clear helpers used by the browser prototype.
- `public/app.js`: browser rendering and interaction state.
- `public/index.html`: dependency-free app shell and styles.
- `test/cat-engine.test.mjs`: deterministic CAT engine, stopping-rule, and exposure-control regression checks.
- `test/storage.test.mjs`: browser-storage normalization and persistence checks.
- `test/run-tests.mjs`: package test runner.

## Required Production Entities

- `Learner`
- `CATSession`
- `CATResponse`
- `AssessmentItem`
- `Concept`
- `LearningObjective`
- `MicroLesson`
- `BlueprintCategory`
- `RemediationAssignment`
- `ItemExposureRecord`

## Item Metadata Contract

Every scored item should include:

- Stable item ID
- Status: draft, review, approved, retired
- NCLEX client-needs category
- Clinical judgment step
- Primary and secondary concept IDs
- Lesson/remediation IDs
- Difficulty estimate
- Item format
- Correct response and scoring rule
- Correct and incorrect rationales
- Misconception tags
- Source/evidence reference

## CAT Engine Requirements

The engine should:

1. Start from a learner ability estimate or diagnostic default.
2. Select only approved items eligible for the learner and session scope.
3. Avoid repeat exposure according to configured lookback rules.
4. Balance blueprint coverage against ability/difficulty match.
5. Update ability and concept-level mastery after each response.
6. Stop based on configured rules: max items, precision threshold, mastery threshold, or exhaustion of eligible pool.
7. Emit a session evidence object for analytics and educator review.

## Remediation Requirements

After each session, the system should:

- Identify missed concepts and misconception tags.
- Rank remediation by clinical risk, miss frequency, blueprint weight, and retention risk.
- Assign the smallest useful set of micro-lessons.
- Schedule targeted retest using alternate eligible items.
- Promote mastery only after successful re-demonstration.

## Educator Controls

The educator/control-plane view should show:

- Item-bank depth by NCLEX category
- Items missing concepts, lessons, rationales, or scoring metadata
- Weak/high-risk concepts by learner and cohort
- Item exposure and repeat-use warnings
- Distractor performance and item retirement candidates

## Non-Goals For The Prototype

The prototype does not claim:

- Official NCLEX scoring equivalence
- Psychometric calibration
- Secure exam delivery
- Production persistence
- LMS integration

## Completed Engineering Slices

- Moved embedded sample data into `public/data.js`.
- Moved CAT selection, scoring, gates, remediation, and export logic into `public/cat-engine.js`.
- Added deterministic engine tests with `npm test`.
- Kept the browser workflow dependency-free and runnable through `npm run dev`.
- Added local attempt save/load/clear through `public/storage.js`.
- Added cross-session item exposure prevention based on recent attempts.
- Added attempt history and exposure-readiness UI to the practice and control-plane views.
- Added storage and exposure regression tests to the package test runner.
- Added fixed-length, mastery-threshold, stable-estimate, and eligible-pool exhaustion stopping rules.
- Added stopping evidence to session export and saved attempt records.

## Next Engineering Slice

1. Add durable backend persistence for learners, CAT sessions, responses, and item exposure records.
2. Add educator item import validation for the metadata contract.
3. Add concept-level mastery estimates and remediation assignment status.
4. Add cohort analytics and role-aware instructor/learner dashboards.
5. Add LMS/export integration boundaries for institution pilots.
