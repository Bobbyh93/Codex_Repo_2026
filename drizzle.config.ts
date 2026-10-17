import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",

  // Every schema file whose tables exist in the database. All three are listed,
  // which is what makes `npm run db:push` safe: drizzle-kit proposes DROP TABLE
  // for any table it finds in the database but not in the configured schema.
  //
  // This once listed only shared/schema.ts (88 tables) against a 98-table
  // database, so push proposed dropping the other 10 -- including the 9
  // crosswalk tables that crosswalk-routes.ts queries and db.ts registers at
  // runtime. It surfaced safely only because --force was withheld: the step hit
  // a data-loss prompt and exited 1 on a disposable preview branch.
  //
  // Adding the remaining two files took three changes, because drizzle-kit
  // rejects a schema set that defines one table name twice:
  //
  //   1. crosswalk-schema.ts shares no names with schema.ts, so it just went in.
  //   2. topics-schema.ts was deleted with its only two importers, both dead
  //      code, removing four duplicate names.
  //   3. simplified-schema.ts's last three duplicates were removed -- see that
  //      file's header. topic_performance was the one with live consumers; they
  //      now import schema.ts's table, which is the only one the database has.
  //
  // simplified-schema.ts's own three tables (review_topics, topic_content,
  // study_resources) are created by
  // db/manual/0002_create_simplified_topic_tables.sql. Until that migration is
  // applied, push against production would propose creating them -- additive and
  // matching the migration, but apply 0002 first so the two cannot diverge.
  //
  // server/tests/drizzle-push-safety.test.ts pins both properties this relies on.
  schema: [
    "./shared/schema.ts",
    "./shared/crosswalk-schema.ts",
    "./shared/simplified-schema.ts",
  ],

  // Tables the database has that Drizzle does NOT own. Each must be excluded
  // rather than defined, or push proposes dropping it.
  //
  // user_sessions is created and owned by connect-pg-simple
  // (`createTableIfMissing: true`, server/index.ts) -- dropping it logs
  // everyone out.
  //
  // The 14 compliance-layer tables below are created and owned by
  // db/manual/0003_curriculum_compliance_schema.sql: the California BRN/BVNPT
  // requirement registry, the concept-to-topic crosswalk, instructional_blocks
  // (the atomic delivery record), and the board form catalogue. They hold real
  // reference data -- 147 cited requirement atoms, 481 topic mappings, 156 form
  // fields -- and no server module imports them yet, so they are listed here
  // instead of in a shared/ schema file. Move a table out of this list only in
  // the same change that adds its pgTable definition to a configured schema
  // file; doing one without the other re-arms the DROP TABLE hazard this
  // filter exists to prevent.
  tablesFilter: [
    "!user_sessions",
    "!program_frameworks",
    "!program_requirements",
    "!requirement_topic_map",
    "!framework_crosswalk",
    "!program_offerings",
    "!instructional_blocks",
    "!requirement_content_gaps",
    "!evidence_citations",
    "!curriculum_glossary",
    "!form_definitions",
    "!form_sections",
    "!form_fields",
    "!form_field_options",
    "!form_submissions",
  ],

  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
