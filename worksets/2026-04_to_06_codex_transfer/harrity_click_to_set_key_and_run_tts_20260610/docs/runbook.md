# Slide Script TTS Runbook

## Preconditions
1. Lesson package exists.
2. Slide IDs are stable.
3. Narration scripts are finalized.
4. Each slide has narration_script_status = script_locked.
5. OPENAI_API_KEY is available in environment.

## Steps
1. Generate or update manifests/slide_script_tts_manifest.json.
2. Validate the manifest.
3. Render audio.
4. Review manifests/tts_render_qa.json.
5. Attach audio files to video/audio handoff package.

## Commands
```bash
python scripts/validate_slide_script_tts_manifest.py manifests/slide_script_tts_manifest.json
python scripts/render_slide_script_tts.py
```

## Failure Policy
Do not use local robotic fallback TTS. If OpenAI TTS cannot run, block and record the failure.

## Release Criteria
- Validation passed.
- All expected audio files exist.
- tts_render_qa.json exists.
- All slide IDs in audio QA match slide contract.
