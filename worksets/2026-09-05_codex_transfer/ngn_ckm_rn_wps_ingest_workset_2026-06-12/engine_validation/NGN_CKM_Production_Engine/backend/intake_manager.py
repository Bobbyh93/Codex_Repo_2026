"""Default intake-folder and bundled-taxonomy helpers."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .chunk_workflow import create_source_table_from_chunk_folder
from .index_catalog import catalog_summary

ROOT = Path(__file__).resolve().parents[1]
INTAKE_ROOT = ROOT / "intake"
DATA_CHUNKER_OUTPUT = INTAKE_ROOT / "data_chunker_output"
PIPELINE_JSON = INTAKE_ROOT / "pipeline_json"
SOURCE_TABLES = INTAKE_ROOT / "source_tables"
SOURCE_DOCUMENTS = INTAKE_ROOT / "source_documents"
BUNDLED_TAXONOMY = ROOT / "bundled_taxonomy"
DEFAULT_SOURCE_TABLE = BUNDLED_TAXONOMY / "master_taxonomy_base.csv"


def ensure_intake_structure() -> None:
    for path in [DATA_CHUNKER_OUTPUT, PIPELINE_JSON, SOURCE_TABLES, SOURCE_DOCUMENTS, BUNDLED_TAXONOMY]:
        path.mkdir(parents=True, exist_ok=True)


def intake_status() -> dict[str, Any]:
    ensure_intake_structure()
    chunk_files = [p for p in DATA_CHUNKER_OUTPUT.rglob("*.json") if p.is_file()]
    return {
        "intake_root": str(INTAKE_ROOT),
        "data_chunker_output": str(DATA_CHUNKER_OUTPUT),
        "pipeline_json": str(PIPELINE_JSON),
        "source_tables": str(SOURCE_TABLES),
        "source_documents": str(SOURCE_DOCUMENTS),
        "chunk_json_count": len(chunk_files),
        "recommended_message": "Set Data Chunker Pro output to the app intake folder so the app can process chunk files without upload.",
    }


def process_data_chunker_output(use_ai: bool | None = None) -> dict[str, Any]:
    ensure_intake_structure()
    chunk_files = [p for p in DATA_CHUNKER_OUTPUT.rglob("*.json") if p.is_file()]
    if not chunk_files:
        raise FileNotFoundError(
            f"no_chunk_json_found_in_app_intake: put Data Chunker Pro JSON output in {DATA_CHUNKER_OUTPUT}"
        )
    return create_source_table_from_chunk_folder(DATA_CHUNKER_OUTPUT, use_ai=use_ai)


def bundled_taxonomy_status() -> dict[str, Any]:
    ensure_intake_structure()
    files = sorted(str(p.relative_to(ROOT)) for p in BUNDLED_TAXONOMY.rglob("*") if p.is_file())
    return {
        "bundle_dir": str(BUNDLED_TAXONOMY),
        "default_source_table": str(DEFAULT_SOURCE_TABLE),
        "files": files,
        "catalog_summary": catalog_summary(),
        "recommended_message": "Use the bundled taxonomy base when a separate topic workbook is not available.",
    }
