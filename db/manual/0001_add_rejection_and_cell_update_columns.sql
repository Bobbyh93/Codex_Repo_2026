-- Manual migration 0001
-- Adds the three columns that server/admin-routes.ts already references but
-- that shared/schema.ts was missing:
--
--   extracted_tables.rejected_by   -- who rejected an extracted table
--   extracted_tables.rejected_at   -- when it was rejected
--   table_cells.updated_at         -- when a cell was last hand-edited
--
-- WHY THIS IS HAND-WRITTEN INSTEAD OF `npm run db:push`
--
-- drizzle.config.ts sets `schema: "./shared/schema.ts"` (88 tables), but this
-- database also contains tables defined in shared/crosswalk-schema.ts (9),
-- shared/simplified-schema.ts (6) and shared/topics-schema.ts (12), which the
-- app queries at runtime. drizzle-kit push treats any table absent from its
-- configured schema as an orphan and proposes DROP TABLE for it, so running
-- `db:push` against real data would offer to drop live tables.
--
-- Pointing the config at all four files is not a fix either: 7 table names
-- (users, assessment_reports, study_plans, study_plan_items, topic_performance,
-- topic_content, topic_relationships) are defined in more than one of them with
-- differing columns.
--
-- This migration therefore does the additive work directly. It contains no
-- DROP, no TRUNCATE, and no type changes. All three columns are nullable, so
-- existing rows are unaffected and no backfill is required.
--
-- Safe to run more than once: every statement is guarded.
--
-- HOW TO RUN
--   Use the DIRECT (non-pooled) Neon connection string, per
--   LIVE_DEPLOYMENT_STATUS.md -- pooled is for the app's runtime DATABASE_URL.
--
--     psql "$DIRECT_DATABASE_URL" -f db/manual/0001_add_rejection_and_cell_update_columns.sql
--
--   Verify afterwards with the query at the bottom of this file.

BEGIN;

ALTER TABLE extracted_tables ADD COLUMN IF NOT EXISTS rejected_by varchar;
ALTER TABLE extracted_tables ADD COLUMN IF NOT EXISTS rejected_at timestamp;

ALTER TABLE table_cells ADD COLUMN IF NOT EXISTS updated_at timestamp;

-- Mirrors the existing approved_by foreign key. Guarded so re-running is a
-- no-op; ADD CONSTRAINT has no IF NOT EXISTS form in PostgreSQL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'extracted_tables_rejected_by_users_id_fk'
  ) THEN
    ALTER TABLE extracted_tables
      ADD CONSTRAINT extracted_tables_rejected_by_users_id_fk
      FOREIGN KEY (rejected_by) REFERENCES users(id);
  END IF;
END $$;

COMMIT;

-- Verification -- expects exactly 3 rows:
--
--   SELECT table_name, column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE (table_name = 'extracted_tables' AND column_name IN ('rejected_by','rejected_at'))
--      OR (table_name = 'table_cells'      AND column_name = 'updated_at')
--   ORDER BY table_name, column_name;
