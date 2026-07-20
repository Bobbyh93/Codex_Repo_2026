import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  GraduationCap, 
  Target, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  Mail,
  Award,
  AlertCircle,
  CheckCircle,
  Clock,
  Printer,
  X
} from 'lucide-react';

interface StudyGuidePreviewProps {
  open: boolean;
  onClose: () => void;
  assessment: any;
  customizations: any;
  resources?: any[];
  studyPlan?: any;
}

export function StudyGuidePreview({
  open,
  onClose,
  assessment,
  customizations,
  resources = [],
  studyPlan
}: StudyGuidePreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setIsPrinting(false);
  };

  const getPriorityColor = (score: number) => {
    if (score < 60) return 'text-red-600';
    if (score < 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getPriorityLabel = (score: number) => {
    if (score < 60) return 'High Priority';
    if (score < 75) return 'Medium Priority';
    return 'Low Priority';
  };

  if (!assessment) return null;

  // Sort topics by score (lowest first = highest priority)
  const sortedTopics = [...(assessment.topicPerformance || [])]
    .sort((a, b) => parseFloat(a.score || '0') - parseFloat(b.score || '0'));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Study Guide Preview</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isPrinting}
                data-testid="button-print"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                data-testid="button-close-preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] px-6 py-4">
          <div className="space-y-6 print:space-y-4" id="study-guide-content">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <GraduationCap className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">Personalized Study Guide</h1>
              </div>
              <p className="text-gray-600">NursePrep Analytics Assessment Report</p>
            </div>

            {/* Assessment Details */}
            <Card className="print:border print:p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Assessment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {assessment.extractedInfo?.programCohort && (
                    <div>
                      <span className="text-gray-600">Program:</span>
                      <p className="font-medium">{assessment.extractedInfo.programCohort}</p>
                    </div>
                  )}
                  {assessment.extractedInfo?.testDate && (
                    <div>
                      <span className="text-gray-600">Assessment Date:</span>
                      <p className="font-medium">{assessment.extractedInfo.testDate}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Overall Score:</span>
                    <p className="font-medium text-lg">
                      <span className={getPriorityColor(parseFloat(assessment.overallScore || '0'))}>
                        {assessment.overallScore}%
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Topics Assessed:</span>
                    <p className="font-medium">{assessment.topicsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructor Comments */}
            {customizations.instructorComments && (
              <Card className="print:border print:p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Message from Instructor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{customizations.instructorComments}</p>
                </CardContent>
              </Card>
            )}

            {/* Priority Topics */}
            <Card className="print:border print:p-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Priority Study Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedTopics.slice(0, 5).map((topic, index) => {
                    const score = parseFloat(topic.score || '0');
                    return (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          <Badge className={`text-xs ${score < 60 ? 'bg-red-100 text-red-800' : score < 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            #{index + 1}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{topic.topic?.name || topic.topicName}</p>
                            <span className={`text-sm font-medium ${getPriorityColor(score)}`}>
                              {score}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {topic.contentArea?.name || topic.contentAreaName || 'Fundamentals'} • {getPriorityLabel(score)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Study Plan */}
            {studyPlan && (
              <Card className="print:border print:p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recommended Study Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span className="text-sm font-medium">{studyPlan.name || 'Comprehensive Review'}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {studyPlan.duration || '4 weeks'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {studyPlan.intensity || 'Moderate'}
                        </Badge>
                      </div>
                    </div>
                    {studyPlan.description && (
                      <p className="text-sm text-gray-600">{studyPlan.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommended Resources */}
            {customizations.recommendedResources && customizations.recommendedResources.length > 0 && (
              <Card className="print:border print:p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Recommended Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {resources.map((resource, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{resource.title || `Resource ${index + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Footer */}
            <div className="border-t pt-4 text-center text-xs text-gray-500">
              <p>Generated on {new Date().toLocaleDateString()} • NursePrep Analytics</p>
              <p className="mt-1">This study guide is personalized based on your assessment results</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}