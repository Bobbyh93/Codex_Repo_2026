import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookMarked,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLastUploadedReport, getStudentSessionId } from "@/lib/student-session";

type StudentLessonSummary = {
  id: string;
  title: string;
  topic: string;
  learnerUrl: string;
  weakTopic?: string | null;
  nclexCategory?: string | null;
  cjmStep?: string | null;
  practiceCount: number;
  citationCount: number;
  estimatedMinutes: number;
  guidedNotesAvailable: boolean;
};

type LessonProgressState = {
  packageId: string;
  lesson: StudentLessonSummary;
  learnerUrl: string;
  status: "not_started" | "in_progress" | "completed";
  saved: boolean;
  opened: boolean;
  completed: boolean;
  lastActivityAt?: string | null;
  practiceAttempts: number;
  feedbackSubmitted: number;
  lastPracticeResult?: {
    isCorrect?: boolean | null;
    selectedAnswer?: string | null;
    correctAnswer?: string | null;
  } | null;
  latestFeedback?: {
    rating?: string | null;
    comment?: string;
  } | null;
};

type StudentProgressResponse = {
  generatedAt: string;
  sessionId: string;
  totals: {
    recentLessons: number;
    openedLessons: number;
    savedLessons: number;
    completedLessons: number;
    viewedSlides: number;
    practiceAttempts: number;
    feedbackSubmitted: number;
  };
  continueLesson: LessonProgressState | null;
  recentLessons: LessonProgressState[];
  savedLessons: LessonProgressState[];
  completedLessons: LessonProgressState[];
  recommendedLessons: StudentLessonSummary[];
  emptyState?: { title: string; detail: string } | null;
};

async function fetchStudentProgress(sessionId: string): Promise<StudentProgressResponse> {
  const response = await fetch(`/api/student/progress?sessionId=${encodeURIComponent(sessionId)}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Study progress is temporarily unavailable.");
  return response.json();
}

function shortDate(value?: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LessonRow({ state }: { state: LessonProgressState }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant={state.completed ? "default" : "outline"} className={state.completed ? "bg-emerald-600 text-white" : ""}>
              {state.completed ? "Complete" : state.status.replace(/_/g, " ")}
            </Badge>
            {state.saved ? <Badge variant="outline">Saved</Badge> : null}
            {state.lesson.weakTopic ? <Badge variant="outline">{state.lesson.weakTopic}</Badge> : null}
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-950">{state.lesson.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{state.lesson.topic}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{state.practiceAttempts} practice attempts</span>
            <span>{state.feedbackSubmitted} feedback notes</span>
            <span>Last activity {shortDate(state.lastActivityAt)}</span>
          </div>
        </div>
        <a href={state.learnerUrl}>
          <Button size="sm">
            Open
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}

export default function StudentProgress() {
  const sessionId = useMemo(() => getStudentSessionId(), []);
  const lastUpload = useMemo(() => getLastUploadedReport(), []);
  const progressQuery = useQuery<StudentProgressResponse>({
    queryKey: ["/api/student/progress", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchStudentProgress(sessionId),
  });
  const progress = progressQuery.data;

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
              <div className="text-xs text-slate-500">My Study Path</div>
            </div>
          </a>
          <nav className="flex flex-wrap gap-2 text-sm">
            <a href="/student" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Library</a>
            <a href="/student/study-pack" className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">Study Pack</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Anonymous browser progress</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">My Study Path</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Continue recent lessons, review saved content, and keep track of practice and feedback without creating an account.
          </p>
        </div>

        {progressQuery.isLoading ? (
          <Card className="rounded-md"><CardContent className="p-6">Loading your study path...</CardContent></Card>
        ) : progressQuery.isError ? (
          <Card className="rounded-md border-red-200 bg-red-50"><CardContent className="p-6 text-red-900">Study path could not be loaded.</CardContent></Card>
        ) : progress ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Saved", progress.totals.savedLessons, BookMarked],
                ["Opened", progress.totals.openedLessons, BookOpenCheck],
                ["Completed", progress.totals.completedLessons, CheckCircle2],
                ["Practice", progress.totals.practiceAttempts, ClipboardList],
                ["Feedback", progress.totals.feedbackSubmitted, MessageSquare],
              ].map(([label, value, Icon]) => {
                const IconComponent = Icon as typeof BookMarked;
                return (
                  <div key={String(label)} className="rounded-md border border-slate-200 bg-white p-4">
                    <IconComponent className="mb-3 h-5 w-5 text-emerald-700" />
                    <div className="text-2xl font-semibold text-slate-950">{Number(value)}</div>
                    <div className="text-xs uppercase text-slate-500">{String(label)}</div>
                  </div>
                );
              })}
            </div>

            {lastUpload ? (
              <Card className="rounded-md border-blue-200 bg-blue-50">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Latest assessment upload</Badge>
                    <h2 className="mt-2 font-semibold text-blue-950">Your launch preview guide is ready</h2>
                    <p className="mt-1 text-sm leading-6 text-blue-900">
                      {lastUpload.topicsFound ? `${lastUpload.topicsFound} topics were identified. ` : ""}
                      Open the guide, then save or complete lessons to fill this path.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={lastUpload.nextStep || `/professional-study-guide/${lastUpload.reportId}`}>
                      <Button size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Open guide
                      </Button>
                    </a>
                    <a href="/student">
                      <Button size="sm" variant="outline">Browse lessons</Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {progress.continueLesson ? (
              <Card className="rounded-md border-emerald-200 bg-emerald-50">
                <CardHeader>
                  <CardTitle className="text-lg">Continue where you left off</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-emerald-950">{progress.continueLesson.lesson.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">{progress.continueLesson.lesson.topic}</p>
                  </div>
                  <a href={progress.continueLesson.learnerUrl}>
                    <Button>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-md">
                <CardContent className="p-6">
                  <h2 className="font-semibold text-slate-950">{progress.emptyState?.title || "Start your first lesson."}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{progress.emptyState?.detail}</p>
                  <a href="/student"><Button className="mt-4">Browse lessons</Button></a>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent lessons</h2>
                  <a href="/student/study-pack" className="text-sm font-medium text-emerald-700">Open study pack</a>
                </div>
                {progress.recentLessons.length ? progress.recentLessons.map((state) => (
                  <LessonRow key={state.packageId} state={state} />
                )) : <div className="rounded-md border bg-white p-5 text-sm text-slate-600">No recent lessons yet.</div>}
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Recommended next</h2>
                {progress.recommendedLessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-md border bg-white p-4">
                    <Badge variant="outline">{lesson.weakTopic || lesson.nclexCategory || "Clinical Judgment"}</Badge>
                    <h3 className="mt-2 font-semibold text-slate-950">{lesson.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{lesson.estimatedMinutes} min • {lesson.citationCount} citations</p>
                    <a href={lesson.learnerUrl}><Button className="mt-3" size="sm" variant="outline">Open lesson</Button></a>
                  </div>
                ))}
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
