"""Diagram API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from .diagram_service import generate_diagram, get_diagram_provider

router = APIRouter(prefix="/diagram", tags=["diagram"])


@router.get("/provider")
def provider_status():
    return {"provider": get_diagram_provider()}


@router.post("/generate")
def generate(payload: dict = Body(...)):
    try:
        topic = payload.get("topic") or payload.get("prompt")
        if not topic:
            raise ValueError("missing_topic_or_prompt")
        return generate_diagram(
            topic=topic,
            diagram_type=payload.get("diagram_type", "flow"),
            style=payload.get("style", "ati"),
        )
    except Exception as exc:
        raise HTTPException(400, f"diagram_generation_failed:{type(exc).__name__}:{exc}") from exc
