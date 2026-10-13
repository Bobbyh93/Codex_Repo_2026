import {
  users,
  contentAreas,
  nursingTopics,
  nursingSubtopics,
  textbookMappings,
  learningResources,
  assessmentReports,
  topicPerformance,
  contentAreaPerformance,
  studyPlans,
  studyPlanItems,
  syllabi,
  topicsNeedingResources,
  resourceMappings,
  topicDemand,
  resourceAllocation,
  callBookings,
  leads,
  adminAvailability,
  leadActivities,
  leadTags,
  emailCampaigns,
  emailTemplates,
  documents,
  documentChunks,
  documentJobs,
  ragCitations,
  type User,
  type InsertUser,
  type ContentArea,
  type NursingTopic,
  type NursingSubtopic,
  type TextbookMapping,
  type LearningResource,
  type AssessmentReport,
  type InsertAssessmentReport,
  type TopicPerformance,
  type InsertTopicPerformance,
  type ContentAreaPerformance,
  type StudyPlan,
  type StudyPlanItem,
  type Syllabus,
  type TopicsNeedingResources,
  type InsertTopicsNeedingResources,
  type ResourceMapping,
  type InsertResourceMapping,
  type TopicDemand,
  type InsertTopicDemand,
  type ResourceAllocation,
  type InsertResourceAllocation,
  type CallBooking,
  type InsertCallBooking,
  type Lead,
  type InsertLead,
  type AdminAvailability,
  type InsertAdminAvailability,
  type Document,
  type InsertDocument,
  type DocumentChunk,
  type InsertDocumentChunk,
  type DocumentJob,
  type InsertDocumentJob,
  type RagCitation,
  type InsertRagCitation,
  type ChunkSearchResult,
  userProgress,
  type UserProgress,
  type InsertUserProgress,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql, inArray, gte, lte, or } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { id?: string; isEmailVerified?: boolean }): Promise<User>;

  // Assessment report operations
  createAssessmentReport(report: InsertAssessmentReport & { userId: string }): Promise<AssessmentReport>;
  getAssessmentReportsByUser(userId: string): Promise<AssessmentReport[]>;
  getAssessmentReport(id: string): Promise<AssessmentReport | undefined>;
  updateAssessmentReport(id: string, updates: Partial<AssessmentReport>): Promise<void>;

  // Topic operations
  getAllContentAreas(): Promise<ContentArea[]>;
  getAllNursingTopics(): Promise<(NursingTopic & { contentArea: ContentArea })[]>;
  searchTopicsByKeywords(keywords: string[]): Promise<NursingTopic[]>;
  createNursingTopic(topic: Omit<NursingTopic, 'id'>): Promise<NursingTopic>;
  
  // Performance operations
  createTopicPerformance(performance: InsertTopicPerformance): Promise<TopicPerformance>;
  getTopicPerformanceByReport(reportId: string): Promise<(TopicPerformance & { topic: NursingTopic & { contentArea: ContentArea } })[]>;
  createContentAreaPerformance(performance: Omit<ContentAreaPerformance, 'id'>): Promise<ContentAreaPerformance>;
  getContentAreaPerformanceByReport(reportId: string): Promise<(ContentAreaPerformance & { contentArea: ContentArea })[]>;

  // Learning resources
  getLearningResourcesByTopic(topicId: string): Promise<LearningResource[]>;

  // Subtopic operations
  createSubtopic(subtopic: Omit<NursingSubtopic, 'id'>): Promise<NursingSubtopic>;
  getSubtopicsByTopic(topicId: string): Promise<NursingSubtopic[]>;
  searchSubtopicsByKeywords(keywords: string[]): Promise<NursingSubtopic[]>;
  
  // Textbook mapping operations
  createTextbookMapping(mapping: Omit<TextbookMapping, 'id'>): Promise<TextbookMapping>;
  getTextbookMappingsBySubtopic(subtopicId: string): Promise<TextbookMapping[]>;

  // Study plans
  createStudyPlan(plan: Omit<StudyPlan, 'id' | 'generatedAt'>): Promise<StudyPlan>;
  getStudyPlansByUser(userId: string): Promise<StudyPlan[]>;
  
  // Syllabus operations
  createSyllabus(syllabus: Omit<Syllabus, 'id' | 'uploadDate'>): Promise<Syllabus>;
  getSyllabusByUser(userId: string): Promise<Syllabus[]>;
  getSyllabus(id: string): Promise<Syllabus | undefined>;
  
  // Content area operations
  getContentAreaByName(name: string): Promise<ContentArea | undefined>;
  createContentArea(area: Omit<ContentArea, 'id'>): Promise<ContentArea>;
  
  // Dashboard operations
  getUserDashboardStats(userId: string): Promise<{
    totalStudyTime: number;
    averageScore: number;
    topicsStudied: number;
    topicsMastered: number;
    questionsAnswered: number;
    correctAnswers: number;
    currentStreak: number;
    assessmentsCompleted: number;
  }>;
  getUserPerformanceTrends(userId: string, days?: number): Promise<Array<{
    date: string;
    score: number;
    studyTime: number;
  }>>;
  getUpcomingStudySessions(userId: string): Promise<Array<{
    id: string;
    title: string;
    startTime: Date;
    duration: number;
    topic: string;
  }>>;
  
  // Resource availability operations
  getResourceAvailabilityForTopics(topicIds: string[]): Promise<Map<string, boolean>>;
  queueTopicsNeedingResources(items: Omit<InsertTopicsNeedingResources, 'id'>[]): Promise<void>;
  getTopicsNeedingResources(): Promise<TopicsNeedingResources[]>;
  markTopicResourcesResolved(id: string): Promise<void>;
  incrementTopicResourceRequest(topicId: string, topicName: string, reportId?: string): Promise<void>;
  
  // Resource mapping operations
  createResourceMapping(mapping: InsertResourceMapping): Promise<ResourceMapping>;
  updateResourceMapping(id: string, updates: Partial<ResourceMapping>): Promise<ResourceMapping>;
  deleteResourceMapping(id: string): Promise<void>;
  getResourceMappings(filters?: {
    topicId?: string;
    resourceId?: string;
    isActive?: boolean;
    isAiSuggested?: boolean;
  }): Promise<(ResourceMapping & { topic?: NursingTopic; resource?: LearningResource })[]>;
  getResourceMappingsByTopic(topicId: string): Promise<(ResourceMapping & { resource: LearningResource })[]>;
  bulkCreateResourceMappings(mappings: InsertResourceMapping[]): Promise<ResourceMapping[]>;
  getResourceMappingStats(): Promise<{
    totalMappings: number;
    aiSuggestedMappings: number;
    manualMappings: number;
    activeMappings: number;
    topicsWithMappings: number;
    resourcesUsed: number;
  }>;
  
  // Learning resource CRUD operations
  createLearningResource(resource: Omit<LearningResource, 'id'>): Promise<LearningResource>;
  updateLearningResource(id: string, updates: Partial<LearningResource>): Promise<LearningResource>;
  deleteLearningResource(id: string): Promise<void>;
  getAllLearningResources(): Promise<LearningResource[]>;
  searchLearningResources(query: string): Promise<LearningResource[]>;
  
  // Demand analytics operations
  trackTopicDemand(demand: InsertTopicDemand): Promise<TopicDemand>;
  getTopicDemandByDateRange(startDate: Date, endDate: Date): Promise<TopicDemand[]>;
  getTopicDemandStats(topicId?: string): Promise<{
    totalDemand: number;
    uniqueUsers: number;
    avgPriority: number;
    sources: { source: string; count: number }[];
  }>;
  
  // Resource allocation operations
  createResourceAllocation(allocation: InsertResourceAllocation): Promise<ResourceAllocation>;
  getResourceAllocations(status?: string): Promise<ResourceAllocation[]>;
  updateResourceAllocationStatus(id: string, status: string, approvedBy?: string): Promise<void>;
  getResourceAllocationsByTopic(topicId: string): Promise<ResourceAllocation[]>;
  
  // Call booking operations
  createCallBooking(booking: InsertCallBooking): Promise<CallBooking>;
  updateCallBooking(id: string, updates: Partial<CallBooking>): Promise<CallBooking>;
  getCallBookings(filters?: {
    status?: string;
    userId?: string;
    topicId?: string;
    assignedTo?: string;
  }): Promise<CallBooking[]>;
  getCallBookingById(id: string): Promise<CallBooking | undefined>;
  getCallBookingQueue(): Promise<CallBooking[]>;
  getAvailableTimeSlots(date: Date, adminId?: string): Promise<string[]>;
  
  // Lead management operations
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;
  getLeads(filters?: {
    status?: string;
    assignedTo?: string;
    source?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<Lead[]>;
  getLeadById(id: string): Promise<Lead | undefined>;
  getLeadByBookingId(bookingId: string): Promise<Lead | undefined>;
  getLeadMetrics(): Promise<{
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    averageConversionValue: number;
    leadsByStatus: { status: string; count: number }[];
  }>;

  // Admin availability operations
  createAdminAvailability(availability: InsertAdminAvailability): Promise<AdminAvailability>;
  updateAdminAvailability(id: string, updates: Partial<AdminAvailability>): Promise<AdminAvailability>;
  getAdminAvailability(adminId: string): Promise<AdminAvailability[]>;
  deleteAdminAvailability(id: string): Promise<void>;

  // ==================== RAG System Operations ====================
  
  // Document operations
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocumentStatus(id: string, status: string): Promise<void>;
  getDocumentById(id: string): Promise<Document | undefined>;
  getDocumentsByStatus(status: string): Promise<Document[]>;
  deleteDocument(id: string): Promise<void>; // cascade delete chunks
  getDocumentByContentHash(hash: string): Promise<Document | undefined>; // For deduplication
  
  // Chunk operations
  createChunks(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]>; // bulk insert
  searchChunks(query: string, filters?: {
    documentId?: string;
    topicIds?: string[];
    tags?: string[];
  }, limit?: number): Promise<ChunkSearchResult[]>;
  getChunksByDocument(documentId: string): Promise<DocumentChunk[]>;
  updateChunkEmbedding(id: string, embedding: number[]): Promise<void>;
  deleteChunksByDocument(documentId: string): Promise<void>;
  getChunkById(id: string): Promise<DocumentChunk | undefined>;
  
  // Job tracking
  createJob(job: InsertDocumentJob): Promise<DocumentJob>;
  updateJobStatus(id: string, status: string, progress?: number, error?: string): Promise<void>;
  getJobsByDocument(documentId: string): Promise<DocumentJob[]>;
  getActiveJobs(): Promise<DocumentJob[]>;
  getJobById(id: string): Promise<DocumentJob | undefined>;
  
  // Search operations
  vectorSearch(embedding: number[], filters?: {
    documentIds?: string[];
    topicIds?: string[];
    tags?: string[];
    threshold?: number;
  }, limit?: number): Promise<ChunkSearchResult[]>;
  hybridSearch(query: string, embedding: number[], filters?: {
    documentIds?: string[];
    topicIds?: string[];
    tags?: string[];
    weights?: { vector: number; keyword: number };
  }, limit?: number): Promise<ChunkSearchResult[]>;
  fullTextSearch(query: string, filters?: {
    documentIds?: string[];
    topicIds?: string[];
    tags?: string[];
  }, limit?: number): Promise<ChunkSearchResult[]>;
  
  // Citation tracking
  recordCitation(citation: InsertRagCitation): Promise<RagCitation>;
  getCitationsByQuery(queryId: string): Promise<(RagCitation & { chunk: DocumentChunk })[]>;
  updateCitationUsage(id: string, usedInAnswer: boolean): Promise<void>;
  getCitationStats(): Promise<{
    totalCitations: number;
    usedCitations: number;
    avgRelevanceScore: number;
    topCitedChunks: { chunkId: string; count: number }[];
  }>;
  
  // User progress operations
  getUserProgressByTopic(userId: string): Promise<(UserProgress & { topic: NursingTopic })[]>;
  createUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
  updateUserProgress(userId: string, topicId: string, updates: Partial<UserProgress>): Promise<UserProgress | null>;
  markTopicComplete(userId: string, topicId: string, studyTimeMinutes?: number): Promise<UserProgress>;
  
  // Guest user operations
  transferGuestProgressToUser(guestId: string, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private customizations = new Map<string, any>();
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser & { id?: string; isEmailVerified?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAssessmentReport(report: InsertAssessmentReport & { userId: string }): Promise<AssessmentReport> {
    const [newReport] = await db
      .insert(assessmentReports)
      .values(report)
      .returning();
    return newReport;
  }

  async getAssessmentReportsByUser(userId: string): Promise<AssessmentReport[]> {
    return await db
      .select()
      .from(assessmentReports)
      .where(eq(assessmentReports.userId, userId))
      .orderBy(desc(assessmentReports.uploadDate));
  }

  async getAssessmentReport(id: string): Promise<AssessmentReport | undefined> {
    const [report] = await db.select().from(assessmentReports).where(eq(assessmentReports.id, id));
    return report || undefined;
  }

  async updateAssessmentReport(id: string, updates: Partial<AssessmentReport>): Promise<void> {
    await db
      .update(assessmentReports)
      .set(updates)
      .where(eq(assessmentReports.id, id));
  }

  async getRecentAssessmentReports(limit: number): Promise<any[]> {
    const results = await db
      .select()
      .from(assessmentReports)
      .orderBy(desc(assessmentReports.uploadDate))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      studentName: (r as any).studentName || 'Unknown',
      studentEmail: (r as any).studentEmail || 'N/A',
      customizations: this.customizations.get(r.id) || null
    }));
  }

  async updateAssessmentCustomizations(reportId: string, customizations: any): Promise<void> {
    this.customizations.set(reportId, customizations);
  }

  async getAssessmentCustomizations(reportId: string): Promise<any> {
    return this.customizations.get(reportId) || null;
  }

  async getAllContentAreas(): Promise<ContentArea[]> {
    return await db.select().from(contentAreas).orderBy(asc(contentAreas.name));
  }

  async getContentAreaByName(name: string): Promise<ContentArea | undefined> {
    const [area] = await db.select().from(contentAreas).where(eq(contentAreas.name, name));
    return area || undefined;
  }

  async createContentArea(contentArea: Omit<ContentArea, 'id'>): Promise<ContentArea> {
    const [newArea] = await db
      .insert(contentAreas)
      .values(contentArea)
      .returning();
    return newArea;
  }

  async getAllNursingTopics(): Promise<(NursingTopic & { contentArea: ContentArea })[]> {
    return await db
      .select()
      .from(nursingTopics)
      .leftJoin(contentAreas, eq(nursingTopics.contentAreaId, contentAreas.id))
      .then(results => 
        results.map(result => ({
          ...result.nursing_topics,
          contentArea: result.content_areas!
        }))
      );
  }

  async searchTopicsByKeywords(keywords: string[]): Promise<NursingTopic[]> {
    if (keywords.length === 0) return [];
    
    const keywordConditions = keywords.map(keyword => 
      sql`${nursingTopics.name} ILIKE ${`%${keyword}%`} OR 
          ${nursingTopics.description} ILIKE ${`%${keyword}%`} OR
          ${nursingTopics.keywords}::text ILIKE ${`%${keyword}%`}`
    );

    // Combine all conditions with OR using sql.join
    const combinedCondition = sql.join(keywordConditions, sql` OR `);

    return await db
      .select()
      .from(nursingTopics)
      .where(combinedCondition);
  }
  
  async createNursingTopic(topic: Omit<NursingTopic, 'id'>): Promise<NursingTopic> {
    const [newTopic] = await db
      .insert(nursingTopics)
      .values(topic)
      .returning();
    return newTopic;
  }

  async createTopicPerformance(performance: InsertTopicPerformance): Promise<TopicPerformance> {
    const [newPerformance] = await db
      .insert(topicPerformance)
      .values(performance)
      .returning();
    return newPerformance;
  }

  async getTopicPerformanceByReport(reportId: string): Promise<(TopicPerformance & { topic: NursingTopic & { contentArea: ContentArea } })[]> {
    return await db
      .select()
      .from(topicPerformance)
      .leftJoin(nursingTopics, eq(topicPerformance.topicId, nursingTopics.id))
      .leftJoin(contentAreas, eq(nursingTopics.contentAreaId, contentAreas.id))
      .where(eq(topicPerformance.reportId, reportId))
      .orderBy(asc(topicPerformance.priority))
      .then(results => 
        results.map(result => ({
          ...result.topic_performance,
          topic: {
            ...result.nursing_topics!,
            contentArea: result.content_areas!
          }
        }))
      );
  }

  async createContentAreaPerformance(performance: Omit<ContentAreaPerformance, 'id'>): Promise<ContentAreaPerformance> {
    const [newPerformance] = await db
      .insert(contentAreaPerformance)
      .values(performance)
      .returning();
    return newPerformance;
  }

  async getContentAreaPerformanceByReport(reportId: string): Promise<(ContentAreaPerformance & { contentArea: ContentArea })[]> {
    return await db
      .select()
      .from(contentAreaPerformance)
      .leftJoin(contentAreas, eq(contentAreaPerformance.contentAreaId, contentAreas.id))
      .where(eq(contentAreaPerformance.reportId, reportId))
      .then(results => 
        results.map(result => ({
          ...result.content_area_performance,
          contentArea: result.content_areas!
        }))
      );
  }

  async getLearningResourcesByTopic(topicId: string): Promise<LearningResource[]> {
    return await db
      .select()
      .from(learningResources)
      .where(eq(learningResources.topicId, topicId));
  }
  
  async createSubtopic(subtopic: Omit<NursingSubtopic, 'id'>): Promise<NursingSubtopic> {
    const [newSubtopic] = await db
      .insert(nursingSubtopics)
      .values(subtopic)
      .returning();
    return newSubtopic;
  }
  
  async getSubtopicsByTopic(topicId: string): Promise<NursingSubtopic[]> {
    return await db
      .select()
      .from(nursingSubtopics)
      .where(eq(nursingSubtopics.topicId, topicId))
      .orderBy(asc(nursingSubtopics.name));
  }
  
  async searchSubtopicsByKeywords(keywords: string[]): Promise<NursingSubtopic[]> {
    if (keywords.length === 0) return [];
    
    const keywordConditions = keywords.map(keyword => 
      sql`${nursingSubtopics.name} ILIKE ${`%${keyword}%`} OR 
          ${nursingSubtopics.description} ILIKE ${`%${keyword}%`}`
    );
    
    const combinedCondition = sql.join(keywordConditions, sql` OR `);
    
    return await db
      .select()
      .from(nursingSubtopics)
      .where(combinedCondition);
  }
  
  async createTextbookMapping(mapping: Omit<TextbookMapping, 'id'>): Promise<TextbookMapping> {
    const [newMapping] = await db
      .insert(textbookMappings)
      .values(mapping)
      .returning();
    return newMapping;
  }
  
  async getTextbookMappingsBySubtopic(subtopicId: string): Promise<TextbookMapping[]> {
    return await db
      .select()
      .from(textbookMappings)
      .where(eq(textbookMappings.subtopicId, subtopicId))
      .orderBy(asc(textbookMappings.chapterNumber));
  }

  async createStudyPlan(plan: Omit<StudyPlan, 'id' | 'generatedAt'>): Promise<StudyPlan> {
    const [newPlan] = await db
      .insert(studyPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async getStudyPlansByUser(userId: string): Promise<StudyPlan[]> {
    return await db
      .select()
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId))
      .orderBy(desc(studyPlans.generatedAt));
  }
  
  async createSyllabus(syllabus: Omit<Syllabus, 'id' | 'uploadDate'>): Promise<Syllabus> {
    const [newSyllabus] = await db.insert(syllabi).values(syllabus).returning();
    return newSyllabus;
  }
  
  async getSyllabusByUser(userId: string): Promise<Syllabus[]> {
    const userSyllabi = await db
      .select()
      .from(syllabi)
      .where(eq(syllabi.userId, userId))
      .orderBy(desc(syllabi.uploadDate));
    return userSyllabi;
  }
  
  async getSyllabus(id: string): Promise<Syllabus | undefined> {
    const [syllabus] = await db.select().from(syllabi).where(eq(syllabi.id, id));
    return syllabus || undefined;
  }
  
  async getUserDashboardStats(userId: string): Promise<{
    totalStudyTime: number;
    averageScore: number;
    topicsStudied: number;
    topicsMastered: number;
    questionsAnswered: number;
    correctAnswers: number;
    currentStreak: number;
    assessmentsCompleted: number;
  }> {
    // Get all assessment reports for the user
    const reports = await this.getAssessmentReportsByUser(userId);
    
    // Calculate statistics
    const assessmentsCompleted = reports.length;
    let totalScore = 0;
    let totalTopics = new Set<string>();
    let masteredTopics = new Set<string>();
    let totalQuestions = 0;
    let correctAnswers = 0;
    
    for (const report of reports) {
      // Get performance data for each report
      const topicPerf = await this.getTopicPerformanceByReport(report.id);
      
      topicPerf.forEach(tp => {
        // Convert score from string to number, defaulting to 0 if null
        const score = tp.score ? parseFloat(tp.score) : 0;
        const topicId = tp.topicId || '';
        
        if (topicId) {
          totalTopics.add(topicId);
          if (score >= 85) {
            masteredTopics.add(topicId);
          }
        }
        
        // Note: itemsAnswered doesn't exist in TopicPerformance schema
        // For now, we'll estimate based on frequency field
        const estimatedQuestions = tp.frequency || 1;
        totalQuestions += estimatedQuestions;
        correctAnswers += Math.round(estimatedQuestions * score / 100);
      });
      
      // Add report score to total (convert to number if it's a string)
      const reportScore = typeof report.overallScore === 'string' 
        ? parseFloat(report.overallScore) 
        : (report.overallScore || 0);
      totalScore += reportScore;
    }
    
    // Calculate current streak (simplified: days since last assessment)
    let currentStreak = 0;
    if (reports.length > 0) {
      const lastAssessment = reports[0]; // Reports are ordered by date desc
      const uploadDate = lastAssessment.uploadDate ? new Date(lastAssessment.uploadDate) : new Date();
      const daysSinceLastAssessment = Math.floor(
        (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      currentStreak = Math.min(daysSinceLastAssessment, 7); // Cap at 7 days
    }
    
    return {
      totalStudyTime: reports.length * 120, // Assume 2 hours per assessment
      averageScore: assessmentsCompleted > 0 ? totalScore / assessmentsCompleted : 0,
      topicsStudied: totalTopics.size,
      topicsMastered: masteredTopics.size,
      questionsAnswered: totalQuestions,
      correctAnswers: correctAnswers,
      currentStreak: currentStreak,
      assessmentsCompleted: assessmentsCompleted,
    };
  }
  
  async getUserPerformanceTrends(userId: string, days: number = 7): Promise<Array<{
    date: string;
    score: number;
    studyTime: number;
  }>> {
    const reports = await this.getAssessmentReportsByUser(userId);
    
    // Create a map of dates to scores
    const trendMap = new Map<string, { score: number; studyTime: number; count: number }>();
    
    // Get the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Initialize map with zeros for all days
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toLocaleDateString('en-US', { weekday: 'short' });
      trendMap.set(dateKey, { score: 0, studyTime: 0, count: 0 });
    }
    
    // Populate with actual data
    reports.forEach(report => {
      if (!report.uploadDate) return; // Skip if no upload date
      
      const reportDate = new Date(report.uploadDate);
      if (reportDate >= startDate && reportDate <= endDate) {
        const dateKey = reportDate.toLocaleDateString('en-US', { weekday: 'short' });
        const existing = trendMap.get(dateKey) || { score: 0, studyTime: 0, count: 0 };
        
        // Handle overallScore which might be string or number
        const score = typeof report.overallScore === 'string' 
          ? parseFloat(report.overallScore) 
          : (report.overallScore || 0);
        
        trendMap.set(dateKey, {
          score: existing.score + score,
          studyTime: existing.studyTime + 120, // Assume 2 hours per assessment
          count: existing.count + 1,
        });
      }
    });
    
    // Convert to array and calculate averages
    const trends: Array<{ date: string; score: number; studyTime: number }> = [];
    trendMap.forEach((value, key) => {
      trends.push({
        date: key,
        score: value.count > 0 ? Math.round(value.score / value.count) : 0,
        studyTime: value.studyTime,
      });
    });
    
    return trends;
  }
  
  async getUpcomingStudySessions(userId: string): Promise<Array<{
    id: string;
    title: string;
    startTime: Date;
    duration: number;
    topic: string;
  }>> {
    // For now, return sample upcoming sessions
    // In a real implementation, this would fetch from a study_sessions table
    const now = new Date();
    const sessions = [
      {
        id: '1',
        title: 'Cardiovascular Review',
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        duration: 60,
        topic: 'Cardiovascular',
      },
      {
        id: '2',
        title: 'Pharmacology Practice',
        startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        duration: 90,
        topic: 'Pharmacology',
      },
      {
        id: '3',
        title: 'Pediatrics Deep Dive',
        startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // Day after tomorrow
        duration: 120,
        topic: 'Pediatrics',
      },
    ];
    
    return sessions;
  }

  // Resource availability operations
  async getResourceAvailabilityForTopics(topicIds: string[]): Promise<Map<string, boolean>> {
    const availabilityMap = new Map<string, boolean>();
    
    if (topicIds.length === 0) {
      return availabilityMap;
    }
    
    // Check which topics have resources
    const resources = await db
      .select({ topicId: learningResources.topicId })
      .from(learningResources)
      .where(sql`${learningResources.topicId} IN ${topicIds}`);
    
    const topicsWithResources = new Set(resources.map(r => r.topicId).filter(Boolean));
    
    // Build availability map
    topicIds.forEach(topicId => {
      availabilityMap.set(topicId, topicsWithResources.has(topicId));
    });
    
    return availabilityMap;
  }

  async queueTopicsNeedingResources(items: Omit<InsertTopicsNeedingResources, 'id'>[]): Promise<void> {
    if (items.length === 0) return;
    
    for (const item of items) {
      // Check if already exists
      const existing = await db
        .select()
        .from(topicsNeedingResources)
        .where(eq(topicsNeedingResources.topicId, item.topicId))
        .limit(1);
      
      if (existing.length > 0) {
        const existingItem = existing[0];
        if (existingItem) {
          // Update existing - increment request count and update last requested time
          await db
            .update(topicsNeedingResources)
            .set({
              requestCount: sql`${topicsNeedingResources.requestCount} + 1`,
              lastRequested: new Date(),
              priority: (existingItem.priority || 0) + 1, // Increase priority with each request
            })
            .where(eq(topicsNeedingResources.topicId, item.topicId));
        }
      } else {
        // Insert new entry
        await db.insert(topicsNeedingResources).values(item);
      }
    }
  }

  async getTopicsNeedingResources(): Promise<TopicsNeedingResources[]> {
    return await db
      .select()
      .from(topicsNeedingResources)
      .where(eq(topicsNeedingResources.resolved, false))
      .orderBy(desc(topicsNeedingResources.priority), desc(topicsNeedingResources.requestCount));
  }

  async markTopicResourcesResolved(id: string): Promise<void> {
    await db
      .update(topicsNeedingResources)
      .set({
        resolved: true,
        resolvedAt: new Date(),
      })
      .where(eq(topicsNeedingResources.id, id));
  }

  async incrementTopicResourceRequest(topicId: string, topicName: string, reportId?: string): Promise<void> {
    const existing = await db
      .select()
      .from(topicsNeedingResources)
      .where(eq(topicsNeedingResources.topicId, topicId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing - increment request count and priority
      await db
        .update(topicsNeedingResources)
        .set({
          requestCount: sql`${topicsNeedingResources.requestCount} + 1`,
          lastRequested: new Date(),
          priority: sql`${topicsNeedingResources.priority} + 1`,
          reportId: reportId || existing[0].reportId,
        })
        .where(eq(topicsNeedingResources.topicId, topicId));
    } else {
      // Insert new entry
      await db.insert(topicsNeedingResources).values({
        topicId,
        topicName,
        reportId,
        requestCount: 1,
        priority: 1,
      });
    }
  }
  
  // Resource mapping operations
  async createResourceMapping(mapping: InsertResourceMapping): Promise<ResourceMapping> {
    const [newMapping] = await db
      .insert(resourceMappings)
      .values([mapping as typeof resourceMappings.$inferInsert])
      .returning();
    return newMapping;
  }
  
  async updateResourceMapping(id: string, updates: Partial<ResourceMapping>): Promise<ResourceMapping> {
    const [updatedMapping] = await db
      .update(resourceMappings)
      .set(updates)
      .where(eq(resourceMappings.id, id))
      .returning();
    return updatedMapping;
  }
  
  async deleteResourceMapping(id: string): Promise<void> {
    await db
      .delete(resourceMappings)
      .where(eq(resourceMappings.id, id));
  }
  
  async getResourceMappings(filters?: {
    topicId?: string;
    resourceId?: string;
    isActive?: boolean;
    isAiSuggested?: boolean;
  }): Promise<(ResourceMapping & { topic?: NursingTopic; resource?: LearningResource })[]> {
    let query = db
      .select({
        mapping: resourceMappings,
        topic: nursingTopics,
        resource: learningResources,
      })
      .from(resourceMappings)
      .leftJoin(nursingTopics, eq(resourceMappings.topicId, nursingTopics.id))
      .leftJoin(learningResources, eq(resourceMappings.resourceId, learningResources.id))
      .$dynamic();
    
    const conditions = [];
    if (filters?.topicId) {
      conditions.push(eq(resourceMappings.topicId, filters.topicId));
    }
    if (filters?.resourceId) {
      conditions.push(eq(resourceMappings.resourceId, filters.resourceId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(resourceMappings.isActive, filters.isActive));
    }
    if (filters?.isAiSuggested !== undefined) {
      conditions.push(eq(resourceMappings.isAiSuggested, filters.isAiSuggested));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const results = await query;
    return results.map(r => ({
      ...r.mapping,
      topic: r.topic || undefined,
      resource: r.resource || undefined,
    }));
  }
  
  async getResourceMappingsByTopic(topicId: string): Promise<(ResourceMapping & { resource: LearningResource })[]> {
    const results = await db
      .select({
        mapping: resourceMappings,
        resource: learningResources,
      })
      .from(resourceMappings)
      .innerJoin(learningResources, eq(resourceMappings.resourceId, learningResources.id))
      .where(and(eq(resourceMappings.topicId, topicId), eq(resourceMappings.isActive, true)));
    
    return results.map(r => ({
      ...r.mapping,
      resource: r.resource,
    }));
  }
  
  async bulkCreateResourceMappings(mappings: InsertResourceMapping[]): Promise<ResourceMapping[]> {
    if (mappings.length === 0) return [];
    const newMappings = await db
      .insert(resourceMappings)
      .values(mappings as (typeof resourceMappings.$inferInsert)[])
      .returning();
    return newMappings;
  }
  
  async getResourceMappingStats(): Promise<{
    totalMappings: number;
    aiSuggestedMappings: number;
    manualMappings: number;
    activeMappings: number;
    topicsWithMappings: number;
    resourcesUsed: number;
  }> {
    const [total] = await db.select({ count: sql`count(*)` }).from(resourceMappings);
    const [aiSuggested] = await db.select({ count: sql`count(*)` }).from(resourceMappings).where(eq(resourceMappings.isAiSuggested, true));
    const [manual] = await db.select({ count: sql`count(*)` }).from(resourceMappings).where(eq(resourceMappings.isAiSuggested, false));
    const [active] = await db.select({ count: sql`count(*)` }).from(resourceMappings).where(eq(resourceMappings.isActive, true));
    const [topics] = await db.select({ count: sql`count(distinct ${resourceMappings.topicId})` }).from(resourceMappings);
    const [resources] = await db.select({ count: sql`count(distinct ${resourceMappings.resourceId})` }).from(resourceMappings);
    
    return {
      totalMappings: Number(total.count),
      aiSuggestedMappings: Number(aiSuggested.count),
      manualMappings: Number(manual.count),
      activeMappings: Number(active.count),
      topicsWithMappings: Number(topics.count),
      resourcesUsed: Number(resources.count),
    };
  }
  
  // Learning resource CRUD operations
  async createLearningResource(resource: Omit<LearningResource, 'id'>): Promise<LearningResource> {
    const [newResource] = await db
      .insert(learningResources)
      .values(resource)
      .returning();
    return newResource;
  }
  
  async updateLearningResource(id: string, updates: Partial<LearningResource>): Promise<LearningResource> {
    const [updatedResource] = await db
      .update(learningResources)
      .set(updates)
      .where(eq(learningResources.id, id))
      .returning();
    return updatedResource;
  }
  
  async deleteLearningResource(id: string): Promise<void> {
    await db
      .delete(learningResources)
      .where(eq(learningResources.id, id));
  }
  
  async getAllLearningResources(): Promise<LearningResource[]> {
    return await db
      .select()
      .from(learningResources)
      .orderBy(asc(learningResources.title));
  }
  
  async searchLearningResources(query: string): Promise<LearningResource[]> {
    return await db
      .select()
      .from(learningResources)
      .where(sql`${learningResources.title} ILIKE ${'%' + query + '%'}`)
      .orderBy(asc(learningResources.title));
  }
  
  // Demand analytics operations
  async trackTopicDemand(demand: InsertTopicDemand): Promise<TopicDemand> {
    const [newDemand] = await db
      .insert(topicDemand)
      .values([demand as typeof topicDemand.$inferInsert])
      .returning();
    return newDemand;
  }
  
  async getTopicDemandByDateRange(startDate: Date, endDate: Date): Promise<TopicDemand[]> {
    return await db
      .select()
      .from(topicDemand)
      .where(sql`${topicDemand.requestedAt} BETWEEN ${startDate} AND ${endDate}`)
      .orderBy(desc(topicDemand.requestedAt));
  }
  
  async getTopicDemandStats(topicId?: string): Promise<{
    totalDemand: number;
    uniqueUsers: number;
    avgPriority: number;
    sources: { source: string; count: number }[];
  }> {
    let baseQuery = db.select({
      totalDemand: sql<number>`count(*)`,
      uniqueUsers: sql<number>`count(distinct ${topicDemand.userId})`,
      avgPriority: sql<number>`avg(${topicDemand.priority})`,
    }).from(topicDemand).$dynamic();
    
    if (topicId) {
      baseQuery = baseQuery.where(eq(topicDemand.topicId, topicId));
    }
    
    const [stats] = await baseQuery;
    
    // Get source breakdown
    let sourceQuery = db.select({
      source: topicDemand.source,
      count: sql<number>`count(*)`,
    }).from(topicDemand).groupBy(topicDemand.source).$dynamic();
    
    if (topicId) {
      sourceQuery = sourceQuery.where(eq(topicDemand.topicId, topicId));
    }
    
    const sources = await sourceQuery;
    
    return {
      totalDemand: Number(stats.totalDemand),
      uniqueUsers: Number(stats.uniqueUsers),
      avgPriority: Number(stats.avgPriority) || 0,
      sources: sources.map(s => ({ source: s.source, count: s.count })),
    };
  }
  
  // Resource allocation operations
  async createResourceAllocation(allocation: InsertResourceAllocation): Promise<ResourceAllocation> {
    const [newAllocation] = await db
      .insert(resourceAllocation)
      .values([allocation as typeof resourceAllocation.$inferInsert])
      .returning();
    return newAllocation;
  }
  
  async getResourceAllocations(status?: string): Promise<ResourceAllocation[]> {
    let query = db.select().from(resourceAllocation).$dynamic();
    
    if (status) {
      query = query.where(eq(resourceAllocation.status, status));
    }
    
    return await query.orderBy(desc(resourceAllocation.createdAt));
  }
  
  async updateResourceAllocationStatus(id: string, status: string, approvedBy?: string): Promise<void> {
    const updates: any = { status };
    
    if (status === 'approved' && approvedBy) {
      updates.approvedBy = approvedBy;
      updates.approvedAt = new Date();
    } else if (status === 'completed') {
      updates.completedAt = new Date();
    }
    
    await db
      .update(resourceAllocation)
      .set(updates)
      .where(eq(resourceAllocation.id, id));
  }
  
  async getResourceAllocationsByTopic(topicId: string): Promise<ResourceAllocation[]> {
    return await db
      .select()
      .from(resourceAllocation)
      .where(eq(resourceAllocation.topicId, topicId))
      .orderBy(desc(resourceAllocation.createdAt));
  }
  
  // Call booking operations
  async createCallBooking(booking: InsertCallBooking): Promise<CallBooking> {
    const [newBooking] = await db
      .insert(callBookings)
      .values([booking as typeof callBookings.$inferInsert])
      .returning();
    return newBooking;
  }
  
  async updateCallBooking(id: string, updates: Partial<CallBooking>): Promise<CallBooking> {
    const [updatedBooking] = await db
      .update(callBookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(callBookings.id, id))
      .returning();
    return updatedBooking;
  }
  
  async getCallBookings(filters?: {
    status?: string;
    userId?: string;
    topicId?: string;
    assignedTo?: string;
  }): Promise<CallBooking[]> {
    let query = db.select().from(callBookings).$dynamic();
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(callBookings.status, filters.status));
    }
    if (filters?.userId) {
      conditions.push(eq(callBookings.userId, filters.userId));
    }
    if (filters?.topicId) {
      conditions.push(eq(callBookings.topicId, filters.topicId));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(callBookings.assignedTo, filters.assignedTo));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(callBookings.createdAt));
  }
  
  async getCallBookingById(id: string): Promise<CallBooking | undefined> {
    const [booking] = await db
      .select()
      .from(callBookings)
      .where(eq(callBookings.id, id));
    return booking || undefined;
  }
  
  async getCallBookingQueue(): Promise<CallBooking[]> {
    return await db
      .select()
      .from(callBookings)
      .where(eq(callBookings.status, 'pending'))
      .orderBy(
        sql`CASE ${callBookings.urgency} 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END`,
        asc(callBookings.createdAt)
      );
  }
  
  async getAvailableTimeSlots(date: Date, adminId?: string): Promise<string[]> {
    // Get admin availability for the given day
    const dayOfWeek = date.getDay();
    const availabilityConditions = [
      eq(adminAvailability.dayOfWeek, dayOfWeek),
      eq(adminAvailability.isActive, true),
    ];
    if (adminId) {
      availabilityConditions.push(eq(adminAvailability.adminId, adminId));
    }
    const availabilities = await db
      .select()
      .from(adminAvailability)
      .where(and(...availabilityConditions));
    
    // Get existing bookings for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingBookings = await db
      .select()
      .from(callBookings)
      .where(and(
        sql`${callBookings.scheduledAt} BETWEEN ${startOfDay} AND ${endOfDay}`,
        eq(callBookings.status, 'scheduled')
      ));
    
    // Calculate available slots
    const availableSlots: string[] = [];
    
    for (const availability of availabilities) {
      const [startHour, startMinute] = availability.startTime.split(':').map(Number);
      const [endHour, endMinute] = availability.endTime.split(':').map(Number);
      
      let currentTime = new Date(date);
      currentTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date(date);
      endTime.setHours(endHour, endMinute, 0, 0);
      
      while (currentTime < endTime) {
        const slotTime = new Date(currentTime);
        const slotEndTime = new Date(currentTime);
        slotEndTime.setMinutes(slotEndTime.getMinutes() + (availability.slotDuration || 30));
        
        // Check if slot is available
        const isBooked = existingBookings.some(booking => {
          const bookingTime = new Date(booking.scheduledAt!);
          return bookingTime >= slotTime && bookingTime < slotEndTime;
        });
        
        if (!isBooked) {
          availableSlots.push(slotTime.toISOString());
        }
        
        currentTime.setMinutes(currentTime.getMinutes() + (availability.slotDuration || 30) + (availability.bufferTime || 15));
      }
    }
    
    return availableSlots;
  }
  
  // Lead management operations
  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db
      .insert(leads)
      .values([lead as typeof leads.$inferInsert])
      .returning();
    return newLead;
  }
  
  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const [updatedLead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }
  
  async getLeads(filters?: {
    status?: string;
    assignedTo?: string;
    source?: string;
  }): Promise<Lead[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(leads.status, filters.status));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(leads.assignedTo, filters.assignedTo));
    }
    if (filters?.source) {
      conditions.push(eq(leads.source, filters.source));
    }

    return await db
      .select()
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leads.createdAt));
  }
  
  async getLeadById(id: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id));
    return lead || undefined;
  }
  
  async getLeadByBookingId(bookingId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.bookingId, bookingId));
    return lead || undefined;
  }
  
  async getLeadMetrics(): Promise<{
    totalLeads: number;
    convertedLeads: number;
    conversionRate: number;
    averageConversionValue: number;
    leadsByStatus: { status: string; count: number }[];
  }> {
    const [metrics] = await db
      .select({
        totalLeads: sql<number>`count(*)`,
        convertedLeads: sql<number>`count(*) filter (where ${leads.status} = 'converted')`,
        averageConversionValue: sql<number>`avg(${leads.conversionValue}) filter (where ${leads.status} = 'converted')`,
      })
      .from(leads);
    
    const statusBreakdown = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .groupBy(leads.status);
    
    const totalLeads = Number(metrics.totalLeads) || 0;
    const convertedLeads = Number(metrics.convertedLeads) || 0;
    
    return {
      totalLeads,
      convertedLeads,
      conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
      averageConversionValue: Number(metrics.averageConversionValue) || 0,
      leadsByStatus: statusBreakdown.map(s => ({
        status: s.status!,
        count: Number(s.count),
      })),
    };
  }
  
  // Admin availability operations
  async createAdminAvailability(availability: InsertAdminAvailability): Promise<AdminAvailability> {
    const [newAvailability] = await db
      .insert(adminAvailability)
      .values(availability)
      .returning();
    return newAvailability;
  }
  
  async updateAdminAvailability(id: string, updates: Partial<AdminAvailability>): Promise<AdminAvailability> {
    const [updatedAvailability] = await db
      .update(adminAvailability)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adminAvailability.id, id))
      .returning();
    return updatedAvailability;
  }
  
  async getAdminAvailability(adminId: string): Promise<AdminAvailability[]> {
    return await db
      .select()
      .from(adminAvailability)
      .where(eq(adminAvailability.adminId, adminId))
      .orderBy(asc(adminAvailability.dayOfWeek));
  }
  
  async deleteAdminAvailability(id: string): Promise<void> {
    await db
      .delete(adminAvailability)
      .where(eq(adminAvailability.id, id));
  }

  // ==================== RAG System Operations ====================
  
  // Document operations
  async createDocument(doc: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(doc as typeof documents.$inferInsert)
      .returning();
    return newDocument;
  }

  async updateDocumentStatus(id: string, status: string): Promise<void> {
    await db
      .update(documents)
      .set({ status, updatedAt: new Date() })
      .where(eq(documents.id, id));
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return result[0];
  }

  async getDocumentsByStatus(status: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.status, status))
      .orderBy(desc(documents.createdAt));
  }

  async deleteDocument(id: string): Promise<void> {
    await db
      .delete(documents)
      .where(eq(documents.id, id));
    // Cascade delete is handled by the foreign key constraint
  }

  async getDocumentByContentHash(hash: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.contentHash, hash))
      .limit(1);
    return result[0];
  }

  // Chunk operations
  async createChunks(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]> {
    if (chunks.length === 0) return [];
    
    // Batch insert for better performance
    const batchSize = 100;
    const results: DocumentChunk[] = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const inserted = await db
        .insert(documentChunks)
        .values(batch as (typeof documentChunks.$inferInsert)[])
        .returning();
      results.push(...inserted);
    }
    
    return results;
  }

  async searchChunks(
    query: string,
    filters?: {
      documentId?: string;
      topicIds?: string[];
      tags?: string[];
    },
    limit: number = 10
  ): Promise<ChunkSearchResult[]> {
    let queryBuilder = db.select().from(documentChunks);
    const conditions: any[] = [];

    if (filters?.documentId) {
      conditions.push(eq(documentChunks.documentId, filters.documentId));
    }

    if (filters?.topicIds && filters.topicIds.length > 0) {
      // Check if any topicId is in the array
      conditions.push(
        sql`${documentChunks.topicIds} && ARRAY[${sql.raw(filters.topicIds.map(id => `'${id}'`).join(','))}]`
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(
        sql`${documentChunks.tags} && ARRAY[${sql.raw(filters.tags.map(tag => `'${tag}'`).join(','))}]`
      );
    }

    // Add text search if query is provided
    if (query) {
      conditions.push(
        or(
          sql`${documentChunks.cleanText} ILIKE ${`%${query}%`}`,
          sql`${documentChunks.rawText} ILIKE ${`%${query}%`}`
        )
      );
    }

    const chunks = await db
      .select()
      .from(documentChunks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .orderBy(desc(documentChunks.createdAt));

    return chunks as ChunkSearchResult[];
  }

  async getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
    return await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.chunkIndex));
  }

  async updateChunkEmbedding(id: string, embedding: number[]): Promise<void> {
    await db
      .update(documentChunks)
      .set({ embedding })
      .where(eq(documentChunks.id, id));
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));
  }

  async getChunkById(id: string): Promise<DocumentChunk | undefined> {
    const result = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.id, id))
      .limit(1);
    return result[0];
  }

  // Job tracking
  async createJob(job: InsertDocumentJob): Promise<DocumentJob> {
    const [newJob] = await db
      .insert(documentJobs)
      .values(job as typeof documentJobs.$inferInsert)
      .returning();
    return newJob;
  }

  async updateJobStatus(
    id: string,
    status: string,
    progress?: number,
    error?: string
  ): Promise<void> {
    const updates: any = { status };
    if (progress !== undefined) updates.progress = progress;
    if (error !== undefined) updates.error = error;
    if (status === 'processing' && !updates.startedAt) {
      updates.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    await db
      .update(documentJobs)
      .set(updates)
      .where(eq(documentJobs.id, id));
  }

  async getJobsByDocument(documentId: string): Promise<DocumentJob[]> {
    return await db
      .select()
      .from(documentJobs)
      .where(eq(documentJobs.documentId, documentId))
      .orderBy(desc(documentJobs.createdAt));
  }

  async getActiveJobs(): Promise<DocumentJob[]> {
    return await db
      .select()
      .from(documentJobs)
      .where(
        or(
          eq(documentJobs.status, 'pending'),
          eq(documentJobs.status, 'processing')
        )
      )
      .orderBy(asc(documentJobs.createdAt));
  }

  async getJobById(id: string): Promise<DocumentJob | undefined> {
    const result = await db
      .select()
      .from(documentJobs)
      .where(eq(documentJobs.id, id))
      .limit(1);
    return result[0];
  }

  // Search operations
  async vectorSearch(
    embedding: number[],
    filters?: {
      documentIds?: string[];
      topicIds?: string[];
      tags?: string[];
      threshold?: number;
    },
    limit: number = 10
  ): Promise<ChunkSearchResult[]> {
    // Since we're using JSONB for embeddings (fallback for pgvector),
    // we'll implement cosine similarity calculation in application code
    let queryBuilder = db.select().from(documentChunks);
    const conditions: any[] = [];

    if (filters?.documentIds && filters.documentIds.length > 0) {
      conditions.push(inArray(documentChunks.documentId, filters.documentIds));
    }

    if (filters?.topicIds && filters.topicIds.length > 0) {
      conditions.push(
        sql`${documentChunks.topicIds} && ARRAY[${sql.raw(filters.topicIds.map(id => `'${id}'`).join(','))}]`
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(
        sql`${documentChunks.tags} && ARRAY[${sql.raw(filters.tags.map(tag => `'${tag}'`).join(','))}]`
      );
    }

    const chunks = await db
      .select()
      .from(documentChunks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Calculate cosine similarity for each chunk
    const resultsWithScores = chunks
      .map((chunk) => {
        if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
          return null;
        }
        
        // Calculate cosine similarity
        const dotProduct = embedding.reduce(
          (sum, val, idx) => sum + val * (chunk.embedding as number[])[idx],
          0
        );
        const magnitudeA = Math.sqrt(
          embedding.reduce((sum, val) => sum + val * val, 0)
        );
        const magnitudeB = Math.sqrt(
          (chunk.embedding as number[]).reduce((sum, val) => sum + val * val, 0)
        );
        const similarity = dotProduct / (magnitudeA * magnitudeB);

        return {
          ...chunk,
          score: similarity
        } as ChunkSearchResult;
      })
      .filter((result): result is ChunkSearchResult => {
        if (!result) return false;
        if (filters?.threshold && result.score! < filters.threshold) return false;
        return true;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    return resultsWithScores;
  }

  async hybridSearch(
    query: string,
    embedding: number[],
    filters?: {
      documentIds?: string[];
      topicIds?: string[];
      tags?: string[];
      weights?: { vector: number; keyword: number };
    },
    limit: number = 10
  ): Promise<ChunkSearchResult[]> {
    const weights = filters?.weights || { vector: 0.7, keyword: 0.3 };

    // Get vector search results
    const vectorResults = await this.vectorSearch(
      embedding,
      {
        documentIds: filters?.documentIds,
        topicIds: filters?.topicIds,
        tags: filters?.tags,
      },
      limit * 2 // Get more results for merging
    );

    // Get keyword search results
    const keywordResults = await this.searchChunks(
      query,
      {
        documentId: undefined,
        topicIds: filters?.topicIds,
        tags: filters?.tags,
      },
      limit * 2
    );

    // Merge and re-rank results
    const resultMap = new Map<string, ChunkSearchResult>();

    // Add vector results with weighted scores
    vectorResults.forEach((result) => {
      resultMap.set(result.id, {
        ...result,
        score: (result.score || 0) * weights.vector
      });
    });

    // Add or update with keyword results
    keywordResults.forEach((result, index) => {
      const keywordScore = 1 - (index / keywordResults.length); // Simple ranking score
      const existing = resultMap.get(result.id);
      
      if (existing) {
        existing.score = (existing.score || 0) + (keywordScore * weights.keyword);
      } else {
        resultMap.set(result.id, {
          ...result,
          score: keywordScore * weights.keyword
        });
      }
    });

    // Sort by combined score and return top results
    return Array.from(resultMap.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  async fullTextSearch(
    query: string,
    filters?: {
      documentIds?: string[];
      topicIds?: string[];
      tags?: string[];
    },
    limit: number = 10
  ): Promise<ChunkSearchResult[]> {
    return await this.searchChunks(query, filters, limit);
  }

  // Citation tracking
  async recordCitation(citation: InsertRagCitation): Promise<RagCitation> {
    const [newCitation] = await db
      .insert(ragCitations)
      .values(citation as typeof ragCitations.$inferInsert)
      .returning();
    return newCitation;
  }

  async getCitationsByQuery(queryId: string): Promise<(RagCitation & { chunk: DocumentChunk })[]> {
    const results = await db
      .select({
        citation: ragCitations,
        chunk: documentChunks
      })
      .from(ragCitations)
      .innerJoin(documentChunks, eq(ragCitations.chunkId, documentChunks.id))
      .where(eq(ragCitations.queryId, queryId))
      .orderBy(desc(ragCitations.relevanceScore));

    return results.map(r => ({ ...r.citation, chunk: r.chunk }));
  }

  async updateCitationUsage(id: string, usedInAnswer: boolean): Promise<void> {
    await db
      .update(ragCitations)
      .set({ usedInAnswer })
      .where(eq(ragCitations.id, id));
  }

  async getCitationStats(): Promise<{
    totalCitations: number;
    usedCitations: number;
    avgRelevanceScore: number;
    topCitedChunks: { chunkId: string; count: number }[];
  }> {
    // Get total and used citations count
    const [stats] = await db
      .select({
        totalCitations: sql<number>`COUNT(*)`,
        usedCitations: sql<number>`COUNT(CASE WHEN ${ragCitations.usedInAnswer} = true THEN 1 END)`,
        avgRelevanceScore: sql<number>`AVG(${ragCitations.relevanceScore}::numeric)`
      })
      .from(ragCitations);

    // Get top cited chunks
    const topCited = await db
      .select({
        chunkId: ragCitations.chunkId,
        count: sql<number>`COUNT(*)::int`
      })
      .from(ragCitations)
      .groupBy(ragCitations.chunkId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    return {
      totalCitations: stats?.totalCitations || 0,
      usedCitations: stats?.usedCitations || 0,
      avgRelevanceScore: stats?.avgRelevanceScore || 0,
      topCitedChunks: topCited
    };
  }

  // User progress operations
  async getUserProgressByTopic(userId: string): Promise<(UserProgress & { topic: NursingTopic })[]> {
    const results = await db
      .select()
      .from(userProgress)
      .innerJoin(nursingTopics, eq(userProgress.topicId, nursingTopics.id))
      .where(eq(userProgress.userId, userId))
      .orderBy(desc(userProgress.lastStudiedAt));

    return results.map(r => ({ ...r.user_progress, topic: r.nursing_topics }));
  }

  async createUserProgress(progress: InsertUserProgress): Promise<UserProgress> {
    const [newProgress] = await db
      .insert(userProgress)
      .values(progress)
      .returning();
    return newProgress;
  }

  async updateUserProgress(userId: string, topicId: string, updates: Partial<UserProgress>): Promise<UserProgress | null> {
    const [updated] = await db
      .update(userProgress)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.topicId, topicId)
      ))
      .returning();
    
    return updated || null;
  }

  async markTopicComplete(userId: string, topicId: string, studyTimeMinutes: number = 0): Promise<UserProgress> {
    const now = new Date();
    
    // First, try to get existing progress
    const [existing] = await db
      .select()
      .from(userProgress)
      .where(and(
        eq(userProgress.userId, userId),
        eq(userProgress.topicId, topicId)
      ))
      .limit(1);

    if (existing) {
      // Update existing progress
      const [updated] = await db
        .update(userProgress)
        .set({
          totalStudyTime: (existing.totalStudyTime || 0) + studyTimeMinutes,
          lastStudiedAt: now,
          masteryLevel: 'proficient', // Mark as proficient when completed
          updatedAt: now
        })
        .where(and(
          eq(userProgress.userId, userId),
          eq(userProgress.topicId, topicId)
        ))
        .returning();
      
      return updated;
    } else {
      // Create new progress record
      const [created] = await db
        .insert(userProgress)
        .values({
          userId,
          topicId,
          totalStudyTime: studyTimeMinutes,
          lastStudiedAt: now,
          masteryLevel: 'proficient'
        })
        .returning();
        
      return created;
    }
  }

  async transferGuestProgressToUser(guestId: string, userId: string): Promise<void> {
    try {
      // Transfer user progress records
      await db
        .update(userProgress)
        .set({ userId: userId })
        .where(eq(userProgress.userId, guestId));

      // Transfer any study sessions or other progress data
      // Note: Add other tables here as needed when implementing full progress tracking
      
      console.log(`[Progress Transfer] Successfully transferred progress from ${guestId} to ${userId}`);
    } catch (error) {
      console.error(`[Progress Transfer] Failed to transfer progress from ${guestId} to ${userId}:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
