"""CKM browser, validation, and review workflow API."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Body, HTTPException

from .db import connect, init_db
from .scoring_routing import assign_reviewer, seed_reviewers, validate_card, validation_review_queue

router = APIRouter(prefix="/ckm", tags=["ckm"])


@router.get("/cards")
def get_cards(status: str | None = None):
    init_db()
    with connect() as conn:
        if status:
            rows = conn.execute(
                "SELECT card_id, card_title, concept, subject_area, status, review_status FROM knowledge_cards WHERE status=? ORDER BY concept, card_title",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT card_id, card_title, concept, subject_area, status, review_status FROM knowledge_cards ORDER BY concept, card_title"
            ).fetchall()
    return {"cards": [dict(r) for r in rows]}


@router.get("/cards/{card_id}")
def get_card_detail(card_id: str):
    init_db()
    with connect() as conn:
        card = conn.execute("SELECT * FROM knowledge_cards WHERE card_id=?", (card_id,)).fetchone()
        if not card:
            raise HTTPException(404, "card_not_found")
        sources = [dict(r) for r in conn.execute("SELECT source, source_type FROM card_sources WHERE card_id=?", (card_id,)).fetchall()]
        objectives = [dict(r) for r in conn.execute(
            """
            SELECT co.objective_id, o.description, o.nclex_category, o.ncjmm_primary
            FROM card_objective_map co JOIN curriculum_objectives o ON co.objective_id=o.objective_id
            WHERE co.card_id=?
            """,
            (card_id,),
        ).fetchall()]
        links = [dict(r) for r in conn.execute("SELECT type, path FROM card_links WHERE card_id=?", (card_id,)).fetchall()]
    return {"card": dict(card), "sources": sources, "objectives": objectives, "links": links}


@router.get("/cards/{card_id}/validation")
def card_validation(card_id: str):
    return validate_card(card_id)


@router.get("/validation-summary")
def validation_summary():
    return validation_review_queue()


@router.post("/validation-review-queue/route")
def route_validation_queue():
    seed_reviewers()
    queue = validation_review_queue()
    assigned = []
    for card in queue["cards"]:
        if not card["valid"]:
            reviewer = assign_reviewer(card)
            assigned.append({"card_id": card["card_id"], "reviewer": reviewer})
    return {"assigned": assigned, "summary": queue["summary"]}


@router.put("/cards/{card_id}")
def update_card(card_id: str, payload: dict = Body(...)):
    allowed = {"card_title", "concept", "subject_area", "content_area", "specialty_area", "review_notes"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    if not updates:
        return {"status": "no_changes"}
    init_db()
    with connect() as conn:
        for field, value in updates.items():
            conn.execute(f"UPDATE knowledge_cards SET {field}=? WHERE card_id=?", (value, card_id))
        conn.commit()
    return {"status": "updated", "fields": sorted(updates)}


@router.post("/cards/{card_id}/submit-review")
def submit_review(card_id: str):
    init_db()
    with connect() as conn:
        conn.execute("UPDATE knowledge_cards SET review_status='in_review', last_activity_at=? WHERE card_id=?", (datetime.utcnow().isoformat(), card_id))
        conn.commit()
    return {"status": "in_review"}


@router.post("/cards/{card_id}/request-changes")
def request_changes(card_id: str, payload: dict = Body(...)):
    notes = payload.get("notes", "changes_requested")
    init_db()
    with connect() as conn:
        conn.execute("UPDATE knowledge_cards SET review_status='changes_requested', review_notes=?, last_activity_at=? WHERE card_id=?", (notes, datetime.utcnow().isoformat(), card_id))
        conn.commit()
    return {"status": "changes_requested"}


@router.post("/cards/{card_id}/approve")
def approve_card(card_id: str, payload: dict = Body(default={})):  # reviewer_id optional
    result = validate_card(card_id)
    if not result["valid"]:
        raise HTTPException(400, {"status": "blocked", "issues": result["issues"]})
    reviewer = payload.get("reviewer_id", "system") if isinstance(payload, dict) else "system"
    init_db()
    with connect() as conn:
        conn.execute(
            """
            UPDATE knowledge_cards SET status='approved', review_status='approved', last_reviewed_at=?, last_reviewed_by=?, last_activity_at=? WHERE card_id=?
            """,
            (datetime.utcnow().isoformat(), reviewer, datetime.utcnow().isoformat(), card_id),
        )
        conn.commit()
    return {"status": "approved", "card_id": card_id}
