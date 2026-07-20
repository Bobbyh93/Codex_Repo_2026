import type { Express } from "express";
import { db } from "./db";
import { 
  nclexTopicCrosswalk,
  topicObjectivesCrosswalk,
  objectiveResourcesCrosswalk,
  atiNclexCrosswalk,
  performancePathCrosswalk,
  studyPathTemplates,
  contentCoverageMatrix,
  learningObjectives,
  crosswalkImportHistory,
  insertNclexTopicCrosswalkSchema,
  insertTopicObjectivesCrosswalkSchema,
  insertObjectiveResourcesCrosswalkSchema,
  insertAtiNclexCrosswalkSchema,
  insertPerformancePathCrosswalkSchema,
  insertStudyPathTemplateSchema,
  insertLearningObjectiveSchema,
} from "@shared/crosswalk-schema";
import { eq, and, sql, desc, asc, like, gte, lte } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import Papa from "papaparse";
import { authenticateToken, requireRole, type AuthRequest } from "./middleware/auth";

// CSV file validation for crosswalk imports
const csvFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  const allowedMimeTypes = ['text/csv', 'application/csv', 'text/plain'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    console.warn(`[Security] Rejected file upload: Invalid MIME type ${file.mimetype} for CSV from IP ${req.ip}`);
    return cb(new Error('Only CSV files are allowed. Please upload a valid CSV file.'));
  }

  // Check file extension
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  if (fileExtension !== 'csv') {
    console.warn(`[Security] Rejected file upload: Invalid extension .${fileExtension} for CSV from IP ${req.ip}`);
    return cb(new Error('Only CSV files with .csv extension are allowed.'));
  }

  // Accept the file
  cb(null, true);
};

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file per upload
  },
  fileFilter: csvFileFilter
});

export function registerCrosswalkRoutes(app: Express) {
  // Admin authentication middleware for all crosswalk routes
  const requireAdmin = [authenticateToken, requireRole('admin')];

  // ============== NCLEX Topic Crosswalk ==============
  
  // Get all NCLEX-Topic crosswalks with filtering
  app.get('/api/admin/crosswalk/nclex-topic', requireAdmin, async (req, res) => {
    try {
      const { nclexCategory, topicId, verified } = req.query;
      
      let query = db.select().from(nclexTopicCrosswalk);
      const conditions = [];
      
      if (nclexCategory) {
        conditions.push(eq(nclexTopicCrosswalk.nclexCategory, nclexCategory as string));
      }
      if (topicId) {
        conditions.push(eq(nclexTopicCrosswalk.topicId, topicId as string));
      }
      if (verified !== undefined) {
        conditions.push(eq(nclexTopicCrosswalk.isVerified, verified === 'true'));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const crosswalks = await query.orderBy(asc(nclexTopicCrosswalk.nclexCategory));
      res.json(crosswalks);
    } catch (error) {
      console.error('Error fetching NCLEX-Topic crosswalks:', error);
      res.status(500).json({ error: 'Failed to fetch crosswalks' });
    }
  });

  // Create new NCLEX-Topic crosswalk
  app.post('/api/admin/crosswalk/nclex-topic', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const data = insertNclexTopicCrosswalkSchema.parse(req.body);
      const [crosswalk] = await db.insert(nclexTopicCrosswalk).values(data).returning();
      res.json(crosswalk);
    } catch (error) {
      console.error('Error creating NCLEX-Topic crosswalk:', error);
      res.status(500).json({ error: 'Failed to create crosswalk' });
    }
  });

  // Update NCLEX-Topic crosswalk
  app.put('/api/admin/crosswalk/nclex-topic/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (req.body.isVerified && req.user) {
        updates.verifiedBy = req.user.email;
        updates.verifiedAt = new Date();
      }
      
      const [updated] = await db
        .update(nclexTopicCrosswalk)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(nclexTopicCrosswalk.id, id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating NCLEX-Topic crosswalk:', error);
      res.status(500).json({ error: 'Failed to update crosswalk' });
    }
  });

  // Delete NCLEX-Topic crosswalk
  app.delete('/api/admin/crosswalk/nclex-topic/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(nclexTopicCrosswalk).where(eq(nclexTopicCrosswalk.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting NCLEX-Topic crosswalk:', error);
      res.status(500).json({ error: 'Failed to delete crosswalk' });
    }
  });

  // ============== Learning Objectives ==============
  
  // Get all learning objectives
  app.get('/api/admin/learning-objectives', requireAdmin, async (req, res) => {
    try {
      const { bloomsLevel, practiceArea, search } = req.query;
      
      let query = db.select().from(learningObjectives);
      const conditions = [];
      
      if (bloomsLevel) {
        conditions.push(eq(learningObjectives.bloomsLevel, bloomsLevel as string));
      }
      if (practiceArea) {
        conditions.push(eq(learningObjectives.practiceArea, practiceArea as string));
      }
      if (search) {
        conditions.push(like(learningObjectives.objectiveText, `%${search}%`));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const objectives = await query.orderBy(asc(learningObjectives.objectiveText));
      res.json(objectives);
    } catch (error) {
      console.error('Error fetching learning objectives:', error);
      res.status(500).json({ error: 'Failed to fetch objectives' });
    }
  });

  // Create learning objective
  app.post('/api/admin/learning-objectives', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const data = insertLearningObjectiveSchema.parse(req.body);
      const [objective] = await db
        .insert(learningObjectives)
        .values({ ...data, createdBy: req.user?.email })
        .returning();
      res.json(objective);
    } catch (error) {
      console.error('Error creating learning objective:', error);
      res.status(500).json({ error: 'Failed to create objective' });
    }
  });

  // ============== Topic-Objectives Crosswalk ==============
  
  // Get topic-objectives crosswalks
  app.get('/api/admin/crosswalk/topic-objectives', requireAdmin, async (req, res) => {
    try {
      const { topicId, objectiveId, isCore } = req.query;
      
      let query = db.select().from(topicObjectivesCrosswalk);
      const conditions = [];
      
      if (topicId) {
        conditions.push(eq(topicObjectivesCrosswalk.topicId, topicId as string));
      }
      if (objectiveId) {
        conditions.push(eq(topicObjectivesCrosswalk.objectiveId, objectiveId as string));
      }
      if (isCore !== undefined) {
        conditions.push(eq(topicObjectivesCrosswalk.isCore, isCore === 'true'));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const crosswalks = await query.orderBy(asc(topicObjectivesCrosswalk.orderIndex));
      res.json(crosswalks);
    } catch (error) {
      console.error('Error fetching topic-objectives crosswalks:', error);
      res.status(500).json({ error: 'Failed to fetch crosswalks' });
    }
  });

  // Create topic-objectives crosswalk
  app.post('/api/admin/crosswalk/topic-objectives', requireAdmin, async (req, res) => {
    try {
      const data = insertTopicObjectivesCrosswalkSchema.parse(req.body);
      const [crosswalk] = await db.insert(topicObjectivesCrosswalk).values(data).returning();
      res.json(crosswalk);
    } catch (error) {
      console.error('Error creating topic-objectives crosswalk:', error);
      res.status(500).json({ error: 'Failed to create crosswalk' });
    }
  });

  // ============== Study Path Templates ==============
  
  // Get all study path templates
  app.get('/api/admin/study-path-templates', requireAdmin, async (req, res) => {
    try {
      const { pathType, targetAudience, isPublished } = req.query;
      
      let query = db.select().from(studyPathTemplates);
      const conditions = [];
      
      if (pathType) {
        conditions.push(eq(studyPathTemplates.pathType, pathType as string));
      }
      if (targetAudience) {
        conditions.push(eq(studyPathTemplates.targetAudience, targetAudience as string));
      }
      if (isPublished !== undefined) {
        conditions.push(eq(studyPathTemplates.isPublished, isPublished === 'true'));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const templates = await query.orderBy(desc(studyPathTemplates.createdAt));
      res.json(templates);
    } catch (error) {
      console.error('Error fetching study path templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create study path template
  app.post('/api/admin/study-path-templates', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const data = insertStudyPathTemplateSchema.parse(req.body);
      const [template] = await db
        .insert(studyPathTemplates)
        .values({ ...data, createdBy: req.user?.email })
        .returning();
      res.json(template);
    } catch (error) {
      console.error('Error creating study path template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // Update study path template
  app.put('/api/admin/study-path-templates/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.isPublished && !updates.publishedAt) {
        updates.publishedAt = new Date();
      }
      
      const [updated] = await db
        .update(studyPathTemplates)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(studyPathTemplates.id, id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating study path template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // ============== Performance Path Crosswalk ==============
  
  // Get performance-path crosswalks
  app.get('/api/admin/crosswalk/performance-path', requireAdmin, async (req, res) => {
    try {
      const { performanceLevel, pathType } = req.query;
      
      let query = db.select().from(performancePathCrosswalk);
      const conditions = [];
      
      if (performanceLevel) {
        conditions.push(eq(performancePathCrosswalk.performanceLevel, performanceLevel as string));
      }
      if (pathType) {
        conditions.push(eq(performancePathCrosswalk.pathType, pathType as string));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const crosswalks = await query.orderBy(asc(performancePathCrosswalk.performanceLevel));
      res.json(crosswalks);
    } catch (error) {
      console.error('Error fetching performance-path crosswalks:', error);
      res.status(500).json({ error: 'Failed to fetch crosswalks' });
    }
  });

  // Create performance-path crosswalk
  app.post('/api/admin/crosswalk/performance-path', requireAdmin, async (req, res) => {
    try {
      const data = insertPerformancePathCrosswalkSchema.parse(req.body);
      const [crosswalk] = await db.insert(performancePathCrosswalk).values(data).returning();
      res.json(crosswalk);
    } catch (error) {
      console.error('Error creating performance-path crosswalk:', error);
      res.status(500).json({ error: 'Failed to create crosswalk' });
    }
  });

  // ============== Content Coverage Matrix ==============
  
  // Get content coverage matrix
  app.get('/api/admin/content-coverage', requireAdmin, async (req, res) => {
    try {
      const { topicId, resourceId, minCoverage } = req.query;
      
      let query = db.select().from(contentCoverageMatrix);
      const conditions = [];
      
      if (topicId) {
        conditions.push(eq(contentCoverageMatrix.topicId, topicId as string));
      }
      if (resourceId) {
        conditions.push(eq(contentCoverageMatrix.resourceId, resourceId as string));
      }
      if (minCoverage) {
        conditions.push(gte(contentCoverageMatrix.coveragePercent, parseFloat(minCoverage as string)));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const coverage = await query.orderBy(desc(contentCoverageMatrix.coveragePercent));
      res.json(coverage);
    } catch (error) {
      console.error('Error fetching content coverage:', error);
      res.status(500).json({ error: 'Failed to fetch coverage' });
    }
  });

  // Update content coverage
  app.put('/api/admin/content-coverage', requireAdmin, async (req, res) => {
    try {
      const { topicId, resourceId, ...updates } = req.body;
      
      const existing = await db
        .select()
        .from(contentCoverageMatrix)
        .where(and(
          eq(contentCoverageMatrix.topicId, topicId),
          eq(contentCoverageMatrix.resourceId, resourceId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing
        const [updated] = await db
          .update(contentCoverageMatrix)
          .set({ ...updates, updatedAt: new Date() })
          .where(and(
            eq(contentCoverageMatrix.topicId, topicId),
            eq(contentCoverageMatrix.resourceId, resourceId)
          ))
          .returning();
        res.json(updated);
      } else {
        // Insert new
        const [created] = await db
          .insert(contentCoverageMatrix)
          .values({ topicId, resourceId, ...updates })
          .returning();
        res.json(created);
      }
    } catch (error) {
      console.error('Error updating content coverage:', error);
      res.status(500).json({ error: 'Failed to update coverage' });
    }
  });

  // ============== Bulk Import/Export ==============
  
  // Import crosswalk data from CSV
  app.post('/api/admin/crosswalk/import/:type', requireAdmin, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      const { type } = req.params;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const csvText = file.buffer.toString('utf-8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      
      if (parsed.errors.length > 0) {
        return res.status(400).json({ 
          error: 'CSV parsing errors', 
          details: parsed.errors 
        });
      }
      
      // Create import history record
      const [importRecord] = await db
        .insert(crosswalkImportHistory)
        .values({
          importType: type,
          fileName: file.originalname,
          totalRecords: parsed.data.length,
          status: 'processing',
          startedAt: new Date(),
          importedBy: req.user?.email
        })
        .returning();
      
      let successCount = 0;
      let failedCount = 0;
      const errors: any[] = [];
      
      // Process based on type
      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        try {
          switch (type) {
            case 'nclex-topic':
              await db.insert(nclexTopicCrosswalk).values({
                nclexCategory: row.nclexCategory,
                nclexSubcategory: row.nclexSubcategory,
                topicId: row.topicId,
                topicName: row.topicName,
                mappingStrength: parseFloat(row.mappingStrength) || 1.0,
                mappingType: row.mappingType || 'primary'
              });
              break;
              
            case 'topic-objectives':
              await db.insert(topicObjectivesCrosswalk).values({
                topicId: row.topicId,
                topicName: row.topicName,
                objectiveId: row.objectiveId,
                objectiveText: row.objectiveText,
                bloomsLevel: row.bloomsLevel,
                isCore: row.isCore === 'true',
                orderIndex: parseInt(row.orderIndex) || 0
              });
              break;
              
            case 'ati-nclex':
              await db.insert(atiNclexCrosswalk).values({
                atiCategory: row.atiCategory,
                atiSubcategory: row.atiSubcategory,
                nclexCategory: row.nclexCategory,
                nclexSubcategory: row.nclexSubcategory,
                mappingConfidence: parseFloat(row.mappingConfidence) || 1.0
              });
              break;
              
            default:
              throw new Error('Unknown import type');
          }
          successCount++;
        } catch (error) {
          failedCount++;
          errors.push({ row: i + 1, error: (error as Error).message });
        }
      }
      
      // Update import history
      await db
        .update(crosswalkImportHistory)
        .set({
          successfulRecords: successCount,
          failedRecords: failedCount,
          validationErrors: errors,
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(crosswalkImportHistory.id, importRecord.id));
      
      res.json({
        success: true,
        totalRecords: parsed.data.length,
        successfulRecords: successCount,
        failedRecords: failedCount,
        errors: errors.slice(0, 10) // Return first 10 errors
      });
      
    } catch (error) {
      console.error('Error importing crosswalk data:', error);
      res.status(500).json({ error: 'Failed to import data' });
    }
  });

  // Export crosswalk data to CSV
  app.get('/api/admin/crosswalk/export/:type', requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      let data: any[] = [];
      
      switch (type) {
        case 'nclex-topic':
          data = await db.select().from(nclexTopicCrosswalk);
          break;
        case 'topic-objectives':
          data = await db.select().from(topicObjectivesCrosswalk);
          break;
        case 'ati-nclex':
          data = await db.select().from(atiNclexCrosswalk);
          break;
        case 'performance-path':
          data = await db.select().from(performancePathCrosswalk);
          break;
        default:
          return res.status(400).json({ error: 'Unknown export type' });
      }
      
      const csv = Papa.unparse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-crosswalk-${Date.now()}.csv"`);
      res.send(csv);
      
    } catch (error) {
      console.error('Error exporting crosswalk data:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  });

  // ============== Analytics Endpoints ==============
  
  // Get crosswalk statistics
  app.get('/api/admin/crosswalk/stats', requireAdmin, async (req, res) => {
    try {
      const stats = {
        nclexTopicCount: await db.select({ count: sql<number>`count(*)` }).from(nclexTopicCrosswalk),
        topicObjectivesCount: await db.select({ count: sql<number>`count(*)` }).from(topicObjectivesCrosswalk),
        objectiveResourcesCount: await db.select({ count: sql<number>`count(*)` }).from(objectiveResourcesCrosswalk),
        atiNclexCount: await db.select({ count: sql<number>`count(*)` }).from(atiNclexCrosswalk),
        performancePathCount: await db.select({ count: sql<number>`count(*)` }).from(performancePathCrosswalk),
        studyPathTemplatesCount: await db.select({ count: sql<number>`count(*)` }).from(studyPathTemplates),
        learningObjectivesCount: await db.select({ count: sql<number>`count(*)` }).from(learningObjectives),
        
        // Verification stats
        verifiedNclexTopicCount: await db
          .select({ count: sql<number>`count(*)` })
          .from(nclexTopicCrosswalk)
          .where(eq(nclexTopicCrosswalk.isVerified, true)),
        
        // Coverage stats
        avgCoveragePercent: await db
          .select({ avg: sql<number>`avg(coverage_percent)` })
          .from(contentCoverageMatrix)
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching crosswalk stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Get coverage gaps
  app.get('/api/admin/crosswalk/coverage-gaps', requireAdmin, async (req, res) => {
    try {
      const { threshold = 50 } = req.query;
      
      // Find topics with low coverage
      const gaps = await db
        .select({
          topicId: contentCoverageMatrix.topicId,
          avgCoverage: sql<number>`avg(${contentCoverageMatrix.coveragePercent})`,
          resourceCount: sql<number>`count(${contentCoverageMatrix.resourceId})`
        })
        .from(contentCoverageMatrix)
        .groupBy(contentCoverageMatrix.topicId)
        .having(sql`avg(${contentCoverageMatrix.coveragePercent}) < ${threshold}`)
        .orderBy(sql`avg(${contentCoverageMatrix.coveragePercent})`);
      
      res.json(gaps);
    } catch (error) {
      console.error('Error fetching coverage gaps:', error);
      res.status(500).json({ error: 'Failed to fetch coverage gaps' });
    }
  });
}