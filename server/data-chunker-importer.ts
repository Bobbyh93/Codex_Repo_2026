import { asc, and, eq } from "drizzle-orm";
import JSZip from "jszip";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { db } from "./db";
import {
  documentChunks,
  documentJobs,
  documents,
  sourceRegistry,
} from "@shared/schema";

type DataChunkerIndexEntry = {
  chunk_id?: string | number;
  file_name?: string;
  file_extension?: string;
  chunk_name?: string;
  actual_filename?: string;
  content_length?: number;
  content_preview?: string;
  generated?: string;
  [key: string]: unknown;
};

type ParsedDataChunkerChunk = {
  text: string;
  chunkId?: string | number;
  chunkName?: string;
  actualFilename?: string;
  contentLength?: number;
  sourceFile?: string;
  originalExtension?: string;
  generated?: string;
  archivePath?: string;
  localIndexPath?: string;
};

type ParsedDataChunkerDocument = {
  title: string;
  generated: string;
  chunks: ParsedDataChunkerChunk[];
};

export type DataChunkerImportResult = {
  document: any;
  documentChunks: any[];
  job: any;
  source: any;
};

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stableHash(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileExtension(fileName = ""): string {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

function inferDocumentType(fileName = "", contentType = ""): string {
  const ext = fileExtension(fileName);
  if (["zip", "tar", "json"].includes(ext)) return ext;
  if (contentType.includes("zip")) return "zip";
  if (contentType.includes("tar")) return "tar";
  if (contentType.includes("json")) return "json";
  return ext || "file";
}

function parseDataChunkerMarkdownContent(markdown: string): string {
  const match = String(markdown || "").match(/## Content\s*```(?:text|txt)?\s*([\s\S]*?)```/i);
  return compactText(match ? match[1] : markdown);
}

function isDataChunkerIndex(value: unknown): value is DataChunkerIndexEntry[] {
  return Array.isArray(value)
    && value.length > 0
    && value.some((entry) => (
      entry
      && typeof entry === "object"
      && "chunk_id" in entry
      && "actual_filename" in entry
    ));
}

function normalizeArchivePath(value: unknown): string {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\/+/g, "/");
}

function archiveDirName(value: string): string {
  const normalized = normalizeArchivePath(value);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function archiveJoin(...parts: string[]): string {
  return normalizeArchivePath(path.posix.join(...parts.filter(Boolean)));
}

function extractTarEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const rawPrefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const rawSize = header.subarray(124, 136).toString("utf8").replace(/\0/g, "").trim();
    const size = Number.parseInt(rawSize || "0", 8);

    if (!rawName && !size) break;
    const name = normalizeArchivePath(rawPrefix ? `${rawPrefix}/${rawName}` : rawName);
    offset += 512;

    if (name && Number.isFinite(size)) {
      entries.set(name, buffer.subarray(offset, offset + size));
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

async function extractZipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = new Map<string, Buffer>();
  for (const file of Object.values(zip.files)) {
    if (!file.dir) {
      entries.set(normalizeArchivePath(file.name), await file.async("nodebuffer"));
    }
  }
  return entries;
}

function findArchiveChunkEntry(
  entries: Map<string, Buffer>,
  indexPath: string,
  actualFileName: string | undefined,
): string | undefined {
  if (!actualFileName) return undefined;

  const keys = Array.from(entries.keys());
  const indexDir = archiveDirName(indexPath);
  const strippedIndexDir = indexDir.replace(/\.pdf$/i, "");
  const parentDir = archiveDirName(indexDir);
  const actual = normalizeArchivePath(actualFileName);
  const candidates = [
    archiveJoin(indexDir, actual),
    archiveJoin(strippedIndexDir, actual),
    archiveJoin(parentDir, actual),
    actual,
  ];

  return candidates.find((candidate) => entries.has(candidate))
    || keys.find((candidate) => (
      candidate.toLowerCase().endsWith(`/${actual.toLowerCase()}`)
      || candidate.toLowerCase() === actual.toLowerCase()
    ));
}

async function dataChunkerChunksFromArchive(entries: Map<string, Buffer>): Promise<ParsedDataChunkerDocument> {
  const indexPaths = Array.from(entries.keys()).filter((key) => /(^|\/)index\.json$/i.test(key));
  const chunks: ParsedDataChunkerChunk[] = [];
  let title = "";
  let generated = "";

  for (const indexPath of indexPaths) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(entries.get(indexPath)?.toString("utf8") || "");
    } catch {
      continue;
    }

    if (!isDataChunkerIndex(parsed)) continue;

    title ||= String(parsed[0]?.file_name || path.basename(archiveDirName(indexPath)) || "Data Chunker Pro Import");
    generated ||= String(parsed[0]?.generated || "");

    for (const entry of parsed) {
      const chunkKey = findArchiveChunkEntry(entries, indexPath, entry.actual_filename);
      const markdown = chunkKey ? entries.get(chunkKey)?.toString("utf8") || "" : "";
      chunks.push({
        text: markdown ? parseDataChunkerMarkdownContent(markdown) : compactText(entry.content_preview || ""),
        chunkId: entry.chunk_id,
        chunkName: entry.chunk_name,
        actualFilename: entry.actual_filename,
        contentLength: entry.content_length,
        sourceFile: entry.file_name,
        originalExtension: entry.file_extension,
        generated: entry.generated,
        archivePath: chunkKey || indexPath,
      });
    }
  }

  return { title, generated, chunks };
}

async function readLocalChunkFile(indexDir: string, actualFileName: string | undefined): Promise<string> {
  if (!actualFileName) return "";

  const strippedIndexDir = indexDir.replace(/\.pdf$/i, "");
  const parentDir = path.dirname(indexDir);
  const candidates = [
    path.join(indexDir, actualFileName),
    path.join(strippedIndexDir, actualFileName),
    path.join(parentDir, actualFileName),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // Try the next likely Data Chunker layout.
    }
  }

  try {
    const siblings = await fs.readdir(parentDir, { withFileTypes: true });
    for (const sibling of siblings.filter((entry) => entry.isDirectory())) {
      const candidate = path.join(parentDir, sibling.name, actualFileName);
      try {
        return await fs.readFile(candidate, "utf8");
      } catch {
        // Continue scanning nearby package folders.
      }
    }
  } catch {
    // No sibling scan available.
  }

  return "";
}

async function dataChunkerChunksFromLocalIndex(indexPath: string): Promise<ParsedDataChunkerDocument | null> {
  const raw = await fs.readFile(indexPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!isDataChunkerIndex(parsed)) return null;

  const indexDir = path.dirname(indexPath);
  const chunks: ParsedDataChunkerChunk[] = [];
  for (const entry of parsed) {
    const markdown = await readLocalChunkFile(indexDir, entry.actual_filename);
    chunks.push({
      text: markdown ? parseDataChunkerMarkdownContent(markdown) : compactText(entry.content_preview || ""),
      chunkId: entry.chunk_id,
      chunkName: entry.chunk_name,
      actualFilename: entry.actual_filename,
      contentLength: entry.content_length,
      sourceFile: entry.file_name,
      originalExtension: entry.file_extension,
      generated: entry.generated,
      localIndexPath: indexPath,
    });
  }

  return {
    title: String(parsed[0]?.file_name || path.basename(indexDir) || "Data Chunker Pro Import"),
    generated: String(parsed[0]?.generated || ""),
    chunks,
  };
}

function chunkPageNumber(chunk: ParsedDataChunkerChunk, index: number): number {
  const numeric = typeof chunk.chunkId === "number"
    ? chunk.chunkId
    : Number.parseInt(String(chunk.chunkId || ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : index + 1;
}

async function ensureDocumentSource(
  tx: any,
  document: any,
  chunks: any[],
  contentHash: string,
  adminId: string | null,
  generated: string,
) {
  const [existing] = await tx
    .select()
    .from(sourceRegistry)
    .where(eq(sourceRegistry.documentId, document.id))
    .limit(1);

  if (existing) return existing;

  const evidenceSnippets = chunks
    .map((chunk) => compactText(chunk.cleanText || chunk.rawText))
    .filter(Boolean)
    .map((text) => text.length > 1200 ? `${text.slice(0, 1200)}...` : text)
    .slice(0, 8);

  const [source] = await tx
    .insert(sourceRegistry)
    .values({
      title: document.title,
      sourceKind: "data_chunker_pro",
      sourceType: "rag_chunk_index",
      sourceUri: document.sourceUri,
      driveFileId: document.id,
      documentId: document.id,
      subject: "Data Chunker Pro RAG import",
      edition: generated ? `Data Chunker Pro export ${generated}` : "Data Chunker Pro export",
      citationPolicy: "cite_paraphrase",
      approvalStatus: "approved",
      ingestionStatus: "ready",
      metadata: {
        intakeDocumentId: document.id,
        contentHash,
        importedChunkCount: chunks.length,
        localFileName: document.title,
        evidenceSnippets,
      },
      createdBy: adminId || null,
    })
    .returning();

  return source;
}

async function createCompletedJob(
  tx: any,
  document: any,
  source: any,
  chunkCount: number,
  duplicateDocument: boolean,
) {
  const now = new Date();
  const [job] = await tx
    .insert(documentJobs)
    .values({
      documentId: document.id,
      stage: "indexed",
      status: "completed",
      progress: 100,
      error: null,
      metadata: {
        chunksProcessed: chunkCount,
        totalChunks: chunkCount,
        tokensProcessed: document.totalTokens || 0,
        embeddingsGenerated: 0,
        importer: "data_chunker_pro",
        sourceId: source.id,
        duplicateDocument,
        lastMessage: `Imported ${chunkCount} Data Chunker Pro chunks.`,
        updatedAt: now.toISOString(),
      },
      startedAt: now,
      completedAt: now,
    })
    .returning();

  return job;
}

async function indexDataChunkerChunks({
  title,
  chunks,
  sourceUri,
  generated,
  size = 0,
  adminId,
}: {
  title: string;
  chunks: ParsedDataChunkerChunk[];
  sourceUri: string;
  generated: string;
  size?: number;
  adminId?: string | null;
}): Promise<DataChunkerImportResult | null> {
  const usableChunks = chunks
    .map((chunk) => ({ ...chunk, text: compactText(chunk.text) }))
    .filter((chunk) => chunk.text);

  if (!usableChunks.length) return null;

  const joined = usableChunks.map((chunk) => chunk.text).join("\n\n");
  const contentHash = stableHash(joined);
  const totalTokens = Math.ceil(joined.length / 4);

  return db.transaction(async (tx) => {
    const [existingDocument] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.contentHash, contentHash), eq(documents.type, "data-chunker")))
      .limit(1);

    if (existingDocument) {
      const existingChunks = await tx
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, existingDocument.id))
        .orderBy(asc(documentChunks.chunkIndex));
      const source = await ensureDocumentSource(tx, existingDocument, existingChunks, contentHash, adminId || null, generated);
      const job = await createCompletedJob(tx, existingDocument, source, existingChunks.length, true);
      return { document: existingDocument, documentChunks: existingChunks, source, job };
    }

    const [document] = await tx
      .insert(documents)
      .values({
        title: title || "Data Chunker Pro Import",
        type: "data-chunker",
        sourceUri,
        totalPages: usableChunks.length,
        totalTokens,
        contentHash,
        status: "completed",
        metadata: {
          sourceKind: "data_chunker_pro",
          sourceType: "rag_chunk_index",
          subject: "Data Chunker Pro RAG import",
          edition: generated ? `Data Chunker Pro export ${generated}` : "Data Chunker Pro export",
          generated,
          importedChunkCount: usableChunks.length,
          size,
        },
        uploadedBy: adminId || null,
      })
      .returning();

    const chunkRecords = usableChunks.map((chunk, index) => {
      const page = chunkPageNumber(chunk, index);
      return {
        documentId: document.id,
        chunkIndex: index,
        headingPath: [chunk.chunkName].filter(Boolean),
        pageStart: page,
        pageEnd: page,
        cleanText: chunk.text,
        rawText: chunk.text,
        tokens: Math.max(1, Math.ceil(chunk.text.length / 4)),
        tags: ["data-chunker-pro", chunk.originalExtension, chunk.chunkName].filter(Boolean),
        objectives: [],
        topicIds: [],
        metadata: {
          dataChunkerChunkId: chunk.chunkId,
          chunkName: chunk.chunkName,
          actualFilename: chunk.actualFilename,
          sourceFile: chunk.sourceFile,
          originalExtension: chunk.originalExtension,
          generated: chunk.generated,
          archivePath: chunk.archivePath,
          localIndexPath: chunk.localIndexPath,
          citationLabel: `${title || document.title}, chunk ${chunk.chunkId || index + 1}`,
          contentLength: chunk.contentLength,
        },
      };
    });

    const insertedChunks: any[] = [];
    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      const inserted = await tx.insert(documentChunks).values(batch as any).returning();
      insertedChunks.push(...inserted);
    }

    const source = await ensureDocumentSource(tx, document, insertedChunks, contentHash, adminId || null, generated);
    const job = await createCompletedJob(tx, document, source, insertedChunks.length, false);
    return { document, documentChunks: insertedChunks, source, job };
  });
}

export function isDataChunkerBundleUpload(fileName = "", contentType = ""): boolean {
  const type = inferDocumentType(fileName, contentType);
  return type === "zip" || type === "tar";
}

export async function tryImportDataChunkerUpload({
  fileName,
  contentType = "application/octet-stream",
  buffer,
  sourceUri,
  adminId,
}: {
  fileName: string;
  contentType?: string;
  buffer: Buffer;
  sourceUri?: string;
  adminId?: string | null;
}): Promise<DataChunkerImportResult | null> {
  const type = inferDocumentType(fileName, contentType);

  if (type === "zip" || type === "tar") {
    let parsed: ParsedDataChunkerDocument;
    try {
      const entries = type === "zip" ? await extractZipEntries(buffer) : extractTarEntries(buffer);
      parsed = await dataChunkerChunksFromArchive(entries);
    } catch {
      return null;
    }

    if (parsed.chunks.length) {
      return indexDataChunkerChunks({
        title: parsed.title || fileName,
        chunks: parsed.chunks,
        sourceUri: sourceUri || `data-chunker-upload:${fileName}`,
        generated: parsed.generated,
        size: buffer.length,
        adminId,
      });
    }
    return null;
  }

  if (type === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString("utf8"));
    } catch {
      return null;
    }

    if (isDataChunkerIndex(parsed)) {
      return indexDataChunkerChunks({
        title: String(parsed[0]?.file_name || fileName),
        chunks: parsed.map((entry) => ({
          text: compactText(entry.content_preview || ""),
          chunkId: entry.chunk_id,
          chunkName: entry.chunk_name,
          actualFilename: entry.actual_filename,
          contentLength: entry.content_length,
          sourceFile: entry.file_name,
          originalExtension: entry.file_extension,
          generated: entry.generated,
        })),
        sourceUri: sourceUri || `data-chunker-index:${fileName}`,
        generated: String(parsed[0]?.generated || ""),
        size: buffer.length,
        adminId,
      });
    }
  }

  return null;
}

function isAllowedLocalImportPath(value: string): boolean {
  const resolved = path.resolve(String(value || ""));
  const homeDir = os.homedir();
  const allowedRoots = [
    path.resolve(homeDir, "Documents"),
    path.resolve(homeDir, "Downloads"),
  ];

  return allowedRoots.some((rootPath) => (
    resolved === rootPath || resolved.startsWith(`${rootPath}${path.sep}`)
  ));
}

async function findDataChunkerIndexPaths(startPath: string, maxDepth = 4): Promise<string[]> {
  const resolved = path.resolve(startPath);
  const stat = await fs.stat(resolved);
  if (stat.isFile()) {
    return path.basename(resolved).toLowerCase() === "index.json" ? [resolved] : [];
  }

  const results: string[] = [];
  async function walk(currentPath: string, depth: number) {
    if (depth > maxDepth) return;
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === "index.json") {
        results.push(fullPath);
      } else if (entry.isDirectory() && !["node_modules", ".git"].includes(entry.name)) {
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(resolved, 0);
  return results;
}

export async function importDataChunkerLocalPath(
  localPath: string,
  adminId?: string | null,
): Promise<DataChunkerImportResult[]> {
  if (!isAllowedLocalImportPath(localPath)) {
    throw new Error("Local Data Chunker imports are limited to Documents and Downloads.");
  }

  const indexPaths = await findDataChunkerIndexPaths(localPath);
  const results: DataChunkerImportResult[] = [];
  for (const indexPath of indexPaths) {
    const parsed = await dataChunkerChunksFromLocalIndex(indexPath);
    if (!parsed?.chunks?.length) continue;
    const result = await indexDataChunkerChunks({
      title: parsed.title,
      chunks: parsed.chunks,
      sourceUri: `local-data-chunker:${indexPath}`,
      generated: parsed.generated,
      adminId,
    });
    if (result) results.push(result);
  }
  return results;
}
