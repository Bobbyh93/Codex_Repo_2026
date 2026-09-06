"""Confidence scoring, review queue, and routing helpers."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from .db import connect, init_db
from .schemas import ISSUE_WEIGHTS

ROUTING_RULES = {
    "missing_sources": "SME",
    "missing_objectives": "Content",
    "missing_links": "QA",
    "not_submitted_for_review": "Content",
    "compression_block": "Senior Reviewer",
}


def compute_priority(issues: list[str]) -> int:
    return sum(ISSUE_WEIGHTS.get(issue, 0) for issue in issues)


def classify_confidence(score: int) -> str:
    if score >= 7:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def score_card(counts: dict[str, int], issues: list[str]) -> dict[str, Any]:
    score = 0
    if counts.get("sources", 0) > 0:
        score += 3
    if counts.get("objectives", 0) > 0:
        score += 3
    if counts.get("links", 0) > 0:
        score += 2
    score -= len(issues) * 2
    score = max(score, 0)
    return {"confidence_score": score, "confidence_level": classify_confidence(score)}


def validate_card(card_id: str) -> dict[str, Any]:
    init_db()
    with connect() as conn:
        sources = conn.execute("SELECT COUNT(*) AS n FROM card_sources WHERE card_id=?", (card_id,)).fetchone()["n"]
        objectives = conn.execute("SELECT COUNT(*) AS n FROM card_objective_map WHERE card_id=?", (card_id,)).fetchone()["n"]
        links = conn.execute("SELECT COUNT(*) AS n FROM card_links WHERE card_id=?", (card_id,)).fetchone()["n"]
        row = conn.execute("SELECT review_status, status, subject_area, specialty_area FROM knowledge_cards WHERE card_id=?", (card_id,)).fetchone()
    issues: list[str] = []
    if sources == 0:
        issues.append("missing_sources")
    if objectives == 0:
        issues.append("missing_objectives")
    if links == 0:
        issues.append("missing_links")
    review_status = row["review_status"] if row else None
    if review_status not in ["in_review", "approved"]:
        issues.append("not_submitted_for_review")
    counts = {"sources": sources, "objectives": objectives, "links": links}
    scoring = score_card(counts, issues)
    return {
        "card_id": card_id,
        "valid": len(issues) == 0,
        "issues": issues,
        "priority": compute_priority(issues),
        "counts": counts,
        "review_status": review_status,
        **scoring,
    }


def validation_review_queue() -> dict[str, Any]:
    init_db()
    with connect() as conn:
        cards = [r["card_id"] for r in conn.execute("SELECT card_id FROM knowledge_cards").fetchall()]
    results = [validate_card(cid) for cid in cards]
    sorted_cards = sorted(results, key=lambda x: x["priority"], reverse=True)
    queue = {key: [] for key in ROUTING_RULES}
    for result in results:
        for issue in result["issues"]:
            if issue in queue:
                queue[issue].append(result["card_id"])
    return {
        "summary": {
            "total": len(results),
            "valid": sum(1 for r in results if r["valid"]),
            "invalid": sum(1 for r in results if not r["valid"]),
            "valid_pct": round((sum(1 for r in results if r["valid"]) / len(results) * 100), 1) if results else 0,
        },
        "queue": queue,
        "cards": sorted_cards,
    }


def assign_reviewer(card_result: dict[str, Any]) -> dict[str, Any] | None:
    init_db()
    issue = card_result["issues"][0] if card_result.get("issues") else None
    role = ROUTING_RULES.get(issue, "QA")
    with connect() as conn:
        reviewers = conn.execute(
            "SELECT * FROM reviewers WHERE active=1 AND role=? ORDER BY capacity ASC LIMIT 1", (role,)
        ).fetchall()
        if not reviewers:
            return None
        reviewer = dict(reviewers[0])
        now = datetime.utcnow().isoformat()
        conn.execute(
            """
            UPDATE knowledge_cards SET assigned_reviewer=?, assigned_role=?, ownership_status='assigned', assigned_at=?, last_activity_at=?, confidence_score=?, confidence_level=? WHERE card_id=?
            """,
            (reviewer["reviewer_id"], reviewer["role"], now, now, card_result["confidence_score"], card_result["confidence_level"], card_result["card_id"]),
        )
        conn.execute(
            "INSERT INTO assignment_log (card_id, reviewer_id, issue_type, assigned_at) VALUES (?, ?, ?, ?)",
            (card_result["card_id"], reviewer["reviewer_id"], issue, now),
        )
        conn.commit()
    return reviewer


def seed_reviewers() -> None:
    init_db()
    reviewers = [
        ("sme_med_surg", "SME Specialty Area A", "Subject Area A", "Specialty Area A", "SME", 5, 1),
        ("content_default", "Content Specialist", "Subject Area A", "Specialty Area A", "Content", 5, 1),
        ("qa_default", "QA Reviewer", "Subject Area A", "Specialty Area A", "QA", 5, 1),
        ("lead_default", "Lead Reviewer", "Subject Area A", "Specialty Area A", "Senior Reviewer", 5, 1),
    ]
    with connect() as conn:
        conn.executemany("INSERT OR IGNORE INTO reviewers VALUES (?, ?, ?, ?, ?, ?, ?)", reviewers)
        conn.commit()
