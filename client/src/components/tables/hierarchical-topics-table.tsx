import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, ExternalLink, BookOpen, Stethoscope, GraduationCap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface TextbookMapping {
  id: string;
  textbookName: string;
  chapterNumber: number;
  chapterTitle: string;
  sectionNumber: string;
  sectionTitle: string;
  pageStart: number;
  pageEnd: number;
}

interface Subtopic {
  id: string;
  name: string;
  description: string;
  specificSkills: string[];
  criticalPoints: string[];
  textbookMappings?: TextbookMapping[];
}

interface TopicPerformanceData {
  id: string;
  priority: number;
  gapScore: number;
  score: number;
  recommendedStudyTime: number;
  topic: {
    id: string;
    name: string;
    description: string;
    specialty?: string;
    diagnoses?: string[];
    systemCategory?: string;
    clinicalConcepts?: string[];
    contentArea: {
      name: string;
    };
    subtopics?: Subtopic[];
  };
}

interface HierarchicalTopicsTableProps {
  reportId: string;
}

export default function HierarchicalTopicsTable({ reportId }: HierarchicalTopicsTableProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());

  // Fetch detailed topics with subtopics and mappings
  const { data, isLoading } = useQuery<TopicPerformanceData[]>({
    queryKey: ["/api/assessment-reports", reportId, "detailed-topics"],
    enabled: !!reportId,
  });

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const toggleSubtopic = (subtopicId: string) => {
    const newExpanded = new Set(expandedSubtopics);
    if (newExpanded.has(subtopicId)) {
      newExpanded.delete(subtopicId);
    } else {
      newExpanded.add(subtopicId);
    }
    setExpandedSubtopics(newExpanded);
  };

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return "bg-destructive text-destructive-foreground";
    if (priority === 2) return "bg-chart-4 text-primary-foreground";
    if (priority === 3) return "bg-chart-3 text-foreground";
    return "bg-chart-2 text-primary-foreground";
  };

  const getSpecialtyIcon = (specialty?: string) => {
    if (!specialty) return null;
    if (specialty.includes("Pediatric")) return "👶";
    if (specialty.includes("Mental")) return "🧠";
    if (specialty.includes("Critical")) return "🚨";
    if (specialty.includes("Maternal")) return "🤰";
    return "🏥";
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading detailed topic analysis...</div>;
  }

  if (!data || !data.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No detailed topic data available</p>
        <p className="text-sm mt-2">Upload an assessment report to see hierarchical topic analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.id} className="border rounded-lg">
          {/* Main Topic Row */}
          <div
            className="p-4 hover:bg-accent/50 cursor-pointer"
            onClick={() => toggleTopic(item.topic.id)}
            data-testid={`topic-row-${item.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <Button variant="ghost" size="sm" className="p-0">
                  {expandedTopics.has(item.topic.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>

                <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${getPriorityColor(item.priority)}`}>
                  {item.priority}
                </span>

                <div className="flex-1">
                  <div className="font-medium text-foreground">{item.topic.name}</div>
                  <div className="text-sm text-muted-foreground">{item.topic.description}</div>
                  
                  {/* Additional metadata */}
                  <div className="flex items-center space-x-2 mt-1">
                    {item.topic.specialty && (
                      <Badge variant="outline" className="text-xs">
                        {getSpecialtyIcon(item.topic.specialty)} {item.topic.specialty}
                      </Badge>
                    )}
                    {item.topic.systemCategory && (
                      <Badge variant="outline" className="text-xs">
                        <Stethoscope className="h-3 w-3 mr-1" />
                        {item.topic.systemCategory}
                      </Badge>
                    )}
                    {item.topic.diagnoses && item.topic.diagnoses.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Dx: {item.topic.diagnoses.join(", ")}
                      </Badge>
                    )}
                  </div>
                </div>

                <Badge variant="secondary" className="text-xs">
                  {item.topic.contentArea.name}
                </Badge>

                <div className="flex items-center space-x-2">
                  <Progress value={Number(item.gapScore)} className="w-16 h-2" />
                  <span className="text-sm font-medium">{Number(item.gapScore).toFixed(0)}%</span>
                </div>

                <span className="text-sm font-medium">{item.recommendedStudyTime} min</span>
              </div>
            </div>
          </div>

          {/* Expanded Subtopics */}
          {expandedTopics.has(item.topic.id) && item.topic.subtopics && (
            <div className="border-t bg-muted/30">
              {item.topic.subtopics.map((subtopic) => (
                <div key={subtopic.id} className="border-b last:border-b-0">
                  {/* Subtopic Header */}
                  <div
                    className="p-4 pl-12 hover:bg-accent/30 cursor-pointer"
                    onClick={() => toggleSubtopic(subtopic.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <Button variant="ghost" size="sm" className="p-0">
                          {expandedSubtopics.has(subtopic.id) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                        
                        <div className="flex-1">
                          <div className="font-medium text-sm">{subtopic.name}</div>
                          <div className="text-xs text-muted-foreground">{subtopic.description}</div>
                          
                          {/* Skills and Critical Points */}
                          {subtopic.specificSkills && subtopic.specificSkills.length > 0 && (
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                Skills: {subtopic.specificSkills.join(", ")}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Textbook Mappings */}
                  {expandedSubtopics.has(subtopic.id) && subtopic.textbookMappings && (
                    <div className="bg-background/50 p-4 pl-16">
                      <div className="text-xs font-medium mb-2 flex items-center">
                        <BookOpen className="h-3 w-3 mr-1" />
                        Textbook References
                      </div>
                      <div className="space-y-2">
                        {subtopic.textbookMappings.map((mapping) => (
                          <div key={mapping.id} className="flex items-center justify-between text-xs bg-card p-2 rounded">
                            <div className="flex-1">
                              <div className="font-medium">{mapping.textbookName}</div>
                              <div className="text-muted-foreground">
                                Chapter {mapping.chapterNumber}: {mapping.chapterTitle}
                              </div>
                              <div className="text-muted-foreground">
                                Section {mapping.sectionNumber}: {mapping.sectionTitle}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-xs">
                                Pages {mapping.pageStart}-{mapping.pageEnd}
                              </Badge>
                              <Button variant="ghost" size="sm" className="ml-2">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Critical Points if any */}
                      {subtopic.criticalPoints && subtopic.criticalPoints.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium mb-1">⚠️ Critical Points:</div>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {subtopic.criticalPoints.map((point, idx) => (
                              <li key={idx}>• {point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Clinical Concepts Summary */}
              {item.topic.clinicalConcepts && item.topic.clinicalConcepts.length > 0 && (
                <div className="p-4 pl-12 bg-muted/20">
                  <div className="text-xs font-medium mb-2">
                    <GraduationCap className="inline h-3 w-3 mr-1" />
                    Clinical Concepts to Master:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.topic.clinicalConcepts.map((concept, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {concept}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}