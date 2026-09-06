#!/usr/bin/env python3
"""
Build the complete 36-row RN WPS -> QSEN crosswalk on one candidate-generation method.

Merges the 10 rows regenerated in candidate_regeneration_v2.json with the 26 rows in
candidate_regeneration_v3_additional.json, validates every draft against its own
regenerated candidate set using the validate_suggestion() rules from
build_mapping_resolution.py, and writes a reviewer packet to a new folder.

AACN codes and statement text are read from the crosswalk source of record. Nothing
existing is modified.
"""
from __future__ import annotations
import argparse, csv, datetime as dt, json, sys
from collections import Counter
from pathlib import Path

DRAFTER = "claude-opus-5 (Claude, via Cowork session)"
OUT_DIRNAME = "mapping_resolution_claude_v3"

FIELDS = [
    "module_number", "concept",
    "v1_status", "v1_top", "v3_change",
    "mapping_status", "confidence",
    "top_qsen_statement_id", "top_qsen_statement_text", "top_qsen_domain", "top_qsen_ksa",
    "top_aacn_subcompetency_codes", "alternate_qsen_statement_ids", "candidate_set",
    "rationale", "review_notes", "validation_errors",
    "review_decision", "reviewer_notes", "final_qsen_statement_id", "final_aacn_subcompetency_codes",
]


def validate(sug, cand_ids, by_id):
    errs = []
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


def classify(row):
    v1s, v1t = row["v1_status"], row.get("v1_top", "")
    new_s, new_t = row["mapping_status"], row.get("top", "")
    if v1s == new_s and v1t == new_t:
        return "confirmed"
    if v1s != new_s:
        return f"status_changed:{v1s}->{new_s}"
    return f"top_changed:{v1t}->{new_t}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--codex-root", default=r"C:\Users\RHarrity\Documents\Codex")
    ap.add_argument("--v2", default="candidate_regeneration_v2.json")
    ap.add_argument("--v3", default="candidate_regeneration_v3_additional.json")
    args = ap.parse_args()

    root = Path(args.codex_root)
    crosswalk = root / "rn_wps_prelicensure_crosswalk_workset_2026-06-12" / "build" / "intermediate" / "rn_wps_prelicensure_crosswalk_data.json"
    ingest = root / "ngn_ckm_rn_wps_ingest_workset_2026-06-12"
    if not crosswalk.exists():
        print(f"ERROR: missing {crosswalk}", file=sys.stderr); return 1

    by_id = {r["qsen_statement_id"]: r for r in json.loads(crosswalk.read_text(encoding="utf-8"))["fact_prelicensure_qsen"]}
    print(f"QSEN index: {len(by_id)} statements")

    merged = {}
    for path, origin in ((Path(args.v2), "v2"), (Path(args.v3), "v3")):
        if not path.exists():
            print(f"ERROR: missing {path}", file=sys.stderr); return 1
        for m, row in json.loads(path.read_text(encoding="utf-8"))["rows"].items():
            if m in merged:
                print(f"ERROR: {m} appears in both proposals", file=sys.stderr); return 1
            row["_origin"] = origin
            merged[m] = row
    print(f"merged proposals: {len(merged)} rows ({sum(1 for r in merged.values() if r['_origin']=='v2')} from v2, {sum(1 for r in merged.values() if r['_origin']=='v3')} from v3)")

    unknown = sorted({c for r in merged.values() for c in r["candidates"] if c not in by_id})
    if unknown:
        print(f"ERROR: candidate ids not in source index: {unknown}", file=sys.stderr); return 1

    # cross-check against the real process list
    mr = ingest / "mapping_resolution" / "mapping_resolution_rows.json"
    if mr.exists():
        actual = {p["module_number"] for p in json.loads(mr.read_text(encoding="utf-8"))["process_rows"]}
        missing, extra = sorted(actual - set(merged)), sorted(set(merged) - actual)
        if missing or extra:
            print(f"ERROR: coverage mismatch. missing={missing} extra={extra}", file=sys.stderr); return 1
        print(f"coverage: all {len(actual)} process rows accounted for")

    out = ingest / OUT_DIRNAME
    out.mkdir(exist_ok=True)

    rows, lines, total_err = [], [], 0
    status_c, conf_c, change_c = Counter(), Counter(), Counter()

    for module in sorted(merged):
        row = merged[module]
        cand = set(row["candidates"])
        top = row.get("top", "")
        top_row = by_id.get(top) if top else None
        codes = [c.strip() for c in str((top_row or {}).get("aacn_subcompetency_codes", "")).split(";") if c.strip()] if top_row else []

        sug = {
            "mapping_status": row["mapping_status"],
            "top_qsen_statement_id": top,
            "top_aacn_subcompetency_codes": codes,
            "confidence": row["confidence"],
            "rationale": row["rationale"],
            "alternate_qsen_statement_ids": row["alts"],
            "review_notes": row["notes"],
        }
        errs = validate(sug, cand, by_id)
        total_err += len(errs)
        change = classify(row)
        status_c[sug["mapping_status"]] += 1
        if sug["mapping_status"] == "draft_mapping":
            conf_c[sug["confidence"]] += 1
        change_c[change.split(":")[0]] += 1

        lines.append(json.dumps({
            "module_number": module, "concept": row["concept"],
            "candidate_generation": "semantic_over_full_qsen_index",
            "proposal_origin": row["_origin"],
            "candidate_ids": row["candidates"],
            "suggestion": sug, "validation_errors": errs,
            "v1": {"status": row["v1_status"], "top": row.get("v1_top", "")},
            "change_vs_v1": change, "drafted_by": DRAFTER,
        }, ensure_ascii=False))

        rows.append({
            "module_number": module, "concept": row["concept"],
            "v1_status": row["v1_status"], "v1_top": row.get("v1_top", ""), "v3_change": change,
            "mapping_status": sug["mapping_status"], "confidence": sug["confidence"],
            "top_qsen_statement_id": top,
            "top_qsen_statement_text": (top_row or {}).get("qsen_statement_raw", ""),
            "top_qsen_domain": (top_row or {}).get("qsen_domain_name", ""),
            "top_qsen_ksa": (top_row or {}).get("ksa_raw", ""),
            "top_aacn_subcompetency_codes": "; ".join(codes),
            "alternate_qsen_statement_ids": "; ".join(row["alts"]),
            "candidate_set": "; ".join(row["candidates"]),
            "rationale": sug["rationale"], "review_notes": sug["review_notes"],
            "validation_errors": "; ".join(errs),
            "review_decision": "", "reviewer_notes": "",
            "final_qsen_statement_id": "", "final_aacn_subcompetency_codes": "",
        })

    (out / "claude_crosswalk_v3.jsonl").write_text("\n".join(lines) + "\n", encoding="utf-8")
    csv_path = out / "wps_qsen_crosswalk_v3_review.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS); w.writeheader(); w.writerows(rows)

    ksa = Counter(r["top_qsen_ksa"] for r in rows if r["top_qsen_ksa"])
    qa = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "regenerated_pending_human_review" if total_err == 0 else "regenerated_with_validation_errors",
        "drafted_by": DRAFTER,
        "candidate_generation": "semantic selection over the full 207-statement QSEN index for all 36 rows",
        "supersedes": ["mapping_resolution_claude", "mapping_resolution_claude_v2"],
        "method_consistency": "All 36 rows now use one candidate-generation method. v1 mixed a top-12 lexical prefilter across every row; v2 covered 10 rows semantically.",
        "openai_api_calls_made": False,
        "source_files_modified": False,
        "original_artifacts_overwritten": False,
        "qsen_index_size": len(by_id),
        "row_count": len(rows),
        "mapping_status_counts": dict(status_c),
        "confidence_counts_for_drafts": dict(conf_c),
        "change_vs_v1": dict(change_c),
        "top_statement_ksa_distribution": dict(ksa),
        "hallucination_validation_error_count": total_err,
        "validation_contract": "validate_suggestion() rules from build_mapping_resolution.py",
        "review_required": True,
        "hard_stop": "Drafts. No row enters the ingest queue or the binding manifest without a reviewer decision.",
    }
    (out / "claude_crosswalk_v3_qa.json").write_text(json.dumps(qa, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote packet to: {out}")
    print(f"  rows              : {len(rows)}")
    print(f"  status            : {dict(status_c)}")
    print(f"  draft confidence  : {dict(conf_c)}")
    print(f"  change vs v1      : {dict(change_c)}")
    print(f"  top KSA levels    : {dict(ksa)}")
    print(f"  validation errors : {total_err}")
    return 2 if total_err else 0


if __name__ == "__main__":
    raise SystemExit(main())
