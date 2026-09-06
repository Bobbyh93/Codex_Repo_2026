# Nursing Education Platform

CAT Testing Studio is the first runnable product surface for the Harrity nursing education platform.

It is designed around three product loops:

1. Assess learners with NCLEX-aligned adaptive practice.
2. Map every response to concepts, lessons, rationales, and client-needs categories.
3. Convert missed concepts into focused remediation and educator visibility.

## Run Locally

```shell
npm run dev
```

Open `http://127.0.0.1:8765`.

No package install is required for the current prototype because the app is dependency-free HTML, CSS, and JavaScript.

## Test The CAT Engine

```shell
npm test
```

The deterministic tests verify the default four-item adaptive path, ability updates, session export, weak-concept detection, readiness gates, blueprint coverage matrix, cross-session exposure control, stopping rules, and local attempt storage.

## Current Surface

- CAT Practice: starts adaptive practice from the approved item pool.
- Stopping Rules: supports fixed length, mastery threshold, stable estimate, and eligible-pool exhaustion stops.
- Attempt History: saves recent local attempts and shows exposure-control status.
- Exposure Controls: withholds recently delivered items from the next CAT session.
- Results: shows score, ability estimate, weak concepts, remediation, coverage, and review queue.
- Export: exposes session evidence as JSON, including withheld exposure item IDs and final stopping evidence.
- Content Map: shows item-to-concept-to-lesson mapping.
- Control Plane: shows mapping gates, exposure readiness, and blueprint category depth.

## Code Organization

- `public/index.html`: app shell, layout, and styles.
- `public/app.js`: browser UI rendering and interaction state.
- `public/cat-engine.js`: CAT selection, scoring, stopping, remediation, export, gate, exposure, and coverage logic.
- `public/data.js`: NCLEX blueprint, build path, and seeded item bank.
- `public/storage.js`: browser-safe local attempt persistence helpers.
- `test/cat-engine.test.mjs`: deterministic engine and exposure-control checks.
- `test/storage.test.mjs`: local attempt storage checks.
- `test/run-tests.mjs`: package test runner.

## Product Boundary

This is a CAT-style simulator for nursing education product development. It is not an official NCLEX scoring engine.

Attempt history currently uses browser local storage. Production learner records, audit trails, secure delivery, and item exposure analytics still need durable backend persistence.

## Next Engineering Work

- Add durable learner/session persistence behind the current local attempt model.
- Add educator item authoring/import validation.
- Add cohort analytics and remediation assignment workflow.
- Add role-aware instructor and learner dashboards.
