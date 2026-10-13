# v1.1 Upgrade Notes

Implemented upgrade set:

1. Real image generation bridge
   - `backend/diagram_service.py` now supports `DIAGRAM_PROVIDER=openai`.
   - Set `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, and `OPENAI_IMAGE_SIZE` to use OpenAI Images API.
   - Default `DIAGRAM_PROVIDER=local` remains a real deterministic PNG provider for offline testing.

2. Full workbook execution
   - `backend/full_workbook_runner.py` processes every eligible row in the selected workbook sheet by default.
   - Supports `TopicMasterClean`, `Topic_Register`, `GI_Concept A_Filter`, `Master_Map`, `Sheet1`, and CSV.
   - CLI: `python scripts/run_full_workbook.py <workbook>`.
   - API: `POST /workbook/run-full`.

3. Nightly builds and CPI reporting
   - `backend/scheduler.py` adds nightly scheduling and CPI report writing.
   - Configure via `config/nightly_config.json` or dashboard.
   - API: `/scheduler/status`, `/scheduler/config`, `/scheduler/run-nightly`, `/reports/cpi/build`.

4. Reviewer UX polish
   - `frontend/index.html` now includes a CKM review console, card detail drawer, workbook runner controls, scheduler controls, CPI report controls, validation badges, and clearer queue/artifact/log panels.
