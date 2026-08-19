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
    -> apps/nurse-prep-web/
    -> scripts/create_daily_workset.py
    -> daily_worksets/YYYY-MM-DD.{json,md}
    -> scripts/run_hourly_ops.py
    -> manifests/hourly_ops_status.json + logs/hourly_ops_YYYY-MM-DD.jsonl
```

The daily workset generator does not depend on chat history or sandbox files.
If required artifacts or credentials are missing, it produces a dependency
checklist instead of claiming production output.

## Run Locally

```powershell
python scripts/validate_state.py
python scripts/credential_guard.py
python scripts/validate_nurse_prep_web.py
python scripts/create_daily_workset.py --out-dir daily_worksets
python scripts/run_hourly_ops.py
```

`scripts/credential_guard.py` is safe to run before OpenAI work. It scans this
repository for committed credential artifacts without reading external key files
or logging secret values.

`scripts/run_hourly_ops.py` is the lightweight hourly runner. It logs the
selected work package, validation status, credential-safety status, static
workbench health, and the paid AI cost guard. If the last authenticated OpenAI
probe failed with `invalid_api_key`, the next live paid retry ceiling is
recorded as `$0.00`.

## Nurse Prep EB Workbench

Run a local static server from the repository root:

```powershell
python -m http.server 5179
```

Open:

```text
http://localhost:5179/apps/nurse-prep-web/
```

## GitHub Actions

`.github/workflows/daily-workset.yml` runs validation and workset generation on
a daily schedule or by manual dispatch. `.github/workflows/hourly-ops.yml` runs
the safe hourly check/log loop, including credential guard, static workbench
validation, hourly status generation, and artifact upload. Neither workflow
commits, publishes, or calls paid production APIs.
