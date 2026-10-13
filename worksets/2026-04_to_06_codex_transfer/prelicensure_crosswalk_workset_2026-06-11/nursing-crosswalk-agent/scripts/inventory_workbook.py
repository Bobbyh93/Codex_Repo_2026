#!/usr/bin/env python3
from __future__ import annotations
import argparse, json
from pathlib import Path
import pandas as pd

def inventory_xlsx(path: Path):
    xls = pd.ExcelFile(path)
    rows = []
    for sheet in xls.sheet_names:
        df = pd.read_excel(path, sheet_name=sheet)
        rows.append({
            "source_file": path.name,
            "source_sheet": sheet,
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "headers": [str(c).strip() for c in df.columns],
        })
    return rows

def inventory_csv(path: Path):
    df = pd.read_csv(path)
    return [{
        "source_file": path.name,
        "source_sheet": "",
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "headers": [str(c).strip() for c in df.columns],
    }]

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", default="-")
    args = ap.parse_args()
    out = []
    for raw in args.inputs:
        path = Path(raw)
        if path.suffix.lower() in {".xlsx", ".xlsm", ".xls"}:
            out.extend(inventory_xlsx(path))
        elif path.suffix.lower() == ".csv":
            out.extend(inventory_csv(path))
        else:
            out.append({"source_file": path.name, "source_sheet": "", "row_count": None, "column_count": None, "headers": [], "note": "unsupported file type"})
    text = json.dumps(out, indent=2)
    if args.out == "-":
        print(text)
    else:
        Path(args.out).write_text(text, encoding="utf-8")
        print(args.out)
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
