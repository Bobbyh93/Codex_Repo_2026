# Review-Held NGN/CKM Rows

Generated: 2026-06-12

## Summary

- Held process rows: 38
- Held task trace rows: 390
- Held mapping context rows: 390
- Clean default run QA: pass

## Recommended Actions

- mapping_review_required: 37
- exclude_from_engine_source_candidate: 1

## Highest-Priority Rows

- `RN-WPS-001` *CIP Code - exclude_from_engine_source_candidate (132/132 review; reason: no_confident_match)
- `RN-WPS-002` Administer anesthetics or sedatives to control pain. - mapping_review_required (6/6 review; reason: no_confident_match)
- `RN-WPS-003` Administer non-intravenous medications. - mapping_review_required (6/6 review; reason: no_confident_match; duplicate_task_different_process)
- `RN-WPS-004` Advise communities or institutions regarding health or safety issues. - mapping_review_required (6/6 review; reason: no_confident_match)
- `RN-WPS-005` Advise medical personnel regarding healthcare issues. - mapping_review_required (6/6 review; reason: no_confident_match; duplicate_task_different_process)
- `RN-WPS-006` Analyze test data or images to inform diagnosis or treatment. - mapping_review_required (6/6 review; reason: no_confident_match; duplicate_task_different_process)
- `RN-WPS-007` Assess patient work, living, or social environments. - mapping_review_required (6/6 review; reason: no_confident_match)
- `RN-WPS-008` Assist healthcare practitioners during examinations or treatments. - mapping_review_required (6/6 review; reason: no_confident_match; duplicate_task_different_process)
- `RN-WPS-009` Collaborate with healthcare professionals to plan or provide treatment. - mapping_review_required (6/6 review; reason: no_confident_match)
- `RN-WPS-010` Communicate health and wellness information to the public. - mapping_review_required (6/6 review; reason: no_confident_match; duplicate_task_different_process)
- `RN-WPS-011` Conduct research to increase knowledge about medical issues. - mapping_review_required (6/6 review; reason: ambiguous_match)
- `RN-WPS-013` Diagnose medical conditions. - mapping_review_required (6/6 review; reason: no_confident_match; duplicate_task_different_process)

## Review Guidance

Rows marked `exclude_from_engine_source_candidate` appear to be source metadata rather than lesson concepts and should normally be removed from engine queues.
Rows marked `mapping_review_required` need human mapping review before setting `needs_review=false` in any engine queue.
Rows marked `review_partial_mapping_then_release` have some confident mapping signal but still require review before release.
