"""Continuous Program Improvement (CPI) capture and trend analysis."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from .db import connect, init_db

INTERVENTION_MAP = {
    "missing_sources": "source_mapping_update",
    "missing_objectives": "objective_mapping_fix",
    "missing_links": "artifact_pipeline_fix",
    "workflow_breakdown": "routing_rule_adjustment",
    "low_confidence_remediation": "content_rebuild",
    "compression_block": "semantic_compression_review",
}


def log_cpi_event(concept: str, issue_type: str, severity: int, source_type: str = "pipeline", issue_detail: str = "", module_id: str = "") -> None:
    init_db()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO cpi_events
            (event_id, source_type, course_id, module_id, concept, exemplar, issue_type, issue_detail, severity, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (uuid4().hex, source_type, "", module_id, concept, "", issue_type, issue_detail, severity, datetime.utcnow().isoformat()),
        )
        conn.commit()


def run_cpi_trend_analysis(threshold: int = 3) -> dict:
    init_db()
    with connect() as conn:
        rows = conn.execute(
            "SELECT concept, issue_type, COUNT(*) AS n FROM cpi_events GROUP BY concept, issue_type"
        ).fetchall()
        actions_created = 0
        for row in rows:
            trend_id = f"{row['concept']}::{row['issue_type']}"
            flagged = 1 if row["n"] >= threshold else 0
            conn.execute(
                """
                INSERT OR REPLACE INTO cpi_trends
                (trend_id, concept, issue_type, occurrence_count, trend_direction, flagged_for_action)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (trend_id, row["concept"], row["issue_type"], row["n"], "increasing" if flagged else "stable", flagged),
            )
            if flagged:
                action_id = f"{trend_id}::action"
                conn.execute(
                    """
                    INSERT OR IGNORE INTO cpi_actions
                    (action_id, concept, issue_type, intervention_type, assigned_to, status, created_at, resolved_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (action_id, row["concept"], row["issue_type"], INTERVENTION_MAP.get(row["issue_type"], "manual_review"), "governance-agent", "open", datetime.utcnow().isoformat(), ""),
                )
                actions_created += 1
        conn.commit()
    return {"status": "pass", "trends": len(rows), "actions_created": actions_created}


def get_cpi_summary() -> dict:
    init_db()
    with connect() as conn:
        event_count = conn.execute("SELECT COUNT(*) AS n FROM cpi_events").fetchone()["n"]
        trends = [dict(r) for r in conn.execute("SELECT * FROM cpi_trends ORDER BY occurrence_count DESC").fetchall()]
        actions = [dict(r) for r in conn.execute("SELECT * FROM cpi_actions ORDER BY created_at DESC").fetchall()]
    return {"event_count": event_count, "trends": trends, "actions": actions}
