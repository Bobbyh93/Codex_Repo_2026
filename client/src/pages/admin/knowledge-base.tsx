import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DocumentsTable } from "@/components/knowledge-base/documents-table";
import { FileUploader } from "@/components/knowledge-base/file-uploader";
import { SearchInterface } from "@/components/knowledge-base/search-interface";
import { Analytics } from "@/components/knowledge-base/analytics";
import { TableManagement } from "@/components/knowledge-base/table-management";
import { FileText, Upload, Search, BarChart3, RefreshCw, Download, Table, BookOpen, Info } from "lucide-react";
import { useDocumentsQuery, useDocumentJobsQuery } from "@/hooks/use-knowledge-base";

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState(() => 
    sessionStorage.getItem("kb-active-tab") || "documents"
  );
  const [isPolling, setIsPolling] = useState(false);
  const { toast } = useToast();

  // Queries with better error handling
  const { 
    data: documentsData, 
    isLoading: documentsLoading, 
    error: documentsError,
    refetch: refetchDocuments 
  } = useDocumentsQuery();
  
  const { 
    data: jobsData, 
    isLoading: jobsLoading, 
    error: jobsError,
    refetch: refetchJobs 
  } = useDocumentJobsQuery();

  // Extract arrays from response (handle both array and object with nested property)
  // API returns { documents: [...], total, limit, offset } or { jobs: [...], total, limit, offset }
  const documents = Array.isArray(documentsData) ? documentsData : 
    ((documentsData as any)?.documents || (documentsData as any)?.results || []);
  const jobs = Array.isArray(jobsData) ? jobsData : 
    ((jobsData as any)?.jobs || (jobsData as any)?.results || []);
  
  // Better loading state logic - only show loading on initial load
  // Don't show loading if queries have resolved to empty data or have errors
  const isActuallyLoading = (documentsLoading && !documentsData && !documentsError) || 
                           (jobsLoading && !jobsData && !jobsError);
  
  // Handle errors gracefully
  useEffect(() => {
    if (documentsError) {
      console.error('Failed to load documents:', documentsError);
      toast({
        title: "Failed to load documents",
        description: "Please refresh the page or contact support if the problem persists.",
        variant: "destructive",
      });
    }
    if (jobsError) {
      console.error('Failed to load jobs:', jobsError);
    }
  }, [documentsError, jobsError, toast]);

  // Debug logging to identify stuck queries (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('KB Loading State Debug:', {
      documentsLoading,
      jobsLoading,
      documentsData: !!documentsData,
      jobsData: !!jobsData,
      documentsError: !!documentsError,
      jobsError: !!jobsError,
      isActuallyLoading,
      documentsCount: documents.length,
      jobsCount: jobs.length
    });
  }
  
  // Check for active jobs - ensure jobs is an array before filtering
  const activeJobs = Array.isArray(jobs) ? jobs.filter((job: any) => job?.status === "processing") : [];
  
  // Polling for active jobs
  useEffect(() => {
    if (activeJobs.length > 0 && !isPolling) {
      setIsPolling(true);
      const interval = setInterval(() => {
        refetchJobs();
        refetchDocuments();
      }, 5000);

      return () => {
        clearInterval(interval);
        setIsPolling(false);
      };
    }
  }, [activeJobs.length, isPolling, refetchJobs, refetchDocuments]);

  // Save active tab to session storage
  useEffect(() => {
    sessionStorage.setItem("kb-active-tab", activeTab);
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "u":
            e.preventDefault();
            setActiveTab("upload");
            break;
          case "t":
            e.preventDefault();
            setActiveTab("tables");
            break;
          case "s":
            e.preventDefault();
            setActiveTab("search");
            break;
          case "r":
            e.preventDefault();
            refetchDocuments();
            refetchJobs();
            toast({
              title: "Refreshed",
              description: "Data has been refreshed",
            });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [refetchDocuments, refetchJobs, toast]);

  const handleRefresh = () => {
    refetchDocuments();
    refetchJobs();
    toast({
      title: "Refreshed",
      description: "Data has been refreshed successfully",
    });
  };

  const handleExportResults = () => {
    // Export functionality will be implemented with search results
    toast({
      title: "Export started",
      description: "Your export will be ready shortly",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-muted-foreground mt-2">
              Manage documents, test RAG capabilities, and analyze performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeJobs.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {activeJobs.length} active {activeJobs.length === 1 ? "job" : "jobs"}
              </div>
            )}
            <Button onClick={handleExportResults} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="tables" data-testid="tab-tables">
              <Table className="h-4 w-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-search">
              <Search className="h-4 w-4 mr-2" />
              Search & Test
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <DocumentsTable 
              documents={documents} 
              jobs={jobs}
              isLoading={isActuallyLoading}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            {/* File-intake guidance banner */}
            <Card className="p-4 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Import Harrity planning files and nursing source documents
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Drop repaired decks, depth-pass packages, lesson guides, Data Chunker
                    Pro exports, PDFs, DOCX, PPTX, or text files here. Processed files are
                    indexed for search and automatically become selectable sources in the
                    Harrity Lesson Builder.
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3 text-blue-500" />
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Max file size: 100 MB &nbsp;•&nbsp; Supported formats: PDF, DOCX, PPTX, TXT, MD, ZIP, TAR, JSON, CSV
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <FileUploader 
              onUploadComplete={() => {
                refetchDocuments();
                refetchJobs();
                setActiveTab("documents");
              }}
            />
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <TableManagement />
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <SearchInterface documents={documents} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Analytics 
              documents={documents} 
              jobs={jobs}
            />
          </TabsContent>
        </Tabs>

        {/* Keyboard shortcuts hint */}
        <Card className="p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">Keyboard shortcuts:</span>{" "}
            <kbd className="px-2 py-1 text-xs bg-background rounded">Ctrl+U</kbd> Upload •{" "}
            <kbd className="px-2 py-1 text-xs bg-background rounded">Ctrl+T</kbd> Tables •{" "}
            <kbd className="px-2 py-1 text-xs bg-background rounded">Ctrl+S</kbd> Search •{" "}
            <kbd className="px-2 py-1 text-xs bg-background rounded">Ctrl+R</kbd> Refresh
          </p>
        </Card>
      </div>
    </AdminLayout>
  );
}
