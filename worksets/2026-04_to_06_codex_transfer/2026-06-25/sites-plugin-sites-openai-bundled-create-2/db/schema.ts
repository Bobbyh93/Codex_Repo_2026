import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reviewItems = sqliteTable("review_items", {
  id: text("id").primaryKey(),
  itemType: text("item_type").notNull(),
  title: text("title").notNull(),
  sourceStatus: text("source_status").notNull(),
  status: text("status").notNull().default("unreviewed"),
  assignee: text("assignee").notNull().default(""),
  notes: text("notes").notNull().default(""),
  priority: text("priority").notNull().default("medium"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull(),
});

export const reviewEvents = sqliteTable(
  "review_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: text("item_id").notNull(),
    previousStatus: text("previous_status"),
    status: text("status").notNull(),
    assignee: text("assignee"),
    notes: text("notes"),
    priority: text("priority"),
    updatedBy: text("updated_by").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("review_events_item_id_idx").on(table.itemId)],
);
