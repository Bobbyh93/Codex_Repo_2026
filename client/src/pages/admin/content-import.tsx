import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, FileText, FileSpreadsheet, Code, Type,
  AlertCircle, CheckCircle, RefreshCw, Trash2,
  Download, ArrowRight, Settings, Database, 
  ArrowLeft, Map, Home, FileImage
} from "lucide-react";
import { Link } from "wouter";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/admin-layout";
import { apiRequest } from "@/lib/queryClient";

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

interface ImportConfig {
  fileType: 'csv' | 'markdown' | 'html' | 'text' | 'pdf' | 'docx' | 'pptx';
  mappings: ColumnMapping[];
  options: {
    skipDuplicates: boolean;
    autoTag: boolean;
    chunkSize: number;
    delimiter?: string;
    category?: string;
    tags?: string;
  };
}

export default function ContentImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importConfig, setImportConfig] = useState<ImportConfig>({
    fileType: 'csv',
    mappings: [],
    options: {
      skipDuplicates: true,
      autoTag: true,
      chunkSize: 1000,
      delimiter: ',',
      category: '',
      tags: ''
    }
  });
  const { toast } = useToast();

  const targetFields = [
    'content', 'title', 'category', 'subcategory', 'tags',
    'difficulty', 'source', 'keywords', 'notes'
  ];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setFile(file);
    
    // Detect file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'csv') {
      await parseCSVPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'csv' }));
    } else if (extension === 'md') {
      await parseMarkdownPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'markdown' }));
    } else if (extension === 'html' || extension === 'htm') {
      await parseHTMLPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'html' }));
    } else if (extension === 'pdf') {
      await parsePDFPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'pdf' }));
    } else if (extension === 'docx' || extension === 'doc') {
      await parseDOCXPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'docx' }));
    } else if (extension === 'pptx') {
      await parsePPTXPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'pptx' }));
    } else {
      await parseTextPreview(file);
      setImportConfig(prev => ({ ...prev, fileType: 'text' }));
    }
  }, []);

  const parseCSVPreview = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    setColumns(headers);
    
    // Parse first 5 rows for preview
    const previewData = lines.slice(1, 6).map(line => {
      const values = line.split(',');
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      return row;
    });
    setPreview(previewData);
    
    // Auto-suggest mappings
    const autoMappings: ColumnMapping[] = headers.map(header => ({
      sourceColumn: header,
      targetField: suggestTargetField(header)
    }));
    setMappings(autoMappings);
  };

  const parseMarkdownPreview = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').slice(0, 20);
    setPreview([{ content: lines.join('\n') }]);
  };

  const parseHTMLPreview = async (file: File) => {
    const text = await file.text();
    setPreview([{ content: text.substring(0, 500) + '...' }]);
  };

  const parseTextPreview = async (file: File) => {
    const text = await file.text();
    setPreview([{ content: text.substring(0, 500) + '...' }]);
  };

  const parsePDFPreview = async (file: File) => {
    setPreview([{
      content: [
        `PDF file: ${file.name}`,
        `Size: ${(file.size / 1024).toFixed(2)} KB`,
        'PDF text will be extracted on the server for content mapping.'
      ].join('\n')
    }]);
  };

  const parseDOCXPreview = async (file: File) => {
    setPreview([{
      content: [
        `Word document: ${file.name}`,
        `Size: ${(file.size / 1024).toFixed(2)} KB`,
        'Document text will be extracted on the server for content mapping.'
      ].join('\n')
    }]);
  };

  const parsePPTXPreview = async (file: File) => {
    setPreview([{
      content: [
        `PowerPoint deck: ${file.name}`,
        `Size: ${(file.size / 1024).toFixed(2)} KB`,
        'Slides and speaker notes will be extracted on the server as slide-level content blocks.'
      ].join('\n')
    }]);
  };

  const suggestTargetField = (columnName: string): string => {
    const normalized = columnName.toLowerCase();
    if (normalized.includes('title') || normalized.includes('name')) return 'title';
    if (normalized.includes('category')) return 'category';
    if (normalized.includes('content') || normalized.includes('text')) return 'content';
    if (normalized.includes('tag')) return 'tags';
    if (normalized.includes('difficult')) return 'difficulty';
    return 'content';
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/markdown': ['.md'],
      'text/html': ['.html', '.htm'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/msword': ['.doc']
    },
    multiple: false
  });

  const updateMapping = (index: number, field: 'targetField' | 'transform', value: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setProgress(0);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify({
      ...importConfig,
      mappings
    }));
    
    try {
      const response = await apiRequest('POST', '/api/admin/content/import', formData, { retries: 1, timeout: 120000 });
      const result = await response.json();
      toast({
        title: "Import successful",
        description: `Imported ${result.processed} records successfully`
      });
      setFile(null);
      setPreview([]);
      setMappings([]);
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Please check your file and mappings",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <AdminLayout>
    <div className="p-6 max-w-7xl mx-auto">
      {/* Navigation */}
      <div className="flex gap-2 mb-6">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <Link href="/admin/content-mapper">
          <Button variant="outline" size="sm">
            <Map className="h-4 w-4 mr-2" />
            Content Mapper
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Content Import Center</h1>
        <p className="text-gray-600">
          Import and process content from various formats with intelligent mapping and indexing
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Upload & Config */}
        <div className="lg:col-span-1 space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                  ${file ? 'bg-green-50' : ''}`}
                data-testid="import-dropzone"
              >
                <input {...getInputProps()} />
                {file ? (
                  <>
                    <FileText className="h-12 w-12 mx-auto mb-3 text-green-600" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview([]);
                        setMappings([]);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium">Drop file here or click to browse</p>
                    <p className="text-sm text-gray-500 mt-1">
                      CSV, Markdown, HTML, Text, PDF, Word, or PowerPoint files
                    </p>
                  </>
                )}
              </div>

              {/* File Type Detection */}
              {file && (
                <div className="mt-4">
                  <Label>Detected Format</Label>
                  <div className="flex items-center gap-2 mt-2">
                    {importConfig.fileType === 'csv' && <FileSpreadsheet className="h-4 w-4" />}
                    {importConfig.fileType === 'markdown' && <FileText className="h-4 w-4" />}
                    {importConfig.fileType === 'html' && <Code className="h-4 w-4" />}
                    {importConfig.fileType === 'text' && <Type className="h-4 w-4" />}
                    {importConfig.fileType === 'pdf' && <FileImage className="h-4 w-4" />}
                    {importConfig.fileType === 'docx' && <FileText className="h-4 w-4" />}
                    {importConfig.fileType === 'pptx' && <FileImage className="h-4 w-4" />}
                    <Badge variant="outline">{importConfig.fileType.toUpperCase()}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Options */}
          <Card>
            <CardHeader>
              <CardTitle>Import Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Chunk Size</Label>
                <Input
                  type="number"
                  value={importConfig.options.chunkSize}
                  onChange={(e) => setImportConfig(prev => ({
                    ...prev,
                    options: { ...prev.options, chunkSize: parseInt(e.target.value) }
                  }))}
                  placeholder="1000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Characters per content block
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skip-duplicates"
                  checked={importConfig.options.skipDuplicates}
                  onChange={(e) => setImportConfig(prev => ({
                    ...prev,
                    options: { ...prev.options, skipDuplicates: e.target.checked }
                  }))}
                />
                <Label htmlFor="skip-duplicates">Skip duplicate content</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-tag"
                  checked={importConfig.options.autoTag}
                  onChange={(e) => setImportConfig(prev => ({
                    ...prev,
                    options: { ...prev.options, autoTag: e.target.checked }
                  }))}
                />
                <Label htmlFor="auto-tag">Auto-generate tags</Label>
              </div>

              {importConfig.fileType === 'csv' && (
                <div>
                  <Label>Delimiter</Label>
                  <Select
                    value={importConfig.options.delimiter}
                    onValueChange={(value) => setImportConfig(prev => ({
                      ...prev,
                      options: { ...prev.options, delimiter: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview & Mapping */}
        <div className="lg:col-span-2 space-y-6">
          {file && importConfig.fileType === 'csv' && (
            <>
              {/* Column Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>Column Mapping</CardTitle>
                  <CardDescription>
                    Map CSV columns to database fields
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mappings.map((mapping, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-sm">Source Column</Label>
                          <Badge variant="outline">{mapping.sourceColumn}</Badge>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="flex-1">
                          <Label className="text-sm">Target Field</Label>
                          <Select
                            value={mapping.targetField}
                            onValueChange={(value) => updateMapping(index, 'targetField', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore">[Ignore]</SelectItem>
                              {targetFields.map(field => (
                                <SelectItem key={field} value={field}>
                                  {field}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                  <CardDescription>
                    First 5 rows from your file
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border">
                      <thead>
                        <tr className="bg-gray-50">
                          {columns.map(col => (
                            <th key={col} className="border px-3 py-2 text-left text-sm">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, idx) => (
                          <tr key={idx}>
                            {columns.map(col => (
                              <td key={col} className="border px-3 py-2 text-sm">
                                {row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {file && importConfig.fileType !== 'csv' && (
            <Card>
              <CardHeader>
                <CardTitle>Content Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={preview[0]?.content || ''}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                />
                <div className="mt-4 space-y-3">
                  <div>
                    <Label>Content Category</Label>
                    <Input 
                      placeholder="e.g., Pharmacology, Cardiac Nursing"
                      value={importConfig.options.category || ''}
                      onChange={(e) => setImportConfig(prev => ({
                        ...prev,
                        options: { ...prev.options, category: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input 
                      placeholder="e.g., medication, dosage, safety"
                      value={importConfig.options.tags || ''}
                      onChange={(e) => setImportConfig(prev => ({
                        ...prev,
                        options: { ...prev.options, tags: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Progress */}
          {importing && (
            <Card>
              <CardContent className="py-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Importing...</span>
                    <span className="text-sm text-gray-600">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                  <p className="text-xs text-gray-500">
                    Processing and indexing content blocks...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={!file} onClick={() => {
              setFile(null);
              setPreview([]);
              setMappings([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!file || importing}
              data-testid="button-import"
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Import Content
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Imports */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Import Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { file: 'pharmacology-topics.csv', records: 1250, status: 'completed', date: '2 hours ago' },
              { file: 'cardiac-nursing.md', records: 1, status: 'completed', date: '5 hours ago' },
              { file: 'nclex-questions.csv', records: 3400, status: 'processing', date: '10 minutes ago' },
            ].map((job, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">{job.file}</p>
                    <p className="text-sm text-gray-600">
                      {job.records} records • {job.date}
                    </p>
                  </div>
                </div>
                <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}
