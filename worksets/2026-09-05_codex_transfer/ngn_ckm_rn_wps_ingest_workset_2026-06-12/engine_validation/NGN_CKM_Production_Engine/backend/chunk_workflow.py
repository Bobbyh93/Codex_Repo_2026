"""Helpers for bringing Data Chunker Pro folder exports into the lesson workflow."""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from .chunk_ingestion import build_concept_packages, load_chunks
from .index_catalog import infer_defaults_for_concept
from .openai_content_processor import api_key_available, call_openai_topic_extraction
from .xlsx_utils import write_csv

ROOT = Path(__file__).resolve().parents[1]
INPUT_CHUNKS = ROOT / "input_chunks"
INPUT_CHUNKS.mkdir(exist_ok=True)
INPUT_WORKBOOKS = ROOT / "input_workbooks"
INPUT_WORKBOOKS.mkdir(exist_ok=True)


def save_uploaded_chunk_folder(folder_name: str, files: list[dict[str, str]]) -> Path:
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_folder = "".join(ch if ch.isalnum() or ch in {"_", "-"} else "_" for ch in (folder_name or "chunk_folder"))
    root = INPUT_CHUNKS / f"{stamp}_{safe_folder}"
    root.mkdir(parents=True, exist_ok=True)
    for item in files:
        rel = Path(item.get("relative_path") or item.get("name") or "file.json")
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(item.get("content", ""), encoding="utf-8")
    return root


def _summarize_section_text(section: dict[str, Any]) -> str:
    content = str(section.get("content", "")).strip().replace("\n", " ")
    return content if len(content) <= 180 else content[:177].rstrip() + "..."


def _write_rows(rows: list[dict[str, Any]], source_table_name: str) -> Path:
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    table_path = INPUT_WORKBOOKS / f"{stamp}_{source_table_name}.csv"
    write_csv(table_path, rows)
    return table_path


def _local_rows_from_packages(packages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for package in packages:
        concept = package.get("concept") or "Unassigned concept"
        exemplars = package.get("exemplars") or [concept]
        source_refs = []
        for section in package.get("sections", []):
            source_refs.extend(section.get("source_refs") or [])
        inferred = infer_defaults_for_concept(concept)
        rows.append({
            "concept": concept,
            "exemplars": ", ".join(exemplars),
            "source_anchor": "; ".join(dict.fromkeys(source_refs)) or "Data Chunker Pro output",
            "subject_area": inferred.get("subject_area") or "Nursing",
            "content_area": inferred.get("content_area") or "General",
            "specialty_area": inferred.get("specialty_area") or "General",
            "nclex_category": inferred.get("nclex_category") or "Unspecified",
            "ncjmm_primary": inferred.get("ncjmm_primary") or "Recognize Cues",
            "priority_framework": inferred.get("priority_framework") or "General Priority",
            "needs_review": "FALSE",
            "evidence_status": "source-grounded",
            "sample_source_text": " | ".join(_summarize_section_text(s) for s in package.get("sections", [])[:2]),
        })
    return rows


def _packages_from_ai_rows(ai_rows: list[dict[str, Any]], chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    full_text = "\n\n".join(str(c.get("text", ""))[:1000] for c in chunks[:30])
    packages = []
    for row in ai_rows:
        concept = row.get("concept") or "Unassigned concept"
        packages.append({
            "concept": concept,
            "exemplars": row.get("exemplars") or [concept],
            "sections": [{
                "title": concept,
                "content": row.get("clean_summary") or full_text[:3000],
                "source_refs": [row.get("source_anchor") or "Data Chunker Pro output"],
            }],
        })
    return packages


def create_source_table_from_chunk_folder(folder_path: str | Path, use_ai: bool | None = None) -> dict[str, Any]:
    folder = Path(folder_path)
    chunks = load_chunks(folder)
    if not chunks:
        raise FileNotFoundError(f"no_readable_json_chunks_found:{folder}")

    use_ai = (os.environ.get("USE_OPENAI_FOR_EXTRACTION", "1") == "1") if use_ai is None else bool(use_ai)
    ai_result: dict[str, Any] | None = None
    rows: list[dict[str, Any]]
    packages: list[dict[str, Any]]
    extraction_mode = "local"
    warnings: list[str] = []

    if use_ai and api_key_available():
        try:
            ai_result = call_openai_topic_extraction(chunks)
            rows = []
            for row in ai_result.get("topics", []):
                rows.append({
                    "concept": row.get("concept"),
                    "exemplars": ", ".join(row.get("exemplars") or []),
                    "source_anchor": row.get("source_anchor"),
                    "subject_area": row.get("subject_area"),
                    "content_area": row.get("content_area"),
                    "specialty_area": row.get("specialty_area"),
                    "nclex_category": row.get("nclex_category"),
                    "ncjmm_primary": row.get("ncjmm_primary"),
                    "priority_framework": row.get("priority_framework"),
                    "needs_review": "TRUE" if row.get("needs_review") else "FALSE",
                    "evidence_status": row.get("evidence_status") or "source-grounded",
                    "sample_source_text": row.get("clean_summary") or "",
                })
            packages = _packages_from_ai_rows(ai_result.get("topics", []), chunks)
            extraction_mode = "openai"
            warnings = ai_result.get("warnings") or []
        except Exception as exc:
            packages = build_concept_packages(chunks)
            rows = _local_rows_from_packages(packages)
            warnings = [f"OpenAI extraction failed; local fallback used: {exc}"]
    else:
        packages = build_concept_packages(chunks)
        rows = _local_rows_from_packages(packages)
        if use_ai and not api_key_available():
            warnings = ["OpenAI extraction requested but no API key is configured; local fallback used."]

    table_path = _write_rows(rows, "data_chunker_source_table")
    return {
        "status": "processed",
        "folder": str(folder),
        "chunk_file_count": len(list(folder.rglob("*.json"))) if folder.is_dir() else 1,
        "chunk_count": len(chunks),
        "detected_topic_count": len(rows),
        "source_table_path": str(table_path),
        "topics": rows,
        "packages": packages,
        "extraction_mode": extraction_mode,
        "openai_used": extraction_mode == "openai",
        "warnings": warnings,
        "message": "OpenAI cleaned and extracted topics." if extraction_mode == "openai" else "Local extraction created topic rows.",
    }
