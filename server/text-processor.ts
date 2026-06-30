import { db } from "./db";
import { nursingTopics } from "@shared/schema";
import { like, or } from "drizzle-orm";
import * as crypto from "crypto";

export interface ExtractedHeading {
  level: number;
  text: string;
  path: string[];
  position: number;
}

export interface ExtractedMetadata {
  dates?: string[];
  references?: string[];
  objectives?: string[];
  keywords?: string[];
  summary?: string;
  pageCount?: number;
  slideCount?: number;
  pdfInfo?: any;
  [key: string]: any;
}

export interface TextChunk {
  content: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  headingPath?: string[];
  pageNumber?: number;
  metadata?: Record<string, any>;
}

export class TextProcessor {
  /**
   * Clean and normalize text
   */
  static cleanText(text: string): string {
    if (!text) return '';
    
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove non-printable characters
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Normalize line breaks
      .replace(/\r\n|\r/g, '\n')
      // Remove multiple consecutive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  /**
   * Extract headings and build hierarchy
   */
  static extractHeadings(text: string): ExtractedHeading[] {
    const headings: ExtractedHeading[] = [];
    const lines = text.split('\n');
    const currentPath: string[] = [];
    
    // Common heading patterns
    const patterns = [
      { regex: /^#\s+(.+)/, level: 1 },
      { regex: /^##\s+(.+)/, level: 2 },
      { regex: /^###\s+(.+)/, level: 3 },
      { regex: /^####\s+(.+)/, level: 4 },
      { regex: /^[A-Z][A-Z\s]+:/, level: 2 }, // ALL CAPS headings
      { regex: /^\d+\.\s+[A-Z]/, level: 2 }, // Numbered sections
      { regex: /^[A-Za-z]+:$/, level: 3 }, // Single word with colon
    ];
    
    let position = 0;
    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const headingText = match[1] || match[0];
          
          // Update path based on heading level
          while (currentPath.length >= pattern.level) {
            currentPath.pop();
          }
          currentPath.push(headingText);
          
          headings.push({
            level: pattern.level,
            text: headingText,
            path: [...currentPath],
            position
          });
          break;
        }
      }
      position += line.length + 1; // +1 for newline
    }
    
    return headings;
  }

  /**
   * Count tokens (approximate using GPT-3 tokenization rules)
   */
  static tokenCount(text: string): number {
    if (!text) return 0;
    
    // Approximate token count (GPT-3/4 tokenization)
    // Average is ~1 token per 4 characters or 0.75 tokens per word
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;
    
    // Use weighted average for better approximation
    const tokensByWords = wordCount * 0.75;
    const tokensByChars = charCount / 4;
    
    return Math.ceil((tokensByWords + tokensByChars) / 2);
  }

  /**
   * Extract metadata from text
   */
  static extractMetadata(text: string): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};
    
    // Extract dates (various formats)
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g, // MM/DD/YYYY
      /\d{4}-\d{2}-\d{2}/g, // YYYY-MM-DD
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}/gi,
    ];
    
    const dates = new Set<string>();
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(date => dates.add(date));
      }
    }
    if (dates.size > 0) {
      metadata.dates = Array.from(dates);
    }
    
    // Extract references (citations, DOIs, etc.)
    const refPatterns = [
      /\b(?:DOI|doi):\s*[\S]+/g,
      /\[[0-9]+\]/g, // Numbered references
      /\([A-Za-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)/g, // Author citations
    ];
    
    const references = new Set<string>();
    for (const pattern of refPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(ref => references.add(ref));
      }
    }
    if (references.size > 0) {
      metadata.references = Array.from(references);
    }
    
    // Extract learning objectives
    const objectivePatterns = [
      /(?:Learning Objectives?|Objectives?|Goals?):\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gi,
      /(?:By the end|After completing|Students will)(?:\s+be able to)?\s*:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/gi,
    ];
    
    const objectives: string[] = [];
    for (const pattern of objectivePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const objText = match[1].trim();
        // Split by bullets or numbers
        const items = objText.split(/[\n•·\-\*]|\d+\./);
        items.forEach(item => {
          const cleaned = item.trim();
          if (cleaned.length > 10) {
            objectives.push(cleaned);
          }
        });
      }
    }
    if (objectives.length > 0) {
      metadata.objectives = objectives;
    }
    
    // Extract keywords (capitalized phrases, repeated terms)
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    for (const word of words) {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      if (cleaned.length > 4) { // Skip short words
        wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
      }
    }
    
    // Get frequently mentioned words (appearing 3+ times)
    const keywords = Array.from(wordFreq.entries())
      .filter(([word, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
    
    if (keywords.length > 0) {
      metadata.keywords = keywords;
    }
    
    // Generate summary (first meaningful paragraph)
    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      const cleaned = para.trim();
      if (cleaned.length > 100 && cleaned.length < 500) {
        metadata.summary = cleaned;
        break;
      }
    }
    
    return metadata;
  }

  /**
   * Detect nursing topics in text
   */
  static async detectTopics(text: string): Promise<string[]> {
    if (!text) return [];
    
    const lowerText = text.toLowerCase();
    const detectedTopics = new Set<string>();
    
    try {
      // Get all nursing topics from database
      const topics = await db.select().from(nursingTopics);
      
      for (const topic of topics) {
        // Check if topic name appears in text
        if (lowerText.includes(topic.name.toLowerCase())) {
          detectedTopics.add(topic.id);
          continue;
        }
        
        // Check keywords
        if (topic.keywords && topic.keywords.length > 0) {
          for (const keyword of topic.keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
              detectedTopics.add(topic.id);
              break;
            }
          }
        }
        
        // Check description
        if (topic.description) {
          const descWords = topic.description.toLowerCase().split(/\s+/);
          let matchCount = 0;
          for (const word of descWords) {
            if (word.length > 4 && lowerText.includes(word)) {
              matchCount++;
            }
          }
          // If significant portion of description words match
          if (matchCount >= descWords.length * 0.3) {
            detectedTopics.add(topic.id);
          }
        }
      }
    } catch (error) {
      console.error("Error detecting topics:", error);
    }
    
    return Array.from(detectedTopics);
  }

  /**
   * Smart text chunking with overlap
   */
  static chunkText(
    text: string,
    options: {
      minTokens?: number;
      maxTokens?: number;
      overlapTokens?: number;
      preserveStructure?: boolean;
      headings?: ExtractedHeading[];
    } = {}
  ): TextChunk[] {
    const {
      minTokens = 800,
      maxTokens = 1200,
      overlapTokens = 120, // ~10% of max
      preserveStructure = true,
      headings = []
    } = options;
    
    const chunks: TextChunk[] = [];
    
    if (preserveStructure && headings.length > 0) {
      // Structure-aware chunking
      let currentChunk = '';
      let currentTokens = 0;
      let chunkStartIndex = 0;
      let currentHeadingPath: string[] = [];
      
      const lines = text.split('\n');
      let position = 0;
      
      for (const line of lines) {
        const lineTokens = this.tokenCount(line);
        
        // Check if this line is a heading
        const heading = headings.find(h => 
          Math.abs(h.position - position) < 5
        );
        
        if (heading) {
          // If adding this would exceed max, save current chunk
          if (currentTokens + lineTokens > maxTokens && currentChunk) {
            chunks.push({
              content: currentChunk.trim(),
              startIndex: chunkStartIndex,
              endIndex: position,
              tokenCount: currentTokens,
              headingPath: currentHeadingPath
            });
            
            // Start new chunk with overlap
            const overlapText = this.getOverlapText(currentChunk, overlapTokens);
            currentChunk = overlapText + '\n' + line;
            currentTokens = this.tokenCount(currentChunk);
            chunkStartIndex = position - overlapText.length;
          } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
            currentTokens += lineTokens;
          }
          
          currentHeadingPath = heading.path;
        } else {
          // Regular line
          if (currentTokens + lineTokens > maxTokens) {
            // Save current chunk
            if (currentChunk) {
              chunks.push({
                content: currentChunk.trim(),
                startIndex: chunkStartIndex,
                endIndex: position,
                tokenCount: currentTokens,
                headingPath: currentHeadingPath
              });
            }
            
            // Start new chunk with overlap
            const overlapText = this.getOverlapText(currentChunk, overlapTokens);
            currentChunk = overlapText + '\n' + line;
            currentTokens = this.tokenCount(currentChunk);
            chunkStartIndex = position - overlapText.length;
          } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
            currentTokens += lineTokens;
          }
        }
        
        position += line.length + 1;
      }
      
      // Add final chunk
      if (currentChunk && currentTokens >= minTokens / 2) {
        chunks.push({
          content: currentChunk.trim(),
          startIndex: chunkStartIndex,
          endIndex: position,
          tokenCount: currentTokens,
          headingPath: currentHeadingPath
        });
      }
    } else {
      // Simple token-based chunking
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let currentChunk = '';
      let currentTokens = 0;
      let chunkStartIndex = 0;
      let position = 0;
      
      for (const sentence of sentences) {
        const sentenceTokens = this.tokenCount(sentence);
        
        if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
          // Save current chunk
          chunks.push({
            content: currentChunk.trim(),
            startIndex: chunkStartIndex,
            endIndex: position,
            tokenCount: currentTokens
          });
          
          // Start new chunk with overlap
          const overlapText = this.getOverlapText(currentChunk, overlapTokens);
          currentChunk = overlapText + ' ' + sentence;
          currentTokens = this.tokenCount(currentChunk);
          chunkStartIndex = position - overlapText.length;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
          currentTokens += sentenceTokens;
        }
        
        position += sentence.length;
      }
      
      // Add final chunk
      if (currentChunk && currentTokens >= minTokens / 2) {
        chunks.push({
          content: currentChunk.trim(),
          startIndex: chunkStartIndex,
          endIndex: position,
          tokenCount: currentTokens
        });
      }
    }
    
    return chunks;
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private static getOverlapText(text: string, overlapTokens: number): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let overlapText = '';
    let tokens = 0;
    
    // Work backwards through sentences
    for (let i = sentences.length - 1; i >= 0 && tokens < overlapTokens; i--) {
      overlapText = sentences[i] + (overlapText ? ' ' + overlapText : '');
      tokens = this.tokenCount(overlapText);
    }
    
    return overlapText.trim();
  }

  /**
   * Generate content hash for deduplication
   */
  static generateContentHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Extract page numbers from text (if present)
   */
  static extractPageNumbers(text: string): Map<number, number> {
    const pageMap = new Map<number, number>();
    
    // Common page number patterns
    const patterns = [
      /\[Page (\d+)\]/gi,
      /^Page (\d+)$/gm,
      /\bpage (\d+)\b/gi,
      /^(\d+)$/gm, // Standalone numbers on lines
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const pageNum = parseInt(match[1]);
        if (pageNum > 0 && pageNum < 10000) { // Reasonable page range
          pageMap.set(match.index, pageNum);
        }
      }
    }
    
    return pageMap;
  }
}