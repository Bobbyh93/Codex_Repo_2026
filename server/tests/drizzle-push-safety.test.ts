import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Guards the two invariants that make `npm run db:push` safe against real data.
 *
 * drizzle-kit push diffs the configured schema against the live database and
 * proposes DROP TABLE for anything it finds in the database but not in the
 * schema. The config once listed only shared/schema.ts (88 tables) against a
 * 98-table database, so a push would have dropped the 9 crosswalk tables the
 * app actively queries. That surfaced only because --force was withheld and the
 * step hit a data-loss prompt on a disposable preview branch.
 *
 * The fix was to list every schema file the app actually uses. Keeping it fixed
 * needs two properties to hold, and neither is visible in code review:
 *
 *   1. Every schema file imported by server code is listed in the config.
 *      Violating this is what created the hazard: crosswalk-schema.ts was
 *      registered in server/db.ts and queried at runtime, but unlisted.
 *
 *   2. No table name is defined twice across the listed files. drizzle-kit
 *      rejects such a set outright, so violating this breaks db:push entirely.
 *      Three duplicate definitions had to be removed from simplified-schema.ts
 *      before it could be listed.
 *
 * These are checked by parsing sources rather than importing them: importing
 * drizzle.config.ts throws without DATABASE_URL, by design.
 *
 * A schema file that no server module imports is deliberately NOT required to
 * be listed -- shared/content-schema.ts is unreferenced dead code that declares
 * four names shared/schema.ts owns, and listing it would break invariant 2.
 * Rule 1 is scoped to what the app actually loads, which is what push must know
 * about.
 */

const repoRoot = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

/** Strips // and block comments so commented-out code never counts as a match. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The schema files drizzle.config.ts actually passes to drizzle-kit. */
function configuredSchemaFiles(): string[] {
  const config = stripComments(read('drizzle.config.ts'));
  const block = config.match(/schema:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error('drizzle.config.ts: no schema array found');
  return [...block[1].matchAll(/["'`](.+?)["'`]/g)].map((m) => m[1].replace(/^\.\//, ''));
}

/** Table names a schema file declares, e.g. pgTable("review_topics", ...). */
function tableNames(file: string): string[] {
  return [...stripComments(read(file)).matchAll(/pgTable\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

const SHARED_SCHEMA_FILES = readdirSync(resolve(repoRoot, 'shared'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => `shared/${f}`)
  .filter((f) => tableNames(f).length > 0);

describe('drizzle.config.ts covers the schema the app uses', () => {
  it('lists at least the files known to define live tables', () => {
    // Non-vacuous: the checks below are meaningless if parsing silently found
    // nothing. schema.ts alone declares dozens of tables.
    const configured = configuredSchemaFiles();
    expect(configured).toContain('shared/schema.ts');
    expect(configured.length).toBeGreaterThanOrEqual(2);
    expect(SHARED_SCHEMA_FILES.length).toBeGreaterThanOrEqual(2);
    expect(tableNames('shared/schema.ts').length).toBeGreaterThan(50);
  });

  it('lists every schema file that server code imports', () => {
    const configured = new Set(configuredSchemaFiles());

    // Everything under server/, as one blob: an import anywhere counts.
    const walk = (dir: string): string[] =>
      readdirSync(resolve(repoRoot, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : [],
      );
    const serverSource = walk('server')
      .filter((f) => !f.includes('/tests/'))
      .map((f) => stripComments(read(f)))
      .join('\n');

    for (const file of SHARED_SCHEMA_FILES) {
      const moduleName = file.replace(/^shared\//, '').replace(/\.ts$/, '');
      const imported = new RegExp(`from\\s+["'\`]@shared/${moduleName}["'\`]`).test(serverSource);
      if (!imported) continue;
      expect(
        configured.has(file),
        `${file} is imported by server code but not listed in drizzle.config.ts -- ` +
          `db:push would propose DROP TABLE for its tables`,
      ).toBe(true);
    }
  });

  it('never defines the same table name twice across the listed files', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const file of configuredSchemaFiles()) {
      for (const table of tableNames(file)) {
        const previous = seen.get(table);
        if (previous) duplicates.push(`"${table}" in both ${previous} and ${file}`);
        else seen.set(table, file);
      }
    }

    expect(
      duplicates,
      `drizzle-kit rejects a schema set defining a table twice, which breaks db:push:\n  ${duplicates.join('\n  ')}`,
    ).toEqual([]);
    expect(seen.size).toBeGreaterThan(50);
  });
});
