import type { Express, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAdminSession, validateCSRFToken, type AdminAuthRequest } from "../admin-auth-session";
import { getNodeDetail, listFrameworks, listNodes } from "../curriculum/curriculum-read";
import {
  addObjective,
  addObjectiveSchema,
  CurriculumWriteError,
  releaseStageSchema,
  setNodeReleaseStage,
} from "../curriculum/curriculum-write";
import { ensureLessonBuilderTables } from "./lesson-builder-routes";

// Admin endpoints over the curriculum graph: three reads, plus authoring an objective and
// moving a node's release stage (admin session and CSRF token required).

const nodeListQuery = z.object({
  frameworkId: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export function registerCurriculumGraphRoutes(app: Express) {
  app.get("/api/admin/curriculum/frameworks", requireAdminSession, async (_req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      res.json({ frameworks: await listFrameworks(db) });
    } catch (error) {
      console.error("Curriculum frameworks error:", error);
      res.status(500).json({ error: "Failed to load curriculum frameworks" });
    }
  });

  app.get("/api/admin/curriculum/nodes", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    const parsed = nodeListQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid node query", details: parsed.error.errors });
    try {
      await ensureLessonBuilderTables();
      const { frameworkId, type, q, limit } = parsed.data;
      res.json({ nodes: await listNodes(db, { frameworkId, nodeType: type, q, limit }) });
    } catch (error) {
      console.error("Curriculum nodes error:", error);
      res.status(500).json({ error: "Failed to load curriculum nodes" });
    }
  });

  app.get("/api/admin/curriculum/nodes/:id", requireAdminSession, async (req: AdminAuthRequest, res: Response) => {
    try {
      await ensureLessonBuilderTables();
      const detail = await getNodeDetail(db, req.params.id);
      if (!detail) return res.status(404).json({ error: "Curriculum node not found" });
      res.json(detail);
    } catch (error) {
      console.error("Curriculum node detail error:", error);
      res.status(500).json({ error: "Failed to load curriculum node" });
    }
  });

  app.post("/api/admin/curriculum/nodes/:id/objectives", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    const parsed = addObjectiveSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid objective", details: parsed.error.errors });
    try {
      await ensureLessonBuilderTables();
      const objective = await addObjective(db, req.params.id, parsed.data, req.session.adminUser?.userId ?? null);
      res.status(201).json({ objective });
    } catch (error) {
      if (error instanceof CurriculumWriteError) return res.status(error.status).json({ error: error.message });
      console.error("Curriculum add objective error:", error);
      res.status(500).json({ error: "Failed to add objective" });
    }
  });

  app.patch("/api/admin/curriculum/nodes/:id/release-stage", requireAdminSession, validateCSRFToken, async (req: AdminAuthRequest, res: Response) => {
    const parsed = releaseStageSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid release stage", details: parsed.error.errors });
    try {
      await ensureLessonBuilderTables();
      const node = await setNodeReleaseStage(db, req.params.id, parsed.data.releaseStage, req.session.adminUser?.userId ?? null);
      res.json({ node });
    } catch (error) {
      if (error instanceof CurriculumWriteError) return res.status(error.status).json({ error: error.message });
      console.error("Curriculum release stage error:", error);
      res.status(500).json({ error: "Failed to update release stage" });
    }
  });
}
