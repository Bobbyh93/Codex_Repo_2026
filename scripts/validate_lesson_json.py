#!/usr/bin/env python3
"""Validate lesson pipeline JSON artifacts.

Usage:
    python validate_lesson_json.py outline.json
    python validate_lesson_json.py outline.json script.json
    python validate_lesson_json.py outline.json script.json audio.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SLIDE_ID_RE = re.compile(r"^S\d{2}[A-Z]?$")
EVIDENCE_VALUES = {"source-grounded", "source-aligned", "inferred", "illustrative-example", "instructor-added", "provisional", "unresolved", "needs-verification"}
RATE_WARN_MIN = 120.0
RATE_WARN_MAX = 170.0
RATE_FAIL_MIN = 100.0
RATE_FAIL_MAX = 190.0


class Result:
    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def extend(self, other: "Result") -> None:
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"[FAIL] File not found: {path}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"[FAIL] Invalid JSON in {path}: {exc}")


def detect_stage(data: Dict[str, Any]) -> str:
    stage = data.get("stage")
    if isinstance(stage, str) and stage in {"outline", "script", "audio"}:
        return stage
    slides = data.get("slides")
    if isinstance(slides, list) and slides:
        sample = slides[0]
        if isinstance(sample, dict):
            if "main_point" in sample and "sub_points" in sample:
                return "outline"
            if "script" in sample or "speaker_script" in sample:
                return "script"
            if "narration_text" in sample:
                return "audio"
    raise SystemExit("[FAIL] Could not determine package type. Set top-level 'stage' to outline, script, or audio.")


def ensure_required(obj: Dict[str, Any], required: List[str], prefix: str, result: Result) -> None:
    for key in required:
        if key not in obj:
            result.errors.append(f"{prefix}: missing required field '{key}'")


def validate_slide_id(slide_id: Any, prefix: str, result: Result) -> None:
    if not isinstance(slide_id, str) or not SLIDE_ID_RE.match(slide_id):
        result.errors.append(f"{prefix}: invalid slide_id '{slide_id}'")


def validate_evidence_status(value: Any, prefix: str, result: Result) -> None:
    if value not in EVIDENCE_VALUES:
        result.errors.append(f"{prefix}: invalid evidence_status '{value}'")


def is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def speaking_rate(words: int, seconds: Any) -> Optional[float]:
    if not isinstance(seconds, (int, float)) or seconds <= 0:
        return None
    return words / (seconds / 60.0)


def validate_outline(path: Path, data: Dict[str, Any]) -> Result:
    result = Result()
    ensure_required(data, ["slides"], path.name, result)
    slides = data.get("slides")
    if not isinstance(slides, list) or not slides:
        result.errors.append(f"{path.name}: 'slides' must be a non-empty list")
        return result

    budget = data.get("duration_budget_seconds")
    if budget is not None and (not isinstance(budget, (int, float)) or budget <= 0):
        result.errors.append(f"{path.name}: duration_budget_seconds must be a positive number")

    seen_ids = set()
    slide_numbers: List[int] = []
    total_duration = 0.0

    required = [
        "slide_id",
        "slide_number",
        "slide_title",
        "lesson_section",
        "learning_objective",
        "main_point",
        "sub_points",
        "definitions",
        "evidence_examples",
        "concept_tags",
        "outcome_tags",
        "prerequisite_slide_ids",
        "estimated_duration_seconds",
        "evidence_status",
    ]

    for idx, slide in enumerate(slides, start=1):
        prefix = f"{path.name} slide {idx}"
        if not isinstance(slide, dict):
            result.errors.append(f"{prefix}: slide must be an object")
            continue
        ensure_required(slide, required, prefix, result)
        slide_id = slide.get("slide_id")
        validate_slide_id(slide_id, prefix, result)
        if slide_id in seen_ids:
            result.errors.append(f"{prefix}: duplicate slide_id '{slide_id}'")
        else:
            seen_ids.add(slide_id)

        slide_number = slide.get("slide_number")
        if not isinstance(slide_number, int) or slide_number <= 0:
            result.errors.append(f"{prefix}: slide_number must be a positive integer")
        else:
            slide_numbers.append(slide_number)

        for field in ["slide_title", "lesson_section", "learning_objective", "main_point"]:
            if field in slide and (not isinstance(slide[field], str) or not slide[field].strip()):
                result.errors.append(f"{prefix}: '{field}' must be a non-empty string")

        if not is_string_list(slide.get("sub_points")) or not slide.get("sub_points"):
            result.errors.append(f"{prefix}: 'sub_points' must be a non-empty list of strings")
        if not isinstance(slide.get("definitions"), list):
            result.errors.append(f"{prefix}: 'definitions' must be a list")
        if not isinstance(slide.get("evidence_examples"), list):
            result.errors.append(f"{prefix}: 'evidence_examples' must be a list")
        if not is_string_list(slide.get("concept_tags")):
            result.errors.append(f"{prefix}: 'concept_tags' must be a list of strings")
        if not is_string_list(slide.get("outcome_tags")):
            result.errors.append(f"{prefix}: 'outcome_tags' must be a list of strings")
        if "cjm_functions" in slide and not is_string_list(slide.get("cjm_functions")):
            result.errors.append(f"{prefix}: 'cjm_functions' must be a list of strings when present")
        if not is_string_list(slide.get("prerequisite_slide_ids")):
            result.errors.append(f"{prefix}: 'prerequisite_slide_ids' must be a list of strings")

        duration = slide.get("estimated_duration_seconds")
        if not isinstance(duration, (int, float)) or duration <= 0:
            result.errors.append(f"{prefix}: estimated_duration_seconds must be a positive number")
        else:
            total_duration += float(duration)

        validate_evidence_status(slide.get("evidence_status"), prefix, result)

        if len(set(slide.get("concept_tags", []))) != len(slide.get("concept_tags", [])):
            result.warnings.append(f"{prefix}: duplicate concept_tags present")
        if len(set(slide.get("outcome_tags", []))) != len(slide.get("outcome_tags", [])):
            result.warnings.append(f"{prefix}: duplicate outcome_tags present")

    if slide_numbers and slide_numbers != sorted(slide_numbers):
        result.warnings.append(f"{path.name}: slide_number values are not in ascending order")
    if slide_numbers and slide_numbers != list(range(1, len(slide_numbers) + 1)):
        result.warnings.append(f"{path.name}: slide_number values are not sequential starting from 1")

    if isinstance(budget, (int, float)) and budget > 0:
        delta = abs(total_duration - float(budget)) / float(budget)
        if delta > 0.20:
            result.errors.append(
                f"{path.name}: total estimated duration {total_duration:.0f}s differs from budget {budget:.0f}s by more than 20%"
            )
        elif delta > 0.10:
            result.warnings.append(
                f"{path.name}: total estimated duration {total_duration:.0f}s differs from budget {budget:.0f}s by more than 10%"
            )

    return result


def validate_script(path: Path, data: Dict[str, Any]) -> Result:
    result = Result()
    ensure_required(data, ["slides"], path.name, result)
    slides = data.get("slides")
    if not isinstance(slides, list) or not slides:
        result.errors.append(f"{path.name}: 'slides' must be a non-empty list")
        return result

    seen_ids = set()
    required = [
        "slide_id",
        "slide_title",
        "target_duration_seconds",
        "evidence_status",
    ]

    for idx, slide in enumerate(slides, start=1):
        prefix = f"{path.name} slide {idx}"
        if not isinstance(slide, dict):
            result.errors.append(f"{prefix}: slide must be an object")
            continue
        ensure_required(slide, required, prefix, result)
        slide_id = slide.get("slide_id")
        validate_slide_id(slide_id, prefix, result)
        if slide_id in seen_ids:
            result.errors.append(f"{prefix}: duplicate slide_id '{slide_id}'")
        else:
            seen_ids.add(slide_id)

        if not isinstance(slide.get("slide_title"), str) or not slide.get("slide_title", "").strip():
            result.errors.append(f"{prefix}: 'slide_title' must be a non-empty string")
        duration = slide.get("target_duration_seconds")
        if not isinstance(duration, (int, float)) or duration <= 0:
            result.errors.append(f"{prefix}: target_duration_seconds must be a positive number")
        script_text = slide.get("script") or slide.get("speaker_script")
        if not isinstance(script_text, str) or not script_text.strip():
            result.errors.append(f"{prefix}: 'script' or 'speaker_script' must be a non-empty string")
        validate_evidence_status(slide.get("evidence_status"), prefix, result)

        if isinstance(script_text, str) and isinstance(duration, (int, float)) and duration > 0:
            words = word_count(script_text)
            rate = speaking_rate(words, duration)
            if rate is not None:
                if rate < RATE_FAIL_MIN or rate > RATE_FAIL_MAX:
                    result.errors.append(
                        f"{prefix}: speaking rate {rate:.1f} wpm is implausible for normal narration"
                    )
                elif rate < RATE_WARN_MIN or rate > RATE_WARN_MAX:
                    result.warnings.append(
                        f"{prefix}: speaking rate {rate:.1f} wpm may be slightly off target"
                    )

        if "net_new_items" in slide and not isinstance(slide["net_new_items"], list):
            result.errors.append(f"{prefix}: 'net_new_items' must be a list when present")
        if "delivery_notes" in slide and not isinstance(slide["delivery_notes"], list):
            result.errors.append(f"{prefix}: 'delivery_notes' must be a list when present")
        if "tts_text" in slide and not isinstance(slide["tts_text"], str):
            result.errors.append(f"{prefix}: 'tts_text' must be a string when present")

    return result


def validate_audio(path: Path, data: Dict[str, Any]) -> Result:
    result = Result()
    ensure_required(data, ["slides"], path.name, result)
    slides = data.get("slides")
    if not isinstance(slides, list) or not slides:
        result.errors.append(f"{path.name}: 'slides' must be a non-empty list")
        return result

    seen_ids = set()
    required = [
        "slide_id",
        "narration_text",
        "target_duration_seconds",
        "pronunciation_notes",
        "pause_markers",
        "emphasis_terms",
        "transition_line",
    ]

    for idx, slide in enumerate(slides, start=1):
        prefix = f"{path.name} slide {idx}"
        if not isinstance(slide, dict):
            result.errors.append(f"{prefix}: slide must be an object")
            continue
        ensure_required(slide, required, prefix, result)
        slide_id = slide.get("slide_id")
        validate_slide_id(slide_id, prefix, result)
        if slide_id in seen_ids:
            result.errors.append(f"{prefix}: duplicate slide_id '{slide_id}'")
        else:
            seen_ids.add(slide_id)

        if not isinstance(slide.get("narration_text"), str) or not slide.get("narration_text", "").strip():
            result.errors.append(f"{prefix}: 'narration_text' must be a non-empty string")
        duration = slide.get("target_duration_seconds")
        if not isinstance(duration, (int, float)) or duration <= 0:
            result.errors.append(f"{prefix}: target_duration_seconds must be a positive number")
        for field in ["pause_markers", "emphasis_terms"]:
            if not is_string_list(slide.get(field)):
                result.errors.append(f"{prefix}: '{field}' must be a list of strings")
        if not isinstance(slide.get("pronunciation_notes"), list):
            result.errors.append(f"{prefix}: 'pronunciation_notes' must be a list")
        if not isinstance(slide.get("transition_line"), str):
            result.errors.append(f"{prefix}: 'transition_line' must be a string")
        if "ssml_ready_text" in slide and not isinstance(slide["ssml_ready_text"], str):
            result.errors.append(f"{prefix}: 'ssml_ready_text' must be a string when present")

    return result


def cross_validate(outline: Optional[Dict[str, Any]], script: Optional[Dict[str, Any]], audio: Optional[Dict[str, Any]]) -> Result:
    result = Result()

    def slide_map(pkg: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        return {slide["slide_id"]: slide for slide in pkg.get("slides", []) if isinstance(slide, dict) and "slide_id" in slide}

    outline_map = slide_map(outline) if outline else {}
    script_map = slide_map(script) if script else {}
    audio_map = slide_map(audio) if audio else {}

    if outline and script:
        outline_ids = set(outline_map)
        script_ids = set(script_map)
        missing = outline_ids - script_ids
        extra = script_ids - outline_ids
        if missing:
            result.errors.append(f"cross-check: script is missing slide_ids {sorted(missing)}")
        if extra:
            result.errors.append(f"cross-check: script contains extra slide_ids {sorted(extra)}")
        for slide_id in sorted(outline_ids & script_ids):
            o = outline_map[slide_id]
            s = script_map[slide_id]
            if o.get("slide_title") != s.get("slide_title"):
                result.warnings.append(f"cross-check: title mismatch for {slide_id}")
            od = o.get("estimated_duration_seconds")
            sd = s.get("target_duration_seconds")
            if isinstance(od, (int, float)) and isinstance(sd, (int, float)) and od > 0:
                if abs(float(od) - float(sd)) / float(od) > 0.20:
                    result.errors.append(f"cross-check: duration mismatch greater than 20% for {slide_id}")

    if script and audio:
        script_ids = set(script_map)
        audio_ids = set(audio_map)
        missing = script_ids - audio_ids
        extra = audio_ids - script_ids
        if missing:
            result.errors.append(f"cross-check: audio is missing slide_ids {sorted(missing)}")
        if extra:
            result.errors.append(f"cross-check: audio contains extra slide_ids {sorted(extra)}")
        for slide_id in sorted(script_ids & audio_ids):
            s = script_map[slide_id]
            a = audio_map[slide_id]
            sd = s.get("target_duration_seconds")
            ad = a.get("target_duration_seconds")
            if isinstance(sd, (int, float)) and isinstance(ad, (int, float)) and sd > 0:
                if abs(float(sd) - float(ad)) / float(sd) > 0.20:
                    result.errors.append(f"cross-check: audio duration mismatch greater than 20% for {slide_id}")

    return result


def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip())
        return 1

    packages: Dict[str, Dict[str, Any]] = {}
    overall = Result()

    for raw in argv[1:]:
        path = Path(raw)
        data = load_json(path)
        if not isinstance(data, dict):
            print(f"[FAIL] Top-level JSON object required in {path}")
            return 1
        stage = detect_stage(data)
        if stage in packages:
            print(f"[FAIL] Multiple {stage} packages provided; pass at most one of each type")
            return 1
        packages[stage] = data

        if stage == "outline":
            res = validate_outline(path, data)
        elif stage == "script":
            res = validate_script(path, data)
        else:
            res = validate_audio(path, data)
        overall.extend(res)

    overall.extend(cross_validate(packages.get("outline"), packages.get("script"), packages.get("audio")))

    if overall.errors:
        print("[FAIL] Validation found errors:")
        for item in overall.errors:
            print(f"  - {item}")
    else:
        print("[PASS] No validation errors found.")

    if overall.warnings:
        print("[WARN] Additional warnings:")
        for item in overall.warnings:
            print(f"  - {item}")

    return 1 if overall.errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
