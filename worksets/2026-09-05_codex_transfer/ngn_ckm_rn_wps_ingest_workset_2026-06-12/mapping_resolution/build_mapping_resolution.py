from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(r"C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12")
CROSSWALK_ROOT = Path(r"C:\Users\RHarrity\Documents\Codex\rn_wps_prelicensure_crosswalk_workset_2026-06-12")
CROSSWALK_DATA = CROSSWALK_ROOT / "build" / "intermediate" / "rn_wps_prelicensure_crosswalk_data.json"
SOURCE_TRACE = ROOT / "support" / "source_trace.json"
RUN_QA = ROOT / "ngn_ckm_clean_default_run_qa.json"
OUT_DIR = ROOT / "mapping_resolution"
ROWS_JSON = OUT_DIR / "mapping_resolution_rows.json"
PROCESS_CSV = OUT_DIR / "wps_process_mapping_resolution_draft.csv"
SUGGESTIONS_JSONL = OUT_DIR / "ai_mapping_suggestions.jsonl"
QA_JSON = OUT_DIR / "wps_mapping_resolution_qa.json"
HANDOFF_MD = OUT_DIR / "handoff_wps_mapping_resolution.md"

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")
EXCLUDED_METADATA_CONCEPTS = {"*CIP Code", "Provider"}
TOKEN_RE = re.compile(r"[a-z0-9]+")


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    headers: list[str] = []
    for row in rows:
        for key in row:
            if key not in headers:
                headers.append(key)
    if not headers:
        headers = ["note"]
        rows = [{"note": "no rows"}]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def tokens(text: str) -> set[str]:
    stop = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "by",
        "for",
        "from",
        "in",
        "into",
        "of",
        "on",
        "or",
        "other",
        "patient",
        "patients",
        "the",
        "to",
        "with",
    }
    return {tok for tok in TOKEN_RE.findall(text.lower()) if len(tok) > 2 and tok not in stop}


def candidate_score(query_tokens: set[str], qsen: dict) -> float:
    text = " ".join(
        str(qsen.get(key, ""))
        for key in (
            "qsen_domain_name",
            "ksa_raw",
            "qsen_statement_raw",
            "aacn_subcompetency_codes",
        )
    )
    qsen_tokens = tokens(text)
    if not query_tokens or not qsen_tokens:
        return 0.0
    overlap = len(query_tokens & qsen_tokens)
    return round((overlap / len(query_tokens | qsen_tokens)) + (overlap / max(len(query_tokens), 1)) * 0.3, 4)


def extract_response_text(response: dict) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]
    chunks: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks)


def call_openai(payload: dict, api_key: str) -> dict:
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "mapping_status": {"type": "string", "enum": ["draft_mapping", "not_mappable", "insufficient_evidence"]},
            "top_qsen_statement_id": {"type": "string"},
            "top_aacn_subcompetency_codes": {"type": "array", "items": {"type": "string"}},
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
            "rationale": {"type": "string"},
            "alternate_qsen_statement_ids": {"type": "array", "items": {"type": "string"}},
            "review_notes": {"type": "string"},
        },
        "required": [
            "mapping_status",
            "top_qsen_statement_id",
            "top_aacn_subcompetency_codes",
            "confidence",
            "rationale",
            "alternate_qsen_statement_ids",
            "review_notes",
        ],
    }
    body = {
        "model": MODEL,
        "reasoning": {"effort": "low"},
        "input": [
            {
                "role": "system",
                "content": (
                    "You draft conservative nursing curriculum crosswalk mappings. "
                    "Choose only QSEN IDs and AACN codes present in the supplied candidates. "
                    "If none fit, return not_mappable or insufficient_evidence. "
                    "Do not invent codes. Keep rationale concise."
                ),
            },
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "wps_qsen_mapping_suggestion",
                "schema": schema,
                "strict": True,
            }
        },
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as resp:
        raw = resp.read().decode("utf-8")
    response = json.loads(raw)
    text = extract_response_text(response)
    return json.loads(text)


def validate_suggestion(suggestion: dict, candidates: list[dict]) -> list[str]:
    errors: list[str] = []
    candidate_by_id = {row["qsen_statement_id"]: row for row in candidates}
    top_id = suggestion.get("top_qsen_statement_id", "")
    if suggestion.get("mapping_status") == "draft_mapping":
        if top_id not in candidate_by_id:
            errors.append("top_qsen_statement_id_not_in_candidate_set")
        allowed_codes = set()
        if top_id in candidate_by_id:
            allowed_codes.update(
                code.strip()
                for code in str(candidate_by_id[top_id].get("aacn_subcompetency_codes", "")).split(";")
                if code.strip()
            )
        for code in suggestion.get("top_aacn_subcompetency_codes", []):
            if code not in allowed_codes:
                errors.append(f"aacn_code_not_in_top_qsen:{code}")
    for alt in suggestion.get("alternate_qsen_statement_ids", []):
        if alt not in candidate_by_id:
            errors.append(f"alternate_qsen_statement_id_not_in_candidate_set:{alt}")
    return errors


def main() -> int:
    require_ai = "--require-ai" in sys.argv
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    load_env_file(ROOT / ".env.local")
    load_env_file(ROOT / ".env")

    crosswalk = json.loads(CROSSWALK_DATA.read_text(encoding="utf-8"))
    trace = json.loads(SOURCE_TRACE.read_text(encoding="utf-8"))
    run_qa = json.loads(RUN_QA.read_text(encoding="utf-8")) if RUN_QA.exists() else {}
    qsen_rows = crosswalk["fact_prelicensure_qsen"]

    trace_by_concept = {row["concept"]: row for row in trace}
    bridge_by_process: dict[str, list[dict]] = defaultdict(list)
    for bridge in crosswalk["suggested_wps_prelicensure_bridge"]:
        bridge_by_process[bridge["process_raw"]].append(bridge)

    excluded_rows = []
    process_rows = []
    task_rows = []
    candidate_rows = []
    suggestion_records = []
    api_key = os.environ.get("OPENAI_API_KEY", "")
    api_status = "available" if bool(api_key) else "missing"
    api_errors: list[dict] = []

    true_processes = [
        row
        for row in crosswalk["dim_wps_process"]
        if row["process_raw"] not in EXCLUDED_METADATA_CONCEPTS
    ]
    held_true = [
        trace_by_concept[row["process_raw"]]
        for row in true_processes
        if trace_by_concept.get(row["process_raw"], {}).get("needs_review")
    ]

    for concept in sorted(EXCLUDED_METADATA_CONCEPTS):
        source = trace_by_concept.get(concept)
        bridges = bridge_by_process.get(concept, [])
        excluded_rows.append(
            {
                "concept": concept,
                "exclusion_reason": "metadata_artifact_not_lesson_concept",
                "task_count": source.get("task_count", len(bridges)) if source else len(bridges),
                "source_tables": "; ".join(
                    sorted({f"{b.get('source_file')}#T{b.get('wps_task_id', '').split('_T')[-1].split('_R')[0]}" for b in bridges})
                ),
                "notes": "Excluded from engine candidates and AI mapping draft.",
            }
        )

    if require_ai and not api_key:
        api_status = "missing_required"

    for row in sorted(held_true, key=lambda item: item["module_number"]):
        concept = row["concept"]
        bridges = bridge_by_process[concept]
        unique_tasks = []
        seen_tasks = set()
        for task in row.get("tasks", []):
            text = str(task.get("task_raw", "")).strip()
            key = re.sub(r"\s+", " ", text.lower())
            if key and key not in seen_tasks:
                seen_tasks.add(key)
                unique_tasks.append(text)
            task_rows.append(
                {
                    "module_number": row["module_number"],
                    "concept": concept,
                    "wps_task_id": task.get("wps_task_id", ""),
                    "source_file": task.get("source_file", ""),
                    "rapids_code": task.get("rapids_code", ""),
                    "variant": task.get("variant", ""),
                    "source_table_index": task.get("source_table_index", ""),
                    "source_row_index": task.get("source_row_index", ""),
                    "task_raw": task.get("task_raw", ""),
                }
            )

        query = concept + " " + " ".join(unique_tasks)
        query_tokens = tokens(query)
        scored = []
        for qsen in qsen_rows:
            scored.append((candidate_score(query_tokens, qsen), qsen))
        candidates = [
            {
                "module_number": row["module_number"],
                "concept": concept,
                "candidate_rank": idx + 1,
                "candidate_score": score,
                "qsen_statement_id": qsen["qsen_statement_id"],
                "qsen_domain_name": qsen["qsen_domain_name"],
                "ksa_raw": qsen["ksa_raw"],
                "qsen_statement_raw": qsen["qsen_statement_raw"],
                "aacn_subcompetency_codes": qsen["aacn_subcompetency_codes"],
            }
            for idx, (score, qsen) in enumerate(sorted(scored, key=lambda item: item[0], reverse=True)[:12])
        ]
        candidate_rows.extend(candidates)

        suggestion = {
            "mapping_status": "credential_pending",
            "top_qsen_statement_id": "",
            "top_aacn_subcompetency_codes": [],
            "confidence": "low",
            "rationale": "OpenAI API key not available; AI suggestion not generated.",
            "alternate_qsen_statement_ids": [],
            "review_notes": "Run again with --require-ai after secure OPENAI_API_KEY setup.",
        }
        validation_errors = []
        if api_key:
            payload = {
                "wps_process": {
                    "module_number": row["module_number"],
                    "concept": concept,
                    "unique_task_evidence": unique_tasks[:12],
                    "source_variants": sorted({task.get("rapids_code", "") for task in row.get("tasks", [])}),
                },
                "candidate_qsen_statements": [
                    {
                        "qsen_statement_id": cand["qsen_statement_id"],
                        "qsen_domain_name": cand["qsen_domain_name"],
                        "ksa_raw": cand["ksa_raw"],
                        "qsen_statement_raw": cand["qsen_statement_raw"],
                        "aacn_subcompetency_codes": cand["aacn_subcompetency_codes"],
                    }
                    for cand in candidates
                ],
            }
            try:
                suggestion = call_openai(payload, api_key)
                validation_errors = validate_suggestion(suggestion, candidates)
                time.sleep(0.2)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
                api_errors.append({"module_number": row["module_number"], "concept": concept, "error": str(exc)})
                suggestion = {
                    "mapping_status": "api_error",
                    "top_qsen_statement_id": "",
                    "top_aacn_subcompetency_codes": [],
                    "confidence": "low",
                    "rationale": "API call failed; see QA error list.",
                    "alternate_qsen_statement_ids": [],
                    "review_notes": "Retry after resolving API issue.",
                }
        suggestion_records.append(
            {
                "module_number": row["module_number"],
                "concept": concept,
                "suggestion": suggestion,
                "validation_errors": validation_errors,
                "candidate_ids": [cand["qsen_statement_id"] for cand in candidates],
            }
        )
        top_candidate = candidates[0] if candidates else {}
        process_rows.append(
            {
                "module_number": row["module_number"],
                "concept": concept,
                "task_count": row.get("task_count", ""),
                "unique_task_count": len(unique_tasks),
                "review_count": row.get("review_count", ""),
                "source_anchor": row.get("source_anchor", ""),
                "ai_mapping_status": suggestion.get("mapping_status", ""),
                "ai_top_qsen_statement_id": suggestion.get("top_qsen_statement_id", ""),
                "ai_top_aacn_subcompetency_codes": "; ".join(suggestion.get("top_aacn_subcompetency_codes", [])),
                "ai_confidence": suggestion.get("confidence", ""),
                "ai_rationale": suggestion.get("rationale", ""),
                "ai_alternate_qsen_statement_ids": "; ".join(suggestion.get("alternate_qsen_statement_ids", [])),
                "ai_review_notes": suggestion.get("review_notes", ""),
                "ai_validation_errors": "; ".join(validation_errors),
                "local_top_candidate_qsen_id": top_candidate.get("qsen_statement_id", ""),
                "local_top_candidate_score": top_candidate.get("candidate_score", ""),
                "review_decision": "",
                "reviewer_notes": "",
                "final_qsen_statement_id": "",
                "final_aacn_subcompetency_codes": "",
            }
        )

    write_csv(PROCESS_CSV, process_rows)
    with SUGGESTIONS_JSONL.open("w", encoding="utf-8") as f:
        for record in suggestion_records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    rows_payload = {
        "summary_rows": [
            {"field": "Generated", "value": datetime.now().isoformat(timespec="seconds")},
            {"field": "Original WPS process rows", "value": len(crosswalk["dim_wps_process"])},
            {"field": "Excluded metadata rows", "value": len(excluded_rows)},
            {"field": "True WPS process rows", "value": len(true_processes)},
            {"field": "Held true process rows drafted", "value": len(process_rows)},
            {"field": "Existing clean process rows", "value": len(true_processes) - len(process_rows)},
            {"field": "AI API status", "value": api_status},
            {"field": "Model", "value": MODEL},
        ],
        "process_rows": process_rows,
        "excluded_rows": excluded_rows,
        "task_rows": task_rows,
        "candidate_rows": candidate_rows,
        "qa_rows": [],
    }
    ROWS_JSON.write_text(json.dumps(rows_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    drafted_count = sum(1 for row in process_rows if row["ai_mapping_status"] in {"draft_mapping", "not_mappable", "insufficient_evidence"})
    unresolved_count = sum(1 for row in process_rows if row["ai_mapping_status"] not in {"draft_mapping", "not_mappable", "insufficient_evidence"})
    hallucination_error_count = sum(1 for record in suggestion_records for _ in record["validation_errors"])
    source_hash_checks = [
        {"path": str(CROSSWALK_DATA), "hash": sha256(CROSSWALK_DATA)},
        {"path": str(SOURCE_TRACE), "hash": sha256(SOURCE_TRACE)},
    ]
    for item in crosswalk.get("wps_source_files", []):
        if item.get("canonical_input") and item.get("source_kind") in {"wps_docx", "prelicensure_workbook", "wps_backup"}:
            p = Path(item["source_path"])
            if p.exists():
                source_hash_checks.append({"path": str(p), "hash": sha256(p)})

    if api_key and not api_errors:
        status = "complete"
    elif api_key and api_errors:
        status = "api_errors"
    else:
        status = "prepared_pending_ai"

    qa = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "status": status,
        "model": MODEL,
        "openai_api_key_present": bool(api_key),
        "credential_safe_status": "no_key_value_printed",
        "api_status": api_status,
        "api_error_count": len(api_errors),
        "api_errors": api_errors,
        "original_process_count": len(crosswalk["dim_wps_process"]),
        "excluded_metadata_count": len(excluded_rows),
        "true_process_count": len(true_processes),
        "held_true_process_draft_count": len(process_rows),
        "existing_clean_true_process_count": len(true_processes) - len(process_rows),
        "ai_drafted_count": drafted_count,
        "unresolved_count": unresolved_count,
        "hallucination_validation_error_count": hallucination_error_count,
        "lesson_generation_run": False,
        "drive_or_notion_changed": False,
        "source_files_modified": False,
        "clean_default_run_status": run_qa.get("validation_status", ""),
        "outputs": {
            "workbook": str(OUT_DIR / "wps_process_mapping_resolution_draft.xlsx"),
            "csv": str(PROCESS_CSV),
            "suggestions_jsonl": str(SUGGESTIONS_JSONL),
            "qa_json": str(QA_JSON),
            "handoff": str(HANDOFF_MD),
        },
        "source_hash_checks": source_hash_checks,
    }
    QA_JSON.write_text(json.dumps(qa, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = [
        "# RN WPS Mapping Resolution Draft",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Status",
        "",
        f"- Original WPS process rows: {len(crosswalk['dim_wps_process'])}",
        f"- Excluded metadata artifacts: {len(excluded_rows)} (`*CIP Code`, `Provider`)",
        f"- True WPS process rows after exclusion: {len(true_processes)}",
        f"- Held true process concepts drafted: {len(process_rows)}",
        f"- Existing clean process concepts retained: {len(true_processes) - len(process_rows)}",
        f"- AI API status: {api_status}",
        f"- Model: {MODEL}",
        "",
        "## Review Instructions",
        "",
        "Use `Process_Resolution` for reviewer decisions. AI suggestions are draft-only and must not be treated as final mappings until reviewed.",
        "Use `Task_Evidence` and `QSEN_Candidate_Index` to verify each decision.",
        "",
        "## Outputs",
        "",
        f"- Workbook: `{OUT_DIR / 'wps_process_mapping_resolution_draft.xlsx'}`",
        f"- CSV: `{PROCESS_CSV}`",
        f"- AI suggestions: `{SUGGESTIONS_JSONL}`",
        f"- QA: `{QA_JSON}`",
        "",
    ]
    HANDOFF_MD.write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps({
        "status": qa["status"],
        "api_status": api_status,
        "process_rows": len(process_rows),
        "excluded_metadata_count": len(excluded_rows),
        "true_process_count": len(true_processes),
        "ai_drafted_count": drafted_count,
        "unresolved_count": unresolved_count,
        "qa_json": str(QA_JSON),
    }, indent=2))
    return 2 if require_ai and qa["status"] != "complete" else 0


if __name__ == "__main__":
    raise SystemExit(main())
