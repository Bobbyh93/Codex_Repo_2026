import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  curriculumFrameworks,
  curriculumNodes,
  curriculumObjectiveMappings,
  lessonPackages,
} from '@shared/schema';
import { createTestDatabase, type TestDatabase } from './helpers/pglite-db';

/**
 * WP2 of the curriculum-to-lesson integration: lessons gain a link to a graph node, and
 * objective mappings gain a target (package, slide or item), a uniqueness key and a cascade.
 *
 * This app creates tables twice: drizzle (shared/schema.ts, used by db:push and PGlite) and raw
 * DDL in ensureLessonBuilderTables (what the running service executes at boot). The first
 * block checks that the two agree; the second exercises the constraints on a real Postgres.
 */

const routesSource = readFileSync(resolve(__dirname, '../routes/lesson-builder-routes.ts'), 'utf8');

function ddlBlock(table: string): string {
  const start = routesSource.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`);
  expect(start, `CREATE TABLE ${table}`).toBeGreaterThan(-1);
  return routesSource.slice(start, routesSource.indexOf('`);', start));
}

function ddlColumns(table: string): Set<string> {
  const create = ddlBlock(table)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+ [a-z]/.test(line) && !/^(primary|foreign|unique|constraint)/i.test(line))
    .map((line) => line.split(/\s+/)[0]);
  const added = [...routesSource.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ([a-z_]+) `, 'g'))].map((m) => m[1]);
  return new Set([...create, ...added]);
}

describe('boot DDL and drizzle schema agree', () => {
  it.each([
    ['lesson_packages', lessonPackages],
    ['curriculum_objective_mappings', curriculumObjectiveMappings],
  ] as const)('%s has the same columns in both', (table, drizzleTable) => {
    const drizzleColumns = new Set(getTableConfig(drizzleTable).columns.map((column) => column.name));
    const raw = ddlColumns(table);
    expect([...drizzleColumns].filter((name) => !raw.has(name)), `${table}: in drizzle, missing from boot DDL`).toEqual([]);
    expect([...raw].filter((name) => !drizzleColumns.has(name)), `${table}: in boot DDL, missing from drizzle`).toEqual([]);
  });

  it('creates the same indexes in both', () => {
    const drizzleIndexes = [lessonPackages, curriculumObjectiveMappings]
      .flatMap((table) => getTableConfig(table).indexes.map((index) => index.config.name));
    expect(drizzleIndexes.length).toBeGreaterThanOrEqual(3);
    for (const name of drizzleIndexes) expect(routesSource, name).toContain(`INDEX IF NOT EXISTS ${name} ON`);
  });

  it('runs the new boot statements cleanly, and again, on a real Postgres', async () => {
    const statements = [...routesSource.matchAll(/db\.execute\(sql`([\s\S]*?)`\);/g)]
      .map((match) => match[1].trim())
      .filter((text) => /^ALTER TABLE lesson_packages ADD COLUMN IF NOT EXISTS (framework_id|primary_node_id|generation_mode|curriculum_context)/.test(text)
        || /^CREATE INDEX IF NOT EXISTS lesson_packages_primary_node_idx/.test(text)
        || /^ALTER TABLE curriculum_objective_mappings ADD COLUMN IF NOT EXISTS/.test(text)
        || /^DO \$\$ BEGIN[\s\S]*curriculum_objective_mappings_package_id_fk/.test(text)
        || /^CREATE (UNIQUE )?INDEX IF NOT EXISTS curriculum_objective_mappings_/.test(text));
    expect(statements.length).toBe(11);
    const database = await createTestDatabase();
    try {
      for (let pass = 0; pass < 2; pass += 1) {
        for (const statement of statements) await database.client.exec(statement);
      }
      const constraints = await database.client.query<{ conname: string }>(
        "SELECT conname FROM pg_constraint WHERE conname = 'curriculum_objective_mappings_package_id_fk'");
      expect(constraints.rows).toHaveLength(1);
    } finally {
      await database.close();
    }
  }, 60_000);

  it('keeps the new foreign key from failing a boot on old rows', () => {
    const fk = routesSource.slice(routesSource.indexOf('curriculum_objective_mappings_package_id_fk'));
    expect(fk).toContain('ON DELETE CASCADE NOT VALID');
  });
});

describe('curriculum objective mappings on a real Postgres', () => {
  let testDb: TestDatabase;
  const frameworkId = 'test-framework';
  const nodeId = 'test-framework:objective:01';

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await testDb.db.insert(curriculumFrameworks).values({ id: frameworkId, title: 'Test framework', version: '1' } as any);
    await testDb.db.insert(curriculumNodes).values({
      id: nodeId,
      frameworkId,
      nodeType: 'objective',
      code: 'LO-01',
      label: 'Recognize cues of fear',
    });
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  async function newPackage(extra: Record<string, unknown> = {}) {
    const [pkg] = await testDb.db.insert(lessonPackages).values({ title: 'Lesson', topic: 'Topic', ...extra }).returning();
    return pkg;
  }

  it('gives a plain lesson no curriculum link', async () => {
    const pkg = await newPackage();
    expect(pkg.frameworkId).toBeNull();
    expect(pkg.primaryNodeId).toBeNull();
    expect(pkg.generationMode).toBeNull();
    expect(pkg.curriculumContext).toEqual({});
  });

  it('stores a lesson generated from a node', async () => {
    const pkg = await newPackage({
      frameworkId,
      primaryNodeId: 'test-framework:topic:communication',
      generationMode: 'template',
      curriculumContext: { sources: [{ id: 's1', license: 'CC BY 4.0' }] },
    });
    const [row] = await testDb.db.select().from(lessonPackages).where(eq(lessonPackages.id, pkg.id));
    expect(row.primaryNodeId).toBe('test-framework:topic:communication');
    expect(row.curriculumContext).toEqual({ sources: [{ id: 's1', license: 'CC BY 4.0' }] });
  });

  it('defaults a mapping to a package-level target and rejects a duplicate', async () => {
    const pkg = await newPackage();
    const [mapping] = await testDb.db.insert(curriculumObjectiveMappings)
      .values({ objectiveNodeId: nodeId, packageId: pkg.id, frameworkId }).returning();
    expect(mapping.targetKind).toBe('package');
    expect(mapping.targetId).toBe('');
    expect(mapping.mappingType).toBe('primary');

    await expect(testDb.db.insert(curriculumObjectiveMappings)
      .values({ objectiveNodeId: nodeId, packageId: pkg.id, frameworkId })).rejects.toThrow();
  });

  it('allows one mapping per slide, per item and per mapping type', async () => {
    const pkg = await newPackage();
    const base = { objectiveNodeId: nodeId, packageId: pkg.id, frameworkId };
    await testDb.db.insert(curriculumObjectiveMappings).values([
      { ...base, targetKind: 'package' },
      { ...base, targetKind: 'slide', targetId: 'slide-1' },
      { ...base, targetKind: 'slide', targetId: 'slide-2' },
      { ...base, targetKind: 'item', targetId: 'item-1', itemId: 'item-1' },
      { ...base, targetKind: 'slide', targetId: 'slide-1', mappingType: 'supporting' },
    ]);
    const rows = await testDb.db.select().from(curriculumObjectiveMappings).where(eq(curriculumObjectiveMappings.packageId, pkg.id));
    expect(rows).toHaveLength(5);
    await expect(testDb.db.insert(curriculumObjectiveMappings)
      .values({ ...base, targetKind: 'slide', targetId: 'slide-2' })).rejects.toThrow();
  });

  it('deletes a package\'s mappings with the package', async () => {
    const pkg = await newPackage();
    await testDb.db.insert(curriculumObjectiveMappings).values([
      { objectiveNodeId: nodeId, packageId: pkg.id, frameworkId },
      { objectiveNodeId: nodeId, packageId: pkg.id, frameworkId, targetKind: 'slide', targetId: 's1' },
    ]);
    await testDb.db.delete(lessonPackages).where(eq(lessonPackages.id, pkg.id));
    const left = await testDb.db.select().from(curriculumObjectiveMappings).where(eq(curriculumObjectiveMappings.packageId, pkg.id));
    expect(left).toEqual([]);
  });

  it('rejects a mapping for a package that does not exist', async () => {
    await expect(testDb.db.insert(curriculumObjectiveMappings)
      .values({ objectiveNodeId: nodeId, packageId: 'no-such-package', frameworkId })).rejects.toThrow();
  });

  it('cascades from the objective node as before', async () => {
    const pkg = await newPackage();
    await testDb.db.insert(curriculumNodes).values({ id: 'test-framework:objective:99', frameworkId, nodeType: 'objective', code: 'LO-99', label: 'Temp' });
    await testDb.db.insert(curriculumObjectiveMappings).values({ objectiveNodeId: 'test-framework:objective:99', packageId: pkg.id, frameworkId });
    await testDb.db.delete(curriculumNodes).where(eq(curriculumNodes.id, 'test-framework:objective:99'));
    const left = await testDb.db.select().from(curriculumObjectiveMappings).where(eq(curriculumObjectiveMappings.objectiveNodeId, 'test-framework:objective:99'));
    expect(left).toEqual([]);
  });
});
