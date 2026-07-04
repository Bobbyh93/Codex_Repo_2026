import { Router } from "express";
import multer from "multer";
import { db } from "./db";
import { contentBlocks, importJobs, contentCrosswalks, topicPerformance } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import csv from "csv-parser";
import { Readable } from "stream";
import { analyzeNursingContent, batchAnalyzeContent } from "./ai-content-analyzer";
import mammoth from "mammoth";
import { requireAdminSession, validateCSRFToken } from "./admin-auth-session";
import { extractPptxContent } from "./pptx-extractor";

const router = Router();

// Multi-format file validation for content imports
const contentFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type and extension
  const allowedFormats = {
    'text/csv': ['csv'],
    'application/csv': ['csv'],
    'text/plain': ['txt', 'md', 'csv'],
    'text/markdown': ['md'],
    'text/html': ['html', 'htm'],
    'application/pdf': ['pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
    'application/msword': ['doc']
  };

  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  
  // Check if MIME type is allowed
  const allowedExtensions = allowedFormats[file.mimetype as keyof typeof allowedFormats];
  
  if (!allowedExtensions) {
    console.warn(`[Security] Rejected content import: Invalid MIME type ${file.mimetype} from IP ${req.ip}`);
    return cb(new Error('Invalid file type. Allowed formats: CSV, TXT, MD, HTML, DOC, DOCX, PPTX'));
  }

  // Check if extension matches MIME type
  if (!allowedExtensions.includes(fileExtension!)) {
    console.warn(`[Security] Rejected content import: Extension .${fileExtension} doesn't match MIME type ${file.mimetype} from IP ${req.ip}`);
    return cb(new Error(`Invalid file extension for type ${file.mimetype}`));
  }

  console.info(`[Security] Valid content file uploaded: ${file.originalname} (${file.mimetype}) from IP ${req.ip}`);
  cb(null, true);
};

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Only allow 1 file per upload
  },
  fileFilter: contentFileFilter
});

router.use(requireAdminSession);
router.use(validateCSRFToken);

const stringArrayFields = new Set([
  "tags",
  "diagnoses",
  "interventions",
  "patientProblems",
  "concepts",
  "keywords",
  "relatedIds",
]);

const allowedContentBlockUpdateFields = new Set([
  "content",
  "contentType",
  "source",
  "sourceType",
  "title",
  "description",
  "category",
  "subcategory",
  "tags",
  "difficulty",
  "nursingSpecialty",
  "bodySystem",
  "diagnoses",
  "interventions",
  "patientProblems",
  "concepts",
  "keywords",
  "qualityScore",
  "parentId",
  "relatedIds",
]);

function normalizeContentBlockUpdates(input: Record<string, unknown>) {
  const updates: Record<string, any> = {};

  for (const [field, value] of Object.entries(input || {})) {
    if (!allowedContentBlockUpdateFields.has(field)) continue;

    if (stringArrayFields.has(field)) {
      updates[field] = Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean)
        : [];
      continue;
    }

    updates[field] = value;
  }

  return updates;
}

// Process CSV import
router.post("/content/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const config = JSON.parse(req.body.config);
    const { fileType, mappings, options } = config;

    // Create import job
    const [importJob] = await db.insert(importJobs).values({
      jobType: fileType,
      fileName: req.file.originalname,
      status: 'processing',
      mappingConfig: mappings,
      processingOptions: options,
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      startedAt: new Date()
    }).returning();

    // Process based on file type
    let processedCount = 0;
    let failedCount = 0;

    if (fileType === 'csv') {
      const results = await processCSV(req.file.buffer, mappings, options);
      processedCount = results.processed;
      failedCount = results.failed;
    } else if (fileType === 'markdown') {
      const results = await processMarkdown(req.file.buffer.toString('utf-8'), options);
      processedCount = results.processed;
      failedCount = results.failed;
    } else if (fileType === 'html') {
      const results = await processHTML(req.file.buffer.toString('utf-8'), options);
      processedCount = results.processed;
      failedCount = results.failed;
    } else if (fileType === 'text') {
      const results = await processText(req.file.buffer.toString('utf-8'), options);
      processedCount = results.processed;
      failedCount = results.failed;
    } else if (fileType === 'pdf') {
      const results = await processPDF(req.file.buffer, options);
      processedCount = results.processed;
      failedCount = results.failed;
    } else if (fileType === 'docx') {
      const results = await processDOCX(req.file.buffer, options);
      processedCount = results.processed;
      failedCount = results.failed;
    } else if (fileType === 'pptx') {
      const results = await processPPTX(req.file.buffer, req.file.originalname, options);
      processedCount = results.processed;
      failedCount = results.failed;
    }

    // Update job status
    await db.update(importJobs)
      .set({
        status: 'completed',
        progress: 100,
        processedRecords: processedCount,
        failedRecords: failedCount,
        completedAt: new Date()
      })
      .where(eq(importJobs.id, importJob.id));

    res.json({
      success: true,
      processed: processedCount,
      failed: failedCount
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Import failed" });
  }
});

// Process CSV
async function processCSV(buffer: Buffer, mappings: any[], options: any) {
  const results: any[] = [];
  const stream = Readable.from(buffer.toString());
  
  return new Promise<{ processed: number, failed: number }>((resolve) => {
    let processed = 0;
    let failed = 0;

    stream
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        for (const row of results) {
          try {
            const mappedData: any = {};
            for (const mapping of mappings || []) {
              if (mapping.sourceColumn && mapping.targetField) {
                mappedData[mapping.targetField] = row[mapping.sourceColumn];
              }
            }

            if (mappedData.content || mappedData.text) {
              await db.insert(contentBlocks).values({
                content: mappedData.content || mappedData.text || '',
                contentType: 'text',
                sourceType: 'csv',
                title: mappedData.title,
                category: mappedData.category,
                subcategory: mappedData.subcategory,
                tags: mappedData.tags ? mappedData.tags.split(',').map((t: string) => t.trim()) : [],
                difficulty: mappedData.difficulty,
                keywords: mappedData.keywords ? mappedData.keywords.split(',').map((k: string) => k.trim()) : []
              });
              processed++;
            }
          } catch (error) {
            failed++;
            console.error("Row processing error:", error);
          }
        }
        resolve({ processed, failed });
      });
  });
}

// Process Markdown
async function processMarkdown(content: string, options: any) {
  try {
    const blocks = content.split(/^#{1,3}\s+/gm).filter(block => block.trim());
    let processed = 0;
    let failed = 0;

    for (const block of blocks) {
      try {
        const lines = block.split('\n');
        const title = lines[0]?.trim() || 'Untitled';
        const contentText = lines.slice(1).join('\n').trim();

        if (contentText) {
          await db.insert(contentBlocks).values({
            content: contentText,
            contentType: 'markdown',
            sourceType: 'markdown',
            title,
            category: options?.category || 'Fundamentals',
            tags: options?.tags ? options.tags.split(',').map((t: string) => t.trim()) : (options?.autoTag ? await extractTags(contentText) : [])
          });
          processed++;
        }
      } catch (error) {
        failed++;
        console.error("Block processing error:", error);
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error("Markdown processing error:", error);
    return { processed: 0, failed: 1 };
  }
}

// Process HTML
async function processHTML(content: string, options: any) {
  try {
    // Remove HTML tags but keep text
    const textContent = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!textContent) {
      return { processed: 0, failed: 0 };
    }

    // Chunk the text
    const chunks = chunkText(textContent, options?.chunkSize || 1000);
    let processed = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        await db.insert(contentBlocks).values({
          content: chunk,
          contentType: 'text',
          sourceType: 'html',
          category: options?.category || 'General',
          tags: options?.tags ? options.tags.split(',').map((t: string) => t.trim()) : (options?.autoTag ? await extractTags(chunk) : [])
        });
        processed++;
      } catch (error) {
        failed++;
        console.error("Chunk processing error:", error);
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error("HTML processing error:", error);
    return { processed: 0, failed: 1 };
  }
}

// Process plain text
async function processText(content: string, options: any) {
  try {
    if (!content || content.trim().length === 0) {
      return { processed: 0, failed: 0 };
    }

    const chunks = chunkText(content, options?.chunkSize || 1000);
    let processed = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        await db.insert(contentBlocks).values({
          content: chunk,
          contentType: 'text',
          sourceType: 'text',
          category: options?.category || 'General',
          tags: options?.tags ? options.tags.split(',').map((t: string) => t.trim()) : (options?.autoTag ? await extractTags(chunk) : [])
        });
        processed++;
      } catch (error) {
        failed++;
        console.error("Chunk processing error:", error);
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error("Text processing error:", error);
    return { processed: 0, failed: 1 };
  }
}

// Process PDF with topic-focused extraction
async function processPDF(buffer: Buffer, options: any) {
  try {
    // Use topic-focused parsing for better content organization
    const { parseContentForReviewTopics, generateTopicTitle, generateTopicDescription } = await import('./topic-focused-parser');
    const topicParseResult = await parseContentForReviewTopics(buffer);
    
    let processed = 0;
    let failed = 0;

    // Process each topic-specific content section
    for (const topicResult of topicParseResult.reviewTopics) {
      if (topicResult.isRelevant && topicResult.confidence > 0.2) {
        try {
          const title = generateTopicTitle(topicResult.extractedContent, topicResult.topicName);
          const description = generateTopicDescription(topicResult.extractedContent);
          
          // Store in content blocks for the content mapper
          await db.insert(contentBlocks).values({
            content: topicResult.extractedContent,
            title: title,
            description: description,
            contentType: 'text',
            sourceType: 'pdf',
            category: topicResult.topicName,
            tags: topicResult.keywordMatches.slice(0, 8), // Use matched keywords as tags
            // Note: metadata field doesn't exist in contentBlocks schema
            // Store metadata info in other fields or remove if not needed
          });

          // Also store directly in simplified topic content structure
          try {
            await db.execute(sql`
              INSERT INTO topic_content_blocks (title, content, source, review_topic_name, created_at)
              VALUES (${title}, ${topicResult.extractedContent}, ${'PDF Auto-Import'}, ${topicResult.topicName}, datetime('now'))
            `);
          } catch (e) {
            console.log("Note: topic_content_blocks table not available yet");
          }

          // Track this topic as being identified for review
          try {
            const { trackSimpleTopicReview } = await import('./simple-topic-tracker');
            await trackSimpleTopicReview(topicResult.topicName, 'pdf_analysis');
          } catch (e) {
            console.log("Topic frequency tracking skipped:", e instanceof Error ? e.message : String(e));
          }
          processed++;
        } catch (error) {
          failed++;
          console.error("Topic-focused content processing error:", error);
        }
      }
    }

    // If no topic-relevant content found, fall back to basic chunking
    if (processed === 0) {
      const chunks = chunkText(topicParseResult.rawText, options?.chunkSize || 1000);
      
      for (const chunk of chunks.slice(0, 3)) { // Limit to 3 chunks to avoid spam
        try {
          await db.insert(contentBlocks).values({
            content: chunk,
            contentType: 'text',
            sourceType: 'pdf',
            category: options?.category || 'Fundamentals',
            tags: options?.tags ? options.tags.split(',').map((t: string) => t.trim()) : (options?.autoTag ? await extractTags(chunk) : [])
          });
          processed++;
        } catch (error) {
          failed++;
          console.error("Fallback chunk processing error:", error);
        }
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error("PDF processing error:", error);
    return { processed: 0, failed: 1 };
  }
}

// Process DOCX
async function processDOCX(buffer: Buffer, options: any) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    if (!text || text.trim().length === 0) {
      return { processed: 0, failed: 0 };
    }

    const chunks = chunkText(text, options?.chunkSize || 1000);
    let processed = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        await db.insert(contentBlocks).values({
          content: chunk,
          contentType: 'text',
          sourceType: 'docx',
          category: options?.category || 'General',
          tags: options?.tags ? options.tags.split(',').map((t: string) => t.trim()) : (options?.autoTag ? await extractTags(chunk) : [])
        });
        processed++;
      } catch (error) {
        failed++;
        console.error("DOCX chunk processing error:", error);
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error("DOCX processing error:", error);
    return { processed: 0, failed: 1 };
  }
}

// Process PPTX slide decks into slide-level content blocks
async function processPPTX(buffer: Buffer, fileName: string, options: any) {
  try {
    const deck = await extractPptxContent(buffer);
    if (deck.slides.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const slide of deck.slides) {
      const content = [
        slide.text ? `Visible slide text: ${slide.text}` : "",
        slide.notes ? `Speaker notes: ${slide.notes}` : "",
      ].filter(Boolean).join("\n\n");

      if (!content.trim()) continue;

      try {
        const tags = options?.tags
          ? options.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : options?.autoTag
            ? await extractTags(content)
            : [];

        await db.insert(contentBlocks).values({
          content,
          contentType: 'slide_deck',
          sourceType: 'pptx',
          source: fileName,
          title: `Slide ${slide.slideNumber}: ${slide.title}`,
          description: slide.notes
            ? `PowerPoint slide ${slide.slideNumber} with speaker notes`
            : `PowerPoint slide ${slide.slideNumber}`,
          category: options?.category || 'Slide Deck',
          tags: Array.from(new Set([...tags, 'pptx', 'slide-deck'])),
          keywords: [slide.title, fileName].filter(Boolean),
        });
        processed++;
      } catch (error) {
        failed++;
        console.error("PPTX slide processing error:", error);
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error("PPTX processing error:", error);
    return { processed: 0, failed: 1 };
  }
}

// Helper function to chunk text
function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= chunkSize) {
      currentChunk += sentence + ' ';
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence + ' ';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Helper function to extract tags
async function extractTags(text: string): Promise<string[]> {
  const nursingKeywords = [
    'assessment', 'diagnosis', 'intervention', 'evaluation', 'medication',
    'patient', 'nursing', 'care', 'treatment', 'symptoms', 'vital signs',
    'safety', 'infection', 'cardiovascular', 'respiratory', 'neurological'
  ];

  const foundTags: string[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of nursingKeywords) {
    if (lowerText.includes(keyword)) {
      foundTags.push(keyword);
    }
  }

  return foundTags.slice(0, 10); // Limit to 10 tags
}

// Get content blocks with filters
router.get("/content/blocks", async (req, res) => {
  try {
    const { unprocessed, category, search, limit = 100 } = req.query;
    
    // Build query with conditions
    const conditions = [];
    
    if (category && category !== 'all') {
      conditions.push(eq(contentBlocks.category, category as string));
    }
    
    if (search) {
      conditions.push(sql`${contentBlocks.content} ILIKE ${`%${search}%`}`);
    }
    
    if (unprocessed === 'true') {
      // Get blocks without AI processing (no nursing specialty or body system)
      conditions.push(
        sql`${contentBlocks.nursingSpecialty} IS NULL`
      );
    }
    
    // Build and execute query based on conditions
    const blocks = conditions.length > 0
      ? await db.select()
          .from(contentBlocks)
          .where(and(...conditions))
          .orderBy(desc(contentBlocks.createdAt))
          .limit(Number(limit))
      : await db.select()
          .from(contentBlocks)
          .orderBy(desc(contentBlocks.createdAt))
          .limit(Number(limit));
    
    res.json(blocks);
  } catch (error) {
    console.error("Failed to fetch content blocks:", error);
    res.status(500).json({ error: "Failed to fetch content blocks" });
  }
});

// Get single content block
router.get("/content/blocks/:id", async (req, res) => {
  try {
    const [block] = await db.select()
      .from(contentBlocks)
      .where(eq(contentBlocks.id, req.params.id))
      .limit(1);
    
    if (!block) {
      return res.status(404).json({ error: "Content block not found" });
    }
    
    res.json(block);
  } catch (error) {
    console.error("Failed to fetch content block:", error);
    res.status(500).json({ error: "Failed to fetch content block" });
  }
});

// Update content block
router.put("/content/blocks/:id", async (req, res) => {
  try {
    const updates = normalizeContentBlockUpdates(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No supported content block updates provided" });
    }
    
    const [updatedBlock] = await db.update(contentBlocks)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(contentBlocks.id, req.params.id))
      .returning();
    
    res.json(updatedBlock);
  } catch (error) {
    console.error("Failed to update content block:", error);
    res.status(500).json({ error: "Failed to update content block" });
  }
});

// Create crosswalk mapping
router.post("/crosswalks", async (req, res) => {
  try {
    const [crosswalk] = await db.insert(contentCrosswalks)
      .values(req.body)
      .returning();
    
    res.json(crosswalk);
  } catch (error) {
    console.error("Failed to create crosswalk:", error);
    res.status(500).json({ error: "Failed to create crosswalk" });
  }
});

// Map topic performance
router.post("/topic-performance/map", async (req, res) => {
  try {
    const { contentBlockId, topicId, reportId } = req.body;
    
    // Check if mapping exists
    const existing = await db.select()
      .from(topicPerformance)
      .where(and(
        eq(topicPerformance.topicId, topicId),
        eq(topicPerformance.reportId, reportId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing
      const [updated] = await db.update(topicPerformance)
        .set({
          priority: existing[0].priority ? existing[0].priority + 1 : 1
        })
        .where(eq(topicPerformance.id, existing[0].id))
        .returning();
      
      res.json(updated);
    } else {
      // Create new mapping
      const [created] = await db.insert(topicPerformance)
        .values({
          topicId,
          reportId,
          score: "0",
          frequency: 1,
          gapScore: "0",
          priority: 1,
          recommendedStudyTime: 30
        })
        .returning();
      
      res.json(created);
    }
  } catch (error) {
    console.error("Failed to map topic performance:", error);
    res.status(500).json({ error: "Failed to map topic performance" });
  }
});

// Create content crosswalk
router.post("/content/crosswalks", async (req, res) => {
  try {
    const [crosswalk] = await db.insert(contentCrosswalks)
      .values(req.body)
      .returning();
    
    res.json(crosswalk);
  } catch (error) {
    console.error("Failed to create crosswalk:", error);
    res.status(500).json({ error: "Failed to create crosswalk" });
  }
});

// Quick import route for testing with sample nursing content
router.post("/import-sample", async (req, res) => {
  try {
    const fs = await import('fs/promises');
    
    // Try to find a test file
    let content = "";
    try {
      content = await fs.readFile('./test-nursing-content.txt', 'utf-8');
    } catch {
      // Create some default sample content if file doesn't exist
      content = `## Cardiovascular Assessment
The cardiovascular system is responsible for pumping blood throughout the body. Key assessment includes heart rate, rhythm, blood pressure, and peripheral pulses.

## Respiratory Assessment  
Respiratory assessment involves evaluating breathing rate, depth, rhythm, and lung sounds. Auscultate all lung fields systematically.

## Pain Management
Pain is the fifth vital sign. Use appropriate pain scales. Consider both pharmacological and non-pharmacological interventions.`;
    }
    
    const options = {
      chunkSize: 500,
      category: 'NCLEX Study Guide',
      autoTag: false,
      useAI: req.body?.useAI || false
    };
    
    const result = await processText(content, options);
    
    res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      message: `Successfully imported ${result.processed} content blocks from sample nursing content`
    });
  } catch (error) {
    console.error("Sample import error:", error);
    res.status(500).json({ error: "Sample import failed" });
  }
});

// Process existing content blocks with AI
router.post("/content/analyze-with-ai", async (req, res) => {
  try {
    const { blockIds, analyzeAll } = req.body;
    
    let blocksToAnalyze: any[] = [];
    
    if (analyzeAll) {
      // Get all unprocessed content blocks
      blocksToAnalyze = await db.select()
        .from(contentBlocks)
        .where(sql`${contentBlocks.nursingSpecialty} IS NULL`)
        .limit(50);
    } else if (blockIds && blockIds.length > 0) {
      // Get specific blocks
      blocksToAnalyze = await db.select()
        .from(contentBlocks)
        .where(sql`${contentBlocks.id} IN (${sql.join(blockIds.map((id: string) => sql`${id}`), sql`, `)})`);
    }
    
    if (blocksToAnalyze.length === 0) {
      return res.json({ message: "No content blocks to analyze", processed: 0 });
    }
    
    // Analyze blocks with AI
    const analysisResults = await batchAnalyzeContent(
      blocksToAnalyze.map(block => ({ id: block.id, content: block.content })),
      (processed, total) => {
        console.log(`Processing: ${processed}/${total} blocks`);
      }
    );
    
    // Update blocks with AI analysis results
    for (const [blockId, analysis] of Array.from(analysisResults.entries())) {
      await db.update(contentBlocks)
        .set({
          title: analysis.title || undefined,
          category: analysis.category || undefined,
          nursingSpecialty: analysis.nursingSpecialty,
          bodySystem: analysis.bodySystem,
          diagnoses: analysis.diagnoses || [],
          interventions: analysis.interventions || [],
          patientProblems: analysis.patientProblems || [],
          concepts: analysis.concepts || [],
          keywords: analysis.keywords || [],
          tags: [...(analysis.concepts || []), ...(analysis.keywords || [])].slice(0, 10),
          updatedAt: new Date()
        })
        .where(eq(contentBlocks.id, blockId));
    }
    
    res.json({
      success: true,
      processed: analysisResults.size,
      message: `Successfully analyzed ${analysisResults.size} content blocks with AI`
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

// Get AI suggestions for a specific block
router.get("/content/blocks/:id/ai-suggestions", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [block] = await db.select()
      .from(contentBlocks)
      .where(eq(contentBlocks.id, id))
      .limit(1);
    
    if (!block) {
      return res.status(404).json({ error: "Content block not found" });
    }
    
    // Get AI analysis
    const analysis = await analyzeNursingContent(block.content);
    
    res.json({
      blockId: id,
      suggestions: analysis
    });
  } catch (error) {
    console.error("AI suggestions error:", error);
    res.status(500).json({ error: "Failed to get AI suggestions" });
  }
});

export default router;
