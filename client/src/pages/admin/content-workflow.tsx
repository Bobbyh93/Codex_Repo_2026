import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, FileText, ArrowRight, ArrowLeft, Check, 
  Loader2, Brain, Sparkles, Save, ChevronLeft, ChevronRight,
  FileSpreadsheet, Code, Type, FileImage, Home, Shield,
  Database, GraduationCap, CheckCircle
} from "lucide-react";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'upload', title: 'Upload File', description: 'Select and upload your content file' },
  { id: 'processing', title: 'AI Processing', description: 'AI is analyzing and categorizing your content' },
  { id: 'mapping', title: 'Content Mapping', description: 'Review and refine the categorized content' },
  { id: 'complete', title: 'Complete', description: 'Content has been successfully imported' }
];

interface ImportConfig {
  category: string;
  tags: string;
}

interface ContentBlock {
  id: string;
  title?: string;
  description?: string;
  content: string;
  category?: string;
  tags?: string[];
  nursingSpecialty?: string;
  bodySystem?: string;
  concepts?: string[];
}

import { useLocation } from "wouter";
import { AdminNavigation } from "@/components/admin/admin-navigation";

export default function ContentWorkflow() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState<ImportConfig>({ category: '', tags: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedBlocks, setProcessedBlocks] = useState<ContentBlock[]>([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [editedBlock, setEditedBlock] = useState<ContentBlock | null>(null);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    setFile(uploadedFile);
    
    // Auto-fill category and tags based on filename
    const filename = uploadedFile.name.toLowerCase();
    let autoCategory = 'Nursing Content';
    let autoTags = 'nursing';
    
    if (filename.includes('pharm') || filename.includes('drug') || filename.includes('medication')) {
      autoCategory = 'Pharmacology';
      autoTags = 'pharmacology, medication, drugs';
    } else if (filename.includes('assess') || filename.includes('exam') || filename.includes('test')) {
      autoCategory = 'Assessment';
      autoTags = 'assessment, evaluation, testing';
    } else if (filename.includes('med') && filename.includes('surg')) {
      autoCategory = 'Medical-Surgical';
      autoTags = 'medical-surgical, med-surg, adult health';
    } else if (filename.includes('pediatric') || filename.includes('peds')) {
      autoCategory = 'Pediatrics';
      autoTags = 'pediatrics, children, pediatric nursing';
    } else if (filename.includes('maternal') || filename.includes('ob')) {
      autoCategory = 'Maternity';
      autoTags = 'maternity, obstetrics, maternal health';
    } else if (filename.includes('psych') || filename.includes('mental')) {
      autoCategory = 'Mental Health';
      autoTags = 'mental health, psychiatry, behavioral health';
    }
    
    setConfig({ category: autoCategory, tags: autoTags });
    
    // Show success feedback and auto-start processing after 2 seconds
    toast({
      title: "File Accepted",
      description: `${uploadedFile.name} ready for processing`,
    });
    
    setTimeout(() => {
      startProcessing();
    }, 2000);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/markdown': ['.md'],
      'text/html': ['.html', '.htm'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    multiple: false
  });

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'csv') return <FileSpreadsheet className="h-6 w-6" />;
    if (extension === 'md') return <FileText className="h-6 w-6" />;
    if (extension === 'html' || extension === 'htm') return <Code className="h-6 w-6" />;
    if (extension === 'pdf') return <FileImage className="h-6 w-6" />;
    if (extension === 'docx' || extension === 'doc') return <FileText className="h-6 w-6" />;
    return <Type className="h-6 w-6" />;
  };

  const startProcessing = async () => {
    if (!file) return;
    
    setCurrentStep(1);
    setIsProcessing(true);

    try {
      // Upload and process file
      const formData = new FormData();
      formData.append('file', file);
      
      const fileType = file.name.split('.').pop()?.toLowerCase();
      let detectedType = 'text';
      if (fileType === 'csv') detectedType = 'csv';
      else if (fileType === 'md') detectedType = 'markdown';
      else if (fileType === 'html' || fileType === 'htm') detectedType = 'html';
      else if (fileType === 'pdf') detectedType = 'pdf';
      else if (fileType === 'docx' || fileType === 'doc') detectedType = 'docx';

      const importConfig = {
        fileType: detectedType,
        mappings: fileType === 'csv' ? [
          { sourceColumn: 'title', targetField: 'title' },
          { sourceColumn: 'content', targetField: 'content' },
          { sourceColumn: 'category', targetField: 'category' },
          { sourceColumn: 'tags', targetField: 'tags' }
        ] : [],
        options: {
          skipDuplicates: true,
          autoTag: false,
          chunkSize: 1000,
          category: config.category,
          tags: config.tags
        }
      };

      formData.append('config', JSON.stringify(importConfig));

      const response = await fetch('/api/admin/content/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Import failed');

      // Get imported content blocks
      const blocksResponse = await fetch('/api/admin/content/blocks?limit=50&unprocessed=true');
      const blocks = await blocksResponse.json();
      
      if (blocks.length > 0) {
        setProcessedBlocks(blocks);
        setEditedBlock(blocks[0]);
        setCurrentStep(2);
      } else {
        setCurrentStep(3);
      }
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "Please try again",
        variant: "destructive"
      });
      setCurrentStep(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!editedBlock) return;

    try {
      const response = await fetch(`/api/admin/content/blocks/${editedBlock.id}/ai-suggestions`);
      const data = await response.json();
      
      if (data.suggestions) {
        // Apply AI suggestions
        setEditedBlock(prev => ({
          ...prev!,
          title: data.suggestions.title || prev!.title,
          category: data.suggestions.category || prev!.category,
          nursingSpecialty: data.suggestions.nursingSpecialty || prev!.nursingSpecialty,
          bodySystem: data.suggestions.bodySystem || prev!.bodySystem,
          concepts: data.suggestions.concepts || prev!.concepts
        }));
      }
    } catch (error) {
      toast({
        title: "AI analysis failed",
        description: "Please try manual mapping",
        variant: "destructive"
      });
    }
  };

  const saveCurrentBlock = async () => {
    if (!editedBlock) return;

    try {
      const response = await fetch(`/api/admin/content/blocks/${editedBlock.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedBlock)
      });

      if (response.ok) {
        if (currentBlockIndex < processedBlocks.length - 1) {
          const nextIndex = currentBlockIndex + 1;
          setCurrentBlockIndex(nextIndex);
          setEditedBlock(processedBlocks[nextIndex]);
        } else {
          setCurrentStep(3);
        }
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const goToPrevious = () => {
    if (currentBlockIndex > 0) {
      const prevIndex = currentBlockIndex - 1;
      setCurrentBlockIndex(prevIndex);
      setEditedBlock(processedBlocks[prevIndex]);
    }
  };

  const goToNext = () => {
    if (currentBlockIndex < processedBlocks.length - 1) {
      const nextIndex = currentBlockIndex + 1;
      setCurrentBlockIndex(nextIndex);
      setEditedBlock(processedBlocks[nextIndex]);
    }
  };

  const skipToComplete = () => {
    setCurrentStep(3);
  };

  const restart = () => {
    setCurrentStep(0);
    setFile(null);
    setConfig({ category: '', tags: '' });
    setProcessedBlocks([]);
    setEditedBlock(null);
    setCurrentBlockIndex(0);
  };

  return (
    <>
      <AdminNavigation currentPage="Content Workflow" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
        <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Content Import Workflow</h1>
          <p className="text-gray-600">Import and categorize nursing content with AI assistance</p>
        </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {WORKFLOW_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className={`w-20 h-1 mx-2 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">{WORKFLOW_STEPS[currentStep]?.title}</h2>
          <p className="text-gray-600">{WORKFLOW_STEPS[currentStep]?.description}</p>
        </div>
      </div>

      {/* Step Content */}
      <Card className="min-h-[500px]">
        <CardContent className="p-8">
          {/* Step 1: Upload */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2">
                  {isDragActive ? 'Drop your file here' : 'Upload Content File'}
                </h3>
                <p className="text-gray-600 mb-4">
                  Drop your file here or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports CSV, Markdown, HTML, Text, PDF, and Word documents
                </p>
              </div>

              {file && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-green-800">{file.name}</p>
                        <Badge className="bg-green-100 text-green-700 border-green-300">Accepted</Badge>
                      </div>
                      <p className="text-sm text-green-600">
                        {(file.size / 1024).toFixed(2)} KB • Auto-processing in progress...
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-green-800">Content Category (Auto-detected)</Label>
                      <Input 
                        placeholder="e.g., Pharmacology, Assessment"
                        value={config.category}
                        onChange={(e) => setConfig(prev => ({ ...prev, category: e.target.value }))}
                        className="bg-green-50 border-green-300"
                        readOnly
                      />
                    </div>
                    <div>
                      <Label className="text-green-800">Tags (Auto-generated)</Label>
                      <Input 
                        placeholder="e.g., medication, safety, nursing"
                        value={config.tags}
                        onChange={(e) => setConfig(prev => ({ ...prev, tags: e.target.value }))}
                        className="bg-green-50 border-green-300"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="bg-green-100 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                      <span className="text-sm font-medium text-green-800">Automatically starting processing...</span>
                    </div>
                    <Progress value={75} className="h-2" />
                    <p className="text-xs text-green-600 mt-1">
                      File validated • Category detected • Starting AI analysis
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-green-700 mb-2">
                      ✓ No manual input required - processing will begin automatically
                    </p>
                    <Button onClick={startProcessing} disabled variant="outline" size="sm">
                      <Check className="h-4 w-4 mr-2" />
                      Auto-Processing Active
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Processing */}
          {currentStep === 1 && (
            <div className="text-center space-y-6">
              <Loader2 className="h-16 w-16 mx-auto animate-spin text-blue-600" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Processing Your Content</h3>
                <p className="text-gray-600 mb-4">
                  Extracting nursing topics, identifying key concepts, and mapping content to NCLEX categories for optimal learning outcomes.
                </p>
                <div className="max-w-md mx-auto">
                  <Progress value={isProcessing ? 75 : 100} className="mb-2" />
                  <p className="text-sm text-gray-500">
                    {isProcessing ? 'Analyzing content...' : 'Almost complete'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Mapping */}
          {currentStep === 2 && editedBlock && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Content Block {currentBlockIndex + 1} of {processedBlocks.length}</h3>
                  <p className="text-gray-600">Review and refine the AI categorization</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={analyzeWithAI} variant="outline">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Analyze
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Label>Content Preview</Label>
                  <Textarea 
                    value={editedBlock.content}
                    readOnly
                    className="min-h-[200px] bg-gray-50"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input 
                      value={editedBlock.title || ''}
                      onChange={(e) => setEditedBlock(prev => ({ ...prev!, title: e.target.value }))}
                      placeholder="Enter a descriptive title..."
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea 
                      value={editedBlock.description || ''}
                      onChange={(e) => setEditedBlock(prev => ({ ...prev!, description: e.target.value }))}
                      placeholder="Brief description..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Input 
                      value={editedBlock.category || ''}
                      onChange={(e) => setEditedBlock(prev => ({ ...prev!, category: e.target.value }))}
                      placeholder="e.g., Pharmacology, Assessment"
                    />
                  </div>

                  <div>
                    <Label>Nursing Specialty</Label>
                    <Input 
                      value={editedBlock.nursingSpecialty || ''}
                      onChange={(e) => setEditedBlock(prev => ({ ...prev!, nursingSpecialty: e.target.value }))}
                      placeholder="e.g., Medical-Surgical, Pediatrics"
                    />
                  </div>

                  {editedBlock.concepts && editedBlock.concepts.length > 0 && (
                    <div>
                      <Label>AI-Identified Concepts</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editedBlock.concepts.map((concept, idx) => (
                          <Badge key={idx} variant="secondary">{concept}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={goToPrevious}
                    disabled={currentBlockIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={goToNext}
                    disabled={currentBlockIndex === processedBlocks.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={skipToComplete}>
                    Skip Remaining
                  </Button>
                  <Button onClick={saveCurrentBlock}>
                    <Save className="h-4 w-4 mr-2" />
                    Save & Continue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 3 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
                <p className="text-gray-600 mb-6">
                  Your content has been successfully imported and categorized.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={restart}>
                    Import More Content
                  </Button>
                  <Button onClick={() => window.location.href = '/admin/content-mapper'}>
                    Continue Mapping
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
    </>
  );
}
