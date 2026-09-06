import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve("C:/Users/RHarrity/Documents/Codex/prelicensure_crosswalk_workset_2026-06-11");
const inputPath = path.join(root, "build", "intermediate", "crosswalk_data.json");
const outputPath = path.join(root, "outputs", "prelicensure_qsen_aacn_crosswalk_release_resolved.xlsx");
const qaPath = path.join(root, "prelicensure_crosswalk_resolved_qa.json");
const previewPath = path.join(root, "build", "previews", "summary.png");
const inspectPath = path.join(root, "build", "intermediate", "workbook_inspect.txt");

const requiredSheets = [
  "README",
  "Summary",
  "Provenance",
  "Data_Dictionary",
  "Dim_QSEN_Domain",
  "Dim_KSA",
  "Dim_AACN_Domain",
  "Dim_AACN_Competency",
  "Fact_QSEN_Statements",
  "Bridge_QSEN_AACN",
  "Master_Canonical",
  "Coverage_Summary",
  "Review_Queue",
  "Source_Exclusions",
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
        if (value === undefined) return "";
        if (value === null) return "";
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

const inventory = data.inventory;
const entrySheet = inventory.sheets.find((sheet) => sheet.sheet_name === "Entry Level");
const domainMappedSum = inventory.sheets
  .filter((sheet) => sheet.sheet_name !== "Entry Level")
  .reduce((sum, sheet) => sum + sheet.mapped_cells_pre_split, 0);
const reviewReasonCounts = data.review_queue.reduce((acc, row) => {
  const reason = row.review_reason || "none";
  acc[reason] = (acc[reason] || 0) + 1;
  return acc;
}, {});
const mappingStatusCounts = data.fact_qsen_statements.reduce((acc, row) => {
  const status = row.mapping_status || "unknown";
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

addKeyValueSheet(
  "README",
  [
    { field: "Workbook", value: "Prelicensure QSEN to AACN Crosswalk Release" },
    { field: "Generated", value: data.metadata.generated_at },
    { field: "Source workbook", value: data.metadata.source_path },
    { field: "Source hash", value: data.metadata.source_hash },
    { field: "Canonical source", value: "Entry Level sheet, rows 6+" },
    { field: "Supplemental source use", value: "Official AACN Domain 1 page used only to resolve missing workbook header for competency 1.1." },
    { field: "QA reconciliation", value: data.reconciliation.domain_reconciliation_ok ? "pass" : "fail" },
    { field: "Review policy", value: "Conservative. Ambiguous, malformed, duplicate, or missing-header mappings are flagged." },
    { field: "Source modification", value: "No source files or archives were modified." },
  ],
  "README_Table",
);

addKeyValueSheet(
  "Summary",
  [
    { field: "Source sheets", value: inventory.sheet_count },
    { field: "Entry Level data rows", value: entrySheet.data_rows_from_6 },
    { field: "Entry Level mapped cells before split", value: entrySheet.mapped_cells_pre_split },
    { field: "Domain sheet mapped cell sum", value: domainMappedSum },
    { field: "QSEN domains", value: data.dim_qsen_domain.length },
    { field: "KSA values", value: data.dim_ksa.length },
    { field: "AACN domains", value: data.dim_aacn_domain.length },
    { field: "AACN competencies", value: data.dim_aacn_competency.length },
    { field: "QSEN statement facts", value: data.fact_qsen_statements.length },
    { field: "Bridge rows after splitting", value: data.bridge_qsen_aacn.length },
    { field: "Master canonical rows", value: data.master_canonical.length },
    { field: "Review queue rows", value: data.review_queue.length },
    { field: "Source exclusion rows", value: data.source_exclusions.length },
    { field: "Mapped QSEN facts", value: mappingStatusCounts.mapped || 0 },
    { field: "Mapped QSEN facts needing review", value: mappingStatusCounts.mapped_needs_review || 0 },
    { field: "Source-declared intentionally unmapped facts", value: mappingStatusCounts.intentionally_unmapped_source_declared || 0 },
    { field: "Supplemental sources used", value: data.metadata.supplemental_sources?.length || 0 },
    { field: "No mapping review rows", value: reviewReasonCounts.no_aacn_mapping || 0 },
    { field: "Missing competency header review rows", value: reviewReasonCounts.missing_competency_header || 0 },
    { field: "Malformed code review rows", value: reviewReasonCounts.malformed_subcompetency_code || 0 },
  ],
  "Summary_Table",
);

addSheetTable(
  "Provenance",
  [
    "source_path",
    "source_name",
    "source_hash",
    "source_size_bytes",
    "source_modified",
    "sheet_name",
    "dimension",
    "data_rows_from_6",
    "competency_column_count",
    "mapped_cells_pre_split",
  ],
  inventory.sheets.map((sheet) => ({
    source_path: inventory.source_path,
    source_name: inventory.source_name,
    source_hash: inventory.source_hash,
    source_size_bytes: inventory.source_size_bytes,
    source_modified: inventory.source_modified,
    ...sheet,
  })),
  "Provenance_Table",
);

addSheetTable(
  "Data_Dictionary",
  ["sheet_name", "field_name", "description"],
  [
    { sheet_name: "Dim_QSEN_Domain", field_name: "qsen_domain_id", description: "Stable generated key for a QSEN domain." },
    { sheet_name: "Dim_QSEN_Domain", field_name: "qsen_domain_raw", description: "Exact raw QSEN domain cell including definition text." },
    { sheet_name: "Dim_KSA", field_name: "ksa_id", description: "Stable generated key for Knowledge, Skills, or Attitudes." },
    { sheet_name: "Dim_AACN_Domain", field_name: "aacn_domain_raw", description: "Exact raw AACN domain label from source row 2." },
    { sheet_name: "Dim_AACN_Competency", field_name: "competency_raw", description: "Exact raw AACN competency header from source row 4 when present." },
    { sheet_name: "Dim_AACN_Competency", field_name: "competency_title_source", description: "Where the display competency title came from when workbook header text is missing." },
    { sheet_name: "Fact_QSEN_Statements", field_name: "qsen_statement_raw", description: "Exact QSEN competency statement text from source column C." },
    { sheet_name: "Bridge_QSEN_AACN", field_name: "source_cell_raw", description: "Exact raw source mapping cell before comma-separated codes are split." },
    { sheet_name: "Bridge_QSEN_AACN", field_name: "subcompetency_code", description: "Single mapped AACN subcompetency code after splitting." },
    { sheet_name: "Master_Canonical", field_name: "needs_review", description: "True when the row has a conservative review flag." },
    { sheet_name: "Review_Queue", field_name: "review_reason", description: "Reason a source fact or bridge row requires manual review." },
    { sheet_name: "Source_Exclusions", field_name: "exclusion_reason", description: "Reason a source row was excluded from canonical fact and bridge tables." },
  ],
  "Data_Dictionary_Table",
);

addSheetTable(
  "Dim_QSEN_Domain",
  ["qsen_domain_id", "qsen_domain_name", "qsen_domain_raw"],
  data.dim_qsen_domain,
  "Dim_QSEN_Domain_Table",
);

addSheetTable("Dim_KSA", ["ksa_id", "ksa_name", "ksa_raw"], data.dim_ksa, "Dim_KSA_Table");

addSheetTable(
  "Dim_AACN_Domain",
  ["aacn_domain_id", "aacn_domain_number", "aacn_domain_name", "aacn_domain_raw"],
  data.dim_aacn_domain,
  "Dim_AACN_Domain_Table",
);

addSheetTable(
  "Dim_AACN_Competency",
  [
    "competency_id",
    "competency_name",
    "competency_raw",
    "aacn_domain_id",
    "aacn_domain_number",
    "source_sheet",
    "source_header_cell",
    "competency_title_source",
    "competency_title_source_url",
    "source_header_missing",
    "source_header_missing_resolved",
    "needs_review",
    "review_reason",
  ],
  data.dim_aacn_competency,
  "Dim_AACN_Competency_Table",
);

addSheetTable(
  "Fact_QSEN_Statements",
  [
    "qsen_statement_id",
    "source_workbook",
    "source_sheet",
    "source_row",
    "qsen_domain_id",
    "qsen_domain_name",
    "ksa_id",
    "ksa_raw",
    "qsen_statement_raw",
    "mapping_cell_count_pre_split",
    "bridge_row_count",
    "mapping_status",
    "needs_review",
    "review_reason",
  ],
  data.fact_qsen_statements,
  "Fact_QSEN_Statements_Table",
);

addSheetTable(
  "Bridge_QSEN_AACN",
  [
    "bridge_id",
    "qsen_statement_id",
    "source_workbook",
    "source_sheet",
    "source_row",
    "source_cell",
    "source_cell_raw",
    "aacn_domain_id",
    "aacn_domain_number",
    "aacn_domain_name",
    "competency_id",
    "competency_name",
    "competency_raw",
    "competency_title_source",
    "competency_title_source_url",
    "source_header_missing",
    "source_header_missing_resolved",
    "subcompetency_code",
    "needs_review",
    "review_reason",
  ],
  data.bridge_qsen_aacn,
  "Bridge_QSEN_AACN_Table",
);

addSheetTable(
  "Master_Canonical",
  [
    "qsen_statement_id",
    "qsen_domain_name",
    "ksa",
    "qsen_statement_raw",
    "aacn_domain_number",
    "aacn_domain_name",
    "competency_id",
    "competency_name",
    "subcompetency_code",
    "competency_title_source",
    "competency_title_source_url",
    "source_header_missing",
    "source_header_missing_resolved",
    "source_sheet",
    "source_row",
    "source_cell",
    "source_cell_raw",
    "needs_review",
    "review_reason",
  ],
  data.master_canonical,
  "Master_Canonical_Table",
);

addSheetTable(
  "Coverage_Summary",
  ["coverage_type", "label", "statement_count", "bridge_row_count", "review_count"],
  data.coverage_summary,
  "Coverage_Summary_Table",
);

addSheetTable(
  "Review_Queue",
  [
    "review_id",
    "record_type",
    "qsen_statement_id",
    "bridge_id",
    "source_sheet",
    "source_row",
    "source_cell",
    "review_reason",
    "raw_value",
  ],
  data.review_queue,
  "Review_Queue_Table",
);

addSheetTable(
  "Source_Exclusions",
  ["source_workbook", "source_sheet", "source_row", "source_cell", "exclusion_reason", "raw_value"],
  data.source_exclusions,
  "Source_Exclusions_Table",
);

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
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
  source_file: data.metadata.source_path,
  source_hash: data.metadata.source_hash,
  sheet_count: inventory.sheet_count,
  entry_level_data_rows: entrySheet.data_rows_from_6,
  entry_level_mapped_cells_pre_split: entrySheet.mapped_cells_pre_split,
  domain_sheet_mapped_cells_sum: domainMappedSum,
  fact_qsen_statement_count: data.fact_qsen_statements.length,
  bridge_row_count: data.bridge_qsen_aacn.length,
  master_canonical_row_count: data.master_canonical.length,
  review_queue_count: data.review_queue.length,
  source_exclusion_count: data.source_exclusions.length,
  review_reason_counts: reviewReasonCounts,
  mapping_status_counts: mappingStatusCounts,
  supplemental_sources: data.metadata.supplemental_sources || [],
  reconciliation: data.reconciliation,
  reconciliation_status: Object.values(data.reconciliation).every((value) => value === true || typeof value === "number")
    ? "pass"
    : "fail",
  required_sheets: requiredSheets,
  output_workbook: outputPath,
  output_workbook_exists: outputStat.size > 0,
  output_workbook_size_bytes: outputStat.size,
  summary_preview: previewPath,
  summary_preview_status: previewStatus,
  source_files_modified: false,
};

await fs.writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output_workbook: outputPath,
  qa_manifest: qaPath,
  sheet_count: requiredSheets.length,
  bridge_rows: qa.bridge_row_count,
  review_queue_rows: qa.review_queue_count,
  reconciliation_status: qa.reconciliation_status,
  preview_status: previewStatus,
}, null, 2));
