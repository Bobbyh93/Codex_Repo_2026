from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.run_pipeline import run_pipeline
from backend.ckm_validator_importer import validate_batch

payload = json.loads((ROOT / "samples" / "sample_payload.json").read_text(encoding="utf-8"))
result = run_pipeline(payload, job_id="smoke_test", live_import=True)
assert result["status"] == "complete", result
batch_dir = result["deployment"]["batch_dir"]
report = validate_batch(batch_dir)
assert report["status"] == "pass", report
for artifact_name in ["outline.json", "blueprint.json", "scripts.md", "case_study.md", "answer_key.md", "remediation_map.json", "deck.pptx"]:
    assert (ROOT / "output" / "smoke_test" / artifact_name).exists(), artifact_name
print("smoke_test_passed")
