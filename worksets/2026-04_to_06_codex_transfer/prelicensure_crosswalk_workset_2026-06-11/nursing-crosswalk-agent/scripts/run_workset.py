#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys, subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
VALIDATOR = SCRIPT_DIR / "validate_manifest.py"

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--outdir", default="./dist-workset")
    args = ap.parse_args()
    manifest_path = Path(args.manifest).resolve()
    outdir = Path(args.outdir).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    check = subprocess.run([sys.executable, str(VALIDATOR), str(manifest_path)], capture_output=True, text=True)
    if check.returncode != 0:
        sys.stderr.write(check.stdout + check.stderr)
        return check.returncode
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    jobs = manifest.get("jobs", [])
    job_map = {j["job_id"]: j for j in jobs}
    indeg = {j["job_id"]: 0 for j in jobs}
    graph = {j["job_id"]: [] for j in jobs}
    for j in jobs:
        for dep in j.get("depends_on", []):
            graph.setdefault(dep, []).append(j["job_id"])
            indeg[j["job_id"]] += 1
    queue = sorted([jid for jid, deg in indeg.items() if deg == 0])
    ordered = []
    while queue:
        jid = queue.pop(0)
        ordered.append(job_map[jid])
        for nxt in sorted(graph.get(jid, [])):
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
                queue.sort()
    if len(ordered) != len(jobs):
        raise SystemExit("cycle detected in manifest")
    execution = []
    for seq, job in enumerate(ordered, start=1):
        execution.append({
            "sequence": seq,
            "job_id": job["job_id"],
            "stage": job.get("stage", ""),
            "title": job.get("title", ""),
            "objective": job.get("objective", ""),
            "depends_on": job.get("depends_on", []),
            "outputs": job.get("outputs", []),
            "prompt_key": job.get("prompt_key", "")
        })
    (outdir / "execution_order.json").write_text(json.dumps(execution, indent=2), encoding="utf-8")
    lines = [f"# {manifest.get('workflow_name','workset')}", "", f"Objective: {manifest.get('objective','')}", "", "## Ordered jobs", ""]
    for item in execution:
        lines.append(f"{item['sequence']}. **{item['job_id']}** ({item['stage']}) — {item['title']}")
        if item["depends_on"]:
            lines.append(f"   - depends_on: {', '.join(item['depends_on'])}")
        if item["outputs"]:
            lines.append(f"   - outputs: {', '.join(item['outputs'])}")
        if item["prompt_key"]:
            lines.append(f"   - prompt_key: {item['prompt_key']}")
    lines.extend(["", "## Blocking rules", ""])
    for rule in manifest.get("blocking_rules", []):
        lines.append(f"- {rule}")
    (outdir / "execution_checklist.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(outdir)
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
