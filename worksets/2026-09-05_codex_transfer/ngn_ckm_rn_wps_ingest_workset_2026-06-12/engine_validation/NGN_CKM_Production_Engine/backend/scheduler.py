"""Nightly batch scheduler and CPI reporting.

The scheduler uses only the Python standard library so the deployable package stays
simple. It is opt-in: set ENABLE_SCHEDULER=1 or call /scheduler/start.
"""
from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .cpi_engine import get_cpi_summary, run_cpi_trend_analysis
from .full_workbook_runner import run_full_workbook

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "nightly_config.json"
REPORT_DIR = ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)

_STATE = {
    "running": False,
    "last_run_at": None,
    "last_result": None,
    "last_error": None,
    "thread_started_at": None,
}
_THREAD: threading.Thread | None = None
_LOCK = threading.Lock()


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {
            "enabled": False,
            "run_time_local": "02:00",
            "workbook_path": "",
            "sheet_name": None,
            "live_import": True,
            "include_review_rows": False,
            "max_rows": None,
            "report_dir": "reports",
        }
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def save_config(config: dict[str, Any]) -> dict[str, Any]:
    CONFIG_PATH.parent.mkdir(exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return config


def _seconds_until(run_time_local: str) -> float:
    try:
        hour, minute = [int(x) for x in run_time_local.split(":")[:2]]
    except Exception:
        hour, minute = 2, 0
    now = datetime.now()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return max((target - now).total_seconds(), 1)


def build_cpi_report(prefix: str = "cpi_report") -> dict[str, str]:
    run_cpi_trend_analysis()
    summary = get_cpi_summary()
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base = REPORT_DIR / f"{prefix}_{stamp}"
    json_path = base.with_suffix(".json")
    md_path = base.with_suffix(".md")
    json_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    md_lines = [
        "# CPI Report",
        "",
        f"Generated UTC: {datetime.utcnow().isoformat()}",
        f"Events: {summary.get('event_count', 0)}",
        "",
        "## Trends",
        "| Concept | Issue | Count | Direction | Flagged |",
        "|---|---|---:|---|---:|",
    ]
    for t in summary.get("trends", []):
        md_lines.append(f"| {t.get('concept','')} | {t.get('issue_type','')} | {t.get('occurrence_count',0)} | {t.get('trend_direction','')} | {t.get('flagged_for_action',0)} |")
    md_lines.extend(["", "## Actions", "| Concept | Issue | Intervention | Status |", "|---|---|---|---|"])
    for a in summary.get("actions", []):
        md_lines.append(f"| {a.get('concept','')} | {a.get('issue_type','')} | {a.get('intervention_type','')} | {a.get('status','')} |")
    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return {"json": str(json_path), "markdown": str(md_path)}


def run_nightly_once(config: dict[str, Any] | None = None) -> dict[str, Any]:
    config = config or load_config()
    workbook_path = config.get("workbook_path")
    result: dict[str, Any]
    if workbook_path and Path(workbook_path).exists():
        try:
            result = run_full_workbook(
                workbook_path,
                sheet_name=config.get("sheet_name"),
                live_import=bool(config.get("live_import", True)),
                include_review_rows=bool(config.get("include_review_rows", False)),
                max_rows=config.get("max_rows"),
                job_prefix=f"nightly_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            )
        except Exception as exc:
            run_cpi_trend_analysis()
            result = {
                "status": "failed",
                "error": f"{type(exc).__name__}:{exc}",
                "message": "Nightly build did not run. Check workbook_path; it must point to a source/control workbook, not generated CKM output.",
            }
    else:
        run_cpi_trend_analysis()
        result = {
            "status": "skipped_no_workbook",
            "message": "Set config/nightly_config.json workbook_path or POST /scheduler/config before nightly builds.",
        }
    result["cpi_report"] = build_cpi_report("nightly_cpi_report")
    with _LOCK:
        _STATE["last_run_at"] = datetime.utcnow().isoformat()
        _STATE["last_result"] = result
        _STATE["last_error"] = None
    return result


def _loop() -> None:
    while True:
        config = load_config()
        if not config.get("enabled", False):
            time.sleep(60)
            continue
        time.sleep(_seconds_until(config.get("run_time_local", "02:00")))
        try:
            run_nightly_once(config)
        except Exception as exc:  # keep scheduler alive
            with _LOCK:
                _STATE["last_error"] = f"{type(exc).__name__}:{exc}"


def start_scheduler() -> dict[str, Any]:
    global _THREAD
    with _LOCK:
        if _THREAD and _THREAD.is_alive():
            _STATE["running"] = True
            return status()
        _STATE["running"] = True
        _STATE["thread_started_at"] = datetime.utcnow().isoformat()
        _THREAD = threading.Thread(target=_loop, daemon=True, name="nightly-batch-scheduler")
        _THREAD.start()
    return status()


def status() -> dict[str, Any]:
    config = load_config()
    return {
        **_STATE,
        "config": config,
        "thread_alive": bool(_THREAD and _THREAD.is_alive()),
        "next_run_seconds": _seconds_until(config.get("run_time_local", "02:00")) if config.get("enabled") else None,
    }


def autostart_if_enabled() -> None:
    if os.environ.get("ENABLE_SCHEDULER", "0") == "1" or load_config().get("enabled", False):
        start_scheduler()
