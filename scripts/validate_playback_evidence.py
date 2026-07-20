#!/usr/bin/env python3
"""Validate production pilot playback evidence before release."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LESSON_SPEC = ROOT / "lessons" / "production_pilot" / "lesson_spec.json"
BINDING_MANIFEST = ROOT / "manifests" / "production_pilot_binding_manifest.json"
EVIDENCE_PATH = ROOT / "qa" / "production_pilot_playback_evidence.json"
REPORT_PATH = ROOT / "qa" / "production_pilot_playback_report.json"

VALID_RELEASE_PATHS = {
    "video": {"browser", "lms"},
    "pptx": {"powerpoint"},
    "google_slides": {"google_slides"},
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def has_secret_marker(value: Any) -> bool:
    if isinstance(value, dict):
        return any(has_secret_marker(item) for item in value.values())
    if isinstance(value, list):
        return any(has_secret_marker(item) for item in value)
    if isinstance(value, str):
        return "OPENAI_API_KEY=" in value or "sk-proj-" in value or "Bearer " in value
    return False


def validate_playback_evidence() -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    blockers: list[str] = []

    for path in (LESSON_SPEC, BINDING_MANIFEST, EVIDENCE_PATH):
        if not path.exists():
            errors.append(f"Missing required artifact: {path.relative_to(ROOT)}")

    if errors:
        return {
            "version": 1,
            "status": "blocked",
            "release_path": "unknown",
            "errors": errors,
            "warnings": warnings,
            "blockers": blockers,
            "target_results": [],
            "secret_values_logged": False,
        }

    lesson_spec = load_json(LESSON_SPEC)
    binding_manifest = load_json(BINDING_MANIFEST)
    evidence = load_json(EVIDENCE_PATH)

    if has_secret_marker(evidence):
        errors.append("Playback evidence contains a secret-like marker.")

    slide_ids = {slide.get("slide_id") for slide in lesson_spec.get("slides", [])}
    binding_ids = {binding.get("slide_id") for binding in binding_manifest.get("bindings", [])}
    release_path = evidence.get("release_path")
    final_artifact = evidence.get("final_artifact", {})
    records = evidence.get("playback_records", [])

    if release_path not in VALID_RELEASE_PATHS:
        blockers.append("Release playback path has not been selected.")
    if not final_artifact.get("path") or not final_artifact.get("sha256"):
        blockers.append("Final artifact path and checksum are not recorded.")
    if not isinstance(records, list) or not records:
        blockers.append("No target-player playback records are recorded.")

    expected_targets = set(evidence.get("required_targets") or VALID_RELEASE_PATHS.get(release_path, set()))
    present_targets = {record.get("target_type") for record in records}
    for target_type in sorted(expected_targets - present_targets):
        blockers.append(f"Missing required playback target: {target_type}")

    target_results: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        target_errors: list[str] = []
        target_type = record.get("target_type")
        target_id = record.get("target_id") or f"record-{index + 1}"

        for field in ("target_type", "target_name", "tested_at", "tester", "application", "artifact_sha256", "evidence_reference"):
            if not record.get(field):
                target_errors.append(f"Missing {field}")
        if record.get("status") != "pass":
            target_errors.append("Status is not pass")
        if record.get("artifact_sha256") and final_artifact.get("sha256") and record.get("artifact_sha256") != final_artifact.get("sha256"):
            target_errors.append("Artifact checksum does not match final artifact")
        for field in ("full_playback_completed", "narration_audible"):
            if record.get(field) is not True:
                target_errors.append(f"{field} is not true")
        if release_path == "video" and target_type in {"browser", "lms"}:
            for field in ("captions_visible", "captions_synchronized", "pause_resume_passed", "seeking_passed"):
                if record.get(field) is not True:
                    target_errors.append(f"{field} is not true")
        if target_type in {"powerpoint", "google_slides"} and record.get("speaker_notes_preserved") is not True:
            target_errors.append("speaker_notes_preserved is not true")

        for defect in record.get("defects", []):
            severity = defect.get("severity", "major")
            if severity in {"blocker", "major"} and defect.get("status") != "resolved":
                slide_id = defect.get("slide_id")
                if slide_id and slide_id not in slide_ids:
                    target_errors.append(f"Defect references unknown slide_id: {slide_id}")
                target_errors.append(f"Unresolved {severity} defect: {defect.get('summary', 'unspecified defect')}")

        target_results.append(
            {
                "target_id": target_id,
                "target_type": target_type,
                "status": "pass" if not target_errors else "blocked",
                "errors": target_errors,
            }
        )
        blockers.extend(f"{target_id}: {error}" for error in target_errors)

    if slide_ids and slide_ids != binding_ids:
        errors.append("Lesson slides do not exactly match binding manifest slide IDs.")

    status = "playback_pass" if not errors and not blockers else "blocked"
    return {
        "version": 1,
        "status": status,
        "pilot_id": lesson_spec.get("pilot_id"),
        "release_path": release_path,
        "slide_count": len(slide_ids),
        "required_targets": sorted(expected_targets),
        "passed_targets": sorted(result["target_type"] for result in target_results if result["status"] == "pass"),
        "errors": errors,
        "warnings": warnings,
        "blockers": blockers,
        "target_results": target_results,
        "secret_values_logged": False,
    }


def main() -> int:
    report = validate_playback_evidence()
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Playback evidence status: {report['status']}")
    print(f"Wrote {REPORT_PATH}")
    return 0 if report["status"] == "playback_pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
