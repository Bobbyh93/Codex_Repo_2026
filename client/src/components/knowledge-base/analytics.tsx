import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Hash,
  HardDrive,
  Search,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Document {
  id: string;
  title: string;
  type: string;
  status: string;
  size: number;
  chunkCount: number;
  pageCount?: number;
  uploadedAt: string;
}

interface Job {
  id: string;
  status: string;
  processingTime?: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

interface AnalyticsProps {
  documents: Document[];
  jobs: Job[];
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function Analytics({ documents, jobs }: AnalyticsProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const totalDocuments = documents.length;
    const totalChunks = documents.reduce((acc, doc) => acc + doc.chunkCount, 0);
    const totalSize = documents.reduce((acc, doc) => acc + doc.size, 0);
    const totalPages = documents.reduce((acc, doc) => acc + (doc.pageCount || 0), 0);

    const documentsByType = documents.reduce((acc, doc) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const documentsByStatus = documents.reduce((acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedJobs = jobs.filter(j => j.status === "completed");
    const failedJobs = jobs.filter(j => j.status === "failed");
    const successRate = jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0;

    const avgProcessingTime = completedJobs.length > 0
      ? completedJobs.reduce((acc, job) => acc + (job.processingTime || 0), 0) / completedJobs.length
      : 0;

    // Recent uploads by day
    const uploadsByDay = documents.reduce((acc, doc) => {
      const date = doc.uploadedAt && !isNaN(new Date(doc.uploadedAt).getTime()) ? format(new Date(doc.uploadedAt), "MMM dd") : "Unknown";
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentUploads = Object.entries(uploadsByDay)
      .map(([date, count]) => ({ date, count }))
      .slice(-7);

    return {
      totalDocuments,
      totalChunks,
      totalSize,
      totalPages,
      documentsByType,
      documentsByStatus,
      successRate,
      avgProcessingTime,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      recentUploads,
    };
  }, [documents, jobs]);

  const pieChartData = Object.entries(stats.documentsByType).map(([type, count]) => ({
    name: type.toUpperCase(),
    value: count,
  }));

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  const recentQueries = [
    { query: "nursing care plans", count: 42, avgTime: 230, date: "2024-01-15" },
    { query: "medication administration", count: 38, avgTime: 195, date: "2024-01-15" },
    { query: "patient assessment", count: 35, avgTime: 210, date: "2024-01-14" },
    { query: "infection control", count: 31, avgTime: 180, date: "2024-01-14" },
    { query: "clinical procedures", count: 28, avgTime: 250, date: "2024-01-13" },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalPages} pages total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChunks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg {Math.round(stats.totalChunks / (stats.totalDocuments || 1))} per document
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
            <p className="text-xs text-muted-foreground">
              Avg {formatBytes(stats.totalSize / (stats.totalDocuments || 1))} per doc
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedJobs} successful, {stats.failedJobs} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Document Types Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Document Types</CardTitle>
            <CardDescription>Distribution of uploaded document types</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px]">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Activity</CardTitle>
            <CardDescription>Documents uploaded in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentUploads.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.recentUploads}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px]">
                <p className="text-muted-foreground">No recent uploads</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Processing Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Performance</CardTitle>
          <CardDescription>Job processing statistics and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedJobs}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Failed</p>
                  <p className="text-2xl font-bold">{stats.failedJobs}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Avg Time</p>
                  <p className="text-2xl font-bold">
                    {(stats.avgProcessingTime / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Success Rate</span>
                <span className="font-medium">{stats.successRate.toFixed(1)}%</span>
              </div>
              <Progress value={stats.successRate} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Search Queries */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Search Queries</CardTitle>
          <CardDescription>Most frequently searched topics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Avg Response Time</TableHead>
                <TableHead>Last Searched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentQueries.map((query) => (
                <TableRow key={query.query}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      {query.query}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{query.count}</Badge>
                  </TableCell>
                  <TableCell>{query.avgTime}ms</TableCell>
                  <TableCell className="text-muted-foreground">
                    {query.date && !isNaN(new Date(query.date).getTime()) ? format(new Date(query.date), "MMM dd, yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Storage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Breakdown</CardTitle>
          <CardDescription>Storage usage by document type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.documentsByType).map(([type, count]) => {
              const typeSize = documents
                .filter((d) => d.type === type)
                .reduce((acc, d) => acc + d.size, 0);
              const percentage = (typeSize / stats.totalSize) * 100;

              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase">
                        {type}
                      </Badge>
                      <span>{count} documents</span>
                    </div>
                    <span className="font-medium">{formatBytes(typeSize)}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}