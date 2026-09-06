"""SQLite system-of-record for jobs, artifacts, CKM cards, review, and CPI."""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = os.environ.get("PIPELINE_DB", str(ROOT / "pipeline.db"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                status TEXT,
                phase TEXT,
                created_at TEXT,
                updated_at TEXT,
                input_json TEXT,
                output_json TEXT,
                error TEXT
            );

            CREATE TABLE IF NOT EXISTS artifacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT,
                file_path TEXT,
                file_type TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT,
                phase TEXT,
                message TEXT,
                timestamp TEXT
            );

            CREATE TABLE IF NOT EXISTS knowledge_cards (
                card_id TEXT PRIMARY KEY,
                card_title TEXT,
                concept TEXT,
                subject_area TEXT,
                content_area TEXT,
                specialty_area TEXT,
                status TEXT,
                evidence_status TEXT,
                review_status TEXT DEFAULT 'pending',
                last_reviewed_at TEXT,
                last_reviewed_by TEXT,
                review_notes TEXT,
                assigned_reviewer TEXT,
                assigned_role TEXT,
                ownership_status TEXT DEFAULT 'unassigned',
                assigned_at TEXT,
                last_activity_at TEXT,
                escalation_level INTEGER DEFAULT 0,
                confidence_score INTEGER DEFAULT 0,
                confidence_level TEXT DEFAULT 'low'
            );

            CREATE TABLE IF NOT EXISTS curriculum_objectives (
                objective_id TEXT PRIMARY KEY,
                concept TEXT,
                exemplar TEXT,
                nclex_category TEXT,
                ncjmm_primary TEXT,
                priority_framework TEXT,
                description TEXT,
                evidence_status TEXT,
                review_status TEXT
            );

            CREATE TABLE IF NOT EXISTS card_objective_map (
                card_id TEXT,
                objective_id TEXT,
                PRIMARY KEY (card_id, objective_id)
            );

            CREATE TABLE IF NOT EXISTS card_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT,
                source TEXT,
                source_type TEXT
            );

            CREATE TABLE IF NOT EXISTS card_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT,
                type TEXT,
                path TEXT
            );

            CREATE TABLE IF NOT EXISTS card_research_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT,
                note_type TEXT,
                original_text TEXT,
                compressed_text TEXT,
                loss_risk TEXT
            );

            CREATE TABLE IF NOT EXISTS reviewers (
                reviewer_id TEXT PRIMARY KEY,
                name TEXT,
                subject_area TEXT,
                specialty_area TEXT,
                role TEXT,
                capacity INTEGER,
                active INTEGER
            );

            CREATE TABLE IF NOT EXISTS assignment_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT,
                reviewer_id TEXT,
                issue_type TEXT,
                assigned_at TEXT,
                escalation_flag INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS review_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT,
                reviewer_id TEXT,
                event_type TEXT,
                field TEXT,
                original_value TEXT,
                corrected_value TEXT,
                timestamp TEXT
            );

            CREATE TABLE IF NOT EXISTS feedback_aggregate (
                key TEXT PRIMARY KEY,
                event_type TEXT,
                count INTEGER,
                last_updated TEXT
            );

            CREATE TABLE IF NOT EXISTS cpi_events (
                event_id TEXT PRIMARY KEY,
                source_type TEXT,
                course_id TEXT,
                module_id TEXT,
                concept TEXT,
                exemplar TEXT,
                issue_type TEXT,
                issue_detail TEXT,
                severity INTEGER,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS cpi_trends (
                trend_id TEXT PRIMARY KEY,
                concept TEXT,
                issue_type TEXT,
                occurrence_count INTEGER,
                trend_direction TEXT,
                flagged_for_action INTEGER
            );

            CREATE TABLE IF NOT EXISTS cpi_actions (
                action_id TEXT PRIMARY KEY,
                concept TEXT,
                issue_type TEXT,
                intervention_type TEXT,
                assigned_to TEXT,
                status TEXT,
                created_at TEXT,
                resolved_at TEXT
            );
            """
        )
        conn.commit()


def rows_to_dicts(rows) -> list[dict]:
    return [dict(row) for row in rows]
