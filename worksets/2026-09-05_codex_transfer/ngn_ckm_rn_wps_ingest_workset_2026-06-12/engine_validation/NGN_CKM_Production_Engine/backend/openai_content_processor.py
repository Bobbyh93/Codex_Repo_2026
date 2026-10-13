"""OpenAI-assisted source cleaning and topic extraction.

This module is intentionally optional. If no API key is available, the app falls
back to deterministic local extraction. The prompts are designed to reduce manual
entry by turning Data Chunker Pro JSON chunks into clean topic rows that can enter
Gate 0 review.
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Any

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

SYSTEM_PROMPT = """You are a curriculum data extraction assistant for nursing education.
Your task is to convert source chunks into clean, source-grounded curriculum topic rows.
Do not invent clinical facts. Use only the supplied chunk text and metadata.
Return strict JSON only. No markdown.

Required output schema:
{
  "topics": [
    {
      "concept": "canonical main topic",
      "exemplars": ["subtopic 1", "subtopic 2"],
      "source_anchor": "file/page/module anchor",
      "subject_area": "Nursing or more specific if evident",
      "content_area": "short content category if evident",
      "specialty_area": "Med-Surg/Fundamentals/etc. if evident, otherwise General",
      "nclex_category": "NCLEX client need if evident, otherwise Unspecified",
      "ncjmm_primary": "Recognize Cues|Analyze Cues|Prioritize Hypotheses|Generate Solutions|Take Actions|Evaluate Outcomes",
      "priority_framework": "ABCs|Safety|Risk Reduction|Nursing Process|Acuity|Least Restrictive|Maslow|Survival Potential|General Priority",
      "evidence_status": "source-grounded",
      "needs_review": false,
      "clean_summary": "2-4 sentence neutral source-grounded summary"
    }
  ],
  "warnings": []
}

Extraction rules:
- Prefer headings, module names, section hints, and repeated topic names.
- Use source_file and page metadata whenever present.
- Merge duplicate chunk topics under one concept.
- Keep exemplars concise; do not create long sentences as exemplars.
- If the source is too vague, set needs_review=true and explain in warnings.
"""


def api_key_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def _compact_chunks(chunks: list[dict[str, Any]], max_chars: int = 18000) -> str:
    blocks: list[str] = []
    used = 0
    for idx, c in enumerate(chunks[:80], 1):
        text = str(c.get("text") or c.get("content") or c.get("chunk") or c.get("body") or "").strip()
        if not text:
            continue
        meta = {
            "chunk_id": c.get("chunk_id") or c.get("id") or idx,
            "source_file": c.get("source_file") or c.get("file") or c.get("filename") or c.get("document") or "source",
            "page": c.get("page") or c.get("page_number") or c.get("start_page") or "",
            "section_hint": c.get("section_hint") or c.get("heading") or c.get("title") or c.get("section") or "",
        }
        block = "METADATA=" + json.dumps(meta, ensure_ascii=False) + "\nTEXT=" + text[:1800]
        if used + len(block) > max_chars:
            break
        blocks.append(block)
        used += len(block)
    return "\n\n---CHUNK---\n\n".join(blocks)


def call_openai_topic_extraction(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """Return OpenAI-extracted topic rows, or raise on hard API failure."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-4.1-mini")
    user_payload = _compact_chunks(chunks)
    body = {
        "model": model,
        "input": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Extract clean curriculum topic rows from these Data Chunker Pro chunks:\n\n" + user_payload},
        ],
        "text": {"format": {"type": "json_object"}},
    }
    req = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    # Responses API shape: output -> message -> content -> output_text.
    text = ""
    for item in raw.get("output", []):
        if item.get("type") == "message":
            for part in item.get("content", []):
                if part.get("type") in {"output_text", "text"}:
                    text += part.get("text", "")
    if not text and raw.get("output_text"):
        text = raw["output_text"]
    if not text:
        raise RuntimeError("OpenAI response did not include JSON text")
    data = json.loads(text)
    topics = data.get("topics") or []
    clean_topics = []
    for row in topics:
        concept = str(row.get("concept") or "").strip()
        if not concept:
            continue
        exemplars = row.get("exemplars") or []
        if isinstance(exemplars, str):
            exemplars = [x.strip() for x in exemplars.replace(";", ",").split(",") if x.strip()]
        clean_topics.append({
            "concept": concept,
            "exemplars": exemplars or [concept],
            "source_anchor": row.get("source_anchor") or "Data Chunker Pro output",
            "subject_area": row.get("subject_area") or "Nursing",
            "content_area": row.get("content_area") or "General",
            "specialty_area": row.get("specialty_area") or "General",
            "nclex_category": row.get("nclex_category") or "Unspecified",
            "ncjmm_primary": row.get("ncjmm_primary") or "Recognize Cues",
            "priority_framework": row.get("priority_framework") or "General Priority",
            "evidence_status": row.get("evidence_status") or "source-grounded",
            "needs_review": bool(row.get("needs_review", False)),
            "clean_summary": row.get("clean_summary") or "",
        })
    return {"topics": clean_topics, "warnings": data.get("warnings") or [], "provider": "openai", "model": model}
