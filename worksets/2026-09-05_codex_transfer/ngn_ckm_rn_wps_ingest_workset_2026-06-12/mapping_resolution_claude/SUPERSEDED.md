# Superseded by v3

This folder is **pass 1** of the Claude-drafted RN WPS → QSEN mapping resolution (2026-08-27, merged 2026-09-06).

**Do not review from this folder.** The current table is:

    ..\mapping_resolution_claude_v3\wps_qsen_crosswalk_v3_review.csv

## Why it was superseded

Pass 1 drafted every row inside the candidate sets the lexical prefilter produced. Four rows could not be drafted at all because their candidate sets were mostly score-0.00 filler, and several others were forced onto the wrong KSA level because the right statement was never offered. v3 regenerates candidates semantically over all 207 QSEN statements for all 36 rows.

Against v3, this folder's numbers read: `insufficient_evidence` 4 (v3: 0), drafted 23 (v3: 30), medium confidence 5 (v3: 13). Six shared-source-task groups were answered inconsistently here; v3 resolves all six.

## What is still worth reading here

`WPS_QSEN_REVIEW_PACKET.md` sections 3.1–3.3 are the diagnosis that led to v3 — the filler-padding behaviour, the false positives, and the missing-candidate evidence. Its per-row *outcomes* are stale; its *analysis of the generator* is not.

Kept as history and as the record of what the pipeline produced before the candidate-generation step changed.
