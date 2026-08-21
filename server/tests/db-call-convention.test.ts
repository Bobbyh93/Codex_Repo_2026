import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQL } from 'drizzle-orm';

/**
 * Regression tests for a class of bug that shipped silently:
 *
 * Several modules called `db.execute(rawSqlString, [param, param])` -- the
 * node-postgres calling convention. This project's `db` is drizzle-orm
 * (neon-serverless), whose `execute()` takes a single tagged `sql\`...\``
 * template and has no second parameter to bind values into. The placeholders
 * were therefore never substituted, breaking topic-review tracking, frequency
 * counters, and content-gap scoring.
 *
 * These tests pin the calling convention itself rather than any one query, so
 * a regression to the node-postgres style fails here regardless of which
 * module reintroduces it.
 *
 * The modules under test swallow their own errors (try/catch + console.log),
 * so "did not throw" is NOT sufficient evidence of correctness -- every test
 * below asserts the spy actually received calls.
 */

const execute = vi.fn();
const deleteWhere = vi.fn();
const dbDelete = vi.fn(() => ({ where: deleteWhere }));

vi.mock('../db', () => ({
  db: {
    execute: (...args: unknown[]) => execute(...args),
    delete: (...args: unknown[]) => dbDelete(...args),
  },
  pool: {},
}));

/** Values interpolated into a drizzle `sql` template become their own chunk. */
function staticSqlText(query: SQL): string {
  const chunks = (query as unknown as { queryChunks: unknown[] }).queryChunks;
  return chunks
    .filter((c) => c?.constructor?.name === 'StringChunk')
    .map((c) => {
      const v = (c as { value: string | string[] }).value;
      return Array.isArray(v) ? v.join('') : v;
    })
    .join('');
}

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue({ rows: [] });
  deleteWhere.mockReset();
  deleteWhere.mockResolvedValue(undefined);
  dbDelete.mockClear();
});

describe('db.execute calling convention', () => {
  it('simple-topic-tracker passes a single tagged SQL template, never a string + params array', async () => {
    const { trackSimpleTopicReview } = await import('../simple-topic-tracker.js');

    await trackSimpleTopicReview('Medication Administration', 'analysis');

    // Guard against a vacuous pass: this module swallows errors internally.
    expect(execute).toHaveBeenCalled();

    for (const call of execute.mock.calls) {
      // The bug was `db.execute(string, [params])`. One argument, always.
      expect(call).toHaveLength(1);
      expect(call[0]).toBeInstanceOf(SQL);
      expect(typeof call[0]).not.toBe('string');
    }
  });

  it('binds the topic name as a parameter instead of inlining it into SQL text', async () => {
    const { trackSimpleTopicReview } = await import('../simple-topic-tracker.js');
    const topicName = "Fluid & Electrolytes'; DROP TABLE review_topics;--";

    await trackSimpleTopicReview(topicName, 'analysis');

    expect(execute).toHaveBeenCalled();
    for (const call of execute.mock.calls) {
      // A parameterized value must never appear in the static SQL text.
      expect(staticSqlText(call[0] as SQL)).not.toContain(topicName);
    }
  });

  it('leaves no unbound ? or $n placeholders in the static SQL text', async () => {
    const { trackSimpleTopicReview } = await import('../simple-topic-tracker.js');

    await trackSimpleTopicReview('Infection Control', 'analysis');

    expect(execute).toHaveBeenCalled();
    for (const call of execute.mock.calls) {
      const text = staticSqlText(call[0] as SQL);
      // `?` and `$1` are the two placeholder styles the broken calls used.
      expect(text).not.toMatch(/\?/);
      expect(text).not.toMatch(/\$\d/);
    }
  });

  it('topic-frequency-tracker uses the same single-argument convention', async () => {
    const { trackTopicReview } = await import('../topic-frequency-tracker.js');

    await trackTopicReview([
      { topicName: 'Cardiac Output', source: 'pdf_analysis', confidenceScore: 0.9 },
    ]);

    expect(execute).toHaveBeenCalled();
    for (const call of execute.mock.calls) {
      expect(call).toHaveLength(1);
      expect(call[0]).toBeInstanceOf(SQL);
    }
  });
});

describe('password-recovery cleanupExpiredTokens', () => {
  it('runs without throwing (regression: `sql` was used but never imported)', async () => {
    const { PasswordRecoveryService } = await import('../password-recovery.js');

    // Pre-fix this threw `ReferenceError: sql is not defined`. There is no
    // try/catch around it, so the rejection surfaced to the caller.
    await expect(PasswordRecoveryService.cleanupExpiredTokens()).resolves.toBeUndefined();

    expect(dbDelete).toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(deleteWhere.mock.calls[0][0]).toBeInstanceOf(SQL);
  });
});
