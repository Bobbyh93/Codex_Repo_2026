import type { Express } from "express";
import { contentGenerationEngine } from "./content-generation-engine";
import { authenticateToken, requireRole, type AuthRequest } from "./middleware/auth";
import { z } from "zod";

// Request schemas
const generateStudyPathSchema = z.object({
  reportId: z.string().uuid(),
  maxHours: z.number().min(1).max(200).optional(),
  focusAreas: z.array(z.string()).optional(),
  pathType: z.enum(['remedial', 'standard', 'accelerated', 'mastery']).optional()
});

const generateContentSchema = z.object({
  topicId: z.string().uuid(),
  contentType: z.enum(['explanation', 'example', 'practice', 'summary'])
});

const analyzeCoverageSchema = z.object({
  topicId: z.string().uuid()
});

export function registerContentGenerationRoutes(app: Express) {
  // Admin authentication middleware for all content generation routes
  const requireAdmin = [authenticateToken, requireRole('admin')];

  /**
   * Generate personalized study path based on assessment report
   */
  app.post('/api/admin/content/generate-study-path', requireAdmin, async (req, res) => {
    try {
      const data = generateStudyPathSchema.parse(req.body);
      
      const studyPath = await contentGenerationEngine.generatePersonalizedStudyPath(
        data.reportId,
        {
          maxHours: data.maxHours,
          focusAreas: data.focusAreas,
          pathType: data.pathType
        }
      );
      
      res.json({
        success: true,
        studyPath
      });
    } catch (error) {
      console.error('Error generating study path:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: 'Failed to generate study path',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate study content for a specific topic
   */
  app.post('/api/admin/content/generate-content', requireAdmin, async (req, res) => {
    try {
      const data = generateContentSchema.parse(req.body);
      
      const content = await contentGenerationEngine.generateStudyContent(
        data.topicId,
        data.contentType
      );
      
      res.json({
        success: true,
        content
      });
    } catch (error) {
      console.error('Error generating content:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: 'Failed to generate content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Analyze content coverage for a topic
   */
  app.post('/api/admin/content/analyze-coverage', requireAdmin, async (req, res) => {
    try {
      const data = analyzeCoverageSchema.parse(req.body);
      
      const analysis = await contentGenerationEngine.analyzeContentCoverage(data.topicId);
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error('Error analyzing coverage:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: 'Failed to analyze coverage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate batch study paths for multiple reports
   */
  app.post('/api/admin/content/generate-batch-paths', requireAdmin, async (req, res) => {
    try {
      const { reportIds, options = {} } = req.body;
      
      if (!Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ error: 'reportIds array is required' });
      }
      
      const results = await Promise.allSettled(
        reportIds.map(reportId => 
          contentGenerationEngine.generatePersonalizedStudyPath(reportId, options)
        )
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').map(r => (r as any).value);
      const failed = results.filter(r => r.status === 'rejected').map((r, i) => ({
        reportId: reportIds[i],
        error: (r as any).reason?.message || 'Unknown error'
      }));
      
      res.json({
        success: true,
        generated: successful.length,
        failed: failed.length,
        studyPaths: successful,
        errors: failed
      });
    } catch (error) {
      console.error('Error generating batch paths:', error);
      res.status(500).json({ 
        error: 'Failed to generate batch study paths',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get content generation templates
   */
  app.get('/api/admin/content/templates', requireAdmin, async (req, res) => {
    try {
      // Return available templates for content generation
      const templates = {
        studyPathTypes: ['remedial', 'standard', 'accelerated', 'mastery'],
        contentTypes: ['explanation', 'example', 'practice', 'summary'],
        bloomsLevels: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
        resourceTypes: ['video', 'article', 'quiz', 'simulation', 'textbook'],
        nclexCategories: [
          'Safe and Effective Care Environment',
          'Physiological Integrity',
          'Psychosocial Integrity',
          'Health Promotion and Maintenance'
        ]
      };
      
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  /**
   * Preview generated content before saving
   */
  app.post('/api/admin/content/preview', requireAdmin, async (req, res) => {
    try {
      const { topicId, includeAll = false } = req.body;
      
      if (!topicId) {
        return res.status(400).json({ error: 'topicId is required' });
      }
      
      const contentTypes = includeAll 
        ? ['explanation', 'example', 'practice', 'summary'] as const
        : ['summary'] as const;
      
      const previews = await Promise.all(
        contentTypes.map(async (type) => {
          try {
            const content = await contentGenerationEngine.generateStudyContent(topicId, type);
            return { type, ...content };
          } catch (error) {
            return { type, error: 'Failed to generate' };
          }
        })
      );
      
      res.json({
        success: true,
        topicId,
        previews
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      res.status(500).json({ 
        error: 'Failed to generate preview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get content generation statistics
   */
  app.get('/api/admin/content/generation-stats', requireAdmin, async (req, res) => {
    try {
      // This would typically query the database for actual stats
      // For now, returning mock statistics
      const stats = {
        totalStudyPathsGenerated: 0,
        totalContentGenerated: 0,
        averagePathCompletionRate: 0,
        topPerformingPaths: [],
        contentCoverageByCategory: {
          'Safe and Effective Care Environment': 85,
          'Physiological Integrity': 78,
          'Psychosocial Integrity': 72,
          'Health Promotion and Maintenance': 80
        },
        generationTrends: {
          daily: [],
          weekly: [],
          monthly: []
        }
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching generation stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });
}