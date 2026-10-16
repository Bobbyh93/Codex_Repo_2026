import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXEMPLAR_TOPICS, NCLEX_FRAMEWORK_ID } from '@shared/nclex-rn-2026';
import { ensureNclexGraphInstalled, nodeId } from '../curriculum/curriculum-repo';
import { getApprovedObjectives, getNode, getNodeDetail } from '../curriculum/curriculum-read';
import {
  addObjective,
  CurriculumWriteError,
  MAX_OBJECTIVES_PER_TOPIC,
  setNodeReleaseStage,
} from '../curriculum/curriculum-write';
import { createTestDatabase, type TestDatabase } from './helpers/pglite-db';

/** Authoring objectives and moving release stages (WP4), on a real Postgres. */

const TOPIC = EXEMPLAR_TOPICS.find((topic) => topic.id === 'psi-therapeutic-communication')!;
const TOPIC_NODE = nodeId('topic', TOPIC.id);
const ACTOR = 'admin-user-1';

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as CurriculumWriteError;
  }
  throw new Error('expected a CurriculumWriteError');
}

describe('curriculum objective authoring', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await ensureNclexGraphInstalled(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  it('adds a draft objective that continues the installed numbering', async () => {
    const objective = await addObjective(testDb.db, TOPIC_NODE, {
      label: 'Use open-ended questions to explore a patient\'s stated fear before teaching.',
      bloomLevel: 'Apply',
      cjmFunction: 'Analyze Cues',
    }, ACTOR);

    expect(objective.id).toBe(nodeId('objective', `${TOPIC.id}-4`));
    expect(objective.code).toBe(`${TOPIC.id}-objective-4`);
    expect(objective.nodeType).toBe('objective');
    expect(objective.releaseStage).toBe('draft');
    expect(objective.metadata).toMatchObject({ topicId: TOPIC.id, source: 'authored', authoredBy: ACTOR, bloomLevel: 'Apply', cjmFunction: 'Analyze Cues' });

    const detail = await getNodeDetail(testDb.db, TOPIC_NODE);
    expect(detail!.objectives.map((node) => node.id)).toContain(objective.id);
    expect(detail!.objectives).toHaveLength(TOPIC.objectives.length + 1);
  });

  it('keeps drafts out of the set a lesson may cite', async () => {
    const approvedBefore = await getApprovedObjectives(testDb.db, TOPIC_NODE);
    expect(approvedBefore).toEqual([]);

    const objectives = (await getNodeDetail(testDb.db, TOPIC_NODE))!.objectives;
    const first = objectives[0];
    await setNodeReleaseStage(testDb.db, first.id, 'approved', ACTOR);
    const approved = await getApprovedObjectives(testDb.db, TOPIC_NODE);
    expect(approved.map((node) => node.id)).toEqual([first.id]);
  });

  it('records who moved a stage and from where', async () => {
    const [objective] = (await getNodeDetail(testDb.db, TOPIC_NODE))!.objectives;
    const history = (await getNode(testDb.db, objective.id))!.metadata as { stageHistory: Array<Record<string, unknown>> };
    expect(history.stageHistory.at(-1)).toMatchObject({ from: 'clinical_review', to: 'approved', by: ACTOR });
  });

  it('does not move an approved node back when the graph is installed again', async () => {
    const [approved] = await getApprovedObjectives(testDb.db, TOPIC_NODE);
    await ensureNclexGraphInstalled(testDb.db);
    expect((await getNode(testDb.db, approved.id))!.releaseStage).toBe('approved');
    const stillDraft = (await getNodeDetail(testDb.db, TOPIC_NODE))!.objectives.find((node) => node.id === nodeId('objective', `${TOPIC.id}-4`))!;
    expect(stillDraft.releaseStage).toBe('draft');
  });

  it('refreshes an unapproved exemplar node from the constants on install', async () => {
    await setNodeReleaseStage(testDb.db, TOPIC_NODE, 'draft', ACTOR);
    await ensureNclexGraphInstalled(testDb.db);
    expect((await getNode(testDb.db, TOPIC_NODE))!.releaseStage).toBe(TOPIC.releaseStage);
  });

  it('rejects a duplicate wording, ignoring case and spacing', async () => {
    const error = await failure(addObjective(testDb.db, TOPIC_NODE, { label: `  ${TOPIC.objectives[0].toUpperCase()}  ` }, ACTOR));
    expect(error.status).toBe(409);
  });

  it('rejects an objective under a node that is not a topic, and under an unknown node', async () => {
    expect((await failure(addObjective(testDb.db, nodeId('category', 'management-of-care'), { label: 'A category cannot hold objectives.' }, ACTOR))).status).toBe(400);
    expect((await failure(addObjective(testDb.db, 'no-such-node', { label: 'There is nothing to attach this to.' }, ACTOR))).status).toBe(404);
  });

  it('caps the objectives of one topic', async () => {
    const other = EXEMPLAR_TOPICS.find((topic) => topic.id === 'sic-standard-precautions')!;
    const node = nodeId('topic', other.id);
    const existing = (await getNodeDetail(testDb.db, node))!.objectives.length;
    for (let index = existing; index < MAX_OBJECTIVES_PER_TOPIC; index += 1) {
      await addObjective(testDb.db, node, { label: `Authored objective number ${index + 1} for the cap test.` }, ACTOR);
    }
    const error = await failure(addObjective(testDb.db, node, { label: 'One objective too many for this topic.' }, ACTOR));
    expect(error.status).toBe(409);
  });

  it('refuses to move an export-ready node and unknown nodes', async () => {
    await testDb.client.query("UPDATE curriculum_nodes SET release_stage = 'export_ready' WHERE id = $1", [nodeId('category', 'management-of-care')]);
    expect((await failure(setNodeReleaseStage(testDb.db, nodeId('category', 'management-of-care'), 'draft', ACTOR))).status).toBe(409);
    expect((await failure(setNodeReleaseStage(testDb.db, 'no-such-node', 'approved', ACTOR))).status).toBe(404);
    expect(NCLEX_FRAMEWORK_ID).toBe('nclex-rn-2026');
  });
});
