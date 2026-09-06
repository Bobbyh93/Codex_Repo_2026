from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.run_pipeline import run_pipeline

payload = json.loads((ROOT / "samples" / "sample_payload.json").read_text(encoding="utf-8"))
result = run_pipeline(payload, live_import=True)
print(json.dumps({"job_id": result["job_id"], "status": result["status"], "phase": result["phase"]}, indent=2))
print("Output root:", ROOT / "output")
