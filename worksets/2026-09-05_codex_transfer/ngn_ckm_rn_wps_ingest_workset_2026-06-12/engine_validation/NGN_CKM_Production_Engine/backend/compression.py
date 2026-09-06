"""Deterministic semantic compression for slide bullets."""
from __future__ import annotations

MAX_BULLET_CHARS = 90
MAX_BULLETS = 4

STOP_PHRASES = [
    "the patient will",
    "students should be able to",
    "it is important to",
    "nursing students should",
]


def compress_bullet(text: str) -> dict:
    original = " ".join(str(text).split())
    compressed = original
    for phrase in STOP_PHRASES:
        compressed = compressed.replace(phrase, "").strip()
    loss_risk = "low"
    if len(compressed) > MAX_BULLET_CHARS:
        compressed = compressed[: MAX_BULLET_CHARS - 1].rstrip() + "…"
        loss_risk = "medium"
    return {"original": original, "compressed": compressed, "loss_risk": loss_risk}


def semantic_compress_bullets(bullets: list[str]) -> list[dict]:
    return [compress_bullet(b) for b in bullets[:MAX_BULLETS]]
