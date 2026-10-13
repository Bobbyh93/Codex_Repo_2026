from __future__ import annotations

import csv
import hashlib
import json
import re
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(r"C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12")
SOURCE_DATA = Path(r"C:\Users\RHarrity\Documents\Codex\rn_wps_prelicensure_crosswalk_workset_2026-06-12\build\intermediate\rn_wps_prelicensure_crosswalk_data.json")
SOURCE_RELEASE = Path(r"C:\Users\RHarrity\Documents\Codex\rn_wps_prelicensure_crosswalk_workset_2026-06-12\outputs\rn_wps_prelicensure_crosswalk_release.xlsx")
ENGINE_ZIP = Path(r"C:\Users\RHarrity\Downloads\NGN_CKM_Production_Engine_v2_3.zip")
SOURCE_TABLE_DIR = ROOT / "source_tables"
SUPPORT_DIR = ROOT / "support"
TRACE_PATH = SUPPORT_DIR / "source_trace.json"
PAYLOAD_PREVIEW_PATH = SUPPORT_DIR / "pipeline_payloads_preview.json"
MANIFEST_PATH = ROOT / "ngn_ckm_ingest_manifest.json"
CSV_PATH = SOURCE_TABLE_DIR / "rn_wps_process_lesson_ingest_queue.csv"
ROWS_JSON_PATH = SUPPORT_DIR / "lesson_ingest_queue_rows.json"

ENGINE_HEADERS = [
    "concept",
    "exemplars",
    "subject_area",
    "content_area",
    "specialty_area",
    "nclex_category",
    "ncjmm_primary",
    "priority_framework",
    "source_anchor",
    "evidence_status",
    "needs_review",
    "module_number",
]

DEFAULTS = {
    "subject_area": "Prelicensure Nursing",
    "content_area": "Professional Practice",
    "specialty_area": "Registered Nurse Apprenticeship",
    "nclex_category": "Unspecified",
    "ncjmm_primary": "Recognize Cues",
    "priority_framework": "Nursing process",
    "evidence_status": "sourced",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def source_record(path: Path, source_kind: str) -> dict[str, Any]:
    stat = path.stat()
    return {
        "source_kind": source_kind,
        "source_name": path.name,
        "source_path": str(path),
        "source_hash": sha256_file(path),
        "source_size_bytes": stat.st_size,
        "source_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
    }


def safe_exemplar(value: str) -> str:
    value = re.sub(r"^[A-Z]\.\s+", "", value or "").strip()
    value = re.sub(r"[,;|]+", " -", value)
    value = re.sub(r"\s+", " ", value).strip(" -")
    return value[:180]


def module_number(index: int) -> str:
    return f"RN-WPS-{index:03d}"


def make_source_anchor(process: str, tasks: list[dict[str, Any]], source_data_path: Path) -> str:
    variants = sorted({f"{task['rapids_code']}:{task['variant']}" for task in tasks})
    coords = []
    for task in tasks:
        coords.append(f"{task['source_file']}#T{task['source_table_index']}:R{task['source_row_index']}")
    coord_preview = "; ".join(coords[:12])
    if len(coords) > 12:
        coord_preview += f"; +{len(coords) - 12} more"
    return f"WPS process: {process}; variants: {', '.join(variants)}; source rows: {coord_preview}; crosswalk_data: {source_data_path}"


def pipeline_payload(row: dict[str, Any]) -> dict[str, Any]:
    exemplars = [part.strip() for part in row["exemplars"].split(",") if part.strip()] or [row["concept"]]
    return {
        "taxonomy": {
            "concept": row["concept"],
            "exemplars": exemplars,
            "subject_area": row["subject_area"],
            "content_area": row["content_area"],
            "specialty_area": row["specialty_area"],
            "nclex_category": row["nclex_category"],
            "ncjmm_primary": row["ncjmm_primary"],
            "priority_framework": row["priority_framework"],
            "source_anchor": row["source_anchor"],
            "evidence_status": row["evidence_status"],
            "needs_review": row["needs_review"] == "true",
            "module_number": row["module_number"],
        }
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=ENGINE_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    SOURCE_TABLE_DIR.mkdir(parents=True, exist_ok=True)
    SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(SOURCE_DATA.read_text(encoding="utf-8"))

    tasks_by_process = defaultdict(list)
    for task in data["fact_wps_tasks"]:
        tasks_by_process[task["wps_process_id"]].append(task)

    bridges_by_process = defaultdict(list)
    for bridge in data["suggested_wps_prelicensure_bridge"]:
        bridges_by_process[bridge["process_raw"]].append(bridge)

    rows = []
    trace = []
    for idx, process in enumerate(sorted(data["dim_wps_process"], key=lambda row: row["process_raw"]), start=1):
        tasks = sorted(
            tasks_by_process[process["wps_process_id"]],
            key=lambda row: (row["source_file"], row["source_table_index"], row["source_row_index"]),
        )
        bridges = bridges_by_process[process["process_raw"]]
        review_count = sum(1 for bridge in bridges if bridge.get("needs_review"))
        bridge_count = len(bridges)
        confident_count = bridge_count - review_count
        review_rate = review_count / bridge_count if bridge_count else 1.0
        review_heavy = review_count > confident_count
        exemplars = []
        seen = set()
        for task in tasks:
            exemplar = safe_exemplar(task["task_text_raw"])
            key = exemplar.lower()
            if exemplar and key not in seen:
                seen.add(key)
                exemplars.append(exemplar)
        if not exemplars:
            exemplars = [process["process_raw"]]
        row = {
            "concept": process["process_raw"],
            "exemplars": ", ".join(exemplars),
            **DEFAULTS,
            "source_anchor": make_source_anchor(process["process_raw"], tasks, SOURCE_DATA),
            "needs_review": "true" if review_heavy else "false",
            "module_number": module_number(idx),
        }
        rows.append(row)
        trace.append(
            {
                "module_number": row["module_number"],
                "concept": row["concept"],
                "needs_review": row["needs_review"] == "true",
                "review_policy": "needs_review=true when review_count > confident_count",
                "task_count": len(tasks),
                "bridge_count": bridge_count,
                "review_count": review_count,
                "confident_count": confident_count,
                "review_rate": round(review_rate, 4),
                "source_anchor": row["source_anchor"],
                "tasks": [
                    {
                        "wps_task_id": task["wps_task_id"],
                        "source_file": task["source_file"],
                        "rapids_code": task["rapids_code"],
                        "variant": task["variant"],
                        "source_table_index": task["source_table_index"],
                        "source_row_index": task["source_row_index"],
                        "task_raw": task["task_raw"],
                    }
                    for task in tasks
                ],
            }
        )

    write_csv(CSV_PATH, rows)
    ROWS_JSON_PATH.write_text(json.dumps({"sheet_name": "Lesson_Ingest_Queue", "headers": ENGINE_HEADERS, "rows": rows}, indent=2), encoding="utf-8")
    TRACE_PATH.write_text(json.dumps(trace, indent=2), encoding="utf-8")
    PAYLOAD_PREVIEW_PATH.write_text(
        json.dumps(
            {
                "include_review_rows_false_payloads": [pipeline_payload(row) for row in rows if row["needs_review"] != "true"],
                "include_review_rows_true_payloads": [pipeline_payload(row) for row in rows],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    sources = [
        source_record(SOURCE_DATA, "crosswalk_data_json"),
        source_record(SOURCE_RELEASE, "crosswalk_release_workbook"),
        source_record(ENGINE_ZIP, "ngn_ckm_engine_zip"),
    ]
    for record in data["wps_source_files"]:
        if record["source_kind"] in {"wps_docx", "prelicensure_workbook"}:
            sources.append(source_record(Path(record["source_path"]), record["source_kind"]))

    manifest = {
        "ingest_pack_id": "ngn_ckm_rn_wps_ingest_workset_2026-06-12",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_policy": "local_read_only_sources",
        "generation_policy": "process_level_ngn_ckm_source_control_rows",
        "ai_api_use": "none",
        "engine_zip": str(ENGINE_ZIP),
        "source_table_csv": str(CSV_PATH),
        "source_table_xlsx": str(SOURCE_TABLE_DIR / "rn_wps_process_lesson_ingest_queue.xlsx"),
        "sheet_name": "Lesson_Ingest_Queue",
        "required_headers": ENGINE_HEADERS,
        "review_policy": "Rows are needs_review=true when WPS-to-prelicensure review_count exceeds confident_count. Engine include_review_rows=false excludes those rows by default.",
        "sources": sources,
        "counts": {
            "source_process_count": len(data["dim_wps_process"]),
            "source_task_count": len(data["fact_wps_tasks"]),
            "source_bridge_count": len(data["suggested_wps_prelicensure_bridge"]),
            "ingest_row_count": len(rows),
            "clean_default_row_count": sum(1 for row in rows if row["needs_review"] != "true"),
            "review_held_row_count": sum(1 for row in rows if row["needs_review"] == "true"),
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    source_hash_after = {record["source_path"]: sha256_file(Path(record["source_path"])) for record in sources}
    print(
        json.dumps(
            {
                "rows_json": str(ROWS_JSON_PATH),
                "csv": str(CSV_PATH),
                "manifest": str(MANIFEST_PATH),
                "source_trace": str(TRACE_PATH),
                "payload_preview": str(PAYLOAD_PREVIEW_PATH),
                "ingest_rows": len(rows),
                "clean_default_rows": manifest["counts"]["clean_default_row_count"],
                "review_held_rows": manifest["counts"]["review_held_row_count"],
                "source_hashes_unchanged": all(record["source_hash"] == source_hash_after[record["source_path"]] for record in sources),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
