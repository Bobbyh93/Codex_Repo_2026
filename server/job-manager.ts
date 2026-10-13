import { db } from "./db";
import { documentJobs, type DocumentJob, type InsertDocumentJob } from "@shared/schema";
import { eq, and, or, desc, asc, inArray, sql } from "drizzle-orm";

export interface JobProgress {
  jobId: string;
  stage: string;
  progress: number;
  message?: string;
  details?: Record<string, any>;
}

export interface JobFilter {
  status?: string;
  adminId?: string;
  documentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface JobStatistics {
  total: number;
  processing: number;
  completed: number;
  failed: number;
  pending: number;
  averageProcessingTime: number;
  successRate: number;
}

export class JobManager {
  /**
   * Create a new job
   */
  static async createJob(data: Omit<InsertDocumentJob, "id">): Promise<DocumentJob> {
    // Initialize metadata with retryCount and adminId if provided
    // Conform to the expected metadata type structure
    const metadata: any = {
      chunksProcessed: (data.metadata as any)?.chunksProcessed,
      totalChunks: (data.metadata as any)?.totalChunks,
      tokensProcessed: (data.metadata as any)?.tokensProcessed,
      embeddingsGenerated: (data.metadata as any)?.embeddingsGenerated,
      errorDetails: (data.metadata as any)?.errorDetails,
      // Store our custom fields
      retryCount: 0,
      adminId: (data as any).adminId || null,
      updatedAt: new Date().toISOString()
    };
    
    const jobs = await db
      .insert(documentJobs)
      .values({
        documentId: data.documentId,
        stage: data.stage || "initializing",
        status: data.status || "pending",
        progress: data.progress || 0,
        error: data.error || null,
        metadata,
        startedAt: data.startedAt || new Date(),
        completedAt: data.completedAt || null
      })
      .returning();
    
    return jobs[0];
  }

  /**
   * Update job progress
   */
  static async updateJobProgress(
    jobId: string,
    stage: string,
    progress: number,
    message?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const updates: any = {
      stage,
      progress
    };
    
    // Always update metadata with updatedAt and optional message/details
    const metadataUpdate: any = {
      updatedAt: new Date().toISOString()
    };
    
    if (message) {
      metadataUpdate.lastMessage = message;
    }
    
    if (details) {
      metadataUpdate.stageDetails = details;
    }
    
    updates.metadata = sql`
      COALESCE(metadata, '{}'::jsonb) || 
      ${JSON.stringify(metadataUpdate)}::jsonb
    `;
    
    await db
      .update(documentJobs)
      .set(updates)
      .where(eq(documentJobs.id, jobId));
  }

  /**
   * Handle job failure
   */
  static async handleJobFailure(
    jobId: string,
    error: any,
    canRetry: boolean = true
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const job = await this.getJobStatus(jobId);
    if (!job) return;
    
    const currentMetadata = job.metadata || {};
    const retryCount = ((currentMetadata as any).retryCount || 0) + 1;
    const maxRetries = 3;
    
    const status = canRetry && retryCount < maxRetries ? "pending" : "failed";
    
    // Store error details and retry count in metadata
    const updatedMetadata = {
      ...currentMetadata,
      retryCount,
      errorDetails: {
        stack: errorStack,
        timestamp: new Date().toISOString(),
        stage: job.stage,
        progress: job.progress
      },
      updatedAt: new Date().toISOString()
    };
    
    await db
      .update(documentJobs)
      .set({
        status,
        error: errorMessage,
        metadata: updatedMetadata,
        completedAt: status === "failed" ? new Date() : null
      })
      .where(eq(documentJobs.id, jobId));
    
    // Log the error for debugging
    console.error(`Job ${jobId} failed at stage ${job.stage}:`, error);
  }

  /**
   * Mark job as completed
   */
  static async completeJob(jobId: string, processingTime?: number): Promise<void> {
    const completedAt = new Date();
    
    // Get current job to preserve metadata
    const job = await this.getJobStatus(jobId);
    const currentMetadata = job?.metadata || {};
    
    // Update metadata with processing time
    const updatedMetadata = {
      ...currentMetadata,
      processingTime: processingTime || null,
      updatedAt: completedAt.toISOString()
    };
    
    await db
      .update(documentJobs)
      .set({
        status: "completed",
        stage: "completed",
        progress: 100,
        completedAt,
        metadata: updatedMetadata
      })
      .where(eq(documentJobs.id, jobId));
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string): Promise<DocumentJob | undefined> {
    const jobs = await db
      .select()
      .from(documentJobs)
      .where(eq(documentJobs.id, jobId))
      .limit(1);
    
    return jobs[0];
  }

  /**
   * List jobs with filters
   */
  static async listJobs(
    filter: JobFilter = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{ jobs: DocumentJob[]; total: number }> {
    const conditions = [];
    
    if (filter.status) {
      conditions.push(eq(documentJobs.status, filter.status));
    }
    
    if (filter.adminId) {
      // Filter by adminId stored in metadata
      conditions.push(sql`metadata->>'adminId' = ${filter.adminId}`);
    }
    
    if (filter.documentId) {
      conditions.push(eq(documentJobs.documentId, filter.documentId));
    }
    
    if (filter.startDate) {
      conditions.push(sql`${documentJobs.startedAt} >= ${filter.startDate}`);
    }
    
    if (filter.endDate) {
      conditions.push(sql`${documentJobs.startedAt} <= ${filter.endDate}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentJobs)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated results
    let query = db
      .select()
      .from(documentJobs)
      .$dynamic();
    
    if (whereClause) {
      query = query.where(whereClause);
    }
    
    const jobs = await query
      .orderBy(desc(documentJobs.startedAt))
      .limit(limit)
      .offset(offset);
    
    return { jobs, total };
  }

  /**
   * Resume failed jobs
   */
  static async resumeFailedJobs(
    maxJobs: number = 10
  ): Promise<DocumentJob[]> {
    // Get failed jobs that can be retried
    const failedJobs = await db
      .select()
      .from(documentJobs)
      .where(
        and(
          eq(documentJobs.status, "failed"),
          sql`(metadata->>'retryCount')::int < 3 OR metadata->>'retryCount' IS NULL`
        )
      )
      .orderBy(asc(documentJobs.completedAt))
      .limit(maxJobs);
    
    const resumedJobs: DocumentJob[] = [];
    
    for (const job of failedJobs) {
      // Reset job for retry
      // Preserve metadata but update updatedAt
      const currentMetadata = job.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        updatedAt: new Date().toISOString()
      };
      
      await db
        .update(documentJobs)
        .set({
          status: "pending",
          error: null,
          stage: "resuming",
          progress: 0,
          startedAt: new Date(),
          completedAt: null,
          metadata: updatedMetadata
        })
        .where(eq(documentJobs.id, job.id));
      
      // Get the updated job to add to resumed list
      const updatedJob = await this.getJobStatus(job.id);
      if (updatedJob) {
        resumedJobs.push(updatedJob);
      }
      
      console.log(`Resumed job ${job.id} (attempt ${((job.metadata as any)?.retryCount || 0) + 1})`);
    }
    
    return resumedJobs;
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobId: string): Promise<void> {
    // Get current job to preserve metadata
    const job = await this.getJobStatus(jobId);
    const currentMetadata = job?.metadata || {};
    
    await db
      .update(documentJobs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
        metadata: {
          ...currentMetadata,
          updatedAt: new Date().toISOString()
        }
      })
      .where(eq(documentJobs.id, jobId));
  }

  /**
   * Get job statistics
   */
  static async getStatistics(
    filter: JobFilter = {}
  ): Promise<JobStatistics> {
    const conditions = [];
    
    if (filter.adminId) {
      // Filter by adminId stored in metadata
      conditions.push(sql`metadata->>'adminId' = ${filter.adminId}`);
    }
    
    if (filter.startDate) {
      conditions.push(sql`${documentJobs.startedAt} >= ${filter.startDate}`);
    }
    
    if (filter.endDate) {
      conditions.push(sql`${documentJobs.startedAt} <= ${filter.endDate}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get counts by status
    const statusCounts = await db
      .select({
        status: documentJobs.status,
        count: sql<number>`count(*)`
      })
      .from(documentJobs)
      .where(whereClause)
      .groupBy(documentJobs.status);
    
    // Get average processing time for completed jobs (from metadata)
    const processingTimeResult = await db
      .select({
        avgTime: sql<number>`AVG((metadata->>'processingTime')::numeric)`
      })
      .from(documentJobs)
      .where(
        and(
          whereClause,
          eq(documentJobs.status, "completed"),
          sql`metadata->>'processingTime' IS NOT NULL`
        )
      );
    
    const stats: JobStatistics = {
      total: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      averageProcessingTime: 0,
      successRate: 0
    };
    
    // Process status counts
    for (const row of statusCounts) {
      const count = Number(row.count);
      stats.total += count;
      
      switch (row.status) {
        case "processing":
          stats.processing = count;
          break;
        case "completed":
          stats.completed = count;
          break;
        case "failed":
          stats.failed = count;
          break;
        case "pending":
          stats.pending = count;
          break;
      }
    }
    
    // Calculate average processing time
    if (processingTimeResult[0]?.avgTime) {
      stats.averageProcessingTime = Math.round(Number(processingTimeResult[0].avgTime));
    }
    
    // Calculate success rate
    const totalFinished = stats.completed + stats.failed;
    if (totalFinished > 0) {
      stats.successRate = Math.round((stats.completed / totalFinished) * 100);
    }
    
    return stats;
  }

  /**
   * Clean up old jobs
   */
  static async cleanupOldJobs(
    daysToKeep: number = 30
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db
      .delete(documentJobs)
      .where(
        and(
          sql`${documentJobs.completedAt} < ${cutoffDate}`,
          inArray(documentJobs.status, ["completed", "failed", "cancelled"])
        )
      );
    
    console.log(`Cleaned up old jobs older than ${daysToKeep} days`);
    return 0; // Return count would require a different query structure
  }

  /**
   * Get currently processing jobs
   */
  static async getProcessingJobs(): Promise<DocumentJob[]> {
    return db
      .select()
      .from(documentJobs)
      .where(eq(documentJobs.status, "processing"))
      .orderBy(asc(documentJobs.startedAt));
  }

  /**
   * Monitor job health
   */
  static async checkJobHealth(jobId: string): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const job = await this.getJobStatus(jobId);
    
    if (!job) {
      return { healthy: false, issues: ["Job not found"] };
    }
    
    const issues: string[] = [];
    
    // Check if job is stuck
    if (job.status === "processing") {
      const processingTime = job.startedAt ? Date.now() - new Date(job.startedAt).getTime() : 0;
      const maxProcessingTime = 30 * 60 * 1000; // 30 minutes
      
      if (processingTime > maxProcessingTime) {
        issues.push(`Job has been processing for ${Math.round(processingTime / 60000)} minutes`);
      }
      
      // Check if progress hasn't updated recently (from metadata)
      const updatedAt = (job.metadata as any)?.updatedAt;
      if (updatedAt) {
        const timeSinceUpdate = Date.now() - new Date(updatedAt).getTime();
        if (timeSinceUpdate > 5 * 60 * 1000) { // 5 minutes
          issues.push(`No progress update for ${Math.round(timeSinceUpdate / 60000)} minutes`);
        }
      }
    }
    
    // Check retry count (from metadata)
    const retryCount = (job.metadata as any)?.retryCount || 0;
    if (retryCount >= 2) {
      issues.push(`Job has failed ${retryCount} times`);
    }
    
    // Check for errors
    if (job.error) {
      issues.push(`Job has error: ${job.error}`);
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Batch update job statuses
   */
  static async batchUpdateStatus(
    jobIds: string[],
    status: string,
    stage?: string
  ): Promise<void> {
    // Store updatedAt in metadata
    const updates: any = {
      status,
      metadata: sql`
        COALESCE(metadata, '{}'::jsonb) || 
        jsonb_build_object('updatedAt', ${new Date().toISOString()})
      `
    };
    
    if (stage) {
      updates.stage = stage;
    }
    
    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.completedAt = new Date();
    }
    
    await db
      .update(documentJobs)
      .set(updates)
      .where(inArray(documentJobs.id, jobIds));
  }
}

export default JobManager;