# Harrity master lesson governance contract

This directory defines the governance record required beside every generated lesson package.

The production assets remain in the lesson package (`lesson_spec.json`, source manifest, TTS queue, audio manifest, binding manifest, and playback report). The governance record adds the decisions that automation cannot safely infer:

- lesson ownership and program identity;
- source-use approval and coverage;
- curriculum taxonomy;
- measurable learning outcomes;
- slide-to-outcome and slide-to-source traceability;
- accessibility review;
- faculty and release approvals.

Copy `governance.template.json` into a lesson directory as `governance.json`, replace placeholders, and run:

```powershell
python scripts/validate_lesson_governance.py lessons/<lesson> --target faculty_review
```

Promotion targets are cumulative:

1. `intake_complete`
2. `faculty_review`
3. `production_ready`
4. `release_ready`

The validator fails closed. Verified narration and valid media bindings do not substitute for source, faculty, accessibility, or release approval.
