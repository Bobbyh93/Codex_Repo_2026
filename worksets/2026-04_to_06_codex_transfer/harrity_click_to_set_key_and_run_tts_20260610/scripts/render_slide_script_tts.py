import json
import os
import hashlib
from pathlib import Path
from openai import OpenAI

MANIFEST_PATH = os.getenv("SLIDE_SCRIPT_TTS_MANIFEST", "manifests/slide_script_tts_manifest.json")
QA_PATH = os.getenv("SLIDE_SCRIPT_TTS_QA", "manifests/tts_render_qa.json")

BLOCKED_FRAGMENTS = ["TODO", "http://", "https://", "[", "]"]


def sha256_text(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_slide(slide: dict) -> None:
    sid = slide.get("slide_id", "UNKNOWN")
    if slide.get("narration_script_status") != "script_locked":
        raise ValueError(f"{sid} is not script_locked")
    if slide.get("status") != "tts_ready":
        raise ValueError(f"{sid} status must be tts_ready before rendering")
    script = slide.get("narration_script_locked", "").strip()
    if not script:
        raise ValueError(f"{sid} has no locked narration script")
    for fragment in BLOCKED_FRAGMENTS:
        if fragment in script:
            raise ValueError(f"{sid} contains blocked fragment: {fragment}")


def render_audio(client: OpenAI, text: str, model: str, voice: str, output_file: str, response_format: str) -> None:
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with client.audio.speech.with_streaming_response.create(
        model=model,
        voice=voice,
        input=text,
        response_format=response_format
    ) as response:
        response.stream_to_file(output_path)


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise EnvironmentError("OPENAI_API_KEY is required for Slide Script TTS rendering")

    manifest = json.loads(Path(MANIFEST_PATH).read_text(encoding="utf-8"))
    policy = manifest["render_policy"]
    if policy.get("provider") != "openai":
        raise ValueError("Only provider=openai is supported")
    if policy.get("fallback_policy") != "block_not_fake":
        raise ValueError("fallback_policy must be block_not_fake")

    model = policy.get("model", "gpt-4o-mini-tts")
    default_voice = policy.get("default_voice", "marin")
    response_format = policy.get("format", "mp3")

    client = OpenAI()
    qa_results = {
        "package_id": manifest["package_id"],
        "lesson_title": manifest["lesson_title"],
        "tts_contract_version": manifest["tts_contract_version"],
        "results": []
    }

    for slide in manifest["slides"]:
        validate_slide(slide)
        text = slide["narration_script_locked"]
        voice = slide.get("voice") or default_voice
        output_file = slide["output_file"]
        render_audio(client, text, model, voice, output_file, response_format)
        qa_results["results"].append({
            "slide_id": slide["slide_id"],
            "slide_number": slide["slide_number"],
            "output_file": output_file,
            "render_status": "success",
            "model": model,
            "voice": voice,
            "text_hash": sha256_text(text),
            "qa_status": "pass"
        })

    Path(QA_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(QA_PATH).write_text(json.dumps(qa_results, indent=2), encoding="utf-8")
    print(json.dumps({"status": "success", "qa_manifest": QA_PATH, "slides_rendered": len(qa_results["results"])}, indent=2))


if __name__ == "__main__":
    main()
