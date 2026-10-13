# CAT Slice Migration Assessment

**Question:** what to do with the Computer Adaptive Testing work sitting in `2026-07-09\computer-plugin-computer-use-openai-bundled\outputs\harrity-lesson-builder-codex\`, which `Codex_Repo_2026\PRODUCT_CONSOLIDATION_LOG.md` names as "the major missing product capability."

**Date:** 2026-09-06
**Method:** read-only comparison of the CAT slice against `Codex_Repo_2026`. Nothing was executed, no repo file was modified. Two external facts were verified by web search; see §6.

---

## 0. The repo moved while this was idle — read this first

The local checkout of `Codex_Repo_2026` is **6 commits behind `origin/main`**. Work resumed on 2026-09-05 and 2026-09-06:

| Date | Commit | Subject |
|---|---|---|
| 2026-09-06 | `e9ef531` | Add validate_lesson_json.py for lesson draft QA |
| 2026-09-06 | `993909e` | Add drafts/ scaffolding for autonomous Claude-authored lesson drafts |
| 2026-09-06 | `1a97a04` | Add missing JWT_SECRET to render.yaml |
| 2026-09-05 | `533dd36` | Bound the /health database probe with a timeout (#9) |
| 2026-09-05 | `51989e7` | Let the real health check own /health (#8) |
| 2026-09-05 | `2750384` | Fix TypeScript errors across server and client (#7) |

Two things follow.

**The 2026-08-27 inventory is now partly stale.** `#7` addresses TypeScript errors across server and client, which likely reduces or clears the 315 legacy diagnostics that inventory recorded as debt. The `/health` and `JWT_SECRET` commits are Render deployment work, which was the stop point that inventory named. Re-check both before relying on those findings.

**This assessment is not affected.** None of the six commits touch any file it depends on — `shared/nclex-rn-2026.ts`, `state/`, `client/src/lib/mvp-navigation.tsx`, `server/directed-remediation-engine.ts`, or `curriculum_exports/` are all unchanged across `main..origin/main`. Pull before acting on §7 anyway, so the work package lands on current state.

Also new and worth noting: `drafts/QUEUE.json` and `drafts/README.md` establish a queue for autonomous lesson drafting, and `scripts/validate_lesson_json.py` validates its output. That is a second content-production path alongside the exemplar generator, and a CAT item pool would eventually need to know which one owns item authorship.

## Verdict

**Migrate the logic. Do not migrate the data.**

The slice's value is its adaptive-testing *machinery* — the selector, the ability update, the eight readiness gates, the session model, and a working prototype that already passed two recorded QA runs. That machinery does not exist anywhere in the repo.

Its data files are a different story: the blueprint is a duplicate of an authority the repo already holds, and the sample item bank is four hand-written rows next to a repo that already generates 120. Importing either would create a second source of truth for the same facts.

There is also a blocker neither artifact makes obvious, and it is the real work: **the repo's existing item pool cannot drive a CAT engine as it stands.**

---

## 1. What the slice actually contains

| Artifact | Size | Assessment |
|---|---|---|
| `CAT_FEATURE_SPEC.md` | 6.3 KB | Complete and well-scoped. Users, MVP flow, item and session data models, selector algorithm, ability update, stop rules, eight control-plane gates, screens, first tasks, acceptance criteria. Explicitly disclaims replicating official NCLEX scoring. |
| `standalone/cat-testing.html` | 67 KB | A working single-file prototype. Implements `selectNextItem`, `updateAbility` (as `clamp`/`advanceItem`), `evaluateGates`, results, remediation plan, ability trend, coverage bars, and an educator coverage matrix. |
| `nclex-rn-2026-blueprint.json` | 2.8 KB | Source-cited blueprint. **Duplicates the repo — see §2.** |
| `item-bank.schema.json` | 3.5 KB | JSON Schema for the item bank. Genuinely useful; the repo has no equivalent contract. |
| `sample-item-bank.json` | 6 KB | 4 approved items, one per major category, fully mapped. Useful as test fixtures, not as content. |
| `EXECUTION_LOG.md` | 3 KB | Two recorded QA runs (2026-07-09 smoke, 2026-07-10 product slice) with observed results, a mobile viewport check, and one fix applied during execution. |
| `INTEGRATION_BRIEF.md`, `NURSING_ED_PLATFORM_FOCUS.md`, `chatgpt-artifact/App.tsx` | — | Provenance and the original TTS payload-builder artifact, unrelated to CAT. |
| `outputs/*.png` | 8 files | QA screenshots: item validation, persistence (3), stopping rules, desktop and mobile. |

The prototype is not a sketch. The execution log records a 4-item adaptive session ending at ability estimate `1.08`, seven passing gates, a nine-row coverage matrix, JSON session export, and no console errors at a 390×844 viewport.

---

## 2. The blueprint is already in the repo

`Codex_Repo_2026\shared\nclex-rn-2026.ts` exports `NCLEX_CATEGORIES` with all eight client-needs categories. Every range and midpoint matches the slice's JSON exactly:

| Category | Repo `blueprintRange` / `Weight` | Slice `minPercent`–`maxPercent` / `midpoint` |
|---|---|---|
| Management of Care | [15, 21] / 18 | 15–21 / 18 |
| Safety and Infection Prevention and Control | [10, 16] / 13 | 10–16 / 13 |
| Health Promotion and Maintenance | [6, 12] / 9 | 6–12 / 9 |
| Psychosocial Integrity | [6, 12] / 9 | 6–12 / 9 |
| Basic Care and Comfort | [6, 12] / 9 | 6–12 / 9 |
| Pharmacological and Parenteral Therapies | [13, 19] / 16 | 13–19 / 16 |
| Reduction of Risk Potential | [9, 15] / 12 | 9–15 / 12 |
| Physiological Adaptation | [11, 17] / 14 | 11–17 / 14 |

The same file exports `NCJMM_FUNCTIONS` with the six clinical judgment steps the slice also lists.

**Consequence:** committing `nclex-rn-2026-blueprint.json` would create two places to update when NCSBN publishes the next test plan. Derive the CAT blueprint from `NCLEX_CATEGORIES` instead.

**Two adapters are needed**, because the representations differ:

| | Repo | Slice |
|---|---|---|
| Category identity | flat kebab-case id — `"physiological-adaptation"` | category + subcategory pair — `"Physiological Integrity"` / `"Physiological Adaptation"` |
| NCJMM step | Title Case — `"Recognize Cues"` | snake_case — `"recognize_cues"` |

The slice's shape is closer to the published test plan and is the better external contract; the repo's is the better internal key. Keep both, with one documented mapping.

---

## 3. The repo already has an item bank — and it cannot drive CAT

`shared/nclex-rn-2026.ts` holds 8 exemplar topics, one per category, each with 5 `ClinicalFact` entries (cue, action, rationale, three distractors, source id, locator). `buildAssessmentItems()` turns each topic into 15 items and `buildClinicalJudgmentCase()` into 6. `curriculum_exports/nclex-rn-2026/execution-status.json` confirms the totals: **120 assessment items, 48 clinical judgment items, 24 objectives, 8 evidence sources**, already exported to `qti-exemplar-bank.xml` (120 `<assessmentItem>` elements).

That is a real bank. But three properties of the generator make it unusable as an adaptive item pool:

1. **The correct answer is always option A.** `buildAssessmentItems` emits `{ id: "A", text: fact.action }` first and sets `correctAnswer: "A"` for every item. A learner pattern-matches this within a handful of items, and every difficulty and discrimination estimate derived from responses becomes meaningless.
2. **All 40 facts share one distractor triple.** Every `ClinicalFact` in the file uses `distractors: sharedDistractors` — the same three strings ("Delay action until the end of the shift", "Document the finding without reassessment or follow-up", "Delegate the clinical judgment decision to unlicensed assistive personnel"). Verified: 40 uses of `sharedDistractors`, and the only other occurrence of the field name is the `ClinicalFact` interface declaration at line 57. **No fact in the file carries its own distractors.**
3. **Difficulty is categorical, not numeric.** The generator sets `difficulty: contextIndex === 0 ? "application" : "analysis"` — two string values. The CAT selector needs a number in −3…+3 to choose the item closest to the current ability estimate.

A fourth issue is subtler: the generator multiplies 5 facts into 15 items using three context phrases ("During the initial assessment", "While reviewing the care plan", "During a change-of-condition reassessment"). The three variants of a fact are near-identical. A selector that treats them as independent will show a learner the same clinical scenario three times and record it as three units of blueprint coverage.

**None of this is a defect in the repo.** These items were built for a linear exemplar package with an 85% mastery check, where a fixed distractor set is a reasonable placeholder and a categorical difficulty is enough. CAT simply has different requirements. But it means the migration's real cost is item-pool work, not porting `selectNextItem`.

---

## 4. Where CAT results should land

`server/directed-remediation-engine.ts` already converts performance into remediation. It consumes `PerformanceSignal { objectiveId, topicId, score, confidence, observedAt, frequency?, sourceKind }` where `sourceKind` already includes `"quiz"`, and produces bands `foundational_intensive` / `targeted_remediation` / `focused_reinforcement` / `mastered` against an 85% threshold, weighted by topic `safetyRisk`.

The CAT prototype builds its own remediation plan from missed concepts. **Do not port that.** Emit `PerformanceSignal` records with `sourceKind: "quiz"` and let the existing engine produce the plan — otherwise the platform ends up with two remediation algorithms that disagree, and `REMEDIATION_ALGORITHM_VERSION` stops meaning anything.

---

## 5. Item formats: a gap worth closing early

The slice's schema allows `single_choice`, `multiple_response`, `matrix`, `bowtie`, `case_study`. NCSBN currently lists five item types measuring clinical judgment: Extended Multiple Response, Extended Drag and Drop, Cloze, Enhanced Hot Spot, and Matrix/Grid.

Overlap is partial. The schema has no cloze, enhanced hot spot, or extended drag and drop. That is acceptable for an MVP that ships `single_choice` only, but the enum should be widened at the schema level now rather than after items exist, because item format is the hardest field to migrate later.

---

## 6. External verification

Two claims in the slice's blueprint were checked against sources outside this workspace, because both the slice and the repo assert them — so an error would be duplicated in two places rather than caught by comparing them.

**Verified correct:**

- All eight client-needs percentage ranges, exactly as tabulated in §2.
- Test plan effective April 2026, on the three-year NCSBN cycle (so the slice's `effectiveStart` 2026-04-01 / `effectiveEnd` 2029-03-31 is consistent).
- `examLength.minItems: 85` and `maxItems: 150` — NCSBN states the minimum is 85 and the maximum is 150.

**Not verified — treat as unconfirmed until read off the official PDF:**

- `timeLimitHours: 5`
- `pretestItems: 15`
- `minimumLengthScoredContentItems: 52`
- `minimumLengthClinicalJudgmentCaseStudyItems: 18`
- `caseStudySetsAtMinimumLength: 3`, `itemsPerCaseStudy: 6`, `approximateStandaloneClinicalJudgmentItemPercent: 10`

The stop rules depend on the first four. The blueprint already cites the source PDF at `https://www.nclex.com/files/2026_RN_Test%20Plan_English-F.pdf`; one read confirms or corrects all of them.

---

## 7. Recommended disposition

1. **Adopt the work package** `HLB-CAT-040` (delivered alongside this file) into `state/work_queue.json` at priority 4 — after the credential-blocked TTS and pilot packages, before the SkillBridge integration package at priority 10.
2. **Copy into the repo:** `CAT_FEATURE_SPEC.md` → `docs/`, and `item-bank.schema.json` → `shared/` as the basis for `cat-item-schema.ts`. Keep `sample-item-bank.json` as a test fixture.
3. **Do not copy:** `nclex-rn-2026-blueprint.json` (derive from `NCLEX_CATEGORIES` instead), and the prototype's remediation plan builder (use `directed-remediation-engine.ts`).
4. **Keep the prototype** `standalone/cat-testing.html` as an executable specification — it is faster to check a selector's behaviour against a running reference than against prose. Park it under `docs/prototypes/`.
5. **Then** the `2026-07-09` folder is safe to prune: its `work/` subfolder holds nine near-duplicate clones of one repo from successive browser-QA iterations, 719 files, of which only the final iteration is worth keeping.

If the answer is instead to retire the CAT slice, say so explicitly and record it — the item-pool findings in §3 stay valid regardless, because they describe the repo's own generator, not the prototype.

---

## 8. Assumptions

1. Read-only. No repo file was modified and nothing was executed. The local working tree is clean but **6 commits behind `origin/main`** — see §0.
2. Item and category counts come from `curriculum_exports/nclex-rn-2026/execution-status.json` (generated 2026-07-20) and from reading `shared/nclex-rn-2026.ts` directly. They were not recomputed by running the generators.
3. The claim that CAT logic does not already exist in the repo is based on the absence of any `lib/cat` path, any CAT route in `client/src/lib/mvp-navigation.tsx`, and `PRODUCT_CONSOLIDATION_LOG.md` naming CAT as the missing capability. A full-text search of the repo timed out against the mounted filesystem and was not completed.
4. Effort is not estimated here. The item-pool rebuild in §3 dominates it, and its size depends on a decision that is not mine: whether to author real distractors per fact or to accept a smaller, hand-built CAT pool separate from the exemplar bank.
5. External facts in §6 were verified 2026-09-06 against UWorld's test plan page and NCSBN's own format article. The four unverified fields were not found in either source.
