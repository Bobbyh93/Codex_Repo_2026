# Operations Runbook

## Daily Workset

Run:

```powershell
python scripts/validate_state.py
python scripts/credential_guard.py
python scripts/create_daily_workset.py --out-dir daily_worksets
```

Expected outputs:

```text
daily_worksets/YYYY-MM-DD.json
daily_worksets/YYYY-MM-DD.md
```

## Hourly Ops Check

Run:

```powershell
python scripts/run_hourly_ops.py
```

Expected outputs:

```text
manifests/hourly_ops_status.json
logs/hourly_ops_YYYY-MM-DD.jsonl
```

The hourly check is safe to run during launch work because it does not call paid
AI APIs. It records the selected work package, state validation, credential
guard status, static workbench health, and the paid-action cost guard. If the
last OpenAI authenticated probe failed with `invalid_api_key`, the live retry
ceiling remains `$0.00` until the key is replaced and a cheap runtime probe
passes.

The same check is scheduled by `.github/workflows/hourly-ops.yml` and uploads
the workset, hourly status, credential report, and JSONL log as workflow
artifacts. It is intentionally read-only against the repository and does not
publish, deploy, email, or call paid production APIs.

## Updating State

Update `state/work_queue.json` when a work package changes status. Use these
status values:

```text
pending
ready
next
in_progress
blocked
complete
cancelled
```

Use `blocked` when the next action requires missing artifacts, credentials,
platform capability, or human review.

## OpenAI Platform Boundary

Live OpenAI calls require `OPENAI_API_KEY` in the execution environment. Never
store API keys in state files, manifests, logs, worksets, or committed scripts.

Run the credential guard before any OpenAI-backed production packet:

```powershell
python scripts/credential_guard.py
python scripts/check_openai_runtime.py
```

`credential_guard.py` scans only repository files. It reports secret-like
filenames without opening them, checks text files for OpenAI key-shaped strings,
and never reads external key files such as `Downloads/openai-api-key.txt`.

## Production Execution Boundary

The daily workset generator does not generate MP3, PPTX, Google Slides, or video
files. It only tells the execution runner what the next bounded task is and what
evidence is required to mark it done.
