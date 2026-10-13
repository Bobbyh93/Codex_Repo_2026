#!/usr/bin/env python3
"""Build the source-grounded therapeutic communication production pilot package."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "attached_assets" / "documents" / "1782498098664_7a3df232109ce17b_nursestudy_pilot_therapeutic_communication_source.txt"
SOURCE_META_PATH = SOURCE_PATH.with_suffix(SOURCE_PATH.suffix + ".metadata.json")
LESSON_DIR = ROOT / "lessons" / "production_pilot"
SLIDES_DIR = ROOT / "slides" / "production_pilot"
PILOT_ID = "therapeutic-communication-pilot"


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def slide_specs(source_id: str) -> list[dict[str, Any]]:
    return [
        {
            "slide_id": "P01",
            "slide_number": 1,
            "slide_title": "Notice the Therapeutic Cue",
            "on_slide_text": [
                "Patient says they are frightened before a procedure.",
                "Recognize the emotion before moving to teaching.",
                "Ask focused, open-ended questions."
            ],
            "speaker_notes": "When a patient says they are frightened before a procedure, the first nursing move is to notice that emotional cue. Therapeutic communication starts by acknowledging the feeling, then assessing what the patient understands and what concern is driving the fear.",
            "tts_text": "When a patient says they are frightened before a procedure, first notice the emotional cue. A therapeutic response acknowledges the feeling, assesses understanding, and invites the patient to describe the concern.",
            "source_refs": [source_id],
            "nclex_client_need": "Psychosocial Integrity",
            "cjmm_steps": ["Recognize Cues", "Analyze Cues"],
            "qa_status": "source_grounded"
        },
        {
            "slide_id": "P02",
            "slide_number": 2,
            "slide_title": "Choose the Best First Response",
            "on_slide_text": [
                "Avoid false reassurance.",
                "Avoid minimizing the concern.",
                "Reflect emotion and clarify meaning."
            ],
            "speaker_notes": "A common testing trap is choosing advice or reassurance too soon. Responses like do not worry or everything will be fine can minimize the patient's concern. A stronger response reflects emotion and asks the patient to say more.",
            "tts_text": "Avoid false reassurance and avoid minimizing the concern. Instead, reflect the patient's emotion and clarify meaning. A stronger response invites the patient to say more before the nurse teaches or advises.",
            "source_refs": [source_id],
            "nclex_client_need": "Psychosocial Integrity",
            "cjmm_steps": ["Analyze Cues", "Take Action"],
            "qa_status": "source_grounded"
        },
        {
            "slide_id": "P03",
            "slide_number": 3,
            "slide_title": "Clinical Judgment Check",
            "on_slide_text": [
                "Recognize cues: fear statement.",
                "Analyze cues: meaning and understanding.",
                "Take action: acknowledge, assess, invite."
            ],
            "speaker_notes": "This item aligns to clinical judgment because the nurse must recognize the cue, analyze what it means, take a therapeutic action, and evaluate whether the response helped the patient communicate their concern.",
            "tts_text": "This item aligns to clinical judgment. The nurse recognizes the fear cue, analyzes what it means, takes action by acknowledging and assessing, and evaluates whether the patient can communicate the concern.",
            "source_refs": [source_id],
            "nclex_client_need": "Psychosocial Integrity",
            "cjmm_steps": ["Recognize Cues", "Analyze Cues", "Take Action", "Evaluate Outcomes"],
            "qa_status": "source_grounded"
        }
    ]


def build_vtt(slides: list[dict[str, Any]]) -> str:
    lines = ["WEBVTT", ""]
    start = 0
    for slide in slides:
        end = start + 18
        lines.extend([
            slide["slide_id"],
            f"00:00:{start:02d}.000 --> 00:00:{end:02d}.000",
            slide["tts_text"],
            "",
        ])
        start = end
    return "\n".join(lines)


def render_preview_html(lesson_spec: dict[str, Any]) -> str:
    slides = lesson_spec["slides"]
    cards = []
    for slide in slides:
        bullets = "".join(f"<li>{item}</li>" for item in slide["on_slide_text"])
        cards.append(
            f"""<section class=\"slide\">
  <p>{slide['slide_id']} / {slide['nclex_client_need']}</p>
  <h2>{slide['slide_title']}</h2>
  <ul>{bullets}</ul>
  <aside>{slide['speaker_notes']}</aside>
</section>"""
        )
    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>{lesson_spec['title']}</title>
  <style>
    body {{ margin: 0; font-family: system-ui, sans-serif; background: #f6f7f2; color: #18241f; }}
    main {{ display: grid; gap: 18px; max-width: 980px; margin: 0 auto; padding: 28px; }}
    .slide {{ border: 1px solid #d8ded8; border-radius: 8px; background: white; padding: 22px; }}
    p {{ color: #627069; font-weight: 700; margin: 0 0 8px; }}
    h2 {{ margin: 0 0 14px; }}
    li {{ margin: 8px 0; }}
    aside {{ margin-top: 16px; padding-top: 14px; border-top: 1px solid #e2e6e2; color: #4f5d56; }}
  </style>
</head>
<body><main>{''.join(cards)}</main></body>
</html>
"""


def main() -> int:
    source_text = SOURCE_PATH.read_text(encoding="utf-8")
    source_meta = json.loads(SOURCE_META_PATH.read_text(encoding="utf-8")) if SOURCE_META_PATH.exists() else {}
    source_id = "SRC-THERAPEUTIC-COMM-001"
    created_at = datetime.now(timezone.utc).isoformat()
    source_manifest = {
        "version": 1,
        "pilot_id": PILOT_ID,
        "selected_at": created_at,
        "sources": [
            {
                "source_id": source_id,
                "title": "NurseStudy Pilot Therapeutic Communication Source",
                "path": str(SOURCE_PATH.relative_to(ROOT)).replace("\\", "/"),
                "sha256": sha256_text(source_text),
                "approval_status": "approved_for_production_pilot",
                "source_type": "local_text_source",
                "metadata": source_meta,
                "source_excerpt": source_text,
            }
        ],
    }
    slides = slide_specs(source_id)
    lesson_spec = {
        "version": 1,
        "pilot_id": PILOT_ID,
        "title": "Therapeutic Communication: Responding to Fear Before a Procedure",
        "audience": "Nursing students preparing for NCLEX-style clinical judgment questions",
        "source_manifest": "lessons/production_pilot/source_manifest.json",
        "created_at": created_at,
        "release_state": "draft_source_grounded",
        "slides": slides,
    }
    tts_queue = {
        "version": 1,
        "queue_id": "HLB-PRODUCTION-PILOT-019",
        "purpose": "Source-grounded production pilot narration for therapeutic communication.",
        "status": "approved_for_live_tts",
        "default_model": "gpt-4o-mini-tts",
        "default_voice": "marin",
        "response_format": "mp3",
        "requests": [
            {
                "slide_id": slide["slide_id"],
                "slide_number": slide["slide_number"],
                "slide_title": slide["slide_title"],
                "tts_text": slide["tts_text"],
                "voice": "marin",
                "instructions": "Speak clearly in a calm nursing educator voice. Maintain a professional pace for student review.",
                "output_filename": f"{slide['slide_id']}_{slide['slide_title'].lower().replace(' ', '_').replace(':', '')}.mp3",
                "approved_for_tts": True,
                "content_status": "source_grounded",
                "human_review_status": "approved_for_pilot_generation",
            }
            for slide in slides
        ],
    }

    LESSON_DIR.mkdir(parents=True, exist_ok=True)
    SLIDES_DIR.mkdir(parents=True, exist_ok=True)
    write_json(LESSON_DIR / "source_manifest.json", source_manifest)
    write_json(LESSON_DIR / "lesson_spec.json", lesson_spec)
    write_json(LESSON_DIR / "tts_request_queue.json", tts_queue)
    (LESSON_DIR / "captions.vtt").write_text(build_vtt(slides), encoding="utf-8")
    (SLIDES_DIR / "preview.html").write_text(render_preview_html(lesson_spec), encoding="utf-8")
    print(f"Wrote production pilot package to {LESSON_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
