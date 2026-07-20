#!/usr/bin/env python3
"""Validate the source-grounded production pilot package and release state."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LESSON_DIR = ROOT / "lessons" / "production_pilot"
REPORT_PATH = ROOT / "qa" / "production_pilot_release_report.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate() -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    required_files = [
        LESSON_DIR / "source_manifest.json",
        LESSON_DIR / "lesson_spec.json",
        LESSON_DIR / "tts_request_queue.json",
        LESSON_DIR / "captions.vtt",
        ROOT / "manifests" / "production_pilot_audio_manifest.json",
        ROOT / "manifests" / "production_pilot_binding_manifest.json",
        ROOT / "qa" / "production_pilot_playback_report.json",
    ]
    for path in required_files:
        if not path.exists():
            errors.append(f"Missing required artifact: {path.relative_to(ROOT)}")

    if errors:
        return {
            "version": 1,
            "status": "blocked",
            "errors": errors,
            "warnings": warnings,
        }

    source_manifest = load_json(LESSON_DIR / "source_manifest.json")
    lesson_spec = load_json(LESSON_DIR / "lesson_spec.json")
    audio_manifest = load_json(ROOT / "manifests" / "production_pilot_audio_manifest.json")
    binding_manifest = load_json(ROOT / "manifests" / "production_pilot_binding_manifest.json")
    playback_report = load_json(ROOT / "qa" / "production_pilot_playback_report.json")

    source_ids = {source["source_id"] for source in source_manifest.get("sources", [])}
    slides = lesson_spec.get("slides", [])
    audio_assets = audio_manifest.get("audio_assets", [])
    verified_audio_ids = {asset.get("slide_id") for asset in audio_assets if asset.get("status") == "verified"}
    binding_ids = {binding.get("slide_id") for binding in binding_manifest.get("bindings", [])}

    if not slides:
        errors.append("lesson_spec.json has no slides")
    for slide in slides:
        for field in ("slide_id", "slide_title", "speaker_notes", "tts_text", "source_refs"):
            if not slide.get(field):
                errors.append(f"{slide.get('slide_id', '<missing>')} missing {field}")
        if not set(slide.get("source_refs", [])).issubset(source_ids):
            errors.append(f"{slide.get('slide_id')} references an unknown source")
        if slide.get("slide_id") not in verified_audio_ids:
            errors.append(f"{slide.get('slide_id')} has no verified audio asset")
        if slide.get("slide_id") not in binding_ids:
            errors.append(f"{slide.get('slide_id')} has no binding manifest entry")

    if binding_manifest.get("status") != "ready_for_downstream_binding":
        errors.append("production pilot binding manifest is not ready_for_downstream_binding")

    external_blockers = [
        "ffmpeg/ffprobe not available, so MP4 assembly and stream QA were not executed.",
    ]
    if playback_report.get("status") != "playback_pass":
        external_blockers.extend(playback_report.get("blockers") or ["Playback evidence has not passed."])
    status = "pilot_audio_pass_playback_blocked" if not errors else "blocked"
    return {
        "version": 1,
        "status": status,
        "pilot_id": lesson_spec.get("pilot_id"),
        "slide_count": len(slides),
        "source_count": len(source_ids),
        "verified_audio_count": len(verified_audio_ids),
        "binding_count": len(binding_ids),
        "playback_status": playback_report.get("status"),
        "release_path": playback_report.get("release_path"),
        "source_grounded": not errors,
        "secret_values_logged": False,
        "errors": errors,
        "warnings": warnings,
        "external_blockers": external_blockers,
    }


def main() -> int:
    report = validate()
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Production pilot status: {report['status']}")
    print(f"Wrote {REPORT_PATH}")
    return 0 if report["status"] != "blocked" else 1


if __name__ == "__main__":
    raise SystemExit(main())
