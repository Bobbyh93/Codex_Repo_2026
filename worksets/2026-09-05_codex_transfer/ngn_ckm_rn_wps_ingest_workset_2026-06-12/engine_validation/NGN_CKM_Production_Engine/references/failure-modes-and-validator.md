# Harrity Lesson Builder Pipeline — Failure Modes and Validator Update

This document contains clean replacement content for:
- `references/failure-modes.md`
- `scripts/validate_lesson_json.py` guidance update

---

# File: references/failure-modes.md

# Failure Modes

Use this reference to prevent common production bugs in lesson-package generation.

## 1. Channel-collision failure
**Symptom**
- slide bullets read like a transcript
- narration and slide text duplicate each other
- speaker notes, bullets, and `tts_text` are mixed together

**Cause**
- the visual channel and narration channel were not kept separate

**Prevention**
- keep `on_slide_text` concise and learner-facing
- keep full explanation only in `speaker_script_verbatim`
- never treat presenter notes as a substitute for narration objects

**Required fix**
- remove transcript-like text from the slide body
- move full explanation into narration
- rerun blueprint QA and narration QA

---

## 2. Topic-selection drift
**Symptom**
- the lesson topic sounds plausible but is weakly connected to the source material
- the workbook filename drives the lesson more than the workbook contents
- the deck ignores obvious source concentrations or blocker patterns

**Cause**
- topic identification was skipped or done superficially

**Prevention**
- inspect source structure before drafting the outline
- for spreadsheets, review worksheets, headers, status fields, rollup tabs, and category concentrations
- capture both domain-content and process/governance signals where relevant

**Required fix**
- rerun topic identification
- regenerate the outline from the source-grounded topic
- update downstream slides only where topic drift changed scope

---

## 3. Outline omission failure
**Symptom**
- slide drafting starts immediately after intake
- lesson flow feels arbitrary or jumps between sections
- source coverage is uneven or implicit

**Cause**
- no explicit outline artifact was produced before blueprint generation

**Prevention**
- require a lesson outline in end-to-end runs
- map major sections to source clusters or source files

**Required fix**
- generate the missing outline
- confirm teaching sequence and scope
- revise blueprint ordering if the outline changes the flow

---

## 4. Minimum-artifact failure
**Symptom**
- the run ends with JSON and manifests only
- the user asked for an end-to-end package but there is no outline, no source package, or no deck

**Cause**
- downstream planning artifacts were mistaken for actual deliverables

**Prevention**
- enforce the minimum artifact rule for all end-to-end runs
- generate a real deck file whenever the environment supports deck creation

**Required fix**
- produce the missing outline artifact
- produce the missing source bundle or source summary artifact
- produce the missing slide deck artifact or explicitly state the environment constraint

---

## 5. Layout-density failure
**Symptom**
- a slide has too many bullets
- long bullets force tiny fonts or crowded spacing
- the blueprint technically passes but the rendered deck is unreadable

**Cause**
- text density was not budgeted during blueprinting

**Prevention**
- assign `layout_archetype` and `estimated_text_density` for every slide
- cap bullets and bullet length
- split dense slides instead of shrinking text below the minimum font size

**Required fix**
- reduce bullet count or bullet length
- split the slide if needed
- rerun blueprint QA and deck-render QA

---

## 6. Overlap or overflow failure
**Symptom**
- text boxes overlap
- content extends outside the visible slide region
- titles, bullets, or callouts collide after deck rendering

**Cause**
- no render inspection was performed, or the layout engine overfilled the slide

**Prevention**
- use safe content margins and fixed layout regions
- prefer fewer bullets and simpler archetypes
- render and inspect the deck before final delivery when the environment supports it

**Required fix**
- relayout the slide without changing the content unless necessary
- split the slide if the content cannot fit safely
- rerun deck-render QA

---

## 7. Manifest-versus-artifact ambiguity
**Symptom**
- the response implies the deck was edited, but only a manifest exists
- the user expects a PPTX but receives only JSON

**Cause**
- the deck assembly manifest was described as if it were a completed deck file

**Prevention**
- clearly distinguish real deck files from manifests
- explicitly state when audio binding or video export was not performed

**Required fix**
- correct the response language
- generate the real deck if supported
- otherwise provide the deterministic manifest and the exact unresolved step

---

## 8. Source-trace weakening
**Symptom**
- the lesson includes assertions that are not visibly grounded
- category claims or workflow claims are presented without source references

**Cause**
- source evidence was not carried into the outline or blueprint

**Prevention**
- include `source_refs` in the blueprint
- keep source bundles or source summaries in the final package
- mark uncertain items as `inferred` or `unresolved`

**Required fix**
- add or repair source references
- downgrade unsupported claims if evidence is incomplete
- rerun blueprint QA and narration QA

---

## 9. Timing-drift failure
**Symptom**
- blueprint durations, narration durations, media durations, and deck auto-advance values disagree
- narration feels too sparse or too compressed for the time target

**Cause**
- timing updates were applied in one stage but not propagated downstream

**Prevention**
- validate duration fields across blueprint, narration, media, and deck stages
- adjust target durations when narration density changes materially

**Required fix**
- propagate revised timings through all downstream artifacts
- rerun validator checks and timing QA

---

## 10. Notes-linkage failure
**Symptom**
- the deck exists, but presenter notes are missing when requested
- notes do not match the approved narration package

**Cause**
- notes insertion was skipped or pulled from outdated narration

**Prevention**
- add presenter notes from the approved narration when the environment supports notes
- include notes linkage checks in deck-render QA

**Required fix**
- refresh notes from the approved narration package
- rerun deck-render QA

---

## 11. Revision-scope explosion
**Symptom**
- a small layout complaint triggers a full regeneration
- unaffected slide IDs or audio filenames change unnecessarily

**Cause**
- revision control rules were not followed

**Prevention**
- treat overlap, spacing, and readability complaints as deck-layout revisions first
- preserve unaffected IDs and filenames

**Required fix**
- restore unaffected identifiers
- limit regeneration to impacted artifacts
- issue a revision log and rerun only affected QA gates

---

## 12. Spreadsheet-grounding failure
**Symptom**
- a spreadsheet-backed lesson becomes a generic topic summary
- the deck ignores workbook signals such as completion states, blocker queues, or dominant category families

**Cause**
- spreadsheet-specific inspection rules were not applied

**Prevention**
- inspect every visible worksheet before topic lock
- summarize concentrations, statuses, and blocker patterns
- use those findings in the outline and blueprint

**Required fix**
- rerun spreadsheet analysis
- regenerate topic identification and outline
- revise only the downstream slides affected by the new grounding

---

# File: scripts/validate_lesson_json.py — Guidance Update

The validator should be extended to enforce the revised skill behavior.

## New package types to recognize
Add support for these stages:
- `topic_identification`
- `outline`

## New cross-stage expectations
When multiple packages are present, the validator should check:
- outline exists for end-to-end runs
- deck assembly exists for end-to-end runs when deck creation is claimed
- slide_id sets still match across blueprint, narration, media, and deck packages
- deck render QA summary exists when a real deck or deck assembly package is produced

## New blueprint validation rules
For each slide, require:
- `layout_archetype`
- `estimated_text_density`
- `source_refs`

Validate:
- `estimated_text_density` is one of `low`, `medium`, or `high`
- `source_refs` is a non-empty list of strings for source-grounded slides
- bullet count does not exceed configured limits when a layout policy is present
- transcript-like bullets trigger warnings or failures depending on length

## New outline validation rules
Require:
- `lesson_title`
- `lesson_summary`
- `teaching_sequence`
- `section_list`
- `slide_count_target`
- `source_coverage_map`
- `excluded_or_deferred_topics`

Warn if:
- `slide_count_target` materially conflicts with the intake slide budget
- no source coverage is provided

## New topic-identification validation rules
Require:
- `candidate_topic`
- `evidence_for_topic`
- `dominant_content_clusters`
- `outlier_or_noise_clusters`
- `recommended_lesson_angle`
- `recommended_audience_fit`

Warn if:
- the evidence list is empty
- the topic is too generic to guide a lesson

## New deck-assembly validation rules
Require top-level:
- `render_qa_summary`

Require in `render_qa_summary`:
- `qa_status`
- `overflow_findings`
- `overlap_findings`
- `slides_requiring_relayout`

Fail if:
- `qa_status` is `fail`
- any overlap findings remain unresolved
- any overflow findings remain unresolved

Warn if:
- `speaker_notes_present` is false while notes policy says notes are required

## New minimum-artifact validation rules
When validating a bundle that appears end-to-end, warn or fail if any of these are missing:
- outline package
- source summary or source bundle metadata package
- deck assembly package or explicit environment constraint stating deck creation was unavailable

## Revised truthfulness checks
Fail if:
- deck output claims audio binding is complete but there is no matching media record
- a deck package implies real editing but only manifest-only warnings are present

## Recommended implementation approach
Extend `detect_stage()` and add new validators:
- `validate_topic_identification()`
- `validate_outline()`

Extend cross-validation to compare:
- outline slide-count target versus blueprint slide count
- blueprint `source_refs` presence versus evidence status
- deck `render_qa_summary` versus declared approval state

## Suggested additional warning heuristics
Warn if:
- more than four bullets appear on a single slide
- any bullet exceeds the configured character target by a large margin
- more than one slide is marked `high` density
- a slide marked `high` density also uses a generic `title-bullets` layout instead of a more suitable split layout

## Summary
The validator should now enforce not only schema completeness and timing consistency, but also:
- source-grounded topic selection
- presence of the outline stage
- minimum artifact compliance
- layout-safety readiness
- deck-render QA completeness
- clearer distinction between real deck artifacts and manifests

