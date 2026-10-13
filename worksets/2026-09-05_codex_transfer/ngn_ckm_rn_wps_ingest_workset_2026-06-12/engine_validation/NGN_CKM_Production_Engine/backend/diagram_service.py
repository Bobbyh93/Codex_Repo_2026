"""Diagram generation service with OpenAI image API bridge and deterministic fallback.

Runtime modes:
- DIAGRAM_PROVIDER=openai: call the OpenAI Images API and cache the returned PNG.
- DIAGRAM_PROVIDER=local: generate a deterministic local PNG for offline development.

The local provider is not a placeholder claim: it creates a real PNG file and records
provider metadata. Production deployments should set DIAGRAM_PROVIDER=openai and
OPENAI_API_KEY.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "diagram_cache"
CACHE_DIR.mkdir(exist_ok=True)

DiagramType = Literal["flow", "anatomy", "comparison", "timeline"]

STYLE_PRESETS = {
    "ati": "clean nursing education style, high contrast, simple labels, ATI-style instructional clarity",
    "clinical": "clinical education style, concise labels, professional medical learning graphic",
    "minimal": "minimal diagram style, clear hierarchy, sparse text, white background",
}


def get_diagram_provider() -> str:
    return os.environ.get("DIAGRAM_PROVIDER", "local").strip().lower()


def hash_prompt(prompt: str, style: str, diagram_type: str, provider: str) -> str:
    return hashlib.sha256(f"{provider}|{diagram_type}|{style}|{prompt}".encode("utf-8")).hexdigest()


def build_diagram_prompt(topic: str, diagram_type: DiagramType = "flow", style: str = "ati") -> str:
    style_text = STYLE_PRESETS.get(style, STYLE_PRESETS["ati"])
    if diagram_type == "flow":
        return (
            "Create a step-by-step process flow diagram for nursing education. "
            f"Topic: {topic}. Requirements: clear arrows, 4-6 sequential steps, concise labels, "
            f"no dense paragraphs, white background. Style: {style_text}."
        )
    if diagram_type == "anatomy":
        return (
            "Create a labeled anatomy or body-system diagram for nursing education. "
            f"Topic: {topic}. Requirements: key structures only, concise labels, high readability, "
            f"white background. Style: {style_text}."
        )
    if diagram_type == "comparison":
        return (
            "Create a side-by-side comparison diagram for nursing education. "
            f"Topic: {topic}. Requirements: clear headings, minimal text, emphasize differences, "
            f"white background. Style: {style_text}."
        )
    if diagram_type == "timeline":
        return (
            "Create a left-to-right timeline diagram for nursing education. "
            f"Topic: {topic}. Requirements: chronological stages, concise labels, clear progression, "
            f"white background. Style: {style_text}."
        )
    raise ValueError(f"unsupported_diagram_type:{diagram_type}")


def _wrap(text: str, max_chars: int = 28) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        if len(current) + len(word) + 1 <= max_chars:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:5]


def make_diagram_png(topic: str, diagram_type: DiagramType, output_path: Path) -> Path:
    """Offline deterministic diagram renderer used for development and tests."""
    img = Image.new("RGB", (1280, 720), "white")
    draw = ImageDraw.Draw(img)
    try:
        title_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 44)
        body_font = ImageFont.truetype("DejaVuSans.ttf", 28)
    except Exception:
        title_font = ImageFont.load_default()
        body_font = ImageFont.load_default()

    title = f"{diagram_type.title()} Diagram"
    draw.text((60, 40), title, fill="black", font=title_font)
    draw.text((60, 100), topic[:90], fill="black", font=body_font)

    if diagram_type == "flow":
        steps = ["Cue", "Pattern", "Priority", "Action", "Evaluate"]
        x = 80
        y = 300
        box_w = 190
        box_h = 90
        for i, step in enumerate(steps):
            draw.rounded_rectangle((x, y, x + box_w, y + box_h), radius=16, outline="black", width=3)
            draw.text((x + 35, y + 28), step, fill="black", font=body_font)
            if i < len(steps) - 1:
                draw.line((x + box_w + 10, y + box_h / 2, x + box_w + 60, y + box_h / 2), fill="black", width=4)
                draw.polygon([(x + box_w + 60, y + box_h / 2), (x + box_w + 44, y + box_h / 2 - 10), (x + box_w + 44, y + box_h / 2 + 10)], fill="black")
            x += 230
    elif diagram_type == "comparison":
        headers = ["Expected", "Concern", "Priority"]
        for i, header in enumerate(headers):
            x0 = 90 + i * 390
            draw.rectangle((x0, 250, x0 + 330, 540), outline="black", width=3)
            draw.text((x0 + 40, 275), header, fill="black", font=body_font)
            for j, line in enumerate(_wrap(topic, 22)[:3]):
                draw.text((x0 + 30, 340 + 42 * j), line, fill="black", font=body_font)
    elif diagram_type == "timeline":
        draw.line((120, 380, 1160, 380), fill="black", width=5)
        stages = ["Start", "Progress", "Risk", "Intervene", "Outcome"]
        for i, stage in enumerate(stages):
            x = 120 + i * 260
            draw.ellipse((x - 22, 358, x + 22, 402), outline="black", width=4)
            draw.text((x - 45, 430), stage, fill="black", font=body_font)
    else:  # anatomy
        draw.ellipse((470, 210, 810, 560), outline="black", width=4)
        draw.line((650, 210, 650, 560), fill="black", width=2)
        labels = ["Structure", "Function", "Risk", "Cue"]
        positions = [(250, 230), (860, 260), (250, 480), (860, 500)]
        for label, pos in zip(labels, positions):
            draw.text(pos, label, fill="black", font=body_font)
            draw.line((pos[0] + 140, pos[1] + 15, 640, 380), fill="black", width=2)

    img.save(output_path)
    return output_path


def _openai_payload(prompt: str) -> dict:
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
    size = os.environ.get("OPENAI_IMAGE_SIZE", "1024x1024")
    return {"model": model, "prompt": prompt, "size": size, "n": 1}


def call_openai_image_api(prompt: str, output_path: Path) -> Path:
    """Call the OpenAI Images API and save the result to output_path.

    Supports either b64_json or url responses. This keeps the package independent
    of the OpenAI Python SDK so PyInstaller packaging stays simple.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required when DIAGRAM_PROVIDER=openai")

    req = urllib.request.Request(
        os.environ.get("OPENAI_IMAGES_URL", "https://api.openai.com/v1/images/generations"),
        data=json.dumps(_openai_payload(prompt)).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=int(os.environ.get("OPENAI_IMAGE_TIMEOUT", "120"))) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"openai_image_api_error:{exc.code}:{detail}") from exc

    data = (payload.get("data") or [{}])[0]
    if data.get("b64_json"):
        output_path.write_bytes(base64.b64decode(data["b64_json"]))
        return output_path
    if data.get("url"):
        with urllib.request.urlopen(data["url"], timeout=120) as img_resp:
            output_path.write_bytes(img_resp.read())
        return output_path
    raise RuntimeError(f"openai_image_api_missing_image:{payload}")


def generate_diagram(topic: str, diagram_type: DiagramType = "flow", style: str = "ati") -> dict:
    prompt = build_diagram_prompt(topic, diagram_type, style)
    provider = get_diagram_provider()
    cache_key = hash_prompt(prompt, style, diagram_type, provider)
    output_path = CACHE_DIR / f"{cache_key}.png"
    if output_path.exists():
        return {
            "status": "cached",
            "file": str(output_path),
            "prompt": prompt,
            "diagram_type": diagram_type,
            "style": style,
            "provider": provider,
        }

    if provider == "openai":
        call_openai_image_api(prompt, output_path)
    elif provider == "local":
        make_diagram_png(topic, diagram_type, output_path)
    else:
        raise ValueError(f"unsupported_diagram_provider:{provider}")

    return {
        "status": "generated",
        "file": str(output_path),
        "prompt": prompt,
        "diagram_type": diagram_type,
        "style": style,
        "provider": provider,
    }
