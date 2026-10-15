import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { curriculumObjectiveMappings, lessonPackages } from '@shared/schema';
import { EXEMPLAR_TOPICS, INTEGRATED_PROCESSES, NCJMM_FUNCTIONS, NCLEX_CATEGORIES, NCLEX_FRAMEWORK_ID } from '@shared/nclex-rn-2026';
import { ensureNclexGraphInstalled, nodeId } from '../curriculum/curriculum-repo';
import { getAncestry, getEvidenceSourceIds, getNodeDetail, listFrameworks, listNodes } from '../curriculum/curriculum-read';
import { createTestDatabase, type TestDatabase } from './helpers/pglite-db';

/**
 * The curriculum graph read side (WP3), on a real Postgres with the real schema.
 * The graph is installed by the extracted ensureNclexGraphInstalled, from the same constants the
 * app installs from, so these tests also pin that the extraction did not change what it writes.
 */

const TOPIC = EXEMPLAR_TOPICS.find((topic) => topic.id === 'psi-therapeutic-communication')!;
const TOPIC_NODE = nodeId('topic', TOPIC.id);

describe('curriculum graph read side', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  it('installs the NCLEX graph, and installing again changes nothing', async () => {
    const first = await ensureNclexGraphInstalled(testDb.db);
    const before = await listFrameworks(testDb.db);
    const second = await ensureNclexGraphInstalled(testDb.db);
    const after = await listFrameworks(testDb.db);
    expect(second).toEqual(first);
    expect(after).toEqual(before);
    expect(first.frameworkId).toBe(NCLEX_FRAMEWORK_ID);
    const objectiveCount = EXEMPLAR_TOPICS.reduce((sum, topic) => sum + topic.objectives.length, 0);
    expect(first.nodes).toBe(NCLEX_CATEGORIES.length + INTEGRATED_PROCESSES.length + NCJMM_FUNCTIONS.length + EXEMPLAR_TOPICS.length + objectiveCount);
  });

  it('lists the framework with node counts by type', async () => {
    const [framework] = await listFrameworks(testDb.db);
    expect(framework.id).toBe(NCLEX_FRAMEWORK_ID);
    expect(framework.nodeCounts).toEqual({
      category: NCLEX_CATEGORIES.length,
      integrated_process: INTEGRATED_PROCESSES.length,
      ncjmm: NCJMM_FUNCTIONS.length,
      topic: EXEMPLAR_TOPICS.length,
      objective: EXEMPLAR_TOPICS.reduce((sum, topic) => sum + topic.objectives.length, 0),
    });
  });

  it('filters nodes by type and by text, with objective counts', async () => {
    const topics = await listNodes(testDb.db, { frameworkId: NCLEX_FRAMEWORK_ID, nodeType: 'topic' });
    expect(topics).toHaveLength(EXEMPLAR_TOPICS.length);
    expect(topics.every((topic) => topic.objectiveCount === 3)).toBe(true);
    expect(topics.every((topic) => topic.lessonCount === 0)).toBe(true);

    const found = await listNodes(testDb.db, { q: 'therapeutic' });
    expect(found.map((node) => node.id)).toContain(TOPIC_NODE);

    const none = await listNodes(testDb.db, { q: '%' });
    expect(none).toEqual([]);
    const limited = await listNodes(testDb.db, { nodeType: 'topic', limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('resolves a topic to its category, objectives, processes and judgment functions', async () => {
    const detail = await getNodeDetail(testDb.db, TOPIC_NODE);
    expect(detail).not.toBeNull();
    expect(detail!.node.label).toBe(TOPIC.title);
    expect(detail!.ancestry.map((node) => node.nodeType)).toEqual(['category']);
    expect(detail!.ancestry[0].code).toBe(TOPIC.categoryId);
    expect(detail!.objectives).toHaveLength(TOPIC.objectives.length);
    expect(detail!.objectives.map((node) => node.label).sort()).toEqual([...TOPIC.objectives].sort());
    expect(detail!.integratedProcesses.map((node) => node.code).sort()).toEqual([...TOPIC.integratedProcesses].sort());
    expect(detail!.judgmentFunctions).toHaveLength(NCJMM_FUNCTIONS.length);
    expect(detail!.evidenceSources.framework.map((source) => source.id)).toContain(TOPIC.sources[0].id);
  });

  it('resolves an objective up through its topic to the category', async () => {
    const objective = (await getNodeDetail(testDb.db, TOPIC_NODE))!.objectives[0];
    const ancestry = await getAncestry(testDb.db, objective.id);
    expect(ancestry.map((node) => node.nodeType)).toEqual(['topic', 'category']);
    expect(ancestry[0].id).toBe(TOPIC_NODE);
  });

  it('returns null for an unknown node and nothing for its evidence', async () => {
    expect(await getNodeDetail(testDb.db, 'no-such-node')).toBeNull();
    expect(await getEvidenceSourceIds(testDb.db, 'no-such-node')).toEqual([]);
  });

  it('reads the evidence source ids a node records, as written', async () => {
    expect(await getEvidenceSourceIds(testDb.db, TOPIC_NODE)).toEqual([]);
    await testDb.client.query(
      "UPDATE curriculum_nodes SET metadata = metadata || '{\"evidenceSourceIds\":[\"src-a\",\"src-b\"]}'::jsonb WHERE id = $1",
      [TOPIC_NODE],
    );
    expect(await getEvidenceSourceIds(testDb.db, TOPIC_NODE)).toEqual(['src-a', 'src-b']);
  });

  it('counts lessons linked by primary node and by objective mapping', async () => {
    const detailBefore = await getNodeDetail(testDb.db, TOPIC_NODE);
    const objective = detailBefore!.objectives[0];
    const [byNode] = await testDb.db.insert(lessonPackages).values({
      title: 'Lesson', topic: 'Communication', frameworkId: NCLEX_FRAMEWORK_ID, primaryNodeId: TOPIC_NODE, generationMode: 'template',
    }).returning();
    const [byMapping] = await testDb.db.insert(lessonPackages).values({ title: 'Other', topic: 'Communication' }).returning();
    await testDb.db.insert(curriculumObjectiveMappings).values([
      { objectiveNodeId: objective.id, packageId: byNode.id, frameworkId: NCLEX_FRAMEWORK_ID },
      { objectiveNodeId: objective.id, packageId: byMapping.id, frameworkId: NCLEX_FRAMEWORK_ID },
      { objectiveNodeId: objective.id, packageId: byMapping.id, frameworkId: NCLEX_FRAMEWORK_ID, targetKind: 'slide', targetId: 's1' },
    ]);

    const detail = await getNodeDetail(testDb.db, TOPIC_NODE);
    expect(detail!.packages.map((pkg) => pkg.id)).toEqual([byNode.id]);
    const topicRow = (await listNodes(testDb.db, { nodeType: 'topic', q: 'therapeutic' })).find((row) => row.id === TOPIC_NODE)!;
    expect(topicRow.lessonCount).toBe(1);
    const objectiveRow = (await listNodes(testDb.db, { nodeType: 'objective' })).find((row) => row.id === objective.id)!;
    expect(objectiveRow.lessonCount).toBe(2);
    const objectiveDetail = await getNodeDetail(testDb.db, objective.id);
    expect(objectiveDetail!.mappings).toEqual({ package: 2, slide: 1 });
  });
});

describe('curriculum graph routes', () => {
  const source = readFileSync(resolve(__dirname, '../routes/curriculum-graph-routes.ts'), 'utf8');
  const registrations = [...source.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"([^)]*)/g)];

  it('guards every route with the admin session', () => {
    expect(registrations.length).toBe(5);
    for (const [, , path, rest] of registrations) {
      expect(path.startsWith('/api/admin/curriculum/'), path).toBe(true);
      expect(rest, path).toContain('requireAdminSession');
    }
  });

  it('requires a CSRF token on every route that writes, and only those', () => {
    for (const [, method, path, rest] of registrations) {
      if (method === 'get') expect(rest, path).not.toContain('validateCSRFToken');
      else expect(rest, `${method} ${path}`).toContain('validateCSRFToken');
    }
    expect(registrations.filter(([, method]) => method !== 'get')).toHaveLength(2);
  });
});
