"""Run the pipeline across every eligible row in a TopicMasterClean-like workbook."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.full_workbook_runner import run_full_workbook

parser = argparse.ArgumentParser()
parser.add_argument("workbook", help="Path to TopicMasterClean/crosswalk workbook")
parser.add_argument("--sheet", default=None)
parser.add_argument("--no-live-import", action="store_true")
parser.add_argument("--include-review-rows", action="store_true")
parser.add_argument("--max-rows", type=int, default=None, help="Development only. Default processes all rows.")
args = parser.parse_args()

result = run_full_workbook(
    args.workbook,
    sheet_name=args.sheet,
    live_import=not args.no_live_import,
    include_review_rows=args.include_review_rows,
    max_rows=args.max_rows,
)
print(json.dumps(result, indent=2, default=str))
