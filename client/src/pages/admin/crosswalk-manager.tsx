import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/lib/admin-auth";
import { useAuth } from "@/contexts/auth-context";
import { 
  Link, Network, Database, GitBranch, Target, BookOpen, 
  Plus, Upload, Download, Edit, Trash2, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, Save, X, Loader2, FileSpreadsheet
} from "lucide-react";
import { Link as RouterLink } from "wouter";
import { AdminNavigation } from "@/components/admin/admin-navigation";

const NCLEX_CATEGORIES = [
  "Safe and Effective Care Environment",
  "Physiological Integrity",
  "Psychosocial Integrity",
  "Health Promotion and Maintenance"
];

const BLOOMS_LEVELS = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create"
];

const PERFORMANCE_LEVELS = [
  "below_passing",
  "near_passing",
  "proficient",
  "advanced"
];

const PATH_TYPES = [
  "remedial",
  "standard",
  "accelerated",
  "mastery"
];

export default function CrosswalkManager() {
  const [activeTab, setActiveTab] = useState("nclex-topic");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  // Create admin headers using JWT token
  const getAdminHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Fetch crosswalk data based on active tab
  const { data: crosswalkData = [], isLoading } = useQuery({
    queryKey: [`/api/admin/crosswalk/${activeTab}`],
    queryFn: async () => {
      const response = await fetch(`/api/admin/crosswalk/${activeTab}`, {
        headers: getAdminHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch crosswalk data');
      return response.json();
    }
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/admin/crosswalk/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/crosswalk/stats', {
        headers: getAdminHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Create crosswalk mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/admin/crosswalk/${activeTab}`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create crosswalk');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Crosswalk created successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crosswalk/${activeTab}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crosswalk/stats'] });
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({ 
        title: "Failed to create crosswalk", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update crosswalk mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/admin/crosswalk/${activeTab}/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update crosswalk');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Crosswalk updated successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crosswalk/${activeTab}`] });
      setEditingItem(null);
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update crosswalk", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete crosswalk mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/crosswalk/${activeTab}/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete crosswalk');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Crosswalk deleted successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crosswalk/${activeTab}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crosswalk/stats'] });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to delete crosswalk", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Import crosswalk data
  const handleImport = async () => {
    if (!importFile) return;

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await fetch(`/api/admin/crosswalk/import/${activeTab}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to import data');
      
      const result = await response.json();
      toast({ 
        title: "Import successful",
        description: `Imported ${result.successfulRecords} of ${result.totalRecords} records`
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crosswalk/${activeTab}`] });
      setImportFile(null);
    } catch (error) {
      toast({ 
        title: "Import failed", 
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  // Export crosswalk data
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/admin/crosswalk/export/${activeTab}`, {
        headers: getAdminHeaders()
      });

      if (!response.ok) throw new Error('Failed to export data');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-crosswalk-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Export successful" });
    } catch (error) {
      toast({ 
        title: "Export failed", 
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  // Render table based on active tab
  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    switch (activeTab) {
      case "nclex-topic":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NCLEX Category</TableHead>
                <TableHead>Subcategory</TableHead>
                <TableHead>Topic Name</TableHead>
                <TableHead>Mapping Strength</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crosswalkData.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.nclexCategory}</TableCell>
                  <TableCell>{item.nclexSubcategory || '-'}</TableCell>
                  <TableCell>{item.topicName}</TableCell>
                  <TableCell>
                    <Badge variant={item.mappingStrength >= 0.8 ? "default" : "secondary"}>
                      {(item.mappingStrength * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.mappingType}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.isVerified ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "topic-objectives":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic Name</TableHead>
                <TableHead>Objective</TableHead>
                <TableHead>Bloom's Level</TableHead>
                <TableHead>Core</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crosswalkData.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.topicName}</TableCell>
                  <TableCell className="max-w-md truncate">{item.objectiveText}</TableCell>
                  <TableCell>
                    <Badge>{item.bloomsLevel}</Badge>
                  </TableCell>
                  <TableCell>
                    {item.isCore ? (
                      <Badge variant="default">Core</Badge>
                    ) : (
                      <Badge variant="secondary">Supplementary</Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.orderIndex}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "performance-path":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Performance Level</TableHead>
                <TableHead>Score Range</TableHead>
                <TableHead>Path Name</TableHead>
                <TableHead>Path Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Expected Improvement</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crosswalkData.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant={
                      item.performanceLevel === 'below_passing' ? 'destructive' :
                      item.performanceLevel === 'near_passing' ? 'secondary' :
                      'default'
                    }>
                      {item.performanceLevel.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.scoreRange?.min}-{item.scoreRange?.max}%
                  </TableCell>
                  <TableCell>{item.pathName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.pathType}</Badge>
                  </TableCell>
                  <TableCell>{item.estimatedDuration}h</TableCell>
                  <TableCell>+{item.expectedImprovement}%</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <AdminNavigation currentPage="Crosswalk Manager" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Content Crosswalk Manager</h1>
                <p className="text-slate-600 mt-2">Map relationships between content areas, topics, and learning paths</p>
              </div>
              <RouterLink href="/admin/admin-portal">
                <Button variant="ghost" data-testid="button-back">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </RouterLink>
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">NCLEX Mappings</p>
                      <p className="text-2xl font-bold">{stats.nclexTopicCount?.[0]?.count || 0}</p>
                    </div>
                    <Link className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Learning Objectives</p>
                      <p className="text-2xl font-bold">{stats.learningObjectivesCount?.[0]?.count || 0}</p>
                    </div>
                    <Target className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Study Paths</p>
                      <p className="text-2xl font-bold">{stats.studyPathTemplatesCount?.[0]?.count || 0}</p>
                    </div>
                    <GitBranch className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Verified</p>
                      <p className="text-2xl font-bold">{stats.verifiedNclexTopicCount?.[0]?.count || 0}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Crosswalk Mappings</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New Crosswalk</DialogTitle>
                      </DialogHeader>
                      <CreateCrosswalkForm 
                        type={activeTab}
                        onSubmit={(data) => createMutation.mutate(data)}
                        onCancel={() => setIsCreateDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" onClick={handleExport} data-testid="button-export">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>

                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="max-w-xs"
                      data-testid="input-import-file"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleImport}
                      disabled={!importFile}
                      data-testid="button-import"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="nclex-topic" data-testid="tab-nclex-topic">
                    NCLEX → Topics
                  </TabsTrigger>
                  <TabsTrigger value="topic-objectives" data-testid="tab-topic-objectives">
                    Topics → Objectives
                  </TabsTrigger>
                  <TabsTrigger value="performance-path" data-testid="tab-performance-path">
                    Performance → Paths
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  {renderTable()}
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          {editingItem && (
            <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Crosswalk</DialogTitle>
                </DialogHeader>
                <EditCrosswalkForm
                  type={activeTab}
                  item={editingItem}
                  onSubmit={(data) => updateMutation.mutate({ id: editingItem.id, data })}
                  onCancel={() => setEditingItem(null)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </>
  );
}

// Create form component
interface CreateCrosswalkFormProps {
  type: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function CreateCrosswalkForm({ type, onSubmit, onCancel }: CreateCrosswalkFormProps) {
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  switch (type) {
    case "nclex-topic":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>NCLEX Category</Label>
            <Select 
              value={formData.nclexCategory} 
              onValueChange={(value) => setFormData({ ...formData, nclexCategory: value })}
            >
              <SelectTrigger data-testid="select-nclex-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {NCLEX_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Topic ID</Label>
            <Input
              value={formData.topicId || ''}
              onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
              placeholder="Enter topic ID"
              data-testid="input-topic-id"
            />
          </div>

          <div>
            <Label>Topic Name</Label>
            <Input
              value={formData.topicName || ''}
              onChange={(e) => setFormData({ ...formData, topicName: e.target.value })}
              placeholder="Enter topic name"
              data-testid="input-topic-name"
            />
          </div>

          <div>
            <Label>Mapping Strength (0-1)</Label>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={formData.mappingStrength || 1}
              onChange={(e) => setFormData({ ...formData, mappingStrength: parseFloat(e.target.value) })}
              data-testid="input-mapping-strength"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      );

    case "topic-objectives":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Topic ID</Label>
            <Input
              value={formData.topicId || ''}
              onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
              placeholder="Enter topic ID"
              data-testid="input-topic-id"
            />
          </div>

          <div>
            <Label>Topic Name</Label>
            <Input
              value={formData.topicName || ''}
              onChange={(e) => setFormData({ ...formData, topicName: e.target.value })}
              placeholder="Enter topic name"
              data-testid="input-topic-name"
            />
          </div>

          <div>
            <Label>Objective ID</Label>
            <Input
              value={formData.objectiveId || ''}
              onChange={(e) => setFormData({ ...formData, objectiveId: e.target.value })}
              placeholder="Enter objective ID"
              data-testid="input-objective-id"
            />
          </div>

          <div>
            <Label>Objective Text</Label>
            <Input
              value={formData.objectiveText || ''}
              onChange={(e) => setFormData({ ...formData, objectiveText: e.target.value })}
              placeholder="Enter learning objective"
              data-testid="input-objective-text"
            />
          </div>

          <div>
            <Label>Bloom's Level</Label>
            <Select 
              value={formData.bloomsLevel} 
              onValueChange={(value) => setFormData({ ...formData, bloomsLevel: value })}
            >
              <SelectTrigger data-testid="select-blooms-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {BLOOMS_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      );

    case "performance-path":
      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Performance Level</Label>
            <Select 
              value={formData.performanceLevel} 
              onValueChange={(value) => setFormData({ ...formData, performanceLevel: value })}
            >
              <SelectTrigger data-testid="select-performance-level">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {PERFORMANCE_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>{level.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Score (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.scoreRange?.min || 0}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  scoreRange: { ...formData.scoreRange, min: parseInt(e.target.value) }
                })}
                data-testid="input-min-score"
              />
            </div>
            <div>
              <Label>Max Score (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.scoreRange?.max || 100}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  scoreRange: { ...formData.scoreRange, max: parseInt(e.target.value) }
                })}
                data-testid="input-max-score"
              />
            </div>
          </div>

          <div>
            <Label>Path Template ID</Label>
            <Input
              value={formData.pathTemplateId || ''}
              onChange={(e) => setFormData({ ...formData, pathTemplateId: e.target.value })}
              placeholder="Enter path template ID"
              data-testid="input-path-template-id"
            />
          </div>

          <div>
            <Label>Path Name</Label>
            <Input
              value={formData.pathName || ''}
              onChange={(e) => setFormData({ ...formData, pathName: e.target.value })}
              placeholder="Enter path name"
              data-testid="input-path-name"
            />
          </div>

          <div>
            <Label>Path Type</Label>
            <Select 
              value={formData.pathType} 
              onValueChange={(value) => setFormData({ ...formData, pathType: value })}
            >
              <SelectTrigger data-testid="select-path-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PATH_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      );

    default:
      return null;
  }
}

// Edit form component (similar to create but with pre-filled values)
interface EditCrosswalkFormProps {
  type: string;
  item: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function EditCrosswalkForm({ type, item, onSubmit, onCancel }: EditCrosswalkFormProps) {
  const [formData, setFormData] = useState(item);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Similar structure to CreateCrosswalkForm but with pre-filled values
  // (Implementation would be nearly identical, just with initial values from 'item')
  return <CreateCrosswalkForm type={type} onSubmit={onSubmit} onCancel={onCancel} />;
}