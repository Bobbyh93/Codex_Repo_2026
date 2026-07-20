/**
 * Curriculum Chapter (Topic Detail) — Mental Health Nursing
 * Shows all learning objectives for a specific topic, linked assessments,
 * and Bloom / NCJMM distribution. Publicly accessible, no login required.
 */

import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, BookOpen, Brain, ClipboardList, AlertCircle, BarChart2,
} from "lucide-react";

interface Objective {
  id: string;
  weekNo: number | null;
  text: string;
  bloomLevel: string | null;
  bloomKnowledge: string | null;
  ncjmmOperation: string | null;
  nclexCategory: string | null;
  nclexSubcategory: string | null;
  atiChapters: string | null;
}

interface Assessment {
  id: string;
  name: string;
  type: string | null;
  weeksCovered: string | null;
  points: number | null;
  isCumulative: boolean | null;
}

interface TopicDetail {
  topicSlug: string;
  topicName: string;
  subject: string;
  objectives: Objective[];
  assessments: Assessment[];
  bloomDistribution: Record<string, number>;
  ncjmmDistribution: Record<string, number>;
}

const BLOOM_COLORS: Record<string, string> = {
  Remember: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Understand: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Apply: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  Analyze: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Evaluate: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Create: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

function bloomColor(level: string | null) {
  return level ? (BLOOM_COLORS[level] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground";
}

export default function CurriculumChapter() {
  const { chapterId } = useParams<{ chapterId: string }>();

  const { data: topic, isLoading, error } = useQuery<TopicDetail>({
    queryKey: ["/api/curriculum/topic", chapterId],
    queryFn: async () => {
      const res = await fetch(`/api/curriculum/topic/${chapterId}`);
      if (!res.ok) throw new Error("Topic not found");
      return res.json();
    },
    enabled: !!chapterId,
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to curriculum
        </Button>

        {/* Loading state */}
        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                Topic not found. It may not be in the catalog yet.
              </p>
            </CardContent>
          </Card>
        )}

        {topic && (
          <>
            {/* Topic header */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <BookOpen className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {topic.subject}
                    </p>
                    <CardTitle className="text-2xl leading-snug">{topic.topicName}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {topic.objectives.length} learning{" "}
                      {topic.objectives.length === 1 ? "objective" : "objectives"}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Bloom distribution */}
            {Object.keys(topic.bloomDistribution).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Bloom's Taxonomy Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(topic.bloomDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .map(([level, count]) => (
                        <span
                          key={level}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bloomColor(level)}`}
                        >
                          {level}
                          <span className="font-bold">{count}</span>
                        </span>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* NCJMM distribution */}
            {Object.keys(topic.ncjmmDistribution).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    NCJMM Clinical Judgment Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(topic.ncjmmDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .map(([op, count]) => (
                        <Badge key={op} variant="outline" className="text-xs">
                          {op} <span className="ml-1 font-bold">{count}</span>
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked assessments */}
            {topic.assessments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Covered by {topic.assessments.length}{" "}
                    {topic.assessments.length === 1 ? "Assessment" : "Assessments"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {topic.assessments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm bg-muted/30"
                      >
                        <span className="font-medium">{a.name}</span>
                        {a.type && (
                          <Badge variant="secondary" className="text-xs">
                            {a.type}
                          </Badge>
                        )}
                        {a.isCumulative && (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                            Cumulative
                          </Badge>
                        )}
                        {a.points != null && (
                          <span className="text-xs text-muted-foreground">{a.points} pts</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Learning objectives */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Learning Objectives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topic.objectives.map((obj, idx) => (
                  <div
                    key={obj.id}
                    className="border rounded-lg p-4 space-y-2 bg-background"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                        {obj.id}
                      </span>
                      <p className="text-sm leading-relaxed">{obj.text}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-10">
                      {obj.bloomLevel && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bloomColor(obj.bloomLevel)}`}
                        >
                          {obj.bloomLevel}
                        </span>
                      )}
                      {obj.bloomKnowledge && (
                        <Badge variant="outline" className="text-xs">
                          {obj.bloomKnowledge}
                        </Badge>
                      )}
                      {obj.ncjmmOperation && (
                        <Badge variant="secondary" className="text-xs">
                          {obj.ncjmmOperation}
                        </Badge>
                      )}
                      {obj.nclexCategory && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {obj.nclexCategory}
                        </Badge>
                      )}
                    </div>
                    {obj.atiChapters && (
                      <p className="text-xs text-muted-foreground pl-10 leading-relaxed">
                        <span className="font-medium">ATI: </span>
                        {obj.atiChapters}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
