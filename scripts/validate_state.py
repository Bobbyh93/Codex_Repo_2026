#!/usr/bin/env python3
"""Validate repository state files for the Harrity daily workset runner."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / "state"

REQUIRED_FILES = [
    "project_state.json",
    "work_queue.json",
    "qa_state.json",
    "release_state.json",
    "pipeline_state.json",
]

VALID_WORK_STATUSES = {
    "pending",
    "ready",
    "next",
    "in_progress",
    "blocked",
    "complete",
    "cancelled",
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_state(state_dir: Path = STATE_DIR) -> list[str]:
    errors: list[str] = []

    for filename in REQUIRED_FILES:
        path = state_dir / filename
        require(path.exists(), f"Missing required state file: {path}", errors)

    if errors:
        return errors

    project = load_json(state_dir / "project_state.json")
    queue = load_json(state_dir / "work_queue.json")
    qa_state = load_json(state_dir / "qa_state.json")
    release_state = load_json(state_dir / "release_state.json")
    pipeline_state = load_json(state_dir / "pipeline_state.json")

    require(project.get("project_id"), "project_state.json must include project_id", errors)
    require(project.get("timezone"), "project_state.json must include timezone", errors)
    require(
        isinstance(project.get("canonical_stages"), list) and project["canonical_stages"],
        "project_state.json must include non-empty canonical_stages",
        errors,
    )

    packages = queue.get("work_packages")
    require(isinstance(packages, list) and packages, "work_queue.json must include work_packages", errors)

    seen_ids: set[str] = set()
    for index, package in enumerate(packages or []):
        package_id = package.get("id")
        require(bool(package_id), f"work_packages[{index}] is missing id", errors)
        if package_id:
            require(package_id not in seen_ids, f"Duplicate work package id: {package_id}", errors)
            seen_ids.add(package_id)
        require(package.get("title"), f"{package_id or index} is missing title", errors)
        require(package.get("status") in VALID_WORK_STATUSES, f"{package_id or index} has invalid status", errors)
        require(isinstance(package.get("priority"), int), f"{package_id or index} priority must be an integer", errors)
        require(isinstance(package.get("acceptance_criteria"), list), f"{package_id or index} must include acceptance_criteria", errors)
        require(isinstance(package.get("blockers"), list), f"{package_id or index} must include blockers", errors)

    require(isinstance(qa_state.get("gates"), list), "qa_state.json must include gates", errors)
    require(release_state.get("release_state"), "release_state.json must include release_state", errors)
    require(
        isinstance(release_state.get("hard_stop_rules"), list),
        "release_state.json must include hard_stop_rules",
        errors,
    )
    require(pipeline_state.get("active_stage"), "pipeline_state.json must include active_stage", errors)
    require(pipeline_state.get("next_stage"), "pipeline_state.json must include next_stage", errors)

    return errors


def main() -> int:
    errors = validate_state()
    if errors:
        print("State validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("State validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
