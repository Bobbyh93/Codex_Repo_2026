# Nurse Prep EB Workbench

Static operations cockpit for the Harrity/Nurse Prep pipeline state in this repository.

Run it from the repository root so the app can read `state/`, `manifests/`, `qa/`, and `daily_worksets/`:

```powershell
python -m http.server 5179
```

Then open:

```text
http://localhost:5179/apps/nurse-prep-web/
```

The app is dependency-free and uses committed JSON artifacts as its data source.

It now includes a Production Pilot panel that reads the live OpenAI TTS pilot outputs:

- `qa/production_pilot_release_report.json`
- `qa/production_pilot_tts_report.json`
- `manifests/production_pilot_audio_manifest.json`
- `manifests/production_pilot_binding_manifest.json`
- `lessons/production_pilot/lesson_spec.json`
- `lessons/production_pilot/source_manifest.json`
- `qa/production_pilot_playback_evidence.json`
- `qa/production_pilot_playback_report.json`
