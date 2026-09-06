"""Crosswalk builder for TopicMasterClean-like workbooks."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .xlsx_utils import read_first_matching_sheet, write_csv, write_simple_xlsx

SHEET_CANDIDATES = ["TopicMasterClean", "Topic_Register", "MasterCanonicalNext", "Sheet1"]


def normalize_key(value: Any) -> str:
    return str(value).strip().replace(" ", "_").replace("/", "_")


def _lookup(row: dict, *names: str, default: Any = "") -> Any:
    lower = {str(k).strip().lower(): k for k in row}
    for name in names:
        key = lower.get(name.lower())
        if key is not None and str(row.get(key, "")).strip():
            return row[key]
    return default


def build_crosswalk(workbook_path: str | Path, out_dir: str | Path, sheet_name: str | None = None) -> dict[str, str]:
    sheet, rows_in = read_first_matching_sheet(workbook_path, SHEET_CANDIDATES, sheet_name)
    if not rows_in:
        raise ValueError("No rows found in workbook")
    rows = []
    for row in rows_in:
        concept = _lookup(row, "entity_name", "concept", "topic", "card_title", "module", "tutorial")
        if not str(concept).strip():
            continue
        rows.append({
            "concept_id": normalize_key(concept),
            "concept": concept,
            "topic_master": concept,
            "subject": _lookup(row, "subjects", "subject", "subject_area"),
            "resource": _lookup(row, "resources", "resource", "source"),
            "source_family": _lookup(row, "source_families", "source_family"),
            "nclex_category": _lookup(row, "nclex_categories", "nclex_category", default="Physiological Adaptation"),
            "ncjmm": _lookup(row, "ncjmm", "ncjmm_primary", default="Recognize Cues"),
            "priority_framework": _lookup(row, "priority_framework", default="ABCs / Safety / Nursing Process"),
            "needs_review": _lookup(row, "needs_manual_review_any", "needs_review", default=""),
        })
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    objectives = [{
        "concept_id": r["concept_id"],
        "objective_id": f"{r['concept_id']}_OBJ",
        "nclex_category": r["nclex_category"],
        "ncjmm_primary": r["ncjmm"],
        "priority_framework": r["priority_framework"],
    } for r in rows]
    provenance = [{
        "concept_id": r["concept_id"],
        "source_type": r.get("source_family"),
        "source_name": r.get("resource"),
        "source_detail": r.get("topic_master"),
    } for r in rows]
    paths = {
        "Crosswalk_Master.csv": str(out / "Crosswalk_Master.csv"),
        "Crosswalk_Objectives.csv": str(out / "Crosswalk_Objectives.csv"),
        "Crosswalk_Provenance.csv": str(out / "Crosswalk_Provenance.csv"),
        "Crosswalk_Master.xlsx": str(out / "Crosswalk_Master.xlsx"),
    }
    write_csv(paths["Crosswalk_Master.csv"], rows)
    write_csv(paths["Crosswalk_Objectives.csv"], objectives)
    write_csv(paths["Crosswalk_Provenance.csv"], provenance)
    write_simple_xlsx(paths["Crosswalk_Master.xlsx"], {
        "Crosswalk_Master": rows,
        "Crosswalk_Objectives": objectives,
        "Crosswalk_Provenance": provenance,
        "Build_Log": [{"timestamp": "generated", "source_workbook": str(workbook_path), "source_sheet": sheet, "rows_processed": len(rows), "rows_flagged_review": sum(1 for r in rows if str(r.get('needs_review','')).lower() in {'true','1','yes'}), "notes": "full workbook crosswalk"}],
    })
    return paths
