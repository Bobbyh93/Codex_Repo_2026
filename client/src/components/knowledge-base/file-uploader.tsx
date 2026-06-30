import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Shield,
  AlertTriangle,
  Info,
  Clock,
  FolderOpen,
} from "lucide-react";
import { useImportDataChunkerMutation, useUploadMutation } from "@/hooks/use-knowledge-base";
import { JobStatusCard } from "./job-status-card";
import { validateFile, quickValidateFile, formatFileSize, type FileValidationResult } from "@shared/file-validation";
import { getCsrfToken, setCsrfToken } from "@/lib/admin-auth";

/**
 * Ensures a valid CSRF token is available, refreshing it from the session
 * endpoint if the in-memory token has been lost (e.g. long-lived tab).
 */
async function ensureCsrfToken(): Promise<string | null> {
  let token = getCsrfToken();
  if (token) return token;

  try {
    const res = await fetch('/api/admin/session', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    }
  } catch {
    // Network failure — upload will proceed without token and server will reject it
  }
  return null;
}

interface UploadFile {
  id: string;
  file: File;
  status: "validating" | "invalid" | "valid" | "uploading" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  jobId?: string;
  validationResult?: FileValidationResult;
  isDuplicate?: boolean;
}

interface FileUploaderProps {
  onUploadComplete?: () => void;
}

const getFileIcon = (detectedType: string | undefined, originalType: string) => {
  const type = detectedType || originalType;
  if (type === "pdf" || type.includes("pdf")) return <FileText className="h-5 w-5" />;
  if (type === "docx" || type.includes("word") || type.includes("docx")) return <FileSpreadsheet className="h-5 w-5" />;
  if (type === "pptx" || type.includes("presentation") || type.includes("pptx")) return <FileImage className="h-5 w-5" />;
  if (type === "zip" || type === "tar" || type.includes("zip") || type.includes("tar")) return <FileSpreadsheet className="h-5 w-5" />;
  if (type === "txt" || type.includes("text")) return <File className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
};

const getValidationIcon = (validationResult?: FileValidationResult) => {
  if (!validationResult) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!validationResult.isValid) return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (validationResult.warnings?.length > 0) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Shield className="h-4 w-4 text-green-600" />;
};

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDropzoneDisabled, setIsDropzoneDisabled] = useState(false);
  const [dataChunkerPath, setDataChunkerPath] = useState("");
  const { toast } = useToast();
  const uploadMutation = useUploadMutation();
  const importDataChunkerMutation = useImportDataChunkerMutation();

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const SUPPORTED_TYPES = ["pdf", "docx", "pptx", "txt", "md", "json", "jsonl", "csv", "zip", "tar"];

  // Check for duplicate files
  const isDuplicateFile = useCallback((newFile: File) => {
    return files.some(f => 
      f.file.name === newFile.name && 
      f.file.size === newFile.size && 
      f.file.lastModified === newFile.lastModified
    );
  }, [files]);

  // Validate file with comprehensive checks
  const validateFileComprehensive = useCallback(async (file: File): Promise<FileValidationResult> => {
    try {
      // First do quick validation
      const quickResult = quickValidateFile(file);
      if (!quickResult.isValid) {
        return quickResult;
      }

      // Then do full validation with magic bytes
      const fullResult = await validateFile(file);
      return fullResult;
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        size: file.size
      };
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files from react-dropzone
    rejectedFiles.forEach((rejection) => {
      const { file, errors } = rejection;
      const errorMessage = errors.map((e: any) => e.message).join(", ");
      toast({
        title: "File rejected by dropzone",
        description: `${file.name}: ${errorMessage}`,
        variant: "destructive",
      });
    });

    // Process all files (both accepted and rejected) with our validation
    const allFiles = [...acceptedFiles, ...rejectedFiles.map(r => r.file)];
    
    for (const file of allFiles) {
      // Check for duplicates
      if (isDuplicateFile(file)) {
        toast({
          title: "Duplicate file",
          description: `${file.name} is already in the upload queue`,
          variant: "destructive",
        });
        continue;
      }

      // Add file with validating status
      const uploadFile: UploadFile = {
        id: crypto.randomUUID(),
        file,
        status: "validating",
        progress: 0,
      };

      setFiles((prev) => [...prev, uploadFile]);

      // Start validation
      validateAndProcessFile(uploadFile);
    }
  }, [isDuplicateFile]);

  // Validate and process file
  const validateAndProcessFile = useCallback(async (uploadFile: UploadFile) => {
    try {
      const validationResult = await validateFileComprehensive(uploadFile.file);
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: validationResult.isValid ? "valid" : "invalid",
                validationResult,
              }
            : f
        )
      );

      // Show validation feedback
      if (!validationResult.isValid) {
        toast({
          title: "File validation failed",
          description: `${uploadFile.file.name}: ${validationResult.errors[0]}`,
          variant: "destructive",
        });
      } else if (validationResult.warnings?.length > 0) {
        toast({
          title: "File validation warning",
          description: `${uploadFile.file.name}: ${validationResult.warnings[0]}`,
          variant: "destructive",
        });
      } else {
        // Auto-start upload for valid files
        handleUpload({ ...uploadFile, validationResult, status: "valid" });
      }
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: "invalid",
                error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              }
            : f
        )
      );
    }
  }, [validateFileComprehensive]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Remove accept and maxSize from dropzone to let our custom validation handle it
    multiple: true,
    disabled: isDropzoneDisabled,
    noClick: isDropzoneDisabled,
    noDrag: isDropzoneDisabled,
  });

  // Disable dropzone when files are processing
  useEffect(() => {
    const processingFiles = files.filter(f => 
      f.status === "uploading" || f.status === "processing" || f.status === "validating"
    );
    setIsDropzoneDisabled(processingFiles.length >= 3); // Limit concurrent processing
  }, [files]);

  const handleUpload = async (uploadFile: UploadFile) => {
    // Only upload valid files
    if (uploadFile.status !== "valid" || !uploadFile.validationResult?.isValid) {
      return;
    }

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: "uploading" as const, progress: 10 } : f
      )
    );

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("document", uploadFile.file);

      // Use XMLHttpRequest for real progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 90); // Reserve 10% for server processing
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id && f.status === "uploading"
                ? { ...f, progress }
                : f
            )
          );
        }
      });

      // Handle completion
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
      });

      // Configure request
      xhr.timeout = 300000; // 5 minutes
      xhr.open('POST', '/api/admin/knowledge-base/upload');
      xhr.withCredentials = true;

      // Attach CSRF token (required by the upload endpoint).
      // ensureCsrfToken() will re-fetch from /api/admin/session if the
      // in-memory token was lost (e.g. after a long-lived tab refresh).
      const csrfToken = await ensureCsrfToken();
      if (csrfToken) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }

      // Send request
      xhr.send(formData);
      
      const result = await uploadPromise;

      // Update to processing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "processing" as const, progress: 100, jobId: result.jobId }
            : f
        )
      );

      // Poll for job completion
      pollJobStatus(uploadFile.id, result.jobId);
    } catch (error: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "failed" as const, error: error.message || "Upload failed" }
            : f
        )
      );

      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const pollJobStatus = async (fileId: string, jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/knowledge-base/jobs/${jobId}`);
        const job = await response.json();

        if (job.status === "completed") {
          clearInterval(pollInterval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: "completed" as const } : f
            )
          );
          
          toast({
            title: "Upload complete",
            description: "Document has been processed successfully",
          });

          if (onUploadComplete) {
            onUploadComplete();
          }
        } else if (job.status === "failed") {
          clearInterval(pollInterval);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: "failed" as const, error: job.error || "Processing failed" }
                : f
            )
          );

          toast({
            title: "Processing failed",
            description: job.error || "Failed to process document",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleRetry = (uploadFile: UploadFile) => {
    if (uploadFile.validationResult?.isValid) {
      // If validation was successful, retry upload
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "valid" as const, progress: 0, error: undefined } : f
        )
      );
      handleUpload({ ...uploadFile, status: "valid", progress: 0, error: undefined });
    } else {
      // Re-validate the file
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "validating" as const, progress: 0, error: undefined } : f
        )
      );
      validateAndProcessFile({ ...uploadFile, status: "validating", progress: 0, error: undefined });
    }
  };

  const handleForceUpload = (uploadFile: UploadFile) => {
    // Force upload even with warnings
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: "valid" as const, progress: 0, error: undefined } : f
      )
    );
    handleUpload({ ...uploadFile, status: "valid", progress: 0, error: undefined });
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
  };

  const handleImportDataChunkerPath = async () => {
    const localPath = dataChunkerPath.trim();
    if (!localPath) {
      toast({
        title: "Path required",
        description: "Enter a Data Chunker Pro output folder or index.json path.",
        variant: "destructive",
      });
      return;
    }

    try {
      await importDataChunkerMutation.mutateAsync(localPath);
      setDataChunkerPath("");
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch {
      // Mutation-level error handling shows the toast.
    }
  };

  const completedCount = files.filter((f) => f.status === "completed").length;
  const processingCount = files.filter((f) => f.status === "processing" || f.status === "uploading" || f.status === "validating").length;
  const invalidCount = files.filter((f) => f.status === "invalid").length;
  const validCount = files.filter((f) => f.status === "valid").length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <FolderOpen className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-semibold">Import Data Chunker Pro folder</h4>
              <p className="text-sm text-muted-foreground">
                Import a local Data Chunker output folder or index.json from Documents or Downloads.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={dataChunkerPath}
                onChange={(event) => setDataChunkerPath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleImportDataChunkerPath();
                  }
                }}
                placeholder="C:/Users/bobby/Documents/NCLEX Review Manuals - ATI/..."
                data-testid="input-data-chunker-path"
                disabled={importDataChunkerMutation.isPending}
              />
              <Button
                type="button"
                onClick={handleImportDataChunkerPath}
                disabled={importDataChunkerMutation.isPending || !dataChunkerPath.trim()}
                data-testid="button-import-data-chunker"
                className="sm:w-auto"
              >
                {importDataChunkerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import Folder
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={`border-2 border-dashed p-8 text-center transition-colors ${
          isDropzoneDisabled 
            ? "border-muted-foreground/25 bg-muted/50 cursor-not-allowed" 
            : isDragActive 
            ? "border-primary bg-primary/5 cursor-pointer" 
            : "border-muted-foreground/25 hover:border-primary/50 cursor-pointer"
        }`}
      >
        <input {...getInputProps()} data-testid="input-file-upload" disabled={isDropzoneDisabled} />
        <Upload className={`h-12 w-12 mx-auto mb-4 ${
          isDropzoneDisabled ? "text-muted-foreground/50" : "text-muted-foreground"
        }`} />
        <h3 className="text-lg font-semibold mb-2">
          {isDropzoneDisabled
            ? "Upload area temporarily disabled"
            : isDragActive 
            ? "Drop files here" 
            : "Drag & drop files here"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isDropzoneDisabled
            ? "Please wait for current uploads to complete"
            : "or click to browse files"}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="secondary">PDF</Badge>
          <Badge variant="secondary">DOCX</Badge>
          <Badge variant="secondary">PPTX</Badge>
          <Badge variant="secondary">TXT/MD</Badge>
          <Badge variant="secondary">ZIP/TAR</Badge>
          <Badge variant="secondary">JSON/CSV</Badge>
          <span className="text-sm text-muted-foreground">• Max 100MB per file</span>
        </div>
        {isDropzoneDisabled && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                Processing {processingCount} file(s). Upload area will be re-enabled when processing completes.
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Upload Queue */}
      {files.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">
              Upload Queue ({files.length} {files.length === 1 ? "file" : "files"})
            </h4>
            {completedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCompleted}
                data-testid="button-clear-completed"
              >
                Clear completed ({completedCount})
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {files.map((uploadFile) => (
              <div key={uploadFile.id} className={`border rounded-lg p-3 ${
                uploadFile.status === "invalid" ? "border-destructive/50 bg-destructive/5" :
                uploadFile.status === "valid" ? "border-green-500/50 bg-green-50 dark:bg-green-900/20" :
                uploadFile.status === "completed" ? "border-green-500 bg-green-50 dark:bg-green-900/20" :
                ""
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getFileIcon(uploadFile.validationResult?.detectedType, uploadFile.file.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{uploadFile.file.name}</p>
                        {getValidationIcon(uploadFile.validationResult)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(uploadFile.file.size)}</span>
                        {uploadFile.validationResult?.detectedType && (
                          <>
                            <span>•</span>
                            <span className="uppercase">{uploadFile.validationResult.detectedType}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadFile.status === "completed" && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" data-testid={`status-completed-${uploadFile.id}`} />
                    )}
                    {uploadFile.status === "failed" && (
                      <AlertCircle className="h-5 w-5 text-destructive" data-testid={`status-failed-${uploadFile.id}`} />
                    )}
                    {uploadFile.status === "invalid" && (
                      <AlertCircle className="h-5 w-5 text-destructive" data-testid={`status-invalid-${uploadFile.id}`} />
                    )}
                    {(uploadFile.status === "uploading" || uploadFile.status === "processing" || uploadFile.status === "validating") && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" data-testid={`status-loading-${uploadFile.id}`} />
                    )}
                    {(uploadFile.status === "failed" || uploadFile.status === "invalid") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(uploadFile)}
                        data-testid={`button-retry-${uploadFile.id}`}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {uploadFile.status === "valid" && uploadFile.validationResult?.warnings && uploadFile.validationResult.warnings.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleForceUpload(uploadFile)}
                        data-testid={`button-force-upload-${uploadFile.id}`}
                        title="Upload despite warnings"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(uploadFile.id)}
                      data-testid={`button-remove-${uploadFile.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Validation Results */}
                {uploadFile.validationResult && (
                  <div className="space-y-2 mt-2">
                    {uploadFile.validationResult.errors?.length > 0 && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                        <div className="flex items-center gap-1 font-medium text-destructive mb-1">
                          <AlertCircle className="h-3 w-3" />
                          Validation Errors:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-destructive/80">
                          {uploadFile.validationResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {uploadFile.validationResult.warnings?.length > 0 && (
                      <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs">
                        <div className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300 mb-1">
                          <AlertTriangle className="h-3 w-3" />
                          Validation Warnings:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-amber-600 dark:text-amber-400">
                          {uploadFile.validationResult.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress */}
                {(uploadFile.status === "uploading" || uploadFile.status === "processing" || uploadFile.status === "validating") && (
                  <div className="space-y-1 mt-2">
                    <Progress value={uploadFile.progress} className="h-2" data-testid={`progress-${uploadFile.id}`} />
                    <p className="text-xs text-muted-foreground">
                      {uploadFile.status === "validating" ? "Validating file..." :
                       uploadFile.status === "uploading" ? `Uploading... ${uploadFile.progress}%` : 
                       "Processing — chunking text and generating embeddings…"}
                    </p>
                    {uploadFile.status === "processing" && uploadFile.file.size > 20 * 1024 * 1024 && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>Large file detected — processing may take several minutes. Please keep this tab open.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Job Status for Processing */}
                {uploadFile.status === "processing" && uploadFile.jobId && (
                  <div className="mt-2">
                    <JobStatusCard jobId={uploadFile.jobId} compact />
                  </div>
                )}

                {/* Generic Error */}
                {uploadFile.error && !uploadFile.validationResult && (
                  <p className="text-xs text-destructive mt-2" data-testid={`error-${uploadFile.id}`}>{uploadFile.error}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-semibold">Upload Information</h4>
          {(invalidCount > 0 || validCount > 0 || processingCount > 0) && (
            <div className="flex items-center gap-2 text-xs">
              {validCount > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {validCount} valid
                </Badge>
              )}
              {invalidCount > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {invalidCount} invalid
                </Badge>
              )}
              {processingCount > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {processingCount} processing
                </Badge>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium mb-2">Supported File Types</h5>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                <span>PDF Documents (.pdf)</span>
              </div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3" />
                <span>Word Documents (.docx)</span>
              </div>
              <div className="flex items-center gap-2">
                <FileImage className="h-3 w-3" />
                <span>PowerPoint (.pptx)</span>
              </div>
              <div className="flex items-center gap-2">
                <File className="h-3 w-3" />
                <span>Text and Markdown Files (.txt, .md)</span>
              </div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3" />
                <span>Data Chunker/RAG Bundles (.zip, .tar, .json, .jsonl, .csv)</span>
              </div>
            </div>
          </div>
          
          <div>
            <h5 className="font-medium mb-2">Validation Features</h5>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-green-600" />
                <span>Magic bytes validation</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-green-600" />
                <span>File size limit (100MB)</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-green-600" />
                <span>Content verification</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-green-600" />
                <span>Duplicate detection</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          Files undergo comprehensive validation including magic bytes verification to prevent spoofed extensions.
          All files are automatically chunked and indexed for optimal search performance.
        </p>
      </Card>
    </div>
  );
}
