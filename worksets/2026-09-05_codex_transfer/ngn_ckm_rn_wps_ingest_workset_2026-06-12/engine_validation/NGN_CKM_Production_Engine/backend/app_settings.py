"""User-editable application settings."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"
CONFIG_PATH = CONFIG_DIR / "app_settings.json"

DEFAULT_SETTINGS = {
    "diagram_provider": "local",
    "openai_api_key": "",
    "openai_image_model": "gpt-image-1",
    "openai_image_size": "1024x1024",
    "openai_images_url": "https://api.openai.com/v1/images/generations",
    "openai_text_model": "gpt-4.1-mini",
    "use_openai_for_extraction": True,
}


def _masked(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "********"
    return value[:3] + "..." + value[-4:]


def load_settings(mask_secret: bool = True) -> dict:
    CONFIG_DIR.mkdir(exist_ok=True)
    settings = DEFAULT_SETTINGS.copy()
    if CONFIG_PATH.exists():
        try:
            settings.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except Exception:
            pass
    if mask_secret:
        settings["openai_api_key_masked"] = _masked(settings.get("openai_api_key", ""))
        settings.pop("openai_api_key", None)
    return settings


def save_settings(payload: dict) -> dict:
    current = load_settings(mask_secret=False)
    for key in DEFAULT_SETTINGS:
        if key in payload:
            value = payload[key]
            if key == "openai_api_key" and not value:
                # Preserve existing key when blank unless caller explicitly clears it.
                continue
            current[key] = value
    CONFIG_DIR.mkdir(exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(current, indent=2), encoding="utf-8")
    apply_settings(current)
    return load_settings(mask_secret=True)


def clear_api_key() -> dict:
    current = load_settings(mask_secret=False)
    current["openai_api_key"] = ""
    CONFIG_DIR.mkdir(exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(current, indent=2), encoding="utf-8")
    apply_settings(current)
    return load_settings(mask_secret=True)


def apply_settings(settings: dict | None = None) -> None:
    settings = settings or load_settings(mask_secret=False)
    os.environ["DIAGRAM_PROVIDER"] = settings.get("diagram_provider", "local") or "local"
    if settings.get("openai_api_key"):
        os.environ["OPENAI_API_KEY"] = settings["openai_api_key"]
    os.environ["OPENAI_IMAGE_MODEL"] = settings.get("openai_image_model", "gpt-image-1") or "gpt-image-1"
    os.environ["OPENAI_IMAGE_SIZE"] = settings.get("openai_image_size", "1024x1024") or "1024x1024"
    os.environ["OPENAI_IMAGES_URL"] = settings.get("openai_images_url", "https://api.openai.com/v1/images/generations")
    os.environ["OPENAI_TEXT_MODEL"] = settings.get("openai_text_model", "gpt-4.1-mini") or "gpt-4.1-mini"
    os.environ["USE_OPENAI_FOR_EXTRACTION"] = "1" if settings.get("use_openai_for_extraction", True) else "0"
