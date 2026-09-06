"""Full-workbook/source-table execution runner.

IMPORTANT: this runner expects a SOURCE CONTROL workbook/table, not a CKM export.
Good inputs are TopicMasterClean, Master_Taxonomy_Base, Lesson_Ingest_Queue,
or a CSV with concept/exemplars/taxonomy columns.

Generated outputs such as knowledge_cards.csv are intentionally rejected by
default because they are downstream CKM artifacts, not curriculum source tables.
"""
from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
from typing import Any

from .cpi_engine import get_cpi_summary, run_cpi_trend_analysis
from .job_store import log_event
from .run_pipeline import run_pipeline
from .xlsx_utils import read_first_matching_sheet

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

SHEET_CANDIDATES = [
    "Lesson_Ingest_Queue",
    "Master_Taxonomy_Base",
    "TopicMasterClean",
    "Topic_Register",
    "Master_Map",
    "Filtered_Source_Table",
    "Sheet1",
]

COLUMN_ALIASES = {
    # Do not include card_title here by default; card_title is a CKM output field.
    "concept": ["entity_name", "concept_name", "canonical_topic", "topic", "concept", "module_title", "module"],
    "exemplars": ["exemplars", "exemplar", "exemplar_name", "sample_raw_topics", "card_title"],
    "subject_area": ["subjects", "subject", "subject_area", "course", "course_area"],
    "content_area": ["content_area", "topic_family", "body_system", "concept_family", "content"],
    "specialty_area": ["specialty_area", "specialty", "source_families", "specialty_domain"],
    "nclex_category": ["nclex_categories", "nclex_category", "nclex_client_need_category", "nclex"],
    "ncjmm_primary": ["ncjmm", "ncjmm_primary", "clinical_judgment_function", "cjmm"],
    "priority_framework": ["priority_framework", "priority", "priority_frameworks"],
    "source_anchor": ["source_anchor", "resources", "resource", "source", "source_trace", "page_anchor"],
    "evidence_status": ["evidence_status", "source_status"],
    "needs_review": ["needs_manual_review_any", "needs_review", "review_flag"],
    "module_number": ["module_number", "module", "module_id"],
}

SOURCE_TABLE_REQUIRED_HINTS = {
    "concept",
    "entity_name",
    "concept_name",
    "topic",
    "exemplar",
    "exemplars",
    "nclex_categories",
    "nclex_category",
    "subject_area",
    "subjects",
}
CKM_EXPORT_MARKERS = {"card_id", "card_title", "status", "evidence_status"}
CKM_EXPORT_FILENAMES = {"knowledge_cards.csv", "card_objective_map.csv", "card_sources.csv", "card_links.csv", "curriculum_objectives.csv"}


def _headers(rows: list[dict[str, Any]]) -> set[str]:
    if not rows:
        return set()
    return {str(k).strip().lower() for k in rows[0].keys()}


def _looks_like_ckm_export(path: str | Path, rows: list[dict[str, Any]]) -> bool:
    p = Path(path)
    headers = _headers(rows)
    if p.name.lower() in CKM_EXPORT_FILENAMES:
        return True
    # A card table has card_id/card_title/status but usually lacks source-control fields.
    if {"card_id", "card_title", "status"}.issubset(headers) and not (headers & {"entity_name", "exemplar", "exemplars", "source_anchor", "nclex_categories"}):
        return True
    return False


def _validate_source_table(path: str | Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        raise ValueError("source_table_empty: the selected workbook/sheet has no data rows")
    headers = _headers(rows)
    if _looks_like_ckm_export(path, rows):
        raise ValueError(
            "ckm_export_input_not_supported: the selected file looks like generated CKM output "
            "(for example knowledge_cards.csv). Full Workbook Batch requires a source/control workbook, "
            "such as TopicMasterClean, Master_Taxonomy_Base, Lesson_Ingest_Queue, or a CSV with "
            "concept/exemplars/taxonomy columns. Use samples/multi_topic_input_template.csv as the format."
        )
    if not (headers & SOURCE_TABLE_REQUIRED_HINTS):
        raise ValueError(
            "source_table_schema_unrecognized: expected source columns such as concept, entity_name, "
            "topic, exemplar, exemplars, subject_area, or nclex_category."
        )


def _lookup(row: dict[str, Any], key: str, default: Any = "") -> Any:
    lower_to_actual = {str(col).strip().lower(): col for col in row.keys()}
    for alias in COLUMN_ALIASES.get(key, [key]):
        actual = lower_to_actual.get(alias.lower())
        if actual is not None:
            val = row.get(actual)
            if val is not None and str(val).strip() != "":
                return val
    return default


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "yes", "1", "y", "review", "needs_review"}


def _split_exemplars(value: Any, fallback: str) -> list[str]:
    if value is None or str(value).strip() == "":
        return [fallback]
    raw = str(value)
    parts = [p.strip() for p in raw.replace(";", ",").replace("|", ",").split(",") if p.strip()]
    return parts or [fallback]


def row_to_payload(row: dict[str, Any], row_number: int) -> dict[str, Any]:
    concept = str(_lookup(row, "concept", f"Workbook Row {row_number}")).strip()
    exemplars = _split_exemplars(_lookup(row, "exemplars", ""), concept)
    subject = str(_lookup(row, "subject_area", "Subject Area A")).strip() or "Subject Area A"
    content = str(_lookup(row, "content_area", subject)).strip() or subject
    specialty = str(_lookup(row, "specialty_area", subject)).strip() or subject
    nclex = str(_lookup(row, "nclex_category", "Category A")).strip() or "Category A"
    ncjmm = str(_lookup(row, "ncjmm_primary", "Recognize Cues")).strip() or "Recognize Cues"
    priority = str(_lookup(row, "priority_framework", "Priority Framework A")).strip() or "Priority Framework A"
    source = str(_lookup(row, "source_anchor", f"workbook_row:{row_number}")).strip() or f"workbook_row:{row_number}"
    evidence = str(_lookup(row, "evidence_status", "sourced")).strip() or "sourced"
    needs_review = _boolish(_lookup(row, "needs_review", False))
    module_number = str(_lookup(row, "module_number", "")).strip()
    return {
        "taxonomy": {
            "concept": concept,
            "exemplars": exemplars,
            "subject_area": subject,
            "content_area": content,
            "specialty_area": specialty,
            "nclex_category": nclex,
            "ncjmm_primary": ncjmm,
            "priority_framework": priority,
            "source_anchor": source,
            "evidence_status": evidence,
            "needs_review": needs_review,
            "module_number": module_number,
        }
    }


def _coerce_max_rows(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        n = int(value)
        return n if n > 0 else None
    except Exception:
        return None


def load_workbook_payloads(workbook_path: str | Path, sheet_name: str | None = None, include_review_rows: bool = False, max_rows: int | None = None) -> tuple[str, list[dict[str, Any]]]:
    sheet, rows = read_first_matching_sheet(workbook_path, SHEET_CANDIDATES, sheet_name)
    _validate_source_table(workbook_path, rows)
    max_rows = _coerce_max_rows(max_rows)
    payloads: list[dict[str, Any]] = []
    for idx, row in enumerate(rows, start=2):
        payload = row_to_payload(row, idx)
        tax = payload["taxonomy"]
        if not tax["concept"] or tax["concept"].lower().startswith("nan"):
            continue
        if tax.get("needs_review") and not include_review_rows:
            continue
        payloads.append(payload)
        if max_rows is not None and len(payloads) >= max_rows:
            break
    return sheet, payloads


def run_full_workbook(workbook_path: str | Path, sheet_name: str | None = None, live_import: bool = True, include_review_rows: bool = False, max_rows: int | None = None, job_prefix: str | None = None, run_options: dict[str, Any] | None = None) -> dict[str, Any]:
    started = datetime.utcnow().isoformat()
    job_prefix = job_prefix or f"workbook_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    sheet, payloads = load_workbook_payloads(workbook_path, sheet_name, include_review_rows, max_rows)
    run_options = run_options or {}
    results = []
    for i, payload in enumerate(payloads, start=1):
        payload["taxonomy"].update({k: v for k, v in run_options.items() if v not in (None, "") and k in {"project_name", "course_name", "subject_area", "content_area", "specialty_area", "nclex_category", "ncjmm_primary", "priority_framework", "build_profile", "deck_style", "run_label"}})
        if run_options.get("duplicate_action") or run_options.get("duplicate_policy"):
            payload["duplicate_action"] = run_options.get("duplicate_action") or run_options.get("duplicate_policy")
        if run_options.get("source_type"):
            payload["source_type"] = run_options.get("source_type")
        concept_key = payload["taxonomy"]["concept"].replace(" ", "_").replace("/", "_")[:48]
        job_id = f"{job_prefix}_{i:04}_{concept_key}"
        result = run_pipeline({**payload, "live_import": live_import}, job_id=job_id, live_import=live_import)
        results.append({
            "job_id": job_id,
            "concept": payload["taxonomy"]["concept"],
            "exemplars": payload["taxonomy"].get("exemplars", []),
            "status": result.get("status"),
            "phase": result.get("phase"),
            "error": result.get("error", ""),
            "batch_dir": (result.get("deployment") or {}).get("batch_dir", ""),
        })
        log_event(job_id, "workbook", f"source-workbook row {i}/{len(payloads)} processed")
    cpi = run_cpi_trend_analysis()
    status = "complete" if payloads and all(r["status"] == "complete" for r in results) else ("no_eligible_rows" if not payloads else "partial_or_failed")
    summary = {
        "status": status,
        "workbook_path": str(workbook_path),
        "sheet": sheet,
        "started_at": started,
        "completed_at": datetime.utcnow().isoformat(),
        "row_count": len(payloads),
        "success_count": sum(1 for r in results if r["status"] == "complete"),
        "failure_count": sum(1 for r in results if r["status"] != "complete"),
        "live_import": live_import,
        "include_review_rows": include_review_rows,
        "max_rows": max_rows,
        "results": results,
        "cpi": cpi,
        "cpi_summary": get_cpi_summary(),
    }
    report_base = REPORT_DIR / f"{job_prefix}_full_workbook_report"
    report_base.with_suffix(".json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    md_lines = ["# Full Workbook Run Report", "", f"Workbook: `{workbook_path}`", f"Sheet: `{sheet}`", f"Rows processed: {summary['row_count']}", f"Success: {summary['success_count']}", f"Failed: {summary['failure_count']}", "", "| Job | Concept | Exemplars | Status | Phase | Error |", "|---|---|---|---|---|---|"]
    for r in results:
        md_lines.append(f"| {r['job_id']} | {r['concept']} | {', '.join(r.get('exemplars', []))} | {r['status']} | {r['phase']} | {str(r['error']).replace('|','/')} |")
    report_base.with_suffix(".md").write_text("\n".join(md_lines), encoding="utf-8")
    summary["report_json"] = str(report_base.with_suffix(".json"))
    summary["report_md"] = str(report_base.with_suffix(".md"))
    return summary
