"""Source-grounded lesson builder with improved depth, naming, and slide structure."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .compression import semantic_compress_bullets
from .diagram_service import generate_diagram
from .job_store import add_artifact, log_event
from .naming import artifact_name, run_label, slugify
from .pptx_renderer import render_deck

OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "output"
MAX_POINTS = 4


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _sentences(text: str) -> list[str]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return []
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return [p.strip() for p in parts if len(p.strip()) > 24]


def _fallback_points(topic: str) -> list[str]:
    return [
        f"Define the core pattern and scope of {topic}.",
        f"Identify the highest-priority cues related to {topic}.",
        f"Select the first safe action when those cues appear in {topic}.",
        f"State how response and deterioration will be evaluated for {topic}.",
    ]


def _point_candidates(sections: list[dict[str, Any]], fallback: str) -> list[str]:
    points: list[str] = []
    for section in sections:
        for sentence in _sentences(section.get("content", "")):
            if sentence not in points:
                points.append(sentence)
            if len(points) >= 8:
                return points
    return points or _fallback_points(fallback)


def _source_refs(sections: list[dict[str, Any]], default_ref: str) -> list[str]:
    refs: list[str] = []
    for section in sections:
        for ref in section.get("source_refs", []) or []:
            ref_text = _normalize_text(ref)
            if ref_text and ref_text not in refs:
                refs.append(ref_text)
    return refs or [default_ref]


def _group_sections(concept: str, exemplars: list[str], source_sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not source_sections:
        return [
            {
                "title": exemplar,
                "sections": [
                    {
                        "title": exemplar,
                        "content": (
                            f"{exemplar} includes a recognition phase, a priority decision phase, and an evaluation phase. "
                            f"The first safe action should be linked to the highest-risk cue pattern in {exemplar}."
                        ),
                        "source_refs": [],
                    }
                ],
            }
            for exemplar in exemplars
        ]
    lowered = [
        (section, _normalize_text(section.get("title", "")).lower(), _normalize_text(section.get("content", "")).lower())
        for section in source_sections
    ]
    groups: list[dict[str, Any]] = []
    for exemplar in exemplars:
        needle = exemplar.lower()
        matches = [section for section, title, content in lowered if needle in title or needle in content]
        if not matches:
            matches = [section for section in source_sections[:6]]
        groups.append({"title": exemplar, "sections": matches[:8]})
    return groups


def _build_case(concept: str, exemplar: str, sections: list[dict[str, Any]]) -> dict[str, Any]:
    points = _point_candidates(sections, exemplar)
    cues = semantic_compress_bullets(points[:3])
    return {
        "stem": f"A learner reviews a scenario related to {exemplar} within {concept}. Use the cue set to identify the first safe action and the expected response.",
        "cues": [row["compressed"] for row in cues],
        "question": "Which action should occur first, and what outcome would show improvement?",
        "priority_action": f"Assess instability, implement the first safe intervention, and escalate worsening findings for {exemplar}.",
        "rationale": "The first action must address the highest-risk cue and create a measurable evaluation target.",
    }


def _build_scripts(slides: list[dict[str, Any]]) -> str:
    lines = ["# Lecture scripts", ""]
    for slide in slides:
        lines.append(f"## {slide['slide_id']} - {slide['slide_title']}")
        lines.append(slide.get("speaker_script_verbatim", ""))
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _quality_check(slides: list[dict[str, Any]], artifact_paths: dict[str, str], deck_result: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    seen: set[str] = set()
    for slide in slides:
        slide_id = slide.get("slide_id")
        if not slide_id:
            errors.append("missing_slide_id")
            continue
        if slide_id in seen:
            errors.append(f"duplicate_slide_id:{slide_id}")
        seen.add(slide_id)
        if not slide.get("source_refs"):
            errors.append(f"missing_source_refs:{slide_id}")
        for row in slide.get("compression_meta", []):
            if row.get("loss_risk") == "high":
                errors.append(f"semantic_loss_detected:{slide_id}")
        if slide.get("layout_archetype") == "split-diagram-text":
            diagram = slide.get("assets", {}).get("diagram") or {}
            if not Path(diagram.get("file", "")).exists():
                errors.append(f"missing_diagram:{slide_id}")
    for key in ["outline.json", "blueprint.json", "scripts.md", "case_study.md", "answer_key.md", "remediation_map.json", "deck.pptx"]:
        path = artifact_paths.get(key)
        if not path or not Path(path).exists():
            errors.append(f"missing_artifact:{key}")
    if deck_result.get("status") != "pass":
        errors.append("deck_render_failed")
    return {"status": "pass" if not errors else "fail", "errors": errors}


def ngn_builder(taxonomy_state: dict[str, Any], job_id: str, source_context: dict[str, Any] | None = None) -> dict[str, Any]:
    taxonomy = taxonomy_state["data"]
    concept = taxonomy["concept"]
    exemplars = taxonomy.get("exemplars") or [concept]
    course_name = taxonomy.get("course_name") or taxonomy.get("subject_area") or "course"
    content_area = taxonomy.get("content_area") or concept
    deck_style = taxonomy.get("deck_style", "clean_academic")

    source_sections = []
    if isinstance(source_context, dict):
        source_sections = source_context.get("sections") or []

    output_dir = OUTPUT_ROOT / slugify(course_name, 28) / slugify(content_area, 28) / run_label(taxonomy, job_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    log_event(job_id, "build", f"Starting lesson build for {concept}")

    groups = _group_sections(concept, exemplars, source_sections)
    all_sections = [section for group in groups for section in group["sections"]]
    overview_points = semantic_compress_bullets(_point_candidates(all_sections, concept)[:3] + [f"Lesson scope includes: {', '.join(exemplars[:4])}{'…' if len(exemplars) > 4 else ''}."])

    outline = {
        "lesson_title": f"{concept} lesson package",
        "lesson_summary": f"Source-grounded lesson package for {concept}.",
        "teaching_sequence": [
            "Orient the learner to the lesson goal and source scope",
            "Define the concept and identify high-risk cues",
            "Work through each selected subtopic",
            "Practice the decision cycle with case prompts",
            "Compare patterns and assign remediation",
        ],
        "sections": [
            {
                "title": group["title"],
                "points": [row["compressed"] for row in semantic_compress_bullets(_point_candidates(group["sections"], group["title"]))],
                "source_refs": _source_refs(group["sections"], taxonomy["source_anchor"]),
            }
            for group in groups
        ],
        "source_coverage_map": {group["title"]: _source_refs(group["sections"], taxonomy["source_anchor"]) for group in groups},
    }

    slides: list[dict[str, Any]] = []
    slide_no = 1
    slides.append(
        {
            "slide_id": f"S{slide_no:02}",
            "slide_number": slide_no,
            "slide_title": f"{concept} overview",
            "lesson_section": concept,
            "concept": concept,
            "learning_objective": f"Explain the scope and priority focus for {concept}.",
            "on_slide_text": [row["compressed"] for row in overview_points],
            "compression_meta": overview_points,
            "speaker_intent": f"Orient the learner to the lesson sequence and the highest-priority thinking for {concept}.",
            "layout_archetype": "title-bullets",
            "source_refs": _source_refs(all_sections, taxonomy["source_anchor"]),
            "evidence_status": taxonomy["evidence_status"],
            "speaker_script_verbatim": f"Start by defining the scope of {concept}. Identify the highest-risk cue patterns, explain the first safe action logic, and preview the lesson structure before moving into each selected subtopic.",
        }
    )
    slide_no += 1

    for group in groups:
        exemplar = group["title"]
        compressed_points = semantic_compress_bullets(_point_candidates(group["sections"], exemplar))
        objective_id = f"{concept}_{exemplar}_OBJ".replace(" ", "_")
        diagram = generate_diagram(f"{exemplar} clinical judgment flow", "flow", deck_style)
        slides.append(
            {
                "slide_id": f"S{slide_no:02}",
                "slide_number": slide_no,
                "slide_title": exemplar,
                "lesson_section": concept,
                "concept": concept,
                "learning_objective": f"Apply clinical judgment to manage {exemplar}.",
                "on_slide_text": [row["compressed"] for row in compressed_points],
                "compression_meta": compressed_points,
                "speaker_intent": f"Teach cue recognition, prioritization, intervention, and evaluation for {exemplar}.",
                "layout_archetype": "split-diagram-text",
                "source_refs": _source_refs(group["sections"], taxonomy["source_anchor"]),
                "evidence_status": taxonomy["evidence_status"],
                "objective_id": objective_id,
                "assets": {"diagram": diagram},
                "speaker_script_verbatim": f"For {exemplar}, start with the earliest concerning cue, link that cue to the likely problem, choose the first safe action, and explain what would show improvement or the need to escalate.",
            }
        )
        slide_no += 1

        case = _build_case(concept, exemplar, group["sections"])
        slides.append(
            {
                "slide_id": f"S{slide_no:02}",
                "slide_number": slide_no,
                "slide_title": f"Clinical judgment case: {exemplar}",
                "lesson_section": concept,
                "concept": concept,
                "learning_objective": f"Prioritize care for a client scenario related to {exemplar}.",
                "on_slide_text": case["cues"],
                "compression_meta": [],
                "speaker_intent": "Facilitate structured practice without revealing the answer on the slide.",
                "layout_archetype": "case-ngn",
                "source_refs": _source_refs(group["sections"], taxonomy["source_anchor"]),
                "evidence_status": taxonomy["evidence_status"],
                "objective_id": objective_id,
                "case": case,
                "speaker_script_verbatim": f"Use this case to identify the most important cue for {exemplar}, select the first safe action, and state the outcome that would confirm improvement.",
            }
        )
        slide_no += 1

    comparison_rows = []
    for group in groups:
        exemplar = group["title"]
        points = [row["compressed"] for row in semantic_compress_bullets(_point_candidates(group["sections"], exemplar))]
        comparison_rows.append([exemplar, points[0] if points else "Key cue pattern", f"Address the highest-risk cue first for {exemplar}."])

    slides.append(
        {
            "slide_id": f"S{slide_no:02}",
            "slide_number": slide_no,
            "slide_title": f"{concept} comparison guide",
            "lesson_section": concept,
            "concept": concept,
            "learning_objective": f"Compare cue patterns and first actions across the {concept} lesson scope.",
            "layout_archetype": "table",
            "source_refs": _source_refs(all_sections, taxonomy["source_anchor"]),
            "evidence_status": taxonomy["evidence_status"],
            "table": {"headers": ["Subtopic", "Key cue pattern", "First safe action"], "rows": comparison_rows},
            "speaker_script_verbatim": f"Use this comparison view to reinforce how the learner should separate cue patterns and first actions across the {concept} lesson scope.",
        }
    )
    slide_no += 1

    closing_points = semantic_compress_bullets(
        [
            f"Review high-risk cues for: {', '.join(exemplars[:4])}{'…' if len(exemplars) > 4 else ''}.",
            "Rehearse one case before moving into assessment or question-bank work.",
            "Use the objective table to confirm lesson-to-assessment alignment.",
            "Follow the remediation map for weak areas and repeat the decision cycle.",
        ]
    )
    slides.append(
        {
            "slide_id": f"S{slide_no:02}",
            "slide_number": slide_no,
            "slide_title": f"{concept} summary and remediation",
            "lesson_section": concept,
            "concept": concept,
            "learning_objective": f"State the review and remediation steps for {concept}.",
            "on_slide_text": [row["compressed"] for row in closing_points],
            "compression_meta": closing_points,
            "speaker_intent": "Close the lesson and direct the learner to the next practice step.",
            "layout_archetype": "title-bullets",
            "source_refs": _source_refs(all_sections, taxonomy["source_anchor"]),
            "evidence_status": taxonomy["evidence_status"],
            "speaker_script_verbatim": f"Close by restating the highest-priority cues for {concept}, pointing to the practice case, and assigning the remediation path for any weak area the learner still shows.",
        }
    )

    case_study = {"title": f"{concept} clinical judgment case set", "cases": [_build_case(concept, group['title'], group['sections']) for group in groups]}
    answer_key = {
        "title": f"{concept} answer key",
        "answers": [
            {
                "exemplar": group["title"],
                "priority_action": f"Assess instability, implement the first safe intervention, and escalate worsening status for {group['title']}.",
                "rationale": "The first action must address the highest-risk cue and create a clear evaluation target.",
            }
            for group in groups
        ],
    }
    remediation_map = {
        "concept": concept,
        "entries": [
            {
                "exemplar": group["title"],
                "weak_area": "cue recognition and first action",
                "remediation": f"Re-read the source section for {group['title']}, restate the top cue, and reattempt the case before moving on.",
            }
            for group in groups
        ],
    }

    artifact_paths: dict[str, str] = {}
    json_artifacts = {
        artifact_name(taxonomy, job_id, "outline", ".json"): outline,
        artifact_name(taxonomy, job_id, "blueprint", ".json"): {"slides": slides},
        artifact_name(taxonomy, job_id, "remediation_map", ".json"): remediation_map,
    }
    for filename, data in json_artifacts.items():
        path = output_dir / filename
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        if filename.endswith("outline.json"):
            artifact_paths["outline.json"] = str(path)
        elif filename.endswith("blueprint.json"):
            artifact_paths["blueprint.json"] = str(path)
        elif filename.endswith("remediation_map.json"):
            artifact_paths["remediation_map.json"] = str(path)
        add_artifact(job_id, path, filename)

    text_artifacts = {
        artifact_name(taxonomy, job_id, "scripts", ".md"): _build_scripts(slides),
        artifact_name(taxonomy, job_id, "case_study", ".md"): "# " + case_study["title"] + "\n\n" + json.dumps(case_study, indent=2),
        artifact_name(taxonomy, job_id, "answer_key", ".md"): "# " + answer_key["title"] + "\n\n" + json.dumps(answer_key, indent=2),
    }
    for filename, text in text_artifacts.items():
        path = output_dir / filename
        path.write_text(text, encoding="utf-8")
        if filename.endswith("scripts.md"):
            artifact_paths["scripts.md"] = str(path)
        elif filename.endswith("case_study.md"):
            artifact_paths["case_study.md"] = str(path)
        elif filename.endswith("answer_key.md"):
            artifact_paths["answer_key.md"] = str(path)
        add_artifact(job_id, path, filename)

    deck_filename = artifact_name(taxonomy, job_id, "lesson_deck", ".pptx")
    deck_path = output_dir / deck_filename
    deck_result = render_deck(slides, deck_path, taxonomy=taxonomy, deck_style=deck_style)
    artifact_paths["deck.pptx"] = str(deck_path)
    add_artifact(job_id, deck_path, deck_filename)

    qa = _quality_check(slides, artifact_paths, deck_result)
    qa_path = output_dir / artifact_name(taxonomy, job_id, "build_quality_report", ".json")
    qa_path.write_text(json.dumps(qa, indent=2), encoding="utf-8")
    add_artifact(job_id, qa_path, qa_path.name)

    log_event(job_id, "build", f"Lesson build finished with status={qa['status']}")
    return {
        "status": "pass" if qa["status"] == "pass" else "fail",
        "outline": outline,
        "slides": slides,
        "scripts": next(iter(text_artifacts.values())),
        "case_study": case_study,
        "answer_key": answer_key,
        "remediation_map": remediation_map,
        "artifacts": artifact_paths,
        "deck_result": deck_result,
        "qa": qa,
        "output_dir": str(output_dir),
    }
