import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Code, Play, Save, Copy, Download, Home, AlertCircle,
  CheckCircle, Clock, Database, FileText, Trash2
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/admin-auth";

interface QueryHistory {
  id: string;
  query: string;
  timestamp: string;
  success: boolean;
  rowCount?: number;
  error?: string;
}

export default function SQLConsole() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { getAdminHeaders, isAuthenticated } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistory[]>([]);
  const [savedQueries, setSavedQueries] = useState<Array<{name: string, query: string}>>([
    { name: "Show all tables", query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" },
    { name: "Count resources", query: "SELECT COUNT(*) as total FROM resources;" },
    { name: "Recent assessments", query: "SELECT * FROM assessment_reports ORDER BY created_at DESC LIMIT 10;" },
    { name: "User statistics", query: "SELECT COUNT(*) as total_users, MAX(created_at) as latest FROM users;" }
  ]);

  const executeQuery = async () => {
    if (!query.trim()) {
      toast({
        title: "Error",
        description: "Please enter a SQL query",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      if (!isAuthenticated()) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/admin/database/query', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      const executionTime = Date.now() - startTime;

      if (response.ok) {
        setResult({
          ...data,
          executionTime,
          query
        });

        // Add to history
        const historyItem: QueryHistory = {
          id: Date.now().toString(),
          query,
          timestamp: new Date().toLocaleString(),
          success: true,
          rowCount: data.rowCount
        };
        setHistory([historyItem, ...history.slice(0, 9)]);

        toast({
          title: "Query executed",
          description: `${data.rowCount || 0} rows affected in ${executionTime}ms`
        });
      } else {
        setResult({
          error: data.error,
          query,
          executionTime
        });

        // Add to history
        const historyItem: QueryHistory = {
          id: Date.now().toString(),
          query,
          timestamp: new Date().toLocaleString(),
          success: false,
          error: data.error
        };
        setHistory([historyItem, ...history.slice(0, 9)]);

        toast({
          title: "Query failed",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Query execution failed:', error);
      setResult({
        error: "Failed to execute query",
        query
      });
      
      toast({
        title: "Error",
        description: "Failed to execute query",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any) => {
    if (value === null) return <Badge variant="outline">NULL</Badge>;
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Query copied to clipboard"
    });
  };

  const exportResults = () => {
    if (!result || !result.rows || result.rows.length === 0) return;

    const headers = Object.keys(result.rows[0]);
    const csvRows = [
      headers.join(','),
      ...result.rows.map((row: any) => 
        headers.map(header => {
          const value = row[header];
          if (value === null) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Results exported as CSV"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">SQL Console</h1>
              <p className="text-gray-600">Execute SQL queries directly on your database</p>
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

        <div className="grid md:grid-cols-3 gap-4">
          {/* Saved Queries Sidebar */}
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved Queries</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {savedQueries.map((sq, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => setQuery(sq.query)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {sq.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Query History */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Recent Queries</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No queries yet</p>
                  ) : (
                    history.map(h => (
                      <div
                        key={h.id}
                        className="p-2 hover:bg-gray-50 rounded cursor-pointer text-xs"
                        onClick={() => setQuery(h.query)}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {h.success ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span className="text-gray-500">{h.timestamp}</span>
                        </div>
                        <p className="font-mono truncate">{h.query}</p>
                        {h.success && h.rowCount !== undefined && (
                          <p className="text-gray-500">{h.rowCount} rows</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Query Area */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Query Editor</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(query)}
                      disabled={!query}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQuery("")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <textarea
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full h-40 p-3 border rounded-md font-mono text-sm bg-slate-50"
                      placeholder="SELECT * FROM users LIMIT 10;"
                      spellCheck={false}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={executeQuery} 
                      disabled={loading || !query.trim()}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Execute Query
                    </Button>
                    {loading && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4 animate-spin" />
                        Executing...
                      </div>
                    )}
                  </div>

                  {/* Results */}
                  {result && (
                    <div className="mt-6">
                      {result.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Error:</strong> {result.error}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium">Results</h3>
                              <Badge variant="outline">
                                {result.rowCount || 0} rows
                              </Badge>
                              {result.executionTime && (
                                <Badge variant="secondary">
                                  {result.executionTime}ms
                                </Badge>
                              )}
                            </div>
                            {result.rows && result.rows.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={exportResults}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export CSV
                              </Button>
                            )}
                          </div>

                          {result.rows && result.rows.length > 0 ? (
                            <div className="overflow-x-auto border rounded-lg">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                  <tr>
                                    {Object.keys(result.rows[0]).map(key => (
                                      <th key={key} className="text-left p-3 font-medium border-b">
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.rows.slice(0, 100).map((row: any, idx: number) => (
                                    <tr key={idx} className="border-b hover:bg-slate-50">
                                      {Object.values(row).map((val: any, i) => (
                                        <td key={i} className="p-3">
                                          {formatValue(val)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {result.rows.length > 100 && (
                                <div className="p-3 text-center text-sm text-gray-500 bg-slate-50">
                                  Showing first 100 rows of {result.rows.length}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Alert>
                              <CheckCircle className="h-4 w-4" />
                              <AlertDescription>
                                Query executed successfully. {result.rowCount || 0} rows affected.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}