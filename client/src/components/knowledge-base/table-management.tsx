import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Edit3,
  Eye,
  Trash2,
  Download,
  RefreshCw,
  BarChart3,
  FileText,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  Check,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface ExtractedTable {
  id: string;
  documentId: string;
  documentTitle?: string;
  tableIndex: number;
  title: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  status: 'pending' | 'approved' | 'rejected';
  extractionConfidence: number;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
}

interface TableCell {
  rowIndex: number;
  columnIndex: number;
  content: string;
  dataType: string;
  isHeader: boolean;
  editedContent?: string;
}

interface TableStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  high: number;
  medium: number;
  low: number;
}

interface TableStatsResponse {
  summary: TableStats;
  confidenceStats: Pick<TableStats, 'high' | 'medium' | 'low'>;
}

interface TableSearchResponse {
  tables: ExtractedTable[];
  totalPages: number;
}

interface TableCellsResponse {
  cells: TableCell[][];
}

export function TableManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [viewingTable, setViewingTable] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'delete' | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confidenceRange = getConfidenceRange(confidenceFilter);
  const tableSearchParams = new URLSearchParams();

  if (searchQuery) tableSearchParams.set("query", searchQuery);
  if (statusFilter !== "all") tableSearchParams.set("status", statusFilter);
  if (confidenceRange) {
    tableSearchParams.set("confidenceMin", String(confidenceRange.min));
    tableSearchParams.set("confidenceMax", String(confidenceRange.max));
  }
  tableSearchParams.set("page", String(currentPage));
  tableSearchParams.set("limit", "20");

  const tableSearchUrl = `/api/admin/tables/search?${tableSearchParams.toString()}`;

  // Fetch table statistics
  const { data: stats, isLoading: statsLoading } = useQuery<TableStatsResponse>({
    queryKey: ['/api/admin/tables/stats'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch tables with search and filters
  const { data: tablesData, isLoading: tablesLoading, refetch: refetchTables } = useQuery<TableSearchResponse>({
    queryKey: [tableSearchUrl],
    staleTime: 1000 * 30, // 30 seconds
  });

  // Fetch table cells for viewing/editing
  const { data: tableCells } = useQuery<TableCellsResponse>({
    queryKey: ['/api/admin/tables', viewingTable || editingTable, 'cells'],
    enabled: !!(viewingTable || editingTable),
  });

  // Mutations
  const approveTableMutation = useMutation({
    mutationFn: (data: { tableId: string; action: 'approve' | 'reject'; notes?: string }) =>
      apiRequest('POST', '/api/admin/tables/approve', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tables/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tables/stats'] });
      toast({ title: "Success", description: "Table status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update table status", variant: "destructive" });
    }
  });

  const bulkActionMutation = useMutation({
    mutationFn: (data: { tableIds: string[]; action: 'approve' | 'reject' | 'delete'; notes?: string }) =>
      apiRequest('POST', '/api/admin/tables/bulk-action', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tables/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tables/stats'] });
      setSelectedTables([]);
      setBulkAction(null);
      toast({ title: "Success", description: "Bulk action completed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to perform bulk action", variant: "destructive" });
    }
  });

  const editTableMutation = useMutation({
    mutationFn: (data: { tableId: string; edits: Array<{ rowIndex: number; columnIndex: number; newContent: string }> }) =>
      apiRequest('POST', '/api/admin/tables/edit', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tables', editingTable, 'cells'] });
      setEditingTable(null);
      toast({ title: "Success", description: "Table edits saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save table edits", variant: "destructive" });
    }
  });

  // Helper functions
  function getConfidenceRange(filter: string) {
    switch (filter) {
      case 'high': return { min: 0.8, max: 1.0 };
      case 'medium': return { min: 0.5, max: 0.8 };
      case 'low': return { min: 0.0, max: 0.5 };
      default: return undefined;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  }

  function getConfidenceBadge(confidence: number) {
    if (confidence >= 0.8) {
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">High ({Math.round(confidence * 100)}%)</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge variant="secondary">Medium ({Math.round(confidence * 100)}%)</Badge>;
    } else {
      return <Badge variant="destructive">Low ({Math.round(confidence * 100)}%)</Badge>;
    }
  }

  function handleTableSelection(tableId: string, checked: boolean) {
    setSelectedTables(prev => 
      checked ? [...prev, tableId] : prev.filter(id => id !== tableId)
    );
  }

  function handleSelectAll(checked: boolean) {
    if (checked && tablesData?.tables) {
      setSelectedTables(tablesData.tables.map((table: ExtractedTable) => table.id));
    } else {
      setSelectedTables([]);
    }
  }

  function handleApproval(tableId: string, action: 'approve' | 'reject') {
    approveTableMutation.mutate({ tableId, action, notes: approvalNotes });
    setApprovalNotes("");
  }

  function handleBulkAction() {
    if (bulkAction && selectedTables.length > 0) {
      bulkActionMutation.mutate({ 
        tableIds: selectedTables, 
        action: bulkAction, 
        notes: approvalNotes 
      });
      setApprovalNotes("");
    }
  }

  function renderTableGrid(cells: TableCell[][]) {
    if (!cells || cells.length === 0) return <div>No table data available</div>;

    return (
      <div className="overflow-auto max-h-96 border rounded-lg">
        <table className="w-full border-collapse">
          <tbody>
            {cells.map((row, rowIndex) => (
              <tr key={rowIndex} className={row.some(cell => cell.isHeader) ? "bg-muted font-medium" : ""}>
                {row.map((cell, colIndex) => (
                  <td 
                    key={`${rowIndex}-${colIndex}`}
                    className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                  >
                    {editingTable ? (
                      <Input
                        defaultValue={cell.editedContent || cell.content}
                        className="min-w-[100px]"
                        onBlur={(e) => {
                          // Handle cell edit
                          const newContent = e.target.value;
                          if (newContent !== (cell.editedContent || cell.content)) {
                            // Save edit logic would go here
                          }
                        }}
                      />
                    ) : (
                      <span className={cell.isHeader ? "font-semibold" : ""}>
                        {cell.editedContent || cell.content}
                      </span>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {cell.dataType !== 'text' && (
                        <Badge variant="outline" className="h-4 text-xs">{cell.dataType}</Badge>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const tables = tablesData?.tables || [];
  const totalPages = tablesData?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.summary?.pending || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.summary?.approved || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.confidenceStats?.high || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Table Management</CardTitle>
          <CardDescription>Review, approve, and manage extracted tables from documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tables by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-table-search"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-confidence-filter">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">High (80%+)</SelectItem>
                <SelectItem value="medium">Medium (50-80%)</SelectItem>
                <SelectItem value="low">Low (&lt;50%)</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={() => refetchTables()} variant="outline" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedTables.length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedTables.length} table{selectedTables.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="default" onClick={() => setBulkAction('approve')} data-testid="button-bulk-approve">
                      <Check className="h-4 w-4 mr-2" />
                      Approve Selected
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Approve Tables</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to approve {selectedTables.length} selected table{selectedTables.length > 1 ? 's' : ''}?
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Optional notes..."
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
                      <Button onClick={handleBulkAction} disabled={bulkActionMutation.isPending}>
                        {bulkActionMutation.isPending ? "Approving..." : "Approve"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive" onClick={() => setBulkAction('reject')} data-testid="button-bulk-reject">
                      <X className="h-4 w-4 mr-2" />
                      Reject Selected
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reject Tables</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to reject {selectedTables.length} selected table{selectedTables.length > 1 ? 's' : ''}?
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Reason for rejection..."
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
                      <Button variant="destructive" onClick={handleBulkAction} disabled={bulkActionMutation.isPending}>
                        {bulkActionMutation.isPending ? "Rejecting..." : "Reject"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tables List */}
      <Card>
        <CardContent className="p-0">
          {tablesLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading tables...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTables.length === tables.length && tables.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table: ExtractedTable) => (
                  <TableRow key={table.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTables.includes(table.id)}
                        onCheckedChange={(checked) => handleTableSelection(table.id, checked as boolean)}
                        data-testid={`checkbox-table-${table.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{table.title}</div>
                        <div className="text-sm text-muted-foreground">Table {table.tableIndex + 1}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{table.documentTitle}</div>
                    </TableCell>
                    <TableCell>{table.pageNumber}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {table.rowCount} × {table.columnCount}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(table.status)}</TableCell>
                    <TableCell>{getConfidenceBadge(table.extractionConfidence)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {table.createdAt && !isNaN(new Date(table.createdAt).getTime()) ? new Date(table.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setViewingTable(table.id)} data-testid={`button-view-${table.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Table Preview: {table.title}</DialogTitle>
                              <DialogDescription>
                                Document: {table.documentTitle} | Page {table.pageNumber} | Confidence: {Math.round(table.extractionConfidence * 100)}%
                              </DialogDescription>
                            </DialogHeader>
                            {tableCells && renderTableGrid(tableCells.cells)}
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setViewingTable(null)}>Close</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {table.status === 'pending' && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="default" data-testid={`button-approve-${table.id}`}>
                                  <Check className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Approve Table</DialogTitle>
                                  <DialogDescription>
                                    Approve "{table.title}" for inclusion in the knowledge base?
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Optional approval notes..."
                                  value={approvalNotes}
                                  onChange={(e) => setApprovalNotes(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setApprovalNotes("")}>Cancel</Button>
                                  <Button onClick={() => handleApproval(table.id, 'approve')} disabled={approveTableMutation.isPending}>
                                    {approveTableMutation.isPending ? "Approving..." : "Approve"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="destructive" data-testid={`button-reject-${table.id}`}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Table</DialogTitle>
                                  <DialogDescription>
                                    Reject "{table.title}" and exclude it from the knowledge base?
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Reason for rejection..."
                                  value={approvalNotes}
                                  onChange={(e) => setApprovalNotes(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setApprovalNotes("")}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => handleApproval(table.id, 'reject')} disabled={approveTableMutation.isPending}>
                                    {approveTableMutation.isPending ? "Rejecting..." : "Reject"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
