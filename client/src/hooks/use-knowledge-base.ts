import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken, setCsrfToken } from "@/lib/admin-auth";

// Types
export interface Document {
  id: string;
  title: string;
  type: string;
  status: string;
  content?: string;
  metadata?: any;
  filePath: string;
  contentHash: string;
  uploadedBy: string;
  topicIds?: string[];
  pageCount?: number;
  chunkCount: number;
  size: number;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  cleanText: string;
  embedding?: number[];
  tokenCount: number;
  chunkIndex: number;
  pageStart?: number;
  pageEnd?: number;
  topicIds?: string[];
  tags?: string[];
  metadata?: any;
  contentHash: string;
  createdAt: string;
  documentTitle?: string;
  score?: number;
}

export interface DocumentJob {
  id: string;
  documentId: string;
  status: string;
  stage?: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  processingTime?: number;
  error?: string;
  errorDetails?: any;
  retryCount: number;
  adminId: string;
  createdAt: string;
}

export interface SearchOptions {
  mode?: "semantic" | "keyword" | "hybrid";
  alpha?: number;
  limit?: number;
  offset?: number;
  documentIds?: string[];
  topicIds?: string[];
}

export interface RagAnswer {
  answer: string;
  citations: Array<{
    text: string;
    source: {
      documentId: string;
      title: string;
      pageStart?: number;
      pageEnd?: number;
      chunkId: string;
    };
    relevance: number;
  }>;
  confidence: number;
  relatedTopics: string[];
  queryId: string;
  processingTime: number;
}

// API response type for documents endpoint
interface DocumentsResponse {
  documents: Document[];
  total: number;
  limit: number;
  offset: number;
}

// Queries
export function useDocumentsQuery() {
  return useQuery<DocumentsResponse | Document[]>({
    queryKey: ["/api/admin/knowledge-base/documents"],
    staleTime: 30000,
  });
}

export function useDocumentQuery(documentId: string) {
  return useQuery<Document>({
    queryKey: ["/api/admin/knowledge-base/documents", documentId],
    enabled: !!documentId,
  });
}

export function useDocumentChunksQuery(documentId: string, options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  
  return useQuery<DocumentChunk[]>({
    queryKey: ["/api/admin/knowledge-base/documents", documentId, "chunks", params.toString()],
    enabled: !!documentId,
  });
}

export function useChunkQuery(chunkId: string, options?: { enabled?: boolean }) {
  return useQuery<DocumentChunk>({
    queryKey: ["/api/admin/knowledge-base/chunks", chunkId],
    enabled: options?.enabled !== false && !!chunkId,
  });
}

// API response type for jobs endpoint
interface JobsResponse {
  jobs: DocumentJob[];
  total: number;
  limit: number;
  offset: number;
}

async function ensureAdminCsrfToken(): Promise<string | null> {
  let csrfToken = getCsrfToken();
  if (csrfToken) return csrfToken;

  try {
    const sessionResponse = await fetch('/api/admin/session', {
      credentials: 'include'
    });
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      if (sessionData.csrfToken) {
        setCsrfToken(sessionData.csrfToken);
        return sessionData.csrfToken;
      }
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }

  return null;
}

export function useDocumentJobsQuery(status?: string) {
  const params = status ? `?status=${status}` : "";
  return useQuery<JobsResponse | DocumentJob[]>({
    queryKey: ["/api/admin/knowledge-base/jobs", params],
    refetchInterval: 5000, // Poll every 5 seconds for job updates
  });
}

export function useJobQuery(jobId: string, options?: { refetchInterval?: number | false }) {
  return useQuery<DocumentJob>({
    queryKey: ["/api/admin/knowledge-base/jobs", jobId],
    enabled: !!jobId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useSearchQuery(query: string, options?: SearchOptions & { enabled?: boolean }) {
  const params = new URLSearchParams();
  params.append("q", query);
  if (options?.mode) params.append("mode", options.mode);
  if (options?.alpha !== undefined) params.append("alpha", options.alpha.toString());
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  if (options?.documentIds?.length) params.append("documentIds", options.documentIds.join(","));
  if (options?.topicIds?.length) params.append("topicIds", options.topicIds.join(","));

  return useQuery<DocumentChunk[] | { results?: DocumentChunk[] }, Error, DocumentChunk[]>({
    queryKey: [`/api/admin/knowledge-base/search?${params.toString()}`],
    enabled: options?.enabled !== undefined ? options.enabled : false, // Manual trigger by default
    select: (data) => Array.isArray(data) ? data : data?.results || [],
  });
}

// Mutations
export function useUploadMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      await ensureAdminCsrfToken();
      const response = await apiRequest("POST", "/api/admin/knowledge-base/upload", formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useImportDataChunkerMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (localPath: string) => {
      await ensureAdminCsrfToken();
      const response = await apiRequest("POST", "/api/admin/knowledge-base/import-data-chunker", {
        path: localPath,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/jobs"] });
      toast({
        title: "Data Chunker import complete",
        description: `Imported ${data?.imported ?? 0} ${data?.imported === 1 ? "package" : "packages"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Data Chunker import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDocumentMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (documentId: string) => {
      await ensureAdminCsrfToken();
      const response = await apiRequest("DELETE", `/api/admin/knowledge-base/documents/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been removed from the knowledge base",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useReprocessDocumentMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (documentId: string) => {
      await ensureAdminCsrfToken();
      const response = await apiRequest("POST", `/api/admin/knowledge-base/documents/${documentId}/reprocess`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-base/jobs"] });
      toast({
        title: "Reprocessing started",
        description: "The document is being reprocessed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reprocess failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useGenerateAnswerMutation() {
  const { toast } = useToast();
  
  return useMutation<RagAnswer, Error, { query: string; chunks: DocumentChunk[] }>({
    mutationFn: async ({ query, chunks }) => {
      await ensureAdminCsrfToken();
      const response = await apiRequest("POST", "/api/admin/knowledge-base/generate-answer", {
        query,
        chunks: chunks.map(c => ({
          id: c.id,
          content: c.cleanText || c.content,
          documentId: c.documentId,
          metadata: c.metadata,
        })),
      });
      return response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useExportSearchResultsMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (results: DocumentChunk[]) => {
      await ensureAdminCsrfToken();
      const response = await apiRequest("POST", "/api/admin/knowledge-base/export", {
        results,
        format: "csv",
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `search-results-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Export complete",
        description: "Search results have been exported",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
