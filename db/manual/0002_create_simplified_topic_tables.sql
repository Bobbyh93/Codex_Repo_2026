-- Manual migration 0002
-- Creates the three tables shared/simplified-schema.ts defines and that the
-- application already queries, but which have never existed in this database:
--
--   review_topics      -- the topic list the ATI seeder populates
--   topic_content      -- content blocks mapped to a review topic
--   study_resources    -- study materials mapped to a review topic
--
-- WHY THIS IS NEEDED
--
-- seedATIExcelTopics() runs on every startup (server/index.ts) and does
-- `db.select(...).from(reviewTopics)`. Because review_topics does not exist,
-- it has thrown on every boot, swallowed by a `.catch` that logs
-- "Assessment topic seeding failed (non-critical):". Confirmed in Render logs
-- at 2026-09-06 04:07:45, 04:17:56, 04:59:38 and 05:02:28.
--
-- The cause was invisible because server/logger.ts's console format printed
-- only `message` and dropped the error metadata. That is fixed in the same
-- change as this migration.
--
-- Six live HTTP routes depend on these tables and have been failing too:
--   POST /api/admin/extract-ati-topics     GET /api/admin/topic-extraction-stats
--   POST /api/admin/parse-reference-book   GET /api/admin/reference-book-stats
--   POST /api/export/content               GET /api/export/options
--
-- WHY HAND-WRITTEN RATHER THAN db:push
--
-- Same reason as 0001. drizzle.config.ts cannot list simplified-schema.ts
-- while that file also redefines topic_performance, study_plans and
-- study_plan_items, which shared/schema.ts owns and which exist here with
-- different columns. See the comment block in drizzle.config.ts.
--
-- Column definitions are transcribed from shared/simplified-schema.ts. Types
-- follow drizzle's mapping: varchar -> varchar, text -> text, integer ->
-- integer, decimal(p,s) -> numeric(p,s), jsonb -> jsonb, boolean -> boolean,
-- timestamp -> timestamp (no time zone).
--
-- Contains no DROP, no TRUNCATE and no type changes. Safe to run more than
-- once: every statement is guarded.
--
-- HOW TO RUN
--   Connect as nursestudy_app -- it owns the existing tables and will own
--   these. The neondb_owner connection string Neon's console offers by default
--   is NOT sufficient; see the ownership note in 0001 for the temporary-grant
--   fallback and, importantly, why the correct undo is
--   `REVOKE ... GRANTED BY neondb_owner` and not `GRANT ... WITH SET FALSE`.
--
--     psql "$DIRECT_DATABASE_URL" -f db/manual/0002_create_simplified_topic_tables.sql
--
--   Verify with the query at the bottom of this file.

BEGIN;

-- review_topics must exist first: the other two reference it.
CREATE TABLE IF NOT EXISTS review_topics (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL UNIQUE,
  description         text,
  nclex_category      text NOT NULL,
  nclex_subcategory   text,
  nursing_specialty   text,
  body_system         text,
  difficulty          text,
  estimated_study_time integer,
  keywords            jsonb DEFAULT '[]'::jsonb,
  is_active           boolean DEFAULT true,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS topic_content (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      varchar NOT NULL,
  title         text NOT NULL,
  content       text NOT NULL,
  content_type  text NOT NULL,
  source        text,
  difficulty    text,
  tags          jsonb DEFAULT '[]'::jsonb,
  is_reviewed   boolean DEFAULT false,
  quality_score numeric(3, 2),
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_resources (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    varchar NOT NULL,
  title       text NOT NULL,
  type        text NOT NULL,
  url         text,
  description text,
  duration    integer,
  difficulty  text,
  is_free     boolean DEFAULT true,
  is_premium  boolean DEFAULT false,
  rating      numeric(3, 2),
  usage_count integer DEFAULT 0,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);

-- Foreign keys added separately and guarded: ADD CONSTRAINT has no
-- IF NOT EXISTS form in PostgreSQL, so re-running would otherwise fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'topic_content_topic_id_review_topics_id_fk'
  ) THEN
    ALTER TABLE topic_content
      ADD CONSTRAINT topic_content_topic_id_review_topics_id_fk
      FOREIGN KEY (topic_id) REFERENCES review_topics(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_resources_topic_id_review_topics_id_fk'
  ) THEN
    ALTER TABLE study_resources
      ADD CONSTRAINT study_resources_topic_id_review_topics_id_fk
      FOREIGN KEY (topic_id) REFERENCES review_topics(id);
  END IF;
END $$;

COMMIT;

-- Verification -- expects 3 tables and 2 foreign keys:
--
--   SELECT table_name
--   FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('review_topics', 'topic_content', 'study_resources')
--   ORDER BY table_name;
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname IN ('topic_content_topic_id_review_topics_id_fk',
--                     'study_resources_topic_id_review_topics_id_fk');
