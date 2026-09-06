"""80/20 feedback-weighted pre-validation."""
from __future__ import annotations

from typing import Any


def build_learned_map(feedback_rows: list[dict[str, Any]], field: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in feedback_rows:
        if row.get("field") == field and row.get("corrected_value"):
            key = row.get("concept") or row.get("card_id")
            if key:
                out[str(key)] = str(row["corrected_value"])
    return out


def pre_validate(slides: list[dict[str, Any]], taxonomy_index: dict, source_index: dict, feedback_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    learned_sources = build_learned_map(feedback_rows, "source_refs")
    learned_objectives = build_learned_map(feedback_rows, "objective_id")
    for slide in slides:
        concept = slide.get("concept") or slide.get("lesson_section") or slide.get("title")
        if not slide.get("source_refs"):
            if concept in learned_sources:
                slide["source_refs"] = [learned_sources[concept]]
            elif concept in source_index:
                slide["source_refs"] = [source_index[concept]]
        if not slide.get("objective_id"):
            tax = taxonomy_index.get(concept, {}) if isinstance(taxonomy_index, dict) else {}
            if concept in learned_objectives:
                slide["objective_id"] = learned_objectives[concept]
            elif tax.get("objective_id"):
                slide["objective_id"] = tax["objective_id"]
        slide.setdefault("pre_validation_flag", "ok")
    return slides
