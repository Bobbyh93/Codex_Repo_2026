# Harrity Lesson Builder Codex Integration Brief

Source ChatGPT conversation: `https://chatgpt.com/c/69e632e7-2510-8327-be40-6ec9b8d3b33f`

Conversation title observed in browser: `Harrity Lesson Builder Test`

## Imported Artifact

- Artifact name: `Harrity Lesson Builder Frontend`
- Exact copied source: `chatgpt-artifact/App.tsx`
- Runnable Codex preview: `standalone/index.html`

The frontend work centers on a slide narration payload builder:

- TTS models: `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`
- Voices: `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `onyx`, `nova`, `sage`, `shimmer`, `verse`, `marin`, `cedar`
- Audio formats: `mp3`, `wav`, `aac`, `flac`, `opus`, `pcm`
- Payload shape:

```json
{
  "model": "gpt-4o-mini-tts",
  "voice": "alloy",
  "response_format": "mp3",
  "input": "trimmed narration text"
}
```

## Frontend Changes Visible In ChatGPT

- Removed `lucide-react` dependency causing CDN fetch failures.
- Removed shadcn `Select` components.
- Replaced those controls with native typed `<select>` controls.
- Kept type-safe model, voice, and format handling.
- Added a runtime test for prompt/instruction leakage in script text.

## Backend And Control-Plane Work Visible In ChatGPT

The conversation referenced these backend/control-plane targets:

- `backend/pipeline/status.py`
- `backend/pipeline/gates.py`
- `backend/pipeline/validators/schema_validator.py`
- `backend/pipeline/validators/artifact_validator.py`
- `backend/job_runner.py`
- New Control Plane Gates page.
- Backend endpoints to run and inspect gate status.

Core gate rule:

- Lesson generation must be gated by `taxonomy/lesson_ingest_queue.json`.
- Missing source inventory, crosswalk, CKM, taxonomy Gate 0, ingest queue, or final QA artifacts should create blocked status artifacts.

Acceptance check from the visible ChatGPT response:

1. Open a project.
2. Go to Control Plane Gates.
3. Click Run Control Plane Gates.
4. Confirm `status/*.json` files are created.
5. Missing prerequisites should show as `blocked`, not silently continue.

## Codex Handoff Notes

- The local standalone preview intentionally does not call OpenAI or write lesson artifacts.
- Wire the prepared payload to the backend TTS route only after the gate status is `pass`.
- Treat prompt/instruction leakage detection as a guardrail, not a complete content safety validator.
- Keep the native select implementation unless a project design system provides accessible select primitives without adding brittle runtime dependencies.
