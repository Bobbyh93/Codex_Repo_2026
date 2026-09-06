# NGN CKM Production Engine

Deployable Windows/local app package for taxonomy-controlled NGN lesson production and CKM batch governance.

## Production rules preserved

The app enforces the same production discipline as the Harrity lesson-builder standards: topic/source grounding before slide generation, outline before blueprint, separated learner-facing slide text and narration/scripts, layout-safe deck rendering, real artifact creation, CKM validation, and failure-mode control for drift, channel collision, missing artifacts, and layout density.

## Major capabilities

- FastAPI backend with static browser dashboard.
- SQLite system of record for jobs, artifacts, logs, CKM cards, review workflow, reviewer feedback, and CPI.
- Taxonomy Gate 0 validation.
- NGN builder: outline, blueprint, scripts, case study, answer key, remediation map, PPTX deck.
- Diagram generation with cache and type/style presets.
- OpenAI Images API bridge: set `DIAGRAM_PROVIDER=openai` and `OPENAI_API_KEY`.
- Offline deterministic diagram provider: default `DIAGRAM_PROVIDER=local` for testing.
- Full workbook runner: processes every eligible row in `TopicMasterClean` or equivalent workbook sheets by default.
- CKM exporter, validator, dry-run importer, remediation, scoring/routing, approval workflow.
- Nightly scheduler with CPI report generation.
- PyInstaller + NSIS packaging scaffolds.

## Run locally

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python start_app.py
```

Open: <http://127.0.0.1:8000>

## Run sample pipeline

```bash
python scripts/run_sample.py
```

## Use real image generation

```bat
set DIAGRAM_PROVIDER=openai
set OPENAI_API_KEY=sk-...
set OPENAI_IMAGE_MODEL=gpt-image-1
set OPENAI_IMAGE_SIZE=1024x1024
python start_app.py
```

Endpoint:

```bash
POST /diagram/generate
{
  "topic": "Generic process for Concept A",
  "diagram_type": "flow",
  "style": "ati"
}
```

## Run full workbook

The full workbook runner is not sampled by default. It processes all eligible rows unless `--max-rows` is explicitly provided.

```bash
python scripts/run_full_workbook.py "C:\path\TopicMasterClean.xlsx"
```

Optional sheet override:

```bash
python scripts/run_full_workbook.py "C:\path\TopicMasterClean.xlsx" --sheet TopicMasterClean
```

API:

```bash
POST /workbook/run-full
{
  "workbook_path": "C:\\path\\TopicMasterClean.xlsx",
  "sheet_name": "TopicMasterClean",
  "live_import": true,
  "include_review_rows": false,
  "max_rows": null
}
```

## Nightly builds and CPI reports

Configure `config/nightly_config.json` or use the dashboard.

```json
{
  "enabled": true,
  "run_time_local": "02:00",
  "workbook_path": "C:\\path\\TopicMasterClean.xlsx",
  "sheet_name": "TopicMasterClean",
  "live_import": true,
  "include_review_rows": false,
  "max_rows": null
}
```

Start automatically:

```bat
set ENABLE_SCHEDULER=1
python start_app.py
```

Manual endpoints:

- `POST /scheduler/run-nightly`
- `POST /reports/cpi/build`
- `GET /scheduler/status`

Reports are written to `reports/` as JSON and Markdown.

## Build Windows executable

```bat
scripts\build_windows.bat
```

## Build NSIS installer

Install NSIS, then:

```bat
makensis installer\installer.nsi
```

## Notes

This ZIP is a deployable project package. It is not a precompiled `.exe`. Build scripts are included for the selected PyInstaller + NSIS packaging path.

## Full Workbook input rule

Use a source/control workbook or CSV for **Full Workbook Batch**. Valid examples are `TopicMasterClean`, `Master_Taxonomy_Base`, `Lesson_Ingest_Queue`, or `samples/multi_topic_input_template.csv`. Do **not** use generated CKM output files such as `knowledge_cards.csv`; those are downstream artifacts and are now blocked by the runner. See `HOW_IT_WORKS_AND_MULTI_TOPIC_GUIDE.md`.


## Practical product direction

Read `PRODUCT_MVP_AND_WORKFLOW.md` for the intended user flow, the product goal, the minimum viable production scope, duplicate handling modes, and the recommended Data Chunker Pro import path.

## Built indexes shipped in the app

The application now ships with a real concept/module catalog generated from the available concept transition guides. Those indexes are stored in `indexes/` and are used to populate the dropdown selectors in the user interface by default.


## Default no-upload intake path

Set Data Chunker Pro output to `intake\data_chunker_output`. The app can now process that folder directly from Step 1 without requiring a manual folder upload.

## Bundled taxonomy and concept tables

The app now ships with a bundled taxonomy bundle in `bundled_taxonomy/`. Use `bundled_taxonomy/master_taxonomy_base.csv` as the default source/control table when no separate workbook is available.

The bundled taxonomy folder also includes `course_content_master_template.xlsx` as a starting master workbook shell.

## Version 2.3 UX and extraction update

Version 2.3 simplifies the app into four steps and standardizes Data Chunker Pro:

1. Use built-in topics, or save Data Chunker Pro JSON to `intake/data_chunker_output`.
2. Process the intake folder.
3. Pick topic/subtopics.
4. Build.

When an OpenAI API key is saved, the app uses the ChatGPT API to clean chunk text and extract topic rows automatically. If the API is unavailable, deterministic local extraction still runs.
