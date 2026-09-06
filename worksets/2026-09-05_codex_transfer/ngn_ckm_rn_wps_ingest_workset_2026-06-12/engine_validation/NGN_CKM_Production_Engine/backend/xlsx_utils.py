"""Tiny XLSX/CSV table reader and writer using only the Python standard library.

This avoids making the application startup depend on pandas/openpyxl. It supports
standard .xlsx workbook sheets with shared strings and inline strings, which is
sufficient for TopicMasterClean-style control workbooks.
"""
from __future__ import annotations

import csv
import re
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
NS_DOC_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _col_index(cell_ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_ref.upper())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _text_from_si(si) -> str:
    parts = []
    for node in si.iter():
        if node.tag == NS_MAIN + "t" and node.text:
            parts.append(node.text)
    return "".join(parts)


def _read_shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return [_text_from_si(si) for si in root.findall(NS_MAIN + "si")]


def _sheet_targets(z: zipfile.ZipFile) -> dict[str, str]:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rel_map = {}
    for rel in rels.findall(NS_REL + "Relationship"):
        rid = rel.attrib.get("Id")
        target = rel.attrib.get("Target", "")
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        rel_map[rid] = target
    out = {}
    sheets = wb.find(NS_MAIN + "sheets")
    if sheets is None:
        return out
    for sheet in sheets.findall(NS_MAIN + "sheet"):
        name = sheet.attrib.get("name", "")
        rid = sheet.attrib.get(NS_DOC_REL + "id")
        if name and rid in rel_map:
            out[name] = rel_map[rid]
    return out


def list_sheets(path: str | Path) -> list[str]:
    p = Path(path)
    if p.suffix.lower() == ".csv":
        return [p.stem]
    with zipfile.ZipFile(p) as z:
        return list(_sheet_targets(z).keys())


def read_csv_rows(path: str | Path) -> list[dict[str, Any]]:
    with Path(path).open("r", newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def read_xlsx_sheet(path: str | Path, sheet_name: str | None = None) -> tuple[str, list[dict[str, Any]]]:
    p = Path(path)
    if p.suffix.lower() == ".csv":
        return p.stem, read_csv_rows(p)
    with zipfile.ZipFile(p) as z:
        targets = _sheet_targets(z)
        if not targets:
            return "", []
        selected = sheet_name if sheet_name in targets else next(iter(targets.keys()))
        shared = _read_shared_strings(z)
        root = ET.fromstring(z.read(targets[selected]))
        sheet_data = root.find(NS_MAIN + "sheetData")
        if sheet_data is None:
            return selected, []
        rows_matrix = []
        for row in sheet_data.findall(NS_MAIN + "row"):
            values = []
            for c in row.findall(NS_MAIN + "c"):
                ref = c.attrib.get("r", "A1")
                idx = _col_index(ref)
                while len(values) <= idx:
                    values.append("")
                cell_type = c.attrib.get("t")
                v = c.find(NS_MAIN + "v")
                inline = c.find(NS_MAIN + "is")
                value = ""
                if cell_type == "s" and v is not None and v.text is not None:
                    try:
                        value = shared[int(v.text)]
                    except Exception:
                        value = v.text or ""
                elif cell_type == "inlineStr" and inline is not None:
                    value = _text_from_si(inline)
                elif v is not None and v.text is not None:
                    value = v.text
                values[idx] = value
            rows_matrix.append(values)
        if not rows_matrix:
            return selected, []
        headers = [str(h).strip() for h in rows_matrix[0]]
        data = []
        for raw in rows_matrix[1:]:
            if not any(str(x).strip() for x in raw):
                continue
            row = {headers[i] if i < len(headers) and headers[i] else f"column_{i+1}": (raw[i] if i < len(raw) else "") for i in range(max(len(headers), len(raw)))}
            data.append(row)
        return selected, data


def read_first_matching_sheet(path: str | Path, candidates: list[str], preferred: str | None = None) -> tuple[str, list[dict[str, Any]]]:
    p = Path(path)
    if p.suffix.lower() == ".csv":
        return p.stem, read_csv_rows(p)
    sheets = list_sheets(p)
    if preferred and preferred in sheets:
        return read_xlsx_sheet(p, preferred)
    for c in candidates:
        if c in sheets:
            return read_xlsx_sheet(p, c)
    return read_xlsx_sheet(p, sheets[0] if sheets else None)


def write_csv(path: str | Path, rows: list[dict[str, Any]], fieldnames: list[str] | None = None) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = list(rows[0].keys()) if rows else ["note"]
    with p.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_simple_xlsx(path: str | Path, sheets: dict[str, list[dict[str, Any]]]) -> None:
    """Write a minimal valid XLSX workbook with inline strings."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    content_types = ['<?xml version="1.0" encoding="UTF-8"?>', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">', '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>', '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>']
    for i in range(1, len(sheets) + 1):
        content_types.append(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
    content_types.append('</Types>')
    root_rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    wb_sheets = []
    wb_rels = ['<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    for i, name in enumerate(sheets, start=1):
        wb_sheets.append(f'<sheet name="{_xml_escape(name)}" sheetId="{i}" r:id="rId{i}"/>')
        wb_rels.append(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>')
    wb_rels.append('</Relationships>')
    workbook = '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + ''.join(wb_sheets) + '</sheets></workbook>'
    with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ''.join(content_types))
        z.writestr("_rels/.rels", root_rels)
        z.writestr("xl/workbook.xml", workbook)
        z.writestr("xl/_rels/workbook.xml.rels", ''.join(wb_rels))
        for i, rows in enumerate(sheets.values(), start=1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", _sheet_xml(rows))


def _xml_escape(value: Any) -> str:
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _cell_ref(col: int, row: int) -> str:
    col += 1
    letters = ""
    while col:
        col, rem = divmod(col - 1, 26)
        letters = chr(65 + rem) + letters
    return f"{letters}{row}"


def _sheet_xml(rows: list[dict[str, Any]]) -> str:
    headers = list(rows[0].keys()) if rows else ["note"]
    matrix = [headers] + [[r.get(h, "") for h in headers] for r in rows]
    out = ['<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
    for r_idx, row in enumerate(matrix, start=1):
        out.append(f'<row r="{r_idx}">')
        for c_idx, value in enumerate(row):
            ref = _cell_ref(c_idx, r_idx)
            out.append(f'<c r="{ref}" t="inlineStr"><is><t>{_xml_escape(value)}</t></is></c>')
        out.append('</row>')
    out.append('</sheetData></worksheet>')
    return ''.join(out)
