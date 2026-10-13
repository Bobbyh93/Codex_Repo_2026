"""Default catalog and option helpers for the lesson production application."""
from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INDEX_DIR = ROOT / "indexes"


def _load_json(name: str, fallback: Any) -> Any:
    path = INDEX_DIR / name
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def load_topic_catalog() -> list[dict[str, str]]:
    path = INDEX_DIR / "default_topic_catalog.csv"
    if not path.exists():
        return []
    with path.open("r", newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_module_catalog() -> list[dict[str, Any]]:
    return _load_json("concept_module_catalog.json", [])


def load_options() -> dict[str, Any]:
    return {
        "course_areas": _load_json("course_area_options.json", []),
        "content_areas": _load_json("content_area_options.json", []),
        "specialty_areas": _load_json("specialty_area_options.json", []),
        "priority_frameworks": _load_json("priority_framework_options.json", []),
        "lesson_goals": _load_json("lesson_goal_options.json", []),
        "duplicate_policies": _load_json("duplicate_policy_options.json", []),
        "module_catalog": load_module_catalog(),
        "project_presets": [
            {"value": "new_lesson_package", "label": "New lesson package"},
            {"value": "curriculum_master_update", "label": "Add to course master workbook"},
            {"value": "revise_existing_package", "label": "Revise existing lesson package"},
            {"value": "case_practice_set", "label": "Case practice set"},
            {"value": "objective_refresh", "label": "Objective refresh only"},
        ],
        "build_profiles": [
            {"value": "fast", "label": "Fast draft"},
            {"value": "standard", "label": "Standard production"},
            {"value": "enhanced", "label": "Enhanced lesson"},
            {"value": "comprehensive", "label": "Comprehensive lesson"},
        ],
        "deck_styles": [
            {"value": "clean_academic", "label": "Clean academic"},
            {"value": "visual_teaching", "label": "Visual teaching"},
            {"value": "case_led", "label": "Case-led"},
        ],
        "manifest": _load_json("index_manifest.json", {}),
    }


def catalog_summary() -> dict[str, Any]:
    rows = load_topic_catalog()
    concepts = sorted({(row.get("concept") or "").strip() for row in rows if (row.get("concept") or "").strip()})
    subtopics = sorted({(row.get("subtopic") or "").strip() for row in rows if (row.get("subtopic") or "").strip()})
    nclex = sorted({(row.get("nclex_category") or "").strip() for row in rows if (row.get("nclex_category") or "").strip()})
    return {
        "record_count": len(rows),
        "concept_count": len(concepts),
        "subtopic_count": len(subtopics),
        "nclex_category_count": len(nclex),
        "module_count": len(load_module_catalog()),
    }


def find_catalog_rows(concept: str | None = None, content_area: str | None = None) -> list[dict[str, str]]:
    rows = load_topic_catalog()
    out = []
    for row in rows:
        if concept and (row.get("concept") or "").strip().lower() != concept.strip().lower():
            continue
        if content_area and (row.get("content_area") or "").strip().lower() != content_area.strip().lower():
            continue
        out.append(row)
    return out


def infer_defaults_for_concept(concept: str) -> dict[str, Any]:
    rows = find_catalog_rows(concept=concept)
    if rows:
        exemplar_names = sorted({r.get("subtopic", "").strip() for r in rows if r.get("subtopic")})
        first = rows[0]
        return {
            "course_name": first.get("course_area") or first.get("program_area") or "Nursing",
            "subject_area": first.get("course_area") or first.get("program_area") or "Nursing",
            "content_area": first.get("content_area") or concept,
            "specialty_area": first.get("course_area") or "General",
            "nclex_category": first.get("nclex_category") or "Unspecified",
            "source_anchor": first.get("source_anchor") or concept,
            "exemplars": exemplar_names,
        }
    for row in load_module_catalog():
        if (row.get("concept") or "").strip().lower() == concept.strip().lower():
            volume = row.get("volume") or "Concepts"
            return {
                "course_name": volume,
                "subject_area": volume,
                "content_area": row.get("concept") or concept,
                "specialty_area": row.get("part") or volume,
                "nclex_category": "Unspecified",
                "source_anchor": f"{volume} Module {row.get('module_number')}",
                "exemplars": row.get("exemplars") or [],
            }
    return {
        "course_name": "Nursing",
        "subject_area": "Nursing",
        "content_area": concept,
        "specialty_area": "General",
        "nclex_category": "Unspecified",
        "source_anchor": concept,
        "exemplars": [],
    }
