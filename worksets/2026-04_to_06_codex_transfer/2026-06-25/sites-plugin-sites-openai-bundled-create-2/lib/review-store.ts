import {
  auditData,
  reviewPriorities,
  reviewStatuses,
  type ReviewPriorityValue,
  type ReviewStatusValue,
} from "./audit-data";

export type ReviewItemType = "concept" | "resource";

export type ReviewItemRow = {
  id: string;
  item_type: ReviewItemType;
  title: string;
  source_status: string;
  status: ReviewStatusValue;
  assignee: string;
  notes: string;
  priority: ReviewPriorityValue;
  updated_by: string | null;
  updated_at: string;
};

export type ReviewUpdatePayload = {
  status?: ReviewStatusValue;
  assignee?: string;
  notes?: string;
  priority?: ReviewPriorityValue;
};

const seededAt = auditData.generatedAt;
const memoryKey = "__pearsonAuditReviewItems";

type WorkersModule = {
  env?: {
    DB?: D1Database;
  };
};

async function getDb() {
  try {
    const workers = (await import("cloudflare:workers")) as WorkersModule;
    return workers.env?.DB ?? null;
  } catch {
    return null;
  }
}

function reviewTargets() {
  const conceptTargets = auditData.concepts.map((concept) => ({
    id: concept.id,
    itemType: "concept" as const,
    title: concept.concept,
    sourceStatus: concept.sourceStatus,
    priority: concept.priority,
  }));

  const resourceTargets = auditData.courseResources.map((resource) => ({
    id: resource.id,
    itemType: "resource" as const,
    title: resource.title,
    sourceStatus: `${resource.extension} / ${resource.category}`,
    priority: resource.priority,
  }));

  return [...conceptTargets, ...resourceTargets];
}

export function getAuthenticatedEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim() || null;
}

function getMemoryRows() {
  const globalStore = globalThis as typeof globalThis & {
    [memoryKey]?: ReviewItemRow[];
  };

  if (!globalStore[memoryKey]) {
    globalStore[memoryKey] = reviewTargets().map((target) => ({
      id: target.id,
      item_type: target.itemType,
      title: target.title,
      source_status: target.sourceStatus,
      status: "unreviewed",
      assignee: "",
      notes: "",
      priority: target.priority,
      updated_by: null,
      updated_at: seededAt,
    }));
  }

  return globalStore[memoryKey];
}

export async function ensureReviewStore() {
  const db = await getDb();

  if (!db) {
    getMemoryRows();
    return;
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS review_items (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        title TEXT NOT NULL,
        source_status TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unreviewed',
        assignee TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium',
        updated_by TEXT,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS review_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL,
        previous_status TEXT,
        status TEXT NOT NULL,
        assignee TEXT,
        notes TEXT,
        priority TEXT,
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS review_events_item_id_idx ON review_events (item_id)",
    )
    .run();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO review_items
      (id, item_type, title, source_status, status, assignee, notes, priority, updated_by, updated_at)
      VALUES (?, ?, ?, ?, 'unreviewed', '', '', ?, NULL, ?)`,
  );

  const statements = reviewTargets().map((target) =>
    insert.bind(
      target.id,
      target.itemType,
      target.title,
      target.sourceStatus,
      target.priority,
      seededAt,
    ),
  );

  if (statements.length) {
    await db.batch(statements);
  }
}

export async function listReviewItems() {
  await ensureReviewStore();
  const db = await getDb();

  if (!db) {
    return [...getMemoryRows()].sort((a, b) =>
      `${a.item_type}:${a.title}`.localeCompare(`${b.item_type}:${b.title}`),
    );
  }

  const result = await db
    .prepare("SELECT * FROM review_items ORDER BY item_type, title")
    .all();

  return (result.results ?? []) as ReviewItemRow[];
}

export async function getReviewItem(id: string) {
  await ensureReviewStore();
  const db = await getDb();

  if (!db) {
    return getMemoryRows().find((item) => item.id === id) ?? null;
  }

  const row = await db
    .prepare("SELECT * FROM review_items WHERE id = ?")
    .bind(id)
    .first();

  return row as ReviewItemRow | null;
}

export async function updateReviewItem(
  id: string,
  payload: ReviewUpdatePayload,
  updatedBy: string,
) {
  const existing = await getReviewItem(id);

  if (!existing) {
    return null;
  }

  const nextStatus = payload.status ?? existing.status;
  const nextPriority = payload.priority ?? existing.priority;

  if (!reviewStatuses.includes(nextStatus)) {
    throw new Error("Invalid review status.");
  }

  if (!reviewPriorities.includes(nextPriority)) {
    throw new Error("Invalid review priority.");
  }

  const nextAssignee =
    payload.assignee === undefined ? existing.assignee : payload.assignee.trim();
  const nextNotes =
    payload.notes === undefined ? existing.notes : payload.notes.trim();
  const updatedAt = new Date().toISOString();
  const db = await getDb();

  if (!db) {
    const rows = getMemoryRows();
    const index = rows.findIndex((item) => item.id === id);
    rows[index] = {
      ...existing,
      status: nextStatus,
      assignee: nextAssignee,
      notes: nextNotes,
      priority: nextPriority,
      updated_by: updatedBy,
      updated_at: updatedAt,
    };
    return rows[index];
  }

  await db.batch([
    db
      .prepare(
        `UPDATE review_items
          SET status = ?, assignee = ?, notes = ?, priority = ?, updated_by = ?, updated_at = ?
          WHERE id = ?`,
      )
      .bind(
        nextStatus,
        nextAssignee,
        nextNotes,
        nextPriority,
        updatedBy,
        updatedAt,
        id,
      ),
    db
      .prepare(
        `INSERT INTO review_events
          (item_id, previous_status, status, assignee, notes, priority, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        existing.status,
        nextStatus,
        nextAssignee,
        nextNotes,
        nextPriority,
        updatedBy,
        updatedAt,
      ),
  ]);

  return getReviewItem(id);
}

export async function getAuditPayload(request: Request) {
  const reviewItems = await listReviewItems();
  const counts = reviewItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ...auditData,
    currentUser: getAuthenticatedEmail(request),
    reviewItems,
    reviewCounts: counts,
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function buildReviewCsv() {
  const rows = await listReviewItems();
  const header = [
    "id",
    "item_type",
    "title",
    "source_status",
    "review_status",
    "priority",
    "assignee",
    "notes",
    "updated_by",
    "updated_at",
  ];

  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.item_type,
        row.title,
        row.source_status,
        row.status,
        row.priority,
        row.assignee,
        row.notes,
        row.updated_by,
        row.updated_at,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return lines.join("\r\n");
}
