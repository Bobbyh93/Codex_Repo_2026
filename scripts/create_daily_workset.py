#!/usr/bin/env python3
"""Create a bounded daily workset from persistent repository state."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

from validate_state import validate_state


ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / "state"

STATUS_RANK = {
    "in_progress": 0,
    "next": 1,
    "ready": 2,
    "blocked": 3,
    "pending": 4,
    "complete": 99,
    "cancelled": 99,
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def select_work_package(packages: list[dict[str, Any]]) -> dict[str, Any]:
    incomplete = [pkg for pkg in packages if pkg.get("status") not in {"complete", "cancelled"}]
    if not incomplete:
        return {
            "id": "NO-ACTIVE-WORK",
            "title": "No incomplete work packages",
            "status": "complete",
            "priority": 999,
            "summary": "All tracked work packages are complete or cancelled.",
            "acceptance_criteria": [],
            "blockers": [],
            "outputs": [],
        }
    return sorted(incomplete, key=lambda pkg: (pkg.get("priority", 999), STATUS_RANK.get(pkg.get("status"), 50)))[0]


def collect_active_blockers(selected: dict[str, Any], qa_state: dict[str, Any], release_state: dict[str, Any]) -> list[str]:
    blockers: list[str] = []
    blockers.extend(selected.get("blockers", []))

    for gate in qa_state.get("gates", []):
        if gate.get("status") == "blocked":
            blockers.append(f"{gate.get('gate')}: {gate.get('required_evidence')}")

    if not release_state.get("export_pass_allowed", False):
        blockers.append(f"release_state={release_state.get('release_state')}: export_pass is not allowed")

    seen: set[str] = set()
    unique_blockers: list[str] = []
    for blocker in blockers:
        if blocker not in seen:
            unique_blockers.append(blocker)
            seen.add(blocker)
    return unique_blockers


def build_workset(state_dir: Path, run_date: str) -> dict[str, Any]:
    validation_errors = validate_state(state_dir)
    if validation_errors:
        return {
            "date": run_date,
            "status": "blocked",
            "summary": "State validation failed. Repair state files before continuing.",
            "validation_errors": validation_errors,
        }

    project = load_json(state_dir / "project_state.json")
    queue = load_json(state_dir / "work_queue.json")
    qa_state = load_json(state_dir / "qa_state.json")
    release_state = load_json(state_dir / "release_state.json")
    pipeline_state = load_json(state_dir / "pipeline_state.json")

    selected = select_work_package(queue["work_packages"])
    blockers = collect_active_blockers(selected, qa_state, release_state)
    can_execute = selected.get("status") in {"ready", "next", "in_progress"} and not selected.get("blockers")

    return {
        "date": run_date,
        "project_id": project["project_id"],
        "project_name": project["project_name"],
        "repository": project["repository"],
        "status": "ready_for_bounded_execution" if can_execute else "blocked_or_planning_only",
        "active_stage": pipeline_state["active_stage"],
        "next_stage": pipeline_state["next_stage"],
        "selected_work_package": selected,
        "active_blockers": blockers,
        "daily_instructions": [
            "Do not assume access to prior chat attachments, sandbox files, or generated ZIPs.",
            "Use committed state and manifests as the source of truth.",
            "Run scripts/credential_guard.py before any credential-backed OpenAI packet.",
            "If credentials or production artifacts are missing, write a dependency checklist instead of claiming execution.",
            "Advance only the selected work package or update its blockers.",
            "Do not publish, deploy, email, or mutate external systems without explicit approval."
        ],
        "recommended_actions": recommended_actions(selected),
        "release_hard_stop_rules": release_state.get("hard_stop_rules", []),
    }


def recommended_actions(selected: dict[str, Any]) -> list[str]:
    if selected.get("id") == "NO-ACTIVE-WORK":
        return ["Create or import the next work package in state/work_queue.json."]

    if selected.get("blockers"):
        return [
            f"Resolve or update blockers for {selected['id']}.",
            "Commit any missing source manifests, request queues, or QA evidence required by the selected work package.",
            "Rerun scripts/validate_state.py and scripts/create_daily_workset.py after blockers change.",
        ]

    return [
        f"Execute the bounded implementation for {selected['id']}.",
        "Write or update the expected output artifacts listed in the work package.",
        "Run validation and tests before marking the package complete.",
    ]


def render_markdown(workset: dict[str, Any]) -> str:
    selected = workset.get("selected_work_package", {})
    lines = [
        f"# Daily Workset - {workset['date']}",
        "",
        f"Project: {workset.get('project_name', 'Unknown')}",
        f"Status: `{workset.get('status', 'unknown')}`",
        "",
        "## Selected Work Package",
        "",
        f"- ID: `{selected.get('id', 'n/a')}`",
        f"- Title: {selected.get('title', 'n/a')}",
        f"- Status: `{selected.get('status', 'n/a')}`",
        f"- Owner: {selected.get('owner', 'n/a')}",
        "",
        selected.get("summary", ""),
        "",
        "## Acceptance Criteria",
        "",
    ]

    for item in selected.get("acceptance_criteria", []):
        lines.append(f"- {item}")

    lines.extend(["", "## Active Blockers", ""])
    blockers = workset.get("active_blockers", [])
    if blockers:
        for blocker in blockers:
            lines.append(f"- {blocker}")
    else:
        lines.append("- None recorded.")

    lines.extend(["", "## Recommended Actions", ""])
    for action in workset.get("recommended_actions", []):
        lines.append(f"- {action}")

    lines.extend(["", "## Daily Instructions", ""])
    for instruction in workset.get("daily_instructions", []):
        lines.append(f"- {instruction}")

    lines.extend(["", "## Release Hard Stops", ""])
    for rule in workset.get("release_hard_stop_rules", []):
        lines.append(f"- {rule}")

    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", type=Path, default=STATE_DIR)
    parser.add_argument("--out-dir", type=Path, default=ROOT / "daily_worksets")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--dry-run", action="store_true", help="Print workset JSON without writing files.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workset = build_workset(args.state_dir, args.date)

    if args.dry_run:
        print(json.dumps(workset, indent=2))
        return 0 if not workset.get("validation_errors") else 1

    json_path = args.out_dir / f"{args.date}.json"
    md_path = args.out_dir / f"{args.date}.md"
    write_json(json_path, workset)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(render_markdown(workset), encoding="utf-8")

    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    return 0 if not workset.get("validation_errors") else 1


if __name__ == "__main__":
    raise SystemExit(main())
