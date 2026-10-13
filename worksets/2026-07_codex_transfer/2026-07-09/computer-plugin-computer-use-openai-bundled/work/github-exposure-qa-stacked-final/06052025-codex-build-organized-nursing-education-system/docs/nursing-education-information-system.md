# CAT-Driven Nursing Learning System Blueprint

## 1) North-Star Product Definition

**Computer Adaptive Testing (CAT), computer-curated content, and comprehension-based progression.**

This solution is driven by continuous learner assessment and targeted remediation:

1. Learners complete NCLEX-aligned adaptive assessments.
2. The system detects exact concept/topic understanding gaps.
3. The platform assigns performance-based micro-lessons (focused study guides).
4. Learners progress only when mastery criteria are met.

The backbone is a connected ecosystem of:

- NCLEX blueprint and standards mapping
- Nursing item bank
- Structured nursing education content graph
- Learner mastery model and recommendation engine

---

## 2) Core Outcome

Ensure didactic/theory learning no longer blocks clinical performance by converting every missed concept into a prioritized, personalized learning action.

---

## 3) System Backbone (Connected Data Model)

### 3.1 Canonical Entities

- **NCLEX Blueprint Domain** (client needs, test plan category)
- **Curriculum Domain/Course** (e.g., Med-Surg, Pediatrics)
- **Topic**
- **Concept**
- **Learning Objective**
- **Assessment Item** (with variants)
- **Micro-lesson Asset** (focused guide, case, rationale review)
- **Evidence Source** (guidelines/text references)

### 3.2 Required Linkages

Every item and micro-lesson must connect to:

- Primary and secondary concept IDs
- NCLEX blueprint mapping
- Cognitive level
- Clinical/safety priority
- Prerequisite concepts
- Common misconception tags

This creates a traceable loop from assessment result → understanding diagnosis → curated content assignment.

### 3.3 Knowledge Graph Relationship Types

- `prerequisite_of`
- `assessed_by`
- `remediated_by`
- `commonly_confused_with`
- `high_risk_if_missed`
- `reinforces`

---

## 4) Assessment-First Operating Model

### 4.1 Computer Adaptive Testing Engine

The CAT engine should:

- Estimate learner ability at concept and topic levels
- Select next-best item based on prior responses
- Increase or decrease difficulty dynamically
- Stop when confidence/precision thresholds are met

### 4.2 Item Bank Requirements

Each item includes:

- `primary_concept_id`
- `secondary_concept_ids`
- `nclex_blueprint_code`
- `clinical_priority` (high/med/low)
- `difficulty`
- `item_format` (SBA, SATA, ordered response, case set)
- `rationale_map` (correct/incorrect reasoning)
- `misconception_signals`

### 4.3 Learner Understanding Profile

Maintain a live profile with:

- Concept mastery score (0–100)
- Topic mastery score
- Confidence vs correctness calibration
- Error type (knowledge, reasoning, misread, guessing)
- Retention status (spaced review due)

---

## 5) Performance-Based Micro-Lesson Curation

### 5.1 Micro-Lesson Types (Focused Study Guides)

- “Why you missed this” explanation cards
- Concept refresh guides (1–3 pages)
- Safety-priority intervention checklists
- Mini case walkthroughs
- Targeted flash-review sets

### 5.2 Curation Logic

After each CAT session:

1. Detect weak concepts and misconception pattern.
2. Rank by clinical risk + exam relevance + recency of misses.
3. Assign the minimum high-impact micro-lessons.
4. Schedule reassessment with alternate items.
5. Promote mastery only after successful re-demonstration.

### 5.3 Example Prioritization Score

`priority_score = (clinical_risk × 0.40) + (miss_frequency × 0.25) + (nclex_weight × 0.20) + (retention_risk × 0.15)`

---

## 6) Comprehension-Based Progression Rules

Progression should be based on understanding evidence, not content completion.

Example rule set:

- Concept “in progress” if mastery < 80%
- Concept “proficient” if mastery ≥ 80% and 2 successful spaced recalls
- Topic unlock if all critical concepts are proficient
- High-risk concepts require stricter recheck intervals

---

## 7) Platform Services

- **Assessment Service**: CAT delivery and scoring
- **Item Bank Service**: authoring, tagging, psychometric tracking
- **Content Graph Service**: concepts, objectives, and micro-lessons
- **Recommendation Service**: curation and sequencing
- **Learner Model Service**: mastery and retention updates
- **Analytics Service**: learner, cohort, and faculty insights

---

## 8) Learner and Faculty Experience

### 8.1 Learner View

- Current comprehension map by topic/concept
- “Study next” queue with reason codes
- Assigned focused guides tied to missed concepts
- Retest readiness status and mastery trend

### 8.2 Faculty View

- Cohort heatmap of weak/high-risk concepts
- Most-missed concepts and misconception clusters
- Item quality signals and distractor performance
- Intervention assignment tools for targeted remediation

---

## 9) KPIs for Success

- Reduction in repeat misses on high-priority concepts
- Faster time-to-mastery for critical concepts
- Increased assessment precision at concept level
- Improvement in NCLEX-aligned benchmark performance
- Higher completion of assigned remediation assets
- Improved clinical readiness indicators

---

## 10) Pilot Implementation Sequence

### Stage A (2–4 weeks): Foundation

- Finalize NCLEX-to-curriculum mapping and concept taxonomy
- Set metadata standards for items and micro-lessons
- Select pilot cohort and priority course

### Stage B (6–8 weeks): CAT + Content Linkage

- Tag initial item bank to concept graph
- Build first set of performance-based micro-lessons
- Activate adaptive diagnostic and curation flow

### Stage C (8–12 weeks): Mastery Progression

- Turn on comprehension-based advancement rules
- Launch learner/faculty dashboards
- Evaluate outcomes and recalibrate prioritization weights

---

## 11) Product Tagline Options

- **Computer Adaptive Testing. Computer-Curated Content. Comprehension-Based Learning.**
- **Assess precisely. Curate intelligently. Progress by mastery.**
- **NCLEX-aligned CAT with focused micro-lessons for measurable understanding.**
