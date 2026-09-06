# RN WPS → QSEN Crosswalk — v3, complete and method-consistent

**36 of 36 rows · 0 validation errors · nothing existing modified · 2026-09-06**

This supersedes `mapping_resolution_claude/` (v1) and `mapping_resolution_claude_v2/` (v2). Both are kept as history.

---

## Why v3 exists

v1 drafted all 36 rows inside the candidate sets the lexical prefilter produced. v2 showed that regenerating those sets semantically over all 207 QSEN statements fixed 10 rows the prefilter had made undraftable or mis-levelled. That left the table on two different methods — which is not a table anyone should sign.

v3 regenerates the remaining 26 on the same basis. **One method now covers every row.**

## Result

| | v1 | v3 |
|---|---:|---:|
| `draft_mapping` | 23 | **30** |
| `not_mappable` | 9 | 6 |
| `insufficient_evidence` | 4 | **0** |
| high confidence | 1 | 1 |
| medium confidence | 5 | **13** |
| low confidence | 17 | 16 |
| Validation errors | 0 | 0 |

Against v1: **10 rows confirmed, 17 tops changed, 9 statuses changed.**

## Two checks worth more than the counts

**1. Every one of the 30 drafted tops is a Skills statement.**

All 36 source tasks describe things a nurse *does*. A correct crosswalk should therefore land on Skills-level QSEN statements. v1 had to reach for Attitude statements on RN-WPS-020 and RN-WPS-023 and Knowledge statements on RN-WPS-006 and RN-WPS-010, purely because the candidate sets offered nothing better. Nothing in this pass optimised for KSA level — it fell out of choosing better candidates. That it now holds across all 30 is the strongest available evidence the regenerated sets are closer to right.

**2. Shared-task disagreements: 6 → 1.**

Nine groups of processes share identical source task text. v1 gave six of those groups contradictory answers — the same task mapped one way under one O\*NET concept label and refused under another. All six are resolved:

| Shared task | v1 | v3 |
|---|---|---|
| Infection control programmes (005, 014) | draft vs `not_mappable` | both QSEN_0167 |
| Observe nurses / visit patients (022, 035) | QSEN_0010 vs QSEN_0192 | both QSEN_0130 |
| Order and evaluate diagnostic tests (006, 026) | QSEN_0091 vs QSEN_0095 | both QSEN_0195 |
| Physical exam / diagnose / treat (013, 016, 039) | draft vs `not_mappable` | all `not_mappable` |
| Prepare rooms and instruments (019, 027) | draft vs `not_mappable` | both QSEN_0158 |
| Health care, first aid, immunisation (017, 038) | draft vs `not_mappable` | both QSEN_0029 |

The one remaining divergence is **deliberate**: RN-WPS-008 and RN-WPS-028 share a task, but 008 is about the nurse's role assisting the practitioner (QSEN_0062, scope of practice on a team) and 028 is about preparing the patient (QSEN_0158, standardized safe practice). The concepts genuinely pull apart. It is documented in both rows rather than silently allowed.

## Decisions taken, and the reasoning

- **RN-WPS-016 was downgraded from a draft to `not_mappable`.** This is the only row that got *worse*. v1 mapped "perform physical examinations" onto "assess levels of physical and emotional comfort". Checking the full index settles it: QSEN's only assessment statements concern pain, comfort, decisional conflict, and the nurse's own communication skill. There is no general physical-assessment competency. A reviewer would have rejected v1's mapping; better to refuse it here.
- **Four rows moved from `not_mappable` to drafted** (014, 017, 019, 021) because the full index *does* contain counterparts the prefilter never offered — chiefly the participate-in-designing-systems family (QSEN_0074, 0102, 0163, 0166, 0167).
- **RN-WPS-021 is partial coverage and says so.** The task names staff, budget, planning and long-range goals. Only the staffing clause has a QSEN counterpart. A reviewer wanting whole-task coverage should return it to `not_mappable`.
- **All six `not_mappable` rows are now verified, not inferred.** Each carries a regenerated candidate set of the twelve genuinely nearest statements, so the refusal can be checked rather than taken on trust.
- **RN-WPS-029 and RN-WPS-030 (prescribing) remain `not_mappable` and should leave the review queue entirely** — they are advanced-practice tasks inherited from an O\*NET RN profile. Move them to the source exclusion list beside `*CIP Code` and `Provider`.

## What is still weak

- **RN-WPS-037 (train caregivers).** QSEN contains no statement about teaching, precepting or training others; the whole set is written about the nurse's own practice. Role modelling (QSEN_0106) is the nearest thing that exists. Returning this row to `not_mappable` is defensible.
- **RN-WPS-018 (inform professionals).** QSEN_0161 qualifies its observations as "related to hazards and errors", narrower than routine condition reporting. QSEN has no clean "report clinical findings to the provider" statement.
- **RN-WPS-023.** A real reviewer choice, not a defect: QSEN_0159 matches the task's Skills level, QSEN_0175 matches its wording. Pick an axis and hold it.
- **16 of 30 drafts are low confidence.** That is the honest state of a crosswalk between an occupational task list and a competency framework that were never designed to align. The remaining work is judgement, and it is not mine to make.

## Files

| File | Purpose |
|---|---|
| `wps_qsen_crosswalk_v3_review.csv` | **The reviewer instrument.** All 36 rows with statement text, domain, KSA level, AACN codes, the full candidate set, rationale, notes, what changed vs v1, and blank decision columns. |
| `claude_crosswalk_v3.jsonl` | Machine record, one line per row. |
| `claude_crosswalk_v3_qa.json` | QA record with all counts and the method statement. |
| `candidate_regeneration_v3_additional.json` | The 26 new proposals. |
| `build_crosswalk_v3.py` | Builder. Preflights that every candidate id exists, refuses duplicate modules across proposals, cross-checks coverage against the real process list, derives AACN codes from source, validates against `build_mapping_resolution.py`'s contract. |

The v2 proposal is read from `../mapping_resolution_claude_v2/candidate_regeneration_v2.json`; the builder merges rather than duplicating it.

## Provenance

- QSEN index: 207 statements from `rn_wps_prelicensure_crosswalk_workset_2026-06-12\build\intermediate\rn_wps_prelicensure_crosswalk_data.json`.
- Coverage verified against `mapping_resolution\mapping_resolution_rows.json` — all 36 process rows accounted for, none extra.
- No OpenAI API call. No source file modified. `mapping_resolution\`, `mapping_resolution_claude\` and `mapping_resolution_claude_v2\` are all untouched.
- AACN codes copied by the builder from each chosen candidate's source row. None typed by hand.
- **These are drafts.** No row enters the ingest queue or the binding manifest without a reviewer decision.
