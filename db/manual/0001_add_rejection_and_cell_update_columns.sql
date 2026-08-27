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
--
-- YOU MUST CONNECT AS nursestudy_app
--
--   nursestudy_app owns extracted_tables, table_cells and users, and ALTER
--   TABLE requires ownership. The DIRECT_DATABASE_URL above is that role, so
--   the documented path works as-is.
--
--   The neondb_owner connection string -- the one the Neon console offers by
--   default -- does NOT work. It fails on the first statement with:
--
--     ERROR:  must be owner of table extracted_tables
--
--   neondb_owner is a member of nursestudy_app, but the grant is recorded
--   admin_option=true, inherit_option=false, set_option=false: it may
--   administer the role without inheriting or assuming it. So neither plain
--   connection nor SET ROLE gets you there.
--
--   If nursestudy_app is genuinely unreachable (e.g. tooling that can only
--   connect as neondb_owner), grant SET for the duration and then remove it:
--
--     GRANT nursestudy_app TO neondb_owner WITH SET TRUE;
--     -- ... run this migration, with SET LOCAL ROLE nursestudy_app ...
--     REVOKE nursestudy_app FROM neondb_owner GRANTED BY neondb_owner;
--
--   The REVOKE must name GRANTED BY neondb_owner. Undoing it with
--   `GRANT ... WITH SET FALSE` does NOT restore the prior state -- it leaves a
--   second membership row, granted by neondb_owner, carrying
--   inherit_option=true, which silently gives neondb_owner inherited access to
--   everything nursestudy_app owns. Confirm you are back to a single row:
--
--     SELECT a.rolname AS grantor, m.admin_option, m.inherit_option, m.set_option
--     FROM pg_auth_members m
--     JOIN pg_roles r ON r.oid = m.roleid
--     JOIN pg_roles g ON g.oid = m.member
--     JOIN pg_roles a ON a.oid = m.grantor
--     WHERE g.rolname = 'neondb_owner' AND r.rolname = 'nursestudy_app';
--
-- APPLIED
--   Production (Neon project nameless-bird-19392416, branch
--   br-soft-glitter-a647ddi6, database nursestudy) on 2026-08-27, via the
--   temporary-grant path above. Verified afterwards: all three columns present
--   and nullable, the foreign key present exactly once, row counts unchanged,
--   table ownership still nursestudy_app, and the role grant restored to its
--   single original row.

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
