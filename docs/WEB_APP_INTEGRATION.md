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
| `daily_worksets/*.json` | Current daily work order |

## Design Boundary

This is an operations web app, not a marketing page. It prioritizes dense status, blocker visibility, traceable artifacts, and daily execution handoff.

## Next Integrations

- Add a committed production source package selector.
- Add an approved `lesson_spec.json` view once the first source-grounded pilot is ready.
- Add a TTS asset table after a valid OpenAI key produces MP3s.
- Add playback evidence cards for video, PowerPoint, and LMS release paths.
