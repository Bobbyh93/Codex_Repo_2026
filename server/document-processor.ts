import { db } from "./db";
import { 
  documents, 
  documentChunks, 
  documentJobs, 
  extractedTables,
  tableCells,
  tableTopicMappings,
  type Document, 
  type DocumentChunk, 
  type DocumentJob, 
  type InsertDocument, 
  type InsertDocumentChunk, 
  type InsertDocumentJob,
  type ExtractedTable,
  type InsertExtractedTable,
  type InsertTableCell,
  type InsertTableTopicMapping
} from "@shared/schema";
import { TextProcessor, type TextChunk, type ExtractedMetadata } from "./text-processor";
import { AIProcessor } from "./ai-processor";
import { eq, and } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";
import { Readable } from "stream";
import * as crypto from "crypto";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import JSZip from "jszip";
import * as xml2js from "xml2js";
import { validateServerFile, type FileValidationResult } from "@shared/file-validation";
// @ts-ignore - pdf-table-extractor types may not be available
import pdfTableExtractor from "pdf-table-extractor";

export interface ExtractedContent {
  text: string;
  metadata: ExtractedMetadata;
  pageCount?: number;
  type: string;
  extractedAt: Date;
}

export interface StructuredContent {
  text: string;
  headings: Array<{
    level: number;
    text: string;
    path: string[];
    position: number;
  }>;
  metadata: ExtractedMetadata;
  topics: string[];
  pageNumbers: Map<number, number>;
}

export interface ProcessedChunk {
  content: string;
  embedding: number[];
  tokenCount: number;
  position: number;
  headingPath?: string[];
  pageNumber?: number;
  metadata?: Record<string, any>;
  hash: string;
}

export interface ProcessingOptions {
  minChunkTokens?: number;
  maxChunkTokens?: number;
  overlapTokens?: number;
  generateEmbeddings?: boolean;
  detectTopics?: boolean;
  preserveStructure?: boolean;
  extractTables?: boolean; // New option for table extraction
}

export interface ExtractedTableData {
  tableIndex: number;
  title?: string;
  pageNumber: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  rowCount: number;
  columnCount: number;
  headers: string[];
  cells: TableCellData[][];
  confidence: number;
  rawData: any;
}

export interface TableCellData {
  content: string;
  dataType: 'text' | 'number' | 'date' | 'percentage' | 'currency';
  numericValue?: number;
  isHeader: boolean;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    alignment?: string;
  };
  confidence: number;
}

/**
 * Enhanced validation result interface
 */
export interface EnhancedValidationResult {
  isValid: boolean;
  detectedType: string;
  validationResult: FileValidationResult;
  securityWarnings: string[];
}

export class DocumentProcessor {
  private static DOCUMENTS_DIR = "attached_assets/documents";
  private static MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static SUPPORTED_TYPES = ["pdf", "docx", "pptx", "txt"];
  
  /**
   * Main entry point for document processing
   * Returns both the document and jobId for tracking
   */
  static async processDocument(
    file: Express.Multer.File,
    adminId: string,
    options: ProcessingOptions = {}
  ): Promise<{ document: Document; jobId: string }> {
    const startTime = Date.now();
    let jobId: string | null = null;
    let document: Document | null = null;
    
    try {
      // Start a database transaction for atomicity
      return await db.transaction(async (tx) => {
        // Validate file FIRST (no DB operations yet)
        console.log(`[DocumentProcessor] Validating file: ${file.originalname}`);
        const validationResult = await this.validateFileComprehensive(file);
        
        if (!validationResult.isValid) {
          throw new Error(`File validation failed: ${validationResult.validationResult.errors[0]}`);
        }
        
        const fileType = validationResult.detectedType;
        
        // Log any warnings
        if (validationResult.validationResult.warnings.length > 0) {
          console.warn(`[DocumentProcessor] Validation warnings for ${file.originalname}:`, validationResult.validationResult.warnings);
        }
        
        if (validationResult.securityWarnings.length > 0) {
          console.warn(`[DocumentProcessor] Security warnings for ${file.originalname}:`, validationResult.securityWarnings);
        }
        
        // Calculate content hash for deduplication
        const contentHash = await this.calculateFileHash(file.buffer);
        
        // Check for duplicate using transaction
        const existingDoc = await tx
          .select()
          .from(documents)
          .where(eq(documents.contentHash, contentHash))
          .limit(1);
          
        if (existingDoc.length > 0) {
          console.log(`[DocumentProcessor] Duplicate document found for hash: ${contentHash}`);
          // For duplicates, create a dummy job ID since no processing is needed
          return { document: existingDoc[0], jobId: crypto.randomUUID() };
        }

        // Store original file only after duplicate detection so repeat uploads do not leave orphan files.
        console.log(`[DocumentProcessor] Storing validated file...`);
        const storedPath = await this.storeFile(file, validationResult);
        
        // Extract text content
        console.log(`[DocumentProcessor] Extracting text content...`);
        const extractedContent = await this.extractText(file, fileType);
        
        // Structure content
        console.log(`[DocumentProcessor] Structuring content...`);
        const structuredContent = await this.structureContent(
          extractedContent.text,
          fileType,
          options
        );
        
        // Create document record FIRST (before job)
        console.log(`[DocumentProcessor] Creating document record in database...`);
        const [createdDoc] = await tx
          .insert(documents)
          .values({
            title: file.originalname,
            type: fileType,
            sourceUri: storedPath,
            totalPages: extractedContent.pageCount,
            totalTokens: TextProcessor.tokenCount(extractedContent.text),
            metadata: {
              ...extractedContent.metadata,
              ...structuredContent.metadata,
              originalName: file.originalname,
              size: file.size,
              pageCount: extractedContent.pageCount,
              topics: structuredContent.topics,
              extractedText: extractedContent.text,
              validation: {
                detectedType: validationResult.detectedType,
                validationWarnings: validationResult.validationResult.warnings,
                securityWarnings: validationResult.securityWarnings,
                actualMimeType: validationResult.validationResult.actualMimeType,
                validatedAt: new Date().toISOString()
              }
            },
            contentHash,
            uploadedBy: adminId,
            status: "processing"
          })
          .returning();
        
        document = createdDoc;
        console.log(`[DocumentProcessor] Document created with ID: ${document.id}`);
        
        // NOW create the job with the valid document ID
        jobId = crypto.randomUUID();
        console.log(`[DocumentProcessor] Creating job with ID: ${jobId} for document: ${document.id}`);
        
        const [createdJob] = await tx
          .insert(documentJobs)
          .values({
            id: jobId,
            documentId: document.id, // Valid document ID
            status: "processing",
            stage: "chunking",
            progress: 40,
            startedAt: new Date(),
            metadata: {
              fileName: file.originalname,
              fileSize: file.size,
              fileType: fileType,
              adminId: adminId
            }
          })
          .returning();
        
        console.log(`[DocumentProcessor] Job created successfully`);
      
        // Extract tables if requested and this is a PDF
        let extractedTablesData: ExtractedTableData[] = [];
        if (options.extractTables !== false && fileType === "pdf") {
          await this.updateJobProgressInTx(tx, jobId, "table_extraction", 45);
          extractedTablesData = await this.extractTables(file);
          console.log(`[DocumentProcessor] Extracted ${extractedTablesData.length} tables from ${file.originalname}`);
        }

        // Chunk content
        await this.updateJobProgressInTx(tx, jobId, "chunking", 50);
        const chunks = await this.ensureAtLeastOneChunk(
          await this.chunkContent(structuredContent, options),
          structuredContent,
          extractedContent,
          file.originalname
        );
        
        // Generate embeddings if requested
        let processedChunks: ProcessedChunk[] = [];
        if (options.generateEmbeddings !== false) {
          await this.updateJobProgressInTx(tx, jobId, "embedding", 65);
          processedChunks = await this.generateChunkEmbeddings(chunks, jobId);
        } else {
          processedChunks = chunks.map(chunk => ({
            content: chunk.content,
            embedding: [],
            hash: TextProcessor.generateContentHash(chunk.content),
            position: chunk.startIndex,
            tokenCount: chunk.tokenCount,
            headingPath: chunk.headingPath,
            pageNumber: chunk.pageNumber,
            metadata: chunk.metadata
          }));
        }
        
        // Persist chunks using transaction
        console.log(`[DocumentProcessor] Persisting ${processedChunks.length} chunks...`);
        await this.updateJobProgressInTx(tx, jobId, "persisting", 80);
        await this.persistChunksInTx(tx, document.id, processedChunks);
      
        // Persist extracted tables
        if (extractedTablesData.length > 0) {
          console.log(`[DocumentProcessor] Persisting ${extractedTablesData.length} extracted tables...`);
          await this.updateJobProgressInTx(tx, jobId, "persisting_tables", 85);
          await this.persistExtractedTablesInTx(tx, document.id, extractedTablesData, adminId);
        }

        // Tag document with topics
        await this.updateJobProgressInTx(tx, jobId, "tagging", 95);
        if (structuredContent.topics.length > 0) {
          await this.tagDocumentWithTopicsInTx(tx, document.id, structuredContent.topics);
        }
        
        // Finalize document
        await this.updateJobProgressInTx(tx, jobId, "finalizing", 98);
        await this.finalizeDocumentInTx(tx, document.id);
        
        // Mark job as completed
        const processingTime = Date.now() - startTime;
        await tx
          .update(documentJobs)
          .set({
            status: "completed",
            stage: "completed",
            progress: 100,
            completedAt: new Date(),
            metadata: {
              fileName: file.originalname,
              fileSize: file.size,
              fileType: fileType,
              chunksCreated: processedChunks.length,
              processingTimeMs: processingTime
            }
          })
          .where(eq(documentJobs.id, jobId));
        
        console.log(`[DocumentProcessor] Document processing completed in ${processingTime}ms`);
        // Return both document and jobId for tracking
        return { document, jobId };
      });
    } catch (error) {
      console.error(`[DocumentProcessor] Error processing document:`, error);
      
      // If we have a job ID, mark it as failed
      if (jobId) {
        try {
          await this.handleJobFailure(jobId, error);
        } catch (failureError) {
          console.error(`[DocumentProcessor] Error marking job as failed:`, failureError);
        }
      }
      
      // Clean up stored file if document wasn't created
      if (!document && (error as any).storedPath) {
        try {
          await fs.unlink((error as any).storedPath);
        } catch (unlinkError) {
          console.error(`[DocumentProcessor] Error cleaning up file:`, unlinkError);
        }
      }
      
      throw error;
    }
  }

  private static ensureAtLeastOneChunk(
    chunks: TextChunk[],
    structuredContent: StructuredContent,
    extractedContent: ExtractedContent,
    fileName: string
  ): TextChunk[] {
    if (chunks.length > 0) return chunks;

    const fallbackText = (structuredContent.text || extractedContent.text || "").replace(/\s+/g, " ").trim();
    if (!fallbackText) return chunks;

    const firstHeading = structuredContent.headings[0]?.path?.length
      ? structuredContent.headings[0].path
      : [fileName];

    return [{
      content: fallbackText,
      startIndex: 0,
      endIndex: fallbackText.length,
      tokenCount: Math.max(1, TextProcessor.tokenCount(fallbackText)),
      headingPath: firstHeading,
      pageNumber: 1,
      metadata: {
        fallbackChunk: true,
        reason: "source shorter than minimum chunk threshold",
        originalFileName: fileName,
      },
    }];
  }

  /**
   * Extract text from file based on type
   */
  static async extractText(file: Express.Multer.File, type: string): Promise<ExtractedContent> {
    let text = "";
    let pageCount = 1;
    let metadata: ExtractedMetadata = {};
    
    switch (type) {
      case "pdf":
        const pdfData = await pdfParse(file.buffer);
        text = pdfData.text;
        pageCount = pdfData.numpages;
        metadata = {
          ...TextProcessor.extractMetadata(text),
          pageCount: pageCount,
          pdfInfo: pdfData.info
        };
        break;
        
      case "docx":
        const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
        text = docxResult.value;
        metadata = TextProcessor.extractMetadata(text);
        break;
        
      case "pptx":
        // Use JSZip to extract text from PPTX
        const zip = await JSZip.loadAsync(file.buffer);
        const slideTexts: string[] = [];
        
        // Find all slide files
        const slideFiles = Object.keys(zip.files)
          .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
          .sort();
        
        // Extract text from each slide
        for (const slideName of slideFiles) {
          const slideXml = await zip.file(slideName)?.async("string");
          if (slideXml) {
            // Parse XML and extract text
            const parser = new xml2js.Parser({ explicitArray: false });
            try {
              const result = await parser.parseStringPromise(slideXml);
              const slideText = this.extractTextFromXml(result);
              if (slideText) {
                slideTexts.push(slideText);
              }
            } catch (parseError) {
              console.warn(`Failed to parse slide ${slideName}:`, parseError);
            }
          }
        }
        
        text = slideTexts.join("\n\n");
        pageCount = slideTexts.length;
        metadata = {
          ...TextProcessor.extractMetadata(text),
          slideCount: pageCount
        };
        break;
        
      case "txt":
        text = file.buffer.toString("utf-8");
        metadata = TextProcessor.extractMetadata(text);
        break;
        
      default:
        throw new Error(`Unsupported file type: ${type}`);
    }
    
    return {
      text: TextProcessor.cleanText(text),
      metadata,
      pageCount,
      type,
      extractedAt: new Date()
    };
  }

  /**
   * Extract text from XML recursively
   */
  private static extractTextFromXml(obj: any): string {
    const texts: string[] = [];
    
    const extractRecursive = (node: any) => {
      if (typeof node === 'string') {
        texts.push(node);
      } else if (Array.isArray(node)) {
        node.forEach(extractRecursive);
      } else if (typeof node === 'object' && node !== null) {
        // Look for text nodes in PowerPoint XML structure
        if (node['a:t']) {
          extractRecursive(node['a:t']);
        }
        // Recursively search all properties
        Object.values(node).forEach(extractRecursive);
      }
    };
    
    extractRecursive(obj);
    return texts.join(' ').trim();
  }

  /**
   * Extract tables from PDF documents
   */
  static async extractTables(file: Express.Multer.File): Promise<ExtractedTableData[]> {
    if (file.mimetype !== 'application/pdf') {
      console.log(`[DocumentProcessor] Skipping table extraction for non-PDF file: ${file.originalname}`);
      return [];
    }

    console.log(`[DocumentProcessor] Starting table extraction for: ${file.originalname}`);
    const startTime = Date.now();
    
    try {
      // Create temporary file for pdf-table-extractor
      const tempFilePath = path.join('/tmp', `table_extract_${Date.now()}_${file.originalname}`);
      await fs.writeFile(tempFilePath, file.buffer);
      
      try {
        // Extract tables using pdf-table-extractor
        const result = await new Promise<any>((resolve, reject) => {
          pdfTableExtractor(tempFilePath, (result: any) => {
            if (result && result.pageTables) {
              resolve(result);
            } else {
              reject(new Error('No tables found or extraction failed'));
            }
          }, (error: any) => {
            reject(error);
          });
        });
        
        console.log(`[DocumentProcessor] Raw table extraction result:`, JSON.stringify(result, null, 2));
        
        // Process extracted tables
        const extractedTables: ExtractedTableData[] = [];
        let tableIndex = 0;
        
        for (const pageNum in result.pageTables) {
          const pageTables = result.pageTables[pageNum];
          
          for (const table of pageTables) {
            try {
              const processedTable = await this.processExtractedTable(table, tableIndex, parseInt(pageNum));
              if (processedTable) {
                extractedTables.push(processedTable);
                tableIndex++;
              }
            } catch (tableError) {
              console.warn(`[DocumentProcessor] Error processing table ${tableIndex} on page ${pageNum}:`, tableError);
            }
          }
        }
        
        console.log(`[DocumentProcessor] Table extraction completed in ${Date.now() - startTime}ms. Found ${extractedTables.length} tables.`);
        return extractedTables;
        
      } finally {
        // Clean up temporary file
        try {
          await fs.unlink(tempFilePath);
        } catch (unlinkError) {
          console.warn(`[DocumentProcessor] Failed to clean up temp file: ${tempFilePath}`, unlinkError);
        }
      }
    } catch (error) {
      console.error(`[DocumentProcessor] Table extraction error for ${file.originalname}:`, error);
      // Return empty array instead of throwing to allow document processing to continue
      return [];
    }
  }

  /**
   * Process a single extracted table into our standardized format
   */
  private static async processExtractedTable(
    rawTable: any, 
    tableIndex: number, 
    pageNumber: number
  ): Promise<ExtractedTableData | null> {
    try {
      // Extract table data from the raw result
      const rows = rawTable.tables || rawTable.rows || [];
      if (!rows || rows.length === 0) {
        console.warn(`[DocumentProcessor] Empty table found at index ${tableIndex}`);
        return null;
      }

      // Determine if first row contains headers
      const hasHeaders = this.detectTableHeaders(rows);
      const headers = hasHeaders && rows.length > 0 ? rows[0] : [];
      const dataRows = hasHeaders ? rows.slice(1) : rows;
      
      // Process cells
      const cells: TableCellData[][] = [];
      for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
        const row = dataRows[rowIdx];
        const cellRow: TableCellData[] = [];
        
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cellContent = String(row[colIdx] || '').trim();
          const cellData = this.processCellData(cellContent, false);
          cellRow.push(cellData);
        }
        cells.push(cellRow);
      }
      
      // Add header row if present
      if (hasHeaders && headers.length > 0) {
        const headerCells: TableCellData[] = headers.map((header: any) => 
          this.processCellData(String(header || '').trim(), true)
        );
        cells.unshift(headerCells);
      }

      const rowCount = cells.length;
      const columnCount = rowCount > 0 ? Math.max(...cells.map(row => row.length)) : 0;
      
      // Generate table title if possible
      const title = this.generateTableTitle(headers, cells, tableIndex);
      
      // Calculate confidence based on data quality
      const confidence = this.calculateTableConfidence(cells, rowCount, columnCount);
      
      return {
        tableIndex,
        title,
        pageNumber,
        boundingBox: rawTable.bounds || undefined,
        rowCount,
        columnCount,
        headers: headers.map((h: any) => String(h || '').trim()),
        cells,
        confidence,
        rawData: rawTable
      };
    } catch (error) {
      console.error(`[DocumentProcessor] Error processing table ${tableIndex}:`, error);
      return null;
    }
  }

  /**
   * Process individual cell data and detect data types
   */
  private static processCellData(content: string, isHeader: boolean): TableCellData {
    const dataType = this.detectCellDataType(content);
    const numericValue = dataType === 'number' ? this.extractNumericValue(content) : undefined;
    
    return {
      content,
      dataType,
      numericValue,
      isHeader,
      formatting: {},
      confidence: content.length > 0 ? 0.9 : 0.3 // Simple confidence based on content presence
    };
  }

  /**
   * Detect if the first row contains headers
   */
  private static detectTableHeaders(rows: any[][]): boolean {
    if (!rows || rows.length < 2) return false;
    
    const firstRow = rows[0];
    const secondRow = rows[1];
    
    // Check if first row has different characteristics than second row
    const firstRowHasText = firstRow.some((cell: any) => 
      isNaN(parseFloat(String(cell))) && String(cell).length > 0
    );
    const secondRowHasNumbers = secondRow.some((cell: any) => 
      !isNaN(parseFloat(String(cell)))
    );
    
    return firstRowHasText && secondRowHasNumbers;
  }

  /**
   * Detect cell data type
   */
  private static detectCellDataType(content: string): 'text' | 'number' | 'date' | 'percentage' | 'currency' {
    if (!content || content.trim() === '') return 'text';
    
    const trimmed = content.trim();
    
    // Check for percentage
    if (trimmed.endsWith('%') && !isNaN(parseFloat(trimmed.slice(0, -1)))) {
      return 'percentage';
    }
    
    // Check for currency
    if (/^[$€£¥][\d,]+\.?\d*$/.test(trimmed) || /^[\d,]+\.?\d*\s*[$€£¥]$/.test(trimmed)) {
      return 'currency';
    }
    
    // Check for date
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed) || 
        /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed)) {
      return 'date';
    }
    
    // Check for number
    if (!isNaN(parseFloat(trimmed)) && isFinite(parseFloat(trimmed))) {
      return 'number';
    }
    
    return 'text';
  }

  /**
   * Extract numeric value from cell content
   */
  private static extractNumericValue(content: string): number | undefined {
    const trimmed = content.trim();
    
    // Handle percentage
    if (trimmed.endsWith('%')) {
      const num = parseFloat(trimmed.slice(0, -1));
      return !isNaN(num) ? num : undefined;
    }
    
    // Handle currency - remove currency symbols and commas
    const cleaned = trimmed.replace(/[$€£¥,]/g, '');
    const num = parseFloat(cleaned);
    return !isNaN(num) ? num : undefined;
  }

  /**
   * Generate a descriptive title for the table
   */
  private static generateTableTitle(headers: string[], cells: TableCellData[][], tableIndex: number): string {
    if (headers && headers.length > 0) {
      const headerText = headers.filter(h => h.trim()).join(', ');
      if (headerText.length > 0) {
        return `Table ${tableIndex + 1}: ${headerText.substring(0, 100)}`;
      }
    }
    
    // Fallback to content-based title
    if (cells.length > 0 && cells[0].length > 0) {
      const firstRowText = cells[0].map(cell => cell.content).filter(c => c.trim()).join(', ');
      if (firstRowText.length > 0) {
        return `Table ${tableIndex + 1}: ${firstRowText.substring(0, 100)}`;
      }
    }
    
    return `Table ${tableIndex + 1}`;
  }

  /**
   * Calculate confidence score for table extraction
   */
  private static calculateTableConfidence(cells: TableCellData[][], rowCount: number, columnCount: number): number {
    if (rowCount === 0 || columnCount === 0) return 0;
    
    let totalCells = 0;
    let nonEmptyCells = 0;
    let wellFormattedCells = 0;
    
    for (const row of cells) {
      for (const cell of row) {
        totalCells++;
        if (cell.content.trim() !== '') {
          nonEmptyCells++;
          if (cell.dataType !== 'text' || cell.content.length > 2) {
            wellFormattedCells++;
          }
        }
      }
    }
    
    const fillRatio = nonEmptyCells / totalCells;
    const qualityRatio = wellFormattedCells / totalCells;
    const sizeScore = Math.min(rowCount * columnCount / 20, 1); // Favor reasonably sized tables
    
    return Math.min((fillRatio * 0.4 + qualityRatio * 0.4 + sizeScore * 0.2), 1);
  }

  /**
   * Structure content and extract hierarchy
   */
  static async structureContent(
    text: string,
    type: string,
    options: ProcessingOptions = {}
  ): Promise<StructuredContent> {
    const headings = TextProcessor.extractHeadings(text);
    const metadata = TextProcessor.extractMetadata(text);
    const pageNumbers = TextProcessor.extractPageNumbers(text);
    
    let topics: string[] = [];
    if (options.detectTopics !== false) {
      topics = await TextProcessor.detectTopics(text);
    }
    
    return {
      text,
      headings,
      metadata,
      topics,
      pageNumbers
    };
  }

  /**
   * Chunk content intelligently
   */
  static async chunkContent(
    structured: StructuredContent,
    options: ProcessingOptions = {}
  ): Promise<TextChunk[]> {
    const {
      minChunkTokens = 800,
      maxChunkTokens = 1200,
      overlapTokens = 120,
      preserveStructure = true
    } = options;
    
    return TextProcessor.chunkText(structured.text, {
      minTokens: minChunkTokens,
      maxTokens: maxChunkTokens,
      overlapTokens,
      preserveStructure,
      headings: structured.headings
    });
  }

  /**
   * Generate embeddings for chunks
   */
  static async generateChunkEmbeddings(
    chunks: TextChunk[],
    jobId: string
  ): Promise<ProcessedChunk[]> {
    const processedChunks: ProcessedChunk[] = [];
    const batchSize = 20; // OpenAI max batch size
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const progress = 65 + Math.floor((i / chunks.length) * 15);
      await this.updateJobProgress(jobId, "embedding", progress);
      
      try {
        const embeddings = await AIProcessor.generateEmbeddings(
          batch.map(chunk => chunk.content)
        );
        
        for (let j = 0; j < batch.length; j++) {
          processedChunks.push({
            content: batch[j].content,
            embedding: embeddings[j],
            tokenCount: batch[j].tokenCount,
            position: batch[j].startIndex,
            headingPath: batch[j].headingPath,
            pageNumber: batch[j].pageNumber,
            metadata: batch[j].metadata,
            hash: TextProcessor.generateContentHash(batch[j].content)
          });
        }
      } catch (error) {
        console.error(`Error generating embeddings for batch ${i}:`, error);
        // Fallback to empty embeddings
        for (const chunk of batch) {
          processedChunks.push({
            content: chunk.content,
            embedding: [],
            tokenCount: chunk.tokenCount,
            position: chunk.startIndex,
            headingPath: chunk.headingPath,
            pageNumber: chunk.pageNumber,
            metadata: chunk.metadata,
            hash: TextProcessor.generateContentHash(chunk.content)
          });
        }
      }
    }
    
    return processedChunks;
  }

  /**
   * Persist document to database
   */
  private static async createDocument(data: any): Promise<Document> {
    const docs = await db
      .insert(documents)
      .values(data)
      .returning();
    
    return docs[0];
  }

  /**
   * Persist chunks to database
   */
  static async persistChunks(documentId: string, chunks: ProcessedChunk[]): Promise<void> {
    const chunkRecords: InsertDocumentChunk[] = chunks.map((chunk, index) => ({
      documentId,
      chunkIndex: index,
      cleanText: chunk.content,
      rawText: chunk.content,
      tokens: chunk.tokenCount,
      embedding: chunk.embedding,
      pageStart: chunk.pageNumber,
      pageEnd: chunk.pageNumber,
      headingPath: chunk.headingPath,
      metadata: {
        ...(chunk.metadata || {}),
        headingPath: chunk.headingPath,
        pageNumber: chunk.pageNumber
      } as any
    } as InsertDocumentChunk));
    
    // Batch insert chunks
    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      await db.insert(documentChunks).values(batch as any);
    }
  }

  /**
   * Persist chunks within a transaction
   */
  private static async persistChunksInTx(tx: any, documentId: string, chunks: ProcessedChunk[]): Promise<void> {
    const chunkRecords: InsertDocumentChunk[] = chunks.map((chunk, index) => ({
      documentId,
      chunkIndex: index,
      cleanText: chunk.content,
      rawText: chunk.content,
      tokens: chunk.tokenCount,
      embedding: chunk.embedding,
      pageStart: chunk.pageNumber,
      pageEnd: chunk.pageNumber,
      headingPath: chunk.headingPath,
      metadata: {
        ...(chunk.metadata || {}),
        headingPath: chunk.headingPath,
        pageNumber: chunk.pageNumber
      } as any
    } as InsertDocumentChunk));
    
    // Batch insert chunks within transaction
    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      await tx.insert(documentChunks).values(batch as any);
    }
  }

  /**
   * Comprehensive file validation using shared validation utility
   */
  private static async validateFileComprehensive(
    file: Express.Multer.File
  ): Promise<EnhancedValidationResult> {
    console.log(`[DocumentProcessor] Starting comprehensive validation for: ${file.originalname}`);
    
    try {
      // Use the shared validation utility that matches frontend validation
      const validationResult = await validateServerFile(file, {
        maxSizeBytes: this.MAX_FILE_SIZE,
        allowedTypes: this.SUPPORTED_TYPES,
        strictMagicBytes: true
      });
      
      console.log(`[DocumentProcessor] Validation result:`, {
        isValid: validationResult.isValid,
        detectedType: validationResult.detectedType,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      
      if (!validationResult.isValid) {
        return {
          isValid: false,
          detectedType: validationResult.detectedType || "unknown",
          validationResult,
          securityWarnings: []
        };
      }
      
      // Additional security checks
      const securityWarnings = await this.performSecurityChecks(file, validationResult);
      
      return {
        isValid: true,
        detectedType: validationResult.detectedType!,
        validationResult,
        securityWarnings
      };
      
    } catch (error) {
      console.error(`[DocumentProcessor] Validation error for ${file.originalname}:`, error);
      throw new Error(`File validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
    }
  }
  
  /**
   * Perform additional security checks on validated files
   */
  private static async performSecurityChecks(
    file: Express.Multer.File,
    validationResult: FileValidationResult
  ): Promise<string[]> {
    const warnings: string[] = [];
    
    try {
      // Check file name for suspicious patterns
      const suspiciousPatterns = [/\.{2,}/, /[<>:"|?*]/, /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i];
      const fileName = path.basename(file.originalname, path.extname(file.originalname));
      
      if (suspiciousPatterns.some(pattern => pattern.test(fileName))) {
        warnings.push("File name contains potentially dangerous characters");
      }
      
      // Check for excessively long file names
      if (file.originalname.length > 255) {
        warnings.push("File name is unusually long");
      }
      
      // Check for null bytes in file name
      if (file.originalname.includes('\0')) {
        warnings.push("File name contains null bytes");
      }
      
      // File-type specific security checks
      if (validationResult.detectedType === "pdf") {
        await this.checkPdfSecurity(file.buffer, warnings);
      } else if (validationResult.detectedType === "docx" || validationResult.detectedType === "pptx") {
        await this.checkOfficeDocumentSecurity(file.buffer, validationResult.detectedType, warnings);
      }
      
      return warnings;
    } catch (error) {
      console.warn(`[DocumentProcessor] Security check failed for ${file.originalname}:`, error);
      warnings.push("Unable to complete security checks");
      return warnings;
    }
  }
  
  /**
   * PDF-specific security checks
   */
  private static async checkPdfSecurity(buffer: Buffer, warnings: string[]): Promise<void> {
    try {
      const pdfText = buffer.toString('utf8', 0, Math.min(4096, buffer.length));
      
      // Check for JavaScript in PDF
      if (pdfText.includes('/JavaScript') || pdfText.includes('/JS')) {
        warnings.push("PDF contains JavaScript - potential security risk");
      }
      
      // Check for form fields
      if (pdfText.includes('/AcroForm') || pdfText.includes('/XFA')) {
        warnings.push("PDF contains form fields");
      }
      
      // Check for embedded files
      if (pdfText.includes('/EmbeddedFile')) {
        warnings.push("PDF contains embedded files");
      }
      
    } catch (error) {
      console.warn('[DocumentProcessor] PDF security check failed:', error);
    }
  }
  
  /**
   * Office document security checks
   */
  private static async checkOfficeDocumentSecurity(
    buffer: Buffer, 
    docType: string, 
    warnings: string[]
  ): Promise<void> {
    try {
      // Check for macro indicators in Office documents
      const docText = buffer.toString('utf8', 0, Math.min(4096, buffer.length));
      
      // Look for VBA/macro signatures
      if (docText.includes('vbaProject') || docText.includes('macros/') || docText.includes('xl/vbaProject')) {
        warnings.push(`${docType.toUpperCase()} document may contain macros - potential security risk`);
      }
      
      // Check for external references
      if (docText.includes('http://') || docText.includes('https://') || docText.includes('ftp://')) {
        warnings.push(`${docType.toUpperCase()} document contains external references`);
      }
      
    } catch (error) {
      console.warn(`[DocumentProcessor] ${docType} security check failed:`, error);
    }
  }
  
  /**
   * Legacy validation method for backward compatibility
   */
  private static async validateFile(file: Express.Multer.File): Promise<string> {
    const result = await this.validateFileComprehensive(file);
    if (!result.isValid) {
      throw new Error(result.validationResult.errors[0] || "File validation failed");
    }
    return result.detectedType;
  }

  /**
   * Store uploaded file with validation metadata
   */
  private static async storeFile(
    file: Express.Multer.File, 
    validationResult?: EnhancedValidationResult
  ): Promise<string> {
    // Ensure directory exists
    await fs.mkdir(this.DOCUMENTS_DIR, { recursive: true });
    
    // Generate unique filename with detected type extension
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString("hex");
    
    // Use detected file type for extension if available and different from original
    const originalExtension = path.extname(file.originalname);
    const detectedExtension = validationResult?.detectedType ? `.${validationResult.detectedType}` : originalExtension;
    
    // Sanitize filename to prevent directory traversal
    const sanitizedBaseName = path.basename(file.originalname, originalExtension)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100); // Limit length
    
    const filename = `${timestamp}_${hash}_${sanitizedBaseName}${detectedExtension}`;
    const filepath = path.join(this.DOCUMENTS_DIR, filename);
    
    // Write file with atomic operation
    const tempFilepath = `${filepath}.tmp`;
    try {
      await fs.writeFile(tempFilepath, file.buffer);
      await fs.rename(tempFilepath, filepath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFilepath);
      } catch {}
      throw error;
    }
    
    // Store validation metadata as a sidecar file
    if (validationResult) {
      const metadataPath = `${filepath}.metadata.json`;
      const metadata = {
        originalName: file.originalname,
        originalSize: file.size,
        originalMimeType: file.mimetype,
        validationResult: validationResult.validationResult,
        securityWarnings: validationResult.securityWarnings,
        storedAt: new Date().toISOString()
      };
      
      try {
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      } catch (error) {
        console.warn(`[DocumentProcessor] Failed to write metadata file: ${error}`);
      }
    }
    
    return filepath;
  }

  /**
   * Calculate file hash for deduplication
   */
  private static async calculateFileHash(buffer: Buffer): Promise<string> {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Create job record
   */
  private static async createJob(data: InsertDocumentJob): Promise<DocumentJob> {
    const jobs = await db
      .insert(documentJobs)
      .values(data as any)
      .returning();
    
    return jobs[0];
  }

  /**
   * Update job progress
   */
  static async updateJobProgress(jobId: string, stage: string, progress: number): Promise<void> {
    await db
      .update(documentJobs)
      .set({
        stage,
        progress
      })
      .where(eq(documentJobs.id, jobId));
  }

  /**
   * Update job progress within a transaction
   */
  private static async updateJobProgressInTx(tx: any, jobId: string, stage: string, progress: number): Promise<void> {
    await tx
      .update(documentJobs)
      .set({
        stage,
        progress
      })
      .where(eq(documentJobs.id, jobId));
  }

  /**
   * Handle job failure
   */
  static async handleJobFailure(jobId: string, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await db
      .update(documentJobs)
      .set({
        status: "failed",
        error: errorMessage,
        metadata: {
          errorDetails: {
            message: errorMessage,
            stack: errorStack,
            timestamp: new Date().toISOString()
          }
        },
        completedAt: new Date()
      })
      .where(eq(documentJobs.id, jobId));
  }

  /**
   * Tag document with detected topics
   */
  private static async tagDocumentWithTopics(documentId: string, topicIds: string[]): Promise<void> {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    
    if (docs.length > 0) {
      const currentMetadata = docs[0].metadata || {};
      await db
        .update(documents)
        .set({
          metadata: {...currentMetadata, topicIds: topicIds},
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId));
    }
  }

  /**
   * Tag document with topics within a transaction
   */
  private static async tagDocumentWithTopicsInTx(tx: any, documentId: string, topicIds: string[]): Promise<void> {
    const docs = await tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    
    if (docs.length > 0) {
      const currentMetadata = docs[0].metadata || {};
      await tx
        .update(documents)
        .set({
          metadata: {...currentMetadata, topicIds: topicIds},
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId));
    }
  }

  /**
   * Finalize document processing
   */
  private static async finalizeDocument(documentId: string): Promise<void> {
    await db
      .update(documents)
      .set({
        status: "ready",
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId));
  }

  /**
   * Finalize document within a transaction
   */
  private static async finalizeDocumentInTx(tx: any, documentId: string): Promise<void> {
    await tx
      .update(documents)
      .set({
        status: "ready",
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId));
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
   * List processing jobs
   */
  static async listJobs(adminId?: string, status?: string): Promise<DocumentJob[]> {
    let query = db.select().from(documentJobs);
    
    const conditions = [];
    // Note: adminId is now stored in metadata, not as a separate field
    if (status) {
      conditions.push(eq(documentJobs.status, status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  /**
   * Resume failed jobs
   */
  static async resumeFailedJobs(): Promise<void> {
    const failedJobs = await db
      .select()
      .from(documentJobs)
      .where(eq(documentJobs.status, "failed"));
    
    for (const job of failedJobs) {
      const retryCount = ((job.metadata as any)?.retryCount || 0) + 1;
      if (retryCount <= 3) {
        await db
          .update(documentJobs)
          .set({
            status: "pending",
            metadata: {
              ...job.metadata,
              retryCount
            },
            error: null
          })
          .where(eq(documentJobs.id, job.id));
      }
    }
  }

  /**
   * Delete document and its chunks
   */
  static async deleteDocument(documentId: string): Promise<void> {
    // Delete chunks first
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));
    
    // Delete extracted tables and related data
    await db
      .delete(extractedTables)
      .where(eq(extractedTables.documentId, documentId));
    
    // Get document to delete file
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    
    if (docs.length > 0 && docs[0].sourceUri) {
      try {
        await fs.unlink(docs[0].sourceUri);
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }
    
    // Delete document record
    await db
      .delete(documents)
      .where(eq(documents.id, documentId));
  }

  /**
   * Persist extracted tables to database within a transaction
   */
  private static async persistExtractedTablesInTx(
    tx: any,
    documentId: string,
    tablesData: ExtractedTableData[],
    adminId: string
  ): Promise<ExtractedTable[]> {
    const persistedTables: ExtractedTable[] = [];
    
    for (const tableData of tablesData) {
      try {
        // Create the extracted table record
        const [insertedTable] = await tx
          .insert(extractedTables)
          .values({
            documentId,
            tableIndex: tableData.tableIndex,
            title: tableData.title,
            pageNumber: tableData.pageNumber,
            boundingBox: tableData.boundingBox,
            rowCount: tableData.rowCount,
            columnCount: tableData.columnCount,
            hasHeaders: tableData.headers.length > 0,
            headers: tableData.headers,
            extractionMethod: 'pdf-table-extractor',
            extractionConfidence: tableData.confidence,
            rawTableData: tableData.rawData,
            status: 'pending', // Default to pending for admin review
            metadata: {
              extractionTimeMs: Date.now(),
              originalFormat: 'pdf',
              processingNotes: `Extracted ${tableData.rowCount} rows x ${tableData.columnCount} columns`,
              qualityScore: tableData.confidence * 100,
              topicRelevance: [] // Will be populated later by AI analysis
            }
          } as unknown as InsertExtractedTable)
          .returning();
        
        persistedTables.push(insertedTable);
        
        // Persist individual table cells
        await this.persistTableCellsInTx(tx, insertedTable.id, tableData.cells);
        
        console.log(`[DocumentProcessor] Persisted table ${tableData.tableIndex} with ${tableData.cells.length} rows`);
        
      } catch (error) {
        console.error(`[DocumentProcessor] Error persisting table ${tableData.tableIndex}:`, error);
        // Continue with other tables even if one fails
      }
    }
    
    return persistedTables;
  }

  /**
   * Persist table cells to database within a transaction
   */
  private static async persistTableCellsInTx(
    tx: any,
    tableId: string,
    cells: TableCellData[][]
  ): Promise<void> {
    const cellRecords: InsertTableCell[] = [];
    
    for (let rowIndex = 0; rowIndex < cells.length; rowIndex++) {
      const row = cells[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
        const cell = row[columnIndex];
        
        cellRecords.push({
          tableId,
          rowIndex,
          columnIndex,
          content: cell.content,
          dataType: cell.dataType,
          numericValue: cell.numericValue?.toString(),
          isHeader: cell.isHeader,
          spanRows: 1, // Default span
          spanColumns: 1, // Default span
          formatting: cell.formatting,
          confidence: cell.confidence,
          originalBounds: undefined, // Not available from current extraction method
          editedContent: null,
          validationNotes: null
        } as unknown as InsertTableCell);
      }
    }
    
    // Batch insert cells for performance
    const batchSize = 100;
    for (let i = 0; i < cellRecords.length; i += batchSize) {
      const batch = cellRecords.slice(i, i + batchSize);
      await tx.insert(tableCells).values(batch);
    }
    
    console.log(`[DocumentProcessor] Persisted ${cellRecords.length} table cells for table ${tableId}`);
  }

  /**
   * Auto-approve high-confidence tables (optional feature)
   */
  private static async autoApproveHighConfidenceTables(
    tx: any,
    tables: ExtractedTable[],
    adminId: string,
    confidenceThreshold: number = 0.9
  ): Promise<void> {
    for (const table of tables) {
      if (table.extractionConfidence && parseFloat(table.extractionConfidence.toString()) >= confidenceThreshold) {
        await tx
          .update(extractedTables)
          .set({
            status: 'approved',
            approvedBy: adminId,
            approvedAt: new Date()
          })
          .where(eq(extractedTables.id, table.id));
        
        console.log(`[DocumentProcessor] Auto-approved high-confidence table ${table.id} (confidence: ${table.extractionConfidence})`);
      }
    }
  }

  /**
   * Get extracted tables for a document
   */
  static async getExtractedTables(documentId: string): Promise<ExtractedTable[]> {
    return await db
      .select()
      .from(extractedTables)
      .where(eq(extractedTables.documentId, documentId))
      .orderBy(extractedTables.tableIndex);
  }

  /**
   * Get table cells for a specific table
   */
  static async getTableCells(tableId: string) {
    return await db
      .select()
      .from(tableCells)
      .where(eq(tableCells.tableId, tableId))
      .orderBy(tableCells.rowIndex, tableCells.columnIndex);
  }

  /**
   * Process a document directly from a file path on disk.
   * Constructs a fake Multer file object and routes it through the standard pipeline.
   * Designed for admin-triggered ingestion of files already present in the workspace.
   */
  static async processDocumentFromDisk(
    filePath: string,
    displayTitle: string,
    adminId: string,
    options: ProcessingOptions = {}
  ): Promise<{ document: Document; jobId: string }> {
    console.log(`[DocumentProcessor] Reading file from disk: ${filePath}`);
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".txt": "text/plain"
    };
    const mimetype = mimeTypes[ext] || "application/octet-stream";

    const fakeFile: Express.Multer.File = {
      fieldname: "file",
      originalname: displayTitle,
      encoding: "7bit",
      mimetype,
      size: stats.size,
      buffer: fileBuffer,
      destination: "",
      filename: path.basename(filePath),
      path: filePath,
      stream: Readable.from(fileBuffer)
    };

    return this.processDocument(fakeFile, adminId, options);
  }

  /**
   * Update table extraction count in document metadata
   */
  private static async updateDocumentTableCount(
    tx: any,
    documentId: string,
    tableCount: number
  ): Promise<void> {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    
    if (doc) {
      const updatedMetadata = {
        ...doc.metadata,
        tablesExtracted: tableCount,
        lastTableExtractionAt: new Date().toISOString()
      };
      
      await tx
        .update(documents)
        .set({ metadata: updatedMetadata })
        .where(eq(documents.id, documentId));
    }
  }
}
