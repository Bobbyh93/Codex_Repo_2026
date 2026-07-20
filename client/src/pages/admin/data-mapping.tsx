import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/admin-auth";
import { 
  Map,
  GitBranch,
  Database,
  ArrowRight,
  Search,
  RefreshCw,
  Download,
  Upload,
  Link2,
  CheckCircle,
  AlertCircle,
  Layers,
  Hash,
  FileText,
  Eye,
  Brain,
  BookOpen
} from "lucide-react";

interface TopicMapping {
  source: string;
  target: string;
  confidence: number;
  reviewed: boolean;
}

export default function DataMapping() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMapping, setSelectedMapping] = useState<TopicMapping | null>(null);
  const [mappingMode, setMappingMode] = useState<"auto" | "manual">("auto");
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  // Fetch mapping data
  const { data: mappings } = useQuery({
    queryKey: ["/api/admin/mappings"],
    queryFn: async () => {
      const response = await makeAdminRequest("/api/admin/mappings");
      if (!response.ok) throw new Error("Failed to fetch mappings");
      return response.json();
    },
  });

  const { data: indexStats } = useQuery({
    queryKey: ["/api/admin/index-stats"],
    queryFn: async () => {
      const response = await makeAdminRequest("/api/admin/index-stats");
      if (!response.ok) throw new Error("Failed to fetch index stats");
      return response.json();
    },
  });

  const handleAutoMap = async () => {
    try {
      const response = await makeAdminRequest("/api/admin/mappings/auto", {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Auto-mapping failed");
      
      toast({
        title: "Auto-mapping complete",
        description: "Topics have been automatically mapped based on similarity",
      });
    } catch (error) {
      toast({
        title: "Mapping failed",
        description: "Unable to complete auto-mapping",
        variant: "destructive",
      });
    }
  };

  const handleExportMappings = async () => {
    try {
      const response = await fetch("/api/admin/mappings/export", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'topic-mappings.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Mappings have been exported",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export mappings",
        variant: "destructive",
      });
    }
  };

  const handleReindex = async () => {
    try {
      const response = await fetch("/api/admin/index/rebuild", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });
      
      if (!response.ok) throw new Error("Reindex failed");
      
      toast({
        title: "Reindexing started",
        description: "This may take a few minutes to complete",
      });
    } catch (error) {
      toast({
        title: "Reindex failed",
        description: "Unable to rebuild search index",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Mapping & Indexing</h1>
          <p className="text-muted-foreground">Organize and index content relationships</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indexStats?.totalMappings || 0}</div>
              <p className="text-xs text-muted-foreground">Topic relationships</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Indexed Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indexStats?.indexedItems || 0}</div>
              <p className="text-xs text-muted-foreground">Searchable content</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Duplicates Found</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{indexStats?.duplicates || 0}</div>
              <p className="text-xs text-muted-foreground">Need review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Index Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indexStats?.health || 0}%</div>
              <Progress value={indexStats?.health || 0} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="mapping">
          <TabsList>
            <TabsTrigger value="mapping">Topic Mapping</TabsTrigger>
            <TabsTrigger value="indexing">Search Index</TabsTrigger>
            <TabsTrigger value="quality">Data Quality</TabsTrigger>
            <TabsTrigger value="import-export">Import/Export</TabsTrigger>
          </TabsList>

          <TabsContent value="mapping" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Topic Relationships</CardTitle>
                    <CardDescription>Map topics to resources and content areas</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleAutoMap} data-testid="button-auto-map">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Auto-Map
                    </Button>
                    <Button variant="outline" data-testid="button-manual-map">
                      Manual Mapping
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Visual Mapping Interface */}
                  <div className="border rounded-lg p-6 bg-gray-50">
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">
                          Visual mapping interface
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Drag and drop topics to create relationships
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mapping List */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recent Mappings</h4>
                    <div className="space-y-2">
                      {[
                        { source: "Pharmacology", target: "Drug Administration", confidence: 95 },
                        { source: "Cardiac Assessment", target: "Cardiovascular System", confidence: 88 },
                        { source: "Pediatric Care", target: "Child Development", confidence: 82 },
                      ].map((mapping, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{mapping.source}</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">{mapping.target}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {mapping.confidence}% confidence
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indexing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Search Index Management</CardTitle>
                    <CardDescription>Manage full-text search indexing</CardDescription>
                  </div>
                  <Button onClick={handleReindex} data-testid="button-rebuild-index">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rebuild Index
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search Test */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Test search index..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                        data-testid="input-test-search"
                      />
                    </div>
                  </div>

                  {/* Index Statistics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Index Coverage</h4>
                      <Progress value={85} className="h-2" />
                      <p className="text-xs text-muted-foreground">85% of content indexed</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Search Performance</h4>
                      <Progress value={92} className="h-2" />
                      <p className="text-xs text-muted-foreground">Avg. 45ms response time</p>
                    </div>
                  </div>

                  {/* Indexed Content Types */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Indexed Content Types</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: "Topics", count: 243, icon: Brain },
                        { type: "Resources", count: 1847, icon: BookOpen },
                        { type: "Assessments", count: 523, icon: FileText },
                      ].map((item) => (
                        <div key={item.type} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{item.type}</span>
                          </div>
                          <p className="text-xl font-bold">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Monitoring</CardTitle>
                <CardDescription>Track and improve data integrity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Quality Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">98%</div>
                      <p className="text-xs text-muted-foreground">Completeness</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">94%</div>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">89%</div>
                      <p className="text-xs text-muted-foreground">Consistency</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">91%</div>
                      <p className="text-xs text-muted-foreground">Uniqueness</p>
                    </div>
                  </div>

                  {/* Quality Issues */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Quality Issues</h4>
                    <div className="space-y-2">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Duplicates:</strong> 12 duplicate topics found across different categories
                        </AlertDescription>
                      </Alert>
                      <Alert>
                        <Hash className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Missing Data:</strong> 8 resources lack proper categorization
                        </AlertDescription>
                      </Alert>
                      <Alert>
                        <Link2 className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Broken Links:</strong> 3 external resource URLs are no longer accessible
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import-export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import & Export Data</CardTitle>
                <CardDescription>Backup and transfer content between systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Export Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Export Data</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExportMappings}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Mappings
                      </Button>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export Topics
                      </Button>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export Resources
                      </Button>
                    </div>
                  </div>

                  {/* Import Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Import Data</h4>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drop JSON or CSV files here to import
                      </p>
                      <Button>Select Files</Button>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recent Import/Export Activity</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Download className="h-3 w-3" />
                          <span>Exported 243 topics</span>
                        </div>
                        <span className="text-xs text-muted-foreground">2 hours ago</span>
                      </div>
                      <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Upload className="h-3 w-3" />
                          <span>Imported 50 resources</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Yesterday</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}