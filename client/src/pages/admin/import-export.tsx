import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, Download, Database, FileJson, FileText,
  Home, AlertCircle, CheckCircle, Package, Archive
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";
import { useAdminAuth } from "@/lib/admin-auth";

export default function ImportExport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { getAdminHeaders } = useAdminAuth();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [importData, setImportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  const adminHeaders = {
    'Content-Type': 'application/json',
    ...getAdminHeaders()
  };

  const tables = [
    { name: "resources", description: "Learning resources library" },
    { name: "users", description: "User accounts" },
    { name: "assessment_reports", description: "Assessment reports" },
    { name: "performance_records", description: "Performance metrics" },
    { name: "study_plans", description: "Generated study plans" }
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv']
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      
      const file = acceptedFiles[0];
      const text = await file.text();
      
      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          setImportData({
            type: 'json',
            data,
            fileName: file.name,
            rowCount: Array.isArray(data) ? data.length : 1
          });
          toast({
            title: "File loaded",
            description: `Ready to import ${Array.isArray(data) ? data.length : 1} records`
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Invalid JSON file",
            variant: "destructive"
          });
        }
      } else if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, idx) => {
            obj[header] = values[idx]?.trim();
          });
          return obj;
        });
        
        setImportData({
          type: 'csv',
          data,
          fileName: file.name,
          rowCount: data.length
        });
        
        toast({
          title: "File loaded",
          description: `Ready to import ${data.length} records`
        });
      }
    }
  });

  const exportTable = async (format: 'json' | 'csv') => {
    if (!selectedTable) {
      toast({
        title: "Error",
        description: "Please select a table to export",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = format === 'csv' 
        ? `/api/admin/database/tables/${selectedTable}/export`
        : `/api/admin/database/tables/${selectedTable}`;

      const response = await fetch(endpoint, {
        headers: adminHeaders
      });

      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedTable}-export.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data.rows, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedTable}-export.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
        
        toast({
          title: "Export successful",
          description: `${selectedTable} exported as ${format.toUpperCase()}`
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Error",
        description: "Export failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const importToTable = async () => {
    if (!selectedTable || !importData) {
      toast({
        title: "Error",
        description: "Please select a table and load data to import",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/database/tables/${selectedTable}/import`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ data: importData.data })
      });

      if (response.ok) {
        const result = await response.json();
        setImportResults(result);
        toast({
          title: "Import completed",
          description: `${result.inserted} records imported successfully`
        });
      } else {
        const error = await response.json();
        toast({
          title: "Import failed",
          description: error.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Error",
        description: "Import failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAllData = async () => {
    setLoading(true);
    try {
      const exports: any = {};
      
      for (const table of tables) {
        const response = await fetch(`/api/admin/database/tables/${table.name}`, {
          headers: adminHeaders
        });
        
        if (response.ok) {
          const data = await response.json();
          exports[table.name] = data.rows;
        }
      }

      const blob = new Blob([JSON.stringify(exports, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Backup completed",
        description: "All data exported successfully"
      });
    } catch (error) {
      console.error('Backup failed:', error);
      toast({
        title: "Error",
        description: "Backup failed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Import/Export</h1>
              <p className="text-gray-600">Bulk data operations and backups</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate("/admin")}
              data-testid="button-back"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Portal
            </Button>
          </div>
        </div>

        <Tabs defaultValue="export" className="space-y-4">
          <TabsList>
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </TabsTrigger>
            <TabsTrigger value="backup">
              <Archive className="h-4 w-4 mr-2" />
              Backup & Restore
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Select Table</label>
                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a table to export" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map(table => (
                        <SelectItem key={table.name} value={table.name}>
                          <div>
                            <div className="font-medium">{table.name}</div>
                            <div className="text-xs text-gray-500">{table.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => exportTable('csv')}
                    disabled={!selectedTable || loading}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </Button>
                  <Button 
                    onClick={() => exportTable('json')}
                    disabled={!selectedTable || loading}
                    variant="outline"
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </Button>
                </div>

                <Alert>
                  <AlertDescription>
                    CSV format is best for spreadsheet applications.
                    JSON format preserves data types and is ideal for backups.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Target Table</label>
                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose target table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map(table => (
                        <SelectItem key={table.name} value={table.name}>
                          <div>
                            <div className="font-medium">{table.name}</div>
                            <div className="text-xs text-gray-500">{table.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  {isDragActive ? (
                    <p className="text-blue-600">Drop the file here...</p>
                  ) : (
                    <div>
                      <p className="text-gray-600 mb-2">
                        Drag & drop a CSV or JSON file here
                      </p>
                      <p className="text-sm text-gray-500">
                        or click to select file
                      </p>
                    </div>
                  )}
                </div>

                {importData && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{importData.fileName}</strong> loaded
                      <br />
                      {importData.rowCount} records ready to import
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={importToTable}
                  disabled={!selectedTable || !importData || loading}
                  className="w-full"
                >
                  <Database className="h-4 w-4 mr-2" />
                  {loading ? "Importing..." : "Import to Database"}
                </Button>

                {importResults && (
                  <Alert className={importResults.failed > 0 ? "border-orange-200" : ""}>
                    <AlertDescription>
                      <strong>Import Results:</strong>
                      <br />✓ {importResults.inserted} records imported
                      {importResults.failed > 0 && (
                        <>
                          <br />✗ {importResults.failed} records failed
                          {importResults.errors && importResults.errors.length > 0 && (
                            <div className="mt-2 text-xs">
                              {importResults.errors.slice(0, 3).map((err: string, idx: number) => (
                                <div key={idx} className="text-red-600">• {err}</div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Full Backup</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Create a complete backup of all database tables
                  </p>
                  <Button 
                    onClick={exportAllData}
                    disabled={loading}
                    className="w-full"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {loading ? "Creating backup..." : "Create Full Backup"}
                  </Button>
                  <Alert className="mt-4">
                    <AlertDescription>
                      Backups include all tables and preserve relationships.
                      Store backups securely off-site.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedTable("resources");
                      exportTable('json');
                    }}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Export Resources Library
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setSelectedTable("assessment_reports");
                      exportTable('csv');
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export Assessments (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate("/admin/resources")}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Manage Resources
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}