"""Persistence helpers for jobs, logs, artifacts, and review events."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .db import connect, init_db


def utc_now() -> str:
    return datetime.utcnow().isoformat()


def save_job(job_id: str, state: dict[str, Any]) -> None:
    init_db()
    with connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO jobs
            (job_id, status, phase, created_at, updated_at, input_json, output_json, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                state.get("status"),
                state.get("phase"),
                state.get("created_at") or utc_now(),
                utc_now(),
                json.dumps(state.get("input", {})),
                json.dumps(state, default=str),
                state.get("error"),
            ),
        )
        conn.commit()


def load_job(job_id: str) -> dict[str, Any] | None:
    init_db()
    with connect() as conn:
        row = conn.execute("SELECT output_json FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    if not row:
        return None
    return json.loads(row["output_json"])


def list_jobs(limit: int = 100) -> list[dict[str, Any]]:
    init_db()
    with connect() as conn:
        rows = conn.execute(
            "SELECT job_id, status, phase, created_at, updated_at, error FROM jobs ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def log_event(job_id: str, phase: str, message: str) -> None:
    init_db()
    with connect() as conn:
        conn.execute(
            "INSERT INTO logs (job_id, phase, message, timestamp) VALUES (?, ?, ?, ?)",
            (job_id, phase, message, utc_now()),
        )
        conn.commit()


def list_logs(job_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    init_db()
    with connect() as conn:
        if job_id:
            rows = conn.execute(
                "SELECT * FROM logs WHERE job_id = ? ORDER BY id DESC LIMIT ?", (job_id, limit)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


def add_artifact(job_id: str, path: str | Path, file_type: str) -> None:
    init_db()
    with connect() as conn:
        conn.execute(
            "INSERT INTO artifacts (job_id, file_path, file_type, created_at) VALUES (?, ?, ?, ?)",
            (job_id, str(path), file_type, utc_now()),
        )
        conn.commit()


def list_artifacts(job_id: str | None = None) -> list[dict[str, Any]]:
    init_db()
    with connect() as conn:
        if job_id:
            rows = conn.execute(
                "SELECT * FROM artifacts WHERE job_id = ? ORDER BY id DESC", (job_id,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM artifacts ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]
