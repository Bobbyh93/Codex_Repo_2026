# Remaining Review Packet

Purpose: isolate the final unresolved rows from the reviewed prelicensure QSEN-to-AACN crosswalk release.

## Status

- Remaining review rows: 10
- Remaining reason: `missing_competency_header`
- Source files were not modified.
- These rows are preserved in the reviewed release workbook and should not be cleared until the missing AACN 1.1 competency title is confirmed from an authoritative source.

## Source Header Evidence

| Cell | Value |
|---|---|
| D2 | AACN Essentials  Domain 1: Knowledge for Nursing Practice   |
| D3 | Descriptor: Integration, translation, and application of established and evolving disciplinary nursing knowledge and ways of knowing, as well as knowledge from other disciplines, including a foundation in liberal arts and natural and social sciences. This distinguishes the practice of professional nursing and forms the basis for clinical judgment and innovation in nursing practice. |
| D4 |  |
| D5 | Subcompetencies |
| E4 | 1.2 Apply theory and research-based knowledge from nursing, the arts, humanities, and other sciences. |
| F4 | 1.3 Demonstrate clinical judgment founded on a broad knowledge base. |

Merged ranges touching column D rows 2-5:

- `D2:F2`
- `D3:F3`
- `D5:F5`

Interpretation: column D is inside the Domain 1 subcompetency region, but `D4` has no parent competency title. The source cells map to `1.1b` and `1.1d`, which imply parent competency `1.1`; the workbook itself does not provide the `1.1` title in row 4.

## Remaining Rows

| Review ID | Source Cell | Code | Implied Parent | KSA | QSEN Statement |
|---|---|---|---|---|---|
| REV_00001 | D54 | 1.1d | 1.1 | Knowledge | Describe scopes of practice and roles of health care team members** |
| REV_00002 | D64 | 1.1d | 1.1 | Skills | Demonstrate awareness of own strengths and limitations as a team member** |
| REV_00003 | D67 | 1.1d | 1.1 | Skills | Function competently within own scope of practice as a member of the health care team** |
| REV_00004 | D77 | 1.1d | 1.1 | Skills | Assert own position/perspective in discussions about patient care |
| REV_00005 | D81 | 1.1d | 1.1 | Attitudes | Acknowledge own potential to contribute [contributions] to effective [or ineffective] team functioning** |
| REV_00006 | D92 | 1.1b | 1.1 | Knowledge | Demonstrate knowledge of basic scientific [health research] methods and processes ** |
| REV_00007 | D105 | 1.1b | 1.1 | Skills | Read [Critically appraise] original research and evidence reports related to area of practice ** |
| REV_00008 | D106 | 1.1b | 1.1 | Skills | Locate evidence reports related to clinical practice topics and guidelines |
| REV_00009 | D112 | 1.1b | 1.1 | Attitudes | Appreciate strengths and weaknesses of scientific bases for practice** |
| REV_00010 | D115 | 1.1b | 1.1 | Attitudes | Appreciate the importance of regularly reading relevant professional journals |

## Recommended Resolution

1. Confirm the official AACN Entry Level competency `1.1` title from an authoritative AACN source.
2. If confirmed, update the release process to populate the parent competency metadata for column D while preserving the workbook's blank `D4` in provenance fields.
3. Rebuild the release workbook and QA manifest; the review queue should then clear if no other source issues appear.

## Files

- CSV review queue: `C:\Users\RHarrity\Documents\Codex\prelicensure_crosswalk_workset_2026-06-11\outputs\remaining_review_queue.csv`
- JSON context: `C:\Users\RHarrity\Documents\Codex\prelicensure_crosswalk_workset_2026-06-11\outputs\remaining_review_context.json`
