"""Gate 0 taxonomy validation and normalization."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .index_catalog import infer_defaults_for_concept
from .schemas import TAXONOMY_SCHEMA, missing_fields

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def _load_json(name: str) -> dict[str, Any]:
    path = DATA / name
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_taxonomy(payload: dict[str, Any]) -> dict[str, Any]:
    taxonomy = dict(payload.get("taxonomy") or payload)
    nclex_index = _load_json("nclex_taxonomy.json")
    ncjmm_index = _load_json("ncjmm_map.json")
    source_index = _load_json("source_index.json")

    concept = taxonomy.get("concept") or taxonomy.get("concept_name")
    if not concept:
        raise ValueError("taxonomy_missing_concept")

    inferred = infer_defaults_for_concept(str(concept))
    exemplars = taxonomy.get("exemplars") or taxonomy.get("exemplar_names") or inferred.get("exemplars") or [concept]
    if isinstance(exemplars, str):
        exemplars = [e.strip() for e in exemplars.replace(";", ",").split(",") if e.strip()]

    taxonomy["concept"] = str(concept).strip()
    taxonomy["exemplars"] = [str(x).strip() for x in exemplars if str(x).strip()] or [str(concept).strip()]
    taxonomy.setdefault("course_name", inferred.get("course_name", taxonomy.get("subject_area", "Nursing")))
    taxonomy.setdefault("project_name", payload.get("project_name") or taxonomy.get("project_name") or "new_lesson_package")
    taxonomy.setdefault("subject_area", inferred.get("subject_area", "Nursing"))
    taxonomy.setdefault("content_area", inferred.get("content_area", taxonomy["concept"]))
    taxonomy.setdefault("specialty_area", inferred.get("specialty_area", "General"))
    taxonomy.setdefault("nclex_category", nclex_index.get(taxonomy["concept"], inferred.get("nclex_category", "Unspecified")))
    taxonomy.setdefault("ncjmm_primary", ncjmm_index.get(taxonomy["concept"], "Recognize Cues"))
    taxonomy.setdefault("priority_framework", taxonomy.get("priority_framework") or "Airway, Breathing, Circulation")
    taxonomy.setdefault("source_anchor", source_index.get(taxonomy["concept"], inferred.get("source_anchor", f"source::{taxonomy['concept']}")))
    taxonomy.setdefault("evidence_status", "sourced")
    taxonomy.setdefault("needs_review", False)
    taxonomy.setdefault("duplicate_policy", payload.get("duplicate_policy") or payload.get("duplicate_action") or taxonomy.get("duplicate_policy") or "create_new_version")
    taxonomy.setdefault("build_profile", payload.get("build_profile") or taxonomy.get("build_profile") or "standard")
    taxonomy.setdefault("deck_style", payload.get("deck_style") or taxonomy.get("deck_style") or "clean_academic")
    return taxonomy


def taxonomy_gatekeeper(payload: dict[str, Any]) -> dict[str, Any]:
    taxonomy = normalize_taxonomy(payload)
    missing = missing_fields(taxonomy, TAXONOMY_SCHEMA)
    errors: list[str] = []
    if missing:
        errors.extend([f"missing_{field}" for field in missing])
    if taxonomy.get("needs_review") in [True, "true", "TRUE", "yes", 1]:
        errors.append("taxonomy_needs_review")
    return {"pass": not errors, "status": "pass" if not errors else "fail", "data": taxonomy, "errors": errors}
