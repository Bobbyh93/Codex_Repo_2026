# Nursing Education Platform Focus

Date focused in Codex: 2026-07-09

## Product Direction

Build the existing Harrity nursing education work into a testing, review, learning, and content-mapping platform for nursing education. The product should connect four things that are usually fragmented:

1. Learning content: lessons, slides, scripts, rationales, study guides, and review modules.
2. Test items: standalone items, NGN case-study items, item metadata, scoring rules, and psychometric fields.
3. Concept map: nursing concepts, clinical judgment steps, client needs categories, body systems, conditions, interventions, medications, and safety risks.
4. NCLEX blueprint: current NCLEX-RN test plan distribution, clinical judgment requirements, CAT-style adaptive delivery, and performance reporting.

The current imported web app work is the first production surface for lesson/audio generation. The next build should add the CAT testing feature as the first assessment surface.

## Current Codex Assets

- `chatgpt-artifact/App.tsx`: imported React/TypeScript artifact for the Slide Audio Builder.
- `standalone/index.html`: runnable dependency-free local preview of the Slide Audio Builder.
- `INTEGRATION_BRIEF.md`: backend/control-plane gate notes from the ChatGPT conversation.

Current value:

- Proves a usable lesson-building interface.
- Establishes typed payload discipline.
- Adds a guardrail against prompt/instruction leakage into learner-facing narration.
- Records the control-plane gate rule that lesson generation should be blocked when source inventory, taxonomy, ingest queue, or QA artifacts are missing.

## Platform Modules

### 1. Content Studio

Purpose: build and QA learning assets.

Core screens:

- Lesson Builder
- Slide Audio Builder
- Script QA
- Source Inventory
- Taxonomy Gate Status
- Lesson-to-Concept Mapping

Outputs:

- `lesson.json`
- `slides/*.json`
- `audio_payloads/*.json`
- `taxonomy/lesson_ingest_queue.json`
- `status/*.json`

### 2. Item Bank

Purpose: author, import, classify, and validate test items.

Core screens:

- Item Authoring
- Item Review
- Blueprint Mapping
- Rationales
- Case Study Builder
- Psychometric Metadata

Each item should map to:

- NCLEX client needs category and subcategory
- Clinical judgment step when applicable
- Nursing concept
- Content source
- Lesson or module
- Difficulty estimate
- Discrimination estimate when available
- Item format
- Scoring model
- Rationale and remediation links

### 3. CAT Testing

Purpose: deliver adaptive NCLEX-style practice exams and mastery diagnostics.

Core screens:

- Start Assessment
- Exam Player
- Adaptive Progress Monitor
- Review Results
- Remediation Plan
- Blueprint Coverage Report

The first version should be CAT-like and simulation-ready, not a claim of official NCLEX equivalence.

### 4. Review Learning

Purpose: turn assessment misses into targeted learning.

Core screens:

- Weak Concepts
- Missed Rationales
- Clinical Judgment Step Gaps
- Related Lessons
- Spaced Review Queue

This is where the product becomes more valuable than a question bank: every test result should create a learning path.

### 5. Control Plane

Purpose: enforce data quality before generation, testing, or reporting.

Core screens:

- Control Plane Gates
- Data Coverage
- Missing Mapping
- Status Artifacts
- Build/Run History

Required gates:

- Content source present
- Lesson mapped to concepts
- Items mapped to NCLEX blueprint
- Items mapped to clinical judgment steps where required
- Rationales present
- Item scoring metadata valid
- CAT item pool coverage sufficient
- Final QA artifacts present

## Source-Backed NCLEX Blueprint Anchors

Official NCLEX source pages checked:

- NCLEX Test Plans page: `https://www.nclex.com/test-plans.page`
- 2026 NCLEX-RN Test Plan PDF: `https://www.nclex.com/files/2026_RN_Test%20Plan_English-F.pdf`
- NCLEX CAT page: `https://www.nclex.com/computerized-adaptive-testing.page`
- NCJMM page: `https://www.nclex.com/clinical-judgment-measurement-model.page`

Current RN test plan:

- Effective: April 1, 2026 through March 31, 2029.
- Test plans are updated every three years.
- Clinical judgment is measured through three six-item case-study sets at the minimum exam length, plus approximately 10% stand-alone clinical judgment items depending on exam length.
- RN candidate exam length is 85 to 150 items in five hours.
- Every RN exam includes 15 unscored pretest items.
- CAT item selection should consider blueprint fit, candidate ability estimate, and avoidance of repeat items for repeat candidates.

2026 NCLEX-RN client needs distribution:

| Category | Target Range |
|---|---:|
| Management of Care | 15-21% |
| Safety and Infection Prevention and Control | 10-16% |
| Health Promotion and Maintenance | 6-12% |
| Psychosocial Integrity | 6-12% |
| Basic Care and Comfort | 6-12% |
| Pharmacological and Parenteral Therapies | 13-19% |
| Reduction of Risk Potential | 9-15% |
| Physiological Adaptation | 11-17% |

For product use, store both the range and midpoint. Use the midpoint for default simulation, but validate item pools against the official range.

## First CAT Feature Slice

Build the CAT feature as a contained vertical slice:

1. Blueprint-aware item pool schema.
2. Seed item bank with a small number of sample items across client needs categories.
3. Exam session state machine.
4. Adaptive item selector.
5. Ability estimate and standard error placeholders.
6. Minimum/maximum length controls.
7. Clinical judgment case-study support.
8. Results page with concept remediation.

Do not overbuild psychometrics in the first pass. Implement clean seams for IRT parameters and simulations, but start with a deterministic prototype:

- difficulty: `-3` to `+3`
- discrimination: optional numeric value
- ability estimate: starts at `0`
- item selection: choose an unused item in the most under-covered blueprint category whose difficulty is closest to current ability
- update rule: correct increases estimate; incorrect decreases estimate; larger movement for harder/easier mismatches
- stop rule: prototype mode stops at configured length; simulation mode can later use confidence/standard-error rules

## Product Positioning

Working product sentence:

Harrity Nursing Education helps nursing programs and learners connect lessons, concepts, NCLEX blueprint expectations, test items, adaptive practice, and targeted review into one auditable learning system.

Valuable differentiator:

- Not just a lesson builder.
- Not just a question bank.
- Not just NCLEX practice.
- The value is the traceable map from learning content to concepts to test items to adaptive performance to remediation.

## Immediate Build Order

1. Add a `cat-blueprint.json` file using the 2026 RN test plan.
2. Add `item-bank.schema.json` with concept and blueprint fields.
3. Add a sample item bank with 12-20 items.
4. Build a CAT Exam Player page.
5. Build the item selector and exam session state.
6. Build the results/remediation view.
7. Add Control Plane Gates for item pool readiness.
8. Connect missed-item results back to lesson/audio/content assets.

## Non-Negotiable Guardrails

- Do not market the prototype as the official NCLEX or as psychometrically equivalent to NCLEX.
- Preserve source traceability for every learning and item artifact.
- Require blueprint mapping before an item can be used in CAT mode.
- Require rationales and remediation links before items can appear in learner-facing review.
- Treat generated content as draft until reviewed.
- Keep educator/admin audit screens visible, not hidden behind learner-only flows.
