import type { Express, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAdminSession, type AdminAuthRequest } from "../admin-auth-session";
import { getNodeDetail, listFrameworks, listNodes } from "../curriculum/curriculum-read";
import { ensureLessonBuilderTables } from "./lesson-builder-routes";

// Read-only admin endpoints over the curriculum graph. Nothing here writes.

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
}
