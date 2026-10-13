import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as crosswalkSchema from "@shared/crosswalk-schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fail an unreachable database instead of waiting on the OS TCP timeout.
  // This bounds acquiring a connection only, not how long a query may run.
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle({ client: pool, schema: { ...schema, ...crosswalkSchema } });