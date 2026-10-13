#!/usr/bin/env python3
"""Validate production pilot playback evidence before release."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "qa" / "production_pilot_playback_report.json"
MEDIA_QA_RELATIVE_PATH = Path("qa") / "production_pilot_media_qa_report.json"
SHA256_HEX = re.compile(r"[0-9a-f]{64}")

VALID_RELEASE_PATHS = {
    "video": {"browser", "lms"},
    "pptx": {"powerpoint"},
    "google_slides": {"google_slides"},
}
# Open defects at these severities do not block release; anything else (blocker, major,
# critical, unknown spellings) fails closed.
NON_BLOCKING_DEFECT_SEVERITIES = {"minor", "trivial", "cosmetic"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def is_sha256(value: Any) -> bool:
    """Only a real 64-hex-digit digest counts as a recorded checksum; placeholders never do."""
    return isinstance(value, str) and bool(SHA256_HEX.fullmatch(value.lower()))


def has_secret_marker(value: Any) -> bool:
    if isinstance(value, dict):
        return any(has_secret_marker(item) for item in value.values())
    if isinstance(value, list):
        return any(has_secret_marker(item) for item in value)
    if isinstance(value, str):
        return "OPENAI_API_KEY=" in value or "sk-proj-" in value or "Bearer " in value
    return False


def machine_media_qa_blockers(media_qa_path: Path, pilot_id: Any, final_artifact: dict[str, Any]) -> list[str]:
    """Narrated video needs machine media QA (ffprobe stream QA) recorded against the exact final artifact.

    See docs/ARCHITECTURE.md "Release Rule" and the video_release gate in state/qa_state.json.
    """
    relative = MEDIA_QA_RELATIVE_PATH.as_posix()
    if not media_qa_path.exists():
        return [f"Machine media QA report is not recorded for the video release path ({relative})."]
    try:
        report = load_json(media_qa_path)
    except (OSError, ValueError):
        return [f"Machine media QA report is not valid JSON ({relative})."]
    if not isinstance(report, dict):
        return [f"Machine media QA report is not a JSON object ({relative})."]
    problems: list[str] = []
    if has_secret_marker(report):
        problems.append("Machine media QA report contains a secret-like marker.")
    if report.get("status") != "pass":
        problems.append("Machine media QA status is not pass.")
    if not report.get("pilot_id") or report.get("pilot_id") != pilot_id:
        problems.append("Machine media QA pilot_id does not match lesson_spec.json.")
    if not report.get("artifact_path") or report.get("artifact_path") != final_artifact.get("path"):
        problems.append("Machine media QA artifact path does not match the final artifact.")
    if not report.get("artifact_sha256") or report.get("artifact_sha256") != final_artifact.get("sha256"):
        problems.append("Machine media QA checksum does not match the final artifact.")
    return problems


def validate_playback_evidence(root: Path = ROOT) -> dict[str, Any]:
    lesson_spec_path = root / "lessons" / "production_pilot" / "lesson_spec.json"
    binding_manifest_path = root / "manifests" / "production_pilot_binding_manifest.json"
    evidence_path = root / "qa" / "production_pilot_playback_evidence.json"
    media_qa_path = root / MEDIA_QA_RELATIVE_PATH
    errors: list[str] = []
    warnings: list[str] = []
    blockers: list[str] = []

    for path in (lesson_spec_path, binding_manifest_path, evidence_path):
        if not path.exists():
            errors.append(f"Missing required artifact: {path.relative_to(root).as_posix()}")

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

    lesson_spec = load_json(lesson_spec_path)
    binding_manifest = load_json(binding_manifest_path)
    evidence = load_json(evidence_path)
    if not isinstance(evidence, dict):
        errors.append("Playback evidence is not a JSON object.")
        evidence = {}

    if has_secret_marker(evidence):
        errors.append("Playback evidence contains a secret-like marker.")

    pilot_id = lesson_spec.get("pilot_id")
    slide_ids = {slide.get("slide_id") for slide in lesson_spec.get("slides", [])}
    binding_ids = {binding.get("slide_id") for binding in binding_manifest.get("bindings", [])}
    release_path = evidence.get("release_path")
    final_artifact = evidence.get("final_artifact")
    if not isinstance(final_artifact, dict):
        final_artifact = {}
    records = evidence.get("playback_records", [])

    if not evidence.get("pilot_id") or evidence.get("pilot_id") != pilot_id:
        errors.append("Playback evidence pilot_id does not match lesson_spec.json.")
    if release_path not in VALID_RELEASE_PATHS:
        blockers.append("Release playback path has not been selected.")
    if not final_artifact.get("path") or not final_artifact.get("sha256"):
        blockers.append("Final artifact path and checksum are not recorded.")
    elif not is_sha256(final_artifact.get("sha256")):
        blockers.append("Final artifact checksum is not a SHA-256 hex digest.")
    if not isinstance(records, list) or not records:
        blockers.append("No target-player playback records are recorded.")
        records = []
    if release_path == "video":
        blockers.extend(machine_media_qa_blockers(media_qa_path, pilot_id, final_artifact))

    # Evidence may add targets but can never drop the targets the release path mandates.
    expected_targets = set(VALID_RELEASE_PATHS.get(release_path, set())) | set(evidence.get("required_targets") or [])
    present_targets = {record.get("target_type") for record in records if isinstance(record, dict)}
    for target_type in sorted(expected_targets - present_targets):
        blockers.append(f"Missing required playback target: {target_type}")

    target_results: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            blockers.append(f"record-{index + 1}: Playback record is not an object")
            continue
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

        defects = record.get("defects") or []
        if not isinstance(defects, list):
            target_errors.append("defects is not a list")
            defects = []
        for defect in defects:
            if not isinstance(defect, dict):
                target_errors.append("Defect entry is not an object")
                continue
            severity = str(defect.get("severity") or "major").lower()
            if defect.get("status") != "resolved" and severity not in NON_BLOCKING_DEFECT_SEVERITIES:
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
        "pilot_id": pilot_id,
        "release_path": release_path,
        "final_artifact": {"path": final_artifact.get("path"), "sha256": final_artifact.get("sha256")},
        "slide_count": len(slide_ids),
        "required_targets": sorted(expected_targets),
        "passed_targets": sorted(result["target_type"] for result in target_results if result["status"] == "pass"),
        "errors": errors,
        "warnings": warnings,
        "blockers": blockers,
        "target_results": target_results,
        "secret_values_logged": False,
    }


def main(root: Path = ROOT, report_path: Path | None = None) -> int:
    report_path = report_path or (root / "qa" / "production_pilot_playback_report.json")
    report = validate_playback_evidence(root)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Playback evidence status: {report['status']}")
    print(f"Wrote {report_path}")
    return 0 if report["status"] == "playback_pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
