import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Eye,
  RefreshCw,
  Trash2,
  Download,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useDeleteDocumentMutation, useReprocessDocumentMutation } from "@/hooks/use-knowledge-base";
import { ChunkViewer } from "./chunk-viewer";

interface Document {
  id: string;
  title: string;
  type: string;
  status: string;
  pageCount?: number;
  chunkCount: number;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  metadata?: any;
}

interface DocumentJob {
  id: string;
  documentId: string;
  status: string;
  stage?: string;
  progress: number;
  error?: string;
}

interface DocumentsTableProps {
  documents: Document[];
  jobs: DocumentJob[];
  isLoading: boolean;
  onRefresh: () => void;
}

const getFileIcon = (type: string) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-4 w-4" />;
    case "docx":
    case "doc":
      return <FileSpreadsheet className="h-4 w-4" />;
    case "pptx":
    case "ppt":
      return <FileImage className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

const getStatusBadge = (status: string, job?: DocumentJob) => {
  if (job && job.status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" />
        {job.stage || "Processing"}
        {job.progress > 0 && ` (${job.progress}%)`}
      </Badge>
    );
  }

  switch (status) {
    case "ready":
      return <Badge variant="default">Ready</Badge>;
    case "processing":
      return <Badge variant="secondary">Processing</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function DocumentsTable({ documents, jobs, isLoading, onRefresh }: DocumentsTableProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [viewingChunks, setViewingChunks] = useState<string | null>(null);
  
  const { toast } = useToast();
  const deleteDocument = useDeleteDocumentMutation();
  const reprocessDocument = useReprocessDocumentMutation();

  const itemsPerPage = 10;

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || doc.type === typeFilter;
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documents, searchQuery, typeFilter, statusFilter]);

  // Paginate documents
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDocuments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDocuments, currentPage]);

  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(new Set(paginatedDocuments.map(d => d.id)));
    } else {
      setSelectedDocuments(new Set());
    }
  };

  const handleSelectDocument = (documentId: string, checked: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (checked) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleDelete = async (documentId: string) => {
    try {
      await deleteDocument.mutateAsync(documentId);
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully",
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const handleReprocess = async (documentId: string) => {
    try {
      await reprocessDocument.mutateAsync(documentId);
      toast({
        title: "Reprocessing started",
        description: "The document is being reprocessed",
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reprocess document",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;
    
    try {
      await Promise.all(Array.from(selectedDocuments).map(id => 
        deleteDocument.mutateAsync(id)
      ));
      toast({
        title: "Documents deleted",
        description: `${selectedDocuments.size} documents have been deleted`,
      });
      setSelectedDocuments(new Set());
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete some documents",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="docx">DOCX</SelectItem>
            <SelectItem value="pptx">PPTX</SelectItem>
            <SelectItem value="txt">TXT</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        {selectedDocuments.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selectedDocuments.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedDocuments.size === paginatedDocuments.length && paginatedDocuments.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {searchQuery || typeFilter !== "all" || statusFilter !== "all" 
                    ? "No documents found matching your filters" 
                    : "No documents uploaded yet"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedDocuments.map((doc) => {
                const job = jobs.find(j => j.documentId === doc.id);
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDocuments.has(doc.id)}
                        onCheckedChange={(checked) => handleSelectDocument(doc.id, checked as boolean)}
                        data-testid={`checkbox-document-${doc.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.type)}
                        <span className="truncate max-w-[200px]">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.pageCount || "-"}</TableCell>
                    <TableCell>{doc.chunkCount}</TableCell>
                    <TableCell>{getStatusBadge(doc.status, job)}</TableCell>
                    <TableCell>{formatFileSize(doc.size)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {doc.uploadedAt && !isNaN(new Date(doc.uploadedAt).getTime()) ? format(new Date(doc.uploadedAt), "MMM dd, yyyy") : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${doc.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setViewingChunks(doc.id)}
                            data-testid={`menu-view-chunks-${doc.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Chunks
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReprocess(doc.id)}
                            disabled={doc.status === "processing"}
                            data-testid={`menu-reprocess-${doc.id}`}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reprocess
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // Download functionality
                              toast({
                                title: "Download started",
                                description: "Your download will begin shortly",
                              });
                            }}
                            data-testid={`menu-download-${doc.id}`}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDocumentToDelete(doc.id);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`menu-delete-${doc.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredDocuments.length)} of{" "}
            {filteredDocuments.length} documents
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8"
                      data-testid={`button-page-${page}`}
                    >
                      {page}
                    </Button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page}>...</span>;
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document
              and all its associated chunks from the knowledge base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => documentToDelete && handleDelete(documentToDelete)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chunk Viewer Dialog */}
      {viewingChunks && (
        <ChunkViewer
          documentId={viewingChunks}
          onClose={() => setViewingChunks(null)}
        />
      )}
    </div>
  );
}