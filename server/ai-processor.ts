import OpenAI from "openai";
import { db } from "./db";
import { nursingTopics, topicsNeedingResources, assessmentReports } from "@shared/schema";
import { eq, like, and } from "drizzle-orm";
import * as crypto from "crypto";

// Initialize OpenAI client with error handling
if (!process.env.OPENAI_API_KEY) {
  console.error('Warning: OPENAI_API_KEY not configured - AI features will be disabled');
}
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ExtractedTopic {
  name: string;
  category: string;
  system?: string;
  subject?: string;
  concepts: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  keywords: string[];
  description?: string;
  learningObjectives?: string[];
}

export interface ProcessingResult {
  success: boolean;
  extractedTopics: ExtractedTopic[];
  suggestedResources: any[];
  errors?: string[];
  processingTime: number;
}

export interface ResourceRecommendation {
  type: string;
  quantity: number;
  priority: number;
  reasoning: string;
  estimatedCost?: 'low' | 'medium' | 'high';
  timeToCreate?: number; // hours
}

// RAG-specific types
export interface AnswerGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  includeExplanation?: boolean;
  targetAudience?: 'student' | 'professional' | 'general';
}

export interface ConceptExplanation {
  concept: string;
  definition: string;
  clinicalRelevance: string;
  keyPoints: string[];
  examples: string[];
  relatedConcepts: string[];
}

export interface AllocationPlanDetails {
  topicId: string;
  topicName: string;
  recommendations: ResourceRecommendation[];
  justification: string;
  expectedImpact: string;
  dependencies?: string[];
}

export class AIProcessor {
  // ==================== RAG-specific Methods ====================
  
  /**
   * Generate embedding for a search query
   */
  static async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - embedding generation unavailable');
    }

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating query embedding:", error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  static async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - embedding generation unavailable');
    }

    try {
      // Process in batches of 100 to avoid rate limits
      const batchSize = 100;
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batch,
        });

        embeddings.push(...response.data.map(d => d.embedding));
      }

      return embeddings;
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate answer with source grounding
   */
  static async generateAnswerWithSources(
    query: string,
    context: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<{ answer: string; citations: string[] }> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - answer generation unavailable');
    }

    const { maxTokens = 500, temperature = 0.3 } = options;

    try {
      const systemPrompt = `You are a knowledgeable nursing education assistant that provides accurate, evidence-based answers.
      
Rules:
      1. Base your answer ONLY on the provided context
      2. Include direct quotes or references using [1], [2], etc. notation
      3. If the context doesn't contain relevant information, say so
      4. Be concise but comprehensive
      5. Use medical terminology appropriately for nursing students
      6. Highlight key concepts and clinical implications`;

      const userPrompt = `Context:
${context}

Question: ${query}

Provide a comprehensive answer with numbered citations to the context above.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature,
      });

      const answer = response.choices[0].message.content || "";
      
      // Extract citation references from the answer
      const citationPattern = /\[(\d+)\]/g;
      const citations = Array.from(answer.matchAll(citationPattern))
        .map(match => match[0]);

      return { answer, citations: [...new Set(citations)] };
    } catch (error) {
      console.error("Error generating answer with sources:", error);
      throw new Error(`Failed to generate answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract key phrases from a query for keyword search
   */
  static async extractKeyPhrases(query: string): Promise<string[]> {
    if (!openai) {
      // Fallback to simple extraction
      return query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Extract key medical and nursing terms from the query. Return only the most important keywords and phrases as a JSON array."
          },
          {
            role: "user",
            content: query
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 100,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.keywords || [];
    } catch (error) {
      console.error("Error extracting key phrases:", error);
      // Fallback to simple extraction
      return query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
    }
  }

  /**
   * Score relevance between query and text
   */
  static async scoreRelevance(query: string, text: string): Promise<number> {
    if (!openai) {
      // Simple fallback scoring based on keyword overlap
      const queryWords = new Set(query.toLowerCase().split(/\s+/));
      const textWords = new Set(text.toLowerCase().split(/\s+/));
      const overlap = [...queryWords].filter(w => textWords.has(w)).length;
      return Math.min(overlap / queryWords.size, 1);
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Score the relevance of the text to the query on a scale of 0 to 1. Return only a JSON object with a 'score' field."
          },
          {
            role: "user",
            content: `Query: ${query}\n\nText: ${text.substring(0, 500)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 20,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.score || 0;
    } catch (error) {
      console.error("Error scoring relevance:", error);
      return 0;
    }
  }

  /**
   * Generate a study guide from search results
   */
  static async generateStudyGuideFromRAG(
    topic: string,
    context: string,
    level: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<string> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - study guide generation unavailable');
    }

    try {
      const systemPrompt = `You are an expert nursing educator creating comprehensive study guides.
      
Create a study guide that includes:
      1. Learning objectives
      2. Key concepts and definitions
      3. Clinical applications
      4. Practice questions
      5. Summary points
      
Adapt the content for ${level} level nursing students.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a study guide for: ${topic}\n\nUsing this information:\n${context}` }
        ],
        max_tokens: 1500,
        temperature: 0.4,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Error generating study guide:", error);
      throw new Error(`Failed to generate study guide: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Summarize multiple chunks into a coherent overview
   */
  static async summarizeChunks(
    chunks: string[],
    maxLength: number = 500
  ): Promise<string> {
    if (!openai) {
      // Simple concatenation fallback
      return chunks.join("\n\n").substring(0, maxLength);
    }

    try {
      const combinedText = chunks.join("\n\n---\n\n");
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Summarize the following nursing education content into a coherent, comprehensive overview. Maintain medical accuracy and include key points."
          },
          {
            role: "user",
            content: combinedText.substring(0, 8000) // Limit input length
          }
        ],
        max_tokens: Math.min(maxLength, 1000),
        temperature: 0.3,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Error summarizing chunks:", error);
      return chunks.join("\n\n").substring(0, maxLength);
    }
  }
  // Generate resource recommendations for topic gaps
  static async generateResourceRecommendations(
    topicName: string,
    neededTypes: string[],
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<ResourceRecommendation[]> {
    if (!openai) {
      // Return default recommendations if OpenAI is not available
      return neededTypes.map(type => ({
        type,
        quantity: priority === 'critical' ? 3 : priority === 'high' ? 2 : 1,
        priority: priority === 'critical' ? 5 : priority === 'high' ? 4 : 3,
        reasoning: `${type} resources needed for ${topicName} based on ${priority} priority`,
        estimatedCost: 'medium',
        timeToCreate: type === 'video' ? 4 : type === 'simulation' ? 6 : 2
      }));
    }

    try {
      const prompt = `Generate specific resource recommendations for the nursing topic: "${topicName}".
      Priority level: ${priority}
      Resource types needed: ${neededTypes.join(', ')}
      
      For each resource type, provide:
      1. Quantity needed (1-5)
      2. Priority score (1-5)
      3. Reasoning for this recommendation
      4. Estimated cost (low/medium/high)
      5. Time to create (hours)
      
      Consider:
      - Topic complexity
      - Student learning styles
      - NCLEX preparation requirements
      - Clinical application needs
      
      Return as JSON array of resource recommendations.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert nursing education resource planner specializing in curriculum development and learning material allocation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.recommendations || [];
    } catch (error) {
      console.error("Error generating resource recommendations:", error);
      // Return basic recommendations as fallback
      return neededTypes.map(type => ({
        type,
        quantity: 1,
        priority: 3,
        reasoning: `Standard ${type} resource for ${topicName}`,
        estimatedCost: 'medium',
        timeToCreate: 3
      }));
    }
  }

  // Generate comprehensive resource allocation plan
  static async generateResourceAllocationPlan(
    topics: { id: string; name: string; gapScore: number; demandScore: number }[],
    budget?: 'low' | 'medium' | 'high',
    timeframe?: number // days
  ): Promise<AllocationPlanDetails[]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - AI features are disabled');
    }

    try {
      const prompt = `Create a comprehensive resource allocation plan for nursing education topics.
      
      Topics requiring resources:
      ${JSON.stringify(topics, null, 2)}
      
      Budget constraint: ${budget || 'flexible'}
      Timeframe: ${timeframe || 30} days
      
      For each topic, provide:
      1. Specific resource recommendations
      2. Justification based on demand and gap scores
      3. Expected impact on student outcomes
      4. Any dependencies or prerequisites
      
      Prioritize based on:
      - Gap score (resource shortage)
      - Demand score (student need)
      - NCLEX relevance
      - Clinical importance
      
      Return as JSON with detailed allocation plans.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a nursing education resource allocation expert with deep knowledge of NCLEX preparation and clinical training needs."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.allocationPlans || [];
    } catch (error) {
      console.error("Error generating allocation plan:", error);
      throw new Error(`Failed to generate allocation plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  // Extract topics from unstructured text using GPT-5
  static async extractTopicsFromText(text: string): Promise<ExtractedTopic[]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - AI features are disabled');
    }
    
    try {
      const prompt = `Analyze this nursing assessment report and extract all nursing topics mentioned. 
      For each topic, provide:
      1. Topic name (standardized)
      2. Category (Management of Care, Safety, Basic Care, Pharmacological Therapies, etc.)
      3. Body system if applicable (Cardiovascular, Respiratory, etc.)
      4. Subject area (Medical-Surgical, Pediatrics, Mental Health, etc.)
      5. Key concepts covered
      6. Difficulty level (beginner, intermediate, advanced)
      7. Keywords for searching
      8. Brief description
      9. Learning objectives

      Respond with a JSON array of topic objects.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert nursing educator specializing in NCLEX content analysis and topic extraction. Always provide structured, accurate educational content mapping."
          },
          {
            role: "user",
            content: `${prompt}\n\nText to analyze:\n${text.substring(0, 4000)}` // Limit text length
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more consistent extraction
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.topics || [];
    } catch (error) {
      console.error("Error extracting topics:", error);
      throw new Error(`Failed to extract topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Identify knowledge gaps from assessment data
  static async identifyKnowledgeGaps(
    reportText: string,
    performanceData?: any
  ): Promise<{ gaps: string[], recommendations: string[] }> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - AI features are disabled');
    }
    
    try {
      const prompt = `Analyze this nursing assessment report to identify knowledge gaps and areas needing improvement.
      Provide:
      1. Specific knowledge gaps identified
      2. Recommendations for addressing each gap
      3. Priority level for each gap

      Focus on NCLEX content areas and clinical judgment skills.
      Respond in JSON format with 'gaps' and 'recommendations' arrays.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert nursing educator analyzing student performance to identify learning needs."
          },
          {
            role: "user",
            content: `${prompt}\n\nReport:\n${reportText.substring(0, 4000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        gaps: result.gaps || [],
        recommendations: result.recommendations || []
      };
    } catch (error) {
      console.error("Error identifying gaps:", error);
      throw new Error(`Failed to identify knowledge gaps: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Clean and normalize topic names
  static async normalizeTopicNames(topics: string[]): Promise<Map<string, string>> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - AI features are disabled');
    }
    
    try {
      const prompt = `Normalize and standardize these nursing topic names to match NCLEX content taxonomy.
      For each topic, provide the standardized name that would be used in official nursing education materials.
      Maintain consistency with NCSBN Clinical Judgment Measurement Model.
      
      Topics to normalize: ${JSON.stringify(topics)}
      
      Respond with JSON object mapping original names to normalized names.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a nursing education taxonomy expert. Standardize topic names to match official NCLEX and nursing education naming conventions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Very low temperature for consistency
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return new Map(Object.entries(result.mappings || {}));
    } catch (error) {
      console.error("Error normalizing topics:", error);
      throw new Error(`Failed to normalize topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate topic descriptions and learning objectives
  static async generateTopicMetadata(topicName: string): Promise<{
    description: string;
    learningObjectives: string[];
    keywords: string[];
    relatedTopics: string[];
  }> {
    if (!openai) {
      return {
        description: "",
        learningObjectives: [],
        keywords: [],
        relatedTopics: []
      };
    }
    
    try {
      const prompt = `For the nursing topic "${topicName}", generate:
      1. A comprehensive description (2-3 sentences)
      2. 3-5 specific learning objectives (using Bloom's taxonomy action verbs)
      3. 5-8 relevant keywords for searching
      4. 3-5 related topics that students should also study

      Format as JSON with keys: description, learningObjectives, keywords, relatedTopics`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a nursing curriculum developer creating comprehensive educational content metadata."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        description: result.description || "",
        learningObjectives: result.learningObjectives || [],
        keywords: result.keywords || [],
        relatedTopics: result.relatedTopics || []
      };
    } catch (error) {
      console.error("Error generating metadata:", error);
      return {
        description: "",
        learningObjectives: [],
        keywords: [],
        relatedTopics: []
      };
    }
  }

  // Suggest resource mappings for topics
  static async suggestResourceMappings(
    topicName: string,
    existingResources: any[]
  ): Promise<{ suggestedResources: any[], rationale: string[] }> {
    if (!openai) {
      return { suggestedResources: [], rationale: [] };
    }
    
    try {
      const prompt = `Given the nursing topic "${topicName}" and these available resources:
      ${JSON.stringify(existingResources.slice(0, 10).map(r => ({ title: r.title, type: r.type })))}
      
      Suggest which resources would be most appropriate for learning this topic.
      Provide rationale for each suggestion.
      
      Respond with JSON containing 'suggestedResources' (array of resource titles) and 'rationale' (array of explanations).`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a nursing education specialist matching learning resources to topics based on pedagogical best practices."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        suggestedResources: result.suggestedResources || [],
        rationale: result.rationale || []
      };
    } catch (error) {
      console.error("Error suggesting resources:", error);
      return { suggestedResources: [], rationale: [] };
    }
  }
  
  // Suggest new resources for a specific topic
  static async suggestResourcesForTopic(
    topicName: string, 
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
    count: number = 5
  ): Promise<{
    id?: string;
    title: string;
    type: 'video' | 'article' | 'practice' | 'textbook' | 'quiz' | 'simulation';
    description: string;
    url?: string;
    duration?: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    provider?: string;
    confidence: number;
    keywords: string[];
  }[]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized - AI features are disabled');
    }
    
    try {
      const prompt = `Generate ${count} high-quality learning resources for the nursing topic "${topicName}" at the ${difficulty} level.
      
      For each resource, provide:
      1. Title - Clear, descriptive title
      2. Type - One of: video, article, practice, textbook, quiz, simulation
      3. Description - 2-3 sentences explaining what the resource covers
      4. URL - Realistic educational URL pattern (use reputable nursing education sites like RegisteredNursing.org, NursingWorld.org, Khan Academy, etc.)
      5. Duration - Estimated time in minutes to complete (15-120 minutes)
      6. Provider - Name of educational institution or platform
      7. Keywords - 3-5 relevant search terms
      8. Confidence - AI confidence score for resource quality (0.7-1.0)
      
      Focus on:
      - NCLEX-RN preparation materials
      - Evidence-based nursing practice resources
      - Clinical judgment and critical thinking materials
      - Resources from reputable nursing education sources
      - Mix of different resource types
      
      Respond with JSON array of resource objects.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a nursing education specialist who recommends high-quality, evidence-based learning resources for nursing students. Always suggest real, practical resources that would be found in nursing education programs."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      const resources = result.resources || [];
      
      // Ensure all resources have the specified difficulty
      return resources.map((r: any) => ({
        title: r.title,
        type: r.type,
        description: r.description,
        url: r.url,
        duration: r.duration,
        difficulty: difficulty,
        provider: r.provider,
        confidence: r.confidence || 0.85,
        keywords: r.keywords || [],
      }));
    } catch (error) {
      console.error("Error suggesting resources:", error);
      throw new Error(`Failed to suggest resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process bulk PDF content
  static async processBulkContent(
    documents: { filename: string; content: string }[]
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const allTopics: ExtractedTopic[] = [];
    const errors: string[] = [];

    try {
      // Process each document
      for (const doc of documents) {
        try {
          const topics = await this.extractTopicsFromText(doc.content);
          allTopics.push(...topics);
        } catch (error) {
          errors.push(`Failed to process ${doc.filename}: ${error}`);
        }
      }

      // Deduplicate and normalize topics
      const uniqueTopics = this.deduplicateTopics(allTopics);
      
      // Store topics in database
      await this.storeExtractedTopics(uniqueTopics);

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        extractedTopics: uniqueTopics,
        suggestedResources: [],
        errors: errors.length > 0 ? errors : undefined,
        processingTime
      };
    } catch (error) {
      return {
        success: false,
        extractedTopics: [],
        suggestedResources: [],
        errors: [`Processing failed: ${error}`],
        processingTime: Date.now() - startTime
      };
    }
  }

  // Deduplicate topics based on similarity
  private static deduplicateTopics(topics: ExtractedTopic[]): ExtractedTopic[] {
    const uniqueMap = new Map<string, ExtractedTopic>();
    
    for (const topic of topics) {
      const key = topic.name.toLowerCase().replace(/\s+/g, "-");
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, topic);
      } else {
        // Merge keywords and concepts if duplicate found
        const existing = uniqueMap.get(key)!;
        existing.keywords = Array.from(new Set([...existing.keywords, ...topic.keywords]));
        existing.concepts = Array.from(new Set([...existing.concepts, ...topic.concepts]));
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  // Store extracted topics in database
  private static async storeExtractedTopics(topics: ExtractedTopic[]): Promise<void> {
    for (const topic of topics) {
      try {
        // Check if topic already exists
        const existing = await db.query.nursingTopics.findFirst({
          where: like(nursingTopics.name, `%${topic.name}%`)
        });

        if (!existing) {
          // Create new topic
          await db.insert(nursingTopics).values({
            name: topic.name,
            description: topic.description,
            subject: topic.subject,
            system: topic.system,
            keywords: topic.keywords,
            learningObjectives: topic.learningObjectives,
            clinicalConcepts: topic.concepts,
            frequency: 1
          });
        } else {
          // Update existing topic frequency
          await db.update(nursingTopics)
            .set({ 
              frequency: (existing.frequency || 0) + 1,
              lastSeen: new Date()
            })
            .where(eq(nursingTopics.id, existing.id));
        }
      } catch (error) {
        console.error(`Failed to store topic ${topic.name}:`, error);
      }
    }
  }

  // Analyze text for quality and completeness
  static async analyzeContentQuality(text: string): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    if (!openai) {
      return {
        score: 0,
        issues: ["AI analysis unavailable"],
        suggestions: []
      };
    }
    
    try {
      const prompt = `Analyze this nursing education content for quality and completeness.
      Evaluate:
      1. Accuracy of medical/nursing information
      2. Completeness of topic coverage
      3. Clarity and educational value
      4. Alignment with NCLEX standards
      
      Provide a quality score (0-100), list of issues, and improvement suggestions.
      
      Content: ${text.substring(0, 3000)}
      
      Respond in JSON format with keys: score, issues, suggestions`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a nursing education quality assurance expert evaluating educational content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        score: result.score || 0,
        issues: result.issues || [],
        suggestions: result.suggestions || []
      };
    } catch (error) {
      console.error("Error analyzing quality:", error);
      return {
        score: 0,
        issues: ["Analysis failed"],
        suggestions: []
      };
    }
  }

  /**
   * Generate embeddings for text using OpenAI
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!openai) {
      // Return mock embeddings if OpenAI is not available
      return texts.map(() => this.generateMockEmbedding());
    }
    
    const embeddings: number[][] = [];
    const embeddingCache = new Map<string, number[]>();
    
    try {
      // Process in batches of 20 (OpenAI limit)
      const batchSize = 20;
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings: number[][] = [];
        
        // Check cache for each text in batch
        const uncachedTexts: string[] = [];
        const uncachedIndices: number[] = [];
        
        for (let j = 0; j < batch.length; j++) {
          const hash = crypto.createHash('sha256').update(batch[j]).digest('hex');
          const cached = embeddingCache.get(hash);
          
          if (cached) {
            batchEmbeddings[j] = cached;
          } else {
            uncachedTexts.push(batch[j]);
            uncachedIndices.push(j);
          }
        }
        
        // Generate embeddings for uncached texts
        if (uncachedTexts.length > 0) {
          try {
            const response = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: uncachedTexts,
            });
            
            // Add to batch and cache
            for (let k = 0; k < response.data.length; k++) {
              const embedding = response.data[k].embedding;
              const textIndex = uncachedIndices[k];
              const text = uncachedTexts[k];
              const hash = crypto.createHash('sha256').update(text).digest('hex');
              
              batchEmbeddings[textIndex] = embedding;
              embeddingCache.set(hash, embedding);
            }
          } catch (error) {
            console.error(`Error generating embeddings for batch ${i}:`, error);
            
            // Fallback to mock embeddings for failed items
            for (const idx of uncachedIndices) {
              if (!batchEmbeddings[idx]) {
                batchEmbeddings[idx] = this.generateMockEmbedding();
              }
            }
          }
        }
        
        // Add batch embeddings to results
        embeddings.push(...batchEmbeddings);
        
        // Rate limiting - wait between batches
        if (i + batchSize < texts.length) {
          await this.sleep(100); // 100ms delay between batches
        }
      }
      
      return embeddings;
    } catch (error) {
      console.error("Error in embedding generation:", error);
      // Return mock embeddings as fallback
      return texts.map(() => this.generateMockEmbedding());
    }
  }

  /**
   * Generate a mock embedding vector for fallback
   */
  private static generateMockEmbedding(): number[] {
    // Generate a 1536-dimensional vector (text-embedding-3-small dimension)
    const dimension = 1536;
    const embedding: number[] = [];
    
    for (let i = 0; i < dimension; i++) {
      // Generate normalized random values
      embedding.push((Math.random() - 0.5) * 0.1);
    }
    
    return embedding;
  }

  /**
   * Helper function for rate limiting
   */
  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AIProcessor;