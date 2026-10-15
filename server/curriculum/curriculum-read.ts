import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  curriculumEdges,
  curriculumEvidenceSources,
  curriculumFrameworks,
  curriculumNodes,
  curriculumObjectiveMappings,
  lessonPackages,
  sourceRegistry,
} from "@shared/schema";
import type { CurriculumDb } from "./curriculum-repo";

// Read side of the curriculum graph (WP3). Pure queries; nothing here writes.

export interface FrameworkSummary {
  id: string;
  title: string;
  version: string;
  audience: string | null;
  status: string;
  nodeCounts: Record<string, number>;
}

export async function listFrameworks(db: CurriculumDb): Promise<FrameworkSummary[]> {
  const frameworks = await db.select().from(curriculumFrameworks).orderBy(asc(curriculumFrameworks.title));
  const counts = await db
    .select({ frameworkId: curriculumNodes.frameworkId, nodeType: curriculumNodes.nodeType, n: sql<number>`count(*)::int` })
    .from(curriculumNodes)
    .groupBy(curriculumNodes.frameworkId, curriculumNodes.nodeType);
  return frameworks.map((framework) => ({
    id: framework.id,
    title: framework.title,
    version: framework.version,
    audience: framework.audience ?? null,
    status: framework.status,
    nodeCounts: Object.fromEntries(
      counts.filter((row) => row.frameworkId === framework.id).map((row) => [row.nodeType, row.n]),
    ),
  }));
}

export interface NodeListItem {
  id: string;
  frameworkId: string;
  nodeType: string;
  code: string;
  label: string;
  releaseStage: string;
  safetyRisk: string;
  objectiveCount: number;
  lessonCount: number;
}

export interface NodeListFilter {
  frameworkId?: string;
  nodeType?: string;
  q?: string;
  limit?: number;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listNodes(db: CurriculumDb, filter: NodeListFilter = {}): Promise<NodeListItem[]> {
  const conditions = [];
  if (filter.frameworkId) conditions.push(eq(curriculumNodes.frameworkId, filter.frameworkId));
  if (filter.nodeType) conditions.push(eq(curriculumNodes.nodeType, filter.nodeType));
  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`;
    conditions.push(sql`(${curriculumNodes.label} ILIKE ${pattern} OR ${curriculumNodes.code} ILIKE ${pattern})`);
  }
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);
  return db
    .select({
      id: curriculumNodes.id,
      frameworkId: curriculumNodes.frameworkId,
      nodeType: curriculumNodes.nodeType,
      code: curriculumNodes.code,
      label: curriculumNodes.label,
      releaseStage: curriculumNodes.releaseStage,
      safetyRisk: curriculumNodes.safetyRisk,
      objectiveCount: sql<number>`(
        SELECT count(*)::int FROM curriculum_edges e
        JOIN curriculum_nodes c ON c.id = e.to_node_id
        WHERE e.from_node_id = curriculum_nodes.id AND e.relationship = 'contains' AND c.node_type = 'objective'
      )`,
      lessonCount: sql<number>`(
        SELECT count(DISTINCT p.id)::int FROM lesson_packages p
        WHERE p.primary_node_id = curriculum_nodes.id
           OR p.id IN (SELECT m.package_id FROM curriculum_objective_mappings m WHERE m.objective_node_id = curriculum_nodes.id)
      )`,
    })
    .from(curriculumNodes)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(curriculumNodes.nodeType), asc(curriculumNodes.code))
    .limit(limit);
}

type NodeRow = typeof curriculumNodes.$inferSelect;

export async function getNode(db: CurriculumDb, id: string): Promise<NodeRow | null> {
  const [node] = await db.select().from(curriculumNodes).where(eq(curriculumNodes.id, id)).limit(1);
  return node ?? null;
}

/** Walks incoming `contains` edges toward the root: objective -> topic -> category. */
export async function getAncestry(db: CurriculumDb, id: string): Promise<NodeRow[]> {
  const chain: NodeRow[] = [];
  const seen = new Set<string>([id]);
  let current = id;
  for (let depth = 0; depth < 10; depth += 1) {
    const [edge] = await db
      .select({ fromNodeId: curriculumEdges.fromNodeId })
      .from(curriculumEdges)
      .where(and(eq(curriculumEdges.toNodeId, current), eq(curriculumEdges.relationship, "contains")))
      .limit(1);
    if (!edge || seen.has(edge.fromNodeId)) break;
    const parent = await getNode(db, edge.fromNodeId);
    if (!parent) break;
    chain.push(parent);
    seen.add(parent.id);
    current = parent.id;
  }
  return chain;
}

/** Outgoing edges: `contains` objectives and `maps_to` integrated processes and NCJMM functions. */
export async function getNodeLinks(db: CurriculumDb, id: string) {
  const edges = await db.select().from(curriculumEdges).where(eq(curriculumEdges.fromNodeId, id));
  const targetIds = [...new Set(edges.map((edge) => edge.toNodeId))];
  const targets = targetIds.length ? await db.select().from(curriculumNodes).where(inArray(curriculumNodes.id, targetIds)) : [];
  const byId = new Map(targets.map((node) => [node.id, node]));
  const linked = edges.flatMap((edge) => {
    const node = byId.get(edge.toNodeId);
    return node ? [{ relationship: edge.relationship, node }] : [];
  });
  const pick = (relationship: string, nodeType: string) =>
    linked
      .filter((link) => link.relationship === relationship && link.node.nodeType === nodeType)
      .map((link) => link.node)
      .sort((a, b) => a.code.localeCompare(b.code));
  return {
    objectives: pick("contains", "objective"),
    integratedProcesses: pick("maps_to", "integrated_process"),
    judgmentFunctions: pick("maps_to", "ncjmm"),
  };
}

/** Objectives of a topic that a lesson may cite: only those approved. */
export async function getApprovedObjectives(db: CurriculumDb, topicNodeId: string): Promise<NodeRow[]> {
  const { objectives } = await getNodeLinks(db, topicNodeId);
  return objectives.filter((objective) => objective.releaseStage === "approved");
}

/**
 * Evidence source ids a node cites (`metadata.evidenceSourceIds`), as written. Callers decide
 * which of them are approved and licence-clean; nothing is filtered here.
 */
export async function getEvidenceSourceIds(db: CurriculumDb, id: string): Promise<string[]> {
  const node = await getNode(db, id);
  const own = (node?.metadata as Record<string, unknown> | null | undefined)?.evidenceSourceIds;
  return Array.isArray(own) ? own.filter((value): value is string => typeof value === "string") : [];
}

export async function getNodeDetail(db: CurriculumDb, id: string) {
  const node = await getNode(db, id);
  if (!node) return null;
  const [ancestry, links, evidenceSourceIds, packages, mappingRows, frameworkSources] = await Promise.all([
    getAncestry(db, id),
    getNodeLinks(db, id),
    getEvidenceSourceIds(db, id),
    db
      .select({
        id: lessonPackages.id,
        title: lessonPackages.title,
        status: lessonPackages.status,
        releaseStage: lessonPackages.releaseStage,
        generationMode: lessonPackages.generationMode,
        updatedAt: lessonPackages.updatedAt,
      })
      .from(lessonPackages)
      .where(eq(lessonPackages.primaryNodeId, id)),
    db
      .select({ targetKind: curriculumObjectiveMappings.targetKind, n: sql<number>`count(*)::int` })
      .from(curriculumObjectiveMappings)
      .where(eq(curriculumObjectiveMappings.objectiveNodeId, id))
      .groupBy(curriculumObjectiveMappings.targetKind),
    node.nodeType === "topic"
      ? db.select().from(curriculumEvidenceSources).where(eq(curriculumEvidenceSources.frameworkId, node.frameworkId))
      : Promise.resolve([]),
  ]);
  const registrySources = evidenceSourceIds.length
    ? await db
        .select({
          id: sourceRegistry.id,
          title: sourceRegistry.title,
          sourceUri: sourceRegistry.sourceUri,
          approvalStatus: sourceRegistry.approvalStatus,
        })
        .from(sourceRegistry)
        .where(inArray(sourceRegistry.id, evidenceSourceIds))
    : [];
  return {
    node,
    ancestry,
    ...links,
    evidenceSources: { registry: registrySources, framework: frameworkSources },
    packages,
    mappings: Object.fromEntries(mappingRows.map((row) => [row.targetKind, row.n])),
  };
}
