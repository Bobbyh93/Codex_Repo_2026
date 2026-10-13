# Prelicensure QSEN-to-AACN Crosswalk Release Handoff

Generated: 2026-06-11

## Release Status

This private release is verified and ready for handoff. The native Google Sheet, archival bundle, QA files, checksums, and byte-preserved handoff Markdown archive are in the verified Drive release folder.

No Drive sharing permissions were changed during final handoff creation. The release folder and Sheet were previously verified as private.

## Published Assets

- Drive release folder: [Prelicensure QSEN-AACN Crosswalk Release 2026-06-11](https://drive.google.com/drive/folders/1R9Puh6aTasXbtrY-iO8Y54IzQD3Rq9J5)
- Native Google Sheet release workbook: [Prelicensure QSEN-AACN Crosswalk Release 2026-06-11](https://docs.google.com/spreadsheets/d/1am72N-im7l1XkfZabC0oZkAjOhgXztZ9_Bqo9i8pMz4)
- Archival release bundle ZIP: [prelicensure_qsen_aacn_crosswalk_release_resolved_bundle.zip](https://drive.google.com/file/d/1o3tkgQyy6ctJFftPKpX4FTIy4t1ubtkT/view)
- Handoff Markdown ZIP: [release_handoff.zip](https://drive.google.com/file/d/1L3woFLJJ9_0GvXY_BxUa1QlekzZb8ml0/view)
- QA JSON: [prelicensure_crosswalk_resolved_qa.json](https://drive.google.com/file/d/1i1SuzJsubUnKaphwe9_-agjt-3VC10OP/view)
- Checksum JSON: [release_checksums.json](https://drive.google.com/file/d/1p_zKyMtEE1JfNOBhmWOMvFzGrKZGqkiy/view)
- Notion release note: [Prelicensure QSEN-to-AACN Crosswalk Release - 2026-06-11](https://app.notion.com/p/37c510cd41f68113bddeec15b6761038)

## Verification Summary

- Workbook tabs verified: 14
- QA reconciliation status: pass
- Entry Level source data rows: 214
- Pre-split mapped cells: 651
- Bridge rows: 835
- Review queue rows: 0
- Source files modified: false
- Source workbook uploaded: no
- Build scripts uploaded: no

`release_handoff.zip` is the byte-preserved handoff source. It contains `release_handoff.md` unchanged at 1,794 bytes with SHA-256 `6BD139BB5D391EB10A59C250BF32AF2C7C55E5DC81064BFD026646E45EC17197`.

## Use Notes

Use the native Google Sheet as the primary working release. Use the archival release bundle ZIP for preservation, reproducibility, and offline audit. Use the QA JSON and checksum JSON to confirm row counts, reconciliation status, and artifact integrity.

The readable Google Doc copy of `release_handoff.md` is retained in the Drive folder for convenience, but the byte-preserved Markdown source is `release_handoff.zip`.

AACN Domain 1 was used only to resolve the missing parent competency `1.1`. Source provenance fields preserve the blank workbook header; the display competency title was supplemented from the official AACN Domain 1 page.

