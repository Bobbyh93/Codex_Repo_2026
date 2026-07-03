import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MessageSquareText,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type LearnerAssignment = {
  assignment: {
    id: string;
    title: string;
    cohortName: string;
    dueDate?: string | null;
    status: string;
  };
  learner: {
    id: string;
    learnerName: string;
    status: string;
    openedAt?: string | null;
    completedAt?: string | null;
    lastActivityAt?: string | null;
    feedbackRating?: string | null;
  };
  progress: {
    status: string;
    completionPercent: number;
    opened: boolean;
    completed: boolean;
    openedAt?: string | null;
    completedAt?: string | null;
    lastActivityAt?: string | null;
    nextAction: string;
    slideProgress: {
      viewed: number;
      total: number;
    };
    practice: {
      viewed: number;
      attempted: number;
      total: number;
      attempts: number;
      correct: number;
      latest?: {
        selectedAnswer?: string | null;
        correctAnswer?: string | null;
        isCorrect?: boolean | null;
        createdAt?: string | null;
      } | null;
    };
    feedback: {
      submitted: boolean;
      rating?: string | null;
      comment?: string | null;
      submittedAt?: string | null;
    };
    eventCounts: Record<string, number>;
  };
  links: {
    dashboardUrl: string;
    lessonUrl: string;
  };
  lesson: {
    package: {
      id: string;
      title: string;
      topic: string;
      audience: string;
      publishedAt?: string | null;
      assessmentBridge?: {
        weakTopic?: string;
        atiCategory?: string | null;
        nclexCategory?: string | null;
        cjmStep?: string | null;
        sourceTitle?: string | null;
      } | null;
      manifestSummary?: {
        requiredFileCount?: number;
        counts?: Record<string, number>;
      };
    };
    deck: {
      slideCount: number;
      grammar: string;
    };
    sources: Array<{
      title: string;
      subject?: string | null;
      sourceType?: string | null;
      citationPolicy?: string | null;
      officialPilotSource?: boolean;
      normalizationStatus?: string | null;
    }>;
    practiceItems: Array<{
      id: string;
      stem: string;
      difficulty?: string | null;
    }>;
    citations: Array<{
      id: string;
      citationLabel: string;
    }>;
  };
};

function getAssignmentSessionId(assignmentId: string, learnerId: string) {
  const key = `nursestudy.assignment.${assignmentId}.${learnerId}.session`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const generated = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `assignment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(key, generated);
    return generated;
  } catch {
    return `assignment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function formatStatus(value?: string | null) {
  if (!value) return "Not started";
  return value.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function ProgressStep({ label, complete, detail }: { label: string; complete: boolean; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-950">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-600">{detail}</div>
      </div>
    </div>
  );
}

export default function LearnerAssignment() {
  const [, params] = useRoute("/lesson-assignments/:assignmentId/learner/:learnerId");
  const assignmentId = params?.assignmentId || "";
  const learnerId = params?.learnerId || "";
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const learnerKey = searchParams.get("learnerKey") || "";
  const [sessionId, setSessionId] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("helpful");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"complete" | "feedback" | null>(null);

  const assignmentQuery = useQuery<LearnerAssignment>({
    queryKey: ["/api/lesson-assignments", assignmentId, learnerId, learnerKey],
    enabled: Boolean(assignmentId && learnerId && learnerKey),
    queryFn: async () => {
      const response = await fetch(`/api/lesson-assignments/${encodeURIComponent(assignmentId)}/learner/${encodeURIComponent(learnerId)}?learnerKey=${encodeURIComponent(learnerKey)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Assignment link not found or no longer active." : "Failed to load assignment.");
      }
      return response.json();
    },
  });

  const assignment = assignmentQuery.data;
  const lessonUrl = assignment?.links.lessonUrl || "";
  const progress = assignment?.progress;
  const packageInfo = assignment?.lesson.package;
  const bridgeTags = useMemo(() => {
    const bridge = packageInfo?.assessmentBridge;
    return [bridge?.atiCategory, bridge?.nclexCategory, bridge?.cjmStep].filter(Boolean);
  }, [packageInfo?.assessmentBridge]);

  useEffect(() => {
    if (!assignmentId || !learnerId) return;
    setSessionId(getAssignmentSessionId(assignmentId, learnerId));
  }, [assignmentId, learnerId]);

  useEffect(() => {
    if (assignment?.progress.feedback.rating) {
      setFeedbackRating(assignment.progress.feedback.rating);
    }
    if (assignment?.progress.feedback.comment) {
      setFeedbackComment(assignment.progress.feedback.comment);
    }
  }, [assignment?.progress.feedback.rating, assignment?.progress.feedback.comment]);

  const postSignal = async (path: "events" | "feedback", body: Record<string, any>) => {
    if (!assignment) return;
    const response = await fetch(`/api/lessons/${assignment.lesson.package.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId,
        assignmentId,
        assignmentLearnerId: learnerId,
        learnerKey,
        ...body,
      }),
    });
    if (!response.ok) {
      throw new Error("The update could not be saved.");
    }
  };

  const markComplete = async () => {
    if (!assignment || !sessionId || busyAction) return;
    try {
      setBusyAction("complete");
      await postSignal("events", {
        eventType: "lesson_completed",
        payload: {
          source: "assignment_dashboard",
          viewedSlideCount: progress?.slideProgress.viewed || 0,
          slideCount: progress?.slideProgress.total || assignment.lesson.deck.slideCount,
        },
      });
      setActionMessage("Completion saved.");
      await assignmentQuery.refetch();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Completion could not be saved.");
    } finally {
      setBusyAction(null);
    }
  };

  const submitFeedback = async () => {
    if (!assignment || !sessionId || busyAction) return;
    try {
      setBusyAction("feedback");
      await postSignal("feedback", {
        rating: feedbackRating,
        comment: feedbackComment,
        payload: {
          source: "assignment_dashboard",
        },
      });
      setActionMessage("Feedback saved for faculty review.");
      await assignmentQuery.refetch();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Feedback could not be saved.");
    } finally {
      setBusyAction(null);
    }
  };

  if (!assignmentId || !learnerId || !learnerKey) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-md border border-red-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-950">Assignment link incomplete</h1>
          <p className="mt-2 text-slate-600">Ask your instructor for the full assignment link.</p>
        </div>
      </main>
    );
  }

  if (assignmentQuery.isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-md border bg-white p-6 text-slate-700">Loading assignment...</div>
      </main>
    );
  }

  if (assignmentQuery.isError || !assignment || !progress || !packageInfo) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-md border border-red-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-950">Assignment unavailable</h1>
          <p className="mt-2 text-slate-600">{assignmentQuery.error instanceof Error ? assignmentQuery.error.message : "The assignment could not be loaded."}</p>
        </div>
      </main>
    );
  }

  const practiceStatus = progress.practice.latest
    ? progress.practice.latest.isCorrect === true
      ? "Latest attempt correct"
      : progress.practice.latest.isCorrect === false
        ? "Latest attempt needs review"
        : "Practice attempted"
    : "No attempt yet";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <GraduationCap className="h-4 w-4" />
              <span>{assignment.assignment.cohortName}</span>
              <Badge variant="outline" className="whitespace-normal text-left">{formatStatus(assignment.learner.status)}</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">{assignment.assignment.title}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {assignment.learner.learnerName} | {packageInfo.audience}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assignment.assignment.dueDate ? (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                <Clock3 className="mr-1 h-3.5 w-3.5" />
                Due {new Date(assignment.assignment.dueDate).toLocaleDateString()}
              </Badge>
            ) : null}
            <Badge className={progress.completed ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-blue-100 text-blue-800 hover:bg-blue-100"}>
              {progress.nextAction}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-md border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <BookOpenCheck className="h-4 w-4 text-slate-500" />
                  Assigned Lesson
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{packageInfo.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{packageInfo.topic}</p>
              </div>
              <Button onClick={() => window.location.assign(lessonUrl)} className="shrink-0">
                Open Lesson
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {packageInfo.assessmentBridge?.weakTopic ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <Target className="h-4 w-4" />
                  Focus area: {packageInfo.assessmentBridge.weakTopic}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bridgeTags.map((tag) => (
                    <Badge key={String(tag)} variant="outline" className="border-emerald-200 bg-white text-emerald-800">{String(tag)}</Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">Assignment progress</span>
                <span className="text-slate-500">{progress.completionPercent}%</span>
              </div>
              <Progress value={progress.completionPercent} className="h-2" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressStep
              label="Open lesson"
              complete={progress.opened}
              detail={progress.opened ? `Opened ${formatDate(progress.openedAt)}` : "Start from the lesson button when ready."}
            />
            <ProgressStep
              label="Review slides"
              complete={progress.slideProgress.total > 0 && progress.slideProgress.viewed >= progress.slideProgress.total}
              detail={`${progress.slideProgress.viewed} of ${progress.slideProgress.total} slide${progress.slideProgress.total === 1 ? "" : "s"} viewed.`}
            />
            <ProgressStep
              label="Try practice"
              complete={progress.practice.total > 0 && progress.practice.attempted >= progress.practice.total}
              detail={`${progress.practice.attempts} attempt${progress.practice.attempts === 1 ? "" : "s"} recorded. ${practiceStatus}.`}
            />
            <ProgressStep
              label="Complete and reflect"
              complete={progress.completed && progress.feedback.submitted}
              detail={progress.completed ? `Completed ${formatDate(progress.completedAt)}.` : "Mark complete and send feedback when finished."}
            />
          </div>

          <div className="rounded-md border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ClipboardCheck className="h-4 w-4 text-slate-500" />
              Completion
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              When you finish the deck and practice item, mark the assignment complete so faculty can see pilot progress.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={markComplete} disabled={progress.completed || busyAction === "complete"}>
                {progress.completed ? "Completed" : busyAction === "complete" ? "Saving..." : "Mark Complete"}
              </Button>
              <Button variant="outline" onClick={() => window.location.assign(lessonUrl)}>
                Continue Lesson
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MessageSquareText className="h-4 w-4 text-slate-500" />
              Feedback
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your feedback helps faculty decide what to clarify before the next pilot cohort.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["helpful", "Helpful"],
                ["confusing", "Confusing"],
                ["too_easy", "Too easy"],
                ["too_hard", "Too hard"],
                ["needs_faculty_review", "Needs review"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFeedbackRating(value)}
                  className={`rounded-md border px-3 py-2 text-sm transition ${feedbackRating === value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Textarea
              value={feedbackComment}
              onChange={(event) => setFeedbackComment(event.target.value)}
              className="mt-3 min-h-24"
              placeholder="Optional note for faculty"
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={submitFeedback} disabled={busyAction === "feedback"}>
                {busyAction === "feedback" ? "Saving..." : progress.feedback.submitted ? "Update Feedback" : "Send Feedback"}
              </Button>
              {progress.feedback.submitted ? <Badge variant="outline">Last sent: {formatStatus(progress.feedback.rating)}</Badge> : null}
            </div>
          </div>

          {actionMessage ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{actionMessage}</div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Lesson Snapshot</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Slides</dt>
                <dd className="font-medium text-slate-900">{assignment.lesson.deck.slideCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Practice items</dt>
                <dd className="font-medium text-slate-900">{assignment.lesson.practiceItems.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Citations</dt>
                <dd className="font-medium text-slate-900">{assignment.lesson.citations.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Export files</dt>
                <dd className="font-medium text-slate-900">{packageInfo.manifestSummary?.requiredFileCount || 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Last activity</dt>
                <dd className="max-w-40 text-right font-medium text-slate-900">{formatDate(progress.lastActivityAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Practice Preview</h2>
            {assignment.lesson.practiceItems.length ? (
              <div className="mt-3 space-y-3">
                {assignment.lesson.practiceItems.slice(0, 2).map((item) => (
                  <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{item.stem}</div>
                    {item.difficulty ? <Badge variant="outline" className="mt-2">{item.difficulty}</Badge> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No practice item is attached to this lesson.</p>
            )}
          </div>

          <div className="rounded-md border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Source Labels</h2>
            <div className="mt-3 space-y-2">
              {assignment.lesson.sources.map((source, index) => (
                <div key={`${source.title}-${index}`} className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                  <div className="font-medium text-slate-900">{source.title}</div>
                  <div>{source.subject || source.sourceType || "Nursing source"}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {source.officialPilotSource ? <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">pilot source</Badge> : null}
                    {source.normalizationStatus ? <Badge variant="outline" className="border-blue-200 bg-white text-blue-700">{source.normalizationStatus}</Badge> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
