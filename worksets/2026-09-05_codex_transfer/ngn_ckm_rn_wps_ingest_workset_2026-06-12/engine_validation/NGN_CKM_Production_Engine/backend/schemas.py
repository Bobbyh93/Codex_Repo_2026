"""Shared schema contracts for the NGN -> CKM platform."""
from __future__ import annotations

TAXONOMY_SCHEMA = [
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
]

BUILD_SCHEMA = [
    "outline",
    "slides",
    "scripts",
    "case_study",
    "answer_key",
    "remediation_map",
    "artifacts",
]

VALIDATION_SCHEMA = ["status", "errors", "warnings"]
DEPLOYMENT_SCHEMA = ["batch_dir", "files", "record_count"]

REQUIRED_ARTIFACTS = [
    "outline.json",
    "blueprint.json",
    "scripts.md",
    "case_study.md",
    "answer_key.md",
    "remediation_map.json",
    "deck.pptx",
]

CKM_REQUIRED_FILES = [
    "knowledge_cards.csv",
    "card_objective_map.csv",
    "curriculum_objectives.csv",
    "card_sources.csv",
    "card_links.csv",
    "card_research_notes.csv",
    "exception_report.csv",
    "import_manifest.json",
    "ckm_import_package.json",
]

REQUIRED_CARD_FIELDS = ["card_id", "card_title", "concept", "status", "evidence_status"]

ISSUE_WEIGHTS = {
    "missing_sources": 3,
    "missing_objectives": 3,
    "missing_links": 2,
    "not_submitted_for_review": 1,
    "compression_block": 5,
}


def missing_fields(data: dict, fields: list[str]) -> list[str]:
    """Return required fields that are absent or blank."""
    missing: list[str] = []
    for field in fields:
        value = data.get(field)
        if value is None or value == "" or value == []:
            missing.append(field)
    return missing
