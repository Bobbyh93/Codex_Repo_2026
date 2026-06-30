// Resource indexing and mapping system for admin backend

interface Resource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'practice' | 'textbook' | 'quiz' | 'simulation';
  url?: string;
  provider?: string;
  duration?: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  topics: string[];
  diagnoses?: string[];
  systems?: string[];
  specialties?: string[];
  keywords: string[];
  metadata: {
    author?: string;
    publishDate?: string;
    lastUpdated?: string;
    views?: number;
    rating?: number;
    license?: string;
    cost?: 'free' | 'paid' | 'subscription';
  };
  mappings: {
    nclexCategory?: string;
    textbookChapter?: string;
    courseWeek?: number;
    learningObjectives?: string[];
  };
  quality: {
    accuracy?: number; // 0-100
    relevance?: number; // 0-100
    engagement?: number; // 0-100
    effectivenessScore?: number; // calculated from user outcomes
  };
}

interface IndexedResource extends Resource {
  searchableText: string;
  relevanceScore: number;
  usageCount: number;
  lastAccessed?: Date;
}

// Resource indexing class
export class ResourceIndexer {
  private resources: Map<string, IndexedResource> = new Map();
  private topicIndex: Map<string, Set<string>> = new Map(); // topic -> resource IDs
  private diagnosisIndex: Map<string, Set<string>> = new Map(); // diagnosis -> resource IDs
  private systemIndex: Map<string, Set<string>> = new Map(); // body system -> resource IDs
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> resource IDs
  private difficultyIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();

  // Add or update a resource
  addResource(resource: Resource): IndexedResource {
    const indexed: IndexedResource = {
      ...resource,
      searchableText: this.createSearchableText(resource),
      relevanceScore: this.calculateRelevance(resource),
      usageCount: 0,
      lastAccessed: undefined
    };

    // Store in main index
    this.resources.set(resource.id, indexed);

    // Update topic index
    resource.topics.forEach(topic => {
      if (!this.topicIndex.has(topic)) {
        this.topicIndex.set(topic, new Set());
      }
      this.topicIndex.get(topic)!.add(resource.id);
    });

    // Update diagnosis index
    resource.diagnoses?.forEach(diagnosis => {
      if (!this.diagnosisIndex.has(diagnosis)) {
        this.diagnosisIndex.set(diagnosis, new Set());
      }
      this.diagnosisIndex.get(diagnosis)!.add(resource.id);
    });

    // Update system index
    resource.systems?.forEach(system => {
      if (!this.systemIndex.has(system)) {
        this.systemIndex.set(system, new Set());
      }
      this.systemIndex.get(system)!.add(resource.id);
    });

    // Update keyword index
    resource.keywords.forEach(keyword => {
      const normalized = keyword.toLowerCase();
      if (!this.keywordIndex.has(normalized)) {
        this.keywordIndex.set(normalized, new Set());
      }
      this.keywordIndex.get(normalized)!.add(resource.id);
    });

    // Update difficulty index
    if (!this.difficultyIndex.has(resource.difficulty)) {
      this.difficultyIndex.set(resource.difficulty, new Set());
    }
    this.difficultyIndex.get(resource.difficulty)!.add(resource.id);

    // Update type index
    if (!this.typeIndex.has(resource.type)) {
      this.typeIndex.set(resource.type, new Set());
    }
    this.typeIndex.get(resource.type)!.add(resource.id);

    return indexed;
  }

  // Create searchable text for full-text search
  private createSearchableText(resource: Resource): string {
    return [
      resource.title,
      resource.provider,
      ...resource.tags,
      ...resource.topics,
      ...(resource.diagnoses || []),
      ...(resource.systems || []),
      ...(resource.specialties || []),
      ...resource.keywords,
      resource.mappings.nclexCategory,
      ...(resource.mappings.learningObjectives || [])
    ].filter(Boolean).join(' ').toLowerCase();
  }

  // Calculate resource relevance score
  private calculateRelevance(resource: Resource): number {
    let score = 50; // Base score

    // Quality scores
    if (resource.quality.accuracy) score += resource.quality.accuracy * 0.2;
    if (resource.quality.relevance) score += resource.quality.relevance * 0.2;
    if (resource.quality.engagement) score += resource.quality.engagement * 0.1;

    // Metadata factors
    if (resource.metadata.rating) score += resource.metadata.rating * 2;
    if (resource.metadata.cost === 'free') score += 10;
    if (resource.metadata.lastUpdated) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(resource.metadata.lastUpdated).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      if (daysSinceUpdate < 90) score += 10;
      if (daysSinceUpdate < 30) score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  // Search resources by query
  searchResources(query: string, filters?: {
    type?: string;
    difficulty?: string;
    topic?: string;
    diagnosis?: string;
    system?: string;
    maxResults?: number;
  }): IndexedResource[] {
    const queryLower = query.toLowerCase();
    let results: IndexedResource[] = [];

    // Search in all resources
    this.resources.forEach(resource => {
      let matches = false;
      let matchScore = 0;

      // Title match (highest weight)
      if (resource.title.toLowerCase().includes(queryLower)) {
        matches = true;
        matchScore += 30;
      }

      // Full text search
      if (resource.searchableText.includes(queryLower)) {
        matches = true;
        matchScore += 20;
      }

      // Keyword exact match
      if (resource.keywords.some(k => k.toLowerCase() === queryLower)) {
        matches = true;
        matchScore += 25;
      }

      // Apply filters
      if (filters) {
        if (filters.type && resource.type !== filters.type) matches = false;
        if (filters.difficulty && resource.difficulty !== filters.difficulty) matches = false;
        if (filters.topic && !resource.topics.includes(filters.topic)) matches = false;
        if (filters.diagnosis && !resource.diagnoses?.includes(filters.diagnosis)) matches = false;
        if (filters.system && !resource.systems?.includes(filters.system)) matches = false;
      }

      if (matches) {
        results.push({
          ...resource,
          relevanceScore: resource.relevanceScore + matchScore
        });
      }
    });

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    if (filters?.maxResults) {
      results = results.slice(0, filters.maxResults);
    }

    return results;
  }

  // Get resources by topic
  getResourcesByTopic(topic: string): IndexedResource[] {
    const resourceIds = this.topicIndex.get(topic);
    if (!resourceIds) return [];
    
    return Array.from(resourceIds)
      .map(id => this.resources.get(id))
      .filter(r => r !== undefined) as IndexedResource[];
  }

  // Get resources by diagnosis
  getResourcesByDiagnosis(diagnosis: string): IndexedResource[] {
    const resourceIds = this.diagnosisIndex.get(diagnosis);
    if (!resourceIds) return [];
    
    return Array.from(resourceIds)
      .map(id => this.resources.get(id))
      .filter(r => r !== undefined) as IndexedResource[];
  }

  // Map topics to best matching resources
  mapTopicsToResources(topics: string[], maxPerTopic: number = 3): Map<string, IndexedResource[]> {
    const mapping = new Map<string, IndexedResource[]>();

    topics.forEach(topic => {
      const resources = this.getResourcesByTopic(topic)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxPerTopic);
      
      mapping.set(topic, resources);
    });

    return mapping;
  }

  // Get resource recommendations based on performance data
  getRecommendations(
    weakTopics: string[],
    difficulty: string,
    preferredTypes?: string[]
  ): IndexedResource[] {
    const recommendations: IndexedResource[] = [];
    const seen = new Set<string>();

    // Get resources for each weak topic
    weakTopics.forEach(topic => {
      const topicResources = this.getResourcesByTopic(topic)
        .filter(r => {
          if (seen.has(r.id)) return false;
          if (r.difficulty !== difficulty && difficulty !== 'all') return false;
          if (preferredTypes && !preferredTypes.includes(r.type)) return false;
          return true;
        })
        .sort((a, b) => {
          // Prioritize by effectiveness score if available
          if (a.quality.effectivenessScore && b.quality.effectivenessScore) {
            return b.quality.effectivenessScore - a.quality.effectivenessScore;
          }
          return b.relevanceScore - a.relevanceScore;
        })
        .slice(0, 2); // Top 2 per topic

      topicResources.forEach(r => {
        seen.add(r.id);
        recommendations.push(r);
      });
    });

    return recommendations;
  }

  // Bulk import resources
  bulkImport(resources: Resource[]): {
    imported: number;
    failed: number;
    errors: string[];
  } {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    resources.forEach(resource => {
      try {
        this.validateResource(resource);
        this.addResource(resource);
        imported++;
      } catch (error: any) {
        failed++;
        errors.push(`Resource ${resource.id}: ${error.message}`);
      }
    });

    return { imported, failed, errors };
  }

  // Validate resource data
  private validateResource(resource: Resource): void {
    if (!resource.id) throw new Error("Resource ID is required");
    if (!resource.title) throw new Error("Resource title is required");
    if (!resource.type) throw new Error("Resource type is required");
    if (!resource.difficulty) throw new Error("Resource difficulty is required");
    if (!resource.topics || resource.topics.length === 0) {
      throw new Error("At least one topic is required");
    }
    if (!resource.keywords || resource.keywords.length === 0) {
      throw new Error("At least one keyword is required");
    }
  }

  // Export resources to JSON
  exportResources(filters?: {
    type?: string;
    topic?: string;
    system?: string;
  }): Resource[] {
    let resources = Array.from(this.resources.values());

    if (filters) {
      if (filters.type) {
        resources = resources.filter(r => r.type === filters.type);
      }
      if (filters.topic) {
        resources = resources.filter(r => r.topics.includes(filters.topic));
      }
      if (filters.system) {
        resources = resources.filter(r => r.systems?.includes(filters.system));
      }
    }

    return resources.map(r => {
      const { searchableText, relevanceScore, usageCount, lastAccessed, ...resource } = r;
      return resource;
    });
  }

  // Get statistics
  getStatistics() {
    const stats = {
      totalResources: this.resources.size,
      byType: {} as Record<string, number>,
      byDifficulty: {} as Record<string, number>,
      topicsCount: this.topicIndex.size,
      diagnosesCount: this.diagnosisIndex.size,
      systemsCount: this.systemIndex.size,
      avgRelevanceScore: 0,
      freeResources: 0,
      paidResources: 0
    };

    let totalRelevance = 0;

    this.resources.forEach(resource => {
      // Type stats
      stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
      
      // Difficulty stats
      stats.byDifficulty[resource.difficulty] = 
        (stats.byDifficulty[resource.difficulty] || 0) + 1;
      
      // Relevance
      totalRelevance += resource.relevanceScore;
      
      // Cost stats
      if (resource.metadata.cost === 'free') {
        stats.freeResources++;
      } else if (resource.metadata.cost === 'paid' || resource.metadata.cost === 'subscription') {
        stats.paidResources++;
      }
    });

    stats.avgRelevanceScore = this.resources.size > 0 
      ? Math.round(totalRelevance / this.resources.size) 
      : 0;

    return stats;
  }
}

// Singleton instance for the application
export const resourceIndexer = new ResourceIndexer();