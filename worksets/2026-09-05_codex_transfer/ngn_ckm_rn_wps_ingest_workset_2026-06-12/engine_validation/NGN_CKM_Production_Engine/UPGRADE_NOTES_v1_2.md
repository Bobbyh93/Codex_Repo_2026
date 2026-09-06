# v1.2 Hotfix Notes

## Fixed

- Added `/workbook/upload` raw-file upload endpoint.
- Added dashboard upload control for `.xlsx`/`.csv` source workbooks.
- Added `samples/multi_topic_input_template.csv` for multi-topic runs.
- Blocked generated CKM export files such as `knowledge_cards.csv` from being used as Full Workbook Batch inputs.
- Added friendlier backend errors for missing/invalid workbook paths.
- Added scheduler error handling so invalid nightly workbook paths do not spawn repeated incorrect jobs.
- Added `HOW_IT_WORKS_AND_MULTI_TOPIC_GUIDE.md`.

## Why

The previous UI allowed a generated CKM file to be used as the source workbook. That file has a parent `concept` column, so rows from Concept A all reprocessed as Concept A. Full Workbook Batch now requires source/control rows that describe what to build, not CKM rows that describe what was already built.
