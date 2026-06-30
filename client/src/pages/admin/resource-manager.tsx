import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, Plus, Upload, Download, Database, BarChart3,
  Edit, Trash2, Save, X, Filter, BookOpen, Video,
  FileText, Brain, Home, Settings
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

interface Resource {
  id: string;
  title: string;
  type: string;
  url?: string;
  provider?: string;
  duration?: number;
  difficulty: string;
  tags: string[];
  topics: string[];
  diagnoses?: string[];
  systems?: string[];
  keywords: string[];
  metadata: {
    cost?: string;
    rating?: number;
    lastUpdated?: string;
  };
  quality: {
    accuracy?: number;
    relevance?: number;
    engagement?: number;
  };
}

export default function ResourceManager() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Create admin headers using JWT token
  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  useEffect(() => {
    if (token) {
      loadResources();
      loadStatistics();
    }
  }, [token]);

  const loadResources = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/resources', {
        headers: getAdminHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setResources(data.resources);
      }
    } catch (error) {
      console.error('Failed to load resources:', error);
      toast({
        title: "Error",
        description: "Failed to load resources",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/admin/resources/stats', {
        headers: getAdminHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const searchResources = async () => {
    if (!searchQuery) {
      loadResources();
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        ...(selectedType !== 'all' && { type: selectedType }),
        ...(selectedDifficulty !== 'all' && { difficulty: selectedDifficulty })
      });

      const response = await fetch(`/api/admin/resources/search?${params}`, {
        headers: getAdminHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setResources(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Error",
        description: "Search failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveResource = async (resource: Partial<Resource>) => {
    try {
      const url = resource.id 
        ? `/api/admin/resources/${resource.id}`
        : '/api/admin/resources';
      
      const method = resource.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        body: JSON.stringify({
          ...resource,
          tags: resource.tags || [],
          topics: resource.topics || [],
          keywords: resource.keywords || [],
          metadata: resource.metadata || {},
          mappings: {},
          quality: resource.quality || {}
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: resource.id ? "Resource updated" : "Resource added"
        });
        loadResources();
        setIsAddingNew(false);
        setEditingResource(null);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to save resource",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        title: "Error",
        description: "Failed to save resource",
        variant: "destructive"
      });
    }
  };

  const initializeSampleData = async () => {
    try {
      const response = await fetch('/api/admin/resources/init-sample', {
        method: 'POST',
        headers: getAdminHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: `Imported ${data.imported} sample resources`
        });
        loadResources();
        loadStatistics();
      }
    } catch (error) {
      console.error('Failed to initialize sample data:', error);
      toast({
        title: "Error",
        description: "Failed to initialize sample data",
        variant: "destructive"
      });
    }
  };

  const exportResources = async () => {
    try {
      const response = await fetch('/api/admin/resources/export', {
        headers: getAdminHeaders()
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resources-export.json';
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Success",
          description: "Resources exported successfully"
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Error",
        description: "Failed to export resources",
        variant: "destructive"
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'article': return <FileText className="h-4 w-4" />;
      case 'quiz': return <Brain className="h-4 w-4" />;
      case 'practice': return <Brain className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div className="flex gap-2">
              <Button onClick={initializeSampleData} variant="outline">
                <Database className="h-4 w-4 mr-2" />
                Load Sample Data
              </Button>
              <Button onClick={exportResources} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setIsAddingNew(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Resource Library Manager</h1>
          <p className="text-gray-600">Manage and index learning resources</p>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stats.totalResources}</p>
                <p className="text-xs text-gray-600">Total Resources</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stats.topicsCount}</p>
                <p className="text-xs text-gray-600">Topics Covered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stats.freeResources}</p>
                <p className="text-xs text-gray-600">Free Resources</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stats.avgRelevanceScore}%</p>
                <p className="text-xs text-gray-600">Avg Relevance</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stats.diagnosesCount || 0}</p>
                <p className="text-xs text-gray-600">Diagnoses</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchResources()}
                className="flex-1"
              />
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="textbook">Textbook</SelectItem>
                  <SelectItem value="simulation">Simulation</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={searchResources}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Resource Form */}
        {(isAddingNew || editingResource) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                {editingResource ? 'Edit Resource' : 'Add New Resource'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={editingResource?.title || ''}
                    onChange={(e) => setEditingResource({
                      ...editingResource!,
                      title: e.target.value
                    })}
                    placeholder="Resource title"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editingResource?.type || 'video'}
                    onValueChange={(value) => setEditingResource({
                      ...editingResource!,
                      type: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="article">Article</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="practice">Practice</SelectItem>
                      <SelectItem value="textbook">Textbook</SelectItem>
                      <SelectItem value="simulation">Simulation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL</Label>
                  <Input
                    value={editingResource?.url || ''}
                    onChange={(e) => setEditingResource({
                      ...editingResource!,
                      url: e.target.value
                    })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Difficulty</Label>
                  <Select
                    value={editingResource?.difficulty || 'intermediate'}
                    onValueChange={(value) => setEditingResource({
                      ...editingResource!,
                      difficulty: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Topics (comma-separated)</Label>
                  <Input
                    value={editingResource?.topics?.join(', ') || ''}
                    onChange={(e) => setEditingResource({
                      ...editingResource!,
                      topics: e.target.value.split(',').map(t => t.trim())
                    })}
                    placeholder="Pharmacology, Cardiac Nursing, ..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Keywords (comma-separated)</Label>
                  <Input
                    value={editingResource?.keywords?.join(', ') || ''}
                    onChange={(e) => setEditingResource({
                      ...editingResource!,
                      keywords: e.target.value.split(',').map(k => k.trim())
                    })}
                    placeholder="medication, dosage, administration, ..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => saveResource(editingResource!)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" onClick={() => {
                  setEditingResource(null);
                  setIsAddingNew(false);
                }}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resources List */}
        <Card>
          <CardHeader>
            <CardTitle>Resources ({resources.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : resources.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No resources found. Click "Load Sample Data" to get started.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {resources.map((resource) => (
                  <div key={resource.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeIcon(resource.type)}
                          <h3 className="font-medium">{resource.title}</h3>
                          <Badge>{resource.difficulty}</Badge>
                          {resource.metadata?.cost === 'free' && (
                            <Badge variant="outline" className="bg-green-50">Free</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {resource.provider && <span>by {resource.provider} • </span>}
                          {resource.duration && <span>{resource.duration} min • </span>}
                          {resource.metadata?.rating && <span>⭐ {resource.metadata.rating}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {resource.topics?.map((topic, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingResource(resource)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}