#!/usr/bin/env python3
"""Scan repository files for unsafe credential artifacts without reading external secrets."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "manifests" / "credential_guard_report.json"

SKIP_DIRS = {
    ".git",
    ".agents",
    ".codex",
<<<<<<< HEAD
    ".worktrees",
=======
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    "__pycache__",
    ".pytest_cache",
}

<<<<<<< HEAD
SKIP_FILES = {
    ".env",
}

=======
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
ALLOWLISTED_SENSITIVE_PATHS = {
    "scripts/credential_guard.py",
    "manifests/credential_guard_report.json",
}

SENSITIVE_NAME_RE = re.compile(
    r"(api[-_ ]?key|apikey|secret|credential|token|password|private[-_ ]?key)",
    re.IGNORECASE,
)

<<<<<<< HEAD
OPENAI_KEY_RE = re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")

SECRET_CONTAINER_SUFFIXES = {
    "",
    ".env",
    ".json",
    ".key",
    ".pem",
    ".p12",
    ".pfx",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}
=======
BLOCKING_SENSITIVE_NAME_RE = re.compile(
    r"(api[-_ ]?key|apikey|credential|private[-_ ]?key)",
    re.IGNORECASE,
)

OPENAI_KEY_RE = re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277

TEXT_SUFFIXES = {
    ".csv",
    ".env",
    ".example",
    ".json",
    ".md",
    ".py",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}


def iter_repo_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
<<<<<<< HEAD
        if path.name in SKIP_FILES or (path.name.startswith(".env.") and path.name != ".env.example"):
            continue
=======
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
        if path.relative_to(root).as_posix() in ALLOWLISTED_SENSITIVE_PATHS:
            yield path
            continue
        yield path


def should_scan_text(path: Path) -> bool:
    if path.name == ".gitignore" or path.name == ".gitattributes":
        return True
    return path.suffix.lower() in TEXT_SUFFIXES


<<<<<<< HEAD
def is_secret_container_name(path: Path) -> bool:
    return SENSITIVE_NAME_RE.search(path.name) is not None and path.suffix.lower() in SECRET_CONTAINER_SUFFIXES


def scan_repository(root: Path = ROOT) -> dict[str, object]:
    sensitive_filenames: list[str] = []
=======
def scan_repository(root: Path = ROOT) -> dict[str, object]:
    sensitive_filenames: list[str] = []
    blocking_sensitive_filenames: list[str] = []
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    key_pattern_hits: list[dict[str, object]] = []
    unreadable_files: list[str] = []

    for path in iter_repo_files(root):
        rel = path.relative_to(root).as_posix()
<<<<<<< HEAD
        if rel not in ALLOWLISTED_SENSITIVE_PATHS and is_secret_container_name(path):
            sensitive_filenames.append(rel)
            # Do not open files whose names indicate they may contain raw secrets.
            continue
=======
        if rel not in ALLOWLISTED_SENSITIVE_PATHS and SENSITIVE_NAME_RE.search(path.name):
            sensitive_filenames.append(rel)
            if BLOCKING_SENSITIVE_NAME_RE.search(path.name):
                blocking_sensitive_filenames.append(rel)
                # Do not open files whose names indicate they may contain raw API keys.
                continue
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277

        if not should_scan_text(path):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            unreadable_files.append(rel)
            continue

        for match in OPENAI_KEY_RE.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            key_pattern_hits.append({
                "file": rel,
                "line": line,
                "kind": "openai_key_pattern",
                "value_logged": False,
            })

<<<<<<< HEAD
    status = "blocked" if sensitive_filenames or key_pattern_hits or unreadable_files else "pass"
=======
    status = "blocked" if blocking_sensitive_filenames or key_pattern_hits or unreadable_files else "pass"
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "root": str(root),
        "sensitive_filename_count": len(sensitive_filenames),
        "sensitive_filenames": sensitive_filenames,
<<<<<<< HEAD
=======
        "sensitive_filename_severity": "warning" if sensitive_filenames and not blocking_sensitive_filenames else "blocking" if blocking_sensitive_filenames else "none",
        "blocking_sensitive_filename_count": len(blocking_sensitive_filenames),
        "blocking_sensitive_filenames": blocking_sensitive_filenames,
>>>>>>> 179d0db8715932c65de403dd73682be39ba43277
        "key_pattern_hit_count": len(key_pattern_hits),
        "key_pattern_hits": key_pattern_hits,
        "unreadable_file_count": len(unreadable_files),
        "unreadable_files": unreadable_files,
        "external_secret_files_read": False,
        "secret_values_logged": False,
        "notes": [
            "This scan only inspects repository files.",
            "Files with secret-like names are reported by path and not opened.",
            "External key files such as Downloads/openai-api-key.txt are not read.",
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--no-write", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = scan_repository(args.root)

    if not args.no_write:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.report}")

    print(f"Credential guard status: {report['status']}")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
