/**
 * Curriculum Browser — Mental Health Nursing catalog
 * Publicly accessible — no login required.
 * Serves data from local Postgres tables seeded from the NUR2200 blueprint.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Search, ChevronRight,
  Grid3x3, List, Home, Brain, ClipboardList,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface ChapterSummary {
  chapter_id: string;
  chapter_name: string;
  subject: string;
  topic_count: number;
  bloom_levels: string[];
  ncjmm_operations: string[];
  nclex_categories: string[];
  ati_chapters: string[];
  assessment_count: number;
}

const BLOOM_COLORS: Record<string, string> = {
  Remember: "bg-blue-100 text-blue-800",
  Understand: "bg-green-100 text-green-800",
  Apply: "bg-yellow-100 text-yellow-800",
  Analyze: "bg-orange-100 text-orange-800",
  Evaluate: "bg-red-100 text-red-800",
  Create: "bg-purple-100 text-purple-800",
};

export default function CurriculumBrowser() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: subjects, isLoading: loadingSubjects } = useQuery<string[]>({
    queryKey: ["/api/curriculum/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/curriculum/subjects");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: chapters, isLoading: loadingChapters } = useQuery<ChapterSummary[]>({
    queryKey: ["/api/curriculum/chapters", selectedSubject, searchQuery],
    queryFn: async () => {
      let endpoint = "/api/curriculum/chapters";
      if (searchQuery) {
        endpoint = `/api/curriculum/search?text=${encodeURIComponent(searchQuery)}`;
      } else if (selectedSubject) {
        endpoint = `/api/curriculum/chapters/by-subject?subject=${encodeURIComponent(selectedSubject)}`;
      }
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch chapters");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.chapters ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(pendingSearch);
  };

  const handleClearSearch = () => {
    setPendingSearch("");
    setSearchQuery("");
  };

  const isLoading = loadingSubjects || loadingChapters;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="container max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Curriculum Library</h1>
                <p className="text-sm text-muted-foreground">Mental Health Nursing</p>
              </div>
            </div>
            <Button onClick={() => navigate("/")} variant="outline">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
          <p className="text-muted-foreground">
            Browse NCLEX-aligned learning objectives organized by topic — no account required.
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search topics, e.g. Anxiety Disorders, PTSD…"
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-curriculum-search"
                />
              </div>
              <Button type="submit" data-testid="button-search">
                Search
              </Button>
              {(pendingSearch || searchQuery) && (
                <Button
                  variant="outline"
                  onClick={handleClearSearch}
                  type="button"
                  data-testid="button-clear-search"
                >
                  Clear
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Subject Filters + View Toggle */}
        {subjects && subjects.length > 0 && (
          <div className="mb-6 flex items-center justify-between gap-4">
            <ScrollArea className="flex-1">
              <div className="flex gap-2">
                <Button
                  variant={selectedSubject === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSubject(null)}
                  data-testid="button-all-subjects"
                >
                  All Subjects
                </Button>
                {subjects.map((subject) => (
                  <Button
                    key={subject}
                    variant={selectedSubject === subject ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSubject(subject)}
                    data-testid={`button-subject-${subject}`}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 shrink-0">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                data-testid="button-grid-view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                data-testid="button-list-view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Topics Grid / List */}
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : chapters && chapters.length > 0 ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
            {chapters.map((chapter) => (
              <Card
                key={chapter.chapter_id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/curriculum/chapter/${chapter.chapter_id}`)}
              >
                <CardContent className="pt-5 pb-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-3">
                    <h3
                      className="font-semibold text-base leading-tight"
                      data-testid={`chapter-title-${chapter.chapter_id}`}
                    >
                      {chapter.chapter_name}
                    </h3>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  {/* Subject + objective count */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {chapter.subject}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {chapter.topic_count} {chapter.topic_count === 1 ? "objective" : "objectives"}
                    </span>
                    {chapter.assessment_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ClipboardList className="h-3 w-3" />
                        {chapter.assessment_count} {chapter.assessment_count === 1 ? "assessment" : "assessments"}
                      </span>
                    )}
                  </div>

                  {/* Bloom levels */}
                  {(chapter.bloom_levels?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-1">
                      <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
                      {chapter.bloom_levels.map((level) => (
                        <span
                          key={level}
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${BLOOM_COLORS[level] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {level}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* NCJMM operations */}
                  {(chapter.ncjmm_operations?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {chapter.ncjmm_operations.slice(0, 2).map((op) => (
                        <Badge key={op} variant="secondary" className="text-xs px-1.5 py-0 bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                          {op}
                        </Badge>
                      ))}
                      {chapter.ncjmm_operations.length > 2 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          +{chapter.ncjmm_operations.length - 2} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* NCLEX categories */}
                  {(chapter.nclex_categories?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {chapter.nclex_categories.slice(0, 3).map((cat) => (
                        <Badge key={cat} variant="outline" className="text-xs px-1.5 py-0">
                          {cat}
                        </Badge>
                      ))}
                      {chapter.nclex_categories.length > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          +{chapter.nclex_categories.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* ATI chapters */}
                  {(chapter.ati_chapters?.length ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ATI: {chapter.ati_chapters.slice(0, 3).join(", ")}
                      {chapter.ati_chapters.length > 3 ? ` +${chapter.ati_chapters.length - 3} more` : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-2">No Topics Found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? `No topics match "${searchQuery}"`
                    : "No curriculum content is available yet."}
                </p>
                {searchQuery && (
                  <Button variant="outline" className="mt-4" onClick={handleClearSearch}>
                    Clear search
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer count */}
        {chapters && chapters.length > 0 && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Showing {chapters.length} {chapters.length === 1 ? "topic" : "topics"}
            {selectedSubject && ` in ${selectedSubject}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
      </div>
    </div>
  );
}
