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
  // simplified-schema.ts and topics-schema.ts are deliberately NOT listed:
  // none of their tables exist in the database (verified against the live
  // schema), and between them they redefine 7 names that shared/schema.ts
  // already owns -- users, assessment_reports, study_plans, study_plan_items,
  // topic_performance, topic_content, topic_relationships -- with differing
  // columns. Adding them would corrupt the diff for tables that do exist.
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
