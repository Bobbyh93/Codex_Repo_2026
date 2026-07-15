# Codex Repo 2026

Persistent source-of-truth scaffold for the Harrity Lesson Builder and systems
integration worksets.

This repository is intentionally state-driven. ChatGPT or Codex automations
should read the JSON files under `state/`, choose the next incomplete work
package, generate a bounded daily work order, and stop. Production work such as
OpenAI TTS, PPTX binding, Google Slides mutation, video assembly, and release QA
must be executed by a real runner such as Codex, GitHub Actions, n8n, Make, or a
local script with explicit credentials and files available.

## Current Control Pattern

```text
state/*.json
    -> scripts/validate_state.py
    -> scripts/create_daily_workset.py
    -> daily_worksets/YYYY-MM-DD.{json,md}
```

The daily workset generator does not depend on chat history or sandbox files.
If required artifacts or credentials are missing, it produces a dependency
checklist instead of claiming production output.

## Run Locally

```powershell
python scripts/validate_state.py
python scripts/credential_guard.py
python scripts/create_daily_workset.py --out-dir daily_worksets
```

`scripts/credential_guard.py` is safe to run before OpenAI work. It scans this
repository for committed credential artifacts without reading external key files
or logging secret values.

## GitHub Actions

`.github/workflows/daily-workset.yml` runs the same validation and workset
generation on a schedule or by manual dispatch. It uploads the generated daily
workset as a workflow artifact and does not commit or publish production files.
