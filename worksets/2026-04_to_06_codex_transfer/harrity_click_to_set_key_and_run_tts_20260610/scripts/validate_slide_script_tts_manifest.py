import json
import sys
from pathlib import Path

BLOCKED_FRAGMENTS = ["TODO", "http://", "https://", "[", "]"]


def fail(message: str) -> None:
    raise ValueError(message)


def validate_manifest(path: str) -> dict:
    manifest_path = Path(path)
    if not manifest_path.exists():
        fail(f"Manifest not found: {path}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    for field in ["package_id", "lesson_title", "tts_contract_version", "render_policy", "slides"]:
        if field not in manifest:
            fail(f"Missing top-level field: {field}")

    policy = manifest["render_policy"]
    if policy.get("provider") != "openai":
        fail("render_policy.provider must equal openai")
    if policy.get("fallback_policy") != "block_not_fake":
        fail("fallback_policy must equal block_not_fake")
    if not policy.get("requires_locked_script", False):
        fail("requires_locked_script must be true")

    slides = manifest["slides"]
    if not isinstance(slides, list) or not slides:
        fail("slides must be a non-empty array")

    seen_ids = set()
    for index, slide in enumerate(slides, start=1):
        sid = slide.get("slide_id")
        if not sid:
            fail(f"Slide {index} missing slide_id")
        if sid in seen_ids:
            fail(f"Duplicate slide_id: {sid}")
        seen_ids.add(sid)

        required = ["slide_number", "slide_title", "narration_script_status", "narration_script_locked", "duration_target_sec", "output_file", "status"]
        for field in required:
            if field not in slide:
                fail(f"{sid} missing field: {field}")

        if slide.get("narration_script_status") != "script_locked":
            fail(f"{sid} is not script_locked")
        if slide.get("status") != "tts_ready":
            fail(f"{sid} status must be tts_ready before rendering")

        script = str(slide.get("narration_script_locked", "")).strip()
        if not script:
            fail(f"{sid} has empty narration_script_locked")
        for fragment in BLOCKED_FRAGMENTS:
            if fragment in script:
                fail(f"{sid} contains blocked fragment: {fragment}")

        if float(slide.get("duration_target_sec", 0)) <= 0:
            fail(f"{sid} duration_target_sec must be greater than zero")

    return manifest


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "manifests/slide_script_tts_manifest.json"
    manifest = validate_manifest(path)
    print(json.dumps({"status": "pass", "package_id": manifest["package_id"], "slide_count": len(manifest["slides"])}, indent=2))
