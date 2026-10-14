import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { curriculumEdges, curriculumNodes } from "@shared/schema";
import { NCJMM_FUNCTIONS } from "@shared/nclex-rn-2026";
import { nodeId, type CurriculumDb } from "./curriculum-repo";

// Writes to the curriculum graph (WP4): author an objective under a topic, and move a node's
// release stage. Both record who acted in the node's metadata.

export const MAX_OBJECTIVES_PER_TOPIC = 12;

/** Stages an admin may set. `export_ready` is reached through the release process, not here. */
export const SETTABLE_RELEASE_STAGES = ["draft", "clinical_review", "approved"] as const;
export type SettableReleaseStage = (typeof SETTABLE_RELEASE_STAGES)[number];

export const addObjectiveSchema = z.object({
  label: z.string().trim().min(10, "An objective needs at least 10 characters").max(300),
  bloomLevel: z.enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]).optional(),
  cjmFunction: z.enum(NCJMM_FUNCTIONS).optional(),
});
export type AddObjectiveInput = z.infer<typeof addObjectiveSchema>;

export const releaseStageSchema = z.object({ releaseStage: z.enum(SETTABLE_RELEASE_STAGES) });

export class CurriculumWriteError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
  }
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Adds a draft objective under a topic node. The id and code continue the convention of the
 * installed exemplar objectives: `<framework>:objective:<topic>-<n>` and `<topic>-objective-<n>`.
 * A new objective starts in `draft`; lessons may cite it only after it is approved.
 */
export async function addObjective(db: CurriculumDb, topicNodeId: string, input: AddObjectiveInput, actor: string | null) {
  return db.transaction(async (tx) => {
    const [topic] = await tx.select().from(curriculumNodes).where(eq(curriculumNodes.id, topicNodeId)).limit(1);
    if (!topic) throw new CurriculumWriteError(404, "Curriculum node not found");
    if (topic.nodeType !== "topic") throw new CurriculumWriteError(400, "Objectives can only be added to a topic node");

    const children = await tx
      .select({ id: curriculumNodes.id, label: curriculumNodes.label, code: curriculumNodes.code })
      .from(curriculumEdges)
      .innerJoin(curriculumNodes, eq(curriculumNodes.id, curriculumEdges.toNodeId))
      .where(and(eq(curriculumEdges.fromNodeId, topic.id), eq(curriculumEdges.relationship, "contains"), eq(curriculumNodes.nodeType, "objective")));
    if (children.length >= MAX_OBJECTIVES_PER_TOPIC) {
      throw new CurriculumWriteError(409, `A topic holds at most ${MAX_OBJECTIVES_PER_TOPIC} objectives`);
    }
    if (children.some((child) => normalize(child.label) === normalize(input.label))) {
      throw new CurriculumWriteError(409, "This topic already has an objective with the same wording");
    }

    const used = children
      .map((child) => Number(child.code.match(/-objective-(\d+)$/)?.[1]))
      .filter((value) => Number.isInteger(value));
    const ordinal = (used.length ? Math.max(...used) : 0) + 1;
    const id = nodeId("objective", `${topic.code}-${ordinal}`);
    const now = new Date();

    const [objective] = await tx.insert(curriculumNodes).values({
      id,
      frameworkId: topic.frameworkId,
      nodeType: "objective",
      code: `${topic.code}-objective-${ordinal}`,
      label: input.label,
      safetyRisk: topic.safetyRisk,
      releaseStage: "draft",
      metadata: {
        topicId: topic.code,
        source: "authored",
        authoredBy: actor,
        authoredAt: now.toISOString(),
        ...(input.bloomLevel ? { bloomLevel: input.bloomLevel } : {}),
        ...(input.cjmFunction ? { cjmFunction: input.cjmFunction } : {}),
      },
    }).returning();
    await tx.insert(curriculumEdges).values({
      id: nodeId("edge", `${topic.code}-objective-${ordinal}`),
      frameworkId: topic.frameworkId,
      fromNodeId: topic.id,
      toNodeId: id,
      relationship: "contains",
    });
    return objective;
  });
}

/** Moves a node between draft, clinical_review and approved, recording the actor. */
export async function setNodeReleaseStage(db: CurriculumDb, id: string, stage: SettableReleaseStage, actor: string | null) {
  const [node] = await db.select().from(curriculumNodes).where(eq(curriculumNodes.id, id)).limit(1);
  if (!node) throw new CurriculumWriteError(404, "Curriculum node not found");
  if (node.releaseStage === "export_ready") {
    throw new CurriculumWriteError(409, "An export-ready node cannot be moved from this endpoint");
  }
  const now = new Date();
  const entry = { from: node.releaseStage, to: stage, by: actor, at: now.toISOString() };
  const [updated] = await db
    .update(curriculumNodes)
    .set({
      releaseStage: stage,
      updatedAt: now,
      metadata: sql`jsonb_set(coalesce(${curriculumNodes.metadata}, '{}'::jsonb), '{stageHistory}', coalesce(${curriculumNodes.metadata}->'stageHistory', '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb)`,
    })
    .where(eq(curriculumNodes.id, id))
    .returning();
  return updated;
}
