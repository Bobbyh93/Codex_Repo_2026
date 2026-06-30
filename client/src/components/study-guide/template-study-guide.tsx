/**
 * Template-Based Professional Study Guide Component
 * Uses the new template system for advanced study guide generation
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Code, 
  Download, 
  Eye, 
  Target,
  Clock,
  CheckCircle,
  TrendingUp,
  BookOpen
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface StudyGuideFormat {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  mimeType: string;
  extension: string;
}

interface TemplateStudyGuideProps {
  reportId?: string;
}

export function TemplateStudyGuide({ reportId = 'demo-report' }: TemplateStudyGuideProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('html');
  const [studentName, setStudentName] = useState<string>('');
  const [generatedGuide, setGeneratedGuide] = useState<any>(null);
  const { toast } = useToast();

  // Fetch available formats
  const { data: formats = [] } = useQuery({
    queryKey: ['/api/study-guide/formats'],
    queryFn: async () => {
      const response = await fetch('/api/study-guide/formats');
      if (!response.ok) throw new Error('Failed to fetch formats');
      const data = await response.json();
      return data.formats;
    }
  });

  // Format icons mapping
  const formatIcons: Record<string, React.ReactNode> = {
    html: <Code className="h-4 w-4" />,
    markdown: <FileText className="h-4 w-4" />,
    pdf: <FileText className="h-4 w-4" />
  };

  // Generate study guide mutation
  const generateGuide = useMutation({
    mutationFn: async (data: { format: string; studentName: string; reportId: string }) => {
      const response = await fetch('/api/study-guide/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate study guide');
      }
      
      return await response.json();
    },
    onSuccess: (result) => {
      setGeneratedGuide(result);
      toast({
        title: 'Study Guide Generated!',
        description: `Your ${selectedFormat.toUpperCase()} study guide is ready.`
      });
    },
    onError: () => {
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate study guide. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Download study guide mutation
  const downloadGuide = useMutation({
    mutationFn: async (format: string) => {
      const params = new URLSearchParams({
        studentName: studentName || 'student',
        reportId
      });
      
      const response = await fetch(`/api/study-guide/download/${format}?${params}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study-guide-${studentName || 'student'}-${format}${formats.find((f: any) => f.key === format)?.extension || ''}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: 'Download Started',
        description: 'Your study guide is being downloaded.'
      });
    },
    onError: () => {
      toast({
        title: 'Download Failed',
        description: 'Failed to download study guide. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleGenerate = () => {
    generateGuide.mutate({
      format: selectedFormat,
      studentName: studentName || 'NCLEX Student',
      reportId
    });
  };

  const handleDownload = (format: string) => {
    downloadGuide.mutate(format);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Professional Study Guide Generator
        </h1>
        <p className="text-muted-foreground">
          Transform your assessment analysis into a comprehensive, personalized learning program
        </p>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Study Guide Configuration
          </CardTitle>
          <CardDescription>
            Customize your personalized study guide format and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student Name Input */}
            <div className="space-y-2">
              <Label htmlFor="student-name">Student Name</Label>
              <Input
                id="student-name"
                placeholder="Enter your name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <Label htmlFor="format-select">Output Format</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((format: StudyGuideFormat) => (
                    <SelectItem key={format.key} value={format.key}>
                      <div className="flex items-center gap-2">
                        {formatIcons[format.key]}
                        <div>
                          <div className="font-medium">{format.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={generateGuide.isPending}
            className="w-full"
            size="lg"
            data-testid="button-generate-guide"
          >
            {generateGuide.isPending ? (
              <LoadingState 
                size="sm" 
                variant="inline" 
                message="Generating..." 
              />
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Generate Professional Study Guide
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Guide Display */}
      {generatedGuide && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Your Personalized Study Guide
            </CardTitle>
            <CardDescription>
              Generated on {generatedGuide.metadata.generatedAt && !isNaN(new Date(generatedGuide.metadata.generatedAt).getTime()) ? new Date(generatedGuide.metadata.generatedAt).toLocaleDateString() : "—"}
              • {generatedGuide.metadata.totalTopics} topics
              • Est. completion: {generatedGuide.metadata.estimatedCompletionTime}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button variant="outline" onClick={() => handleDownload('html')}>
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
              <Button variant="outline" onClick={() => handleDownload('markdown')}>
                <Download className="h-4 w-4 mr-2" />
                Download Markdown
              </Button>
              <Button variant="outline" onClick={() => handleDownload('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>

            {/* Preview for HTML format */}
            {generatedGuide.format === 'html' && (
              <div 
                className="border rounded-lg p-4 bg-background max-h-96 overflow-auto"
                dangerouslySetInnerHTML={{ __html: generatedGuide.content }}
                data-testid="html-preview"
              />
            )}

            {/* Preview for Markdown format */}
            {generatedGuide.format === 'markdown' && (
              <div className="border rounded-lg p-4 bg-muted">
                <pre 
                  className="whitespace-pre-wrap text-sm max-h-96 overflow-auto"
                  data-testid="markdown-preview"
                >
                  {generatedGuide.content}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="text-center">
            <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <CardTitle className="text-lg">Stage-Based Learning</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Progress through Foundation → Application → Mastery stages with "YOU ARE HERE" mapping
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <CardTitle className="text-lg">Daily Focus Items</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Transform overwhelming topic lists into manageable daily tasks with clear success criteria
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-500" />
            <CardTitle className="text-lg">Success Indicators</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Track what you're doing right vs. what needs work with target score progression
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}