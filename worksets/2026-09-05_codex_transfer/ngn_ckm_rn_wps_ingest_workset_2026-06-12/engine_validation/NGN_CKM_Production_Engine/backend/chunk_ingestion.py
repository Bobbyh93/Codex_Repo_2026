"""Data Chunker Pro compatible ingestion helpers."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

TEXT_KEYS = ("text", "content", "chunk", "body", "page_content", "clean_text")
TITLE_KEYS = ("section_hint", "heading", "title", "section", "concept", "topic")
FILE_KEYS = ("source_file", "file", "filename", "document", "source", "path")
PAGE_KEYS = ("page", "page_number", "start_page", "page_start")


def _find_value(d: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    meta = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
    for k in keys:
        if k in meta and meta[k] not in (None, ""):
            return meta[k]
    return None


def _flatten_records(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for item in data for x in _flatten_records(item)]
    if isinstance(data, dict):
        for key in ("chunks", "records", "documents", "items", "data"):
            if isinstance(data.get(key), list):
                return _flatten_records(data[key])
        return [data]
    return []


def normalize_chunk(raw: dict[str, Any], source_name: str, idx: int) -> dict[str, Any]:
    text = str(_find_value(raw, TEXT_KEYS) or "").strip()
    section = str(_find_value(raw, TITLE_KEYS) or "").strip()
    source_file = str(_find_value(raw, FILE_KEYS) or source_name).strip()
    page = _find_value(raw, PAGE_KEYS) or ""
    return {
        "chunk_id": raw.get("chunk_id") or raw.get("id") or f"{Path(source_name).stem}_{idx}",
        "text": text,
        "section_hint": section or "Unsorted source content",
        "source_file": Path(source_file).name if source_file else source_name,
        "page": page,
        "metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {},
        "raw": raw,
    }


def load_chunks(folder_path: str | Path) -> list[dict[str, Any]]:
    folder = Path(folder_path)
    files = [folder] if folder.is_file() and folder.suffix.lower() == ".json" else sorted(folder.rglob("*.json"))
    chunks: list[dict[str, Any]] = []
    for file in files:
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue
        for idx, rec in enumerate(_flatten_records(data), 1):
            chunk = normalize_chunk(rec, file.name, idx)
            if chunk["text"] or chunk["section_hint"]:
                chunks.append(chunk)
    return chunks


def group_by_concept(chunks: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for chunk in chunks:
        key = chunk.get("section_hint") or chunk.get("concept") or "Unsorted source content"
        groups[str(key).strip() or "Unsorted source content"].append(chunk)
    return dict(groups)


def build_concept_packages(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    packages = []
    for concept, group in group_by_concept(chunks).items():
        exemplars = sorted({str(c.get("section_hint") or concept).strip() for c in group if str(c.get("section_hint") or "").strip()}) or [concept]
        sections = []
        for c in group:
            source = c.get("source_file", "source")
            page = c.get("page", "")
            anchor = f"{source} p.{page}" if page not in (None, "") else str(source)
            sections.append({
                "title": c.get("section_hint") or concept,
                "content": c.get("text", ""),
                "source_refs": [anchor],
            })
        packages.append({"concept": concept, "exemplars": exemplars, "sections": sections})
    return packages
