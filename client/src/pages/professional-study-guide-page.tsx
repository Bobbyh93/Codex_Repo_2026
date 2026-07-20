import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfessionalStudyGuide } from '@/components/study-guide/professional-study-guide';
import { TemplateStudyGuide } from '@/components/study-guide/template-study-guide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText,
  Download,
  Eye,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Sparkles
} from 'lucide-react';
import { Link } from 'wouter';
import { cn } from "@/lib/utils";

interface ProfessionalStudyGuidePageProps {
  params?: { reportId?: string };
}

export function ProfessionalStudyGuidePagePage({ params }: ProfessionalStudyGuidePageProps) {
  const reportId = params?.reportId || 'demo-report';
  const [mode, setMode] = useState<'preview' | 'full'>('preview');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch professional study guide data
  const { data: guide, isLoading, error } = useQuery({
    queryKey: ['/api/generate-professional-guide', reportId],
    queryFn: async () => {
      const response = await fetch('/api/generate-professional-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reportId,
          options: {
            focusOnTopGaps: mode === 'preview',
            maxTopics: mode === 'preview' ? 2 : 10
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate professional study guide');
      }
      
      const result = await response.json();
      return result.guide;
    },
    retry: 1
  });

  // PDF export mutation
  const exportPDF = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/assessment-reports/${reportId}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nclex-success-blueprint.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "Your professional study guide has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "There was an error downloading your study guide. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleExportPDF = () => {
    exportPDF.mutate();
  };

  const handleModeChange = (newMode: 'preview' | 'full') => {
    setMode(newMode);
    // Invalidate query to refetch with new options
    queryClient.invalidateQueries({ queryKey: ['/api/generate-professional-guide', reportId] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState 
          variant="default"
          size="lg"
          message="Generating Your Professional Study Guide"
          submessage="Analyzing your assessment data and creating a personalized NCLEX study plan..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center mobile-p-4">
        <Card className="max-w-md text-center">
          <CardContent className="mobile-p-4">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-priority-high" />
            <h2 className="text-heading-2 mb-2">Unable to Generate Guide</h2>
            <p className="text-body text-muted-foreground mb-4">
              We encountered an error while creating your professional study guide. 
              Please check that your assessment has been processed and try again.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline">
                <Link href="/analytics">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Analytics
                </Link>
              </Button>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/generate-professional-guide', reportId] })}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto mobile-p-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/analytics">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Analytics
                </Link>
              </Button>
              <div>
                <h1 className="text-heading-2">Professional Study Guide</h1>
                <p className="text-body-small text-muted-foreground">
                  AI-powered NCLEX preparation blueprint
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={mode === 'preview' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeChange('preview')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  variant={mode === 'full' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeChange('full')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Full Guide
                </Button>
              </div>
              
              <Button 
                onClick={handleExportPDF}
                disabled={exportPDF.isPending}
                className="touch-target"
              >
                <Download className="h-4 w-4 mr-2" />
                {exportPDF.isPending ? 'Generating...' : 'Export PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Study Guide Content */}
      {guide && (
        <ProfessionalStudyGuide 
          reportId={reportId}
          guide={guide}
          mode={mode}
          onExportPDF={handleExportPDF}
        />
      )}

      {/* Premium Upgrade Notice for Preview Mode */}
      {mode === 'preview' && (
        <div className="border-t bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="max-w-4xl mx-auto mobile-p-4 py-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="mobile-p-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-heading-3 mb-2">Unlock Your Complete Study Blueprint</h3>
                    <p className="text-body text-muted-foreground mb-4">
                      You're viewing a preview focused on your top 2 priority areas. 
                      Upgrade to access your complete personalized study plan with:
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 mb-4">
                      {[
                        { icon: CheckCircle, text: "Complete topic analysis (up to 10 priority areas)" },
                        { icon: FileText, text: "Detailed study resources and reading materials" },
                        { icon: Clock, text: "Comprehensive study timeline and milestones" },
                        { icon: Target, text: "Advanced NCLEX practice questions and simulations" }
                      ].map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <feature.icon className="h-4 w-4 text-success" />
                          <span className="text-body-small">{feature.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button className="touch-target">
                        Upgrade to Premium
                      </Button>
                      <Badge variant="outline" className="bg-warning/10 text-warning">
                        Limited Time: 50% Off
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfessionalStudyGuidePagePage;
