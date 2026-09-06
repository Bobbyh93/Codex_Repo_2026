from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(r"C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12")
CROSSWALK_DATA = Path(r"C:\Users\RHarrity\Documents\Codex\rn_wps_prelicensure_crosswalk_workset_2026-06-12\build\intermediate\rn_wps_prelicensure_crosswalk_data.json")
TRACE_PATH = ROOT / "support" / "source_trace.json"
RUN_QA_PATH = ROOT / "ngn_ckm_clean_default_run_qa.json"
REVIEW_DIR = ROOT / "review_packet"
ROWS_JSON = REVIEW_DIR / "review_packet_rows.json"
REVIEW_CSV = REVIEW_DIR / "review_held_ngn_ckm_rows.csv"
TASK_TRACE_CSV = REVIEW_DIR / "review_held_task_trace.csv"
MAPPING_CONTEXT_CSV = REVIEW_DIR / "review_held_mapping_context.csv"
QA_PATH = REVIEW_DIR / "review_packet_qa.json"
MD_PATH = REVIEW_DIR / "review_held_ngn_ckm_rows.md"


def source_noise_candidate(concept: str, tasks: list[dict]) -> bool:
    if concept.strip().startswith("*"):
        return True
    if not tasks:
        return False
    numeric = sum(1 for task in tasks if re.fullmatch(r"\d{2}\.\d{4}", str(task.get("task_raw", "")).strip()))
    return numeric / len(tasks) >= 0.75


def recommended_action(concept: str, tasks: list[dict], review_count: int, confident_count: int) -> str:
    if source_noise_candidate(concept, tasks):
        return "exclude_from_engine_source_candidate"
    if confident_count > 0:
        return "review_partial_mapping_then_release"
    if review_count > 0:
        return "mapping_review_required"
    return "ready"


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    headers = list(rows[0].keys()) if rows else ["note"]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    trace = json.loads(TRACE_PATH.read_text(encoding="utf-8"))
    crosswalk = json.loads(CROSSWALK_DATA.read_text(encoding="utf-8"))
    run_qa = json.loads(RUN_QA_PATH.read_text(encoding="utf-8"))

    bridges_by_process = defaultdict(list)
    for bridge in crosswalk["suggested_wps_prelicensure_bridge"]:
        bridges_by_process[bridge["process_raw"]].append(bridge)

    held = [row for row in trace if row.get("needs_review")]
    review_rows = []
    task_trace_rows = []
    mapping_rows = []

    for row in sorted(held, key=lambda r: (-r.get("review_rate", 0), r["concept"])):
        bridges = bridges_by_process[row["concept"]]
        reasons = Counter(bridge.get("review_reason", "") for bridge in bridges if bridge.get("needs_review"))
        proposed = Counter(
            bridge.get("proposed_qsen_statement_id", "")
            for bridge in bridges
            if bridge.get("proposed_qsen_statement_id")
        )
        action = recommended_action(row["concept"], row["tasks"], row["review_count"], row["confident_count"])
        review_rows.append(
            {
                "module_number": row["module_number"],
                "concept": row["concept"],
                "recommended_action": action,
                "task_count": row["task_count"],
                "bridge_count": row["bridge_count"],
                "review_count": row["review_count"],
                "confident_count": row["confident_count"],
                "review_rate": row["review_rate"],
                "dominant_review_reason": reasons.most_common(1)[0][0] if reasons else "",
                "review_reason_counts": "; ".join(f"{reason}={count}" for reason, count in reasons.most_common()),
                "top_proposed_qsen_ids": "; ".join(f"{qid}={count}" for qid, count in proposed.most_common(5)),
                "source_anchor": row["source_anchor"],
                "review_decision": "",
                "reviewer_notes": "",
            }
        )
        for task in row["tasks"]:
            task_trace_rows.append(
                {
                    "module_number": row["module_number"],
                    "concept": row["concept"],
                    "recommended_action": action,
                    "wps_task_id": task["wps_task_id"],
                    "source_file": task["source_file"],
                    "rapids_code": task["rapids_code"],
                    "variant": task["variant"],
                    "source_table_index": task["source_table_index"],
                    "source_row_index": task["source_row_index"],
                    "task_raw": task["task_raw"],
                }
            )
        for bridge in bridges:
            mapping_rows.append(
                {
                    "module_number": row["module_number"],
                    "concept": row["concept"],
                    "recommended_action": action,
                    "bridge_id": bridge["bridge_id"],
                    "wps_task_id": bridge["wps_task_id"],
                    "source_file": bridge["source_file"],
                    "rapids_code": bridge["rapids_code"],
                    "variant": bridge["variant"],
                    "task_raw": bridge["task_raw"],
                    "proposed_qsen_statement_id": bridge["proposed_qsen_statement_id"],
                    "proposed_qsen_domain_name": bridge["proposed_qsen_domain_name"],
                    "proposed_ksa_raw": bridge["proposed_ksa_raw"],
                    "proposed_qsen_statement_raw": bridge["proposed_qsen_statement_raw"],
                    "match_score": bridge["match_score"],
                    "second_best_score": bridge["second_best_score"],
                    "review_reason": bridge["review_reason"],
                }
            )

    write_csv(REVIEW_CSV, review_rows)
    write_csv(TASK_TRACE_CSV, task_trace_rows)
    write_csv(MAPPING_CONTEXT_CSV, mapping_rows)
    ROWS_JSON.write_text(
        json.dumps(
            {
                "summary_rows": review_rows,
                "task_trace_rows": task_trace_rows,
                "mapping_context_rows": mapping_rows,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    action_counts = Counter(row["recommended_action"] for row in review_rows)
    qa = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "packet_status": "complete",
        "held_process_rows": len(review_rows),
        "held_task_trace_rows": len(task_trace_rows),
        "held_mapping_context_rows": len(mapping_rows),
        "recommended_action_counts": dict(action_counts),
        "clean_default_run_status": run_qa.get("validation_status"),
        "clean_default_rows_processed": run_qa.get("row_count"),
        "source_trace": str(TRACE_PATH),
        "crosswalk_data": str(CROSSWALK_DATA),
        "outputs": {
            "review_workbook": str(REVIEW_DIR / "review_held_ngn_ckm_rows.xlsx"),
            "review_csv": str(REVIEW_CSV),
            "task_trace_csv": str(TASK_TRACE_CSV),
            "mapping_context_csv": str(MAPPING_CONTEXT_CSV),
            "markdown": str(MD_PATH),
        },
    }
    QA_PATH.write_text(json.dumps(qa, indent=2), encoding="utf-8")

    top_rows = review_rows[:12]
    lines = [
        "# Review-Held NGN/CKM Rows",
        "",
        f"Generated: {datetime.now().date().isoformat()}",
        "",
        "## Summary",
        "",
        f"- Held process rows: {len(review_rows)}",
        f"- Held task trace rows: {len(task_trace_rows)}",
        f"- Held mapping context rows: {len(mapping_rows)}",
        f"- Clean default run QA: {run_qa.get('validation_status')}",
        "",
        "## Recommended Actions",
        "",
    ]
    for action, count in action_counts.most_common():
        lines.append(f"- {action}: {count}")
    lines.extend(["", "## Highest-Priority Rows", ""])
    for row in top_rows:
        lines.append(
            f"- `{row['module_number']}` {row['concept']} - {row['recommended_action']} "
            f"({row['review_count']}/{row['bridge_count']} review; reason: {row['dominant_review_reason']})"
        )
    lines.extend(
        [
            "",
            "## Review Guidance",
            "",
            "Rows marked `exclude_from_engine_source_candidate` appear to be source metadata rather than lesson concepts and should normally be removed from engine queues.",
            "Rows marked `mapping_review_required` need human mapping review before setting `needs_review=false` in any engine queue.",
            "Rows marked `review_partial_mapping_then_release` have some confident mapping signal but still require review before release.",
            "",
        ]
    )
    MD_PATH.write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps({"review_rows": len(review_rows), "task_trace_rows": len(task_trace_rows), "mapping_context_rows": len(mapping_rows), "qa_path": str(QA_PATH)}, indent=2))


if __name__ == "__main__":
    main()
