import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Network, Target, Clock, BookOpen, TrendingUp } from "lucide-react";

export default function StudyGuideAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  // Fetch topic relationships
  const { data: relationships, isLoading: relationshipsLoading } = useQuery({
    queryKey: ['/api/admin/topic-relationships'],
    queryFn: async () => {
      const response = await fetch('/api/admin/topic-relationships');
      if (!response.ok) throw new Error('Failed to fetch relationships');
      return response.json();
    }
  });

  // Fetch study guide template
  const { data: studyGuide, isLoading: studyGuideLoading } = useQuery({
    queryKey: ['/api/study-guide/template'],
    queryFn: async () => {
      const response = await fetch('/api/study-guide/template');
      if (!response.ok) throw new Error('Failed to fetch study guide');
      return response.json();
    }
  });

  const analyzeRelationships = async () => {
    setIsAnalyzing(true);
    try {
      // Trigger analysis refresh
      const response = await fetch('/api/admin/topic-relationships');
      if (!response.ok) throw new Error('Analysis failed');
      
      toast({
        title: "Analysis complete",
        description: "Topic relationships have been analyzed and study guide updated"
      });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (relationshipsLoading || studyGuideLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="study-guide-analyzer">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="title-study-guide-analyzer">Study Guide Builder</h1>
          <p className="text-gray-600">Topic relationship analysis and high-impact study areas</p>
        </div>
        <Button 
          onClick={analyzeRelationships} 
          disabled={isAnalyzing}
          data-testid="button-analyze-relationships"
        >
          {isAnalyzing ? "Analyzing..." : "Refresh Analysis"}
        </Button>
      </div>

      <Tabs defaultValue="relationships" className="space-y-4">
        <TabsList>
          <TabsTrigger value="relationships" data-testid="tab-relationships">Topic Relationships</TabsTrigger>
          <TabsTrigger value="template" data-testid="tab-template">Study Guide Template</TabsTrigger>
          <TabsTrigger value="clusters" data-testid="tab-clusters">Topic Clusters</TabsTrigger>
        </TabsList>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                High-Impact Topic Relationships
              </CardTitle>
              <CardDescription>
                Topics with shared diagnoses, systems, and interventions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relationships?.highImpactTopics && (
                <div className="space-y-4">
                  {relationships.highImpactTopics.slice(0, 6).map((topic: any, index: number) => (
                    <div key={topic.topicName} className="border rounded-lg p-4" data-testid={`topic-impact-${index}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{topic.topicName}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            topic.priority === 'critical' ? 'destructive' :
                            topic.priority === 'high' ? 'default' :
                            topic.priority === 'medium' ? 'secondary' : 'outline'
                          }>
                            {topic.priority}
                          </Badge>
                          <span className="text-sm text-gray-500">Score: {topic.impactScore}</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{topic.reasonForImpact}</p>
                      
                      {topic.relatedTopics && topic.relatedTopics.length > 0 && (
                        <div className="mb-3">
                          <span className="text-sm font-medium">Related Topics: </span>
                          <span className="text-sm text-gray-600">
                            {topic.relatedTopics.slice(0, 3).join(', ')}
                            {topic.relatedTopics.length > 3 && ` (+${topic.relatedTopics.length - 3} more)`}
                          </span>
                        </div>
                      )}
                      
                      {topic.sharedConcepts && topic.sharedConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {topic.sharedConcepts.slice(0, 5).map((concept: string) => (
                            <Badge key={concept} variant="outline" className="text-xs">
                              {concept}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template" className="space-y-4">
          {studyGuide && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {studyGuide.title}
                  </CardTitle>
                  <CardDescription>{studyGuide.overview}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                      <div className="font-semibold">{studyGuide.totalEstimatedTime} min</div>
                      <div className="text-sm text-gray-600">Total Study Time</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Target className="h-6 w-6 mx-auto mb-2 text-green-600" />
                      <div className="font-semibold">{studyGuide.sections?.length || 0}</div>
                      <div className="text-sm text-gray-600">Focus Areas</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                      <div className="font-semibold">{studyGuide.studySequence?.length || 0}</div>
                      <div className="text-sm text-gray-600">Topics Covered</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Study Sections</h3>
                    {studyGuide.sections?.map((section: any, index: number) => (
                      <div key={section.title} className="border rounded-lg p-4" data-testid={`section-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{section.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              section.priority === 'critical' ? 'destructive' :
                              section.priority === 'high' ? 'default' :
                              section.priority === 'medium' ? 'secondary' : 'outline'
                            }>
                              {section.priority}
                            </Badge>
                            <span className="text-sm text-gray-500">{section.estimatedStudyTime} min</span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-3">
                          <strong>Topics:</strong> {section.topics.join(', ')}
                        </div>
                        
                        {section.keyAreas && section.keyAreas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs font-medium text-gray-500">Key Areas:</span>
                            {section.keyAreas.map((area: string) => (
                              <Badge key={area} variant="outline" className="text-xs">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Business Model Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Customization Tiers</CardTitle>
                  <CardDescription>Free analysis vs. premium blueprint structure</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4 bg-green-50">
                      <h4 className="font-semibold text-green-800 mb-2">Free Analysis</h4>
                      <p className="text-sm text-gray-600 mb-3">Top 2 knowledge gaps identified</p>
                      {studyGuide.customization?.freeAnalysisTopics && (
                        <div className="space-y-1">
                          {studyGuide.customization.freeAnalysisTopics.map((topic: string) => (
                            <Badge key={topic} variant="outline" className="mr-1">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <h4 className="font-semibold text-blue-800 mb-2">Premium Blueprint ($19-39)</h4>
                      <p className="text-sm text-gray-600 mb-3">Complete study plan with all gaps and resources</p>
                      <div className="text-sm text-gray-700">
                        <div>• All {studyGuide.customization?.premiumTopics?.length || 0} additional topics</div>
                        <div>• Comprehensive study sequence</div>
                        <div>• Targeted video resources</div>
                        <div>• Progress tracking</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="clusters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Topic Clusters</CardTitle>
              <CardDescription>Related topics grouped by shared concepts and systems</CardDescription>
            </CardHeader>
            <CardContent>
              {relationships?.relationships && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Found {relationships.relationships.length} topic relationships
                  </div>
                  
                  {relationships.relationships.slice(0, 8).map((rel: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3" data-testid={`relationship-${index}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          {rel.topicA} ↔ {rel.topicB}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{rel.relationshipType}</Badge>
                          <span className="text-sm text-gray-500">Score: {rel.impactScore}</span>
                        </div>
                      </div>
                      
                      {rel.sharedKeywords && rel.sharedKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-gray-500 mr-2">Shared:</span>
                          {rel.sharedKeywords.map((keyword: string) => (
                            <Badge key={keyword} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}