# NGN/CKM RN WPS Ingest Pack Handoff

Generated: 2026-06-12

## Status

The RN WPS process-level ingest pack is local, engine-ready, and validated with the bundled NGN/CKM source-table loader. No lesson generation was run, no OpenAI calls were made, and no Drive or Notion assets were changed.

## Primary Files

- Source workbook: `C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12\source_tables\rn_wps_process_lesson_ingest_queue.xlsx`
- Source CSV: `C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12\source_tables\rn_wps_process_lesson_ingest_queue.csv`
- Manifest: `C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12\ngn_ckm_ingest_manifest.json`
- Source trace: `C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12\support\source_trace.json`
- Pipeline payload preview: `C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12\support\pipeline_payloads_preview.json`
- QA: `C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12\ngn_ckm_ingest_qa.json`

## QA Summary

- Ingest rows: 39
- Clean default rows: 1
- Review-held rows: 38
- Engine CSV validation payloads, include_review_rows=false: 1
- Engine XLSX validation payloads, include_review_rows=false: 1
- Engine XLSX validation payloads, include_review_rows=true: 39
- Source hashes unchanged: True

## Use

Use `source_tables\rn_wps_process_lesson_ingest_queue.xlsx` with the NGN/CKM Full Workbook runner. Default engine settings with `include_review_rows=false` will process only the clean row. Use `include_review_rows=true` only after reviewer approval of the held rows.
