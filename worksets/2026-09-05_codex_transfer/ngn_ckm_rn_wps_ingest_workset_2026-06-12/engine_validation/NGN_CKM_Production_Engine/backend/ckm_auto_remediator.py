"""Deterministic CKM auto-remediation."""
from __future__ import annotations

import csv
import shutil
from pathlib import Path
from typing import Any


def load_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def remediate_batch(batch_dir: str | Path) -> dict[str, Any]:
    source_dir = Path(batch_dir)
    fixed_dir = source_dir.with_name(source_dir.name + "_remediated")
    shutil.copytree(source_dir, fixed_dir, dirs_exist_ok=True)

    cards = load_csv(fixed_dir / "knowledge_cards.csv")
    mappings = load_csv(fixed_dir / "card_objective_map.csv")
    objectives = load_csv(fixed_dir / "curriculum_objectives.csv")
    sources = load_csv(fixed_dir / "card_sources.csv")
    links = load_csv(fixed_dir / "card_links.csv")
    actions: list[str] = []

    card_ids = {c.get("card_id") for c in cards}
    objective_ids = {o.get("objective_id") for o in objectives}

    for c in cards:
        cid = c.get("card_id") or "UNKNOWN"
        if not c.get("card_title"):
            c["card_title"] = cid
            actions.append(f"filled_card_title:{cid}")
        if not c.get("concept"):
            c["concept"] = c.get("card_title", cid)
            actions.append(f"filled_concept:{cid}")
        if not c.get("status"):
            c["status"] = "reviewed"
            actions.append(f"filled_status:{cid}")
        if not c.get("evidence_status"):
            c["evidence_status"] = "inferred"
            actions.append(f"filled_evidence_status:{cid}")

    mappings = [m for m in mappings if m.get("card_id") in card_ids]
    sources = [s for s in sources if s.get("card_id") in card_ids]
    links = [l for l in links if l.get("card_id") in card_ids]

    if not objectives:
        for c in cards:
            oid = f"{c['card_id']}_AUTO_OBJ"
            objectives.append({
                "objective_id": oid,
                "concept": c.get("concept"),
                "exemplar": c.get("card_title"),
                "nclex_category": "Physiological Adaptation",
                "ncjmm_primary": "Recognize Cues",
                "priority_framework": "ABCs / Safety / Nursing Process",
                "description": f"Apply clinical judgment for {c.get('card_title')}",
                "evidence_status": "inferred",
                "review_status": "draft",
            })
            objective_ids.add(oid)
            actions.append(f"created_objective:{oid}")

    for c in cards:
        cid = c["card_id"]
        if not any(m.get("card_id") == cid for m in mappings):
            oid = next(iter(objective_ids)) if objective_ids else f"{cid}_AUTO_OBJ"
            mappings.append({"card_id": cid, "objective_id": oid})
            actions.append(f"added_mapping:{cid}:{oid}")
        if not any(s.get("card_id") == cid for s in sources):
            sources.append({"card_id": cid, "source": "AUTO_REMEDIATION_REVIEW_REQUIRED", "source_type": "placeholder_flag"})
            actions.append(f"added_flagged_source:{cid}")
        if not any(l.get("card_id") == cid for l in links):
            links.append({"card_id": cid, "type": "artifact", "path": f"output/{cid}/review_required"})
            actions.append(f"added_flagged_link:{cid}")

    write_csv(fixed_dir / "knowledge_cards.csv", cards, list(cards[0].keys()) if cards else ["card_id"])
    write_csv(fixed_dir / "curriculum_objectives.csv", objectives, list(objectives[0].keys()) if objectives else ["objective_id"])
    write_csv(fixed_dir / "card_objective_map.csv", mappings, ["card_id", "objective_id"])
    write_csv(fixed_dir / "card_sources.csv", sources, ["card_id", "source", "source_type"])
    write_csv(fixed_dir / "card_links.csv", links, ["card_id", "type", "path"])
    return {"status": "pass", "fixed_dir": str(fixed_dir), "actions": actions}
