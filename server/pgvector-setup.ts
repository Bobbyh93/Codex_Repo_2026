import { pool } from "./db";
import { AppLogger } from "./logger";

/**
 * Idempotent pgvector setup — runs at server startup.
 * 1. Installs the vector extension if not present.
 * 2. Migrates document_chunks.embedding from JSONB → vector(1536) if needed.
 * 3. Creates an HNSW index for fast cosine-distance nearest-neighbour search.
 *
 * All steps are guarded so re-running on an already-migrated database is safe.
 */
export async function setupPgVector(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Install pgvector extension
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    AppLogger.info("pgvector: extension ready");

    // 2. Migrate embedding column to vector(1536) if not already that exact type+dimension.
    // atttypmod encodes the dimension: pgvector stores it as (dims + 4) in the typmod field,
    // so vector(1536) → atttypmod = 1540. We check both udt_name and exact dimension.
    const colCheck = await client.query<{ udt_name: string; atttypmod: number }>(`
      SELECT c.udt_name, a.atttypmod
      FROM information_schema.columns c
      JOIN pg_attribute a
        ON a.attrelid = 'document_chunks'::regclass
       AND a.attname = 'embedding'
       AND a.attnum > 0
      WHERE c.table_name = 'document_chunks' AND c.column_name = 'embedding'
    `);
    const { udt_name: currentType = "", atttypmod = -1 } = colCheck.rows[0] ?? {};
    // pgvector stores dimension directly in atttypmod (e.g. vector(1536) → atttypmod = 1536)
    const currentDims = atttypmod > 0 ? atttypmod : -1;
    const needsMigration = currentType !== "vector" || currentDims !== 1536;
    if (needsMigration) {
      AppLogger.info(
        `pgvector: migrating embedding column (type=${currentType}, dims=${currentDims}) → vector(1536)`
      );
      await client.query(`
        ALTER TABLE document_chunks
          ALTER COLUMN embedding TYPE vector(1536)
          USING CASE
            WHEN embedding IS NULL THEN NULL
            ELSE embedding::text::vector(1536)
          END
      `);
      AppLogger.info("pgvector: embedding column migrated successfully");
    } else {
      AppLogger.info("pgvector: embedding column already vector(1536), skipping migration");
    }

    // 3. Create HNSW index for cosine-distance ANN search (idempotent)
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
        ON document_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `);
    AppLogger.info("pgvector: HNSW index ready");
  } catch (err) {
    AppLogger.error(
      "pgvector setup failed (non-critical — falling back to keyword search):",
      err instanceof Error ? err : new Error(String(err))
    );
  } finally {
    client.release();
  }
}
