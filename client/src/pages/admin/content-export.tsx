import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Database, BookOpen, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'txt';
  contentType: 'topics' | 'assessments' | 'study-guide' | 'priority-analysis';
  includeFields: string[];
  filters?: {
    nclexCategory?: string;
    difficulty?: string;
    bodySystem?: string;
    population?: string;
  };
  groupBy?: string;
  sortBy?: string;
}

interface AvailableOptions {
  formats: string[];
  contentTypes: string[];
  availableFields: { [key: string]: string[] };
}

export default function ContentExport() {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    contentType: 'topics',
    includeFields: [],
    filters: {}
  });
  
  const [availableOptions, setAvailableOptions] = useState<AvailableOptions | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadExportOptions();
  }, []);

  const loadExportOptions = async () => {
    try {
      const response = await apiRequest("GET", "/api/export/options");
      const data = await response.json();
      setAvailableOptions(data);
      
      // Set default fields
      if (data.availableFields[options.contentType]) {
        setOptions(prev => ({
          ...prev,
          includeFields: data.availableFields[options.contentType].slice(0, 4)
        }));
      }
    } catch (error) {
      console.error("Error loading export options:", error);
      toast({
        title: "Error",
        description: "Failed to load export options",
        variant: "destructive"
      });
    }
  };

  const handleContentTypeChange = (contentType: string) => {
    const newOptions = {
      ...options,
      contentType: contentType as any,
      includeFields: availableOptions?.availableFields[contentType]?.slice(0, 4) || []
    };
    setOptions(newOptions);
  };

  const handleFieldToggle = (field: string, checked: boolean) => {
    setOptions(prev => ({
      ...prev,
      includeFields: checked 
        ? [...prev.includeFields, field]
        : prev.includeFields.filter(f => f !== field)
    }));
  };

  const handleExport = async () => {
    if (options.includeFields.length === 0) {
      toast({
        title: "No Fields Selected",
        description: "Please select at least one field to export",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await apiRequest("POST", "/api/export/content", options);
      
      if (response.ok) {
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${options.contentType}_export.${options.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export Successful",
          description: `${options.contentType} data exported as ${options.format.toUpperCase()}`,
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export content",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getContentTypeIcon = (type: string) => {
    const icons: { [key: string]: JSX.Element } = {
      topics: <Database className="w-4 h-4" />,
      assessments: <FileText className="w-4 h-4" />,
      'study-guide': <BookOpen className="w-4 h-4" />,
      'priority-analysis': <TrendingUp className="w-4 h-4" />
    };
    return icons[type] || <FileText className="w-4 h-4" />;
  };

  const getContentTypeDescription = (type: string) => {
    const descriptions: { [key: string]: string } = {
      topics: 'Export all review topics with their details, body systems, and difficulty levels',
      assessments: 'Export assessment report summaries and performance data',
      'study-guide': 'Export structured study guide with key points and study tips',
      'priority-analysis': 'Export topic frequency analysis and priority recommendations'
    };
    return descriptions[type] || '';
  };

  if (!availableOptions) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading export options...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8" data-testid="content-export">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Content Export</h1>
        <p className="text-gray-600">
          Export your nursing review data in various formats with customizable field selection
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select Content Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableOptions.contentTypes.map(type => (
                  <div
                    key={type}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      options.contentType === type 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleContentTypeChange(type)}
                    data-testid={`content-type-${type}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {getContentTypeIcon(type)}
                      <span className="font-medium capitalize">{type.replace('-', ' ')}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {getContentTypeDescription(type)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Field Selection */}
          <Card>
            <CardHeader>
              <CardTitle>2. Select Fields to Include</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {availableOptions.availableFields[options.contentType]?.map(field => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                      id={field}
                      checked={options.includeFields.includes(field)}
                      onCheckedChange={(checked) => handleFieldToggle(field, checked as boolean)}
                      data-testid={`field-${field}`}
                    />
                    <Label 
                      htmlFor={field} 
                      className="text-sm font-medium capitalize cursor-pointer"
                    >
                      {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
              
              {options.includeFields.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-2">Selected fields:</p>
                  <div className="flex flex-wrap gap-2">
                    {options.includeFields.map(field => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Format Selection */}
          <Card>
            <CardHeader>
              <CardTitle>3. Choose Export Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {availableOptions.formats.map(format => (
                  <div
                    key={format}
                    className={`p-3 border rounded-lg cursor-pointer text-center transition-colors ${
                      options.format === format 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setOptions(prev => ({ ...prev, format: format as any }))}
                    data-testid={`format-${format}`}
                  >
                    <div className="font-medium uppercase text-sm">{format}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {format === 'csv' && 'Spreadsheet compatible'}
                      {format === 'json' && 'Machine readable'}
                      {format === 'pdf' && 'Print ready'}
                      {format === 'txt' && 'Plain text'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Advanced Options */}
          <Card>
            <CardHeader>
              <CardTitle>4. Advanced Options (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sortBy" className="text-sm font-medium">Sort By</Label>
                  <Select value={options.sortBy || 'none'} onValueChange={(value) => 
                    setOptions(prev => ({ ...prev, sortBy: value === 'none' ? undefined : value }))
                  }>
                    <SelectTrigger data-testid="select-sort-by">
                      <SelectValue placeholder="Choose sorting field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sorting</SelectItem>
                      {options.includeFields.map(field => (
                        <SelectItem key={field} value={field}>
                          {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="groupBy" className="text-sm font-medium">Group By</Label>
                  <Select value={options.groupBy || 'none'} onValueChange={(value) => 
                    setOptions(prev => ({ ...prev, groupBy: value === 'none' ? undefined : value }))
                  }>
                    <SelectTrigger data-testid="select-group-by">
                      <SelectValue placeholder="Choose grouping field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping</SelectItem>
                      {['nclexCategory', 'difficulty', 'bodySystem'].filter(field => 
                        options.includeFields.includes(field)
                      ).map(field => (
                        <SelectItem key={field} value={field}>
                          {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Content Type:</span>
                  <span className="font-medium capitalize">{options.contentType.replace('-', ' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Format:</span>
                  <span className="font-medium uppercase">{options.format}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fields:</span>
                  <span className="font-medium">{options.includeFields.length}</span>
                </div>
                {options.sortBy && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sort By:</span>
                    <span className="font-medium capitalize">{options.sortBy}</span>
                  </div>
                )}
                {options.groupBy && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Group By:</span>
                    <span className="font-medium capitalize">{options.groupBy}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleExport}
                disabled={isExporting || options.includeFields.length === 0}
                className="w-full"
                data-testid="button-export"
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? "Exporting..." : "Export Content"}
              </Button>

              {options.includeFields.length === 0 && (
                <p className="text-sm text-orange-600 text-center">
                  Select at least one field to enable export
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Export Formats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs space-y-1">
                <div><strong>CSV:</strong> Spreadsheet format, Excel compatible</div>
                <div><strong>JSON:</strong> Structured data, developer friendly</div>
                <div><strong>PDF:</strong> Print-ready document format</div>
                <div><strong>TXT:</strong> Plain text, universal compatibility</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}