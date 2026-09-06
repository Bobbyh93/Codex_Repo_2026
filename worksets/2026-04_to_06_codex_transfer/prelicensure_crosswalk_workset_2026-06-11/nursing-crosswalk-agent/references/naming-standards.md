# Naming Standards

## Workbook architecture
- `Fact_*` = source-normalized row-level tables
- `Dim_*` = canonical dimensions
- `Bridge_*` = alias and governance tables
- `Master_*` = unioned analytical or release tables

## Column conventions
- workbook columns: snake_case
- stable keys: `topic_id`, `subject_id`, `resource_id`, `job_id`
- retain raw source labels in `*_raw` columns when canonicalized values also exist

## Governance fields
- `canonical_topic`
- `topic_family`
- `source_trace`
- `rule_trace`
- `needs_review`

## Canonical master spine
- `record_type`
- `source_family`
- `source_workbook`
- `source_sheet`
- `subject_canonical`
- `resource_canonical`
- `entity_name`
- `notes_long`
