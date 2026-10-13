"""Scratch-tree helpers shared by the production pilot validator tests."""

from __future__ import annotations

import importlib.util
import json
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PILOT_ID = "therapeutic-communication-pilot"
SHA = "a" * 64
ARTIFACT_PATH = "video/production_pilot/lesson_video.mp4"

PILOT_FILES = (
    Path("lessons/production_pilot/source_manifest.json"),
    Path("lessons/production_pilot/lesson_spec.json"),
    Path("lessons/production_pilot/tts_request_queue.json"),
    Path("lessons/production_pilot/captions.vtt"),
    Path("manifests/production_pilot_audio_manifest.json"),
    Path("manifests/production_pilot_binding_manifest.json"),
    Path("qa/production_pilot_playback_evidence.json"),
    Path("qa/production_pilot_playback_report.json"),
)


def load_script(name: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PLAYBACK = load_script("validate_playback_evidence")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = payload if isinstance(payload, str) else json.dumps(payload)
    path.write_text(text, encoding="utf-8")


def copy_pilot_tree(root: Path) -> None:
    """Copy the committed pilot artifacts (lesson, manifests, evidence, playback report) into a scratch root."""
    for relative in PILOT_FILES:
        (root / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, root / relative)


def passing_record(target_type: str, sha256: str = SHA, **overrides: Any) -> dict[str, Any]:
    record: dict[str, Any] = {
        "target_id": f"{target_type}-1",
        "target_type": target_type,
        "target_name": f"{target_type} player",
        "status": "pass",
        "tested_at": "2026-10-12T00:00:00Z",
        "tester": "QA reviewer",
        "application": "Test application",
        "artifact_sha256": sha256,
        "full_playback_completed": True,
        "narration_audible": True,
        "evidence_reference": "evidence/playback",
        "defects": [],
    }
    if target_type in {"browser", "lms"}:
        record.update(captions_visible=True, captions_synchronized=True, pause_resume_passed=True, seeking_passed=True)
    if target_type in {"powerpoint", "google_slides"}:
        record["speaker_notes_preserved"] = True
    record.update(overrides)
    return record


def evidence_for(release_path: str, records: list[Any], **overrides: Any) -> dict[str, Any]:
    evidence: dict[str, Any] = {
        "version": 1,
        "pilot_id": PILOT_ID,
        "release_path": release_path,
        "final_artifact": {"artifact_type": "mp4" if release_path == "video" else release_path, "path": ARTIFACT_PATH, "sha256": SHA},
        "required_targets": [],
        "playback_records": records,
    }
    evidence.update(overrides)
    return evidence


def passing_evidence(release_path: str) -> dict[str, Any]:
    targets = sorted(PLAYBACK.VALID_RELEASE_PATHS[release_path])
    return evidence_for(release_path, [passing_record(target) for target in targets])


def media_qa_report(**overrides: Any) -> dict[str, Any]:
    report: dict[str, Any] = {
        "version": 1,
        "pilot_id": PILOT_ID,
        "status": "pass",
        "tool": "ffprobe",
        "artifact_path": ARTIFACT_PATH,
        "artifact_sha256": SHA,
    }
    report.update(overrides)
    return report


def write_evidence(root: Path, evidence: Any, media_qa: Any = None) -> None:
    write_json(root / "qa" / "production_pilot_playback_evidence.json", evidence)
    media_qa_path = root / "qa" / "production_pilot_media_qa_report.json"
    if media_qa is None:
        media_qa_path.unlink(missing_ok=True)
    else:
        write_json(media_qa_path, media_qa)


def refresh_playback_report(root: Path) -> dict[str, Any]:
    """Regenerate the committed-style playback report from the scratch tree's evidence."""
    report = PLAYBACK.validate_playback_evidence(root)
    write_json(root / "qa" / "production_pilot_playback_report.json", report)
    return report


def passing_pilot_tree(root: Path, release_path: str = "pptx") -> dict[str, Any]:
    """A scratch tree whose evidence, media QA (video only) and playback report all pass."""
    copy_pilot_tree(root)
    write_evidence(root, passing_evidence(release_path), media_qa_report() if release_path == "video" else None)
    return refresh_playback_report(root)
