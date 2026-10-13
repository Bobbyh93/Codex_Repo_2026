# Prelicensure QSEN-to-AACN Crosswalk Release Handoff

Generated: 2026-06-11

## Final Deliverables

- `prelicensure_qsen_aacn_crosswalk_release_resolved.xlsx`
- `prelicensure_crosswalk_resolved_qa.json`
- `workset_manifest.json`
- `execution_order.json`
- `execution_checklist.md`
- `remaining_review_packet.md`
- `remaining_review_queue.csv`
- `remaining_review_context.json`
- `release_checksums.json`

## Release Status

- QA reconciliation: pass
- Source workbook sheet count: 11
- Entry Level source data rows: 214
- Pre-split mapping cells: 651
- QSEN fact rows: 207
- Bridge rows: 835
- Master canonical rows: 835
- Review queue rows: 0
- Source exclusion rows: 7
- Source files modified: false

## Resolution Notes

The reviewed release had 10 remaining rows mapped to AACN subcompetencies `1.1b` and `1.1d`, but the source workbook had a blank parent header cell at `Entry Level!D4`.

The resolved release preserves that blank workbook header in provenance fields and supplements the display competency title from the official AACN Domain 1 page:

`1.1 Demonstrate an understanding of the discipline of nursing's distinct perspective and where shared perspectives exist with other disciplines.`

Supplemental source: `https://www.aacnnursing.org/essentials/tool-kit/domains-concepts/knowledge-for-nursing-practice`

## Workbook Sheet Set

- README
- Summary
- Provenance
- Data_Dictionary
- Dim_QSEN_Domain
- Dim_KSA
- Dim_AACN_Domain
- Dim_AACN_Competency
- Fact_QSEN_Statements
- Bridge_QSEN_AACN
- Master_Canonical
- Coverage_Summary
- Review_Queue
- Source_Exclusions

## Use Notes

Use `prelicensure_qsen_aacn_crosswalk_release_resolved.xlsx` as the release workbook. The remaining-review packet is retained as audit evidence for how the final missing header issue was resolved.
