import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("C:/Users/RHarrity/Documents/Codex/ngn_ckm_rn_wps_ingest_workset_2026-06-12");
const reviewDir = path.join(root, "review_packet");
const inputPath = path.join(reviewDir, "review_packet_rows.json");
const outputPath = path.join(reviewDir, "review_held_ngn_ckm_rows.xlsx");
const inspectPath = path.join(reviewDir, "review_packet_workbook_inspect.txt");
const previewPath = path.join(reviewDir, "review_packet_summary_preview.png");

const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
const workbook = Workbook.create();

function colName(n) {
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function writeTable(sheetName, headers, rows, tableName) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  const values = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ];
  sheet.getRange("A1").writeValues(values);
  sheet.freezePanes.freezeRows(1);
  if (values.length > 1) {
    const table = sheet.tables.add(`A1:${colName(headers.length)}${values.length}`, true, tableName);
    table.showFilterButton = true;
    table.showBandedColumns = false;
  }
  return sheet;
}

writeTable(
  "Summary",
  ["field", "value"],
  [
    { field: "Packet", value: "Review-held NGN/CKM ingest rows" },
    { field: "Held process rows", value: data.summary_rows.length },
    { field: "Held task trace rows", value: data.task_trace_rows.length },
    { field: "Held mapping context rows", value: data.mapping_context_rows.length },
    { field: "Instruction", value: "Use Review_Held_Rows for decisions. Use Task_Trace and Mapping_Context as evidence." },
  ],
  "Summary_Table",
);

writeTable(
  "Review_Held_Rows",
  [
    "module_number",
    "concept",
    "recommended_action",
    "task_count",
    "bridge_count",
    "review_count",
    "confident_count",
    "review_rate",
    "dominant_review_reason",
    "review_reason_counts",
    "top_proposed_qsen_ids",
    "source_anchor",
    "review_decision",
    "reviewer_notes",
  ],
  data.summary_rows,
  "Review_Held_Rows_Table",
);

writeTable(
  "Task_Trace",
  [
    "module_number",
    "concept",
    "recommended_action",
    "wps_task_id",
    "source_file",
    "rapids_code",
    "variant",
    "source_table_index",
    "source_row_index",
    "task_raw",
  ],
  data.task_trace_rows,
  "Task_Trace_Table",
);

writeTable(
  "Mapping_Context",
  [
    "module_number",
    "concept",
    "recommended_action",
    "bridge_id",
    "wps_task_id",
    "source_file",
    "rapids_code",
    "variant",
    "task_raw",
    "proposed_qsen_statement_id",
    "proposed_qsen_domain_name",
    "proposed_ksa_raw",
    "proposed_qsen_statement_raw",
    "match_score",
    "second_best_score",
    "review_reason",
  ],
  data.mapping_context_rows,
  "Mapping_Context_Table",
);

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
  tableMaxRows: 3,
  tableMaxCols: 8,
  tableMaxCellChars: 100,
});
await fs.writeFile(inspectPath, inspect.ndjson ?? String(inspect), "utf8");

let previewStatus = "not_run";
try {
  const preview = await workbook.render({ sheetName: "Summary", autoCrop: "all", scale: 1, format: "png" });
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
  sheet_count: 4,
  preview_status: previewStatus,
}, null, 2));
