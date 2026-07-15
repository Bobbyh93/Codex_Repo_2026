#!/usr/bin/env python3
"""Run a credential-backed OpenAI TTS pilot from a committed request queue."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_QUEUE = ROOT / "manifests" / "tts_request_queue.json"
DEFAULT_AUDIO_DIR = ROOT / "audio" / "tts_asset_verification"
DEFAULT_MANIFEST = ROOT / "manifests" / "audio_manifest.json"
DEFAULT_REPORT = ROOT / "qa" / "tts_asset_verification_report.json"
DEFAULT_EXECUTION_REPORT = ROOT / "manifests" / "tts_execution_report.json"
SPEECH_URL = "https://api.openai.com/v1/audio/speech"

BITRATES = {
    1: {
        1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
        2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
        3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    },
    2: {
        1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
        2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
        3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    },
}

SAMPLE_RATES = {
    1: [44100, 48000, 32000, 0],
    2: [22050, 24000, 16000, 0],
    25: [11025, 12000, 8000, 0],
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def request_fingerprint(request_item: dict[str, Any], model: str, response_format: str) -> str:
    payload = {
        "slide_id": request_item["slide_id"],
        "model": model,
        "voice": request_item.get("voice"),
        "response_format": response_format,
        "instructions": request_item.get("instructions", ""),
        "tts_text_sha256": sha256_text(request_item["tts_text"]),
    }
    return sha256_text(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def validate_queue(queue: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    requests = queue.get("requests")
    if not isinstance(requests, list) or not requests:
        return ["Queue must include a non-empty requests array."]

    seen_slide_ids: set[str] = set()
    seen_filenames: set[str] = set()
    for index, item in enumerate(requests):
        prefix = f"requests[{index}]"
        for field in ("slide_id", "slide_number", "slide_title", "tts_text", "output_filename"):
            if field not in item or item[field] in ("", None):
                errors.append(f"{prefix} missing required field: {field}")
        if item.get("approved_for_tts") is not True:
            errors.append(f"{prefix} must be approved_for_tts=true")
        slide_id = item.get("slide_id")
        if slide_id in seen_slide_ids:
            errors.append(f"Duplicate slide_id: {slide_id}")
        seen_slide_ids.add(slide_id)
        filename = item.get("output_filename")
        if filename in seen_filenames:
            errors.append(f"Duplicate output_filename: {filename}")
        seen_filenames.add(filename)
        if filename and not filename.lower().endswith(".mp3"):
            errors.append(f"{prefix} output_filename must end with .mp3")
        if len(str(item.get("tts_text", ""))) > 4096:
            errors.append(f"{prefix} tts_text exceeds 4096 characters")
    return errors


def probable_mp3(data: bytes) -> bool:
    if len(data) < 128:
        return False
    return data.startswith(b"ID3") or data[:2] in {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"}


def skip_id3(data: bytes) -> int:
    if len(data) >= 10 and data.startswith(b"ID3"):
        size = 0
        for byte in data[6:10]:
            size = (size << 7) | (byte & 0x7F)
        return 10 + size
    return 0


def estimate_mp3_duration_seconds(data: bytes) -> float | None:
    offset = skip_id3(data)
    frame_count = 0
    total_samples = 0
    first_sample_rate = 0

    while offset + 4 <= len(data):
        header = int.from_bytes(data[offset : offset + 4], "big")
        if (header & 0xFFE00000) != 0xFFE00000:
            offset += 1
            continue

        version_bits = (header >> 19) & 0x3
        layer_bits = (header >> 17) & 0x3
        bitrate_index = (header >> 12) & 0xF
        sample_rate_index = (header >> 10) & 0x3
        padding = (header >> 9) & 0x1

        if version_bits == 1 or layer_bits == 0 or bitrate_index in {0, 15} or sample_rate_index == 3:
            offset += 1
            continue

        version = 1 if version_bits == 3 else 2 if version_bits == 2 else 25
        bitrate_version = 1 if version == 1 else 2
        layer = 4 - layer_bits
        sample_rate = SAMPLE_RATES[version][sample_rate_index]
        bitrate = BITRATES[bitrate_version][layer][bitrate_index] * 1000

        if not sample_rate or not bitrate:
            offset += 1
            continue

        if layer == 1:
            frame_length = int(((12 * bitrate / sample_rate) + padding) * 4)
            samples = 384
        else:
            samples = 1152 if version == 1 else 576
            frame_length = int((144 * bitrate / sample_rate) + padding) if version == 1 else int((72 * bitrate / sample_rate) + padding)

        if frame_length <= 0:
            offset += 1
            continue

        frame_count += 1
        total_samples += samples
        first_sample_rate = first_sample_rate or sample_rate
        offset += frame_length

    if frame_count == 0 or first_sample_rate == 0:
        return None
    return round(total_samples / first_sample_rate, 3)


def call_openai_speech(api_key: str, item: dict[str, Any], model: str, response_format: str) -> tuple[bytes, dict[str, str]]:
    body = {
        "model": model,
        "voice": item.get("voice", "marin"),
        "input": item["tts_text"],
        "response_format": response_format,
    }
    if item.get("instructions"):
        body["instructions"] = item["instructions"]

    req = urllib.request.Request(
        SPEECH_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read(), {
            "status": str(response.status),
            "request_id": response.headers.get("x-request-id", ""),
            "content_type": response.headers.get("content-type", ""),
        }


def sanitize_http_error(error: urllib.error.HTTPError) -> dict[str, object]:
    try:
        body = error.read().decode("utf-8", errors="replace")
        parsed: object = json.loads(body)
    except Exception:
        parsed = "<non-json response omitted>"

    safe_error: dict[str, object] = {}
    if isinstance(parsed, dict) and isinstance(parsed.get("error"), dict):
        upstream = parsed["error"]
        safe_error = {
            "type": upstream.get("type"),
            "code": upstream.get("code"),
            "param": upstream.get("param"),
            "message_redacted": True,
        }
    return {
        "status": error.code,
        "reason": error.reason,
        "body": {"error": safe_error} if safe_error else "<redacted>",
        "credential_logged": False,
    }


def process_queue(queue: dict[str, Any], audio_dir: Path, live: bool) -> dict[str, Any]:
    load_dotenv(ROOT / ".env")
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("OPENAI_TTS_MODEL", queue.get("default_model", "gpt-4o-mini-tts"))
    voice_default = os.environ.get("OPENAI_TTS_VOICE", queue.get("default_voice", "marin"))
    response_format = queue.get("response_format", "mp3")

    errors = validate_queue(queue)
    if errors:
        return {"status": "blocked", "errors": errors, "records": []}

    if live and not api_key:
        return {"status": "blocked", "errors": ["OPENAI_API_KEY is not set."], "records": []}

    audio_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    execution_errors: list[dict[str, Any]] = []

    for item in queue["requests"]:
        item = {**item, "voice": item.get("voice") or voice_default}
        output_path = audio_dir / item["output_filename"]
        text_sha = sha256_text(item["tts_text"])
        fingerprint = request_fingerprint(item, model, response_format)

        record: dict[str, Any] = {
            "slide_id": item["slide_id"],
            "slide_number": item["slide_number"],
            "slide_title": item["slide_title"],
            "model": model,
            "voice": item["voice"],
            "response_format": response_format,
            "output_file": str(output_path.relative_to(ROOT)).replace("\\", "/"),
            "tts_text_sha256": text_sha,
            "request_fingerprint": fingerprint,
            "source": "openai_live" if live else "planning_only",
            "credential_logged": False,
        }

        if not live:
            record["status"] = "planned"
            records.append(record)
            continue

        partial_path = output_path.with_suffix(output_path.suffix + ".partial")
        try:
            data, response_meta = call_openai_speech(api_key, item, model, response_format)
            if not probable_mp3(data):
                raise ValueError("OpenAI response did not look like an MP3 file.")

            partial_path.write_bytes(data)
            partial_path.replace(output_path)

            duration = estimate_mp3_duration_seconds(data)
            record.update(
                {
                    "status": "verified",
                    "bytes": len(data),
                    "sha256": sha256_bytes(data),
                    "duration_seconds": duration,
                    "probable_mp3": True,
                    "decoded_duration_available": duration is not None,
                    "openai_request_id": response_meta.get("request_id", ""),
                    "response_content_type": response_meta.get("content_type", ""),
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        except urllib.error.HTTPError as error:
            record["status"] = "failed"
            record["error"] = sanitize_http_error(error)
            execution_errors.append({"slide_id": item["slide_id"], "error": record["error"]})
        except Exception as error:  # noqa: BLE001 - errors are serialized without secrets.
            record["status"] = "failed"
            record["error"] = {"message": str(error), "credential_logged": False}
            execution_errors.append({"slide_id": item["slide_id"], "error": record["error"]})
        finally:
            if partial_path.exists():
                partial_path.unlink()

        records.append(record)
        time.sleep(0.25)

    verified_count = sum(1 for record in records if record.get("status") == "verified")
    status = "pass" if live and verified_count == len(records) else "planned" if not live else "blocked"
    return {
        "status": status,
        "queue_id": queue.get("queue_id"),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "live_execution": live,
        "secret_values_logged": False,
        "records": records,
        "errors": execution_errors,
    }


def build_binding_manifest(result: dict[str, Any]) -> dict[str, Any]:
    bindings = []
    for record in result.get("records", []):
        if record.get("status") != "verified":
            continue
        bindings.append(
            {
                "slide_id": record["slide_id"],
                "slide_number": record["slide_number"],
                "audio_file": record["output_file"],
                "audio_sha256": record["sha256"],
                "audio_duration_seconds": record["duration_seconds"],
                "request_fingerprint": record["request_fingerprint"],
                "binding_status": "ready_for_downstream_binding",
            }
        )
    return {
        "version": 1,
        "status": "ready_for_downstream_binding" if bindings and len(bindings) == len(result.get("records", [])) else "blocked",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bindings": bindings,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--execution-report", type=Path, default=DEFAULT_EXECUTION_REPORT)
    parser.add_argument("--binding-manifest", type=Path, default=ROOT / "manifests" / "binding_manifest.json")
    parser.add_argument("--live", action="store_true", help="Call OpenAI speech endpoint. Without this, only plans outputs.")
    return parser.parse_args()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    queue = json.loads(args.queue.read_text(encoding="utf-8"))
    result = process_queue(queue, args.audio_dir, args.live)
    binding_manifest = build_binding_manifest(result)

    write_json(args.execution_report, result)
    write_json(args.manifest, {"version": 1, "audio_assets": result.get("records", [])})
    write_json(args.binding_manifest, binding_manifest)
    write_json(
        args.report,
        {
            "version": 1,
            "status": result["status"],
            "queue_id": result.get("queue_id"),
            "verified_asset_count": sum(1 for record in result.get("records", []) if record.get("status") == "verified"),
            "planned_asset_count": len(result.get("records", [])),
            "binding_manifest_status": binding_manifest["status"],
            "secret_values_logged": False,
            "errors": result.get("errors", []),
        },
    )

    print(f"TTS pilot status: {result['status']}")
    print(f"Wrote {args.execution_report}")
    print(f"Wrote {args.report}")
    return 0 if result["status"] in {"pass", "planned"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
