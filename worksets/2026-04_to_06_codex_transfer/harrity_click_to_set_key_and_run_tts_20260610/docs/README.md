# Slide Script TTS Integration Package

Date: 2026-06-10
Decision ID: HLB-AUDIO-001
Canonical ID: slide_script_tts

## Purpose
This package integrates OpenAI TTS into the Harrity Lesson Builder pipeline using a controlled handoff manifest.

## Core Rule
The TTS renderer consumes locked narration scripts, not the deck directly.

## Files
- references/slide-script-tts-contract.md
- templates/slide_script_tts_manifest.schema.json
- templates/runtime_config.audio_patch.json
- manifests/slide_script_tts_manifest.example.json
- scripts/validate_slide_script_tts_manifest.py
- scripts/render_slide_script_tts.py
- docs/runbook.md
- docs/skill_update_patch.md

## Runtime Requirement
Set OPENAI_API_KEY before rendering audio.

## Validation
python scripts/validate_slide_script_tts_manifest.py manifests/slide_script_tts_manifest.example.json

## Rendering
Copy the example manifest to manifests/slide_script_tts_manifest.json, edit scripts, then run:

python scripts/render_slide_script_tts.py

## Output
- audio/slide_narration/S001.mp3
- manifests/tts_render_qa.json
