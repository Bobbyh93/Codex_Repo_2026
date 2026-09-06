# Harrity Lesson Builder Skill Update Patch

## Add Trigger Terms
Add these to skill description and routing notes:

- slide script TTS
- slide narration TTS
- OpenAI TTS
- OpenAI Speech API
- audio handoff
- video handoff
- tts manifest
- slide_script_tts_manifest
- locked speaker notes
- locked narration script
- render slide audio
- one audio file per slide

## Add Reference File
references/slide-script-tts-contract.md

## Add Scripts
scripts/validate_slide_script_tts_manifest.py
scripts/render_slide_script_tts.py

## Add Runtime Config Fields
Merge templates/runtime_config.audio_patch.json into runtime_config.template.json or project runtime_config.json.

## Add Package Outputs
- manifests/slide_script_tts_manifest.json
- manifests/tts_render_qa.json
- audio/slide_narration/*.mp3
- handoff/audio_handoff.json
- handoff/video_handoff.json

## Controlled Rule
Harrity Lesson Builder generates the locked slide script and manifest. Slide Script TTS Renderer generates audio and QA logs.
