"""CKM batch validator, dry-run importer, and optional live import."""
from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .db import connect, init_db
from .schemas import CKM_REQUIRED_FILES, REQUIRED_CARD_FIELDS


def load_csv(path: str | Path) -> list[dict[str, str]]:
    path = Path(path)
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def validate_batch(batch_dir: str | Path) -> dict[str, Any]:
    batch_dir = Path(batch_dir)
    report = {"status": "pass", "errors": [], "warnings": []}
    files = {p.name for p in batch_dir.iterdir()} if batch_dir.exists() else set()
    for req in CKM_REQUIRED_FILES:
        if req not in files:
            report["errors"].append(f"missing_file:{req}")
    if report["errors"]:
        report["status"] = "fail"
        return report

    cards = load_csv(batch_dir / "knowledge_cards.csv")
    objectives = load_csv(batch_dir / "curriculum_objectives.csv")
    mappings = load_csv(batch_dir / "card_objective_map.csv")
    sources = load_csv(batch_dir / "card_sources.csv")
    links = load_csv(batch_dir / "card_links.csv")
    notes = load_csv(batch_dir / "card_research_notes.csv")

    for c in cards:
        for field in REQUIRED_CARD_FIELDS:
            if not c.get(field):
                report["errors"].append(f"card_missing_field:{field}:{c.get('card_id')}")

    card_ids = {c.get("card_id") for c in cards}
    objective_ids = {o.get("objective_id") for o in objectives}
    for row in mappings:
        if row.get("card_id") not in card_ids:
            report["errors"].append(f"mapping_invalid_card:{row}")
        if row.get("objective_id") not in objective_ids:
            report["errors"].append(f"mapping_invalid_objective:{row}")
    for row in sources:
        if row.get("card_id") not in card_ids:
            report["errors"].append(f"source_invalid_card:{row}")
    for row in links:
        if row.get("card_id") not in card_ids:
            report["errors"].append(f"link_invalid_card:{row}")
    for c in cards:
        cid = c.get("card_id")
        if not any(s.get("card_id") == cid for s in sources):
            report["errors"].append(f"card_missing_source:{cid}")
        if not any(m.get("card_id") == cid for m in mappings):
            report["errors"].append(f"card_missing_objective:{cid}")
        if not any(l.get("card_id") == cid for l in links):
            report["errors"].append(f"card_missing_link:{cid}")
        if c.get("compression_pass") == "false":
            report["errors"].append(f"compression_block:{cid}")
    for n in notes:
        if n.get("loss_risk") == "high":
            report["errors"].append(f"compression_note_high_risk:{n.get('card_id')}")

    report["status"] = "fail" if report["errors"] else "pass"
    return report


def dry_run_import(batch_dir: str | Path) -> dict[str, Any]:
    report = validate_batch(batch_dir)
    if report["status"] != "pass":
        return {"status": "blocked", "validation": report, "would_import": False}
    batch_dir = Path(batch_dir)
    counts = {name: len(load_csv(batch_dir / f"{name}.csv")) for name in ["knowledge_cards", "curriculum_objectives", "card_objective_map", "card_sources", "card_links", "card_research_notes"]}
    return {"status": "pass", "validation": report, "would_import": True, "counts": counts}


def live_import(batch_dir: str | Path) -> dict[str, Any]:
    dry = dry_run_import(batch_dir)
    if dry["status"] != "pass":
        return dry
    init_db()
    batch_dir = Path(batch_dir)
    cards = load_csv(batch_dir / "knowledge_cards.csv")
    objectives = load_csv(batch_dir / "curriculum_objectives.csv")
    mappings = load_csv(batch_dir / "card_objective_map.csv")
    sources = load_csv(batch_dir / "card_sources.csv")
    links = load_csv(batch_dir / "card_links.csv")
    notes = load_csv(batch_dir / "card_research_notes.csv")
    with connect() as conn:
        for c in cards:
            conn.execute(
                """
                INSERT OR REPLACE INTO knowledge_cards
                (card_id, card_title, concept, subject_area, content_area, specialty_area, status, evidence_status, review_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (c.get("card_id"), c.get("card_title"), c.get("concept"), c.get("subject_area"), c.get("content_area"), c.get("specialty_area"), c.get("status"), c.get("evidence_status"), "in_review"),
            )
        for o in objectives:
            conn.execute(
                """
                INSERT OR REPLACE INTO curriculum_objectives
                (objective_id, concept, exemplar, nclex_category, ncjmm_primary, priority_framework, description, evidence_status, review_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (o.get("objective_id"), o.get("concept"), o.get("exemplar"), o.get("nclex_category"), o.get("ncjmm_primary"), o.get("priority_framework"), o.get("description"), o.get("evidence_status"), o.get("review_status")),
            )
        for m in mappings:
            conn.execute("INSERT OR IGNORE INTO card_objective_map (card_id, objective_id) VALUES (?, ?)", (m.get("card_id"), m.get("objective_id")))
        for s in sources:
            conn.execute("INSERT INTO card_sources (card_id, source, source_type) VALUES (?, ?, ?)", (s.get("card_id"), s.get("source"), s.get("source_type")))
        for l in links:
            conn.execute("INSERT INTO card_links (card_id, type, path) VALUES (?, ?, ?)", (l.get("card_id"), l.get("type"), l.get("path")))
        for n in notes:
            conn.execute("INSERT INTO card_research_notes (card_id, note_type, original_text, compressed_text, loss_risk) VALUES (?, ?, ?, ?, ?)", (n.get("card_id"), n.get("note_type"), n.get("original_text"), n.get("compressed_text"), n.get("loss_risk")))
        conn.commit()
    return {"status": "pass", "imported": dry["counts"]}
