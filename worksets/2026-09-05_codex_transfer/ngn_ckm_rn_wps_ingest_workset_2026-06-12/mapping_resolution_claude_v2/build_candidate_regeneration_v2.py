#!/usr/bin/env python3
"""
Build a reviewer packet from semantically regenerated candidate sets.

Reads the 207-statement QSEN index from the crosswalk source of record, verifies
every proposed candidate id exists, derives AACN codes from the source rather than
from the proposal, and validates each draft against its OWN v2 candidate set using
the same rules as validate_suggestion() in build_mapping_resolution.py.

Writes to a new folder. Nothing existing is modified.
"""
from __future__ import annotations
import argparse, csv, datetime as dt, json, sys
from pathlib import Path

DRAFTER = "claude-opus-5 (Claude, via Cowork session)"
OUT_DIRNAME = "mapping_resolution_claude_v2"

FIELDS = [
    "module_number", "concept", "v1_status", "v1_top", "v1_filler_count",
    "v2_mapping_status", "v2_confidence",
    "v2_top_qsen_statement_id", "v2_top_qsen_statement_text",
    "v2_top_qsen_domain", "v2_top_qsen_ksa", "v2_top_aacn_subcompetency_codes",
    "v2_alternate_qsen_statement_ids", "v2_candidate_set",
    "v2_rationale", "v2_review_notes", "v2_validation_errors",
    "review_decision", "reviewer_notes", "final_qsen_statement_id", "final_aacn_subcompetency_codes",
]


def validate(sug: dict, cand_ids: set[str], by_id: dict[str, dict]) -> list[str]:
    errs: list[str] = []
    top = sug.get("top_qsen_statement_id", "")
    if sug.get("mapping_status") == "draft_mapping":
        if top not in cand_ids:
            errs.append("top_qsen_statement_id_not_in_candidate_set")
        allowed = set()
        if top in by_id:
            allowed.update(c.strip() for c in str(by_id[top].get("aacn_subcompetency_codes", "")).split(";") if c.strip())
        for code in sug.get("top_aacn_subcompetency_codes", []):
            if code not in allowed:
                errs.append(f"aacn_code_not_in_top_qsen:{code}")
    for alt in sug.get("alternate_qsen_statement_ids", []):
        if alt not in cand_ids:
            errs.append(f"alternate_qsen_statement_id_not_in_candidate_set:{alt}")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--codex-root", default=r"C:\Users\RHarrity\Documents\Codex")
    ap.add_argument("--proposal", default="candidate_regeneration_v2.json")
    args = ap.parse_args()

    root = Path(args.codex_root)
    crosswalk = root / "rn_wps_prelicensure_crosswalk_workset_2026-06-12" / "build" / "intermediate" / "rn_wps_prelicensure_crosswalk_data.json"
    ingest = root / "ngn_ckm_rn_wps_ingest_workset_2026-06-12"
    if not crosswalk.exists():
        print(f"ERROR: missing {crosswalk}", file=sys.stderr); return 1

    qsen = json.loads(crosswalk.read_text(encoding="utf-8"))["fact_prelicensure_qsen"]
    by_id = {r["qsen_statement_id"]: r for r in qsen}
    print(f"QSEN index: {len(by_id)} statements")

    proposal = json.loads(Path(args.proposal).read_text(encoding="utf-8"))["rows"]

    # hard preflight: every proposed id must exist in the source index
    unknown = sorted({cid for row in proposal.values() for cid in row["candidates"] if cid not in by_id})
    if unknown:
        print(f"ERROR: proposed candidate ids not present in the source index: {unknown}", file=sys.stderr)
        return 1
    dupes = {m: row["candidates"] for m, row in proposal.items() if len(set(row["candidates"])) != len(row["candidates"])}
    if dupes:
        print(f"ERROR: duplicate candidate ids in {list(dupes)}", file=sys.stderr)
        return 1
    print("preflight: all proposed candidate ids exist, no duplicates within a set")

    out = ingest / OUT_DIRNAME
    out.mkdir(exist_ok=True)

    rows, lines, total_err = [], [], 0
    status_counts, conf_counts = {}, {}

    for module, row in proposal.items():
        cand_ids = set(row["candidates"])
        top = row["top"]
        top_row = by_id[top]
        codes = [c.strip() for c in str(top_row.get("aacn_subcompetency_codes", "")).split(";") if c.strip()]

        sug = {
            "mapping_status": row["mapping_status"],
            "top_qsen_statement_id": top,
            "top_aacn_subcompetency_codes": codes,
            "confidence": row["confidence"],
            "rationale": row["rationale"],
            "alternate_qsen_statement_ids": row["alts"],
            "review_notes": row["notes"],
        }
        errs = validate(sug, cand_ids, by_id)
        total_err += len(errs)
        status_counts[sug["mapping_status"]] = status_counts.get(sug["mapping_status"], 0) + 1
        conf_counts[sug["confidence"]] = conf_counts.get(sug["confidence"], 0) + 1

        lines.append(json.dumps({
            "module_number": module,
            "concept": row["concept"],
            "candidate_generation": "semantic_over_full_qsen_index_v2",
            "candidate_ids": row["candidates"],
            "suggestion": sug,
            "validation_errors": errs,
            "supersedes": {"v1_status": row["v1_status"], "v1_top": row.get("v1_top", "")},
            "drafted_by": DRAFTER,
        }, ensure_ascii=False))

        rows.append({
            "module_number": module,
            "concept": row["concept"],
            "v1_status": row["v1_status"],
            "v1_top": row.get("v1_top", ""),
            "v1_filler_count": row.get("v1_filler_count", ""),
            "v2_mapping_status": sug["mapping_status"],
            "v2_confidence": sug["confidence"],
            "v2_top_qsen_statement_id": top,
            "v2_top_qsen_statement_text": top_row.get("qsen_statement_raw", ""),
            "v2_top_qsen_domain": top_row.get("qsen_domain_name", ""),
            "v2_top_qsen_ksa": top_row.get("ksa_raw", ""),
            "v2_top_aacn_subcompetency_codes": "; ".join(codes),
            "v2_alternate_qsen_statement_ids": "; ".join(row["alts"]),
            "v2_candidate_set": "; ".join(row["candidates"]),
            "v2_rationale": sug["rationale"],
            "v2_review_notes": sug["review_notes"],
            "v2_validation_errors": "; ".join(errs),
            "review_decision": "", "reviewer_notes": "",
            "final_qsen_statement_id": "", "final_aacn_subcompetency_codes": "",
        })

    (out / "claude_mapping_suggestions_v2.jsonl").write_text("\n".join(lines) + "\n", encoding="utf-8")
    csv_path = out / "wps_process_mapping_resolution_claude_v2.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS); w.writeheader(); w.writerows(rows)

    qa = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "regenerated_pending_human_review" if total_err == 0 else "regenerated_with_validation_errors",
        "drafted_by": DRAFTER,
        "candidate_generation": "semantic selection over the full 207-statement QSEN index, replacing the top-12 lexical prefilter",
        "scope": "the 10 rows flagged in the 2026-08-27 packet as filler-dominated, candidate-gap, false-positive, or KSA-mismatched",
        "openai_api_calls_made": False,
        "source_files_modified": False,
        "original_artifacts_overwritten": False,
        "supersedes": "mapping_resolution_claude/ for these 10 modules only; the other 26 rows there stand",
        "qsen_index_size": len(by_id),
        "row_count": len(rows),
        "mapping_status_counts": status_counts,
        "confidence_counts": conf_counts,
        "hallucination_validation_error_count": total_err,
        "validation_contract": "validate_suggestion() rules from build_mapping_resolution.py, applied against the v2 candidate sets",
        "methodology_change": "This changes the candidate-generation step, not just the drafting step. Adopting it is a methodology decision.",
        "review_required": True,
        "hard_stop": "Drafts. No row enters the ingest queue or binding manifest without a reviewer decision.",
    }
    (out / "claude_mapping_resolution_v2_qa.json").write_text(json.dumps(qa, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote packet to: {out}")
    print(f"  rows              : {len(rows)}")
    print(f"  status counts     : {status_counts}")
    print(f"  confidence counts : {conf_counts}")
    print(f"  validation errors : {total_err}")
    return 2 if total_err else 0


if __name__ == "__main__":
    raise SystemExit(main())
