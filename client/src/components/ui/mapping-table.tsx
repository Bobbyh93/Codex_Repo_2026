import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  Filter,
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles
} from 'lucide-react';

interface ResourceMapping {
  id: string;
  topicId: string;
  topicName: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: string;
  resourceUrl?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  mappedBy: string;
  mappedAt: string;
  isActive: boolean;
  isAiSuggested: boolean;
  confidence?: number;
  notes?: string;
}

interface MappingTableProps {
  mappings: ResourceMapping[];
  isLoading?: boolean;
  error?: string;
  onEdit?: (mapping: ResourceMapping) => void;
  onDelete?: (mappingId: string) => void;
  onToggleActive?: (mappingId: string, isActive: boolean) => void;
  onExport?: () => void;
}

type SortField = 'topicName' | 'resourceTitle' | 'mappedAt' | 'confidence';
type SortDirection = 'asc' | 'desc';

export function MappingTable({
  mappings,
  isLoading,
  error,
  onEdit,
  onDelete,
  onToggleActive,
  onExport
}: MappingTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('mappedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedMappings = useMemo(() => {
    let filtered = [...mappings];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        m =>
          m.topicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.resourceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(m => m.resourceType === filterType);
    }

    // Apply difficulty filter
    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(m => m.difficulty === filterDifficulty);
    }

    // Apply source filter
    if (filterSource === 'ai') {
      filtered = filtered.filter(m => m.isAiSuggested);
    } else if (filterSource === 'manual') {
      filtered = filtered.filter(m => !m.isAiSuggested);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'mappedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortField === 'confidence') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [mappings, searchTerm, filterType, filterDifficulty, filterSource, sortField, sortDirection]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const resourceTypes = [...new Set(mappings.map(m => m.resourceType))];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Resource Mappings</CardTitle>
            <CardDescription>
              {filteredAndSortedMappings.length} of {mappings.length} mappings
            </CardDescription>
          </div>
          {onExport && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onExport}
              data-testid="button-export-mappings"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search mappings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-mappings"
                />
              </div>
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {resourceTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="ai">AI Suggested</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('topicName')}
                      className="-ml-3"
                      data-testid="button-sort-topic"
                    >
                      Topic
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('resourceTitle')}
                      className="-ml-3"
                      data-testid="button-sort-resource"
                    >
                      Resource
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('confidence')}
                      className="-ml-3"
                      data-testid="button-sort-confidence"
                    >
                      Confidence
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('mappedAt')}
                      className="-ml-3"
                      data-testid="button-sort-date"
                    >
                      Mapped
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No mappings found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedMappings.map((mapping) => (
                    <TableRow key={mapping.id} data-testid={`row-mapping-${mapping.id}`}>
                      <TableCell className="font-medium">
                        <div className="max-w-[200px]">
                          <p className="truncate" data-testid={`text-topic-${mapping.id}`}>{mapping.topicName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[250px]">
                          <p className="truncate font-medium" data-testid={`text-resource-${mapping.id}`}>
                            {mapping.resourceTitle}
                          </p>
                          {mapping.resourceUrl && (
                            <a
                              href={mapping.resourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                              data-testid={`link-resource-${mapping.id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Resource
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {mapping.resourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={`text-xs ${
                            mapping.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                            mapping.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}
                        >
                          {mapping.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mapping.isActive ? (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          {mapping.isAiSuggested && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {mapping.confidence !== undefined ? (
                          <div className="flex items-center gap-1">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-purple-500 h-2 rounded-full"
                                style={{ width: `${mapping.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round(mapping.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-500">
                          {mapping.mappedAt && !isNaN(new Date(mapping.mappedAt).getTime()) ? new Date(mapping.mappedAt).toLocaleDateString() : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-actions-${mapping.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {onToggleActive && (
                              <DropdownMenuItem 
                                onClick={() => onToggleActive(mapping.id, !mapping.isActive)}
                                data-testid={`button-toggle-active-${mapping.id}`}
                              >
                                {mapping.isActive ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                            )}
                            {onEdit && (
                              <DropdownMenuItem 
                                onClick={() => onEdit(mapping)}
                                data-testid={`button-edit-${mapping.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {onDelete && (
                              <DropdownMenuItem 
                                onClick={() => onDelete(mapping.id)}
                                className="text-red-600"
                                data-testid={`button-delete-${mapping.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}