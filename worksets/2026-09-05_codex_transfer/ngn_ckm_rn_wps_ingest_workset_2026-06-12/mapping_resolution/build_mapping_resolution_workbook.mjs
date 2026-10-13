import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("C:/Users/RHarrity/Documents/Codex/ngn_ckm_rn_wps_ingest_workset_2026-06-12/mapping_resolution");
const inputPath = path.join(root, "mapping_resolution_rows.json");
const outputPath = path.join(root, "wps_process_mapping_resolution_draft.xlsx");
const inspectPath = path.join(root, "mapping_resolution_workbook_inspect.txt");
const previewPath = path.join(root, "mapping_resolution_summary_preview.png");

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
  "README",
  ["field", "value"],
  [
    { field: "Purpose", value: "Process-first RN WPS to QSEN/AACN mapping resolution draft." },
    { field: "Use", value: "Review Process_Resolution first; use Task_Evidence and QSEN_Candidate_Index as support." },
    { field: "Rule", value: "AI suggestions are draft-only until human reviewer approval." },
    { field: "Source safety", value: "Source files were read-only inputs and are not modified by this workbook." },
  ],
  "README_Table",
);

writeTable("Summary", ["field", "value"], data.summary_rows, "Summary_Table");

writeTable(
  "Excluded_Metadata",
  ["concept", "exclusion_reason", "task_count", "source_tables", "notes"],
  data.excluded_rows,
  "Excluded_Metadata_Table",
);

writeTable(
  "Process_Resolution",
  [
    "module_number",
    "concept",
    "task_count",
    "unique_task_count",
    "review_count",
    "ai_mapping_status",
    "ai_top_qsen_statement_id",
    "ai_top_aacn_subcompetency_codes",
    "ai_confidence",
    "ai_rationale",
    "ai_alternate_qsen_statement_ids",
    "ai_review_notes",
    "ai_validation_errors",
    "local_top_candidate_qsen_id",
    "local_top_candidate_score",
    "review_decision",
    "reviewer_notes",
    "final_qsen_statement_id",
    "final_aacn_subcompetency_codes",
    "source_anchor",
  ],
  data.process_rows,
  "Process_Resolution_Table",
);

writeTable(
  "Task_Evidence",
  [
    "module_number",
    "concept",
    "wps_task_id",
    "source_file",
    "rapids_code",
    "variant",
    "source_table_index",
    "source_row_index",
    "task_raw",
  ],
  data.task_rows,
  "Task_Evidence_Table",
);

writeTable(
  "QSEN_Candidate_Index",
  [
    "module_number",
    "concept",
    "candidate_rank",
    "candidate_score",
    "qsen_statement_id",
    "qsen_domain_name",
    "ksa_raw",
    "qsen_statement_raw",
    "aacn_subcompetency_codes",
  ],
  data.candidate_rows,
  "QSEN_Candidate_Index_Table",
);

writeTable(
  "QA",
  ["field", "value"],
  [
    { field: "Workbook created", value: new Date().toISOString() },
    { field: "Required sheets present", value: "README; Summary; Excluded_Metadata; Process_Resolution; Task_Evidence; QSEN_Candidate_Index; QA" },
    { field: "Draft rows", value: data.process_rows.length },
    { field: "Excluded metadata rows", value: data.excluded_rows.length },
    { field: "Task evidence rows", value: data.task_rows.length },
    { field: "Candidate rows", value: data.candidate_rows.length },
  ],
  "QA_Table",
);

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 10000,
  tableMaxRows: 3,
  tableMaxCols: 8,
  tableMaxCellChars: 120,
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
  sheet_count: 7,
  preview_status: previewStatus,
}, null, 2));
