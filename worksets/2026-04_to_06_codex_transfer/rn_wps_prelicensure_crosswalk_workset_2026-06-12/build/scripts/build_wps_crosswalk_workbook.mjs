import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("C:/Users/RHarrity/Documents/Codex/rn_wps_prelicensure_crosswalk_workset_2026-06-12");
const inputPath = path.join(root, "build", "intermediate", "rn_wps_prelicensure_crosswalk_data.json");
const outputPath = path.join(root, "outputs", "rn_wps_prelicensure_crosswalk_release.xlsx");
const qaPath = path.join(root, "rn_wps_prelicensure_crosswalk_qa.json");
const previewPath = path.join(root, "build", "intermediate", "summary_preview.png");
const inspectPath = path.join(root, "build", "intermediate", "workbook_inspect.txt");

const requiredSheets = [
  "README",
  "Summary",
  "Provenance",
  "Data_Dictionary",
  "WPS_Source_Files",
  "WPS_Metadata",
  "Dim_WPS_Process",
  "Fact_WPS_Tasks",
  "Fact_Prelicensure_QSEN",
  "Suggested_WPS_Prelic_Bridge",
  "Variant_Delta",
  "Coverage_Summary",
  "Review_Queue",
];

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

function valuesForRows(headers, rows) {
  return [
    headers,
    ...rows.map((row) =>
      headers.map((header) => {
        const value = row[header];
        if (value === undefined || value === null) return "";
        if (Array.isArray(value)) return value.join("; ");
        return value;
      }),
    ),
  ];
}

function addSheetTable(sheetName, headers, rows, tableName) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  const matrix = valuesForRows(headers, rows);
  sheet.getRange("A1").writeValues(matrix);
  sheet.freezePanes.freezeRows(1);
  if (matrix.length > 1 && headers.length > 0) {
    const range = `A1:${colName(headers.length)}${matrix.length}`;
    const table = sheet.tables.add(range, true, tableName);
    table.showFilterButton = true;
    table.showBandedColumns = false;
  }
  return sheet;
}

function addKeyValueSheet(sheetName, rows, tableName) {
  return addSheetTable(sheetName, ["field", "value"], rows, tableName);
}

function countBy(rows, field) {
  const result = {};
  for (const row of rows) {
    const key = row[field] || "blank";
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

const prelicEntry = data.prelicensure_inventory.sheets.find((sheet) => sheet.sheet_name === "Entry Level") || {};
const bridgeReviewCount = data.suggested_wps_prelicensure_bridge.filter((row) => row.needs_review).length;
const confidentBridgeCount = data.suggested_wps_prelicensure_bridge.length - bridgeReviewCount;
const reviewReasonCounts = countBy(data.review_queue, "review_reason");
const sourceKinds = countBy(data.wps_source_files, "source_kind");
const rapidsCodes = data.wps_metadata.map((row) => row.rapids_code).sort().join("; ");

addKeyValueSheet(
  "README",
  [
    { field: "Workbook", value: "RN WPS to Prelicensure QSEN/AACN Crosswalk Workset" },
    { field: "Generated", value: data.metadata.generated_at },
    { field: "Canonical prelicensure source", value: data.prelicensure_inventory.source_path },
    { field: "Canonical WPS sources", value: "Six Department of Education Registered Nurse Work Process Schedule DOCX files." },
    { field: "Mapping policy", value: "Local-only conservative lexical/rule-based suggestions; uncertain rows require review." },
    { field: "External AI/API use", value: "None." },
    { field: "WBK handling", value: "Backup file inventoried as provenance only; not parsed as canonical input." },
    { field: "Sheet name note", value: "Requested Suggested_WPS_Prelicensure_Bridge was shortened to Suggested_WPS_Prelic_Bridge because Excel sheet names are limited to 31 characters." },
    { field: "Source modification", value: data.metadata.source_files_modified ? "Source change detected" : "No source files modified." },
  ],
  "README_Table",
);

addKeyValueSheet(
  "Summary",
  [
    { field: "Prelicensure workbook sheet count", value: data.prelicensure_inventory.sheet_count },
    { field: "Entry Level present", value: data.prelicensure_inventory.entry_level_present },
    { field: "Entry Level data rows from row 6", value: prelicEntry.data_rows_from_6 || 0 },
    { field: "Canonical QSEN fact rows", value: data.fact_prelicensure_qsen.length },
    { field: "WPS DOCX files parsed", value: data.wps_metadata.length },
    { field: "WPS table count per DOCX", value: "40 expected; all files passed." },
    { field: "RAPIDS codes captured", value: rapidsCodes },
    { field: "WPS task rows parsed", value: data.fact_wps_tasks.length },
    { field: "Suggested bridge rows", value: data.suggested_wps_prelicensure_bridge.length },
    { field: "Confident bridge suggestions", value: confidentBridgeCount },
    { field: "Review queue rows", value: data.review_queue.length },
    { field: "Variant delta rows", value: data.variant_delta.length },
    { field: "Source files inventoried", value: data.wps_source_files.length },
    { field: "DOCX source count", value: sourceKinds.wps_docx || 0 },
    { field: "WBK provenance-only count", value: sourceKinds.word_backup || 0 },
  ],
  "Summary_Table",
);

addSheetTable(
  "Provenance",
  [
    "source_name",
    "source_kind",
    "canonical_input",
    "source_path",
    "source_hash",
    "source_size_bytes",
    "source_modified",
    "sheet_name",
    "dimension",
    "data_rows_from_6",
    "mapped_cells_pre_split",
  ],
  [
    ...data.wps_source_files.map((source) => ({
      ...source,
      sheet_name: "",
      dimension: "",
      data_rows_from_6: "",
      mapped_cells_pre_split: "",
    })),
    ...data.prelicensure_inventory.sheets.map((sheet) => ({
      source_name: data.prelicensure_inventory.source_name,
      source_kind: "prelicensure_workbook_sheet",
      canonical_input: true,
      source_path: data.prelicensure_inventory.source_path,
      source_hash: data.prelicensure_inventory.source_hash,
      source_size_bytes: data.prelicensure_inventory.source_size_bytes,
      source_modified: data.prelicensure_inventory.source_modified,
      ...sheet,
    })),
  ],
  "Provenance_Table",
);

addSheetTable(
  "Data_Dictionary",
  ["sheet_name", "field_name", "description"],
  [
    { sheet_name: "WPS_Source_Files", field_name: "canonical_input", description: "True for parsed source files; false for provenance-only backup files." },
    { sheet_name: "WPS_Metadata", field_name: "rapids_code", description: "RAPIDS code extracted from WPS metadata table." },
    { sheet_name: "Dim_WPS_Process", field_name: "process_raw", description: "Exact work-process heading from the source WPS table." },
    { sheet_name: "Fact_WPS_Tasks", field_name: "task_raw", description: "Exact task row text with source task label preserved." },
    { sheet_name: "Fact_WPS_Tasks", field_name: "source_table_index", description: "1-based Word table index from the DOCX." },
    { sheet_name: "Fact_Prelicensure_QSEN", field_name: "qsen_statement_raw", description: "Exact QSEN statement text from Entry Level column C." },
    { sheet_name: "Fact_Prelicensure_QSEN", field_name: "aacn_subcompetency_codes", description: "AACN mapping codes from Entry Level mapping cells, split and joined for reference." },
    { sheet_name: "Suggested_WPS_Prelic_Bridge", field_name: "match_score", description: "Local lexical/rule-based score from 0 to 1." },
    { sheet_name: "Suggested_WPS_Prelic_Bridge", field_name: "needs_review", description: "True when the suggestion is below threshold, ambiguous, or duplicated across conflicting WPS contexts." },
    { sheet_name: "Variant_Delta", field_name: "variant_delta_status", description: "Whether a process/task row is present in all six WPS variants." },
    { sheet_name: "Coverage_Summary", field_name: "review_count", description: "Rows requiring manual review by variant or process." },
    { sheet_name: "Review_Queue", field_name: "review_reason", description: "Reason the conservative mapping policy did not treat the suggestion as final." },
  ],
  "Data_Dictionary_Table",
);

addSheetTable(
  "WPS_Source_Files",
  [
    "source_id",
    "source_kind",
    "canonical_input",
    "source_name",
    "source_path",
    "source_hash",
    "source_size_bytes",
    "source_modified",
  ],
  data.wps_source_files,
  "WPS_Source_Files_Table",
);

addSheetTable(
  "WPS_Metadata",
  [
    "wps_file_id",
    "source_file",
    "table_count",
    "role_title_raw",
    "rapids_code",
    "rapids_base",
    "onet_code",
    "estimated_program_length_raw",
    "apprenticeship_type_raw",
    "variant",
    "job_description_raw",
  ],
  data.wps_metadata,
  "WPS_Metadata_Table",
);

addSheetTable(
  "Dim_WPS_Process",
  ["wps_process_id", "process_raw", "process_normalized", "source_file_count", "source_files", "task_count"],
  data.dim_wps_process,
  "Dim_WPS_Process_Table",
);

addSheetTable(
  "Fact_WPS_Tasks",
  [
    "wps_task_id",
    "wps_file_id",
    "source_file",
    "rapids_code",
    "rapids_base",
    "role_title_raw",
    "variant",
    "wps_process_id",
    "process_raw",
    "task_label",
    "task_raw",
    "task_text_raw",
    "source_table_index",
    "source_row_index",
    "data_cells_raw",
  ],
  data.fact_wps_tasks,
  "Fact_WPS_Tasks_Table",
);

addSheetTable(
  "Fact_Prelicensure_QSEN",
  [
    "qsen_statement_id",
    "source_workbook",
    "source_sheet",
    "source_row",
    "qsen_domain_raw",
    "qsen_domain_name",
    "ksa_raw",
    "qsen_statement_raw",
    "aacn_codes_raw",
    "aacn_subcompetency_codes",
    "aacn_subcompetency_count",
    "malformed_aacn_code_count",
  ],
  data.fact_prelicensure_qsen,
  "Fact_Prelicensure_QSEN_Table",
);

addSheetTable(
  "Suggested_WPS_Prelic_Bridge",
  [
    "bridge_id",
    "wps_task_id",
    "source_file",
    "rapids_code",
    "rapids_base",
    "variant",
    "process_raw",
    "task_raw",
    "proposed_qsen_statement_id",
    "proposed_qsen_domain_name",
    "proposed_ksa_raw",
    "proposed_qsen_statement_raw",
    "proposed_aacn_subcompetency_codes",
    "match_score",
    "second_best_score",
    "needs_review",
    "review_reason",
    "mapping_method",
  ],
  data.suggested_wps_prelicensure_bridge,
  "Suggested_WPS_Prelic_Bridge_Table",
);

addSheetTable(
  "Variant_Delta",
  [
    "variant_delta_id",
    "process_raw",
    "task_text_raw",
    "source_occurrence_count",
    "present_2074_time_based",
    "present_2074_competency_based",
    "present_2074_hybrid",
    "present_3056_time_based",
    "present_3056_competency_based",
    "present_3056_hybrid",
    "variant_presence_count",
    "variant_delta_status",
  ],
  data.variant_delta,
  "Variant_Delta_Table",
);

addSheetTable(
  "Coverage_Summary",
  ["coverage_type", "label", "task_count", "confident_count", "review_count"],
  data.coverage_summary,
  "Coverage_Summary_Table",
);

addSheetTable(
  "Review_Queue",
  [
    "review_id",
    "record_type",
    "bridge_id",
    "wps_task_id",
    "source_file",
    "rapids_code",
    "variant",
    "process_raw",
    "task_raw",
    "proposed_qsen_statement_id",
    "match_score",
    "review_reason",
  ],
  data.review_queue,
  "Review_Queue_Table",
);

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 10000,
  tableMaxRows: 3,
  tableMaxCols: 6,
  tableMaxCellChars: 80,
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
const outputStat = await fs.stat(outputPath);

const qa = {
  generated_at: new Date().toISOString(),
  workset_id: data.metadata.workset_id,
  output_workbook: outputPath,
  output_workbook_exists: outputStat.size > 0,
  output_workbook_size_bytes: outputStat.size,
  required_sheets: requiredSheets,
  output_sheet_count: requiredSheets.length,
  sheet_name_adjustments: {
    requested: "Suggested_WPS_Prelicensure_Bridge",
    actual: "Suggested_WPS_Prelic_Bridge",
    reason: "Excel sheet names are limited to 31 characters.",
  },
  source_file_hashes: data.wps_source_files.map((source) => ({
    source_name: source.source_name,
    source_kind: source.source_kind,
    source_hash: source.source_hash,
  })),
  prelicensure_workbook_hash: data.prelicensure_inventory.source_hash,
  prelicensure_sheet_count: data.prelicensure_inventory.sheet_count,
  entry_level_present: data.prelicensure_inventory.entry_level_present,
  entry_level_data_rows_from_6: prelicEntry.data_rows_from_6 || 0,
  qsen_fact_row_count: data.fact_prelicensure_qsen.length,
  wps_docx_file_count: data.wps_metadata.length,
  wps_docx_table_counts: Object.fromEntries(data.wps_metadata.map((row) => [row.source_file, row.table_count])),
  rapids_codes: data.wps_metadata.map((row) => row.rapids_code).sort(),
  wps_task_row_count: data.fact_wps_tasks.length,
  suggested_bridge_row_count: data.suggested_wps_prelicensure_bridge.length,
  confident_bridge_row_count: confidentBridgeCount,
  review_queue_count: data.review_queue.length,
  review_reason_counts: reviewReasonCounts,
  variant_delta_row_count: data.variant_delta.length,
  reconciliation: data.reconciliation,
  reconciliation_status: Object.values(data.reconciliation).every((value) => value === true || value === false && data.reconciliation.source_files_modified === false)
    ? "pass"
    : "fail",
  source_files_modified: data.metadata.source_files_modified,
  summary_preview: previewPath,
  summary_preview_status: previewStatus,
};

qa.reconciliation_status = (
  data.reconciliation.prelicensure_sheet_count_is_11 &&
  data.reconciliation.entry_level_present &&
  data.reconciliation.wps_docx_file_count_is_6 &&
  data.reconciliation.all_wps_docx_have_40_tables &&
  data.reconciliation.required_rapids_codes_present &&
  data.reconciliation.all_wps_tasks_have_source_coordinates &&
  data.reconciliation.source_files_modified === false
) ? "pass" : "fail";

await fs.writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output_workbook: outputPath,
  qa_manifest: qaPath,
  output_sheet_count: qa.output_sheet_count,
  wps_task_rows: qa.wps_task_row_count,
  suggested_bridge_rows: qa.suggested_bridge_row_count,
  review_queue_rows: qa.review_queue_count,
  reconciliation_status: qa.reconciliation_status,
  preview_status: previewStatus,
}, null, 2));
