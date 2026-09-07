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

  // user_sessions is the 10th orphan. It is created and owned by
  // connect-pg-simple (`createTableIfMissing: true`, server/index.ts), not by
  // Drizzle, so it must be excluded rather than defined -- otherwise push
  // proposes dropping the live session table and logs everyone out.
  tablesFilter: ["!user_sessions"],

  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
