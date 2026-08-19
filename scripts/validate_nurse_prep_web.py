#!/usr/bin/env python3
"""Validate the dependency-free Open NCLEX curriculum dashboard."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "apps" / "nurse-prep-web"
REQUIRED_FILES = ["index.html", "styles.css", "app.js", "README.md", "data/execution-status.json"]


class ScriptAndLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "link" and values.get("rel") == "stylesheet" and values.get("href"):
            self.stylesheets.append(values["href"])
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"])


def validate_app(app_dir: Path = APP_DIR) -> list[str]:
    errors: list[str] = []
    for filename in REQUIRED_FILES:
        if not (app_dir / filename).exists():
            errors.append(f"Missing app file: {filename}")

    index_path = app_dir / "index.html"
    if not index_path.exists():
        return errors

    parser = ScriptAndLinkParser()
    parser.feed(index_path.read_text(encoding="utf-8"))

    for href in parser.stylesheets:
        if href.startswith("./") and not (app_dir / href[2:]).exists():
            errors.append(f"Missing stylesheet referenced by index.html: {href}")
    for src in parser.scripts:
        if src.startswith("./") and not (app_dir / src[2:]).exists():
            errors.append(f"Missing script referenced by index.html: {src}")

    app_js = (app_dir / "app.js").read_text(encoding="utf-8")
    for source in ["./data/execution-status.json"]:
        if source not in app_js:
            errors.append(f"Missing data source reference in app.js: {source}")

    obsolete_terms = ["TTS Pilot", "invalid_api_key", "video_release"]
    for term in obsolete_terms:
        if term in app_js or term in index_path.read_text(encoding="utf-8"):
            errors.append(f"Obsolete media-pipeline surface remains in curriculum dashboard: {term}")

    combined = "\n".join((app_dir / filename).read_text(encoding="utf-8", errors="ignore") for filename in REQUIRED_FILES)
    for term in ["OPENAI_API_KEY=", "sk-proj-", "sk-"]:
        if term in combined:
            errors.append(f"Forbidden secret-like token found in app files: {term}")

    return errors


def main() -> int:
    errors = validate_app()
    if errors:
        print("Nurse Prep web validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Nurse Prep web validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
