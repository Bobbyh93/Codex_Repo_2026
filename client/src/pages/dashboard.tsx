import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import FileUpload from "@/components/ui/file-upload";
import GapAnalysisChart from "@/components/charts/gap-analysis-chart";
import PerformanceTrendsChart from "@/components/charts/performance-trends-chart";
import DataCarousel from "@/components/carousel/data-carousel";
import ExtractedTopicsList from "@/components/tables/extracted-topics-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Filter, Bell, User, Target } from "lucide-react";

export default function Dashboard() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { data: reports } = useQuery({
    queryKey: ["/api/assessment-reports"],
  });

  const { data: contentAreas } = useQuery({
    queryKey: ["/api/content-areas"],
  });

  const { data: topicPerformance } = useQuery({
    queryKey: ["/api/assessment-reports", selectedReportId, "topic-performance"],
    enabled: !!selectedReportId,
  });

  const { data: contentAreaPerformance } = useQuery({
    queryKey: ["/api/assessment-reports", selectedReportId, "content-area-performance"],
    enabled: !!selectedReportId,
  });

  const handleReportUploaded = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleExportCSV = () => {
    if (selectedReportId) {
      window.open(`/api/assessment-reports/${selectedReportId}/export-csv`, '_blank');
    }
  };

  const latestReport = reports && Array.isArray(reports) ? reports[0] : null;
  const quickStats = {
    reportCount: reports && Array.isArray(reports) ? reports.length : 0,
    averageScore: latestReport?.overallScore || "0.0",
    studyHours: "45.2" // This would be calculated from study plans
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader variant="navbar" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">NursePrep Data Extraction</h2>
          <p className="text-muted-foreground">Upload PDF assessment reports to extract and display topic data in clean, organized tables.</p>
        </div>

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="text-primary mr-2 h-5 w-5" />
                  Upload Assessment Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload onUploadSuccess={handleReportUploaded} />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reports Analyzed</span>
                  <span className="text-sm font-medium" data-testid="stat-report-count">{quickStats.reportCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Score</span>
                  <span className="text-sm font-medium text-chart-2" data-testid="stat-average-score">{quickStats.averageScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Study Hours</span>
                  <span className="text-sm font-medium" data-testid="stat-study-hours">{quickStats.studyHours}</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Reports */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reports && Array.isArray(reports) ? reports.slice(0, 3).map((report: any) => (
                  <div 
                    key={report.id} 
                    className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => setSelectedReportId(report.id)}
                    data-testid={`report-item-${report.id}`}
                  >
                    <FileText className="text-destructive h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{report.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.uploadDate && !isNaN(new Date(report.uploadDate).getTime()) ? new Date(report.uploadDate).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground">No reports uploaded yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analysis Results */}
        {selectedReportId && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Gap Analysis Chart */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Comprehension Gap Analysis</CardTitle>
                  <Button variant="ghost" size="sm" data-testid="button-view-details">
                    View Details
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <GapAnalysisChart data={topicPerformance && Array.isArray(topicPerformance) ? topicPerformance : []} />
                  </div>
                </CardContent>
              </Card>

              {/* Content Area Performance */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Content Area Performance</CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleExportCSV} data-testid="button-export-performance">
                    <Download className="mr-1 h-4 w-4" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contentAreaPerformance && Array.isArray(contentAreaPerformance) ? contentAreaPerformance.map((area: any) => (
                    <div key={area.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{area.contentArea.name}</span>
                        <span className="text-sm text-chart-2 font-semibold" data-testid={`score-${area.contentArea.name}`}>
                          {Number(area.score).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Number(area.score)} className="h-2" />
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No performance data available</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Extracted Topics List */}
            <div className="mb-8">
              <ExtractedTopicsList reportId={selectedReportId || ""} />
            </div>

            {/* Modern Data Carousel */}
            <div className="mb-8">
              <DataCarousel 
                data={topicPerformance && Array.isArray(topicPerformance) ? topicPerformance : []}
                reportName={latestReport?.fileName}
              />
            </div>

            {/* Study Plan and Performance Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Study Plan Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recommended Study Plan</CardTitle>
                  <span className="text-sm text-muted-foreground">3 hours total</span>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topicPerformance && Array.isArray(topicPerformance) ? topicPerformance.slice(0, 2).map((topic: any, index: number) => (
                    <div key={topic.id} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{topic.topic.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{topic.topic.description}</p>
                        <div className="flex items-center space-x-4">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {topic.recommendedStudyTime} minutes
                          </span>
                          <span className="text-xs text-muted-foreground">Chapter TBD, Videos TBD</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No study plan available</p>
                  )}
                  
                  <Button className="w-full" data-testid="button-download-study-plan">
                    <Download className="mr-2 h-4 w-4" />
                    Download Full Study Plan
                  </Button>
                </CardContent>
              </Card>

              {/* Performance Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <PerformanceTrendsChart />
                  </div>
                  <div className="mt-4 flex justify-center space-x-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-chart-2">+12.4%</div>
                      <div className="text-xs text-muted-foreground">This Month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-primary">83.5%</div>
                      <div className="text-xs text-muted-foreground">Current Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-chart-3">15</div>
                      <div className="text-xs text-muted-foreground">Study Sessions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
