#!/usr/bin/env python3
"""Check whether the OpenAI runtime is configured without revealing secrets."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "manifests" / "openai_runtime_check.json"


<<<<<<< HEAD
def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip().lstrip("\ufeff")
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ[key.strip()] = value.strip()


def check_runtime() -> dict[str, object]:
    load_dotenv(ROOT / ".env")
=======
def check_runtime() -> dict[str, object]:
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
    voice = os.environ.get("OPENAI_TTS_VOICE", "marin")

    key_present = bool(api_key.strip())
    plausible_prefix = api_key.startswith(("sk-", "sk-proj-")) if key_present else False

    status = "ready_for_authenticated_probe" if key_present and plausible_prefix else "blocked"
    blockers: list[str] = []
    if not key_present:
        blockers.append("OPENAI_API_KEY is not set in the environment.")
    elif not plausible_prefix:
        blockers.append("OPENAI_API_KEY is set but does not use an expected OpenAI key prefix.")

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "openai_api_key_present": key_present,
        "openai_api_key_prefix_plausible": plausible_prefix,
        "openai_api_key_value_logged": False,
        "tts_model": model,
        "tts_voice": voice,
        "blockers": blockers,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--no-write", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = check_runtime()

    if not args.no_write:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.report}")

    print(f"OpenAI runtime status: {report['status']}")
    return 0 if report["status"] == "ready_for_authenticated_probe" else 1


if __name__ == "__main__":
    raise SystemExit(main())
