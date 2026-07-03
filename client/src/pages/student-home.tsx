import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type StudentLessonSummary = {
  id: string;
  title: string;
  topic: string;
  audience: string;
  learnerUrl: string;
  publishedAt?: string | null;
  subject?: string | null;
  weakTopic?: string | null;
  atiCategory?: string | null;
  nclexCategory?: string | null;
  cjmStep?: string | null;
  slideCount: number;
  practiceCount: number;
  citationCount: number;
  guidedNotesAvailable: boolean;
  sourceLabels: string[];
  tags: string[];
  estimatedMinutes: number;
  trustSignals: {
    sourceBacked: boolean;
    citations: number;
    sources: number;
    guidedNotes: boolean;
    rationales: boolean;
  };
};

type StudentHomeResponse = {
  generatedAt: string;
  featuredLesson: StudentLessonSummary | null;
  lessons: StudentLessonSummary[];
  topicTiles: Array<{
    key: string;
    label: string;
    count: number;
    description: string;
  }>;
  metrics: {
    publishedLessons: number;
    practiceItems: number;
    citationCount: number;
    guidedNotesLessons: number;
  };
  trustSignals: string[];
};

async function fetchStudentHome(): Promise<StudentHomeResponse> {
  const response = await fetch("/api/student/home", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Student lesson library is temporarily unavailable.");
  }
  return response.json();
}

function uniqueOptions(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function dateLabel(value?: string | null) {
  if (!value) return "Recently published";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function LessonCard({ lesson, compact = false }: { lesson: StudentLessonSummary; compact?: boolean }) {
  return (
    <Card className="h-full rounded-md border-slate-200 shadow-sm transition hover:border-emerald-300">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            {lesson.weakTopic || lesson.subject || "Clinical Judgment"}
          </Badge>
          {lesson.nclexCategory ? <Badge variant="outline">{lesson.nclexCategory}</Badge> : null}
          {lesson.cjmStep ? <Badge variant="outline">{lesson.cjmStep}</Badge> : null}
        </div>
        <CardTitle className="text-lg leading-6 text-slate-950">{lesson.title}</CardTitle>
        <p className="text-sm leading-6 text-slate-600">{lesson.topic}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-slate-50 p-2">
            <div className="text-base font-semibold text-slate-950">{lesson.slideCount}</div>
            <div className="text-slate-500">Slides</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <div className="text-base font-semibold text-slate-950">{lesson.practiceCount}</div>
            <div className="text-slate-500">Practice</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2">
            <div className="text-base font-semibold text-slate-950">{lesson.citationCount}</div>
            <div className="text-slate-500">Cites</div>
          </div>
        </div>

        {!compact ? (
          <div className="flex flex-wrap gap-2">
            {lesson.guidedNotesAvailable ? (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Guided notes</Badge>
            ) : null}
            {lesson.trustSignals.rationales ? (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Rationales</Badge>
            ) : null}
            {lesson.trustSignals.sourceBacked ? (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Source-backed</Badge>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{lesson.estimatedMinutes} min lesson</span>
          <a href={lesson.learnerUrl}>
            <Button size="sm">
              Start
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentHome() {
  const [search, setSearch] = useState("");
  const [weakTopic, setWeakTopic] = useState("all");
  const [nclexCategory, setNclexCategory] = useState("all");
  const [cjmStep, setCjmStep] = useState("all");
  const [subject, setSubject] = useState("all");

  const homeQuery = useQuery<StudentHomeResponse>({
    queryKey: ["/api/student/home"],
    queryFn: fetchStudentHome,
  });

  const home = homeQuery.data;
  const lessons = home?.lessons || [];
  const featuredLesson = home?.featuredLesson || lessons[0] || null;
  const learningSteps = [
    { label: "Cue", detail: "Read the patient cue before the explanation.", Icon: Target },
    { label: "Predict", detail: "Commit to an answer or priority first.", Icon: ClipboardList },
    { label: "Practice", detail: "Try the item and review the rationale.", Icon: BookOpenCheck },
    { label: "Notes", detail: "Use guided notes to keep the takeaways.", Icon: FileText },
  ];

  const filters = useMemo(() => ({
    weakTopics: uniqueOptions(lessons.map((lesson) => lesson.weakTopic)),
    nclexCategories: uniqueOptions(lessons.map((lesson) => lesson.nclexCategory)),
    cjmSteps: uniqueOptions(lessons.map((lesson) => lesson.cjmStep)),
    subjects: uniqueOptions(lessons.map((lesson) => lesson.subject)),
  }), [lessons]);

  const filteredLessons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesSearch = !query || [
        lesson.title,
        lesson.topic,
        lesson.subject,
        lesson.weakTopic,
        lesson.nclexCategory,
        lesson.cjmStep,
        ...(lesson.tags || []),
        ...(lesson.sourceLabels || []),
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
      const matchesWeakTopic = weakTopic === "all" || lesson.weakTopic === weakTopic;
      const matchesNclex = nclexCategory === "all" || lesson.nclexCategory === nclexCategory;
      const matchesCjm = cjmStep === "all" || lesson.cjmStep === cjmStep;
      const matchesSubject = subject === "all" || lesson.subject === subject;
      return matchesSearch && matchesWeakTopic && matchesNclex && matchesCjm && matchesSubject;
    });
  }, [lessons, search, weakTopic, nclexCategory, cjmStep, subject]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-normal">NurseStudy</div>
              <div className="text-xs text-slate-500">Source-backed nursing lessons</div>
            </div>
          </a>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <a href="#library" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Lessons</a>
            <a href="/study-guide" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Study Guide</a>
            <a href="/pilot-request" className="rounded-md px-3 py-2 text-slate-500 hover:bg-slate-100">Pilot Request</a>
            <a href="/admin/login" className="rounded-md border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-100">Creator Login</a>
          </nav>
        </div>
      </header>

      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Published lessons</Badge>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">NCLEX and CJM aligned</Badge>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Rationales included</Badge>
            </div>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
                Learn nursing concepts with active lessons, practice, and cited rationales.
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
                Start with a patient cue, work through the clinical judgment decision, answer a practice item, and review the rationale with source labels.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {featuredLesson ? (
                <a href={featuredLesson.learnerUrl}>
                  <Button size="lg">
                    Start learning
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              ) : null}
              <a href="#library">
                <Button size="lg" variant="outline">Browse lessons</Button>
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Lessons", home?.metrics.publishedLessons || 0],
                ["Practice", home?.metrics.practiceItems || 0],
                ["Citations", home?.metrics.citationCount || 0],
                ["Notes", home?.metrics.guidedNotesLessons || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-2xl font-semibold text-slate-950">{value}</div>
                  <div className="text-xs uppercase text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {homeQuery.isLoading ? (
              <Card className="rounded-md">
                <CardContent className="p-6 text-slate-600">Loading published lessons...</CardContent>
              </Card>
            ) : featuredLesson ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase text-slate-500">Featured Lesson</div>
                <LessonCard lesson={featuredLesson} />
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    Source-backed trust signal
                  </div>
                  <p className="mt-1 leading-6">
                    This lesson includes {featuredLesson.citationCount} citation records and {featuredLesson.sourceLabels.length} source labels.
                  </p>
                </div>
              </div>
            ) : (
              <Card className="rounded-md">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold">Lessons are being prepared</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Published NurseStudy lessons will appear here after the content creator publishes packages from the Lesson Builder.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="border-b bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {learningSteps.map(({ label, detail, Icon }) => (
              <div key={label} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <Icon className="h-4 w-4 text-emerald-700" />
                  {label}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-normal text-slate-950">Topic Library</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Filter published lessons by weak topic, NCLEX category, CJM step, or course area.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 lg:w-80">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search lessons"
                className="h-8 border-0 p-0 focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <select value={weakTopic} onChange={(event) => setWeakTopic(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="all">All weak topics</option>
              {filters.weakTopics.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={nclexCategory} onChange={(event) => setNclexCategory(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="all">All NCLEX categories</option>
              {filters.nclexCategories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={cjmStep} onChange={(event) => setCjmStep(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="all">All CJM steps</option>
              {filters.cjmSteps.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={subject} onChange={(event) => setSubject(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="all">All subjects</option>
              {filters.subjects.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          {homeQuery.isError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {homeQuery.error instanceof Error ? homeQuery.error.message : "Student library could not be loaded."}
            </div>
          ) : null}

          <div id="library" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>

          {!homeQuery.isLoading && filteredLessons.length === 0 ? (
            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 font-semibold text-slate-950">No lesson matches those filters</h3>
              <p className="mt-2 text-sm text-slate-600">Clear one filter or search a broader nursing concept.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setWeakTopic("all");
                  setNclexCategory("all");
                  setCjmStep("all");
                  setSubject("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
