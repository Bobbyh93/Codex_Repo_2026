/**
 * Curriculum Progress Service
 * Manages user progress through curriculum chapters
 */

import { db } from "./db";
import { curriculumProgress, users, CurriculumProgress, InsertCurriculumProgress } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class CurriculumProgressService {
  /**
   * Get user's progress for a specific chapter
   */
  async getChapterProgress(userId: string, chapterId: string): Promise<CurriculumProgress | null> {
    const [progress] = await db
      .select()
      .from(curriculumProgress)
      .where(
        and(
          eq(curriculumProgress.userId, userId),
          eq(curriculumProgress.chapterId, chapterId)
        )
      )
      .limit(1);
    
    return progress || null;
  }

  /**
   * Get all curriculum progress for a user
   */
  async getUserProgress(userId: string): Promise<CurriculumProgress[]> {
    return await db
      .select()
      .from(curriculumProgress)
      .where(eq(curriculumProgress.userId, userId))
      .orderBy(desc(curriculumProgress.lastAccessedAt));
  }

  /**
   * Get progress for chapters related to specific topics
   */
  async getProgressByTopics(userId: string, topicIds: string[]): Promise<CurriculumProgress[]> {
    if (topicIds.length === 0) return [];
    
    return await db
      .select()
      .from(curriculumProgress)
      .where(
        and(
          eq(curriculumProgress.userId, userId),
          sql`${curriculumProgress.topicId} = ANY(${topicIds})`
        )
      );
  }

  /**
   * Start or update progress for a chapter
   */
  async startChapter(
    userId: string, 
    chapterId: string,
    data: {
      chapterName?: string;
      subject?: string;
      topicId?: string;
    }
  ): Promise<CurriculumProgress> {
    const existing = await this.getChapterProgress(userId, chapterId);
    
    const now = new Date();
    
    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(curriculumProgress)
        .set({
          status: existing.status === 'not_started' ? 'in_progress' : existing.status,
          startedAt: existing.startedAt || now,
          lastAccessedAt: now,
          chapterName: data.chapterName || existing.chapterName,
          subject: data.subject || existing.subject,
          topicId: data.topicId || existing.topicId,
          updatedAt: now
        })
        .where(eq(curriculumProgress.id, existing.id))
        .returning();
      
      return updated;
    } else {
      // Create new progress entry
      const [created] = await db
        .insert(curriculumProgress)
        .values({
          userId,
          chapterId,
          chapterName: data.chapterName,
          subject: data.subject,
          topicId: data.topicId,
          status: 'in_progress',
          startedAt: now,
          lastAccessedAt: now,
          progressPercentage: 0
        })
        .returning();
      
      return created;
    }
  }

  /**
   * Update progress percentage for a chapter
   */
  async updateProgress(
    userId: string,
    chapterId: string,
    progressPercentage: number,
    timeSpentMinutes?: number
  ): Promise<CurriculumProgress | null> {
    const existing = await this.getChapterProgress(userId, chapterId);
    if (!existing) return null;
    
    const now = new Date();
    const newTimeSpent = (existing.timeSpent || 0) + (timeSpentMinutes || 0);
    const isCompleted = progressPercentage >= 100;
    
    const [updated] = await db
      .update(curriculumProgress)
      .set({
        progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
        timeSpent: newTimeSpent,
        status: isCompleted ? 'completed' : 'in_progress',
        completedAt: isCompleted && !existing.completedAt ? now : existing.completedAt,
        lastAccessedAt: now,
        updatedAt: now
      })
      .where(eq(curriculumProgress.id, existing.id))
      .returning();
    
    return updated;
  }

  /**
   * Mark a chapter as completed
   */
  async completeChapter(
    userId: string,
    chapterId: string,
    timeSpentMinutes?: number
  ): Promise<CurriculumProgress | null> {
    return await this.updateProgress(userId, chapterId, 100, timeSpentMinutes);
  }

  /**
   * Add notes to a chapter
   */
  async updateNotes(
    userId: string,
    chapterId: string,
    notes: string
  ): Promise<CurriculumProgress | null> {
    const existing = await this.getChapterProgress(userId, chapterId);
    if (!existing) return null;
    
    const [updated] = await db
      .update(curriculumProgress)
      .set({
        notes,
        updatedAt: new Date()
      })
      .where(eq(curriculumProgress.id, existing.id))
      .returning();
    
    return updated;
  }

  /**
   * Get statistics for user's curriculum progress
   */
  async getUserStatistics(userId: string): Promise<{
    totalChaptersStarted: number;
    totalChaptersCompleted: number;
    totalTimeSpent: number;
    averageProgress: number;
    recentChapters: CurriculumProgress[];
  }> {
    const allProgress = await this.getUserProgress(userId);
    
    const stats = allProgress.reduce((acc, progress) => {
      acc.totalChaptersStarted++;
      if (progress.status === 'completed') {
        acc.totalChaptersCompleted++;
      }
      acc.totalTimeSpent += progress.timeSpent || 0;
      acc.totalProgress += progress.progressPercentage || 0;
      return acc;
    }, {
      totalChaptersStarted: 0,
      totalChaptersCompleted: 0,
      totalTimeSpent: 0,
      totalProgress: 0
    });
    
    return {
      totalChaptersStarted: stats.totalChaptersStarted,
      totalChaptersCompleted: stats.totalChaptersCompleted,
      totalTimeSpent: stats.totalTimeSpent,
      averageProgress: stats.totalChaptersStarted > 0 
        ? Math.round(stats.totalProgress / stats.totalChaptersStarted)
        : 0,
      recentChapters: allProgress.slice(0, 5)
    };
  }

  /**
   * Delete progress for a specific chapter
   */
  async deleteProgress(userId: string, chapterId: string): Promise<boolean> {
    const result = await db
      .delete(curriculumProgress)
      .where(
        and(
          eq(curriculumProgress.userId, userId),
          eq(curriculumProgress.chapterId, chapterId)
        )
      );
    
    return true;
  }
}