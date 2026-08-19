#!/usr/bin/env python3
"""Fail-closed governance and artifact validation for a Harrity lesson package."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
TARGETS = ("intake_complete", "faculty_review", "production_ready", "release_ready")
GATES = ("taxonomy", "objectives", "outline", "script", "accessibility")
ACCESSIBILITY_CHECKS = ("readingOrderChecked", "contrastChecked", "meaningNotColorOnly", "transcriptAvailable")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def stable_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def missing(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def approval_fingerprints(governance: dict[str, Any], lesson: dict[str, Any], sources: dict[str, Any]) -> dict[str, str]:
    source_snapshot = [{"id": item.get("source_id"), "approvalStatus": item.get("approval_status")} for item in sources.get("sources", [])]
    slides = lesson.get("slides", [])
    slide_snapshot = [{
        "id": item.get("slide_id"), "slideNumber": item.get("slide_number"), "title": item.get("slide_title"),
        "visibleContent": item.get("on_slide_text"), "nclexCategory": item.get("nclex_client_need"), "cjmStep": item.get("cjmm_steps"),
    } for item in slides]
    traces = governance.get("slideTraceability", [])
    objective_map = [{"slideId": item.get("slideId"), "objectiveIds": item.get("objectiveIds", [])} for item in traces]
    accessibility = [{"slideId": item.get("slideId"), "accessibility": item.get("accessibility", {})} for item in traces]
    shared = {"sources": source_snapshot, "taxonomy": governance.get("taxonomy", {})}
    payloads = {
        "taxonomy": shared,
        "objectives": {**shared, "learningOutcomes": governance.get("learningOutcomes", [])},
        "outline": {**shared, "sourceGovernance": governance.get("sourceGovernance", {}), "learningOutcomes": governance.get("learningOutcomes", []), "objectiveMap": objective_map, "slides": slide_snapshot},
        "script": {**shared, "sourceGovernance": governance.get("sourceGovernance", {}), "learningOutcomes": governance.get("learningOutcomes", []), "objectiveMap": objective_map, "slides": slide_snapshot, "speakerNotes": [{"id": item.get("slide_id"), "speakerNotes": item.get("speaker_notes")} for item in slides]},
        "accessibility": {**shared, "sourceGovernance": governance.get("sourceGovernance", {}), "learningOutcomes": governance.get("learningOutcomes", []), "objectiveMap": objective_map, "slides": slide_snapshot, "accessibility": accessibility},
    }
    return {gate: stable_hash(payload) for gate, payload in payloads.items()}


def current_approvals(governance: dict[str, Any], fingerprints: dict[str, str]) -> dict[str, bool]:
    result: dict[str, bool] = {}
    approvals = governance.get("approvals", [])
    for gate in GATES:
        latest = next((item for item in approvals if item.get("gate") == gate), None)
        result[gate] = bool(latest and latest.get("decision") == "approved" and latest.get("fingerprint") == fingerprints[gate])
    return result


def validate_lesson(lesson_dir: Path, target: str) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    target_index = TARGETS.index(target)

    def finding(code: str, location: str, message: str) -> None:
        findings.append({"severity": "blocker", "code": code, "location": location, "message": message})

    def require(location: str, value: Any) -> None:
        if missing(value):
            finding("required_value", location, "Required value is not resolved.")

    paths = {name: lesson_dir / file_name for name, file_name in {
        "governance": "governance.json", "lesson": "lesson_spec.json", "sources": "source_manifest.json", "tts": "tts_request_queue.json",
    }.items()}
    for name, path in paths.items():
        if not path.exists():
            finding("missing_artifact", name, f"Missing {path.as_posix()}.")
    if findings:
        return build_report(lesson_dir, target, findings, {})

    governance = load_json(paths["governance"])
    lesson = load_json(paths["lesson"])
    sources = load_json(paths["sources"])
    tts = load_json(paths["tts"])
    source_rows = sources.get("sources", [])
    source_ids = {item.get("source_id") for item in source_rows}
    slides = lesson.get("slides", [])
    slide_ids = [item.get("slide_id") for item in slides]
    outcomes = governance.get("learningOutcomes", [])
    objective_ids = [item.get("objectiveId") for item in outcomes]

    require("lessonId", governance.get("lessonId"))
    for field in ("courseId", "courseName", "programLevel", "contentOwner", "facultyReviewer"):
        require(f"administrative.{field}", governance.get("administrative", {}).get(field))
    source_governance = governance.get("sourceGovernance", {})
    require("sourceGovernance.organizingClinicalQuestion", source_governance.get("organizingClinicalQuestion"))
    if not source_governance.get("coverageComplete"):
        finding("source_coverage", "sourceGovernance.coverageComplete", "Source coverage is incomplete.")
    if not source_rows or any(not str(item.get("approval_status", "")).startswith("approved") for item in source_rows):
        finding("source_approval", "source_manifest.sources", "Every source must be approved.")

    if target_index >= TARGETS.index("faculty_review"):
        taxonomy = governance.get("taxonomy", {})
        for field in ("concept", "nclexClientNeed", "bodySystem", "priorityFramework", "bloomLevels", "qsenDomains", "aacnCompetencies", "ncjmmFunctions"):
            require(f"taxonomy.{field}", taxonomy.get(field))
        if not outcomes:
            finding("learning_outcomes", "learningOutcomes", "At least one learning outcome is required.")
        if len(objective_ids) != len(set(objective_ids)):
            finding("duplicate_id", "learningOutcomes", "Learning outcome IDs must be unique.")
        for index, outcome in enumerate(outcomes):
            for field in ("objectiveId", "statement", "bloomLevel", "assessmentMethod"):
                require(f"learningOutcomes.{index}.{field}", outcome.get(field))

    if not slides:
        finding("slide_inventory", "lesson_spec.slides", "Lesson has no slides.")
    if len(slide_ids) != len(set(slide_ids)):
        finding("duplicate_id", "lesson_spec.slides", "Slide IDs must be unique.")
    for index, slide in enumerate(slides):
        for field in ("slide_id", "slide_title", "on_slide_text", "speaker_notes", "tts_text", "source_refs"):
            require(f"lesson_spec.slides.{index}.{field}", slide.get(field))
        unknown_sources = set(slide.get("source_refs", [])) - source_ids
        if unknown_sources:
            finding("broken_reference", f"lesson_spec.slides.{index}.source_refs", f"Unknown source IDs: {sorted(unknown_sources)}")

    queued_ids = {item.get("slide_id") for item in tts.get("requests", [])}
    if target_index >= TARGETS.index("faculty_review"):
        traces = governance.get("slideTraceability", [])
        trace_by_id = {item.get("slideId"): item for item in traces}
        if len(trace_by_id) != len(traces):
            finding("duplicate_id", "slideTraceability", "Traceability slide IDs must be unique.")
        for slide_id in slide_ids:
            trace = trace_by_id.get(slide_id)
            if not trace:
                finding("missing_trace", f"slideTraceability.{slide_id}", "Slide has no governance trace.")
                continue
            mapped = trace.get("objectiveIds", [])
            if not mapped:
                finding("objective_mapping", f"slideTraceability.{slide_id}.objectiveIds", "Slide has no learning outcome mapping.")
            unknown = set(mapped) - set(objective_ids)
            if unknown:
                finding("broken_reference", f"slideTraceability.{slide_id}.objectiveIds", f"Unknown objective IDs: {sorted(unknown)}")
            if target_index >= TARGETS.index("production_ready"):
                for check in ACCESSIBILITY_CHECKS:
                    if trace.get("accessibility", {}).get(check) is not True:
                        finding("accessibility", f"slideTraceability.{slide_id}.accessibility.{check}", "Accessibility check has not passed.")
        if set(slide_ids) != queued_ids:
            finding("tts_reconciliation", "tts_request_queue.requests", "TTS queue IDs do not exactly match the lesson.")

    fingerprints = approval_fingerprints(governance, lesson, sources)
    approvals = current_approvals(governance, fingerprints)
    if target_index >= TARGETS.index("production_ready"):
        if governance.get("taxonomyStatus") != "locked":
            finding("taxonomy_lock", "taxonomyStatus", "Taxonomy is not locked.")
        for gate in GATES:
            if not approvals[gate]:
                finding("approval", f"approvals.{gate}", f"{gate.title()} approval is missing, revoked, or stale.")
        review_path = lesson_dir / "faculty_review.json"
        review = load_json(review_path) if review_path.exists() else {}
        if review.get("decision") not in ("approved_for_pilot", "approved_for_release") or review.get("governanceFingerprint") != fingerprints["accessibility"]:
            finding("faculty_review", "faculty_review", "A current faculty approval is required.")

    metrics: dict[str, Any] = {
        "slide_count": len(slides), "source_count": len(source_ids), "objective_count": len(objective_ids), "tts_request_count": len(queued_ids),
    }
    if target == "release_ready":
        review_path = lesson_dir / "faculty_review.json"
        review = load_json(review_path) if review_path.exists() else {}
        if review.get("decision") != "approved_for_release" or review.get("licensedRn") is not True or review.get("governanceFingerprint") != fingerprints["accessibility"]:
            finding("licensed_rn_release", "faculty_review", "A current licensed-RN release approval is required.")
        validate_release_assets(lesson_dir, slide_ids, finding, metrics)

    metrics["current_approval_count"] = sum(approvals.values())
    return build_report(lesson_dir, target, findings, metrics)


def validate_release_assets(lesson_dir: Path, slide_ids: list[Any], finding: Callable[[str, str, str], None], metrics: dict[str, Any]) -> None:
    expected = {
        "audio": ROOT / "manifests" / f"{lesson_dir.name}_audio_manifest.json",
        "binding": ROOT / "manifests" / f"{lesson_dir.name}_binding_manifest.json",
        "playback": ROOT / "qa" / f"{lesson_dir.name}_playback_report.json",
    }
    for name, path in expected.items():
        if not path.exists():
            finding("missing_artifact", name, f"Missing {path.relative_to(ROOT).as_posix()}.")
    if any(not path.exists() for path in expected.values()):
        return
    audio, binding, playback = (load_json(expected[name]) for name in ("audio", "binding", "playback"))
    verified = {item.get("slide_id") for item in audio.get("audio_assets", []) if item.get("status") == "verified" and item.get("sha256") and item.get("duration_seconds")}
    bound = {item.get("slide_id") for item in binding.get("bindings", []) if item.get("binding_status") == "ready_for_downstream_binding" and item.get("audio_sha256")}
    metrics.update({"verified_audio_count": len(verified), "binding_count": len(bound), "playback_status": playback.get("status")})
    if verified != set(slide_ids):
        finding("audio_reconciliation", "audio_manifest", "Verified audio IDs do not exactly match the lesson.")
    if bound != set(slide_ids):
        finding("binding_reconciliation", "binding_manifest", "Ready binding IDs do not exactly match the lesson.")
    if playback.get("status") != "playback_pass":
        finding("playback", "playback_report.status", "Playback evidence has not passed.")


def build_report(lesson_dir: Path, target: str, findings: list[dict[str, str]], metrics: dict[str, Any]) -> dict[str, Any]:
    return {
        "report_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lesson_directory": lesson_dir.relative_to(ROOT).as_posix() if lesson_dir.is_relative_to(ROOT) else str(lesson_dir),
        "target": target,
        "status": "pass" if not findings else "blocked",
        "eligible_next_stage": target if not findings else "remediation",
        "summary": {"blockers": len(findings), "total_findings": len(findings)},
        "metrics": metrics,
        "findings": findings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("lesson_dir", type=Path)
    parser.add_argument("--target", choices=TARGETS, default="production_ready")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    lesson_dir = args.lesson_dir if args.lesson_dir.is_absolute() else ROOT / args.lesson_dir
    report = validate_lesson(lesson_dir.resolve(), args.target)
    output = json.dumps(report, indent=2) + "\n"
    if args.report:
        report_path = args.report if args.report.is_absolute() else ROOT / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(output, encoding="utf-8")
    print(output, end="")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
