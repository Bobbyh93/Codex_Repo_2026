#!/usr/bin/env python3
from __future__ import annotations
import argparse, json
from pathlib import Path

DEFAULT_ORDER = ["intake","inventory","normalize","facts","dimensions","bridges","governance","master","coverage","release","qa"]

def validate(manifest: dict):
    errors = []
    for field in ["workflow_name", "objective", "stage_order", "jobs"]:
        if field not in manifest:
            errors.append(f"missing top-level field: {field}")
    stage_rank = {stage: i for i, stage in enumerate(manifest.get("stage_order", DEFAULT_ORDER))}
    jobs = manifest.get("jobs", [])
    job_map = {}
    for idx, job in enumerate(jobs):
        jid = job.get("job_id")
        if not jid:
            errors.append(f"job {idx} missing job_id")
            continue
        if jid in job_map:
            errors.append(f"duplicate job_id: {jid}")
        job_map[jid] = job
        if not job.get("stage"):
            errors.append(f"job {jid} missing stage")
        elif job["stage"] not in stage_rank:
            errors.append(f"job {jid} stage not in stage_order: {job['stage']}")
        if not job.get("title"):
            errors.append(f"job {jid} missing title")
    for jid, job in job_map.items():
        for dep in job.get("depends_on", []):
            if dep not in job_map:
                errors.append(f"job {jid} depends on missing job: {dep}")
                continue
            if stage_rank[job_map[dep]["stage"]] > stage_rank[job["stage"]]:
                errors.append(f"job {jid} depends on later-stage job: {dep}")
    return errors

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    args = ap.parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    errors = validate(manifest)
    if errors:
        print(json.dumps({"valid": False, "errors": errors}, indent=2))
        return 1
    print(json.dumps({"valid": True, "job_count": len(manifest.get("jobs", []))}, indent=2))
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
