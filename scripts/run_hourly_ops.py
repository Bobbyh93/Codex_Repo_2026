#!/usr/bin/env python3
"""Run the bounded hourly operations check for the Harrity work queue."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from create_daily_workset import STATE_DIR, build_workset, write_json
from credential_guard import scan_repository
from validate_nurse_prep_web import validate_app
from validate_state import validate_state


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATUS_PATH = ROOT / "manifests" / "hourly_ops_status.json"
DEFAULT_LOG_DIR = ROOT / "logs"
DEFAULT_USER_CHECKPOINT_DOLLARS = "100.00"


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def contains_invalid_api_key(payload: Any) -> bool:
    if isinstance(payload, dict):
        if payload.get("code") == "invalid_api_key":
            return True
        if payload.get("openai_authenticated_probe_status") == "invalid_api_key":
            return True
        return any(contains_invalid_api_key(value) for value in payload.values())
    if isinstance(payload, list):
        return any(contains_invalid_api_key(item) for item in payload)
    return False


def compact_package(selected: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": selected.get("id"),
        "title": selected.get("title"),
        "status": selected.get("status"),
        "priority": selected.get("priority"),
        "owner": selected.get("owner"),
    }


def build_cost_guard(workset: dict[str, Any], pipeline_state: dict[str, Any], execution_report: dict[str, Any] | None) -> dict[str, Any]:
    selected = workset.get("selected_work_package", {})
    invalid_key_seen = contains_invalid_api_key(pipeline_state) or contains_invalid_api_key(execution_report)
    selected_tts_pilot = selected.get("id") == "HLB-TTS-ASSET-VERIFICATION-022"

    if selected_tts_pilot and invalid_key_seen:
        return {
            "paid_ai_actions_allowed": False,
            "max_next_paid_retry_dollars": "0.00",
            "user_budget_checkpoint_dollars": DEFAULT_USER_CHECKPOINT_DOLLARS,
            "reason": "OpenAI authenticated probe returned invalid_api_key; do not spend on another live TTS retry until the key is replaced and a cheap runtime probe passes.",
            "blocked_paid_actions": ["openai_tts_live_execution"],
        }

    if workset.get("status") != "ready_for_bounded_execution":
        return {
            "paid_ai_actions_allowed": False,
            "max_next_paid_retry_dollars": "0.00",
            "user_budget_checkpoint_dollars": DEFAULT_USER_CHECKPOINT_DOLLARS,
            "reason": "Selected work package is not ready for bounded execution.",
            "blocked_paid_actions": ["paid_ai_generation", "paid_audio_generation"],
        }

    return {
        "paid_ai_actions_allowed": True,
        "max_next_paid_retry_dollars": DEFAULT_USER_CHECKPOINT_DOLLARS,
        "user_budget_checkpoint_dollars": DEFAULT_USER_CHECKPOINT_DOLLARS,
        "reason": "State is ready for a bounded paid action under the next checkpoint ceiling.",
        "blocked_paid_actions": [],
    }


def recommended_hourly_actions(workset: dict[str, Any], cost_guard: dict[str, Any]) -> list[str]:
    selected = workset.get("selected_work_package", {})
    actions = []

    if not cost_guard["paid_ai_actions_allowed"]:
        actions.append("Do not run live paid OpenAI generation during this hourly cycle.")

    if "openai_tts_live_execution" in cost_guard.get("blocked_paid_actions", []):
        actions.append("Replace and verify OPENAI_API_KEY with a cheap runtime probe before retrying live TTS.")

    if selected.get("blockers"):
        actions.append(f"Resolve or update blockers for {selected.get('id')} before downstream binding work.")

    actions.extend(workset.get("recommended_actions", []))

    seen: set[str] = set()
    unique_actions: list[str] = []
    for action in actions:
        if action not in seen:
            unique_actions.append(action)
            seen.add(action)
    return unique_actions


def build_hourly_status(root: Path = ROOT, run_at: datetime | None = None, run_date: str | None = None) -> dict[str, Any]:
    run_at = run_at or datetime.now(timezone.utc)
    run_date = run_date or date.today().isoformat()

    credential_report = scan_repository(root)
    validation_errors = validate_state(root / "state")
    web_app_errors = validate_app(root / "apps" / "nurse-prep-web")
    workset = build_workset(root / "state", run_date)
    pipeline_state = load_json(root / "state" / "pipeline_state.json", {})
    execution_report = load_json(root / "manifests" / "tts_execution_report.json", {})
    cost_guard = build_cost_guard(workset, pipeline_state, execution_report)

    status = "ready_for_bounded_execution" if not validation_errors and cost_guard["paid_ai_actions_allowed"] else "blocked_or_planning_only"
    if credential_report.get("status") != "pass" or validation_errors or web_app_errors:
        status = "blocked"

    return {
        "version": 1,
        "run_at": run_at.isoformat(),
        "date": run_date,
        "status": status,
        "selected_work_package": compact_package(workset.get("selected_work_package", {})),
        "checks": {
            "credential_guard": {
                "status": credential_report.get("status"),
                "external_secret_files_read": credential_report.get("external_secret_files_read"),
                "secret_values_logged": credential_report.get("secret_values_logged"),
            },
            "state_validation": {
                "status": "pass" if not validation_errors else "fail",
                "errors": validation_errors,
            },
            "daily_workset": {
                "status": workset.get("status"),
                "active_blocker_count": len(workset.get("active_blockers", [])),
            },
            "nurse_prep_web_app": {
                "status": "pass" if not web_app_errors else "fail",
                "errors": web_app_errors,
            },
        },
        "cost_guard": cost_guard,
        "next_actions": recommended_hourly_actions(workset, cost_guard),
        "source_files": [
            "state/work_queue.json",
            "state/pipeline_state.json",
            "state/qa_state.json",
            "manifests/tts_execution_report.json",
        ],
    }


def append_hourly_log(log_dir: Path, status: dict[str, Any]) -> Path:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"hourly_ops_{status['date']}.jsonl"
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(status, sort_keys=True) + "\n")
    return log_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--status-path", type=Path, default=DEFAULT_STATUS_PATH)
    parser.add_argument("--log-dir", type=Path, default=DEFAULT_LOG_DIR)
    parser.add_argument("--dry-run", action="store_true", help="Print status JSON without writing manifest or log files.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    status = build_hourly_status(ROOT, run_date=args.date)

    if args.dry_run:
        print(json.dumps(status, indent=2))
        return 0 if status["status"] != "blocked" else 1

    write_json(args.status_path, status)
    log_path = append_hourly_log(args.log_dir, status)
    print(f"Hourly ops status: {status['status']}")
    print(f"Wrote {args.status_path}")
    print(f"Appended {log_path}")
    return 0 if status["status"] != "blocked" else 1


if __name__ == "__main__":
    raise SystemExit(main())
