import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ResourceMappingForm } from '@/components/ui/resource-mapping-form';
import { ResourceSuggestionCard } from '@/components/ui/resource-suggestion-card';
import { MappingTable, type ResourceMapping } from '@/components/ui/mapping-table';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Download,
  RefreshCw,
  BarChart3,
  AlertCircle,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';

interface Topic {
  id: string;
  name: string;
}

interface ResourceSuggestion {
  id?: string;
  title: string;
  type: 'video' | 'article' | 'practice' | 'textbook' | 'quiz' | 'simulation';
  description: string;
  url?: string;
  duration?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  provider?: string;
  confidence: number;
  keywords: string[];
}

interface MappingStats {
  totalMappings: number;
  aiSuggestedMappings: number;
  activeMappings: number;
  topicsWithMappings: number;
}

export default function ResourceMapperPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('create');
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[]>([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editingMapping, setEditingMapping] = useState<any>(null);

  // Fetch topics
  const { data: topics = [], isLoading: isLoadingTopics } = useQuery<Topic[]>({
    queryKey: ['/api/admin/topics'],
  });

  // Fetch mappings
  const { data: mappings = [], isLoading: isLoadingMappings, error: mappingsError } = useQuery<ResourceMapping[]>({
    queryKey: ['/api/admin/resources/mappings'],
  });

  // Fetch mapping statistics
  const { data: stats } = useQuery<MappingStats>({
    queryKey: ['/api/admin/resources/mapping-stats'],
  });

  // Create resource mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (data: any) => {
      // First create the resource
      const resourceResponse = await apiRequest('POST', '/api/admin/learning-resources', {
        title: data.resourceTitle,
        type: data.resourceType,
        url: data.url || undefined,
        duration: data.duration,
        topicId: data.topicId,
      });
      const resource = await resourceResponse.json();

      // Then create the mapping
      const mappingResponse = await apiRequest('POST', '/api/admin/resources/mapping', {
        topicId: data.topicId,
        resourceId: resource.resource.id,
        notes: data.notes,
        isAiSuggested: false,
        confidence: 1.0,
      });

      return mappingResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mapping-stats'] });
      toast({
        title: 'Success',
        description: 'Resource mapping created successfully',
      });
      setActiveTab('view');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create resource mapping',
        variant: 'destructive',
      });
    },
  });

  // Delete mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await apiRequest('DELETE', `/api/admin/resources/mapping/${mappingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mapping-stats'] });
      toast({
        title: 'Success',
        description: 'Mapping deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete mapping',
        variant: 'destructive',
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ mappingId, isActive }: { mappingId: string; isActive: boolean }) => {
      await apiRequest('PUT', `/api/admin/resources/mapping/${mappingId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mappings'] });
      toast({
        title: 'Success',
        description: 'Mapping status updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update mapping status',
        variant: 'destructive',
      });
    },
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await apiRequest('POST', '/api/admin/resources/bulk-map', { mappings: data });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mapping-stats'] });
      toast({
        title: 'Success',
        description: `Imported ${data.created} resource mappings`,
      });
      setImportFile(null);
      setActiveTab('view');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import mappings',
        variant: 'destructive',
      });
    },
  });

  // Get AI suggestions
  const handleAiSuggest = useCallback(async (topicId: string, difficulty: string) => {
    const topic = topics.find((t: Topic) => t.id === topicId);
    if (!topic) return;
    
    setIsLoadingSuggestions(true);
    try {
      const response = await apiRequest('POST', '/api/admin/resources/ai-suggest', {
        topicName: topic.name,
        difficulty,
        count: 5,
      });
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to get AI suggestions',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [topics, toast]);

  // Accept AI suggestion
  const handleAcceptSuggestion = useCallback(async (suggestion: ResourceSuggestion) => {
    try {
      // Create the resource
      const resourceResponse = await apiRequest('POST', '/api/admin/learning-resources', {
        title: suggestion.title,
        type: suggestion.type,
        url: suggestion.url,
        duration: suggestion.duration,
      });
      const resource = await resourceResponse.json();

      // Create the mapping with AI flag
      await apiRequest('POST', '/api/admin/resources/mapping', {
        topicId: topics[0]?.id, // You should track which topic the suggestions are for
        resourceId: resource.resource.id,
        isAiSuggested: true,
        confidence: suggestion.confidence,
        notes: `AI-generated resource: ${suggestion.description}`,
      });
      
      const suggestionId = suggestion.id || `suggestion-${suggestion.title}`;
      setAcceptedSuggestions(prev => new Set(prev).add(suggestionId));
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources/mapping-stats'] });
      
      toast({
        title: 'Success',
        description: 'AI suggestion accepted and mapped',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept suggestion',
        variant: 'destructive',
      });
    }
  }, [topics, toast]);

  // Handle delete confirmation
  const handleDelete = (mappingId: string) => {
    setMappingToDelete(mappingId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (mappingToDelete) {
      deleteMappingMutation.mutate(mappingToDelete);
    }
    setDeleteDialogOpen(false);
    setMappingToDelete(null);
  };

  // Export mappings
  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(mappings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `resource-mappings-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: 'Success',
      description: 'Mappings exported successfully',
    });
  }, [mappings, toast]);

  // Handle CSV import
  const handleImportCSV = useCallback(async () => {
    if (!importFile) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',');
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = values[index]?.trim();
            });
            return obj;
          });
        
        bulkImportMutation.mutate(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to parse CSV file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(importFile);
  }, [importFile, bulkImportMutation, toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resource Mapper"
        description="Map learning resources to nursing topics with AI-powered suggestions"
      />

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-mappings">{stats.totalMappings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Suggested</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-ai-mappings">{stats.aiSuggestedMappings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Mappings</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-mappings">{stats.activeMappings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Topics Covered</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-topics-covered">{stats.topicsWithMappings}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" data-testid="tab-create">Create Mapping</TabsTrigger>
          <TabsTrigger value="view" data-testid="tab-view">View Mappings</TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import">Import/Export</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {isLoadingTopics ? (
                <Card>
                  <CardContent className="p-6">
                    <Skeleton className="h-[400px]" />
                  </CardContent>
                </Card>
              ) : (
                <ResourceMappingForm
                  topics={topics}
                  onSubmit={async (data) => { await createMappingMutation.mutateAsync(data); }}
                  onAiSuggest={handleAiSuggest}
                  defaultValues={editingMapping}
                  isEditing={!!editingMapping}
                />
              )}
            </div>
            
            <div>
              <ResourceSuggestionCard
                suggestions={suggestions}
                isLoading={isLoadingSuggestions}
                onAccept={handleAcceptSuggestion}
                onRefresh={() => {
                  setSuggestions([]);
                  setAcceptedSuggestions(new Set());
                }}
                acceptedIds={acceptedSuggestions}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="view" className="space-y-6">
          <MappingTable
            mappings={mappings}
            isLoading={isLoadingMappings}
            error={mappingsError?.message}
            onEdit={(mapping) => {
              setEditingMapping({
                topicId: mapping.topicId,
                resourceTitle: mapping.resourceTitle,
                resourceType: mapping.resourceType,
                url: mapping.resourceUrl,
                difficulty: mapping.difficulty,
                notes: mapping.notes,
              });
              setActiveTab('create');
            }}
            onDelete={handleDelete}
            onToggleActive={(mappingId, isActive) => {
              toggleActiveMutation.mutate({ mappingId, isActive });
            }}
            onExport={handleExport}
          />
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Resource Mappings</CardTitle>
              <CardDescription>
                Upload a CSV or JSON file to bulk import resource mappings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-file">Choose file to import</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  data-testid="input-import-file"
                />
              </div>
              
              {importFile && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ready to import: {importFile.name}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-3">
                <Button
                  onClick={handleImportCSV}
                  disabled={!importFile || bulkImportMutation.isPending}
                  data-testid="button-import"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {bulkImportMutation.isPending ? 'Importing...' : 'Import'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    const template = 'topicId,resourceTitle,resourceType,url,difficulty,notes\n';
                    const blob = new Blob([template], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'resource-mapping-template.csv';
                    a.click();
                    
                    toast({
                      title: 'Template downloaded',
                      description: 'Use this template for bulk imports',
                    });
                  }}
                  data-testid="button-download-template"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Resource Mappings</CardTitle>
              <CardDescription>
                Download current resource mappings as JSON or CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button onClick={handleExport} data-testid="button-export-json">
                  <FileJson className="mr-2 h-4 w-4" />
                  Export as JSON
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    // Convert mappings to CSV
                    const headers = ['topicId', 'topicName', 'resourceTitle', 'resourceType', 'difficulty', 'isActive', 'isAiSuggested'];
                    const csvContent = [
                      headers.join(','),
                      ...mappings.map((m: any) => 
                        headers.map(h => m[h] || '').join(',')
                      )
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `resource-mappings-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    
                    toast({
                      title: 'Success',
                      description: 'Mappings exported as CSV',
                    });
                  }}
                  data-testid="button-export-csv"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the resource mapping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}