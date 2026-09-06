import { db } from './db';
import { 
  topicsToReview, 
  topicContent,
  topicRelationships,
  nursingSubjects,
  bodySystems 
} from '@shared/topics-schema';
import { eq, and, sql, ilike, or } from 'drizzle-orm';
import { masterTopicsList } from './master-topics-seed';

interface IndexedContent {
  topicId: string;
  topicName: string;
  subject: string;
  system: string | null;
  content: {
    id: string;
    title: string;
    content: string;
    type: string;
    source: string;
  }[];
  relatedTopics: string[];
  searchableKeywords: string[];
  priority: number;
}

interface SearchResult {
  topic: string;
  subject: string;
  system: string | null;
  relevanceScore: number;
  matchedKeywords: string[];
  content: any[];
}

export class ContentIndexer {
  private indexCache: Map<string, IndexedContent> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> topicIds
  private subjectIndex: Map<string, Set<string>> = new Map(); // subject -> topicIds
  private systemIndex: Map<string, Set<string>> = new Map(); // system -> topicIds
  
  constructor() {
    this.initializeIndexes();
  }
  
  // Initialize indexes from the master topics list
  private async initializeIndexes() {
    try {
      // NOTE: topics-schema.ts (topicsToReview and friends) is never merged
      // into db.ts's schema -- doing so would collide with the different
      // topicPerformance/assessmentReports/studyPlans tables already used
      // everywhere via @shared/schema. This module is currently unreferenced
      // by the rest of the app; cast documents the gap instead of masking it.
      const topics = await (db.query as any).topicsToReview.findMany({
        with: {
          content: true,
          resources: true
        }
      });
      
      // Index each topic
      for (const topic of topics) {
        await this.indexTopic(topic);
      }
      
      // Build keyword index
      this.buildKeywordIndex();
      
      // Build subject/system indexes
      this.buildHierarchyIndexes();
      
    } catch (error) {
      console.error('Failed to initialize content indexes:', error);
    }
  }
  
  // Index a single topic with its content
  private async indexTopic(topic: any) {
    // Get related topics
    const relationships = await db.query.topicRelationships.findMany({
      where: or(
        eq(topicRelationships.primaryTopicId, topic.id),
        eq(topicRelationships.relatedTopicId, topic.id)
      )
    });
    
    const relatedTopicIds = relationships
      .map(r => r.primaryTopicId === topic.id ? r.relatedTopicId : r.primaryTopicId)
      .filter((id): id is string => id !== null);
    
    // Extract keywords from topic name and description
    const keywords = this.extractKeywords(topic);
    
    // Create indexed content entry
    const indexed: IndexedContent = {
      topicId: topic.id,
      topicName: topic.name,
      subject: topic.subject,
      system: topic.system,
      content: topic.content || [],
      relatedTopics: relatedTopicIds,
      searchableKeywords: keywords,
      priority: this.calculatePriority(topic)
    };
    
    // Store in cache
    this.indexCache.set(topic.id, indexed);
    
    // Update keyword index
    keywords.forEach(keyword => {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, new Set());
      }
      this.keywordIndex.get(keyword)!.add(topic.id);
    });
  }
  
  // Extract searchable keywords from topic
  private extractKeywords(topic: any): string[] {
    const keywords: string[] = [];
    
    // Add topic name words
    if (topic.name) {
      keywords.push(...topic.name.toLowerCase().split(/\s+/));
    }
    
    // Add description words
    if (topic.description) {
      keywords.push(...topic.description.toLowerCase().split(/\s+/));
    }
    
    // Add stored keywords
    if (topic.keywords && Array.isArray(topic.keywords)) {
      keywords.push(...topic.keywords.map((k: string) => k.toLowerCase()));
    }
    
    // Add subject and system
    if (topic.subject) {
      keywords.push(topic.subject.toLowerCase());
    }
    if (topic.system) {
      keywords.push(topic.system.toLowerCase());
    }
    
    // Remove common stop words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return [...new Set(keywords.filter(word => 
      word.length > 2 && !stopWords.has(word)
    ))];
  }
  
  // Calculate priority score for a topic
  private calculatePriority(topic: any): number {
    let priority = 5; // Default medium priority
    
    // Higher occurrence count = higher priority
    if (topic.occurrenceCount > 10) priority -= 1;
    if (topic.occurrenceCount > 20) priority -= 1;
    
    // Higher gap score = higher priority
    if (topic.averageGapScore > 30) priority -= 1;
    if (topic.averageGapScore > 50) priority -= 1;
    
    // Core topics get priority boost
    if (topic.isCore) priority -= 1;
    
    return Math.max(1, Math.min(5, priority));
  }
  
  // Build keyword index for fast searching
  private buildKeywordIndex() {
    // Already built during indexTopic, but we can optimize here
    console.log(`Content indexer: Indexed ${this.keywordIndex.size} unique keywords`);
  }
  
  // Build subject and system indexes
  private buildHierarchyIndexes() {
    for (const [topicId, content] of this.indexCache) {
      // Index by subject
      if (content.subject) {
        if (!this.subjectIndex.has(content.subject)) {
          this.subjectIndex.set(content.subject, new Set());
        }
        this.subjectIndex.get(content.subject)!.add(topicId);
      }
      
      // Index by system
      if (content.system) {
        if (!this.systemIndex.has(content.system)) {
          this.systemIndex.set(content.system, new Set());
        }
        this.systemIndex.get(content.system)!.add(topicId);
      }
    }
    
    console.log(`Content indexer: Indexed ${this.subjectIndex.size} subjects, ${this.systemIndex.size} systems`);
  }
  
  // Search for content by keywords
  public search(query: string, filters?: {
    subject?: string;
    system?: string;
    maxResults?: number;
  }): SearchResult[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    const results: Map<string, SearchResult> = new Map();
    
    // Find topics matching query keywords
    for (const word of queryWords) {
      const matchingTopicIds = this.keywordIndex.get(word);
      if (matchingTopicIds) {
        for (const topicId of matchingTopicIds) {
          const content = this.indexCache.get(topicId);
          if (!content) continue;
          
          // Apply filters
          if (filters?.subject && content.subject !== filters.subject) continue;
          if (filters?.system && content.system !== filters.system) continue;
          
          // Create or update result
          if (!results.has(topicId)) {
            results.set(topicId, {
              topic: content.topicName,
              subject: content.subject,
              system: content.system,
              relevanceScore: 0,
              matchedKeywords: [],
              content: content.content
            });
          }
          
          const result = results.get(topicId)!;
          result.relevanceScore += 1;
          result.matchedKeywords.push(word);
        }
      }
    }
    
    // Sort by relevance and priority
    const sortedResults = Array.from(results.values()).sort((a, b) => {
      // First by relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      
      // Then by topic priority
      const aPriority = this.getTopicPriority(a.topic);
      const bPriority = this.getTopicPriority(b.topic);
      return aPriority - bPriority;
    });
    
    // Limit results if specified
    return filters?.maxResults ? 
      sortedResults.slice(0, filters.maxResults) : 
      sortedResults;
  }
  
  // Get topics by subject
  public getTopicsBySubject(subject: string): IndexedContent[] {
    const topicIds = this.subjectIndex.get(subject);
    if (!topicIds) return [];
    
    return Array.from(topicIds)
      .map(id => this.indexCache.get(id))
      .filter(content => content !== undefined) as IndexedContent[];
  }
  
  // Get topics by system
  public getTopicsBySystem(system: string): IndexedContent[] {
    const topicIds = this.systemIndex.get(system);
    if (!topicIds) return [];
    
    return Array.from(topicIds)
      .map(id => this.indexCache.get(id))
      .filter(content => content !== undefined) as IndexedContent[];
  }
  
  // Get related content for a topic
  public getRelatedContent(topicId: string): IndexedContent[] {
    const topic = this.indexCache.get(topicId);
    if (!topic) return [];
    
    return topic.relatedTopics
      .map(id => this.indexCache.get(id))
      .filter(content => content !== undefined) as IndexedContent[];
  }
  
  // Get topic priority
  private getTopicPriority(topicName: string): number {
    for (const [id, content] of this.indexCache) {
      if (content.topicName === topicName) {
        return content.priority;
      }
    }
    return 5; // Default priority
  }
  
  // Seed master topics if database is empty
  public async seedMasterTopics() {
    try {
      // Check if topics already exist
      const existingCount = await (db.query as any).topicsToReview.findMany({
        limit: 1
      });
      
      if (existingCount.length > 0) {
        console.log('Topics already exist in database, skipping seed');
        return;
      }
      
      console.log('Seeding master topics list...');
      
      // Insert subjects first
      for (const subject of masterTopicsList) {
        for (const topic of subject.topics) {
          await db.insert(topicsToReview).values({
            name: topic.name,
            subject: subject.subject,
            system: subject.system,
            difficulty: topic.difficulty,
            estimatedStudyTime: topic.estimatedStudyTime,
            isCore: true, // Master topics are core topics
            keywords: [
              subject.subject.toLowerCase(),
              subject.system?.toLowerCase() || '',
              ...topic.name.toLowerCase().split(/\s+/)
            ].filter(k => k.length > 0)
          });
        }
      }
      
      console.log('Master topics seeded successfully');
      
      // Re-initialize indexes with new data
      await this.initializeIndexes();
      
    } catch (error) {
      console.error('Failed to seed master topics:', error);
    }
  }
  
  // Get content statistics
  public getStatistics() {
    return {
      totalTopics: this.indexCache.size,
      totalKeywords: this.keywordIndex.size,
      subjectCount: this.subjectIndex.size,
      systemCount: this.systemIndex.size,
      topicsBySubject: Array.from(this.subjectIndex.entries()).map(([subject, topics]) => ({
        subject,
        count: topics.size
      })),
      topicsBySystem: Array.from(this.systemIndex.entries()).map(([system, topics]) => ({
        system,
        count: topics.size
      }))
    };
  }
}

// Export singleton instance
export const contentIndexer = new ContentIndexer();