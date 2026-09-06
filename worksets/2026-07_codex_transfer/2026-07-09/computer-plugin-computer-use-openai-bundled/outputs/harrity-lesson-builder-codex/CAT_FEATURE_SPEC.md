# CAT Testing Feature Spec

## Goal

Add a CAT-style nursing education assessment feature that uses the platform's mapped content and item bank to deliver adaptive practice, diagnose weak concepts, and create targeted review plans.

This feature should simulate core CAT logic for education and remediation. It should not claim to replicate the official NCLEX scoring engine.

## Users

- Nursing student: takes adaptive practice tests and receives targeted remediation.
- Faculty/educator: reviews cohort gaps, item performance, blueprint coverage, and learning-content alignment.
- Content builder: maps lessons and items to concepts, NCLEX categories, and clinical judgment steps.
- Admin: runs control-plane gates and verifies readiness.

## MVP User Flow

1. Student chooses `CAT Practice`.
2. Student selects scope:
   - full RN blueprint
   - a client needs category
   - a concept cluster
   - weak-area retest
3. System checks item pool readiness.
4. Student starts exam.
5. One item appears at a time.
6. Student answers and confirms.
7. System scores the item and chooses the next item.
8. Exam ends at configured prototype length.
9. Student sees:
   - estimated ability
   - blueprint coverage
   - strongest/weakest categories
   - missed concepts
   - rationales
   - linked lessons for remediation

## Required Data Model

### Item

```json
{
  "id": "ITEM-0001",
  "status": "approved",
  "stem": "A nurse is caring for...",
  "format": "single_choice",
  "options": [
    { "id": "A", "text": "..." },
    { "id": "B", "text": "..." }
  ],
  "correctResponse": ["B"],
  "scoring": {
    "method": "zero_one",
    "points": 1
  },
  "rationale": {
    "correct": "...",
    "incorrect": {
      "A": "..."
    }
  },
  "blueprint": {
    "exam": "NCLEX-RN",
    "testPlanYear": 2026,
    "clientNeedsCategory": "Physiological Integrity",
    "clientNeedsSubcategory": "Physiological Adaptation",
    "clinicalJudgmentStep": "recognize_cues"
  },
  "concepts": ["oxygenation", "priority-setting"],
  "lessons": ["LESSON-OXYGENATION-001"],
  "difficulty": 0.2,
  "discrimination": 1.0,
  "sourceRefs": ["SRC-0001"]
}
```

### Exam Session

```json
{
  "id": "CAT-SESSION-0001",
  "mode": "prototype",
  "userId": "USER-0001",
  "startedAt": "2026-07-09T00:00:00Z",
  "status": "in_progress",
  "abilityEstimate": 0,
  "standardError": null,
  "currentItemId": "ITEM-0001",
  "responses": [],
  "blueprintCoverage": {},
  "usedItemIds": []
}
```

## Adaptive Selector MVP

Inputs:

- item pool
- used item ids
- current ability estimate
- blueprint target distribution
- current blueprint coverage
- selected scope

Selection steps:

1. Remove used, inactive, draft, or unmapped items.
2. Filter by selected scope.
3. Identify the most under-covered blueprint category.
4. Within that category, choose the unused item closest to current ability estimate.
5. If no item is available, fall back to the next most under-covered category.
6. Record selection reason for audit.

Selection reason example:

```json
{
  "selectedItemId": "ITEM-0012",
  "reason": "under_covered_blueprint_category",
  "category": "Reduction of Risk Potential",
  "abilityEstimate": 0.4,
  "itemDifficulty": 0.3
}
```

## Ability Update MVP

Use a simple provisional update until calibrated IRT parameters are available:

- Correct answer: ability estimate increases.
- Incorrect answer: ability estimate decreases.
- Correct on a harder item increases more.
- Incorrect on an easier item decreases more.
- Clamp ability to `-3` through `+3`.

Later upgrade:

- 1PL/Rasch or 2PL IRT.
- Standard error tracking.
- Exposure control.
- Simulation validation.
- Confidence-based stopping.

## Stop Rules

Prototype:

- Stop at configured length: 20, 40, or 85 items.

Simulation:

- Stop after minimum item count when standard error is below threshold.
- Stop at maximum configured length.
- Stop if item pool readiness fails during session.

NCLEX-inspired future model:

- Minimum and maximum length support.
- 95% confidence classification simulation.
- Maximum-length classification.
- Run-out-of-time scenario support.

## Control-Plane Gates

CAT mode is blocked unless:

- Item pool has approved items.
- Every active item has blueprint mapping.
- Every active item has at least one concept tag.
- Every active item has correct answer/scoring metadata.
- Every active item has rationale text.
- At least one remediation lesson exists for every tested concept.
- Each tested category has sufficient item coverage for the selected exam length.
- Clinical judgment case-study items are grouped and sequenced correctly.

Blocked status artifact example:

```json
{
  "gate": "cat_item_pool_readiness",
  "status": "blocked",
  "reasons": [
    {
      "code": "missing_rationale",
      "itemId": "ITEM-0004",
      "message": "Approved CAT items require rationale text."
    }
  ]
}
```

## Screens To Build

### Student CAT Practice

- Scope selector
- Readiness status
- Start button
- One-item-at-a-time exam player
- Confirm answer
- No back navigation after confirm
- Progress count
- End exam

### Results And Review

- Ability estimate trend
- Blueprint coverage
- Client needs strengths and weaknesses
- Missed concepts
- Rationales
- Linked remediation lessons
- Retest weak areas

### Educator/Admin

- Item pool coverage
- Blueprint distribution
- Concept distribution
- Readiness gates
- Item performance table
- Student/cohort gap view

## First Implementation Tasks

1. Create `data/nclex-rn-2026-blueprint.json`.
2. Create `data/sample-item-bank.json`.
3. Create `lib/cat/selectNextItem.ts`.
4. Create `lib/cat/updateAbility.ts`.
5. Create `lib/cat/evaluateGates.ts`.
6. Create `pages/CatPractice.tsx` or equivalent app route.
7. Create `pages/CatResults.tsx`.
8. Add basic tests for selector behavior, gate blocking, and ability updates.

## Acceptance Criteria

- A learner can complete a 20-item adaptive practice session.
- Items are selected from under-covered blueprint categories when possible.
- Confirmed answers cannot be changed after moving forward.
- Ability estimate changes after each response.
- Results show blueprint coverage and weak concepts.
- Missed concepts link back to remediation lessons.
- CAT mode blocks when required item metadata is missing.
- Educator/admin can see why CAT readiness passed or failed.
