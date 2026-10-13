import { db } from "./db";
import { 
  documents, 
  documentChunks, 
  ragCitations,
  nursingTopics,
  extractedTables,
  tableCells,
  type DocumentChunk,
  type Document,
  type ChunkSearchResult,
  type RagCitation,
  type InsertRagCitation,
  type ExtractedTable,
  type TableCell
} from "@shared/schema";
import { eq, sql, and, or, desc, asc, inArray, like, ilike } from "drizzle-orm";
import { AIProcessor } from "./ai-processor";
import crypto from "crypto";

// Types for RAG operations
export interface SearchFilters {
  topicIds?: string[];
  documentIds?: string[];
  tags?: string[];
  minScore?: number;
  dateRange?: { start: Date; end: Date };
}

export interface SearchOptions {
  alpha?: number; // Weight for hybrid search (0-1)
  limit?: number;
  offset?: number;
  includeContext?: boolean;
  rerank?: boolean;
  mmr?: boolean;
  mmrLambda?: number; // Diversity factor for MMR (0-1)
}

export interface RagAnswer {
  answer: string;
  citations: CitationReference[];
  relatedTopics: string[];
  confidence: number;
  queryId: string;
  processingTime: number;
}

export interface CitationReference {
  text: string;
  source: {
    documentId: string;
    title: string;
    pageStart: number | null;
    pageEnd: number | null;
    chunkId: string;
  };
  relevance: number;
}

export interface ChunkWithScore extends ChunkSearchResult {
  semanticScore?: number;
  keywordScore?: number;
  hybridScore?: number;
}

export interface TableSearchResult {
  id: string;
  tableIndex: number;
  title: string;
  documentId: string;
  documentTitle?: string;
  pageNumber: number | null;
  rowCount: number;
  columnCount: number;
  extractionConfidence: number;
  tableContent: string; // Concatenated table content for search
  headers: string[];
  createdAt: string;
  score?: number;
  resultType: 'table';
}

export interface TableWithScore extends TableSearchResult {
  semanticScore?: number;
  keywordScore?: number;
  hybridScore?: number;
}

export interface SearchResult extends ChunkWithScore {
  resultType: 'chunk' | 'table';
}

export interface CombinedSearchResult {
  chunks: ChunkWithScore[];
  tables: TableWithScore[];
  total: number;
}

// Cache for frequent queries
const queryCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export class RAGService {
  // ==================== Search Methods ====================
  
  /**
   * Search approved tables using keyword matching
   */
  static async searchTables(
    query: string,
    filters?: SearchFilters,
    limit: number = 10
  ): Promise<TableWithScore[]> {
    try {
      const filterConditions = this.buildFilterConditions(filters, 'table');
      
      // Create a searchable content field from table data
      const tableResults = await db
        .select({
          table: extractedTables,
          document: documents,
          tableContent: sql<string>`
            CONCAT(
              ${extractedTables.title}, ' ',
              array_to_string(${extractedTables.headers}, ' '), ' ',
              COALESCE((
                SELECT string_agg(content, ' ')
                FROM ${tableCells}
                WHERE ${tableCells.tableId} = ${extractedTables.id}
                AND ${tableCells.isHeader} = false
              ), '')
            )
          `.as('tableContent'),
          score: sql<number>`
            ts_rank(
              to_tsvector('english', 
                CONCAT(
                  ${extractedTables.title}, ' ',
                  array_to_string(${extractedTables.headers}, ' '), ' ',
                  COALESCE((
                    SELECT string_agg(content, ' ')
                    FROM ${tableCells}
                    WHERE ${tableCells.tableId} = ${extractedTables.id}
                  ), '')
                )
              ),
              plainto_tsquery('english', ${query})
            )
          `.as('score')
        })
        .from(extractedTables)
        .leftJoin(documents, eq(extractedTables.documentId, documents.id))
        .where(and(
          eq(extractedTables.status, 'approved'), // Only search approved tables
          ...filterConditions,
          sql`
            to_tsvector('english', 
              CONCAT(
                ${extractedTables.title}, ' ',
                array_to_string(${extractedTables.headers}, ' '), ' ',
                COALESCE((
                  SELECT string_agg(content, ' ')
                  FROM ${tableCells}
                  WHERE ${tableCells.tableId} = ${extractedTables.id}
                ), '')
              )
            ) @@ plainto_tsquery('english', ${query})
          `
        ))
        .orderBy(desc(sql`score`))
        .limit(limit);

      return tableResults.map(row => ({
        id: row.table.id,
        tableIndex: row.table.tableIndex,
        title: row.table.title || `Table ${row.table.tableIndex + 1}`,
        documentId: row.table.documentId,
        documentTitle: row.document?.title,
        pageNumber: row.table.pageNumber,
        rowCount: row.table.rowCount,
        columnCount: row.table.columnCount,
        extractionConfidence: parseFloat(row.table.extractionConfidence?.toString() || '0'),
        tableContent: row.tableContent || '',
        headers: row.table.headers || [],
        createdAt: row.table.extractedAt?.toISOString() || '',
        score: row.score,
        keywordScore: row.score,
        resultType: 'table' as const
      }));
    } catch (error) {
      console.error("Table search error:", error);
      return [];
    }
  }

  /**
   * Combined search including both chunks and tables
   */
  static async searchAll(
    query: string,
    filters?: SearchFilters,
    options: SearchOptions = {}
  ): Promise<CombinedSearchResult> {
    const { limit = 10 } = options;
    
    // Search both chunks and tables in parallel
    const [chunkResults, tableResults] = await Promise.all([
      this.hybridSearch(query, filters, { ...options, limit: Math.ceil(limit * 0.7) }),
      this.searchTables(query, filters, Math.ceil(limit * 0.3))
    ]);

    return {
      chunks: chunkResults,
      tables: tableResults,
      total: chunkResults.length + tableResults.length
    };
  }

  /**
   * Semantic search using embeddings
   */
  static async semanticSearch(
    query: string,
    filters?: SearchFilters,
    limit: number = 10
  ): Promise<ChunkWithScore[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await AIProcessor.generateQueryEmbedding(query);
      
      // Build filter conditions
      const filterConditions = this.buildFilterConditions(filters);
      
      // Perform vector similarity search using pgvector cosine distance.
      // embedding column is native vector(1536).
      // The query embedding is passed as a parameterised Drizzle SQL value then cast
      // to vector(1536) — Drizzle's sql tag makes plain JS values into $N params.
      const queryVectorLiteral = `[${queryEmbedding.join(',')}]`;
      const chunks = await db
        .select({
          chunk: documentChunks,
          document: documents,
          score: sql<number>`
            1 - (
              (${queryVectorLiteral}::vector(1536) <=> ${documentChunks.embedding})
            )
          `.as('score')
        })
        .from(documentChunks)
        .leftJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(and(
          ...filterConditions,
          sql`${documentChunks.embedding} IS NOT NULL`
        ))
        .orderBy(desc(sql`score`))
        .limit(limit);

      return chunks.map(row => ({
        ...row.chunk,
        document: row.document || undefined,
        score: row.score,
        semanticScore: row.score
      }));
    } catch (error) {
      console.error("Semantic search error:", error);
      // Fallback to keyword search if embeddings fail
      return this.keywordSearch(query, filters, limit);
    }
  }

  /**
   * Keyword-based search using full-text search
   */
  static async keywordSearch(
    query: string,
    filters?: SearchFilters,
    limit: number = 10
  ): Promise<ChunkWithScore[]> {
    // Extract key phrases for better keyword matching
    const keyPhrases = await AIProcessor.extractKeyPhrases(query);
    const searchTerms = [query, ...keyPhrases].join(" | ");
    
    const filterConditions = this.buildFilterConditions(filters);
    
    // Use PostgreSQL full-text search
    const chunks = await db
      .select({
        chunk: documentChunks,
        document: documents,
        score: sql<number>`
          ts_rank(
            to_tsvector('english', ${documentChunks.cleanText}),
            plainto_tsquery('english', ${searchTerms})
          )
        `.as('score')
      })
      .from(documentChunks)
      .leftJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(
        ...filterConditions,
        sql`
          to_tsvector('english', ${documentChunks.cleanText}) @@ 
          plainto_tsquery('english', ${searchTerms})
        `
      ))
      .orderBy(desc(sql`score`))
      .limit(limit);

    return chunks.map(row => ({
      ...row.chunk,
      document: row.document || undefined,
      score: row.score,
      keywordScore: row.score
    }));
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  static async hybridSearch(
    query: string,
    filters?: SearchFilters,
    options: SearchOptions = {}
  ): Promise<ChunkWithScore[]> {
    const { 
      alpha = 0.7, // Default: 70% semantic, 30% keyword
      limit = 10,
      rerank = true,
      mmr = true,
      mmrLambda = 0.5
    } = options;

    // Check cache
    const cacheKey = `hybrid:${query}:${JSON.stringify(filters)}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    // Perform both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, filters, limit * 2),
      this.keywordSearch(query, filters, limit * 2)
    ]);

    // Combine and score results
    const combinedResults = this.combineSearchResults(
      semanticResults,
      keywordResults,
      alpha
    );

    // Apply re-ranking if requested
    let finalResults = rerank 
      ? await this.rankResults(combinedResults, query)
      : combinedResults;

    // Apply MMR for diversity if requested
    if (mmr && finalResults.length > 0) {
      finalResults = this.applyMMR(finalResults, mmrLambda);
    }

    // Limit results
    finalResults = finalResults.slice(0, limit);

    // Cache the result
    this.cacheResult(cacheKey, finalResults);

    return finalResults;
  }

  /**
   * Search with surrounding context
   */
  static async searchWithContext(
    query: string,
    filters?: SearchFilters,
    contextWindow: number = 2
  ): Promise<ChunkWithScore[]> {
    // Get initial results
    const results = await this.hybridSearch(query, filters);

    // For each result, fetch surrounding chunks
    const resultsWithContext = await Promise.all(
      results.map(async (chunk) => {
        const surroundingChunks = await db
          .select()
          .from(documentChunks)
          .where(and(
            eq(documentChunks.documentId, chunk.documentId),
            sql`ABS(${documentChunks.chunkIndex} - ${chunk.chunkIndex}) <= ${contextWindow}`
          ))
          .orderBy(asc(documentChunks.chunkIndex));

        // Combine surrounding text for context
        const contextText = surroundingChunks
          .map(c => c.cleanText)
          .join("\n\n");

        return {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            contextText,
            contextChunks: surroundingChunks.length
          }
        };
      })
    );

    return resultsWithContext;
  }

  // ==================== Answer Generation ====================

  /**
   * Generate answer with citations
   */
  static async generateAnswer(
    query: string,
    chunks: ChunkWithScore[],
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<RagAnswer> {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();

    try {
      // Prepare context from chunks
      const context = this.prepareContext(chunks);
      
      // Generate answer with citations
      const { answer, citations } = await AIProcessor.generateAnswerWithSources(
        query,
        context,
        options
      );

      // Extract and validate citations
      const citationRefs = await this.extractCitations(answer, chunks);
      
      // Store citations in database
      await this.storeCitations(queryId, chunks, citationRefs);

      // Extract related topics
      const relatedTopics = await this.extractRelatedTopics(chunks);

      // Calculate confidence score
      const confidence = this.calculateConfidence(chunks, citationRefs);

      return {
        answer,
        citations: citationRefs,
        relatedTopics,
        confidence,
        queryId,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error("Error generating answer:", error);
      throw new Error("Failed to generate answer with citations");
    }
  }

  /**
   * Extract citations from answer and map to sources
   */
  static async extractCitations(
    answer: string,
    chunks: ChunkWithScore[]
  ): Promise<CitationReference[]> {
    const citations: CitationReference[] = [];
    
    // Pattern to find quoted text or references like [1], [2], etc.
    const citationPattern = /"([^"]+)"|(?:\[(\d+)\])/g;
    const matches = Array.from(answer.matchAll(citationPattern));

    for (const match of matches) {
      const quotedText = match[1];
      const referenceNumber = match[2];

      if (quotedText) {
        // Find the chunk containing this text
        const sourceChunk = chunks.find(chunk => 
          chunk.cleanText.toLowerCase().includes(quotedText.toLowerCase())
        );

        if (sourceChunk) {
          const document = await this.getDocument(sourceChunk.documentId);
          citations.push({
            text: quotedText,
            source: {
              documentId: sourceChunk.documentId,
              title: document?.title || "Unknown Source",
              pageStart: sourceChunk.pageStart,
              pageEnd: sourceChunk.pageEnd,
              chunkId: sourceChunk.id
            },
            relevance: sourceChunk.score || 0
          });
        }
      } else if (referenceNumber) {
        // Handle numbered references
        const index = parseInt(referenceNumber) - 1;
        if (index >= 0 && index < chunks.length) {
          const sourceChunk = chunks[index];
          const document = await this.getDocument(sourceChunk.documentId);
          citations.push({
            text: `Reference [${referenceNumber}]`,
            source: {
              documentId: sourceChunk.documentId,
              title: document?.title || "Unknown Source",
              pageStart: sourceChunk.pageStart,
              pageEnd: sourceChunk.pageEnd,
              chunkId: sourceChunk.id
            },
            relevance: sourceChunk.score || 0
          });
        }
      }
    }

    return citations;
  }

  /**
   * Format answer with source attributions
   */
  static formatAnswerWithSources(
    answer: string,
    citations: CitationReference[]
  ): string {
    let formattedAnswer = answer;
    
    // Add source references at the end
    if (citations.length > 0) {
      formattedAnswer += "\n\n**Sources:**\n";
      const uniqueSources = new Map<string, CitationReference>();
      
      citations.forEach(citation => {
        uniqueSources.set(citation.source.documentId, citation);
      });

      let sourceIndex = 1;
      uniqueSources.forEach((citation) => {
        const pageInfo = citation.source.pageStart 
          ? `, pages ${citation.source.pageStart}-${citation.source.pageEnd || citation.source.pageStart}`
          : "";
        formattedAnswer += `[${sourceIndex}] ${citation.source.title}${pageInfo}\n`;
        sourceIndex++;
      });
    }

    return formattedAnswer;
  }

  // ==================== Ranking and Filtering ====================

  /**
   * Re-rank results using cross-encoder or additional scoring
   */
  static async rankResults(
    chunks: ChunkWithScore[],
    query: string
  ): Promise<ChunkWithScore[]> {
    // Use AI to score relevance more accurately
    const rankedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const relevanceScore = await AIProcessor.scoreRelevance(
          query,
          chunk.cleanText
        );
        return {
          ...chunk,
          score: relevanceScore
        };
      })
    );

    // Sort by new relevance scores
    return rankedChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Apply Maximum Marginal Relevance for diversity
   */
  static applyMMR(
    chunks: ChunkWithScore[],
    lambda: number = 0.5
  ): ChunkWithScore[] {
    if (chunks.length <= 1) return chunks;

    const selected: ChunkWithScore[] = [];
    const remaining = [...chunks];
    
    // Start with the highest scoring chunk
    selected.push(remaining.shift()!);

    while (remaining.length > 0 && selected.length < chunks.length) {
      let bestScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        
        // Calculate relevance score
        const relevance = candidate.score || 0;
        
        // Calculate similarity to already selected chunks
        let maxSimilarity = 0;
        for (const selectedChunk of selected) {
          const similarity = this.calculateTextSimilarity(
            candidate.cleanText,
            selectedChunk.cleanText
          );
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // MMR score = λ * relevance - (1 - λ) * maxSimilarity
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected.push(remaining.splice(bestIndex, 1)[0]);
      } else {
        break;
      }
    }

    return selected;
  }

  /**
   * Filter chunks by nursing topics
   */
  static async filterByTopics(
    chunks: ChunkWithScore[],
    topicIds: string[]
  ): Promise<ChunkWithScore[]> {
    return chunks.filter(chunk => {
      const chunkTopics = chunk.topicIds || [];
      return topicIds.some(topicId => chunkTopics.includes(topicId));
    });
  }

  // ==================== Helper Methods ====================

  private static buildFilterConditions(filters?: SearchFilters, searchType: 'chunk' | 'table' = 'chunk') {
    const conditions = [];

    if (searchType === 'chunk') {
      if (filters?.topicIds && filters.topicIds.length > 0) {
        conditions.push(
          sql`${documentChunks.topicIds} && ARRAY[${sql.join(filters.topicIds, sql`, `)}]::text[]`
        );
      }

      if (filters?.documentIds && filters.documentIds.length > 0) {
        conditions.push(inArray(documentChunks.documentId, filters.documentIds));
      }
    } else if (searchType === 'table') {
      if (filters?.documentIds && filters.documentIds.length > 0) {
        conditions.push(inArray(extractedTables.documentId, filters.documentIds));
      }
      
      // Add table-specific filters
      if (filters?.minScore) {
        conditions.push(sql`${extractedTables.extractionConfidence} >= ${filters.minScore}`);
      }
    }

    if (filters?.tags && filters.tags.length > 0) {
      conditions.push(
        sql`${documentChunks.tags} && ARRAY[${sql.join(filters.tags, sql`, `)}]::text[]`
      );
    }

    return conditions;
  }

  private static combineSearchResults(
    semanticResults: ChunkWithScore[],
    keywordResults: ChunkWithScore[],
    alpha: number
  ): ChunkWithScore[] {
    const combinedMap = new Map<string, ChunkWithScore>();

    // Add semantic results
    semanticResults.forEach(chunk => {
      combinedMap.set(chunk.id, {
        ...chunk,
        hybridScore: alpha * (chunk.semanticScore || 0)
      });
    });

    // Add or update with keyword results
    keywordResults.forEach(chunk => {
      const existing = combinedMap.get(chunk.id);
      if (existing) {
        existing.hybridScore! += (1 - alpha) * (chunk.keywordScore || 0);
        existing.keywordScore = chunk.keywordScore;
      } else {
        combinedMap.set(chunk.id, {
          ...chunk,
          hybridScore: (1 - alpha) * (chunk.keywordScore || 0)
        });
      }
    });

    // Convert to array and sort by hybrid score
    return Array.from(combinedMap.values())
      .sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));
  }

  private static prepareContext(chunks: ChunkWithScore[]): string {
    return chunks
      .map((chunk, index) => 
        `[${index + 1}] ${chunk.cleanText}\n(Source: Document ${chunk.documentId}, Pages ${chunk.pageStart || 'N/A'}-${chunk.pageEnd || 'N/A'})`
      )
      .join("\n\n");
  }

  private static async storeCitations(
    queryId: string,
    chunks: ChunkWithScore[],
    citations: CitationReference[]
  ): Promise<void> {
    const citationRecords: (typeof ragCitations.$inferInsert)[] = [];

    for (const chunk of chunks) {
      const wasUsed = citations.some(c => c.source.chunkId === chunk.id);
      citationRecords.push({
        queryId,
        chunkId: chunk.id,
        relevanceScore: chunk.score?.toString() || "0",
        usedInAnswer: wasUsed,
        metadata: {
          searchMethod: chunk.semanticScore && chunk.keywordScore ? 'hybrid' :
                       chunk.semanticScore ? 'vector' : 'keyword',
          rankPosition: chunks.indexOf(chunk) + 1
        }
      });
    }

    if (citationRecords.length > 0) {
      await db.insert(ragCitations).values(citationRecords);
    }
  }

  private static async extractRelatedTopics(
    chunks: ChunkWithScore[]
  ): Promise<string[]> {
    const topicIds = new Set<string>();
    
    chunks.forEach(chunk => {
      (chunk.topicIds || []).forEach(id => topicIds.add(id));
    });

    if (topicIds.size === 0) return [];

    const topics = await db
      .select({ name: nursingTopics.name })
      .from(nursingTopics)
      .where(inArray(nursingTopics.id, Array.from(topicIds)))
      .limit(5);

    return topics.map(t => t.name);
  }

  private static calculateConfidence(
    chunks: ChunkWithScore[],
    citations: CitationReference[]
  ): number {
    if (chunks.length === 0) return 0;

    // Factors for confidence calculation
    const avgScore = chunks.reduce((sum, c) => sum + (c.score || 0), 0) / chunks.length;
    const citationRatio = citations.length / Math.min(chunks.length, 5);
    const topChunkScore = chunks[0]?.score || 0;

    // Weighted confidence score
    const confidence = (
      avgScore * 0.3 +
      citationRatio * 0.3 +
      topChunkScore * 0.4
    );

    return Math.min(Math.max(confidence, 0), 1);
  }

  private static calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for text comparison
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private static async getDocument(documentId: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    
    return result[0];
  }

  private static getCachedResult(key: string): any {
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }
    return null;
  }

  private static cacheResult(key: string, result: any): void {
    // Limit cache size
    if (queryCache.size > 100) {
      const firstKey = queryCache.keys().next().value;
      if (firstKey) {
        queryCache.delete(firstKey);
      }
    }
    queryCache.set(key, { result, timestamp: Date.now() });
  }

  // ==================== Public API Methods ====================

  /**
   * Find related chunks to a given chunk
   */
  static async findRelatedChunks(
    chunkId: string,
    limit: number = 5
  ): Promise<ChunkWithScore[]> {
    // Get the source chunk
    const sourceChunk = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.id, chunkId))
      .limit(1);

    if (sourceChunk.length === 0) {
      throw new Error("Chunk not found");
    }

    const chunk = sourceChunk[0];

    // Find similar chunks by topics and tags
    const relatedChunks = await db
      .select({
        chunk: documentChunks,
        document: documents
      })
      .from(documentChunks)
      .leftJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(
        sql`${documentChunks.id} != ${chunkId}`,
        or(
          sql`${documentChunks.topicIds} && ${chunk.topicIds}::text[]`,
          sql`${documentChunks.tags} && ${chunk.tags}::text[]`
        )
      ))
      .limit(limit);

    return relatedChunks.map(row => ({
      ...row.chunk,
      document: row.document || undefined,
      score: 0.8 // Default relevance for related chunks
    }));
  }

  /**
   * Explain a concept using the knowledge base
   */
  static async explainConcept(
    concept: string,
    targetAudience: 'student' | 'professional' = 'student'
  ): Promise<RagAnswer> {
    // Search for relevant chunks
    const chunks = await this.hybridSearch(
      `explain ${concept} nursing medical`,
      undefined,
      { limit: 5 }
    );

    // Generate explanation
    const query = targetAudience === 'student' 
      ? `Explain ${concept} in simple terms for a nursing student`
      : `Provide a comprehensive explanation of ${concept} for healthcare professionals`;

    return this.generateAnswer(query, chunks);
  }
}