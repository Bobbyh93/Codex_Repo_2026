#!/usr/bin/env python3
"""Validate the source-grounded production pilot package and release state."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "qa" / "production_pilot_release_report.json"

STATUS_BLOCKED = "blocked"
STATUS_PLAYBACK_BLOCKED = "pilot_audio_pass_playback_blocked"
STATUS_RELEASE_PASS = "release_pass"


def _load_sibling(name: str) -> Any:
    path = Path(__file__).resolve().with_name(f"{name}.py")
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PLAYBACK = _load_sibling("validate_playback_evidence")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(root: Path = ROOT) -> dict[str, Any]:
    lesson_dir = root / "lessons" / "production_pilot"
    playback_report_path = root / "qa" / "production_pilot_playback_report.json"
    errors: list[str] = []
    warnings: list[str] = []
    required_files = [
        lesson_dir / "source_manifest.json",
        lesson_dir / "lesson_spec.json",
        lesson_dir / "tts_request_queue.json",
        lesson_dir / "captions.vtt",
        root / "manifests" / "production_pilot_audio_manifest.json",
        root / "manifests" / "production_pilot_binding_manifest.json",
        playback_report_path,
    ]
    for path in required_files:
        if not path.exists():
            errors.append(f"Missing required artifact: {path.relative_to(root).as_posix()}")

    if errors:
        return {
            "version": 1,
            "status": STATUS_BLOCKED,
            "errors": errors,
            "warnings": warnings,
            "external_blockers": [],
        }

    source_manifest = load_json(lesson_dir / "source_manifest.json")
    lesson_spec = load_json(lesson_dir / "lesson_spec.json")
    audio_manifest = load_json(root / "manifests" / "production_pilot_audio_manifest.json")
    binding_manifest = load_json(root / "manifests" / "production_pilot_binding_manifest.json")

    source_ids = {source["source_id"] for source in source_manifest.get("sources", [])}
    slides = lesson_spec.get("slides", [])
    audio_assets = audio_manifest.get("audio_assets", [])
    verified_audio_ids = {asset.get("slide_id") for asset in audio_assets if asset.get("status") == "verified"}
    binding_ids = {binding.get("slide_id") for binding in binding_manifest.get("bindings", [])}

    if not slides:
        errors.append("lesson_spec.json has no slides")
    seen_slide_ids: set[Any] = set()
    for slide in slides:
        for field in ("slide_id", "slide_title", "speaker_notes", "tts_text", "source_refs"):
            if not slide.get(field):
                errors.append(f"{slide.get('slide_id', '<missing>')} missing {field}")
        if slide.get("slide_id") in seen_slide_ids:
            errors.append(f"{slide.get('slide_id')} is a duplicate slide_id")
        seen_slide_ids.add(slide.get("slide_id"))
        if not set(slide.get("source_refs", [])).issubset(source_ids):
            errors.append(f"{slide.get('slide_id')} references an unknown source")
        if slide.get("slide_id") not in verified_audio_ids:
            errors.append(f"{slide.get('slide_id')} has no verified audio asset")
        if slide.get("slide_id") not in binding_ids:
            errors.append(f"{slide.get('slide_id')} has no binding manifest entry")

    if binding_manifest.get("status") != "ready_for_downstream_binding":
        errors.append("production pilot binding manifest is not ready_for_downstream_binding")

    # Playback evidence is the external release gate. It is re-evaluated here from the evidence
    # files (scripts/validate_playback_evidence.py encodes the release-path requirements: a
    # selected path, the exact final-artifact checksum, every mandatory target player, and for
    # narrated video the machine media QA report) rather than trusted from the committed
    # playback report, which may be stale or hand-edited. The committed report must still match
    # the fresh result so that what is checked in is what was gated on.
    playback = PLAYBACK.validate_playback_evidence(root)
    try:
        committed_playback = load_json(playback_report_path)
    except ValueError:
        committed_playback = None
    external_blockers: list[str] = []
    external_blockers.extend(str(item) for item in playback.get("blockers", []))
    external_blockers.extend(f"Playback report error: {item}" for item in playback.get("errors", []))
    if not isinstance(committed_playback, dict):
        errors.append("qa/production_pilot_playback_report.json is not a JSON object.")
    elif committed_playback != playback:
        external_blockers.append("qa/production_pilot_playback_report.json is stale: re-run scripts/validate_playback_evidence.py.")
    playback_status = playback.get("status")
    if playback_status != "playback_pass" and not external_blockers:
        external_blockers.append("Playback evidence has not passed.")
    playback_passed = playback_status == "playback_pass" and not external_blockers

    if errors:
        status = STATUS_BLOCKED
    elif not playback_passed:
        status = STATUS_PLAYBACK_BLOCKED
    else:
        status = STATUS_RELEASE_PASS

    return {
        "version": 1,
        "status": status,
        "pilot_id": lesson_spec.get("pilot_id"),
        "slide_count": len(slides),
        "source_count": len(source_ids),
        "verified_audio_count": len(verified_audio_ids),
        "binding_count": len(binding_ids),
        "playback_status": playback_status,
        "release_path": playback.get("release_path"),
        "source_grounded": not errors,
        "secret_values_logged": False,
        "errors": errors,
        "warnings": warnings,
        "external_blockers": external_blockers,
    }


def exit_code(report: dict[str, Any]) -> int:
    """Return 0 only for a fully passing release state; any blocker or error is a failure."""
    released = (
        report.get("status") == STATUS_RELEASE_PASS
        and not report.get("errors")
        and not report.get("external_blockers")
    )
    return 0 if released else 1


def main(root: Path = ROOT, report_path: Path | None = None) -> int:
    report_path = report_path or (root / "qa" / "production_pilot_release_report.json")
    report = validate(root)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Production pilot status: {report['status']}")
    print(f"Wrote {report_path}")
    return exit_code(report)


if __name__ == "__main__":
    raise SystemExit(main())
