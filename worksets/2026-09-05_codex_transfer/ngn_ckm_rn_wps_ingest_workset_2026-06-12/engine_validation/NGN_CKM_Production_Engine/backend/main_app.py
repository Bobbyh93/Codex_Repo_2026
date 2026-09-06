"""FastAPI application entrypoint."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4
import csv
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .api_ckm_browser import router as ckm_router
from .api_diagram import router as diagram_router
from .app_settings import apply_settings, clear_api_key, load_settings, save_settings
from .chunk_workflow import create_source_table_from_chunk_folder, save_uploaded_chunk_folder
from .cpi_engine import get_cpi_summary
from .curriculum_master import MASTER_CSV_DIR, MASTER_XLSX
from .db import init_db
from .duplicates import check_duplicate
from .full_workbook_runner import run_full_workbook
from .index_catalog import catalog_summary, find_catalog_rows, load_module_catalog, load_options, load_topic_catalog
from .intake_manager import bundled_taxonomy_status, ensure_intake_structure, intake_status, process_data_chunker_output
from .job_store import list_artifacts, list_jobs, list_logs, load_job
from .run_pipeline import run_pipeline
from .scheduler import (
    autostart_if_enabled,
    build_cpi_report,
    load_config,
    run_nightly_once,
    save_config,
    start_scheduler,
    status as scheduler_status,
)
from .xlsx_utils import read_first_matching_sheet

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
OUTPUT = ROOT / "output"
INPUT_WORKBOOKS = ROOT / "input_workbooks"
SAMPLES = ROOT / "samples"

app = FastAPI(title="Lesson Production Studio", version="2.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(ckm_router)
app.include_router(diagram_router)

if OUTPUT.exists():
    app.mount("/output", StaticFiles(directory=str(OUTPUT)), name="output")


@app.on_event("startup")
def startup():
    init_db()
    apply_settings()
    OUTPUT.mkdir(exist_ok=True)
    INPUT_WORKBOOKS.mkdir(exist_ok=True)
    ensure_intake_structure()
    autostart_if_enabled()


@app.get("/", response_class=HTMLResponse)
def index():
    index_path = FRONTEND / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "<h1>Lesson Production Studio</h1>"




def _workflow_validation(payload: dict) -> dict:
    run_type = payload.get("run_type", "single_topic")
    taxonomy = payload.get("taxonomy") or {}
    outputs = payload.get("requested_outputs") or {}
    issues = []
    warnings = []
    if run_type == "single_topic":
        if not taxonomy.get("concept"):
            issues.append("concept_required")
        if not taxonomy.get("exemplars"):
            issues.append("subtopics_required")
    else:
        if not payload.get("workbook_path") and not payload.get("source_package") and not payload.get("source_type"):
            issues.append("source_workbook_or_source_package_required")
    if outputs and not any(bool(v) for v in outputs.values()):
        issues.append("at_least_one_output_required")
    if taxonomy.get("needs_review") is True:
        issues.append("taxonomy_marked_needs_review")
    if not taxonomy.get("source_anchor") and run_type == "single_topic":
        warnings.append("source_anchor_missing")
    return {
        "run_type": run_type,
        "ready": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "next_step": "build" if len(issues) == 0 else "complete_prior_guided_step",
    }


@app.post("/workflow/validate")
def workflow_validate(payload: dict):
    return _workflow_validation(payload)

@app.get("/workflow/mvp")
def workflow_mvp():
    return {
        "goal": "Turn source material into a lesson package and a curriculum-ready record set with as little manual cleanup as possible.",
        "minimum_viable_product": [
            "Import a source topic table, use the bundled taxonomy base, or process the built-in Data Chunker intake folder.",
            "Select course, content area, concept, and subtopics from built indexes whenever possible.",
            "Generate a source-grounded lesson package with a readable slide deck, scripts, case study, answer key, and remediation map.",
            "Generate objective records, knowledge-card records, source records, and artifact links.",
            "Write the output into a course/content master workbook and detect exact duplicates before new files are created.",
        ],
        "supported_input_modes": ["source_table", "bundled_taxonomy_base", "chunk_folder", "chunk_pipeline_json", "app_intake_folder"],
        "design_rules": [
            "Use structured selects and switches instead of free text when an index already exists.",
            "Treat the built-in Data Chunker intake folder as the default no-upload chunk path.",
            "Name artifacts with course, content area, concept, and run label to prevent collisions.",
            "Keep the outline before slide drafting and enforce layout-safe rendering.",
        ],
    }


@app.get("/settings")
def settings_get():
    return load_settings(mask_secret=True)


@app.post("/settings")
def settings_set(payload: dict):
    return save_settings(payload)


@app.post("/settings/clear-api-key")
def settings_clear_api_key():
    return clear_api_key()


@app.get("/catalog/options")
def catalog_options():
    return {"options": load_options(), "summary": catalog_summary()}


@app.get("/catalog/topics")
def catalog_topics(content_area: str | None = None):
    rows = load_topic_catalog()
    if content_area:
        rows = [row for row in rows if (row.get("content_area") or "").strip().lower() == content_area.strip().lower()]
    return {"topics": rows}


@app.get("/catalog/modules")
def catalog_modules():
    return {"modules": load_module_catalog()}


@app.get("/catalog/subtopics")
def catalog_subtopics(concept: str):
    rows = find_catalog_rows(concept=concept)
    values = sorted({row.get("subtopic", "").strip() for row in rows if row.get("subtopic")})
    if not values:
        for row in load_module_catalog():
            if (row.get("concept") or "").strip().lower() == concept.strip().lower():
                values = row.get("exemplars") or []
                break
    return {"concept": concept, "subtopics": values}


@app.post("/duplicates/check")
def duplicates_check(payload: dict):
    taxonomy = payload.get("taxonomy") or payload
    return check_duplicate(taxonomy)


@app.post("/submit")
def submit_job(payload: dict):
    validation = _workflow_validation(payload)
    if not validation["ready"]:
        raise HTTPException(400, {"error": "workflow_not_ready", "validation": validation})
    job_id = payload.get("job_id") or uuid4().hex
    live_import = bool(payload.get("live_import", False))
    result = run_pipeline(payload, job_id=job_id, live_import=live_import)
    return {"job_id": job_id, "status": result.get("status"), "phase": result.get("phase"), "validation": validation, "result": result}


@app.post("/workbook/upload")
async def upload_workbook(request: Request, filename: str = "workbook"):
    safe_name = "".join(ch if ch.isalnum() or ch in {".", "_", "-"} else "_" for ch in filename).strip("._") or "workbook"
    ext = Path(safe_name).suffix.lower()
    if ext not in {".xlsx", ".csv"}:
        raise HTTPException(400, "unsupported_workbook_type: upload .xlsx or .csv")
    data = await request.body()
    if not data:
        raise HTTPException(400, "empty_upload")
    INPUT_WORKBOOKS.mkdir(exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dest = INPUT_WORKBOOKS / f"{stamp}_{safe_name}"
    dest.write_bytes(data)
    return {"status": "uploaded", "workbook_path": str(dest), "filename": safe_name, "size": len(data)}


@app.get("/workbook/sample-path")
def workbook_sample_path():
    sample = SAMPLES / "multi_topic_input_template.csv"
    return {"workbook_path": str(sample), "exists": sample.exists(), "message": "Use this as a source-table example for full-workbook runs."}

@app.get("/workbook/default-taxonomy-path")
def workbook_default_taxonomy_path():
    info = bundled_taxonomy_status()
    return {
        "workbook_path": info["default_source_table"],
        "exists": Path(info["default_source_table"]).exists(),
        "message": "Use the bundled taxonomy base that ships with the app. No separate taxonomy upload is required.",
    }


@app.get("/intake/status")
def intake_get_status():
    return intake_status()


@app.post("/intake/process-chunks")
def intake_process_chunks(use_ai: bool = True):
    try:
        return process_data_chunker_output(use_ai=use_ai)
    except FileNotFoundError as exc:
        raise HTTPException(400, str(exc))


@app.get("/taxonomy/bundle")
def taxonomy_bundle():
    return bundled_taxonomy_status()


@app.post("/workbook/preview")
def workbook_preview(payload: dict):
    workbook_path = payload.get("workbook_path")
    if not workbook_path:
        raise HTTPException(400, "workbook_path_required")
    try:
        sheet, rows = read_first_matching_sheet(workbook_path, ["Lesson_Ingest_Queue", "Master_Taxonomy_Base", "TopicMasterClean", "Topic_Register", "Sheet1"], payload.get("sheet_name"))
    except FileNotFoundError:
        raise HTTPException(400, f"workbook_not_found:{workbook_path}")
    return {"sheet": sheet, "row_count": len(rows), "preview_rows": rows[:10]}


@app.post("/workbook/run-full")
def run_workbook(payload: dict):
    workbook_path = payload.get("workbook_path")
    if not workbook_path:
        raise HTTPException(400, "workbook_path_required")
    try:
        return run_full_workbook(
            workbook_path,
            sheet_name=payload.get("sheet_name"),
            live_import=bool(payload.get("live_import", True)),
            include_review_rows=bool(payload.get("include_review_rows", False)),
            max_rows=payload.get("max_rows"),
            run_options={
                "project_name": payload.get("project_name"),
                "course_name": payload.get("course_name"),
                "content_area": payload.get("content_area"),
                "subject_area": payload.get("subject_area"),
                "specialty_area": payload.get("specialty_area"),
                "nclex_category": payload.get("nclex_category"),
                "ncjmm_primary": payload.get("ncjmm_primary"),
                "priority_framework": payload.get("priority_framework"),
                "build_profile": payload.get("build_profile"),
                "deck_style": payload.get("deck_style"),
                "duplicate_action": payload.get("duplicate_action") or payload.get("duplicate_policy"),
                "run_label": payload.get("run_label"),
                "source_type": payload.get("source_type", "source_table"),
            },
        )
    except FileNotFoundError:
        raise HTTPException(400, f"workbook_not_found:{workbook_path}")
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.post("/chunks/import-folder")
def chunks_import_folder(payload: dict):
    files = payload.get("files") or []
    if not files:
        raise HTTPException(400, "chunk_files_required")
    folder = save_uploaded_chunk_folder(payload.get("folder_name", "chunk_folder"), files)
    return create_source_table_from_chunk_folder(folder)


@app.get("/curriculum/master")
def curriculum_master_status():
    summary = {}
    MASTER_CSV_DIR.mkdir(parents=True, exist_ok=True)
    for csv_file in MASTER_CSV_DIR.glob("*.csv"):
        try:
            with csv_file.open("r", encoding="utf-8-sig") as f:
                count = max(sum(1 for _ in f) - 1, 0)
        except Exception:
            count = 0
        summary[csv_file.stem] = count
    return {"master_workbook": str(MASTER_XLSX), "exists": MASTER_XLSX.exists(), "tables": summary}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    state = load_job(job_id)
    if not state:
        raise HTTPException(404, "job_not_found")
    return state


@app.get("/jobs")
def jobs():
    return {"jobs": list_jobs()}


@app.get("/artifacts")
def artifacts(job_id: str | None = None):
    return {"artifacts": list_artifacts(job_id)}


@app.get("/logs")
def logs(job_id: str | None = None):
    return {"logs": list_logs(job_id)}


@app.get("/download")
def download(path: str):
    p = Path(path)
    if not p.exists():
        raise HTTPException(404, "file_not_found")
    return FileResponse(str(p), filename=p.name)


@app.get("/cpi/summary")
def cpi_summary():
    return get_cpi_summary()


@app.post("/reports/cpi/build")
def build_cpi_report_endpoint():
    return build_cpi_report()


@app.get("/scheduler/status")
def scheduler_get_status():
    return scheduler_status()


@app.post("/scheduler/start")
def scheduler_start():
    return start_scheduler()


@app.get("/scheduler/config")
def scheduler_get_config():
    return load_config()


@app.post("/scheduler/config")
def scheduler_set_config(payload: dict):
    config = load_config()
    config.update(payload)
    return save_config(config)


@app.post("/scheduler/run-nightly")
def scheduler_run_nightly(payload: dict | None = None):
    config = load_config()
    if payload:
        config.update(payload)
    return run_nightly_once(config)


@app.get("/health")
def health():
    return {"status": "ok"}
