"""Exact-duplicate detection and run fingerprint registry."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

from .db import connect, init_db

VALID_POLICIES = {
    "skip_exact": "skip",
    "skip": "skip",
    "merge": "contribute_to_existing",
    "contribute": "contribute_to_existing",
    "contribute_to_existing": "contribute_to_existing",
    "enhance": "contribute_to_existing",
    "create_new_version": "create_new_version",
    "create_revision": "create_new_version",
    "new_version": "create_new_version",
    "replace": "replace_existing",
    "replace_existing": "replace_existing",
}


def _ensure_table() -> None:
    init_db()
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS content_signatures (
                fingerprint TEXT PRIMARY KEY,
                job_id TEXT,
                concept TEXT,
                course_name TEXT,
                content_area TEXT,
                source_anchor TEXT,
                artifact_root TEXT,
                batch_dir TEXT,
                created_at TEXT,
                last_seen_at TEXT,
                duplicate_count INTEGER DEFAULT 0,
                last_action TEXT DEFAULT ''
            )
            """
        )
        conn.commit()


def normalize_duplicate_policy(value: Any) -> str:
    if value is None:
        return "create_new_version"
    key = str(value).strip().lower()
    return VALID_POLICIES.get(key, "create_new_version")


def _normalized_payload(taxonomy: dict[str, Any]) -> dict[str, Any]:
    exemplars = taxonomy.get("exemplars") or []
    if isinstance(exemplars, str):
        exemplars = [e.strip() for e in exemplars.split(",") if e.strip()]
    return {
        "course_name": str(taxonomy.get("course_name") or taxonomy.get("subject_area") or "").strip().lower(),
        "content_area": str(taxonomy.get("content_area") or "").strip().lower(),
        "concept": str(taxonomy.get("concept") or "").strip().lower(),
        "exemplars": sorted({str(e).strip().lower() for e in exemplars if str(e).strip()}),
        "source_anchor": str(taxonomy.get("source_anchor") or "").strip().lower(),
        "nclex_category": str(taxonomy.get("nclex_category") or "").strip().lower(),
        "ncjmm_primary": str(taxonomy.get("ncjmm_primary") or "").strip().lower(),
        "priority_framework": str(taxonomy.get("priority_framework") or "").strip().lower(),
        "build_profile": str(taxonomy.get("build_profile") or "standard").strip().lower(),
        "deck_style": str(taxonomy.get("deck_style") or "clean_academic").strip().lower(),
    }


def fingerprint_for(taxonomy: dict[str, Any]) -> str:
    payload = _normalized_payload(taxonomy)
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_duplicate(taxonomy: dict[str, Any]) -> dict[str, Any]:
    _ensure_table()
    fp = fingerprint_for(taxonomy)
    with connect() as conn:
        row = conn.execute("SELECT * FROM content_signatures WHERE fingerprint = ?", (fp,)).fetchone()
    return {
        "fingerprint": fp,
        "is_duplicate": bool(row),
        "matched": dict(row) if row else None,
    }


def record_duplicate_action(fingerprint: str, job_id: str, action: str, matched_job_id: str | None = None) -> None:
    _ensure_table()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO logs (job_id, phase, message, timestamp)
            VALUES (?, ?, ?, ?)
            """,
            (
                job_id,
                "duplicate",
                f"duplicate_action={action}; matched_job_id={matched_job_id or ''}; fingerprint={fingerprint}",
                datetime.utcnow().isoformat(),
            ),
        )
        conn.execute(
            "UPDATE content_signatures SET last_action = ?, last_seen_at = ?, duplicate_count = duplicate_count + 1 WHERE fingerprint = ?",
            (action, datetime.utcnow().isoformat(), fingerprint),
        )
        conn.commit()


def register_run(taxonomy: dict[str, Any], job_id: str, artifact_root: str = "", batch_dir: str = "", created_at: str | None = None) -> None:
    _ensure_table()
    fp = fingerprint_for(taxonomy)
    now = datetime.utcnow().isoformat()
    with connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO content_signatures
            (fingerprint, job_id, concept, course_name, content_area, source_anchor, artifact_root, batch_dir, created_at, last_seen_at, duplicate_count, last_action)
            VALUES (
                ?, ?, ?, ?, ?, ?,
                COALESCE((SELECT artifact_root FROM content_signatures WHERE fingerprint = ?), ?),
                COALESCE((SELECT batch_dir FROM content_signatures WHERE fingerprint = ?), ?),
                COALESCE((SELECT created_at FROM content_signatures WHERE fingerprint = ?), ?),
                ?,
                COALESCE((SELECT duplicate_count FROM content_signatures WHERE fingerprint = ?), 0),
                COALESCE((SELECT last_action FROM content_signatures WHERE fingerprint = ?), '')
            )
            """,
            (
                fp,
                job_id,
                taxonomy.get("concept"),
                taxonomy.get("course_name") or taxonomy.get("subject_area"),
                taxonomy.get("content_area"),
                taxonomy.get("source_anchor"),
                fp,
                artifact_root,
                fp,
                batch_dir,
                fp,
                created_at or now,
                now,
                fp,
                fp,
            ),
        )
        conn.commit()
