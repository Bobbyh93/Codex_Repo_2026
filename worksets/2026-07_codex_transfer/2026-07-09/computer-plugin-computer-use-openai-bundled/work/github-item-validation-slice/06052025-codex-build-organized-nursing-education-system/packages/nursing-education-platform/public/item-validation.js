export const ITEM_STATUSES = ["draft", "review", "approved", "retired"];
export const ITEM_FORMATS = ["multiple_choice", "multiple_response", "bowtie", "case_study"];
export const CLINICAL_JUDGMENT_STEPS = ["recognize_cues", "analyze_cues", "prioritize_hypotheses", "generate_solutions", "take_action", "evaluate_outcomes"];

export function buildImportTemplate(blueprint) {
  const category = blueprint[0]?.category || "Management of Care";
  return [
    {
      id: "IMPORT-001",
      status: "review",
      category,
      step: "analyze_cues",
      concepts: ["priority-setting", "clinical-judgment"],
      lesson: "LESSON-IMPORT-001",
      difficulty: 0.2,
      format: "multiple_choice",
      stem: "A nurse reviews assessment findings for a client with a new change in condition. Which finding should the nurse report first?",
      options: [
        { id: "A", text: "The client reports mild incisional discomfort." },
        { id: "B", text: "The client has new shortness of breath at rest." },
        { id: "C", text: "The client asks when family can visit." },
        { id: "D", text: "The client requests help repositioning." },
      ],
      answer: "B",
      scoringRule: "single_best_answer",
      rationale: "New shortness of breath can signal acute deterioration and requires prompt follow-up.",
      correctRationale: "New shortness of breath can signal acute deterioration and requires prompt follow-up.",
      incorrectRationales: {
        A: "Mild incisional discomfort should be assessed, but it is not the priority over respiratory compromise.",
        C: "Visitation questions can be addressed after physiologic priorities.",
        D: "Repositioning can improve comfort, but respiratory compromise takes priority.",
      },
      misconceptionTags: ["priority-setting", "abc-priority"],
      source: "Educator-authored pilot item",
      evidenceReference: "Faculty review required before approved use",
    },
  ];
}

export function validateItemBank(items, blueprint) {
  return validateItems({
    items,
    blueprint,
    existingItems: [],
    mode: "bank",
  });
}

export function validateItemImportPayload(payload, blueprint, existingItems = []) {
  const parsed = parseImportPayload(payload);
  if (!parsed.ok) {
    return buildResult([], [
      issue({
        itemId: "import",
        field: "payload",
        severity: "error",
        message: parsed.message,
      }),
    ]);
  }

  return validateItems({
    items: parsed.items,
    blueprint,
    existingItems,
    mode: "import",
  });
}

function validateItems({ items, blueprint, existingItems, mode }) {
  const issues = [];
  const blueprintCategories = new Set(blueprint.map((entry) => entry.category));
  const existingIds = new Set(existingItems.map((item) => item.id).filter(Boolean));
  const seenIds = new Map();
  const normalizedItems = Array.isArray(items) ? items : [];

  if (!Array.isArray(items)) {
    issues.push(
      issue({
        itemId: mode,
        field: "items",
        severity: "error",
        message: "Import payload must be an array or an object with an items array.",
      }),
    );
    return buildResult([], issues);
  }

  normalizedItems.forEach((item, index) => {
    const itemId = item?.id ? String(item.id) : `row-${index + 1}`;
    issues.push(...validateItem(item, { blueprintCategories, index }));

    if (item?.id) {
      const id = String(item.id);
      if (seenIds.has(id)) {
        issues.push(
          issue({
            itemId,
            field: "id",
            severity: "error",
            message: `Duplicate item ID also appears at row ${seenIds.get(id) + 1}.`,
          }),
        );
      } else {
        seenIds.set(id, index);
      }

      if (mode === "import" && existingIds.has(id)) {
        issues.push(
          issue({
            itemId,
            field: "id",
            severity: "error",
            message: "Item ID already exists in the active item bank.",
          }),
        );
      }
    }
  });

  return buildResult(normalizedItems, issues);
}

function validateItem(item, { blueprintCategories, index }) {
  const itemId = item?.id ? String(item.id) : `row-${index + 1}`;
  const issues = [];

  if (!isObject(item)) {
    return [
      issue({
        itemId,
        field: "item",
        severity: "error",
        message: "Item must be an object.",
      }),
    ];
  }

  requireText(issues, itemId, item.id, "id", "Stable item ID is required.");
  requireAllowed(issues, itemId, item.status, "status", ITEM_STATUSES, "Status must be draft, review, approved, or retired.");
  requireAllowed(issues, itemId, item.category, "category", [...blueprintCategories], "Category must match the NCLEX blueprint.");
  requireAllowed(issues, itemId, item.step, "step", CLINICAL_JUDGMENT_STEPS, "Clinical judgment step is not recognized.");
  requireText(issues, itemId, item.lesson, "lesson", "Linked lesson ID is required.");
  requireText(issues, itemId, item.stem, "stem", "Item stem is required.");
  requireText(issues, itemId, item.rationale, "rationale", "Primary rationale is required.");
  requireText(issues, itemId, item.correctRationale, "correctRationale", "Correct-response rationale is required.");
  requireText(issues, itemId, item.scoringRule, "scoringRule", "Scoring rule is required.");
  requireText(issues, itemId, item.source || item.evidenceReference, "source", "Source or evidence reference is required.");
  requireAllowed(issues, itemId, item.format, "format", ITEM_FORMATS, "Item format is not supported.");

  if (!Array.isArray(item.concepts) || item.concepts.filter(Boolean).length === 0) {
    issues.push(issue({ itemId, field: "concepts", severity: "error", message: "At least one concept tag is required." }));
  }

  if (!Array.isArray(item.misconceptionTags) || item.misconceptionTags.filter(Boolean).length === 0) {
    issues.push(issue({ itemId, field: "misconceptionTags", severity: "warning", message: "Misconception tags improve remediation targeting." }));
  }

  const difficulty = Number(item.difficulty);
  if (!Number.isFinite(difficulty) || difficulty < -3 || difficulty > 3) {
    issues.push(issue({ itemId, field: "difficulty", severity: "error", message: "Difficulty must be a number from -3 to 3." }));
  }

  validateOptions(issues, itemId, item);

  return issues;
}

function validateOptions(issues, itemId, item) {
  if (!Array.isArray(item.options) || item.options.length < 2) {
    issues.push(issue({ itemId, field: "options", severity: "error", message: "At least two answer options are required." }));
    return;
  }

  const optionIds = item.options.map((option) => option?.id).filter(Boolean);
  const uniqueOptionIds = new Set(optionIds);
  if (optionIds.length !== item.options.length || uniqueOptionIds.size !== optionIds.length) {
    issues.push(issue({ itemId, field: "options", severity: "error", message: "Every option needs a unique option ID." }));
  }

  item.options.forEach((option, index) => {
    if (!isObject(option) || !option.id || !String(option.text || "").trim()) {
      issues.push(issue({ itemId, field: `options.${index}`, severity: "error", message: "Each option needs an ID and text." }));
    }
  });

  if (!item.answer || !uniqueOptionIds.has(item.answer)) {
    issues.push(issue({ itemId, field: "answer", severity: "error", message: "Correct answer must match an option ID." }));
  }

  const incorrectOptionIds = optionIds.filter((id) => id !== item.answer);
  const missingIncorrectRationales = incorrectOptionIds.filter((id) => !String(item.incorrectRationales?.[id] || "").trim());
  if (missingIncorrectRationales.length) {
    issues.push(
      issue({
        itemId,
        field: "incorrectRationales",
        severity: "error",
        message: `Missing incorrect-response rationales for ${missingIncorrectRationales.join(", ")}.`,
      }),
    );
  }
}

function parseImportPayload(payload) {
  if (typeof payload === "string") {
    try {
      return parseImportPayload(JSON.parse(payload));
    } catch {
      return { ok: false, message: "Import JSON could not be parsed." };
    }
  }

  if (Array.isArray(payload)) {
    return { ok: true, items: payload };
  }

  if (isObject(payload) && Array.isArray(payload.items)) {
    return { ok: true, items: payload.items };
  }

  return { ok: false, message: "Import payload must be an array or an object with an items array." };
}

function requireText(issues, itemId, value, field, message) {
  if (!String(value || "").trim()) {
    issues.push(issue({ itemId, field, severity: "error", message }));
  }
}

function requireAllowed(issues, itemId, value, field, allowed, message) {
  if (!allowed.includes(value)) {
    issues.push(issue({ itemId, field, severity: "error", message }));
  }
}

function issue({ itemId, field, severity, message }) {
  return { itemId, field, severity, message };
}

function buildResult(items, issues) {
  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");
  const itemIdsWithErrors = new Set(errors.map((entry) => entry.itemId));
  const totalItems = items.length;

  return {
    pass: errors.length === 0,
    totalItems,
    readyItems: Math.max(0, totalItems - itemIdsWithErrors.size),
    issueCount: issues.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues,
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
