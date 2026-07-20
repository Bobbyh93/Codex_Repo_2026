# Nurse Prep EB Web App Integration

## Purpose

The Nurse Prep EB Workbench gives the current pipeline a readable operational front end. It does not replace the state files. It renders them.

## Integrated Data Sources

| Source | Use |
| --- | --- |
| `state/project_state.json` | Project identity, repository, ChatGPT project, OpenAI Platform metadata |
| `state/work_queue.json` | Active and blocked work packages |
| `state/qa_state.json` | Release and execution gates |
| `state/release_state.json` | Export hard stops |
| `state/pipeline_state.json` | Current stage and runtime context |
| `manifests/openai_runtime_check.json` | OpenAI runtime status |
| `qa/tts_asset_verification_report.json` | TTS pilot status |
| `qa/production_pilot_release_report.json` | Source-grounded production pilot release state |
| `qa/production_pilot_tts_report.json` | Production pilot OpenAI TTS verification summary |
| `manifests/production_pilot_audio_manifest.json` | Per-slide OpenAI MP3 asset evidence |
| `manifests/production_pilot_binding_manifest.json` | Per-slide downstream binding handoff |
| `lessons/production_pilot/lesson_spec.json` | Production pilot slide, notes, TTS text, and source references |
| `lessons/production_pilot/source_manifest.json` | Approved local source package for the pilot |
| `qa/production_pilot_playback_evidence.json` | Target-player playback evidence input |
| `qa/production_pilot_playback_report.json` | Playback release gate result |
| `daily_worksets/*.json` | Current daily work order |

## Design Boundary

This is an operations web app, not a marketing page. It prioritizes dense status, blocker visibility, traceable artifacts, and daily execution handoff.

## OpenAI TTS Pilot Integration

The workbench now treats `scripts/openai_tts_live_pilot.py` outputs as operational evidence rather than hidden backend files. The Production Pilot panel summarizes the source-grounded lesson, verified OpenAI narration count, binding readiness, and remaining playback blockers without exposing request credentials or key material.

## Playback Evidence Gate

The playback gate is driven by `qa/production_pilot_playback_evidence.json` and validated by `scripts/validate_playback_evidence.py`. A release path must be selected before final approval:

- `video` requires browser and LMS playback evidence.
- `pptx` requires PowerPoint playback evidence.
- `google_slides` requires Google Slides playback evidence.

Each playback record must identify the tested artifact checksum, player/application, tester, evidence reference, full playback completion, audible narration, and any unresolved defects routed to stable `slide_id` values.

## Next Integrations

- Fill target-player playback evidence for the selected release path.
- Add a source package selector for additional nursing topics.
- Add deck/video preview links after playback artifacts are generated and verified.
