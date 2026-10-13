# Harrity Nursing Education Platform

This branch is being organized around a nursing education product system for NCLEX-aligned testing, review learning, content mapping, and CAT-style adaptive practice.

## Product Direction

The platform connects four workstreams into one coherent system:

- **CAT testing:** adaptive nursing practice that selects items by blueprint category, concept tags, and difficulty.
- **Review learning:** every missed item routes to rationales, weak concepts, and focused remediation.
- **Content mapping:** lessons, concepts, items, and NCLEX client-needs categories stay traceable.
- **Educator controls:** item-bank depth, mapping quality, and pilot-readiness gates are visible before scaling.

## What Is In This Branch

- `docs/nursing-education-information-system.md` defines the product backbone, data model, CAT operating model, and pilot sequence.
- `packages/nursing-education-platform/` contains the first runnable web product surface: CAT Testing Studio.
- Existing package folders from the source template remain in the repository, but this branch's product focus is the nursing education platform.

## Run The CAT Studio Prototype

From the repository root:

```shell
cd packages/nursing-education-platform
npm run dev
```

Then open:

```text
http://127.0.0.1:8765
```

The prototype is dependency-free and uses local sample data embedded in the page.

## Current CAT Studio Capabilities

- Start a four-item adaptive smoke-test session.
- Select items by under-covered NCLEX-RN client-needs category and difficulty match.
- Track score, ability estimate, blueprint coverage, and ability trend.
- Generate a remediation plan from weak concepts and linked lesson IDs.
- Export session evidence as JSON for instructor review or future analytics.
- Inspect educator readiness gates and category-depth coverage.

## Prototype Boundary

This is an educational CAT-style simulator and product prototype. It does not claim official NCLEX scoring equivalence, psychometric calibration, or production exam readiness.

## Next Build Priorities

1. Persist attempts, learner profiles, and remediation assignments.
2. Add item exposure controls and repeat-item prevention across sessions.
3. Add stopping rules for precision, max items, and mastery thresholds.
4. Build educator item authoring/import with required concept, lesson, rationale, and blueprint mapping.
5. Connect cohort analytics to weak concepts, misconceptions, and category readiness.
