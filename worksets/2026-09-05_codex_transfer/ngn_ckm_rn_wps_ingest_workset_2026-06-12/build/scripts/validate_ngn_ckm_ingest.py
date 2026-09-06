from __future__ import annotations

import csv
import json
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(r"C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12")
ENGINE_ROOT = ROOT / "engine_validation" / "NGN_CKM_Production_Engine"
CSV_PATH = ROOT / "source_tables" / "rn_wps_process_lesson_ingest_queue.csv"
XLSX_PATH = ROOT / "source_tables" / "rn_wps_process_lesson_ingest_queue.xlsx"
MANIFEST_PATH = ROOT / "ngn_ckm_ingest_manifest.json"
TRACE_PATH = ROOT / "support" / "source_trace.json"
PAYLOAD_PREVIEW_PATH = ROOT / "support" / "pipeline_payloads_preview.json"
QA_PATH = ROOT / "ngn_ckm_ingest_qa.json"
HANDOFF_PATH = ROOT / "handoff_ngn_ckm_ingest.md"

REQUIRED_HEADERS = [
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
CKM_OUTPUT_MARKERS = {"card_id", "card_title", "status"}


def sha256_file(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()


def normalize_workbook_rels_for_engine(path: Path) -> bool:
    """The bundled engine reader prepends xl/ to relationship targets.

    Artifact-created workbooks use absolute targets like /xl/worksheets/sheet1.xml,
    which the reader resolves as xl/xl/worksheets/sheet1.xml. Normalize worksheet
    targets to worksheets/sheetN.xml so validation uses the engine's own loader.
    """

    changed = False
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp_path = Path(tmp.name)
    try:
        with zipfile.ZipFile(path, "r") as zin, zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "xl/_rels/workbook.xml.rels":
                    text = data.decode("utf-8-sig")
                    root = ET.fromstring(text)
                    ns = "{http://schemas.openxmlformats.org/package/2006/relationships}"
                    for rel in root.findall(ns + "Relationship"):
                        target = rel.attrib.get("Target", "")
                        rel_type = rel.attrib.get("Type", "")
                        if rel_type.endswith("/worksheet") and target.startswith("/xl/worksheets/"):
                            rel.set("Target", target.replace("/xl/", "", 1))
                            changed = True
                    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
                zout.writestr(item, data)
        if changed:
            shutil.move(str(tmp_path), str(path))
        else:
            tmp_path.unlink(missing_ok=True)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise
    return changed


def read_csv_rows() -> list[dict[str, str]]:
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def validate_headers(rows: list[dict[str, str]]) -> dict:
    headers = list(rows[0].keys()) if rows else []
    return {
        "headers": headers,
        "required_headers_present": headers == REQUIRED_HEADERS,
        "ckm_output_markers_present": sorted(set(h.lower() for h in headers) & CKM_OUTPUT_MARKERS),
    }


def load_with_engine() -> dict:
    sys.path.insert(0, str(ENGINE_ROOT))
    from backend.full_workbook_runner import load_workbook_payloads

    csv_sheet, csv_payloads = load_workbook_payloads(CSV_PATH, include_review_rows=False)
    xlsx_sheet, xlsx_payloads = load_workbook_payloads(XLSX_PATH, sheet_name="Lesson_Ingest_Queue", include_review_rows=False)
    all_sheet, all_payloads = load_workbook_payloads(XLSX_PATH, sheet_name="Lesson_Ingest_Queue", include_review_rows=True)
    return {
        "csv_sheet": csv_sheet,
        "csv_payload_count_include_review_false": len(csv_payloads),
        "xlsx_sheet": xlsx_sheet,
        "xlsx_payload_count_include_review_false": len(xlsx_payloads),
        "xlsx_payload_count_include_review_true": len(all_payloads),
        "first_clean_payload": xlsx_payloads[0] if xlsx_payloads else None,
    }


def write_handoff(qa: dict) -> None:
    HANDOFF_PATH.write_text(
        "\n".join(
            [
                "# NGN/CKM RN WPS Ingest Pack Handoff",
                "",
                f"Generated: {datetime.now().date().isoformat()}",
                "",
                "## Status",
                "",
                "The RN WPS process-level ingest pack is local, engine-ready, and validated with the bundled NGN/CKM source-table loader. No lesson generation was run, no OpenAI calls were made, and no Drive or Notion assets were changed.",
                "",
                "## Primary Files",
                "",
                f"- Source workbook: `{XLSX_PATH}`",
                f"- Source CSV: `{CSV_PATH}`",
                f"- Manifest: `{MANIFEST_PATH}`",
                f"- Source trace: `{TRACE_PATH}`",
                f"- Pipeline payload preview: `{PAYLOAD_PREVIEW_PATH}`",
                f"- QA: `{QA_PATH}`",
                "",
                "## QA Summary",
                "",
                f"- Ingest rows: {qa['ingest_row_count']}",
                f"- Clean default rows: {qa['clean_default_row_count']}",
                f"- Review-held rows: {qa['review_held_row_count']}",
                f"- Engine CSV validation payloads, include_review_rows=false: {qa['engine_loader']['csv_payload_count_include_review_false']}",
                f"- Engine XLSX validation payloads, include_review_rows=false: {qa['engine_loader']['xlsx_payload_count_include_review_false']}",
                f"- Engine XLSX validation payloads, include_review_rows=true: {qa['engine_loader']['xlsx_payload_count_include_review_true']}",
                f"- Source hashes unchanged: {qa['source_hashes_unchanged']}",
                "",
                "## Use",
                "",
                "Use `source_tables\\rn_wps_process_lesson_ingest_queue.xlsx` with the NGN/CKM Full Workbook runner. Default engine settings with `include_review_rows=false` will process only the clean row. Use `include_review_rows=true` only after reviewer approval of the held rows.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    trace = json.loads(TRACE_PATH.read_text(encoding="utf-8"))
    payload_preview = json.loads(PAYLOAD_PREVIEW_PATH.read_text(encoding="utf-8"))
    rows = read_csv_rows()
    header_status = validate_headers(rows)
    rels_normalized = normalize_workbook_rels_for_engine(XLSX_PATH)
    engine_loader = load_with_engine()

    source_hashes_unchanged = True
    source_hash_checks = []
    for source in manifest["sources"]:
        path = Path(source["source_path"])
        current = sha256_file(path)
        ok = current == source["source_hash"]
        source_hashes_unchanged = source_hashes_unchanged and ok
        source_hash_checks.append(
            {
                "source_name": source["source_name"],
                "source_kind": source["source_kind"],
                "expected_hash": source["source_hash"],
                "current_hash": current,
                "unchanged": ok,
            }
        )

    review_held_count = sum(1 for row in rows if row["needs_review"].strip().lower() == "true")
    clean_count = len(rows) - review_held_count
    qa = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "ingest_pack_id": manifest["ingest_pack_id"],
        "csv_path": str(CSV_PATH),
        "xlsx_path": str(XLSX_PATH),
        "manifest_path": str(MANIFEST_PATH),
        "source_trace_path": str(TRACE_PATH),
        "payload_preview_path": str(PAYLOAD_PREVIEW_PATH),
        "ingest_row_count": len(rows),
        "clean_default_row_count": clean_count,
        "review_held_row_count": review_held_count,
        "source_process_count": manifest["counts"]["source_process_count"],
        "source_task_count": manifest["counts"]["source_task_count"],
        "source_bridge_count": manifest["counts"]["source_bridge_count"],
        "source_trace_row_count": len(trace),
        "payload_preview_clean_count": len(payload_preview["include_review_rows_false_payloads"]),
        "payload_preview_all_count": len(payload_preview["include_review_rows_true_payloads"]),
        "header_status": header_status,
        "xlsx_relationship_targets_normalized_for_engine": rels_normalized,
        "engine_loader": engine_loader,
        "source_hash_checks": source_hash_checks,
        "source_hashes_unchanged": source_hashes_unchanged,
        "no_ckm_output_markers": not header_status["ckm_output_markers_present"],
        "lesson_generation_run": False,
        "openai_api_calls_made": False,
        "drive_or_notion_changed": False,
        "validation_status": "pass",
    }
    if not header_status["required_headers_present"]:
        qa["validation_status"] = "fail"
    if header_status["ckm_output_markers_present"]:
        qa["validation_status"] = "fail"
    if engine_loader["xlsx_payload_count_include_review_false"] != clean_count:
        qa["validation_status"] = "fail"
    if engine_loader["xlsx_payload_count_include_review_true"] != len(rows):
        qa["validation_status"] = "fail"
    if not source_hashes_unchanged:
        qa["validation_status"] = "fail"

    QA_PATH.write_text(json.dumps(qa, indent=2), encoding="utf-8")
    write_handoff(qa)
    print(json.dumps({
        "qa_path": str(QA_PATH),
        "handoff_path": str(HANDOFF_PATH),
        "validation_status": qa["validation_status"],
        "ingest_rows": qa["ingest_row_count"],
        "clean_default_rows": qa["clean_default_row_count"],
        "review_held_rows": qa["review_held_row_count"],
        "source_hashes_unchanged": qa["source_hashes_unchanged"],
    }, indent=2))


if __name__ == "__main__":
    main()
