# Harrity Lesson Builder Operating Architecture

## Problem Being Solved

The prior scheduled-task approach failed because it depended on long chat
history, temporary sandbox files, and unavailable runtime credentials. This
repository moves the work into persistent state files and executable scripts.

## Separation Of Responsibilities

| Layer | Responsibility |
| --- | --- |
| ChatGPT / Codex | Planning, review, bounded implementation, work order generation |
| GitHub repository | Source of truth for state, manifests, scripts, docs, and audit trail |
| GitHub Actions | Repeatable validation and scheduled workset generation |
| OpenAI Platform | Structured lesson generation and per-slide TTS when credentials exist |
| Local/Codex runner | PPTX, Slides, audio, video, and QA artifact generation |
| LMS / Drive / storage | Distribution targets after release gates pass |

## Canonical Lesson Pipeline

```text
source intake
-> extraction
-> crosswalk normalization
-> CKM cards
-> taxonomy gate 0
-> lesson ingest queue
-> lesson spec
-> slide deck and speaker notes
-> per-slide TTS
-> audio manifest
-> binding manifest
-> PPTX / Slides / video output
-> machine QA
-> application playback evidence
-> release decision
```

## Release Rule

No generated artifact reaches `export_pass` only because a file exists. Release
requires the relevant QA evidence for the target path:

- PPTX audio requires embedded media evidence plus PowerPoint playback evidence.
- Google Slides audio requires Drive upload, binding readback, notes parity, and
  playback evidence.
- Narrated video requires machine media QA plus browser/LMS playback evidence.

## Daily Automation Rule

Daily automation must select one bounded work package and produce a work order.
If live credentials, source files, or production assets are absent, it must
record blockers and next actions rather than regenerating stale architecture.
