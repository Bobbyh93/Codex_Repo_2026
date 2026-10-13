#!/usr/bin/env python3
"""
Merge Claude-drafted WPS -> QSEN mapping suggestions into a reviewer packet.

WHAT THIS DOES
  Fills the 36 `credential_pending` rows that build_mapping_resolution.py left
  undrafted because no OpenAI API key was available. The drafting model here is
  Claude, not gpt-5.4-mini. No OpenAI API call is made.

WHAT THIS DOES NOT DO
  It does not overwrite any existing artifact. Everything is written to a new
  sibling folder so the original credential_pending record stays intact as
  evidence of what the pipeline actually did on 2026-06-12.

CONTRACT
  Enforces the same rules as validate_suggestion() in build_mapping_resolution.py:
    - a draft_mapping's top_qsen_statement_id must be in that row's candidate set
    - every top_aacn_subcompetency_code must belong to that chosen QSEN statement
    - every alternate_qsen_statement_id must be in that row's candidate set
  AACN codes are read from the source candidate rows, never typed by hand, so
  code transcription error is structurally impossible.

USAGE
  Run from anywhere. Both paths default to the workset layout on this machine.

    python merge_claude_mapping_resolution.py \
        --workset "C:\\Users\\RHarrity\\Documents\\Codex\\ngn_ckm_rn_wps_ingest_workset_2026-06-12" \
        --suggestions claude_suggestions.json

  Exit code 0 = all suggestions validated. Exit code 2 = validation errors found
  (the packet is still written, with the errors recorded in the QA file).
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
from pathlib import Path

DRAFTER = "claude-opus-5 (Claude, via Cowork session)"
OUT_DIRNAME = "mapping_resolution_claude"

CSV_FIELDS = [
    "module_number",
    "concept",
    "task_count",
    "review_count",
    "ai_mapping_status",
    "ai_confidence",
    "ai_top_qsen_statement_id",
    "ai_top_qsen_statement_text",
    "ai_top_qsen_domain",
    "ai_top_qsen_ksa",
    "ai_top_aacn_subcompetency_codes",
    "ai_alternate_qsen_statement_ids",
    "ai_rationale",
    "ai_review_notes",
    "ai_validation_errors",
    "local_top_candidate_qsen_id",
    "local_top_candidate_score",
    "candidate_filler_count",
    "review_decision",
    "reviewer_notes",
    "final_qsen_statement_id",
    "final_aacn_subcompetency_codes",
]


def validate(suggestion: dict, candidates: list[dict]) -> list[str]:
    """Mirror of validate_suggestion() in build_mapping_resolution.py."""
    errors: list[str] = []
    by_id = {row["qsen_statement_id"]: row for row in candidates}
    top_id = suggestion.get("top_qsen_statement_id", "")

    if suggestion.get("mapping_status") == "draft_mapping":
        if top_id not in by_id:
            errors.append("top_qsen_statement_id_not_in_candidate_set")
        allowed = set()
        if top_id in by_id:
            allowed.update(
                code.strip()
                for code in str(by_id[top_id].get("aacn_subcompetency_codes", "")).split(";")
                if code.strip()
            )
        for code in suggestion.get("top_aacn_subcompetency_codes", []):
            if code not in allowed:
                errors.append(f"aacn_code_not_in_top_qsen:{code}")

    for alt in suggestion.get("alternate_qsen_statement_ids", []):
        if alt not in by_id:
            errors.append(f"alternate_qsen_statement_id_not_in_candidate_set:{alt}")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--workset",
        default=r"C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12",
        help="Path to the ngn_ckm ingest workset folder.",
    )
    ap.add_argument(
        "--suggestions",
        default="claude_suggestions.json",
        help="Path to claude_suggestions.json.",
    )
    args = ap.parse_args()

    workset = Path(args.workset)
    src_rows = workset / "mapping_resolution" / "mapping_resolution_rows.json"
    if not src_rows.exists():
        print(f"ERROR: cannot find {src_rows}", file=sys.stderr)
        return 1

    sug_path = Path(args.suggestions)
    if not sug_path.exists():
        print(f"ERROR: cannot find {sug_path}", file=sys.stderr)
        return 1

    data = json.loads(src_rows.read_text(encoding="utf-8"))
    payload = json.loads(sug_path.read_text(encoding="utf-8"))
    drafts = payload["suggestions"] if "suggestions" in payload else payload

    candidates_by_module: dict[str, list[dict]] = {}
    for row in data["candidate_rows"]:
        candidates_by_module.setdefault(row["module_number"], []).append(row)

    out_dir = workset / OUT_DIRNAME
    out_dir.mkdir(exist_ok=True)

    generated_at = dt.datetime.now(dt.timezone.utc).isoformat()
    csv_rows: list[dict] = []
    jsonl_lines: list[str] = []
    total_errors = 0
    status_counts: dict[str, int] = {}
    confidence_counts: dict[str, int] = {}
    missing_modules: list[str] = []

    for proc in data["process_rows"]:
        module = proc["module_number"]
        cands = candidates_by_module.get(module, [])
        by_id = {c["qsen_statement_id"]: c for c in cands}
        draft = drafts.get(module)

        if draft is None:
            missing_modules.append(module)
            continue

        top_id = draft.get("top", "")
        top_row = by_id.get(top_id)

        # AACN codes are taken from the source candidate row, never hand-typed.
        top_codes: list[str] = []
        if top_row:
            top_codes = [
                code.strip()
                for code in str(top_row.get("aacn_subcompetency_codes", "")).split(";")
                if code.strip()
            ]

        suggestion = {
            "mapping_status": draft["mapping_status"],
            "top_qsen_statement_id": top_id,
            "top_aacn_subcompetency_codes": top_codes,
            "confidence": draft["confidence"],
            "rationale": draft["rationale"],
            "alternate_qsen_statement_ids": draft.get("alts", []),
            "review_notes": draft["notes"],
        }

        errors = validate(suggestion, cands)
        total_errors += len(errors)

        status_counts[suggestion["mapping_status"]] = status_counts.get(suggestion["mapping_status"], 0) + 1
        confidence_counts[suggestion["confidence"]] = confidence_counts.get(suggestion["confidence"], 0) + 1

        filler = sum(1 for c in cands if float(c.get("candidate_score", 0) or 0) == 0.0)

        jsonl_lines.append(
            json.dumps(
                {
                    "module_number": module,
                    "concept": proc["concept"],
                    "suggestion": suggestion,
                    "validation_errors": errors,
                    "candidate_ids": [c["qsen_statement_id"] for c in cands],
                    "drafted_by": DRAFTER,
                },
                ensure_ascii=False,
            )
        )

        csv_rows.append(
            {
                "module_number": module,
                "concept": proc["concept"],
                "task_count": proc.get("task_count", ""),
                "review_count": proc.get("review_count", ""),
                "ai_mapping_status": suggestion["mapping_status"],
                "ai_confidence": suggestion["confidence"],
                "ai_top_qsen_statement_id": top_id,
                "ai_top_qsen_statement_text": (top_row or {}).get("qsen_statement_raw", ""),
                "ai_top_qsen_domain": (top_row or {}).get("qsen_domain_name", ""),
                "ai_top_qsen_ksa": (top_row or {}).get("ksa_raw", ""),
                "ai_top_aacn_subcompetency_codes": "; ".join(top_codes),
                "ai_alternate_qsen_statement_ids": "; ".join(suggestion["alternate_qsen_statement_ids"]),
                "ai_rationale": suggestion["rationale"],
                "ai_review_notes": suggestion["review_notes"],
                "ai_validation_errors": "; ".join(errors),
                "local_top_candidate_qsen_id": proc.get("local_top_candidate_qsen_id", ""),
                "local_top_candidate_score": proc.get("local_top_candidate_score", ""),
                "candidate_filler_count": filler,
                "review_decision": "",
                "reviewer_notes": "",
                "final_qsen_statement_id": "",
                "final_aacn_subcompetency_codes": "",
            }
        )

    (out_dir / "claude_mapping_suggestions.jsonl").write_text(
        "\n".join(jsonl_lines) + "\n", encoding="utf-8"
    )

    csv_path = out_dir / "wps_process_mapping_resolution_claude_draft.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(csv_rows)

    qa = {
        "generated_at": generated_at,
        "status": "drafted_pending_human_review" if total_errors == 0 else "drafted_with_validation_errors",
        "drafted_by": DRAFTER,
        "model_note": "Drafted by Claude in place of the gpt-5.4-mini call in build_mapping_resolution.py.",
        "openai_api_calls_made": False,
        "openai_api_key_present": False,
        "credential_safe_status": "no_key_read_no_key_value_printed",
        "source_files_modified": False,
        "original_artifacts_overwritten": False,
        "lesson_generation_run": False,
        "drive_or_notion_changed": False,
        "process_row_count": len(data["process_rows"]),
        "drafted_count": sum(status_counts.values()),
        "missing_modules": missing_modules,
        "mapping_status_counts": status_counts,
        "confidence_counts": confidence_counts,
        "hallucination_validation_error_count": total_errors,
        "validation_contract": "validate_suggestion() rules from build_mapping_resolution.py, reimplemented verbatim",
        "review_required": True,
        "review_instrument": str(csv_path),
        "hard_stop": "These are drafts. No row may enter the ingest queue or the binding manifest without a reviewer decision in review_decision.",
        "outputs": {
            "jsonl": str(out_dir / "claude_mapping_suggestions.jsonl"),
            "csv": str(csv_path),
            "qa": str(out_dir / "claude_mapping_resolution_qa.json"),
        },
    }
    (out_dir / "claude_mapping_resolution_qa.json").write_text(
        json.dumps(qa, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"Wrote packet to: {out_dir}")
    print(f"  drafted           : {sum(status_counts.values())} of {len(data['process_rows'])}")
    print(f"  status counts     : {status_counts}")
    print(f"  confidence counts : {confidence_counts}")
    print(f"  validation errors : {total_errors}")
    if missing_modules:
        print(f"  MISSING           : {missing_modules}")

    return 2 if total_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
