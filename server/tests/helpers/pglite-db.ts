import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@shared/schema';
import * as crosswalkSchema from '@shared/crosswalk-schema';

/**
 * A real PostgreSQL for tests, in-process, with this repo's schema applied.
 *
 * PGlite is Postgres compiled to WASM: real SQL, real constraints, real
 * defaults (gen_random_uuid(), NOT NULL, foreign keys), no external service.
 * The schema is applied with drizzle-kit's own diff engine from the same
 * shared/schema.ts the app runs against, so a handler that inserts a column
 * that does not exist, or omits one that is NOT NULL, fails here the way it
 * fails in production -- which is exactly the class of bug a mocked `db`
 * cannot see.
 *
 * Two deliberate limits:
 *
 *   - Four tables are left out: document_chunks carries a pgvector
 *     `vector(1536)` column, and rag_citations, source_taxonomy_mappings and
 *     lesson_citations reference it. This PGlite build does not bundle
 *     pgvector. Nothing under test touches those tables.
 *   - The schema is pushed exactly once, into an empty database. drizzle-kit's
 *     introspection of a populated PGlite fails on a parameter-binding
 *     mismatch, so callers get a fresh database per call rather than a reset.
 *
 * drizzle-kit/api is loaded through createRequire: its ESM build uses a
 * dynamic `require("fs")` shim that vitest's module transform rejects, while
 * the CommonJS build loads cleanly.
 */

const PGVECTOR_DEPENDENT = new Set([
  'documentChunks',
  'ragCitations',
  'sourceTaxonomyMappings',
  'lessonCitations',
]);

const require = createRequire(import.meta.url);
const { pushSchema } = require('drizzle-kit/api') as typeof import('drizzle-kit/api');

export type TestDatabase = {
  /** Drop-in for `db` from server/db.ts: same schema registration, real SQL. */
  db: ReturnType<typeof drizzle<typeof schema & typeof crosswalkSchema>>;
  /** Raw client for assertions that want plain SQL. */
  client: PGlite;
  close: () => Promise<void>;
};

export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const fullSchema = { ...schema, ...crosswalkSchema };
  const db = drizzle(client, { schema: fullSchema });

  const pushable = Object.fromEntries(
    Object.entries(schema).filter(([name]) => !PGVECTOR_DEPENDENT.has(name)),
  );

  // Silence drizzle-kit's spinner: it writes progress frames to stdout, which
  // vitest interleaves with test output.
  const write = process.stdout.write;
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    const { apply, hasDataLoss, warnings } = await pushSchema(pushable, db as any);
    if (hasDataLoss || warnings.length > 0) {
      throw new Error(
        `schema push into an empty database should be clean: dataLoss=${hasDataLoss} warnings=${warnings.join('; ')}`,
      );
    }
    await apply();
  } finally {
    process.stdout.write = write;
  }

  return {
    db,
    client,
    close: () => client.close(),
  };
}
