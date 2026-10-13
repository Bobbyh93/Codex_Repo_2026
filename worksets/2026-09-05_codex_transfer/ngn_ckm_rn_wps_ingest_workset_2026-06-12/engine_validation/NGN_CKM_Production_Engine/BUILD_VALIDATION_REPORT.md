# Build Validation Report

Package version: v1.1

Checks completed in container:

- Python syntax compile for backend and scripts using `python3 -S -m py_compile backend/*.py scripts/*.py`.
- Sample single-job pipeline run completed successfully before output cleanup.
- Full workbook runner tested against `/mnt/data/Solutions Table` with `--max-rows 2` and completed both rows successfully.
- Nightly scheduler run tested in no-workbook mode and produced CPI report files before output cleanup.
- Output, logs, report, and diagram cache directories were cleaned before final ZIP packaging.
- `pipeline.db` was reinitialized with schema only.

Operational notes:

- For real OpenAI image generation, set `DIAGRAM_PROVIDER=openai` and `OPENAI_API_KEY` before launch.
- Full workbook execution processes all eligible rows by default; `max_rows` is optional and only for development testing.
- Nightly builds require `config/nightly_config.json` to contain a valid `workbook_path`.
