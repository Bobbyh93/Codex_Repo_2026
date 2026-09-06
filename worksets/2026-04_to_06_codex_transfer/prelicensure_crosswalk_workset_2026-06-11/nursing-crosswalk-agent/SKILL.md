---
name: nursing-crosswalk-agent
description: "orchestrate end-to-end nursing education crosswalk worksets for integrating, merging, standardizing, cleaning, and releasing workbook-driven master tables. use when chatgpt needs to inventory uploaded spreadsheets or file-library workbooks, extract table-of-contents structures from nursing manuals, normalize subject and resource naming, build fact/dim/bridge/master tables, produce review queues and coverage summaries, or generate release-ready crosswalk workbooks with provenance and qa."
---

# Nursing Crosswalk Agent

Use this skill to turn messy nursing education spreadsheets, PDFs, library workbooks, and connected-drive tables into a controlled crosswalk workflow.

## Quick start
1. Read `references/workflow.md`.
2. Read `references/tools-and-connectors.md`.
3. Start from `assets/workset_manifest.template.json` or `assets/release_manifest.template.json`.
4. Validate with `scripts/validate_manifest.py`.
5. Expand ordered jobs with `scripts/run_workset.py`.
6. Use `references/prompt-pack.md` while executing the workset.

## Core workflow
1. Intake
2. Inventory + provenance
3. Normalize by source family
4. Canonicalize naming
5. Build Bridge tables and governance fields
6. Build master tables
7. Build coverage + review queue
8. Release + QA

## Output rules
Default workbook structure:
- `README`
- `Summary`
- `Provenance`
- `Data_Dictionary`
- `Dim_Subject`
- `Dim_Resource`
- one or more `Bridge_*` tables
- one or more `Fact_*` tables
- `Master_Canonical` or `Master_Release`
- coverage/review tabs

## Naming rules
- sheet names: readable business names
- columns: snake_case
- keys: `topic_id`, `subject_id`, `resource_id`, `job_id`
- preserve raw source labels in `*_raw` columns when canonicalized values also exist

## Blocking rules
- do not invent grounded mappings from placeholders or incomplete sources
- preserve blocked reasons and `needs_review`
- do not silently drop provenance
- keep merges conservative; move ambiguity to review queues

## Resources
- `references/workflow.md`
- `references/prompt-pack.md`
- `references/tools-and-connectors.md`
- `references/naming-standards.md`
- `references/job-examples.md`
- `references/schema-job-manifest.json`
- `references/schema-master-row.json`
- `references/definitions-tools-skills-agents.md`
- `scripts/inventory_workbook.py`
- `scripts/validate_manifest.py`
- `scripts/run_workset.py`
