import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("C:/Users/RHarrity/Documents/Codex/ngn_ckm_rn_wps_ingest_workset_2026-06-12");
const rowsPath = path.join(root, "support", "lesson_ingest_queue_rows.json");
const outputPath = path.join(root, "source_tables", "rn_wps_process_lesson_ingest_queue.xlsx");
const inspectPath = path.join(root, "support", "ingest_workbook_inspect.txt");
const previewPath = path.join(root, "support", "ingest_summary_preview.png");

const input = JSON.parse(await fs.readFile(rowsPath, "utf8"));
const workbook = Workbook.create();
const sheet = workbook.worksheets.add(input.sheet_name);
sheet.showGridLines = false;

const headers = input.headers;
const rows = input.rows;

function colName(n) {
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const values = [
  headers,
  ...rows.map((row) => headers.map((header) => row[header] ?? "")),
];
sheet.getRange("A1").writeValues(values);
sheet.freezePanes.freezeRows(1);
const range = `A1:${colName(headers.length)}${values.length}`;
const table = sheet.tables.add(range, true, "Lesson_Ingest_Queue_Table");
table.showFilterButton = true;
table.showBandedColumns = false;

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 6000,
  tableMaxRows: 5,
  tableMaxCols: 12,
  tableMaxCellChars: 120,
});
await fs.writeFile(inspectPath, inspect.ndjson ?? String(inspect), "utf8");

let previewStatus = "not_run";
try {
  const preview = await workbook.render({ sheetName: input.sheet_name, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  previewStatus = "success";
} catch (error) {
  previewStatus = `failed: ${error.message}`;
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
const stat = await fs.stat(outputPath);

console.log(JSON.stringify({
  output_workbook: outputPath,
  output_workbook_size_bytes: stat.size,
  sheet_name: input.sheet_name,
  row_count: rows.length,
  header_count: headers.length,
  preview_status: previewStatus,
}, null, 2));
