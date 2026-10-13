import assert from "node:assert/strict";

import { blueprint, items } from "../public/data.js";
import { buildImportTemplate, validateItemBank, validateItemImportPayload } from "../public/item-validation.js";

const bankValidation = validateItemBank(items, blueprint);
assert.equal(bankValidation.pass, true);
assert.equal(bankValidation.totalItems, items.length);
assert.equal(bankValidation.errorCount, 0);

const importTemplate = buildImportTemplate(blueprint);
const validImport = validateItemImportPayload(JSON.stringify(importTemplate), blueprint, items);
assert.equal(validImport.pass, true);
assert.equal(validImport.readyItems, 1);

const duplicateImport = validateItemImportPayload([{ ...importTemplate[0], id: "ITEM-001" }], blueprint, items);
assert.equal(duplicateImport.pass, false);
assert.equal(duplicateImport.issues.some((entry) => entry.field === "id" && entry.message.includes("already exists")), true);

const invalidJson = validateItemImportPayload("{not json", blueprint, items);
assert.equal(invalidJson.pass, false);
assert.equal(invalidJson.issues[0].field, "payload");

const incompleteItem = {
  ...importTemplate[0],
  id: "IMPORT-BAD",
  category: "Not A Blueprint Category",
  answer: "Z",
  source: "",
  evidenceReference: "",
  incorrectRationales: {},
};
const incompleteValidation = validateItemImportPayload([incompleteItem], blueprint, items);
assert.equal(incompleteValidation.pass, false);
assert.equal(incompleteValidation.issues.some((entry) => entry.field === "category"), true);
assert.equal(incompleteValidation.issues.some((entry) => entry.field === "answer"), true);
assert.equal(incompleteValidation.issues.some((entry) => entry.field === "source"), true);
assert.equal(incompleteValidation.issues.some((entry) => entry.field === "incorrectRationales"), true);

const duplicateWithinPayload = validateItemImportPayload([importTemplate[0], { ...importTemplate[0] }], blueprint, []);
assert.equal(duplicateWithinPayload.pass, false);
assert.equal(duplicateWithinPayload.issues.some((entry) => entry.message.includes("Duplicate item ID")), true);

console.log("CAT item validation tests passed");
