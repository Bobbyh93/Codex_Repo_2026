import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  curriculumEdges,
  curriculumEvidenceSources,
  curriculumFrameworks,
  curriculumNodes,
} from "@shared/schema";
import {
  EXEMPLAR_TOPICS,
  INTEGRATED_PROCESSES,
  NCJMM_FUNCTIONS,
  NCLEX_CATEGORIES,
  NCLEX_FRAMEWORK_ID,
} from "@shared/nclex-rn-2026";

/** Any drizzle Postgres database: the app's neon handle or an in-process PGlite in tests. */
export type CurriculumDb = PgDatabase<any, any, any>;

/** Stable graph node id: `<framework>:<kind>:<slug>`. */
export function nodeId(kind: string, value: string) {
  return `${NCLEX_FRAMEWORK_ID}:${kind}:${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

// Extracted unchanged from lesson-builder-routes.ts (installCanonicalCurriculumGraph); the only
// difference is that the database handle is a parameter.
export async function ensureNclexGraphInstalled(db: CurriculumDb) {
  await db.insert(curriculumFrameworks).values({
    id: NCLEX_FRAMEWORK_ID,
    title: "2026 NCLEX-RN Open Curriculum",
    version: "2026",
    audience: "Prelicensure RN",
    status: "active",
    sourceUri: "https://www.ncsbn.org/publications/2026-nclex-rn-test-plan",
    metadata: { legacyTopicMigrationTarget: 77, maternalNewbornMigrationRows: 94, atiPolicy: "aliases_only" },
  }).onConflictDoUpdate({
    target: curriculumFrameworks.id,
    set: { status: "active", updatedAt: new Date() },
  });

  const categoryNodes = NCLEX_CATEGORIES.map((category) => ({
    id: nodeId("category", category.id),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "category",
    code: category.id,
    label: category.label,
    blueprintWeight: category.blueprintWeight.toFixed(2),
    releaseStage: "approved",
    metadata: { blueprintRange: category.blueprintRange },
  }));
  const processNodes = INTEGRATED_PROCESSES.map((process) => ({
    id: nodeId("integrated-process", process),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "integrated_process",
    code: process,
    label: process,
    releaseStage: "approved",
  }));
  const judgmentNodes = NCJMM_FUNCTIONS.map((fn) => ({
    id: nodeId("ncjmm", fn),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "ncjmm",
    code: fn,
    label: fn,
    releaseStage: "approved",
  }));
  const topicNodes = EXEMPLAR_TOPICS.map((topic) => ({
    id: nodeId("topic", topic.id),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "topic",
    code: topic.id,
    label: topic.title,
    description: topic.summary,
    safetyRisk: topic.safetyRisk,
    releaseStage: topic.releaseStage,
    legacyIds: topic.prerequisites,
    metadata: { concept: topic.concept, prerequisites: topic.prerequisites },
  }));
  const objectiveNodes = EXEMPLAR_TOPICS.flatMap((topic) => topic.objectives.map((objective, index) => ({
    id: nodeId("objective", `${topic.id}-${index + 1}`),
    frameworkId: NCLEX_FRAMEWORK_ID,
    nodeType: "objective",
    code: `${topic.id}-objective-${index + 1}`,
    label: objective,
    safetyRisk: topic.safetyRisk,
    releaseStage: topic.releaseStage,
    metadata: { topicId: topic.id },
  })));

  for (const node of [...categoryNodes, ...processNodes, ...judgmentNodes, ...topicNodes, ...objectiveNodes]) {
    await db.insert(curriculumNodes).values(node).onConflictDoUpdate({
      target: curriculumNodes.id,
      // A human decision outranks the constant: once a node has been approved (or exported)
      // through the admin endpoint, re-running the install must not move it back.
      set: {
        label: node.label,
        releaseStage: sql`CASE WHEN ${curriculumNodes.releaseStage} IN ('approved', 'export_ready') THEN ${curriculumNodes.releaseStage} ELSE ${node.releaseStage} END`,
        updatedAt: new Date(),
      },
    });
  }

  const edges = EXEMPLAR_TOPICS.flatMap((topic) => {
    const topicNodeId = nodeId("topic", topic.id);
    const relationships = [
      { id: nodeId("edge", `${topic.id}-category`), fromNodeId: nodeId("category", topic.categoryId), toNodeId: topicNodeId, relationship: "contains" },
      ...topic.objectives.map((_, index) => ({ id: nodeId("edge", `${topic.id}-objective-${index + 1}`), fromNodeId: topicNodeId, toNodeId: nodeId("objective", `${topic.id}-${index + 1}`), relationship: "contains" })),
      ...topic.integratedProcesses.map((process) => ({ id: nodeId("edge", `${topic.id}-process-${process}`), fromNodeId: topicNodeId, toNodeId: nodeId("integrated-process", process), relationship: "maps_to" })),
      ...NCJMM_FUNCTIONS.map((fn) => ({ id: nodeId("edge", `${topic.id}-ncjmm-${fn}`), fromNodeId: topicNodeId, toNodeId: nodeId("ncjmm", fn), relationship: "maps_to" })),
    ];
    return relationships;
  });
  for (const edge of edges) {
    await db.insert(curriculumEdges).values({ ...edge, frameworkId: NCLEX_FRAMEWORK_ID }).onConflictDoNothing();
  }

  const sources = Array.from(new Map(EXEMPLAR_TOPICS.flatMap((topic) => topic.sources).map((source) => [source.id, source])).values());
  for (const source of sources) {
    await db.insert(curriculumEvidenceSources).values({
      id: source.id,
      frameworkId: NCLEX_FRAMEWORK_ID,
      title: source.title,
      publisher: source.publisher,
      license: source.license,
      sourceUri: source.sourceUri,
      locator: source.locator,
      approvalStatus: source.approvalStatus,
    }).onConflictDoUpdate({
      target: curriculumEvidenceSources.id,
      set: { locator: source.locator, approvalStatus: source.approvalStatus, updatedAt: new Date() },
    });
  }

  return { frameworkId: NCLEX_FRAMEWORK_ID, nodes: categoryNodes.length + processNodes.length + judgmentNodes.length + topicNodes.length + objectiveNodes.length, edges: edges.length, sources: sources.length };
}
