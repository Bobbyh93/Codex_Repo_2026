import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",

  // Both schema files whose tables actually exist in the database.
  //
  // This previously listed only shared/schema.ts (88 tables). The live
  // database has 98 tables, so drizzle-kit push saw the other 10 as orphans
  // and proposed DROP TABLE for each -- including the 9 crosswalk tables that
  // crosswalk-routes.ts queries and db.ts registers at runtime. That made
  // `npm run db:push` unsafe to run against real data.
  //
  // crosswalk-schema.ts covers exactly those 9 and shares no table names with
  // shared/schema.ts, so adding it is safe.
  //
  // simplified-schema.ts is deliberately NOT listed. It redefines three names
  // that shared/schema.ts owns and that DO exist in the database with different
  // columns -- topic_performance, study_plans, study_plan_items -- so listing it
  // would corrupt the diff for real tables. Its own three tables (review_topics,
  // topic_content, study_resources) are created by
  // db/manual/0002_create_simplified_topic_tables.sql instead.
  //
  // Corrects two errors in the note that stood here before:
  //   - it claimed shared/schema.ts "already owns" all 7 colliding names. It does
  //     not own topic_content -- that name is not in schema.ts at all. It was
  //     defined only in simplified-schema.ts and topics-schema.ts, which collided
  //     with each other rather than with schema.ts.
  //   - it claimed none of those files' tables exist in the database. Three of
  //     simplified-schema's now do, as of migration 0002.
  //
  // topics-schema.ts is gone -- deleted along with its only two importers,
  // server/content-indexer.ts and server/admin-study-blueprint.ts, both of which
  // were unreferenced. That removed four of the seven collisions.
  //
  // What remains before this file can list simplified-schema.ts and make
  // `npm run db:push` safe: its studyPlans and studyPlanItems exports are
  // imported nowhere (only reviewTopics, topicContent and topicPerformance are),
  // so deleting those two definitions would leave topic_performance as the single
  // remaining collision. That is the follow-up, not this change.
  schema: [
    "./shared/schema.ts",
    "./shared/crosswalk-schema.ts",
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
