/**
 * API routes for curriculum integration.
 * Public catalog routes (/api/curriculum/health|subjects|chapters|search|topic)
 * now query local Postgres tables seeded from the NUR2200 blueprint.
 * External CurriculumService is kept only for recommendations and progress tracking.
 */

import type { Express, Request, Response } from 'express';
import { CurriculumService } from './curriculum-service';
import { CurriculumProgressService } from './curriculum-progress-service';
import { z } from 'zod';
import { db } from './db';
import {
  assessmentReports, topicPerformance, nursingTopics,
  curriculumObjectives, curriculumAssessments, curriculumObjectiveAssessments,
} from '@shared/schema';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';

// Shared slug helper
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Build rich topic chapter list from local DB, optionally filtered by subject display name
async function buildLocalTopicChapters(subject?: string) {
  const rows = subject
    ? await db.select().from(curriculumObjectives).where(eq(curriculumObjectives.moduleDisplayName, subject))
    : await db.select().from(curriculumObjectives);

  // Build a map: topicName → per-objective records
  type ObjRow = typeof rows[number];
  const topicMap = new Map<string, { objs: ObjRow[]; subject: string }>();
  for (const obj of rows) {
    const topics = Array.isArray(obj.topics) ? obj.topics : [];
    for (const topic of topics) {
      if (!topic) continue;
      if (!topicMap.has(topic)) topicMap.set(topic, { objs: [], subject: obj.moduleDisplayName });
      topicMap.get(topic)!.objs.push(obj);
    }
  }

  // Gather all objective IDs so we can count linked assessments in one query
  const allObjectiveIds = rows.map((r) => r.objectiveId);
  const allLinks = allObjectiveIds.length > 0
    ? await db.select().from(curriculumObjectiveAssessments)
        .where(inArray(curriculumObjectiveAssessments.objectiveId, allObjectiveIds))
    : [];

  // assessmentId set per objectiveId
  const objAssessmentMap = new Map<string, Set<string>>();
  for (const link of allLinks) {
    if (!objAssessmentMap.has(link.objectiveId)) objAssessmentMap.set(link.objectiveId, new Set());
    objAssessmentMap.get(link.objectiveId)!.add(link.assessmentId);
  }

  return Array.from(topicMap.entries())
    .map(([name, { objs, subject: sub }]) => {
      const bloomLevels = [...new Set(objs.map((o) => o.bloomLevel).filter(Boolean))] as string[];
      const ncjmmOps = [...new Set(objs.map((o) => o.ncjmmOperation).filter(Boolean))] as string[];
      const nclexCategories = [...new Set(objs.map((o) => o.nclexCategory).filter(Boolean))] as string[];
      const atiChapters = [...new Set(
        objs.flatMap((o) => (o.atiChapters ? o.atiChapters.split(',').map((s) => s.trim()) : []))
          .filter(Boolean)
      )];
      const linkedAssessmentIds = new Set<string>();
      for (const obj of objs) {
        const aSet = objAssessmentMap.get(obj.objectiveId);
        if (aSet) aSet.forEach((id) => linkedAssessmentIds.add(id));
      }
      return {
        chapter_id: slugify(name),
        chapter_name: name,
        subject: sub,
        topic_count: objs.length,
        bloom_levels: bloomLevels,
        ncjmm_operations: ncjmmOps,
        nclex_categories: nclexCategories,
        ati_chapters: atiChapters,
        assessment_count: linkedAssessmentIds.size,
      };
    })
    .sort((a, b) => a.chapter_name.localeCompare(b.chapter_name));
}

export function registerCurriculumRoutes(app: Express) {
  /**
   * Health — always OK (local DB, no external dependency)
   */
  app.get('/api/curriculum/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', source: 'local' });
  });

  /**
   * Subjects — distinct module display names from local DB
   */
  app.get('/api/curriculum/subjects', async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .selectDistinct({ moduleDisplayName: curriculumObjectives.moduleDisplayName })
        .from(curriculumObjectives)
        .orderBy(asc(curriculumObjectives.moduleDisplayName));
      res.json(rows.map((r) => r.moduleDisplayName));
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  });

  /**
   * Chapters filtered by subject — local DB
   */
  app.get('/api/curriculum/chapters/by-subject', async (req: Request, res: Response) => {
    try {
      const subject = typeof req.query.subject === 'string' ? req.query.subject : undefined;
      const chapters = await buildLocalTopicChapters(subject);
      res.json(chapters);
    } catch (error) {
      console.error('Failed to fetch chapters by subject:', error);
      res.status(500).json({ error: 'Failed to fetch chapters' });
    }
  });

  // Legacy singular alias — handled by topicDetailHandler below
  // (registered after the function definition)

  /**
   * Search — local DB text filter
   */
  app.get('/api/curriculum/search', async (req: Request, res: Response) => {
    try {
      const text = typeof req.query.text === 'string' ? req.query.text.toLowerCase() : '';
      const chapters = await buildLocalTopicChapters();
      const filtered = text
        ? chapters.filter(
            (c) => c.chapter_name.toLowerCase().includes(text) || c.subject.toLowerCase().includes(text)
          )
        : chapters;
      res.json(filtered);
    } catch (error) {
      console.error('Search error:', error);
      res.json([]);
    }
  });

  /**
   * Get curriculum recommendations for an assessment report
   * Finds relevant chapters based on weak topics identified in the assessment
   */
  app.get('/api/curriculum/recommendations/:reportId', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { threshold = 70 } = req.query;
      
      // Get weak topics from the assessment
      const weakTopics = await db
        .select({
          topicName: nursingTopics.name,
          score: topicPerformance.score
        })
        .from(topicPerformance)
        .innerJoin(nursingTopics, eq(topicPerformance.topicId, nursingTopics.id))
        .where(
          and(
            eq(topicPerformance.reportId, reportId),
            sql`CAST(${topicPerformance.score} AS DECIMAL) <= ${Number(threshold)}`
          )
        )
        .orderBy(topicPerformance.score);
      
      if (weakTopics.length === 0) {
        return res.json({ 
          message: 'No weak topics found', 
          recommendations: [] 
        });
      }
      
      // Get curriculum chapters for weak topics
      const topicNames = weakTopics.map(t => t.topicName);
      let topicToChapters = new Map();
      let serviceStatus = 'available';
      
      try {
        topicToChapters = await CurriculumService.getChaptersForTopics(topicNames);
      } catch (error) {
        console.error('Failed to fetch curriculum recommendations:', error);
        serviceStatus = 'unavailable';
        // Continue with empty recommendations but include status
      }
      
      // Format recommendations
      const recommendations = weakTopics.map(topic => ({
        topic: topic.topicName,
        score: topic.score,
        chapters: topicToChapters.get(topic.topicName) || []
      }));
      
      res.json({
        reportId,
        threshold,
        weakTopicsCount: weakTopics.length,
        recommendations,
        serviceStatus,
        message: serviceStatus === 'unavailable' 
          ? 'Curriculum recommendations temporarily unavailable. Please try again later.'
          : undefined
      });
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      res.status(500).json({ error: 'Failed to generate recommendations' });
    }
  });

  /**
   * Generate learning guide for a chapter
   */
  app.post('/api/curriculum/learning-guide/:chapterId', async (req: Request, res: Response) => {
    try {
      const { chapterId } = req.params;
      const guide = await CurriculumService.generateLearningGuide(chapterId);
      res.json(guide);
    } catch (error) {
      console.error('Failed to generate learning guide:', error);
      res.status(500).json({ error: 'Failed to generate learning guide' });
    }
  });

  /**
   * All chapters — local DB with rich metadata
   */
  app.get('/api/curriculum/chapters', async (_req: Request, res: Response) => {
    try {
      const chapters = await buildLocalTopicChapters();
      res.json(chapters);
    } catch (error) {
      console.error('Failed to fetch chapters:', error);
      res.status(500).json({ error: 'Failed to fetch chapters' });
    }
  });

  /**
   * Chapter/topic detail by slug.
   * /api/curriculum/topics/:id  — primary endpoint per task spec (plural)
   * /api/curriculum/chapters/:id — alias (matches frontend route param)
   */
  async function topicDetailHandler(req: Request, res: Response) {
    const topicSlug = req.params.id;
    try {
      const allObjectives = await db.select().from(curriculumObjectives);
      const matchingObjectives = allObjectives.filter((obj) => {
        const topics = Array.isArray(obj.topics) ? obj.topics : [];
        return topics.some((t) => slugify(t) === topicSlug);
      });
      if (matchingObjectives.length === 0) {
        return res.status(404).json({ error: 'Topic not found' });
      }
      const topicDisplayName = (() => {
        for (const obj of matchingObjectives) {
          const topics = Array.isArray(obj.topics) ? obj.topics : [];
          const match = topics.find((t) => slugify(t) === topicSlug);
          if (match) return match;
        }
        return topicSlug;
      })();
      const objectiveIds = matchingObjectives.map((o) => o.objectiveId);
      const links = objectiveIds.length > 0
        ? await db.select().from(curriculumObjectiveAssessments)
            .where(inArray(curriculumObjectiveAssessments.objectiveId, objectiveIds))
        : [];
      const linkedAssessmentIds = [...new Set(links.map((l) => l.assessmentId))];
      const assessments = linkedAssessmentIds.length > 0
        ? await db.select().from(curriculumAssessments)
            .where(inArray(curriculumAssessments.assessmentId, linkedAssessmentIds))
        : [];
      const bloomCounts: Record<string, number> = {};
      const ncjmmCounts: Record<string, number> = {};
      for (const obj of matchingObjectives) {
        const bl = obj.bloomLevel || 'Unknown';
        bloomCounts[bl] = (bloomCounts[bl] || 0) + 1;
        const nc = obj.ncjmmOperation || 'Unknown';
        ncjmmCounts[nc] = (ncjmmCounts[nc] || 0) + 1;
      }
      res.json({
        topicSlug,
        topicName: topicDisplayName,
        subject: matchingObjectives[0]?.moduleDisplayName ?? 'Mental Health Nursing',
        objectives: matchingObjectives.map((o) => ({
          id: o.objectiveId,
          weekNo: o.weekNo,
          text: o.objectiveText,
          bloomLevel: o.bloomLevel,
          bloomKnowledge: o.bloomKnowledge,
          ncjmmOperation: o.ncjmmOperation,
          nclexCategory: o.nclexCategory,
          nclexSubcategory: o.nclexSubcategory,
          atiChapters: o.atiChapters,
        })),
        assessments: assessments.map((a) => ({
          id: a.assessmentId,
          name: a.assessmentName,
          type: a.assessmentType,
          weeksCovered: a.weeksCovered,
          points: a.points,
          isCumulative: a.isCumulative,
        })),
        bloomDistribution: bloomCounts,
        ncjmmDistribution: ncjmmCounts,
      });
    } catch (error) {
      console.error('Failed to fetch chapter detail:', error);
      res.status(500).json({ error: 'Failed to fetch chapter detail' });
    }
  }

  // Canonical endpoints — all use the shared topicDetailHandler (req.params.id)
  app.get('/api/curriculum/topics/:id', topicDetailHandler);    // primary per spec (plural)
  app.get('/api/curriculum/chapters/:id', topicDetailHandler);  // alias (matches frontend param)
  app.get('/api/curriculum/topic/:id', topicDetailHandler);     // legacy singular alias

  /**
   * Clear curriculum cache (admin only)
   */
  app.post('/api/curriculum/cache/clear', async (req: Request, res: Response) => {
    try {
      // TODO: Add admin authentication check here
      CurriculumService.clearCache();
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });

  /**
   * Progress Tracking Routes
   */
  const progressService = new CurriculumProgressService();

  /**
   * Get user's progress for all chapters
   */
  app.get('/api/curriculum/progress', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const progress = await progressService.getUserProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  });

  /**
   * Get progress for a specific chapter
   */
  app.get('/api/curriculum/progress/:chapterId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { chapterId } = req.params;
      const progress = await progressService.getChapterProgress(userId, chapterId);
      
      if (!progress) {
        return res.json({
          chapterId,
          status: 'not_started',
          progressPercentage: 0,
          timeSpent: 0
        });
      }

      res.json(progress);
    } catch (error) {
      console.error('Failed to fetch chapter progress:', error);
      res.status(500).json({ error: 'Failed to fetch chapter progress' });
    }
  });

  /**
   * Start or update progress for a chapter
   */
  app.post('/api/curriculum/progress/:chapterId/start', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { chapterId } = req.params;
      const { chapterName, subject, topicId } = req.body;

      const progress = await progressService.startChapter(userId, chapterId, {
        chapterName,
        subject,
        topicId
      });

      res.json(progress);
    } catch (error) {
      console.error('Failed to start chapter:', error);
      res.status(500).json({ error: 'Failed to start chapter' });
    }
  });

  /**
   * Update progress percentage for a chapter
   */
  app.post('/api/curriculum/progress/:chapterId/update', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { chapterId } = req.params;
      const { progressPercentage, timeSpentMinutes } = req.body;

      if (typeof progressPercentage !== 'number' || progressPercentage < 0 || progressPercentage > 100) {
        return res.status(400).json({ error: 'Invalid progress percentage' });
      }

      const progress = await progressService.updateProgress(
        userId,
        chapterId,
        progressPercentage,
        timeSpentMinutes
      );

      if (!progress) {
        return res.status(404).json({ error: 'Progress entry not found' });
      }

      res.json(progress);
    } catch (error) {
      console.error('Failed to update progress:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  });

  /**
   * Mark a chapter as completed
   */
  app.post('/api/curriculum/progress/:chapterId/complete', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { chapterId } = req.params;
      const { timeSpentMinutes } = req.body;

      const progress = await progressService.completeChapter(userId, chapterId, timeSpentMinutes);
      
      if (!progress) {
        return res.status(404).json({ error: 'Progress entry not found' });
      }

      res.json(progress);
    } catch (error) {
      console.error('Failed to complete chapter:', error);
      res.status(500).json({ error: 'Failed to complete chapter' });
    }
  });

  /**
   * Get user's curriculum statistics
   */
  app.get('/api/curriculum/statistics', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await progressService.getUserStatistics(userId);
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });
}