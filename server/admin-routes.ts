import type { Express, Request, Response } from "express";
import { resourceIndexer } from "./resource-indexer";
import { z } from "zod";
import { AdminAuthSession, requireAdminSession, requirePermission, auditLog, validateCSRFToken, type AdminAuthRequest } from "./admin-auth-session";
import { AdminManagementService } from "./admin-management";
import { db } from "./db";
import { 
  users, 
  adminUsers, 
  topicsNeedingResources, 
  nursingTopics, 
  learningResources, 
  assessmentReports, 
  documents, 
  documentChunks,
  extractedTables,
  tableCells,
  tableApprovals,
  tableTopicMappings,
  sourceRegistry,
  type ExtractedTable,
  type TableCell,
  type InsertTableApproval,
  type InsertTableTopicMapping
} from "@shared/schema";
import { eq, desc, asc, and, sql, isNull, or, like, inArray } from "drizzle-orm";
import { AIProcessor } from "./ai-processor";
import { storage } from "./storage";
import { DemandAnalytics } from "./demand-analytics";
import { callBookingSystem } from "./call-booking-system";
import { DocumentProcessor } from "./document-processor";
import { JobManager } from "./job-manager";
import { RAGService } from "./rag-service";
import { importDataChunkerLocalPath, isDataChunkerBundleUpload, tryImportDataChunkerUpload } from "./data-chunker-importer";
import { buildAnswerPrompt, buildStudyGuidePrompt } from "./prompts";
import multer from "multer";
import { ragCitations } from "@shared/schema";
import * as crypto from "crypto";

// RAG Request validation schemas
const RagSearchSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    topicIds: z.array(z.string()).optional(),
    documentIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    minScore: z.number().min(0).max(1).optional(),
    dateRange: z.object({
      start: z.string().transform(s => new Date(s)),
      end: z.string().transform(s => new Date(s))
    }).optional()
  }).optional(),
  options: z.object({
    alpha: z.number().min(0).max(1).default(0.7),
    limit: z.number().min(1).max(50).default(10),
    offset: z.number().min(0).default(0),
    includeContext: z.boolean().default(false),
    rerank: z.boolean().default(true),
    mmr: z.boolean().default(true),
    mmrLambda: z.number().min(0).max(1).default(0.5)
  }).optional()
});

const RagAnswerSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.object({
    topicIds: z.array(z.string()).optional(),
    documentIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).optional(),
  options: z.object({
    maxTokens: z.number().min(50).max(2000).default(500),
    temperature: z.number().min(0).max(1).default(0.3),
    audience: z.enum(['student', 'professional', 'general']).default('student'),
    includeExplanation: z.boolean().default(true),
    searchLimit: z.number().min(1).max(20).default(10)
  }).optional()
});

const RagExplainSchema = z.object({
  concept: z.string().min(1).max(200),
  targetAudience: z.enum(['student', 'professional']).default('student'),
  filters: z.object({
    topicIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).optional()
});

async function ensureKnowledgeBaseSourceForDocument(document: any, adminId: string) {
  const sourceChunks = await db
    .select({
      cleanText: documentChunks.cleanText,
      rawText: documentChunks.rawText,
    })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, document.id))
    .orderBy(asc(documentChunks.chunkIndex))
    .limit(8);

  const ingestionStatus = sourceChunks.length > 0 ? "ready" : "processing";
  const evidenceSnippets = sourceChunks
    .map((chunk) => String(chunk.cleanText || chunk.rawText || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => text.length > 1200 ? `${text.slice(0, 1200)}...` : text);

  const metadata = document.metadata || {};
  const sourceMetadata = {
    intakeDocumentId: document.id,
    contentHash: document.contentHash,
    localFileName: metadata.originalName || document.title,
    evidenceSnippets,
    chunkCount: sourceChunks.length,
  };

  const [existing] = await db
    .select()
    .from(sourceRegistry)
    .where(eq(sourceRegistry.documentId, document.id))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(sourceRegistry)
      .set({
        ingestionStatus,
        metadata: {
          ...(existing.metadata || {}),
          ...sourceMetadata,
        },
        updatedAt: new Date(),
      })
      .where(eq(sourceRegistry.id, existing.id))
      .returning();
    return updated;
  }

  const [source] = await db
    .insert(sourceRegistry)
    .values({
      title: document.title,
      sourceKind: metadata.sourceKind || "knowledge_base_upload",
      sourceType: metadata.sourceType || document.type || "uploaded_document",
      sourceUri: document.sourceUri || `knowledge-base:${document.id}`,
      driveFileId: document.id,
      documentId: document.id,
      subject: metadata.subject || "Uploaded file intake",
      edition: metadata.edition || metadata.originalName || document.title,
      citationPolicy: "cite_paraphrase",
      approvalStatus: "approved",
      ingestionStatus,
      metadata: sourceMetadata,
      createdBy: adminId || null,
    })
    .returning();

  return source;
}

// Table management validation schemas
const TableApprovalSchema = z.object({
  tableId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
  editedTitle: z.string().optional(),
  topicMappings: z.array(z.string()).optional() // Topic IDs to map to this table
});

const TableEditSchema = z.object({
  tableId: z.string().uuid(),
  edits: z.array(z.object({
    rowIndex: z.number().min(0),
    columnIndex: z.number().min(0),
    newContent: z.string(),
    validationNotes: z.string().optional()
  }))
});

const TableBulkActionSchema = z.object({
  tableIds: z.array(z.string().uuid()),
  action: z.enum(['approve', 'reject', 'delete']),
  notes: z.string().optional()
});

const TableSearchSchema = z.object({
  query: z.string().min(1).max(200).optional(),
  documentId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  confidence: z.object({
    min: z.number().min(0).max(1).optional(),
    max: z.number().min(0).max(1).optional()
  }).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

// Resource validation schema
const ResourceSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  type: z.enum(['video', 'article', 'practice', 'textbook', 'quiz', 'simulation']),
  url: z.string().optional(),
  provider: z.string().optional(),
  duration: z.number().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  tags: z.array(z.string()),
  topics: z.array(z.string()),
  diagnoses: z.array(z.string()).optional(),
  systems: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  keywords: z.array(z.string()),
  metadata: z.object({
    author: z.string().optional(),
    publishDate: z.string().optional(),
    lastUpdated: z.string().optional(),
    views: z.number().optional(),
    rating: z.number().optional(),
    license: z.string().optional(),
    cost: z.enum(['free', 'paid', 'subscription']).optional()
  }),
  mappings: z.object({
    nclexCategory: z.string().optional(),
    textbookChapter: z.string().optional(),
    courseWeek: z.number().optional(),
    learningObjectives: z.array(z.string()).optional()
  }),
  quality: z.object({
    accuracy: z.number().min(0).max(100).optional(),
    relevance: z.number().min(0).max(100).optional(),
    engagement: z.number().min(0).max(100).optional(),
    effectivenessScore: z.number().optional()
  })
});

const PUBLIC_PILOT_REQUEST_SOURCE = "public_launch_mfp";
const publicPilotRequestStatuses = ["new", "qualified", "follow_up", "demo_ready", "closed_won", "closed_lost"] as const;

const pilotRequestUpdateSchema = z.object({
  status: z.enum(publicPilotRequestStatuses).optional(),
  adminNotes: z.string().trim().max(4000).optional(),
  followUpDate: z.string().trim().max(40).nullable().optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  interestedTopics: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
});

function parseNullableDate(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid follow-up date");
  }
  return date;
}

function publicPilotRequestPayload(lead: any) {
  const customFields = (lead.customFields || {}) as Record<string, any>;
  return {
    id: lead.id,
    status: lead.status || "new",
    score: lead.score || 0,
    source: lead.source,
    contactName: lead.contactName || "",
    contactEmail: lead.contactEmail || "",
    contactPhone: lead.contactPhone || "",
    companyName: lead.companyName || "",
    jobTitle: lead.jobTitle || "",
    industry: lead.industry || "",
    interestedTopics: Array.isArray(lead.interestedTopics) ? lead.interestedTopics : [],
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    pilotGoal: customFields.pilotGoal || "",
    adminNotes: customFields.adminNotes || "",
    reviewedAt: customFields.reviewedAt || null,
    followUpDate: lead.followUpDate,
    firstContactDate: lead.firstContactDate,
    lastContactDate: lead.lastContactDate,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

function publicPilotRequestSummary(requests: ReturnType<typeof publicPilotRequestPayload>[]) {
  const statusCounts = publicPilotRequestStatuses.reduce<Record<string, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  for (const request of requests) {
    statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
  }

  const openStatuses = new Set(["new", "qualified", "follow_up", "demo_ready"]);
  return {
    total: requests.length,
    open: requests.filter((request) => openStatuses.has(request.status)).length,
    qualified: statusCounts.qualified || 0,
    followUp: statusCounts.follow_up || 0,
    demoReady: statusCounts.demo_ready || 0,
    closed: (statusCounts.closed_won || 0) + (statusCounts.closed_lost || 0),
    statusCounts,
    newestRequest: requests[0] || null,
  };
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function publicPilotRequestsCsv(requests: ReturnType<typeof publicPilotRequestPayload>[]) {
  const columns: Array<[string, (request: ReturnType<typeof publicPilotRequestPayload>) => unknown]> = [
    ["id", (request) => request.id],
    ["status", (request) => request.status],
    ["score", (request) => request.score],
    ["contact_name", (request) => request.contactName],
    ["contact_email", (request) => request.contactEmail],
    ["contact_phone", (request) => request.contactPhone],
    ["organization", (request) => request.companyName],
    ["role", (request) => request.jobTitle],
    ["organization_type", (request) => request.industry],
    ["pilot_goal", (request) => request.pilotGoal],
    ["interested_topics", (request) => request.interestedTopics],
    ["admin_notes", (request) => request.adminNotes],
    ["follow_up_date", (request) => request.followUpDate],
    ["created_at", (request) => request.createdAt],
  ];

  return [
    columns.map(([header]) => csvCell(header)).join(","),
    ...requests.map((request) => columns.map(([, accessor]) => csvCell(accessor(request))).join(",")),
  ].join("\n");
}

export function registerAdminRoutes(app: Express) {
  // Use session-based authentication for admin routes
  const requireAdmin = [requireAdminSession];

  // Admin login endpoint with session-based auth
  app.post("/api/admin/login", auditLog('ADMIN_LOGIN'), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Use session-based authentication
      const result = await AdminAuthSession.login(req, email, password);
      
      // Session cookie is automatically handled by express-session
      // No need to manually set admin_session cookie
      
      res.json({
        success: true,
        user: result.user,
        csrfToken: result.csrfToken
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // Admin logout endpoint
  app.post("/api/admin/logout", requireAdmin, validateCSRFToken, auditLog('ADMIN_LOGOUT'), async (req: Request, res: Response) => {
    try {
      await AdminAuthSession.logout(req);
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  // Check admin session status
  app.get("/api/admin/session", async (req: Request, res: Response) => {
    if (AdminAuthSession.isSessionValid(req)) {
      res.json({
        authenticated: true,
        user: {
          email: req.session.adminUser?.email,
          role: req.session.adminUser?.role,
          permissions: req.session.adminUser?.permissions
        },
        csrfToken: AdminAuthSession.getCSRFToken(req.sessionID)
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Get admin dashboard statistics
  app.get("/api/admin/stats", requireAdmin, auditLog('VIEW_STATS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      // Get counts for various entities
      const [userCount] = await db.select({ count: sql`count(*)` }).from(users);
      const [reportCount] = await db.select({ count: sql`count(*)` }).from(assessmentReports);
      const [topicCount] = await db.select({ count: sql`count(*)` }).from(nursingTopics);
      const [resourceCount] = await db.select({ count: sql`count(*)` }).from(learningResources);
      const [topicsNeedingResourcesCount] = await db
        .select({ count: sql`count(*)` })
        .from(topicsNeedingResources)
        .where(eq(topicsNeedingResources.resolved, false));

      // Get recent activity
      const recentReports = await db
        .select()
        .from(assessmentReports)
        .orderBy(desc(assessmentReports.uploadDate))
        .limit(5);

      const recentUsers = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          createdAt: users.createdAt
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(5);

      res.json({
        stats: {
          totalUsers: Number(userCount.count),
          totalReports: Number(reportCount.count),
          totalTopics: Number(topicCount.count),
          totalResources: Number(resourceCount.count),
          topicsNeedingResources: Number(topicsNeedingResourcesCount.count)
        },
        recentActivity: {
          reports: recentReports,
          users: recentUsers
        }
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Get topics needing resources
  app.get("/api/admin/topics-queue", requireAdmin, auditLog('VIEW_TOPICS_QUEUE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const topicsQueue = await db
        .select({
          id: topicsNeedingResources.id,
          topicId: topicsNeedingResources.topicId,
          topicName: topicsNeedingResources.topicName,
          requestCount: topicsNeedingResources.requestCount,
          priority: topicsNeedingResources.priority,
          firstRequested: topicsNeedingResources.firstRequested,
          lastRequested: topicsNeedingResources.lastRequested,
          resolved: topicsNeedingResources.resolved
        })
        .from(topicsNeedingResources)
        .where(eq(topicsNeedingResources.resolved, false))
        .orderBy(desc(topicsNeedingResources.priority), desc(topicsNeedingResources.requestCount));

      res.json(topicsQueue);
    } catch (error) {
      console.error("Error fetching topics queue:", error);
      res.status(500).json({ error: "Failed to fetch topics queue" });
    }
  });

  // Get topic details
  app.get("/api/admin/topics-queue/:id/details", requireAdmin, auditLog('VIEW_TOPIC_DETAILS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Get topic basic information
      const [topic] = await db
        .select()
        .from(topicsNeedingResources)
        .where(eq(topicsNeedingResources.id, id));

      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Get linked resources
      const linkedResources = await db
        .select({
          id: learningResources.id,
          title: learningResources.title,
          type: learningResources.type,
          url: learningResources.url,
          chapterNumber: learningResources.chapterNumber,
          pageNumbers: learningResources.pageNumbers,
          duration: learningResources.duration,
        })
        .from(learningResources)
        .where(eq(learningResources.topicId, topic.topicId));

      // Get request history (mock data for now - could be enhanced with actual tracking)
      const requestHistory = [
        {
          date: topic.firstRequested,
          count: Math.ceil((topic.requestCount || 1) / 3),
          source: "Assessment Analysis"
        },
        {
          date: topic.lastRequested,
          count: Math.ceil((topic.requestCount || 1) / 2),
          source: "Student Request"
        }
      ];

      // Calculate analytics (mock data for now - could be enhanced with actual analytics)
      const analytics = {
        totalStudentsAffected: Math.floor((topic.requestCount || 1) * 1.5),
        averageGapScore: 65 + ((topic.priority || 0) * 2),
        mostCommonSource: "Assessment Analysis",
        trendDirection: (topic.requestCount || 0) > 5 ? "up" : (topic.requestCount || 0) < 2 ? "down" : "stable"
      };

      res.json({
        ...topic,
        linkedResources,
        requestHistory,
        analytics
      });
    } catch (error) {
      console.error("Error fetching topic details:", error);
      res.status(500).json({ error: "Failed to fetch topic details" });
    }
  });

  // Update topic priority
  app.patch("/api/admin/topics-queue/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_TOPIC'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { topicName, priority, resolved, notes } = req.body;

      const updates: any = {};
      if (topicName !== undefined) updates.topicName = topicName;
      if (priority !== undefined) updates.priority = priority;
      if (resolved !== undefined) {
        updates.resolved = resolved;
        if (resolved) updates.resolvedAt = new Date();
      }
      if (notes !== undefined) updates.notes = notes;

      await db
        .update(topicsNeedingResources)
        .set(updates)
        .where(eq(topicsNeedingResources.id, id));

      res.json({ message: "Topic queue item updated successfully" });
    } catch (error) {
      console.error("Error updating topic queue:", error);
      res.status(500).json({ error: "Failed to update topic queue item" });
    }
  });

  // Get all resources with filtering
  app.get("/api/admin/resources", requireAdmin, auditLog('VIEW_RESOURCES'), (req: AdminAuthRequest, res: Response) => {
    try {
      const { type, topic, system } = req.query;
      const resources = resourceIndexer.exportResources({
        type: type as string,
        topic: topic as string,
        system: system as string
      });
      
      res.json({
        resources,
        total: resources.length
      });
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  // Search resources
  app.get("/api/admin/resources/search", requireAdmin, (req: Request, res: Response) => {
    try {
      const { q, type, difficulty, topic, diagnosis, system, limit } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const results = resourceIndexer.searchResources(q as string, {
        type: type as string,
        difficulty: difficulty as string,
        topic: topic as string,
        diagnosis: diagnosis as string,
        system: system as string,
        maxResults: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        results,
        total: results.length
      });
    } catch (error) {
      console.error("Error searching resources:", error);
      res.status(500).json({ error: "Failed to search resources" });
    }
  });

  // Add new resource
  app.post("/api/admin/resources", requireAdmin, validateCSRFToken, auditLog('ADD_RESOURCE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const resourceData = ResourceSchema.parse(req.body);
      
      // Generate ID if not provided
      if (!resourceData.id) {
        resourceData.id = `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const indexed = resourceIndexer.addResource(resourceData as any);
      
      res.json({
        message: "Resource added successfully",
        resource: indexed
      });
    } catch (error) {
      console.error("Error adding resource:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid resource data",
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to add resource" });
    }
  });

  // Update resource
  app.put("/api/admin/resources/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_RESOURCE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const resourceData = ResourceSchema.parse({ ...req.body, id });
      
      // Remove old resource and add updated one
      const updated = resourceIndexer.addResource(resourceData as any);
      
      res.json({
        message: "Resource updated successfully",
        resource: updated
      });
    } catch (error) {
      console.error("Error updating resource:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid resource data",
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to update resource" });
    }
  });

  // Bulk import resources
  app.post("/api/admin/resources/bulk", requireAdmin, validateCSRFToken, auditLog('BULK_IMPORT'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { resources } = req.body;
      
      if (!Array.isArray(resources)) {
        return res.status(400).json({ error: "Resources must be an array" });
      }

      const result = resourceIndexer.bulkImport(resources);
      
      res.json({
        message: "Bulk import completed",
        ...result
      });
    } catch (error) {
      console.error("Error in bulk import:", error);
      res.status(500).json({ error: "Failed to import resources" });
    }
  });

  // Map topics to resources
  app.post("/api/admin/resources/map-topics", requireAdmin, (req: Request, res: Response) => {
    try {
      const { topics, maxPerTopic } = req.body;
      
      if (!Array.isArray(topics)) {
        return res.status(400).json({ error: "Topics must be an array" });
      }

      const mapping = resourceIndexer.mapTopicsToResources(
        topics,
        maxPerTopic || 3
      );

      // Convert Map to object for JSON response
      const result: Record<string, any> = {};
      mapping.forEach((resources, topic) => {
        result[topic] = resources;
      });

      res.json({
        mapping: result,
        topicsCount: topics.length,
        totalResources: Object.values(result).flat().length
      });
    } catch (error) {
      console.error("Error mapping topics:", error);
      res.status(500).json({ error: "Failed to map topics to resources" });
    }
  });

  // Get resource recommendations
  app.post("/api/admin/resources/recommendations", requireAdmin, (req: Request, res: Response) => {
    try {
      const { weakTopics, difficulty, preferredTypes } = req.body;
      
      if (!Array.isArray(weakTopics)) {
        return res.status(400).json({ error: "Weak topics must be an array" });
      }

      const recommendations = resourceIndexer.getRecommendations(
        weakTopics,
        difficulty || 'intermediate',
        preferredTypes
      );

      res.json({
        recommendations,
        count: recommendations.length
      });
    } catch (error) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  // Get resource statistics
  app.get("/api/admin/resources/stats", requireAdmin, (req: Request, res: Response) => {
    try {
      const stats = resourceIndexer.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error getting statistics:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // Export resources as JSON
  app.get("/api/admin/resources/export", requireAdmin, (req: Request, res: Response) => {
    try {
      const { type, topic, system } = req.query;
      const resources = resourceIndexer.exportResources({
        type: type as string,
        topic: topic as string,
        system: system as string
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="resources-export.json"');
      res.json(resources);
    } catch (error) {
      console.error("Error exporting resources:", error);
      res.status(500).json({ error: "Failed to export resources" });
    }
  });

  // Initialize with sample resources for testing
  app.post("/api/admin/resources/init-sample", requireAdmin, (req: Request, res: Response) => {
    try {
      const sampleResources = [
        {
          id: "res-1",
          title: "Pharmacology Fundamentals",
          type: "video" as const,
          url: "https://example.com/pharm-basics",
          provider: "NurseEducator",
          duration: 45,
          difficulty: "beginner" as const,
          tags: ["pharmacology", "medications", "basics"],
          topics: ["Pharmacology", "Drug Administration"],
          diagnoses: ["Medication Management"],
          systems: ["All Systems"],
          specialties: ["Medical-Surgical"],
          keywords: ["drugs", "medication", "dosage", "administration"],
          metadata: {
            author: "Dr. Smith",
            publishDate: "2024-01-15",
            lastUpdated: "2024-08-20",
            views: 15234,
            rating: 4.7,
            cost: "free" as const
          },
          mappings: {
            nclexCategory: "Pharmacological Therapies",
            textbookChapter: "Chapter 3",
            courseWeek: 2,
            learningObjectives: [
              "Understand drug classifications",
              "Calculate proper dosages",
              "Identify contraindications"
            ]
          },
          quality: {
            accuracy: 95,
            relevance: 90,
            engagement: 85,
            effectivenessScore: 88
          }
        },
        {
          id: "res-2",
          title: "Cardiac Assessment Techniques",
          type: "article" as const,
          url: "https://example.com/cardiac-assessment",
          provider: "Clinical Journal",
          duration: 20,
          difficulty: "intermediate" as const,
          tags: ["cardiac", "assessment", "nursing"],
          topics: ["Cardiac Nursing", "Physical Assessment"],
          diagnoses: ["Heart Failure", "Myocardial Infarction"],
          systems: ["Cardiovascular"],
          specialties: ["Critical Care", "Medical-Surgical"],
          keywords: ["heart", "assessment", "auscultation", "ECG"],
          metadata: {
            author: "RN Johnson",
            publishDate: "2024-03-10",
            lastUpdated: "2024-03-10",
            views: 8432,
            rating: 4.5,
            cost: "free" as const
          },
          mappings: {
            nclexCategory: "Reduction of Risk Potential",
            textbookChapter: "Chapter 8",
            courseWeek: 5,
            learningObjectives: [
              "Perform cardiac assessment",
              "Interpret heart sounds",
              "Recognize abnormal findings"
            ]
          },
          quality: {
            accuracy: 92,
            relevance: 88,
            engagement: 75,
            effectivenessScore: 85
          }
        },
        {
          id: "res-3",
          title: "Fluid & Electrolyte Practice Quiz",
          type: "quiz" as const,
          url: "https://example.com/fluids-quiz",
          provider: "StudyNurse",
          duration: 30,
          difficulty: "advanced" as const,
          tags: ["fluids", "electrolytes", "quiz"],
          topics: ["Fluid & Electrolytes", "Critical Care"],
          diagnoses: ["Dehydration", "Hyperkalemia", "Hyponatremia"],
          systems: ["Renal", "Cardiovascular"],
          specialties: ["Critical Care", "Emergency"],
          keywords: ["sodium", "potassium", "fluid balance", "IV therapy"],
          metadata: {
            author: "Quiz Bank Team",
            publishDate: "2024-05-20",
            lastUpdated: "2024-09-01",
            views: 12567,
            rating: 4.8,
            cost: "paid" as const
          },
          mappings: {
            nclexCategory: "Physiological Adaptation",
            textbookChapter: "Chapter 12",
            courseWeek: 8,
            learningObjectives: [
              "Calculate fluid deficits",
              "Identify electrolyte imbalances",
              "Plan appropriate interventions"
            ]
          },
          quality: {
            accuracy: 98,
            relevance: 95,
            engagement: 90,
            effectivenessScore: 94
          }
        }
      ];

      const result = resourceIndexer.bulkImport(sampleResources);
      
      res.json({
        message: "Sample resources initialized",
        ...result
      });
    } catch (error) {
      console.error("Error initializing sample resources:", error);
      res.status(500).json({ error: "Failed to initialize sample resources" });
    }
  });

  // AI Processing endpoints
  app.post("/api/admin/ai/extract-topics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const topics = await AIProcessor.extractTopicsFromText(text);
      res.json({ topics });
    } catch (error) {
      console.error("Error extracting topics:", error);
      res.status(500).json({ error: "Failed to extract topics" });
    }
  });

  app.post("/api/admin/ai/identify-gaps", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const result = await AIProcessor.identifyKnowledgeGaps(text);
      res.json(result);
    } catch (error) {
      console.error("Error identifying gaps:", error);
      res.status(500).json({ error: "Failed to identify knowledge gaps" });
    }
  });

  app.post("/api/admin/ai/normalize-topics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { topics } = req.body;
      
      if (!topics || !Array.isArray(topics)) {
        return res.status(400).json({ error: "Topics array is required" });
      }

      const normalized = await AIProcessor.normalizeTopicNames(topics);
      res.json({ mappings: Object.fromEntries(normalized) });
    } catch (error) {
      console.error("Error normalizing topics:", error);
      res.status(500).json({ error: "Failed to normalize topics" });
    }
  });

  app.post("/api/admin/ai/generate-metadata", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { topicName } = req.body;
      
      if (!topicName) {
        return res.status(400).json({ error: "Topic name is required" });
      }

      const metadata = await AIProcessor.generateTopicMetadata(topicName);
      res.json(metadata);
    } catch (error) {
      console.error("Error generating metadata:", error);
      res.status(500).json({ error: "Failed to generate topic metadata" });
    }
  });

  app.post("/api/admin/ai/analyze-quality", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const analysis = await AIProcessor.analyzeContentQuality(text);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing quality:", error);
      res.status(500).json({ error: "Failed to analyze content quality" });
    }
  });

  app.post("/api/admin/ai/bulk-process", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { documents } = req.body;
      
      if (!documents || !Array.isArray(documents)) {
        return res.status(400).json({ error: "Documents array is required" });
      }

      const result = await AIProcessor.processBulkContent(documents);
      res.json(result);
    } catch (error) {
      console.error("Error in bulk processing:", error);
      res.status(500).json({ error: "Failed to process bulk content" });
    }
  });
  
  // Resource Mapping Endpoints
  
  // Get AI suggestions for resources based on topic
  app.post("/api/admin/resources/ai-suggest", requireAdmin, validateCSRFToken, auditLog('AI_SUGGEST_RESOURCES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topicName, difficulty, count = 5 } = req.body;
      
      if (!topicName) {
        return res.status(400).json({ error: "Topic name is required" });
      }
      
      const suggestions = await AIProcessor.suggestResourcesForTopic(
        topicName,
        difficulty || 'intermediate',
        count
      );
      
      res.json({ success: true, suggestions });
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });
  
  // Get all topic-resource mappings
  app.get("/api/admin/resources/mappings", requireAdmin, auditLog('VIEW_RESOURCE_MAPPINGS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topicId, isActive, isAiSuggested } = req.query;
      
      const filters: any = {};
      if (topicId) filters.topicId = topicId as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (isAiSuggested !== undefined) filters.isAiSuggested = isAiSuggested === 'true';
      
      const mappings = await storage.getResourceMappings(filters);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching mappings:", error);
      res.status(500).json({ error: "Failed to fetch mappings" });
    }
  });
  
  // Create new resource mapping
  app.post("/api/admin/resources/mapping", requireAdmin, validateCSRFToken, auditLog('CREATE_RESOURCE_MAPPING'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topicId, resourceId, notes, isAiSuggested, confidence, metadata } = req.body;
      
      if (!topicId || !resourceId) {
        return res.status(400).json({ error: "Topic ID and Resource ID are required" });
      }
      
      const mapping = await storage.createResourceMapping({
        topicId,
        resourceId,
        mappedBy: req.session.adminUser?.userId,
        notes,
        isAiSuggested: isAiSuggested || false,
        confidence,
        isActive: true,
        metadata: metadata || {}
      });
      
      res.json({ success: true, mapping });
    } catch (error) {
      console.error("Error creating mapping:", error);
      res.status(500).json({ error: "Failed to create mapping" });
    }
  });
  
  // Update resource mapping
  app.put("/api/admin/resources/mapping/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_RESOURCE_MAPPING'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const mapping = await storage.updateResourceMapping(id, updates);
      res.json({ success: true, mapping });
    } catch (error) {
      console.error("Error updating mapping:", error);
      res.status(500).json({ error: "Failed to update mapping" });
    }
  });
  
  // Delete resource mapping
  app.delete("/api/admin/resources/mapping/:id", requireAdmin, validateCSRFToken, auditLog('DELETE_RESOURCE_MAPPING'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await storage.deleteResourceMapping(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting mapping:", error);
      res.status(500).json({ error: "Failed to delete mapping" });
    }
  });
  
  // Bulk map resources from CSV/JSON
  app.post("/api/admin/resources/bulk-map", requireAdmin, validateCSRFToken, auditLog('BULK_MAP_RESOURCES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { mappings } = req.body;
      
      if (!Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({ error: "Invalid mappings data" });
      }
      
      const validMappings = mappings.map(m => ({
        ...m,
        mappedBy: req.session.adminUser?.userId,
        isActive: true,
        mappedAt: new Date()
      }));
      
      const createdMappings = await storage.bulkCreateResourceMappings(validMappings);
      
      res.json({ 
        success: true, 
        created: createdMappings.length,
        mappings: createdMappings
      });
    } catch (error) {
      console.error("Error bulk mapping:", error);
      res.status(500).json({ error: "Failed to bulk map resources" });
    }
  });
  
  // Get resource mapping statistics
  app.get("/api/admin/resources/mapping-stats", requireAdmin, auditLog('VIEW_MAPPING_STATS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const stats = await storage.getResourceMappingStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching mapping stats:", error);
      res.status(500).json({ error: "Failed to fetch mapping statistics" });
    }
  });
  
  // Learning Resources CRUD
  
  // Get all learning resources
  app.get("/api/admin/learning-resources", requireAdmin, auditLog('VIEW_LEARNING_RESOURCES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { search } = req.query;
      
      let resources;
      if (search) {
        resources = await storage.searchLearningResources(search as string);
      } else {
        resources = await storage.getAllLearningResources();
      }
      
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });
  
  // Create new learning resource
  app.post("/api/admin/learning-resources", requireAdmin, validateCSRFToken, auditLog('CREATE_LEARNING_RESOURCE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { title, type, url, duration, topicId, subtopicId } = req.body;
      
      if (!title || !type) {
        return res.status(400).json({ error: "Title and type are required" });
      }
      
      const resource = await storage.createLearningResource({
        title,
        type,
        url,
        duration,
        topicId,
        subtopicId,
        chapterNumber: req.body.chapterNumber,
        pageNumbers: req.body.pageNumbers
      });
      
      res.json({ success: true, resource });
    } catch (error) {
      console.error("Error creating resource:", error);
      res.status(500).json({ error: "Failed to create resource" });
    }
  });
  
  // Update learning resource
  app.put("/api/admin/learning-resources/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_LEARNING_RESOURCE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const resource = await storage.updateLearningResource(id, updates);
      res.json({ success: true, resource });
    } catch (error) {
      console.error("Error updating resource:", error);
      res.status(500).json({ error: "Failed to update resource" });
    }
  });
  
  // Delete learning resource
  app.delete("/api/admin/learning-resources/:id", requireAdmin, validateCSRFToken, auditLog('DELETE_LEARNING_RESOURCE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await storage.deleteLearningResource(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ error: "Failed to delete resource" });
    }
  });

  // Demand Analytics Endpoints
  
  // Get demand metrics
  app.get("/api/admin/analytics/demand", requireAdmin, auditLog('VIEW_DEMAND_METRICS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { startDate, endDate, limit = 50 } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const metrics = await DemandAnalytics.getTopicDemandMetrics(start, end, Number(limit));
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching demand metrics:", error);
      res.status(500).json({ error: "Failed to fetch demand metrics" });
    }
  });
  
  // Get resource gap analysis
  app.get("/api/admin/analytics/gaps", requireAdmin, auditLog('VIEW_RESOURCE_GAPS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { minDemand = 5 } = req.query;
      const gaps = await DemandAnalytics.calculateResourceGaps(Number(minDemand));
      res.json(gaps);
    } catch (error) {
      console.error("Error calculating gaps:", error);
      res.status(500).json({ error: "Failed to calculate resource gaps" });
    }
  });
  
  // Generate AI allocation plan
  app.post("/api/admin/analytics/allocation-plan", requireAdmin, validateCSRFToken, auditLog('GENERATE_ALLOCATION_PLAN'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topicIds, budget } = req.body;
      const plan = await DemandAnalytics.generateAllocationPlan(topicIds, budget);
      res.json(plan);
    } catch (error) {
      console.error("Error generating allocation plan:", error);
      res.status(500).json({ error: "Failed to generate allocation plan" });
    }
  });
  
  // Get demand trends
  app.get("/api/admin/analytics/trends", requireAdmin, auditLog('VIEW_DEMAND_TRENDS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { days = 30, groupBy = 'day' } = req.query;
      const trends = await DemandAnalytics.getDemandTrends(Number(days), groupBy as 'day' | 'week' | 'month');
      res.json(trends);
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ error: "Failed to fetch demand trends" });
    }
  });
  
  // Track topic demand
  app.post("/api/admin/analytics/track-demand", requireAdmin, validateCSRFToken, auditLog('TRACK_DEMAND'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topicId, source, userId, priority, metadata } = req.body;
      
      if (!topicId || !source) {
        return res.status(400).json({ error: "Topic ID and source are required" });
      }
      
      await DemandAnalytics.trackTopicDemand(
        topicId,
        source,
        userId,
        priority || 1,
        metadata
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking demand:", error);
      res.status(500).json({ error: "Failed to track topic demand" });
    }
  });
  
  // Predict future demand for a topic
  app.get("/api/admin/analytics/predict/:topicId", requireAdmin, auditLog('PREDICT_DEMAND'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topicId } = req.params;
      const { daysAhead = 7 } = req.query;
      
      const prediction = await DemandAnalytics.predictFutureDemand(topicId, Number(daysAhead));
      res.json(prediction);
    } catch (error) {
      console.error("Error predicting demand:", error);
      res.status(500).json({ error: "Failed to predict future demand" });
    }
  });
  
  // Get resource allocations
  app.get("/api/admin/analytics/allocations", requireAdmin, auditLog('VIEW_ALLOCATIONS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { status } = req.query;
      const allocations = await storage.getResourceAllocations(status as string);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching allocations:", error);
      res.status(500).json({ error: "Failed to fetch resource allocations" });
    }
  });
  
  // Update allocation status
  app.patch("/api/admin/analytics/allocations/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_ALLOCATION'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      await storage.updateResourceAllocationStatus(
        id,
        status,
        req.session.adminUser?.userId
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating allocation:", error);
      res.status(500).json({ error: "Failed to update allocation status" });
    }
  });
  
  // Call Booking Endpoints
  
  // User requests a call
  app.post("/api/bookings/request", async (req: Request, res: Response) => {
    try {
      const { 
        userId,
        topicId,
        topicName,
        contactName,
        contactEmail,
        contactPhone,
        preferredTimeSlots,
        urgency,
        notes
      } = req.body;
      
      // Validate required fields
      if (!contactName || !contactEmail || !contactPhone || !topicName) {
        return res.status(400).json({ 
          error: "Contact name, email, phone, and topic are required" 
        });
      }
      
      const booking = await callBookingSystem.scheduleCall({
        userId,
        topicId,
        topicName,
        contactName,
        contactEmail,
        contactPhone,
        preferredTimeSlots: preferredTimeSlots || [],
        urgency: urgency || 'medium',
        notes
      });
      
      res.json({ success: true, booking });
    } catch (error) {
      console.error("Error creating call booking:", error);
      res.status(500).json({ error: "Failed to create call booking" });
    }
  });
  
  // Get available time slots
  app.get("/api/bookings/available-slots", async (req: Request, res: Response) => {
    try {
      const { date, adminId } = req.query;
      
      if (!date) {
        return res.status(400).json({ error: "Date is required" });
      }
      
      const slots = await callBookingSystem.getAvailableSlots(
        new Date(date as string),
        adminId as string | undefined
      );
      
      res.json(slots);
    } catch (error) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ error: "Failed to fetch available time slots" });
    }
  });
  
  // Check if topic needs booking offer
  app.get("/api/bookings/check-topic", async (req: Request, res: Response) => {
    try {
      const { topicName, userId } = req.query;
      
      if (!topicName) {
        return res.status(400).json({ error: "Topic name is required" });
      }
      
      const result = await callBookingSystem.detectUnmappedTopicRequest(
        topicName as string,
        userId as string | undefined
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error checking topic:", error);
      res.status(500).json({ error: "Failed to check topic" });
    }
  });
  
  // Admin: Get all bookings
  app.get("/api/admin/bookings", requireAdmin, auditLog('VIEW_BOOKINGS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { status, userId, topicId, assignedTo } = req.query;
      
      const bookings = await storage.getCallBookings({
        status: status as string | undefined,
        userId: userId as string | undefined,
        topicId: topicId as string | undefined,
        assignedTo: assignedTo as string | undefined
      });
      
      // Enrich with lead information
      const enrichedBookings = [];
      for (const booking of bookings) {
        const lead = await storage.getLeadByBookingId(booking.id);
        enrichedBookings.push({
          ...booking,
          lead
        });
      }
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });
  
  // Admin: Get booking queue
  app.get("/api/admin/bookings/queue", requireAdmin, auditLog('VIEW_BOOKING_QUEUE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const queue = await callBookingSystem.getCallQueue();
      res.json(queue);
    } catch (error) {
      console.error("Error fetching booking queue:", error);
      res.status(500).json({ error: "Failed to fetch booking queue" });
    }
  });
  
  // Admin: Get booking statistics
  app.get("/api/admin/bookings/stats", requireAdmin, auditLog('VIEW_BOOKING_STATS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const stats = await callBookingSystem.getBookingStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching booking stats:", error);
      res.status(500).json({ error: "Failed to fetch booking statistics" });
    }
  });
  
  // Admin: Update booking status
  app.put("/api/admin/bookings/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_BOOKING'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedBooking = await storage.updateCallBooking(id, updates);
      
      // If status changed, update lead status
      if (updates.status) {
        await callBookingSystem.updateCallStatus(
          id,
          updates.status,
          req.session.adminUser?.userId,
          updates.adminNotes
        );
      }
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });
  
  // Admin: Assign booking to admin
  app.post("/api/admin/bookings/:id/assign", requireAdmin, validateCSRFToken, auditLog('ASSIGN_BOOKING'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { adminId } = req.body;
      
      if (!adminId) {
        return res.status(400).json({ error: "Admin ID is required" });
      }
      
      const updatedBooking = await callBookingSystem.assignToAdmin(id, adminId);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error assigning booking:", error);
      res.status(500).json({ error: "Failed to assign booking" });
    }
  });
  
  // Admin: Add notes to booking
  app.post("/api/admin/bookings/:id/notes", requireAdmin, validateCSRFToken, auditLog('ADD_BOOKING_NOTES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      if (!notes) {
        return res.status(400).json({ error: "Notes are required" });
      }
      
      const updatedBooking = await storage.updateCallBooking(id, { adminNotes: notes });
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error adding notes:", error);
      res.status(500).json({ error: "Failed to add notes" });
    }
  });
  
  // Admin: Public pilot request queue
  app.get("/api/admin/pilot-requests", requireAdmin, auditLog('VIEW_PUBLIC_PILOT_REQUESTS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "all";
      if (status !== "all" && !publicPilotRequestStatuses.includes(status as any)) {
        return res.status(400).json({ error: "Unsupported pilot request status" });
      }

      const leads = await storage.getLeads({ source: PUBLIC_PILOT_REQUEST_SOURCE });
      const requests = leads
        .map(publicPilotRequestPayload)
        .filter((request) => status === "all" || request.status === status);

      res.json({
        requests,
        summary: publicPilotRequestSummary(requests),
        statuses: publicPilotRequestStatuses,
      });
    } catch (error) {
      console.error("Error fetching public pilot requests:", error);
      res.status(500).json({ error: "Failed to fetch public pilot requests" });
    }
  });

  app.patch("/api/admin/pilot-requests/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_PUBLIC_PILOT_REQUEST'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const parsed = pilotRequestUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid pilot request update",
          details: parsed.error.errors,
        });
      }

      const existing = await storage.getLeadById(req.params.id);
      if (!existing || existing.source !== PUBLIC_PILOT_REQUEST_SOURCE) {
        return res.status(404).json({ error: "Public pilot request not found" });
      }

      const followUpDate = parseNullableDate(parsed.data.followUpDate);
      const updates: Record<string, any> = {};

      if (parsed.data.status) updates.status = parsed.data.status;
      if (parsed.data.score !== undefined) updates.score = parsed.data.score;
      if (parsed.data.interestedTopics) updates.interestedTopics = parsed.data.interestedTopics;
      if (followUpDate !== undefined) updates.followUpDate = followUpDate;
      if (parsed.data.status || parsed.data.adminNotes !== undefined) updates.lastContactDate = new Date();

      if (parsed.data.adminNotes !== undefined) {
        updates.customFields = {
          ...((existing.customFields || {}) as Record<string, any>),
          adminNotes: parsed.data.adminNotes,
          reviewedAt: new Date().toISOString(),
        };
      }

      const updated = await storage.updateLead(existing.id, updates);
      const payload = publicPilotRequestPayload(updated);
      res.json({
        request: payload,
        summary: publicPilotRequestSummary([payload]),
      });
    } catch (error: any) {
      console.error("Error updating public pilot request:", error);
      res.status(error?.message === "Invalid follow-up date" ? 400 : 500).json({
        error: error?.message === "Invalid follow-up date" ? error.message : "Failed to update public pilot request",
      });
    }
  });

  app.get("/api/admin/pilot-requests/export", requireAdmin, auditLog('EXPORT_PUBLIC_PILOT_REQUESTS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const format = typeof req.query.format === "string" ? req.query.format : "csv";
      if (!["csv", "json"].includes(format)) {
        return res.status(400).json({ error: "Unsupported export format" });
      }

      const requests = (await storage.getLeads({ source: PUBLIC_PILOT_REQUEST_SOURCE }))
        .map(publicPilotRequestPayload);
      const generatedAt = new Date().toISOString();

      if (format === "json") {
        res.setHeader("Content-Disposition", `attachment; filename="public-pilot-requests-${generatedAt.slice(0, 10)}.json"`);
        return res.json({
          generatedAt,
          source: PUBLIC_PILOT_REQUEST_SOURCE,
          summary: publicPilotRequestSummary(requests),
          requests,
        });
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="public-pilot-requests-${generatedAt.slice(0, 10)}.csv"`);
      res.send(publicPilotRequestsCsv(requests));
    } catch (error) {
      console.error("Error exporting public pilot requests:", error);
      res.status(500).json({ error: "Failed to export public pilot requests" });
    }
  });

  // Admin: Get all leads
  app.get("/api/admin/leads", requireAdmin, auditLog('VIEW_LEADS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { status, assignedTo, source } = req.query;
      
      const leads = await storage.getLeads({
        status: status as string | undefined,
        assignedTo: assignedTo as string | undefined,
        source: source as string | undefined
      });
      
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });
  
  // Admin: Update lead status
  app.put("/api/admin/leads/:id", requireAdmin, validateCSRFToken, auditLog('UPDATE_LEAD'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, conversionValue, conversionType } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const updatedLead = await callBookingSystem.trackLeadStatus(
        id,
        status,
        conversionValue,
        conversionType
      );
      
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });
  
  // Admin: Get lead conversion metrics
  app.get("/api/admin/leads/metrics", requireAdmin, auditLog('VIEW_LEAD_METRICS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const metrics = await storage.getLeadMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching lead metrics:", error);
      res.status(500).json({ error: "Failed to fetch lead metrics" });
    }
  });
  
  // Admin: Set availability
  app.post("/api/admin/availability", requireAdmin, validateCSRFToken, auditLog('SET_AVAILABILITY'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { dayOfWeek, startTime, endTime, slotDuration, bufferTime, maxCallsPerSlot } = req.body;
      
      if (dayOfWeek === undefined || !startTime || !endTime) {
        return res.status(400).json({ 
          error: "Day of week, start time, and end time are required" 
        });
      }
      
      const availability = await callBookingSystem.setAdminAvailability({
        adminId: req.session.adminUser?.userId || '',
        dayOfWeek,
        startTime,
        endTime,
        slotDuration: slotDuration || 30,
        bufferTime: bufferTime || 15,
        maxCallsPerSlot: maxCallsPerSlot || 1,
        isActive: true
      });
      
      res.json(availability);
    } catch (error) {
      console.error("Error setting availability:", error);
      res.status(500).json({ error: "Failed to set availability" });
    }
  });
  
  // Admin: Get availability
  app.get("/api/admin/availability/:adminId", requireAdmin, auditLog('VIEW_AVAILABILITY'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { adminId } = req.params;
      const availability = await storage.getAdminAvailability(adminId);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });
  
  // Knowledge Base Management Endpoints
  
  // Configure multer for file uploads
  const uploadStorage = multer.memoryStorage();
  const upload = multer({
    storage: uploadStorage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max
      files: 1
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'application/x-ndjson',
        'application/zip',
        'application/x-zip-compressed',
        'application/x-tar',
        'application/tar'
      ];
      const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.md', '.json', '.jsonl', '.csv', '.zip', '.tar'];
      const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOCX, PPTX, TXT, MD, JSON, CSV, ZIP, and TAR files are allowed.'));
      }
    }
  });
  
  // List all documents in knowledge base
  app.get("/api/admin/knowledge-base/documents", requireAdmin, auditLog('VIEW_DOCUMENTS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      
      const conditions = [];
      if (status) {
        conditions.push(eq(documents.status, status as string));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(whereClause);
      
      const total = Number(countResult[0]?.count || 0);
      
      // Get paginated results
      const baseQuery = db
        .select({
          id: documents.id,
          title: documents.title,
          type: documents.type,
          status: documents.status,
          sourceUri: documents.sourceUri,
          totalPages: documents.totalPages,
          totalTokens: documents.totalTokens,
          contentHash: documents.contentHash,
          metadata: documents.metadata,
          uploadedBy: documents.uploadedBy,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt
        })
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));
      
      const docsList = whereClause ? 
        await baseQuery.where(whereClause) : 
        await baseQuery;
      
      // For each document, get chunk count
      const docsWithCounts = await Promise.all(
        docsList.map(async (doc) => {
          const [chunkCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(documentChunks)
            .where(eq(documentChunks.documentId, doc.id));
          
          return {
            ...doc,
            chunkCount: Number(chunkCount?.count || 0),
            size: 0, // Will be calculated from file if needed
            filePath: doc.sourceUri
          };
        })
      );
      
      res.json({
        documents: docsWithCounts,
        total,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Upload document for knowledge base
  app.post("/api/admin/knowledge-base/upload", requireAdmin, upload.single('document'), validateCSRFToken, auditLog('UPLOAD_DOCUMENT'), async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const adminId = req.session.adminUser?.userId || '';

      const dataChunkerResult = await tryImportDataChunkerUpload({
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        buffer: req.file.buffer,
        sourceUri: `knowledge-base-upload:${req.file.originalname}`,
        adminId,
      });

      if (dataChunkerResult) {
        const chunkCount = dataChunkerResult.documentChunks.length;
        return res.json({
          success: true,
          jobId: dataChunkerResult.job.id,
          document: {
            id: dataChunkerResult.document.id,
            title: dataChunkerResult.document.title,
            type: dataChunkerResult.document.type,
            status: dataChunkerResult.document.status,
            createdAt: dataChunkerResult.document.createdAt,
            chunkCount,
            chunksCount: chunkCount
          },
          source: dataChunkerResult.source
        });
      }

      if (isDataChunkerBundleUpload(req.file.originalname, req.file.mimetype)) {
        return res.status(400).json({
          error: "ZIP and TAR uploads must be valid Data Chunker Pro exports with an index.json file."
        });
      }
      
      // Process document asynchronously
      const result = await DocumentProcessor.processDocument(
        req.file,
        adminId,
        {
          generateEmbeddings: true,
          detectTopics: true,
          preserveStructure: true
        }
      );
      
      const { document, jobId } = result;
      const [currentDocument] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, document.id))
        .limit(1);
      const finalizedDocument = currentDocument || document;
      const source = await ensureKnowledgeBaseSourceForDocument(finalizedDocument, adminId);
      let responseJobId = jobId;

      // DocumentProcessor returns an unsaved placeholder job id for duplicate uploads.
      // Create a completed job so the upload UI can poll a real job endpoint.
      const persistedJob = await JobManager.getJobStatus(jobId);
      if (!persistedJob) {
        const duplicateJob = await JobManager.createJob({
          documentId: document.id,
          stage: "completed",
          status: "completed",
          progress: 100,
          error: null,
          metadata: {
            duplicateDocument: true,
            sourceId: source.id,
          } as any,
          startedAt: new Date(),
          completedAt: new Date(),
          adminId,
        } as any);
        responseJobId = duplicateJob.id;
      }
      
      res.json({
        success: true,
        jobId: responseJobId, // Include jobId for tracking
        document: {
          id: document.id,
          title: finalizedDocument.title,
          type: finalizedDocument.type,
          status: finalizedDocument.status,
          createdAt: finalizedDocument.createdAt,
          chunksCount: await db.select({ count: sql`count(*)` })
            .from(documentChunks)
            .where(eq(documentChunks.documentId, finalizedDocument.id))
            .then(r => Number(r[0]?.count || 0))
        },
        source
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to upload document" 
      });
    }
  });

  // Import a local Data Chunker Pro output folder or index.json.
  app.post("/api/admin/knowledge-base/import-data-chunker", requireAdmin, validateCSRFToken, auditLog('IMPORT_DATA_CHUNKER'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const body = z.object({ path: z.string().min(1) }).parse(req.body);
      const adminId = req.session.adminUser?.userId || '';
      const results = await importDataChunkerLocalPath(body.path, adminId);

      res.json({
        success: true,
        imported: results.length,
        documents: results.map((result) => ({
          id: result.document.id,
          title: result.document.title,
          type: result.document.type,
          status: result.document.status,
          createdAt: result.document.createdAt,
          chunkCount: result.documentChunks.length,
          chunksCount: result.documentChunks.length
        })),
        sources: results.map((result) => result.source),
        jobs: results.map((result) => result.job)
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Data Chunker import path is required.", details: error.errors });
      }
      console.error("Error importing Data Chunker folder:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Data Chunker import failed"
      });
    }
  });
  
  // List processing jobs
  app.get("/api/admin/knowledge-base/jobs", requireAdmin, auditLog('VIEW_DOCUMENT_JOBS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const adminId = req.query.adminId as string || req.session.adminUser?.userId;
      
      const filter: any = {};
      if (status) filter.status = status as string;
      if (adminId) filter.adminId = adminId;
      
      const result = await JobManager.listJobs(
        filter,
        Number(limit),
        Number(offset)
      );
      
      res.json({
        jobs: result.jobs,
        total: result.total,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  
  // Get job status
  app.get("/api/admin/knowledge-base/jobs/:id", requireAdmin, auditLog('VIEW_JOB_STATUS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const job = await JobManager.getJobStatus(id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Check job health
      const health = await JobManager.checkJobHealth(id);
      
      res.json({
        ...job,
        health
      });
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ error: "Failed to fetch job status" });
    }
  });
  
  // Reprocess failed document
  app.post("/api/admin/knowledge-base/reprocess/:id", requireAdmin, validateCSRFToken, auditLog('REPROCESS_DOCUMENT'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the document
      const docs = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      
      if (docs.length === 0) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      const document = docs[0];
      
      // Create a new processing job
      const job = await JobManager.createJob({
        documentId: document.id,
        status: "pending",
        stage: "reprocessing",
        progress: 0
      });
      
      // TODO: Trigger reprocessing logic
      // This would need to be implemented based on your specific needs
      
      res.json({
        success: true,
        jobId: job.id,
        message: "Document queued for reprocessing"
      });
    } catch (error) {
      console.error("Error reprocessing document:", error);
      res.status(500).json({ error: "Failed to reprocess document" });
    }
  });
  
  // Delete document
  app.delete("/api/admin/knowledge-base/document/:id", requireAdmin, validateCSRFToken, auditLog('DELETE_DOCUMENT'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await DocumentProcessor.deleteDocument(id);
      
      res.json({
        success: true,
        message: "Document deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });
  
  // Get document statistics
  app.get("/api/admin/knowledge-base/stats", requireAdmin, auditLog('VIEW_KB_STATS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      // Get document counts
      const [docCount] = await db.select({ count: sql`count(*)` }).from(documents);
      const [chunkCount] = await db.select({ count: sql`count(*)` }).from(documentChunks);
      
      // Get job statistics
      const jobStats = await JobManager.getStatistics();
      
      // Get recent documents
      const recentDocs = await db
        .select({
          id: documents.id,
          title: documents.title,
          type: documents.type,
          status: documents.status,
          createdAt: documents.createdAt,
          uploadedBy: documents.uploadedBy
        })
        .from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(5);
      
      res.json({
        documents: {
          total: Number(docCount.count),
          chunks: Number(chunkCount.count),
          recent: recentDocs
        },
        jobs: jobStats
      });
    } catch (error) {
      console.error("Error fetching KB stats:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base statistics" });
    }
  });
  
  // Search documents
  app.get("/api/admin/knowledge-base/search", requireAdmin, auditLog('SEARCH_DOCUMENTS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { q, type, status, topicId, limit = 20, offset = 0 } = req.query;
      
      const conditions = [];
      
      if (q) {
        conditions.push(
          like(documents.title, `%${q}%`)
        );
      }
      
      if (type) {
        conditions.push(eq(documents.type, type as string));
      }
      
      if (status) {
        conditions.push(eq(documents.status, status as string));
      }
      
      // Note: topicIds is not available in documents table schema
      // topicId filtering would need to be implemented via document chunks or metadata
      if (topicId) {
        // Skip topicId filter as documents.topicIds doesn't exist in schema
      }
      
      const baseQuery = db.select().from(documents)
        .orderBy(desc(documents.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));
      
      const results = conditions.length > 0 ? 
        await baseQuery.where(and(...conditions)) : 
        await baseQuery;
      
      res.json({
        documents: results,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ error: "Failed to search documents" });
    }
  });
  
  // Resume failed jobs
  app.post("/api/admin/knowledge-base/jobs/resume", requireAdmin, validateCSRFToken, auditLog('RESUME_FAILED_JOBS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { maxJobs = 10 } = req.body;
      
      const resumedJobs = await JobManager.resumeFailedJobs(maxJobs);
      
      res.json({
        success: true,
        resumed: resumedJobs.length,
        jobs: resumedJobs.map(j => ({
          id: j.id,
          documentId: j.documentId,
          status: j.status,
          progress: j.progress || 0
        }))
      });
    } catch (error) {
      console.error("Error resuming failed jobs:", error);
      res.status(500).json({ error: "Failed to resume jobs" });
    }
  });

  // ==================== Table Management Endpoints ====================
  
  // Get extracted tables for a document
  app.get("/api/admin/tables/:documentId", requireAdmin, auditLog('VIEW_EXTRACTED_TABLES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { documentId } = req.params;
      const { status } = req.query;
      
      let query = db
        .select({
          id: extractedTables.id,
          tableIndex: extractedTables.tableIndex,
          title: extractedTables.title,
          pageNumber: extractedTables.pageNumber,
          rowCount: extractedTables.rowCount,
          columnCount: extractedTables.columnCount,
          hasHeaders: extractedTables.hasHeaders,
          headers: extractedTables.headers,
          status: extractedTables.status,
          extractionConfidence: extractedTables.extractionConfidence,
          approvedBy: extractedTables.approvedBy,
          approvedAt: extractedTables.approvedAt,
          rejectedBy: extractedTables.rejectedBy,
          rejectedAt: extractedTables.rejectedAt,
          metadata: extractedTables.metadata,
          createdAt: extractedTables.createdAt
        })
        .from(extractedTables)
        .where(eq(extractedTables.documentId, documentId))
        .orderBy(extractedTables.tableIndex);
      
      if (status) {
        query = query.where(and(
          eq(extractedTables.documentId, documentId),
          eq(extractedTables.status, status as string)
        )) as any;
      }
      
      const tables = await query;
      
      res.json({
        documentId,
        tables,
        total: tables.length
      });
    } catch (error) {
      console.error("Error fetching extracted tables:", error);
      res.status(500).json({ error: "Failed to fetch extracted tables" });
    }
  });

  // Get table cells for a specific table
  app.get("/api/admin/tables/:tableId/cells", requireAdmin, auditLog('VIEW_TABLE_CELLS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { tableId } = req.params;
      
      const cells = await db
        .select()
        .from(tableCells)
        .where(eq(tableCells.tableId, tableId))
        .orderBy(tableCells.rowIndex, tableCells.columnIndex);
      
      // Get table info
      const [table] = await db
        .select()
        .from(extractedTables)
        .where(eq(extractedTables.id, tableId))
        .limit(1);
      
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      
      // Organize cells into a 2D array structure
      const cellGrid: TableCell[][] = [];
      for (const cell of cells) {
        if (!cellGrid[cell.rowIndex]) {
          cellGrid[cell.rowIndex] = [];
        }
        cellGrid[cell.rowIndex][cell.columnIndex] = cell;
      }
      
      res.json({
        tableId,
        table,
        cells: cellGrid,
        totalCells: cells.length
      });
    } catch (error) {
      console.error("Error fetching table cells:", error);
      res.status(500).json({ error: "Failed to fetch table cells" });
    }
  });

  // Approve or reject a table
  app.post("/api/admin/tables/approve", requireAdmin, validateCSRFToken, auditLog('APPROVE_REJECT_TABLE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validation = TableApprovalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: validation.error.errors 
        });
      }
      
      const { tableId, action, notes, editedTitle, topicMappings } = validation.data;
      const adminId = req.session.adminId!;
      
      // Start transaction
      await db.transaction(async (tx) => {
        // Update table status
        const updateData: any = {
          status: action === 'approve' ? 'approved' : 'rejected',
          ...(action === 'approve' ? {
            approvedBy: adminId,
            approvedAt: new Date()
          } : {
            rejectedBy: adminId,
            rejectedAt: new Date()
          })
        };
        
        if (editedTitle) {
          updateData.title = editedTitle;
        }
        
        await tx
          .update(extractedTables)
          .set(updateData)
          .where(eq(extractedTables.id, tableId));
        
        // Create approval record
        await tx.insert(tableApprovals).values({
          tableId,
          adminId,
          action: action === 'approve' ? 'approved' : 'rejected',
          notes,
          createdAt: new Date()
        } as InsertTableApproval);
        
        // If approved and topic mappings provided, create topic mappings
        if (action === 'approve' && topicMappings && topicMappings.length > 0) {
          const mappingRecords = topicMappings.map(topicId => ({
            tableId,
            topicId,
            confidence: 0.9, // Default confidence for manual mappings
            source: 'manual_admin' as const,
            createdAt: new Date()
          }));
          
          await tx.insert(tableTopicMappings).values(mappingRecords as InsertTableTopicMapping[]);
        }
      });
      
      res.json({
        success: true,
        message: `Table ${action}d successfully`,
        tableId,
        action
      });
    } catch (error) {
      console.error("Error approving/rejecting table:", error);
      res.status(500).json({ error: "Failed to process table approval" });
    }
  });

  // Edit table cell content
  app.post("/api/admin/tables/edit", requireAdmin, validateCSRFToken, auditLog('EDIT_TABLE_CELLS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validation = TableEditSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: validation.error.errors 
        });
      }
      
      const { tableId, edits } = validation.data;
      
      // Apply edits in transaction
      await db.transaction(async (tx) => {
        for (const edit of edits) {
          await tx
            .update(tableCells)
            .set({
              editedContent: edit.newContent,
              validationNotes: edit.validationNotes,
              updatedAt: new Date()
            })
            .where(and(
              eq(tableCells.tableId, tableId),
              eq(tableCells.rowIndex, edit.rowIndex),
              eq(tableCells.columnIndex, edit.columnIndex)
            ));
        }
        
        // Update table metadata to indicate it has been edited
        await tx
          .update(extractedTables)
          .set({
            metadata: sql`jsonb_set(metadata, '{edited}', 'true'::jsonb)`,
            updatedAt: new Date()
          })
          .where(eq(extractedTables.id, tableId));
      });
      
      res.json({
        success: true,
        message: `Applied ${edits.length} edits to table`,
        tableId,
        editsApplied: edits.length
      });
    } catch (error) {
      console.error("Error editing table cells:", error);
      res.status(500).json({ error: "Failed to edit table cells" });
    }
  });

  // Bulk approve/reject/delete tables
  app.post("/api/admin/tables/bulk-action", requireAdmin, validateCSRFToken, auditLog('BULK_TABLE_ACTION'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validation = TableBulkActionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: validation.error.errors 
        });
      }
      
      const { tableIds, action, notes } = validation.data;
      const adminId = req.session.adminId!;
      
      await db.transaction(async (tx) => {
        if (action === 'delete') {
          // Delete tables and their cells
          await tx.delete(tableCells).where(inArray(tableCells.tableId, tableIds));
          await tx.delete(extractedTables).where(inArray(extractedTables.id, tableIds));
        } else {
          // Update status for approve/reject
          const updateData: any = {
            status: action === 'approve' ? 'approved' : 'rejected',
            ...(action === 'approve' ? {
              approvedBy: adminId,
              approvedAt: new Date()
            } : {
              rejectedBy: adminId,
              rejectedAt: new Date()
            })
          };
          
          await tx
            .update(extractedTables)
            .set(updateData)
            .where(inArray(extractedTables.id, tableIds));
          
          // Create approval records for each table
          const approvalRecords = tableIds.map(tableId => ({
            tableId,
            adminId,
            action: action === 'approve' ? 'approved' as const : 'rejected' as const,
            notes,
            createdAt: new Date()
          }));
          
          await tx.insert(tableApprovals).values(approvalRecords as InsertTableApproval[]);
        }
      });
      
      res.json({
        success: true,
        message: `${action === 'delete' ? 'Deleted' : action === 'approve' ? 'Approved' : 'Rejected'} ${tableIds.length} tables`,
        affectedTables: tableIds.length
      });
    } catch (error) {
      console.error("Error performing bulk table action:", error);
      res.status(500).json({ error: "Failed to perform bulk action on tables" });
    }
  });

  // Search and filter tables
  app.get("/api/admin/tables/search", requireAdmin, auditLog('SEARCH_TABLES'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validation = TableSearchSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid search parameters",
          details: validation.error.errors 
        });
      }
      
      const { query, documentId, status, confidence, page, limit } = validation.data;
      const offset = (page - 1) * limit;
      
      let whereConditions = [];
      
      if (documentId) {
        whereConditions.push(eq(extractedTables.documentId, documentId));
      }
      
      if (status) {
        whereConditions.push(eq(extractedTables.status, status));
      }
      
      if (confidence?.min || confidence?.max) {
        if (confidence.min) {
          whereConditions.push(sql`${extractedTables.extractionConfidence} >= ${confidence.min}`);
        }
        if (confidence.max) {
          whereConditions.push(sql`${extractedTables.extractionConfidence} <= ${confidence.max}`);
        }
      }
      
      if (query) {
        whereConditions.push(
          or(
            like(extractedTables.title, `%${query}%`),
            sql`${extractedTables.headers}::text ILIKE ${'%' + query + '%'}`
          )
        );
      }
      
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
      
      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(extractedTables)
        .where(whereClause);
      
      // Get tables with document info
      const results = await db
        .select({
          id: extractedTables.id,
          documentId: extractedTables.documentId,
          documentTitle: documents.title,
          tableIndex: extractedTables.tableIndex,
          title: extractedTables.title,
          pageNumber: extractedTables.pageNumber,
          rowCount: extractedTables.rowCount,
          columnCount: extractedTables.columnCount,
          status: extractedTables.status,
          extractionConfidence: extractedTables.extractionConfidence,
          approvedAt: extractedTables.approvedAt,
          rejectedAt: extractedTables.rejectedAt,
          createdAt: extractedTables.createdAt
        })
        .from(extractedTables)
        .leftJoin(documents, eq(extractedTables.documentId, documents.id))
        .where(whereClause)
        .orderBy(desc(extractedTables.createdAt))
        .limit(limit)
        .offset(offset);
      
      res.json({
        tables: results,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      console.error("Error searching tables:", error);
      res.status(500).json({ error: "Failed to search tables" });
    }
  });

  // Get table statistics and dashboard data
  app.get("/api/admin/tables/stats", requireAdmin, auditLog('VIEW_TABLE_STATS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      // Get status distribution
      const statusStats = await db
        .select({
          status: extractedTables.status,
          count: sql<number>`count(*)`
        })
        .from(extractedTables)
        .groupBy(extractedTables.status);
      
      // Get recent tables
      const recentTables = await db
        .select({
          id: extractedTables.id,
          title: extractedTables.title,
          documentTitle: documents.title,
          status: extractedTables.status,
          extractionConfidence: extractedTables.extractionConfidence,
          createdAt: extractedTables.createdAt
        })
        .from(extractedTables)
        .leftJoin(documents, eq(extractedTables.documentId, documents.id))
        .orderBy(desc(extractedTables.createdAt))
        .limit(10);
      
      // Get confidence distribution
      const confidenceStats = await db
        .select({
          high: sql<number>`count(*) filter (where ${extractedTables.extractionConfidence} >= 0.8)`,
          medium: sql<number>`count(*) filter (where ${extractedTables.extractionConfidence} >= 0.5 and ${extractedTables.extractionConfidence} < 0.8)`,
          low: sql<number>`count(*) filter (where ${extractedTables.extractionConfidence} < 0.5)`
        })
        .from(extractedTables);
      
      res.json({
        statusStats,
        recentTables,
        confidenceStats: confidenceStats[0] || { high: 0, medium: 0, low: 0 },
        summary: {
          total: statusStats.reduce((sum, stat) => sum + stat.count, 0),
          pending: statusStats.find(s => s.status === 'pending')?.count || 0,
          approved: statusStats.find(s => s.status === 'approved')?.count || 0,
          rejected: statusStats.find(s => s.status === 'rejected')?.count || 0
        }
      });
    } catch (error) {
      console.error("Error fetching table statistics:", error);
      res.status(500).json({ error: "Failed to fetch table statistics" });
    }
  });

  // ==================== RAG Search Endpoints ====================
  
  // Basic RAG search
  app.get("/api/rag/search", requireAdmin, auditLog('RAG_SEARCH'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { q, topicIds, documentIds, tags, minScore, limit = '10' } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const filters = {
        topicIds: topicIds ? String(topicIds).split(',') : undefined,
        documentIds: documentIds ? String(documentIds).split(',') : undefined,
        tags: tags ? String(tags).split(',') : undefined,
        minScore: minScore ? parseFloat(String(minScore)) : undefined
      };

      const results = await RAGService.searchAll(
        q,
        filters,
        { limit: parseInt(String(limit)) }
      );

      res.json({
        query: q,
        results: {
          chunks: results.chunks,
          tables: results.tables,
          combined: [...results.chunks, ...results.tables].sort((a, b) => (b.score || 0) - (a.score || 0))
        },
        total: results.total
      });
    } catch (error) {
      console.error("RAG search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Advanced RAG search with full options
  app.post("/api/rag/search/advanced", requireAdmin, validateCSRFToken, auditLog('RAG_ADVANCED_SEARCH'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validatedData = RagSearchSchema.parse(req.body);
      const { query, filters, options } = validatedData;

      const results = options?.includeContext 
        ? await RAGService.searchWithContext(query, filters, 2)
        : await RAGService.hybridSearch(query, filters, options);

      res.json({
        query,
        filters,
        options,
        results,
        total: results.length,
        timestamp: new Date()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error("Advanced RAG search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Get chunk with surrounding context
  app.get("/api/rag/chunks/:id/context", requireAdmin, auditLog('VIEW_CHUNK_CONTEXT'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { window = '2' } = req.query;
      
      const contextWindow = parseInt(String(window));
      const chunks = await RAGService.searchWithContext(
        '', // Empty query since we're fetching by ID
        { documentIds: [id] },
        contextWindow
      );

      if (chunks.length === 0) {
        return res.status(404).json({ error: "Chunk not found" });
      }

      res.json({
        chunk: chunks[0],
        contextWindow,
        hasContext: true
      });
    } catch (error) {
      console.error("Error fetching chunk context:", error);
      res.status(500).json({ error: "Failed to fetch chunk context" });
    }
  });

  // ==================== RAG Answer Generation Endpoints ====================
  
  // Generate answer with citations
  app.post("/api/rag/answer", requireAdmin, validateCSRFToken, auditLog('RAG_GENERATE_ANSWER'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validatedData = RagAnswerSchema.parse(req.body);
      const { query, filters, options } = validatedData;

      // Search for relevant chunks
      const chunks = await RAGService.hybridSearch(
        query,
        filters,
        { limit: options?.searchLimit || 10 }
      );

      if (chunks.length === 0) {
        return res.json({
          answer: "No relevant information found in the knowledge base for your query.",
          citations: [],
          relatedTopics: [],
          confidence: 0,
          queryId: crypto.randomUUID(),
          processingTime: 0
        });
      }

      // Generate answer with citations
      const answer = await RAGService.generateAnswer(
        query,
        chunks,
        {
          maxTokens: options?.maxTokens,
          temperature: options?.temperature
        }
      );

      // Format answer with sources if requested
      if (options?.includeExplanation) {
        answer.answer = RAGService.formatAnswerWithSources(answer.answer, answer.citations);
      }

      res.json(answer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error("Answer generation error:", error);
      res.status(500).json({ error: "Failed to generate answer" });
    }
  });

  // Explain a concept using the knowledge base
  app.post("/api/rag/explain", requireAdmin, validateCSRFToken, auditLog('RAG_EXPLAIN_CONCEPT'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const validatedData = RagExplainSchema.parse(req.body);
      const { concept, targetAudience, filters } = validatedData;

      const explanation = await RAGService.explainConcept(concept, targetAudience);
      
      res.json({
        concept,
        targetAudience,
        explanation,
        timestamp: new Date()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error("Concept explanation error:", error);
      res.status(500).json({ error: "Failed to explain concept" });
    }
  });

  // Find related chunks
  app.get("/api/rag/related/:chunkId", requireAdmin, auditLog('VIEW_RELATED_CHUNKS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { chunkId } = req.params;
      const { limit = '5' } = req.query;
      
      const relatedChunks = await RAGService.findRelatedChunks(
        chunkId,
        parseInt(String(limit))
      );

      res.json({
        sourceChunkId: chunkId,
        relatedChunks,
        total: relatedChunks.length
      });
    } catch (error) {
      console.error("Error finding related chunks:", error);
      res.status(500).json({ error: "Failed to find related chunks" });
    }
  });

  // ==================== Public RAG Endpoints (Rate Limited) ====================
  
  // Public search endpoint with rate limiting
  app.get("/api/public/rag/search", async (req: Request, res: Response) => {
    try {
      const { q, limit = '5' } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      // Limit public searches
      const searchLimit = Math.min(parseInt(String(limit)), 5);
      
      const results = await RAGService.hybridSearch(
        q,
        undefined,
        { 
          limit: searchLimit,
          rerank: false, // Skip reranking for public searches
          mmr: false // Skip MMR for performance
        }
      );

      // Remove sensitive metadata from public results
      const publicResults = results.map(chunk => ({
        id: chunk.id,
        text: chunk.cleanText.substring(0, 500), // Limit text length
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        score: chunk.score
      }));

      res.json({
        query: q,
        results: publicResults,
        total: publicResults.length
      });
    } catch (error) {
      console.error("Public search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Public answer generation for study plans
  app.post("/api/public/rag/answer", async (req: Request, res: Response) => {
    try {
      const { query, topicId } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query is required" });
      }

      // Limit query length for public endpoint
      const truncatedQuery = query.substring(0, 500);
      
      // Search with topic filter if provided
      const filters = topicId ? { topicIds: [topicId] } : undefined;
      const chunks = await RAGService.hybridSearch(
        truncatedQuery,
        filters,
        { limit: 5 } // Limit chunks for public endpoint
      );

      if (chunks.length === 0) {
        return res.json({
          answer: "No relevant information found for your query. Please try rephrasing or exploring related topics.",
          confidence: 0
        });
      }

      // Generate simplified answer for public users
      const answer = await RAGService.generateAnswer(
        truncatedQuery,
        chunks,
        { maxTokens: 300, temperature: 0.3 }
      );

      // Return simplified response
      res.json({
        answer: answer.answer,
        confidence: answer.confidence,
        relatedTopics: answer.relatedTopics.slice(0, 3) // Limit related topics
      });
    } catch (error) {
      console.error("Public answer generation error:", error);
      res.status(500).json({ error: "Failed to generate answer" });
    }
  });

  // Generate study guide from RAG
  app.post("/api/rag/study-guide", requireAdmin, validateCSRFToken, auditLog('RAG_GENERATE_STUDY_GUIDE'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { topic, timeMinutes = 60, level = 'intermediate', filters } = req.body;
      
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      // Search for relevant content
      const chunks = await RAGService.hybridSearch(
        topic,
        filters,
        { limit: 15 } // More chunks for comprehensive guide
      );

      if (chunks.length === 0) {
        return res.status(404).json({ error: "No content found for this topic" });
      }

      // Prepare context from chunks
      const context = chunks
        .map(c => c.cleanText)
        .join("\n\n---\n\n");

      // Generate study guide
      const studyGuide = await AIProcessor.generateStudyGuideFromRAG(
        topic,
        context,
        level
      );

      res.json({
        topic,
        level,
        timeMinutes,
        content: studyGuide,
        sources: chunks.length,
        generatedAt: new Date()
      });
    } catch (error) {
      console.error("Study guide generation error:", error);
      res.status(500).json({ error: "Failed to generate study guide" });
    }
  });

  // ==================== RAG Analytics Endpoints ====================
  
  // Get RAG search analytics
  app.get("/api/rag/analytics", requireAdmin, auditLog('VIEW_RAG_ANALYTICS'), async (req: AdminAuthRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Get citation statistics
      const [citationStats] = await db
        .select({
          totalQueries: sql<number>`count(distinct query_id)`,
          totalCitations: sql<number>`count(*)`,
          avgRelevance: sql<number>`avg(relevance_score)`,
          citationsUsed: sql<number>`count(*) filter (where used_in_answer = true)`
        })
        .from(ragCitations);

      // Get popular search queries (would need to implement query logging)
      const popularQueries: Array<{query: string, count: number}> = []; // Placeholder - implement query logging

      // Get chunk usage statistics
      const [chunkStats] = await db
        .select({
          totalChunks: sql<number>`count(*)`,
          chunksWithEmbeddings: sql<number>`count(*) filter (where embedding is not null)`,
          avgTokens: sql<number>`avg(tokens)`
        })
        .from(documentChunks);

      res.json({
        citations: citationStats,
        queries: {
          popular: popularQueries,
          total: Number(citationStats.totalQueries) || 0
        },
        chunks: chunkStats,
        period: { startDate, endDate }
      });
    } catch (error) {
      console.error("Error fetching RAG analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ==================== Pharmacology PDF Ingestion ====================

  app.post(
    "/api/admin/ingest-pharmacology-pdf",
    requireAdmin,
    validateCSRFToken,
    auditLog("INGEST_PHARMACOLOGY_PDF"),
    async (req: AdminAuthRequest, res: Response) => {
      try {
        const { DocumentProcessor } = await import("./document-processor");
        const fs = await import("fs/promises");
        const path = await import("path");

        const pdfPath = path.join(process.cwd(), "attached_assets", "Pharmacology-WEB_1778122430741.pdf");

        // Verify file exists before starting
        try {
          await fs.access(pdfPath);
        } catch {
          return res.status(404).json({
            error: "Pharmacology PDF not found",
            detail: `Expected at: ${pdfPath}`
          });
        }

        const stats = await fs.stat(pdfPath);

        const adminId = req.session?.adminUser?.userId;
        if (!adminId) {
          return res.status(401).json({ error: "Admin session expired. Please log in again." });
        }

        // Start processing — resolves only when all chunks are embedded and persisted
        let initFailed = false;
        let initError: string | undefined;

        const processingPromise = DocumentProcessor.processDocumentFromDisk(
          pdfPath,
          "Pharmacology for Nurses (OpenStax).pdf",
          adminId,
          {
            generateEmbeddings: true,
            detectTopics: true,
            preserveStructure: true,
            extractTables: false
          }
        );

        // Wait up to 6 seconds to catch immediate failures (validation, auth, DB errors)
        // before sending the success response. Large-file embedding continues in background.
        await Promise.race([
          processingPromise.catch(err => {
            initFailed = true;
            initError = err instanceof Error ? err.message : String(err);
          }),
          new Promise<void>(resolve => setTimeout(resolve, 6_000))
        ]);

        if (initFailed) {
          return res.status(500).json({
            error: "Pharmacology PDF ingestion failed to start",
            details: initError
          });
        }

        // Attach background error handler so unhandled-rejection is not triggered
        processingPromise.then(result => {
          console.log(`[Admin] Pharmacology PDF ingested: doc=${result.document.id}, job=${result.jobId}`);
        }).catch(err => {
          console.error("[Admin] Pharmacology PDF ingestion failed in background:", err);
        });

        res.json({
          success: true,
          message: "Pharmacology PDF ingestion started. Processing in background.",
          fileSizeBytes: stats.size,
          note: "Check Knowledge Base → Documents tab for live processing status."
        });

      } catch (error) {
        console.error("Error initiating pharmacology PDF ingestion:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to start pharmacology PDF ingestion" });
        }
      }
    }
  );

  // ==================== Catalog Seeder ====================

  app.post(
    "/api/admin/seed-catalog",
    requireAdmin,
    validateCSRFToken,
    auditLog("SEED_CATALOG"),
    async (_req: AdminAuthRequest, res: Response) => {
      try {
        const { seedCatalog } = await import("./seed-catalog");
        const result = await seedCatalog();
        res.json({
          success: true,
          message: `Catalog seeded: ${result.totalInserted} records inserted, ${result.totalSkipped} already existed.`,
          details: {
            openRN: result.openRN,
            medSurg: result.medSurg,
            populationHealth: result.populationHealth,
            nutrition: result.nutrition,
            pharmacology: result.pharmacology,
            clinicalSkills: result.clinicalSkills,
          },
          totalInserted: result.totalInserted,
          totalSkipped: result.totalSkipped,
        });
      } catch (error) {
        console.error("Seed catalog error:", error);
        res.status(500).json({ error: "Failed to seed catalog" });
      }
    }
  );
}
