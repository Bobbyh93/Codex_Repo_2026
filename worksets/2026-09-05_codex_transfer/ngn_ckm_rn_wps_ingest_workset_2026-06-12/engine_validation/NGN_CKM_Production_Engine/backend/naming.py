"""Deterministic naming helpers for runs, artifacts, and master workbooks."""
from __future__ import annotations

import re
from typing import Any


def slugify(value: Any, max_len: int = 48) -> str:
    text = re.sub(r"[^A-Za-z0-9]+", "_", str(value or "").strip())
    text = re.sub(r"_+", "_", text).strip("_")
    text = text.lower() or "item"
    return text[:max_len].strip("_") or "item"


def run_label(taxonomy: dict[str, Any], job_id: str | None = None) -> str:
    course = slugify(taxonomy.get("course_name") or taxonomy.get("subject_area") or "course", 24)
    content = slugify(taxonomy.get("content_area") or taxonomy.get("concept") or "content", 28)
    concept = slugify(taxonomy.get("concept") or "concept", 28)
    module = str(taxonomy.get("module_number") or "").strip()
    module_prefix = f"m{module}_" if module else ""
    short_job = slugify((job_id or "run")[:8], 12)
    return f"{course}__{module_prefix}{content}__{concept}__{short_job}"


def artifact_name(taxonomy: dict[str, Any], job_id: str, kind: str, suffix: str) -> str:
    stem = run_label(taxonomy, job_id)
    kind_slug = slugify(kind, 28)
    if suffix and not str(suffix).startswith("."):
        suffix = "." + str(suffix)
    return f"{stem}__{kind_slug}{suffix}"


def workbook_filename(course_name: str, content_area: str, concept: str | None, kind: str) -> str:
    parts = [slugify(course_name, 28), slugify(content_area, 28)]
    if concept:
        parts.append(slugify(concept, 28))
    parts.append(slugify(kind, 28))
    return "__".join([p for p in parts if p]) + ".xlsx"
