/**
 * Service for integrating with external curriculum API
 * Fetches and caches curriculum content from NurseStudy API
 */

import { z } from 'zod';

// API Configuration
const CURRICULUM_API_BASE = 'https://57fbef8e-b437-4fd4-9ebb-32c388720985-00-16wvo8lc38ve7.kirk.replit.dev';

// Type definitions for curriculum data
export const ChapterSchema = z.object({
  chapter_id: z.string(),
  chapter_name: z.string(),
  subject: z.string(),
  topic_name: z.string().optional(),
  sub_topics: z.array(z.string()).optional(),
  content: z.string().optional(),
  learning_objectives: z.array(z.string()).optional(),
  key_points: z.array(z.string()).optional()
});

export const ChapterSummarySchema = z.object({
  chapter_id: z.string(),
  chapter_name: z.string(),
  subject: z.string(),
  topic_count: z.number().optional()
});

export type Chapter = z.infer<typeof ChapterSchema>;
export type ChapterSummary = z.infer<typeof ChapterSummarySchema>;

// Cache for API responses (in-memory for now)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class CurriculumService {
  /**
   * Fetch data from curriculum API with caching
   */
  private static async fetchWithCache<T>(
    endpoint: string, 
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const cacheKey = endpoint;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const response = await fetch(`${CURRICULUM_API_BASE}${endpoint}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Curriculum API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const validated = schema.parse(data);
      
      // Update cache
      cache.set(cacheKey, { data: validated, timestamp: Date.now() });
      
      return validated;
    } catch (error) {
      console.error('Curriculum API fetch error:', error);
      throw error;
    }
  }

  /**
   * Get health status of curriculum API
   */
  static async getHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${CURRICULUM_API_BASE}/health`);
    if (!response.ok) {
      throw new Error('Curriculum API is not available');
    }
    return response.json();
  }

  /**
   * Get all available subjects
   */
  static async getSubjects(): Promise<string[]> {
    return this.fetchWithCache('/subjects', z.array(z.string()));
  }

  /**
   * Get chapters by subject
   */
  static async getChaptersBySubject(subject: string): Promise<ChapterSummary[]> {
    return this.fetchWithCache(
      `/chapters/by-subject?subject=${encodeURIComponent(subject)}`,
      z.array(ChapterSummarySchema)
    );
  }

  /**
   * Get chapter details by ID
   */
  static async getChapterById(chapterId: string): Promise<Chapter> {
    return this.fetchWithCache(
      `/chapter/${encodeURIComponent(chapterId)}`,
      ChapterSchema
    );
  }

  /**
   * Search chapters by text
   */
  static async searchChapters(
    text: string, 
    subject?: string
  ): Promise<Chapter[]> {
    const params = new URLSearchParams({ text });
    if (subject) params.append('subject', subject);
    
    return this.fetchWithCache(
      `/search?${params}`,
      z.array(ChapterSchema)
    );
  }

  /**
   * Get chapters relevant to nursing topics
   * Maps our nursing topics to curriculum chapters
   */
  static async getChaptersForTopics(topicNames: string[]): Promise<Map<string, Chapter[]>> {
    const topicToChapters = new Map<string, Chapter[]>();
    
    // Search for each topic in the curriculum
    for (const topic of topicNames) {
      try {
        const chapters = await this.searchChapters(topic);
        if (chapters.length > 0) {
          topicToChapters.set(topic, chapters);
        }
      } catch (error) {
        console.error(`Failed to find chapters for topic "${topic}":`, error);
      }
    }
    
    return topicToChapters;
  }

  /**
   * Generate learning guide for a chapter
   */
  static async generateLearningGuide(chapterId: string): Promise<{
    chapter: Chapter;
    guide: string;
    studyPlan: string[];
  }> {
    const response = await fetch(`${CURRICULUM_API_BASE}/learning-guide/${encodeURIComponent(chapterId)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate learning guide: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Clear the cache
   */
  static clearCache(): void {
    cache.clear();
  }
}