# Candidate Regeneration v2

**What this is:** a second pass at 10 of the 36 RN WPS → QSEN mapping rows, in which the *candidate generation* step was replaced, not just the drafting step.

**Date:** 2026-09-06 · **Validation errors:** 0 · **Original artifacts modified:** none

---

## Why a v2 existed to be done

`build_mapping_resolution.py` hands the drafting model a fixed 12 candidate QSEN statements per process, chosen by a conservative lexical matcher. When the matcher finds fewer than 12 real matches it pads the list with sequential filler at score `0.00` — QSEN_0001, QSEN_0002, and so on.

Four of the 36 rows were mostly filler (RN-WPS-028 was 11 of 12). Five more were missing the statement that actually fits. No model can draft its way out of that, which is why the v1 pass returned `insufficient_evidence` on four rows and had to reach for an Attitude statement on a Skill task in two others.

This pass selects candidates semantically from all **207** QSEN statements instead.

## Result

| Module | v1 | v2 | Confidence |
|---|---|---|---|
| RN-WPS-003 Administer non-IV medications | `insufficient_evidence` | QSEN_0158 standardized practices supporting safety | medium |
| RN-WPS-008 Assist during examinations | `insufficient_evidence` | QSEN_0062 function within own scope as team member | medium |
| RN-WPS-018 Inform professionals re conditions | QSEN_0189 (EHR documentation) | QSEN_0161 communicate observations to the team | medium |
| RN-WPS-020 Maintain facility records | QSEN_0207 (an *Attitude*) | QSEN_0189 document care in the EHR | medium |
| RN-WPS-023 Monitor during treatments | QSEN_0175 (an *Attitude*) | QSEN_0159 reduce risk of harm | low |
| RN-WPS-024 Monitor progress/response | QSEN_0016 | QSEN_0013 elicit values through evaluation of care | low |
| RN-WPS-025 Monitor post-surgery | QSEN_0016 | QSEN_0013 (same as 024, by design) | low |
| RN-WPS-028 Prepare patients for procedures | `insufficient_evidence` | QSEN_0158 standardized practices | low |
| RN-WPS-034 Supervise care personnel | QSEN_0010 | QSEN_0065 clarify roles and accountabilities | medium |
| RN-WPS-037 Train caregivers | `insufficient_evidence` | QSEN_0106 role model clinical decision making | low |

**Four rows that could not be drafted at all are now drafted. Five of the ten are medium confidence, where v1 had none above low.**

An emergent check worth noting: every v2 top is a **Skills** statement. All ten source tasks describe things a nurse *does*, so a Skills-level match is what a correct crosswalk should produce. v1 had to use Attitude statements on two of them purely because the candidate set offered nothing better. That the KSA levels now line up on their own is weak evidence the regenerated sets are closer to right.

## What this does not fix

- **RN-WPS-037 is still weak.** QSEN contains no statement about teaching, precepting, or training others — the whole competency set is written about the nurse's own practice. Even with all 207 available, the best available match is role modeling. The reviewer may reasonably send this row back to `not_mappable` and route it to AACN Domains 6 and 10.
- **RN-WPS-018 is a partial fit.** QSEN_0161 qualifies its observations as "related to hazards and errors", narrower than routine condition reporting. QSEN has no clean "report clinical findings to the provider" statement.
- **RN-WPS-023 is a genuine reviewer choice**, not a defect: QSEN_0159 matches the task's KSA level, QSEN_0175 matches its wording. Pick an axis and apply it consistently.

## This is a methodology change

Adopting these rows means accepting that the candidate-generation step changed. That is a decision about the crosswalk's method, not a data correction, and it should be recorded as one. The 26 rows in `mapping_resolution_claude/` that were not regenerated still stand on the original lexical candidate sets — which means the completed crosswalk would mix two candidate-generation methods unless the remaining rows are regenerated too.

**Recommendation:** if these ten hold up under review, regenerate all 36 on the same basis before anyone signs the crosswalk off, so one method covers the whole table.

## Files

| File | Purpose |
|---|---|
| `wps_process_mapping_resolution_claude_v2.csv` | Reviewer instrument. Shows v1 and v2 side by side, plus the full v2 candidate set per row. Fill `review_decision`, `reviewer_notes`, `final_qsen_statement_id`. |
| `claude_mapping_suggestions_v2.jsonl` | Machine record with validation errors and what each row supersedes. |
| `claude_mapping_resolution_v2_qa.json` | QA record. |
| `candidate_regeneration_v2.json` | The proposal itself: candidate sets, drafts, rationales. |
| `build_candidate_regeneration_v2.py` | Builder. Verifies every proposed candidate id exists in the source index, rejects duplicates, derives AACN codes from the source, and validates against the same contract as `build_mapping_resolution.py`. |

## Provenance

- QSEN index read from `rn_wps_prelicensure_crosswalk_workset_2026-06-12\build\intermediate\rn_wps_prelicensure_crosswalk_data.json` — 207 statements.
- No OpenAI API call. No source file modified. `mapping_resolution\` and `mapping_resolution_claude\` are both untouched.
- AACN sub-competency codes are copied by the builder from the chosen candidate's source row. None were typed by hand.
