# prelicensure-qsen-aacn-crosswalk-workset

Objective: Create a structured local release workbook from the QSEN Prelicensure to AACN Entry Level competency crosswalk workbook.

## Ordered jobs

1. **J00-intake** (intake) — Confirm local workset inputs and output contract
   - outputs: workset_manifest.json
2. **J10-inventory** (inventory) — Inventory workbook sheets and source shape
   - depends_on: J00-intake
   - outputs: build/intermediate/source_inventory.json
3. **J20-normalize** (normalize) — Normalize canonical QSEN rows and AACN mapping cells
   - depends_on: J10-inventory
   - outputs: build/intermediate/crosswalk_data.json
4. **J30-dimensions** (dimensions) — Build dimensions and fact table
   - depends_on: J20-normalize
   - outputs: Dim_QSEN_Domain, Dim_KSA, Dim_AACN_Domain, Dim_AACN_Competency, Fact_QSEN_Statements
5. **J40-bridges** (bridges) — Build QSEN to AACN bridge table
   - depends_on: J30-dimensions
   - outputs: Bridge_QSEN_AACN
6. **J50-master** (master) — Build flattened canonical master
   - depends_on: J40-bridges
   - outputs: Master_Canonical
7. **J60-coverage** (coverage) — Build coverage and review outputs
   - depends_on: J50-master
   - outputs: Coverage_Summary, Review_Queue
8. **J70-release** (release) — Assemble Excel release workbook
   - depends_on: J60-coverage
   - outputs: outputs/prelicensure_qsen_aacn_crosswalk_release.xlsx
9. **J80-qa** (qa) — Validate release and write QA manifest
   - depends_on: J70-release
   - outputs: prelicensure_crosswalk_qa.json

## Blocking rules

- Do not modify source workbook or source archive.
- Treat Entry Level as the canonical source for QSEN rows and aggregate AACN mappings.
- Use rows 1-5 as metadata/header rows and rows 6+ as data rows.
- Forward-fill blank QSEN domain and KSA values caused by merged-cell layout.
- Use the 10 domain sheets only for QA reconciliation.
- Preserve raw source labels and typos exactly in *_raw fields.
- Do not invent mappings; ambiguous, malformed, duplicate, or parent-prefix-mismatched mappings must be flagged needs_review.
