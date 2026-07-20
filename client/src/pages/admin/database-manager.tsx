import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, Database, Search, Edit, Trash2, Save, X, 
  RefreshCw, Download, Upload, Home, Code, Eye,
  Plus, Copy, AlertCircle, CheckCircle, Shield, ArrowLeft,
  GraduationCap, ArrowRight, ChevronLeft, ChevronRight,
  ArrowUpDown, Filter
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { useAdminAuth } from "@/lib/admin-auth";

interface TableInfo {
  name: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: any;
  }>;
}

interface TableRow {
  [key: string]: any;
}

export default function DatabaseManager() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { getAdminHeaders, isAuthenticated } = useAdminAuth();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<TableRow>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");

  const adminHeaders = {
    'Content-Type': 'application/json',
    ...getAdminHeaders()
  };

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/database/tables', {
        headers: adminHeaders
      });
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
      toast({
        title: "Error",
        description: "Failed to load database tables",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    setLoading(true);
    setSelectedTable(tableName);
    try {
      const response = await fetch(`/api/admin/database/tables/${tableName}`, {
        headers: adminHeaders
      });
      if (response.ok) {
        const data = await response.json();
        setTableData(data.rows);
        setTableSchema(data.schema);
      }
    } catch (error) {
      console.error('Failed to load table data:', error);
      toast({
        title: "Error",
        description: "Failed to load table data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!sqlQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/database/query', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ query: sqlQuery })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSqlResult(data);
        toast({
          title: "Success",
          description: "Query executed successfully"
        });
      } else {
        toast({
          title: "Query Error",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      toast({
        title: "Error",
        description: "Failed to execute query",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRow = async (tableName: string, rowIndex: number) => {
    try {
      const response = await fetch(`/api/admin/database/tables/${tableName}/update`, {
        method: 'PUT',
        headers: adminHeaders,
        body: JSON.stringify({
          data: editedData,
          original: tableData[rowIndex]
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Row updated successfully"
        });
        await loadTableData(tableName);
        setEditingRow(null);
        setEditedData({});
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update row",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to save row:', error);
      toast({
        title: "Error",
        description: "Failed to save row",
        variant: "destructive"
      });
    }
  };

  const exportTable = async (tableName: string) => {
    try {
      const response = await fetch(`/api/admin/database/tables/${tableName}/export`, {
        headers: adminHeaders
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}-export.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Success",
          description: `Table ${tableName} exported`
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Error",
        description: "Failed to export table",
        variant: "destructive"
      });
    }
  };

  const formatValue = (value: any) => {
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatDisplayValue = (value: any) => {
    if (value === null) return <Badge variant="outline">NULL</Badge>;
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Helper functions for data filtering, sorting, and pagination
  const getFilteredData = () => {
    let filtered = [...tableData];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          value && String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Apply column-specific filter
    if (filterColumn && filterValue) {
      filtered = filtered.filter(row =>
        row[filterColumn] && String(row[filterColumn]).toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn] ?? '';
        const bVal = b[sortColumn] ?? '';
        
        // Try to sort as numbers if possible
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Sort as strings
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  };

  const getFilteredAndPaginatedData = () => {
    const filtered = getFilteredData();
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filtered.slice(startIndex, endIndex);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterColumn, filterValue]);

  return (
    <>
      <AdminNavigation currentPage="Database Manager" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4">
        <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Database Manager</h1>
          <p className="text-gray-600">Browse and manage database tables</p>
        </div>

        <Tabs defaultValue="browser" className="space-y-4">
          <TabsList>
            <TabsTrigger value="browser">
              <Table className="h-4 w-4 mr-2" />
              Table Browser
            </TabsTrigger>
            <TabsTrigger value="query">
              <Code className="h-4 w-4 mr-2" />
              SQL Console
            </TabsTrigger>
            <TabsTrigger value="schema">
              <Database className="h-4 w-4 mr-2" />
              Schema Viewer
            </TabsTrigger>
          </TabsList>

          {/* Table Browser Tab */}
          <TabsContent value="browser">
            <div className="grid md:grid-cols-4 gap-4">
              {/* Table List */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">Tables</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="space-y-1">
                    {loading && !tables.length ? (
                      <p className="text-sm text-gray-500 p-2">Loading...</p>
                    ) : (
                      tables.map(table => (
                        <Button
                          key={table.name}
                          variant={selectedTable === table.name ? "secondary" : "ghost"}
                          className="w-full justify-between text-sm"
                          onClick={() => loadTableData(table.name)}
                        >
                          <span>{table.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {table.rowCount}
                          </Badge>
                        </Button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Table Data */}
              <Card className="md:col-span-3">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {selectedTable || "Select a table"}
                    </CardTitle>
                    {selectedTable && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadTableData(selectedTable)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportTable(selectedTable)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedTable ? (
                    <Alert>
                      <AlertDescription>
                        Select a table from the list to view and edit data
                      </AlertDescription>
                    </Alert>
                  ) : loading ? (
                    <p className="text-center py-8 text-gray-500">Loading table data...</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Search and Filter Controls */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search all columns..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Select value={filterColumn || "all"} onValueChange={(value) => setFilterColumn(value === "all" ? "" : value)}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Filter by column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All columns</SelectItem>
                              {tableSchema.map(col => (
                                <SelectItem key={col.name} value={col.name}>
                                  {col.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {filterColumn && (
                            <Input
                              placeholder={`Filter ${filterColumn}...`}
                              value={filterValue}
                              onChange={(e) => setFilterValue(e.target.value)}
                              className="w-40"
                            />
                          )}
                          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Enhanced Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {tableSchema.map(col => (
                                  <th key={col.name} className="text-left p-3 font-medium">
                                    <div className="flex items-center gap-1">
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900">{col.name}</span>
                                        <span className="text-xs text-gray-500 font-normal">{col.type}</span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 ml-1"
                                        onClick={() => handleSort(col.name)}
                                      >
                                        <ArrowUpDown className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </th>
                                ))}
                                <th className="text-left p-3 w-24">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getFilteredAndPaginatedData().length === 0 ? (
                                <tr>
                                  <td colSpan={tableSchema.length + 1} className="text-center py-8 text-gray-500">
                                    {searchQuery || filterValue ? 'No matching records found' : 'No data in this table'}
                                  </td>
                                </tr>
                              ) : (
                                getFilteredAndPaginatedData().map((row, idx) => {
                                  const actualIdx = (currentPage - 1) * pageSize + idx;
                                  return (
                                    <tr key={actualIdx} className="border-t hover:bg-gray-50">
                                      {tableSchema.map(col => (
                                        <td key={col.name} className="p-3">
                                          {editingRow === actualIdx ? (
                                            <Input
                                              value={editedData[col.name] ?? row[col.name] ?? ''}
                                              onChange={(e) => setEditedData({
                                                ...editedData,
                                                [col.name]: e.target.value
                                              })}
                                              className="h-8"
                                            />
                                          ) : (
                                            <div className="max-w-[200px]">
                                              <span className="block truncate" title={formatValue(row[col.name])}>
                                                {formatDisplayValue(row[col.name])}
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                      ))}
                                      <td className="p-3">
                                        {editingRow === actualIdx ? (
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => saveRow(selectedTable, actualIdx)}
                                            >
                                              <Save className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => {
                                                setEditingRow(null);
                                                setEditedData({});
                                              }}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setEditingRow(actualIdx);
                                              setEditedData(row);
                                            }}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination Controls */}
                      {getFilteredData().length > pageSize && (
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-500">
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, getFilteredData().length)} of {getFilteredData().length} entries
                            {(searchQuery || filterValue) && ` (filtered from ${tableData.length} total)`}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm">
                              Page {currentPage} of {Math.ceil(getFilteredData().length / pageSize)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(Math.min(Math.ceil(getFilteredData().length / pageSize), currentPage + 1))}
                              disabled={currentPage >= Math.ceil(getFilteredData().length / pageSize)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SQL Console Tab */}
          <TabsContent value="query">
            <Card>
              <CardHeader>
                <CardTitle>SQL Console</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>SQL Query</Label>
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="w-full h-32 p-3 border rounded-md font-mono text-sm"
                      placeholder="SELECT * FROM users LIMIT 10;"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={executeQuery} disabled={loading}>
                      <Code className="h-4 w-4 mr-2" />
                      Execute Query
                    </Button>
                    <Button variant="outline" onClick={() => setSqlQuery("")}>
                      Clear
                    </Button>
                  </div>

                  {sqlResult && (
                    <div className="mt-4">
                      <h3 className="font-medium mb-2">Results:</h3>
                      {sqlResult.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{sqlResult.error}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="overflow-x-auto border rounded-lg">
                          {sqlResult.rows && sqlResult.rows.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  {Object.keys(sqlResult.rows[0]).map(key => (
                                    <th key={key} className="text-left p-2 font-medium">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sqlResult.rows.map((row: any, idx: number) => (
                                  <tr key={idx} className="border-t">
                                    {Object.values(row).map((val: any, i) => (
                                      <td key={i} className="p-2">
                                        {formatDisplayValue(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-4 text-center text-gray-500">
                              Query executed successfully. {sqlResult.rowCount || 0} rows affected.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schema Viewer Tab */}
          <TabsContent value="schema">
            <Card>
              <CardHeader>
                <CardTitle>Database Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tables.map(table => (
                    <div key={table.name} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">
                        {table.name}
                        <Badge variant="outline" className="ml-2">
                          {table.rowCount} rows
                        </Badge>
                      </h3>
                      <div className="space-y-1">
                        {table.columns.map(col => (
                          <div key={col.name} className="flex items-center gap-2 text-sm">
                            <span className="font-mono">{col.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {col.type}
                            </Badge>
                            {col.nullable && (
                              <Badge variant="outline" className="text-xs">
                                nullable
                              </Badge>
                            )}
                            {col.default && (
                              <span className="text-xs text-gray-500">
                                default: {col.default}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
}