"""CKM migration-ready batch generator."""
from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .job_store import add_artifact, log_event
from .naming import run_label

ROOT = Path(__file__).resolve().parents[1]
EXPORT_ROOT = ROOT / "output" / "ckm_exports"


def timestamp() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d_%H%M%S")


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = list(rows[0].keys()) if rows else ["note"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        if rows:
            writer.writerows(rows)


def generate_ckm_batch(job_id: str, state: dict[str, Any]) -> dict[str, Any]:
    taxonomy = state["taxonomy"]["data"]
    build = state["build"]
    slides = build["slides"]
    batch_dir = EXPORT_ROOT / f"ckm_batch_{timestamp()}__{run_label(taxonomy, job_id)}"
    batch_dir.mkdir(parents=True, exist_ok=True)

    cards: list[dict[str, Any]] = []
    objectives: dict[str, dict[str, Any]] = {}
    mappings: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []
    notes: list[dict[str, Any]] = []

    artifact_map = build.get("artifacts", {})

    for slide in slides:
        card_id = slide["slide_id"]
        exemplar = slide.get("slide_title", card_id).replace("NGN Case: ", "")
        objective_id = slide.get("objective_id") or f"{taxonomy['concept']}_{exemplar}_OBJ".replace(" ", "_")
        compression_meta = slide.get("compression_meta", [])
        cards.append(
            {
                "card_id": card_id,
                "card_title": slide.get("slide_title", card_id),
                "concept": taxonomy["concept"],
                "subject_area": taxonomy.get("subject_area"),
                "content_area": taxonomy.get("content_area"),
                "specialty_area": taxonomy.get("specialty_area"),
                "status": "reviewed",
                "evidence_status": taxonomy.get("evidence_status", "sourced"),
                "version": "v1.1_compressed" if compression_meta else "v1.0",
                "compression_applied": "yes" if compression_meta else "no",
                "compression_pass": "true" if all(row.get("loss_risk") != "high" for row in compression_meta) else "false",
            }
        )
        objectives[objective_id] = {
            "objective_id": objective_id,
            "concept": taxonomy["concept"],
            "exemplar": exemplar,
            "nclex_category": taxonomy["nclex_category"],
            "ncjmm_primary": taxonomy["ncjmm_primary"],
            "priority_framework": taxonomy["priority_framework"],
            "description": f"Apply clinical judgment to manage {exemplar} within {taxonomy['concept']}.",
            "evidence_status": taxonomy.get("evidence_status", "sourced"),
            "review_status": "reviewed",
        }
        mappings.append({"card_id": card_id, "objective_id": objective_id})
        for ref in slide.get("source_refs", []):
            sources.append({"card_id": card_id, "source": ref, "source_type": "taxonomy_source_anchor"})
        for artifact_type, path in artifact_map.items():
            links.append({"card_id": card_id, "type": artifact_type, "path": path})
        for row in compression_meta:
            notes.append(
                {
                    "card_id": card_id,
                    "note_type": "semantic_compression",
                    "original_text": row.get("original", ""),
                    "compressed_text": row.get("compressed", ""),
                    "loss_risk": row.get("loss_risk", "low"),
                }
            )

    write_csv(batch_dir / "knowledge_cards.csv", cards)
    write_csv(batch_dir / "curriculum_objectives.csv", list(objectives.values()))
    write_csv(batch_dir / "card_objective_map.csv", mappings)
    write_csv(batch_dir / "card_sources.csv", sources)
    write_csv(batch_dir / "card_links.csv", links)
    write_csv(batch_dir / "card_research_notes.csv", notes, ["card_id", "note_type", "original_text", "compressed_text", "loss_risk"])
    write_csv(batch_dir / "exception_report.csv", [], ["issue", "detail", "severity"])

    manifest = {
        "batch_id": batch_dir.name,
        "created_at": datetime.utcnow().isoformat(),
        "job_id": job_id,
        "record_counts": {
            "cards": len(cards),
            "objectives": len(objectives),
            "sources": len(sources),
            "links": len(links),
            "notes": len(notes),
        },
        "files": sorted(p.name for p in batch_dir.iterdir()),
        "status": "ready_for_validation",
    }
    (batch_dir / "import_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    package = {"manifest": manifest, "cards": cards, "objectives": list(objectives.values()), "mappings": mappings, "sources": sources, "links": links, "notes": notes}
    (batch_dir / "ckm_import_package.json").write_text(json.dumps(package, indent=2), encoding="utf-8")

    for file in batch_dir.iterdir():
        add_artifact(job_id, file, f"ckm:{file.name}")
    log_event(job_id, "ckm_export", f"CKM batch generated at {batch_dir}")
    return {"status": "pass", "batch_dir": str(batch_dir), "files": sorted(p.name for p in batch_dir.iterdir()), "record_count": len(cards)}
