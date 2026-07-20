import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLastUploadedReport, getStudentSessionId } from "@/lib/student-session";

type StudyPackLesson = {
  summary: {
    id: string;
    title: string;
    topic: string;
    learnerUrl: string;
    weakTopic?: string | null;
    nclexCategory?: string | null;
    cjmStep?: string | null;
  };
  guidedNotes: Array<{
    slideId: string;
    slideNumber: number;
    title: string;
    guidedNotes: string;
    retrievalPrompt?: string | null;
    nclexCategory?: string | null;
    cjmStep?: string | null;
    citations: Array<{ id: string; citationLabel: string; excerpt?: string | null }>;
  }>;
  practiceItems: Array<{
    id: string;
    stem: string;
    correctAnswer: string;
    rationale: string;
    difficulty?: string | null;
    lessonUrl: string;
  }>;
  citations: Array<{ id: string; citationLabel: string; excerpt?: string | null }>;
  sourceLabels: string[];
};

type StudentStudyPackResponse = {
  generatedAt: string;
  sessionId: string;
  lessons: StudyPackLesson[];
  totals: {
    lessons: number;
    guidedNotes: number;
    practiceItems: number;
    citations: number;
  };
  emptyState?: { title: string; detail: string } | null;
};

async function fetchStudyPack(sessionId: string): Promise<StudentStudyPackResponse> {
  const response = await fetch(`/api/student/study-pack?sessionId=${encodeURIComponent(sessionId)}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Study pack is temporarily unavailable.");
  return response.json();
}

export default function StudentStudyPack() {
  const sessionId = useMemo(() => getStudentSessionId(), []);
  const lastUpload = useMemo(() => getLastUploadedReport(), []);
  const packQuery = useQuery<StudentStudyPackResponse>({
    queryKey: ["/api/student/study-pack", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchStudyPack(sessionId),
  });
  const pack = packQuery.data;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">NurseStudy</div>
              <div className="text-xs text-slate-500">Guided study pack</div>
            </div>
          </a>
          <nav className="flex flex-wrap gap-2 text-sm">
            <a href="/student" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Library</a>
            <a href="/student/progress" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Study Path</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Saved and recent lessons</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">Guided Study Pack</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            A learner-safe bundle of guided notes, practice rationales, and citations from the lessons you opened or saved in this browser.
          </p>
        </div>

        {packQuery.isLoading ? (
          <Card className="rounded-md"><CardContent className="p-6">Building your study pack...</CardContent></Card>
        ) : packQuery.isError ? (
          <Card className="rounded-md border-red-200 bg-red-50"><CardContent className="p-6 text-red-900">Study pack could not be loaded.</CardContent></Card>
        ) : pack ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Lessons", pack.totals.lessons, BookOpenCheck],
                ["Guided Notes", pack.totals.guidedNotes, FileText],
                ["Practice", pack.totals.practiceItems, ClipboardList],
                ["Citations", pack.totals.citations, Quote],
              ].map(([label, value, Icon]) => {
                const IconComponent = Icon as typeof BookOpenCheck;
                return (
                  <div key={String(label)} className="rounded-md border bg-white p-4">
                    <IconComponent className="mb-3 h-5 w-5 text-emerald-700" />
                    <div className="text-2xl font-semibold">{Number(value)}</div>
                    <div className="text-xs uppercase text-slate-500">{String(label)}</div>
                  </div>
                );
              })}
            </div>

            {pack.lessons.length === 0 ? (
              <Card className="rounded-md">
                <CardContent className="p-6">
                  <h2 className="font-semibold text-slate-950">
                    {lastUpload ? "Your assessment guide is ready." : pack.emptyState?.title || "No study pack yet."}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {lastUpload
                      ? "Use the launch preview guide as your first study pack, then open or save lessons to collect guided notes and rationales here."
                      : pack.emptyState?.detail}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {lastUpload ? (
                      <a href={lastUpload.nextStep || `/professional-study-guide/${lastUpload.reportId}`}>
                        <Button>
                          <FileText className="mr-2 h-4 w-4" />
                          Open uploaded guide
                        </Button>
                      </a>
                    ) : null}
                    <a href="/student"><Button variant={lastUpload ? "outline" : "default"}>Browse lessons</Button></a>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pack.lessons.map((lesson) => (
                <Card key={lesson.summary.id} className="rounded-md">
                  <CardHeader className="border-b">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {lesson.summary.weakTopic ? <Badge variant="outline">{lesson.summary.weakTopic}</Badge> : null}
                          {lesson.summary.nclexCategory ? <Badge variant="outline">{lesson.summary.nclexCategory}</Badge> : null}
                          {lesson.summary.cjmStep ? <Badge variant="outline">{lesson.summary.cjmStep}</Badge> : null}
                        </div>
                        <CardTitle className="mt-2 text-xl">{lesson.summary.title}</CardTitle>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{lesson.summary.topic}</p>
                      </div>
                      <a href={lesson.summary.learnerUrl}>
                        <Button size="sm">
                          Open lesson
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 p-5">
                    <section>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-500">
                        <FileText className="h-4 w-4" />
                        Guided Notes
                      </h3>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {lesson.guidedNotes.map((note) => (
                          <div key={note.slideId} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-semibold uppercase text-slate-500">Slide {note.slideNumber}</div>
                            <h4 className="mt-1 font-semibold text-slate-950">{note.title}</h4>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.guidedNotes}</p>
                            {note.retrievalPrompt ? (
                              <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">{note.retrievalPrompt}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-500">
                        <ClipboardList className="h-4 w-4" />
                        Practice Rationales
                      </h3>
                      <div className="space-y-3">
                        {lesson.practiceItems.map((item) => (
                          <div key={item.id} className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                            <p className="font-medium leading-6 text-emerald-950">{item.stem}</p>
                            <p className="mt-2 text-sm text-emerald-900">Correct answer: {item.correctAnswer}</p>
                            <p className="mt-2 text-sm leading-6 text-emerald-950">{item.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-500">
                        <Quote className="h-4 w-4" />
                        Citation Labels
                      </h3>
                      <div className="grid gap-2 md:grid-cols-2">
                        {lesson.citations.slice(0, 12).map((citation) => (
                          <div key={citation.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                            <div className="font-medium text-slate-950">{citation.citationLabel}</div>
                            {citation.excerpt ? <p className="mt-1 line-clamp-2 leading-6 text-slate-600">{citation.excerpt}</p> : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
