import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  BookOpenCheck,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  ListChecks,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSavedLessonIds, getStudentSessionId, rememberSavedLesson } from "@/lib/student-session";

type LessonCitation = {
  id: string;
  citationLabel: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  excerpt?: string | null;
};

type LearnerSlide = {
  id: string;
  slideNumber: number;
  slideType: string;
  title: string;
  visibleContent: Record<string, any>;
  guidedNotes?: string | null;
  retrievalPrompt?: string | null;
  nclexCategory?: string | null;
  cjmStep?: string | null;
  nursingProcess?: string | null;
  bloomLevel?: string | null;
  citations: LessonCitation[];
};

type PracticeItem = {
  id: string;
  slideId?: string | null;
  itemType?: string;
  stem: string;
  options: Array<{ id: string; text: string }>;
  correctAnswer: string;
  rationale: string;
  tags?: Record<string, any>;
  difficulty?: string | null;
  citations: LessonCitation[];
};

type LearnerLesson = {
  package: {
    id: string;
    title: string;
    topic: string;
    audience: string;
    status: string;
    publishedAt?: string | null;
    assessmentBridge?: {
      status?: string;
      weakTopic?: string;
      atiCategory?: string | null;
      nclexCategory?: string | null;
      cjmStep?: string | null;
      sourceTitle?: string | null;
      note?: string | null;
    } | null;
    manifestSummary?: {
      requiredFileCount?: number;
      counts?: Record<string, number>;
    };
    reviewSummary?: {
      status: string;
      passedCount: number;
      totalCount: number;
      checklist: Array<{
        label: string;
        passed: boolean;
        detail: string;
      }>;
      decisions?: {
        draftReview?: string;
        phaseThree?: string;
        studentLaunch?: string;
        previewReview?: string;
      };
      reviewerFocus?: string[];
      recommendation?: string;
    } | null;
  };
  deck: {
    grammar: string;
    slideCount: number;
  };
  sources: Array<{
    title: string;
    sourceKind?: string;
    sourceType?: string;
    subject?: string;
    edition?: string;
    citationPolicy?: string;
    normalizationStatus?: string | null;
    officialPilotSource?: boolean;
  }>;
  slides: LearnerSlide[];
  practiceItems: PracticeItem[];
  citations: LessonCitation[];
  assignment?: {
    id: string;
    title: string;
    cohortName: string;
    dueDate?: string | null;
    status: string;
    learner: {
      id: string;
      learnerName: string;
      learnerEmail?: string | null;
      status: string;
      openedAt?: string | null;
      completedAt?: string | null;
      feedbackRating?: string | null;
    };
  } | null;
};

function formatLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function renderVisibleValue(value: any) {
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === "object") {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key}>
            <span className="font-medium text-slate-900">{formatLabel(key)}: </span>
            <span>{String(nestedValue)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <p>{String(value ?? "")}</p>;
}

function CitationList({ citations }: { citations: LessonCitation[] }) {
  if (!citations.length) {
    return <p className="text-sm text-slate-500">No citation attached.</p>;
  }

  return (
    <div className="space-y-3">
      {citations.map((citation) => (
        <div key={citation.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Quote className="h-4 w-4 text-slate-500" />
            {citation.citationLabel}
            {citation.pageStart ? <span className="text-xs text-slate-500">p. {citation.pageStart}</span> : null}
          </div>
          {citation.excerpt ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{citation.excerpt}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function postLessonSignal(lessonId: string, path: "events" | "feedback", body: Record<string, any>) {
  try {
    await fetch(`/api/lessons/${lessonId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn("Lesson signal could not be recorded", error);
  }
}

export default function LessonPackage() {
  const [, params] = useRoute("/lessons/:id");
  const lessonId = params?.id;
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const assignmentId = searchParams.get("assignmentId") || "";
  const assignmentLearnerId = searchParams.get("assignmentLearnerId") || "";
  const learnerKey = searchParams.get("learnerKey") || "";
  const previewKey = searchParams.get("previewKey") || "";
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [lessonSaved, setLessonSaved] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState("helpful");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [previewReviewOutcome, setPreviewReviewOutcome] = useState("ready_for_release");
  const [previewReviewNotes, setPreviewReviewNotes] = useState("");
  const [previewReviewSubmitted, setPreviewReviewSubmitted] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const openedRef = useRef(false);
  const viewedSlideIdsRef = useRef(new Set<string>());
  const viewedPracticeIdsRef = useRef(new Set<string>());
  const attemptedPracticeIdsRef = useRef(new Set<string>());

  const lessonQuery = useQuery<LearnerLesson>({
    queryKey: ["/api/lessons", lessonId, assignmentId, assignmentLearnerId, learnerKey, previewKey],
    enabled: Boolean(lessonId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (assignmentId && assignmentLearnerId && learnerKey) {
        params.set("assignmentId", assignmentId);
        params.set("assignmentLearnerId", assignmentLearnerId);
        params.set("learnerKey", learnerKey);
      }
      if (previewKey) params.set("previewKey", previewKey);
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/lessons/${lessonId}${queryString}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Lesson is not published or no longer exists." : "Failed to load lesson.");
      }
      return response.json();
    },
  });

  const lesson = lessonQuery.data;
  const slides = lesson?.slides || [];
  const currentSlide = slides[currentSlideIndex];
  const assignmentSignal = lesson?.assignment ? {
    assignmentId: lesson.assignment.id,
    assignmentLearnerId: lesson.assignment.learner.id,
    learnerKey,
  } : {};
  const previewSignal = previewKey ? { previewKey } : {};
  const currentPracticeItems = useMemo(() => {
    if (!lesson || !currentSlide) return [];
    const linked = lesson.practiceItems.filter((item) => item.slideId === currentSlide.id);
    return linked.length ? linked : lesson.practiceItems;
  }, [lesson, currentSlide]);
  const answeredPracticeCount = useMemo(
    () => lesson ? lesson.practiceItems.filter((item) => Boolean(practiceAnswers[item.id])).length : 0,
    [lesson, practiceAnswers]
  );

  useEffect(() => {
    if (slides.length && currentSlideIndex > slides.length - 1) {
      setCurrentSlideIndex(0);
    }
  }, [slides.length, currentSlideIndex]);

  useEffect(() => {
    if (!lessonId) return;
    setSessionId(getStudentSessionId());
    setLessonSaved(getSavedLessonIds().has(lessonId));
  }, [lessonId]);

  useEffect(() => {
    if (lesson?.assignment?.learner.status === "completed") {
      setLessonCompleted(true);
    }
    if (lesson?.assignment?.learner.feedbackRating) {
      setFeedbackRating(lesson.assignment.learner.feedbackRating);
      setFeedbackSubmitted(true);
    }
  }, [lesson?.assignment?.learner.status, lesson?.assignment?.learner.feedbackRating]);

  useEffect(() => {
    if (!lessonId || !lesson || !sessionId || openedRef.current) return;
    openedRef.current = true;
    postLessonSignal(lessonId, "events", {
      sessionId,
      ...assignmentSignal,
      ...previewSignal,
      eventType: "lesson_opened",
      payload: {
        title: lesson.package.title,
        slideCount: slides.length,
      },
    });
  }, [lessonId, lesson, sessionId, slides.length]);

  useEffect(() => {
    if (!lessonId || !sessionId || !currentSlide || viewedSlideIdsRef.current.has(currentSlide.id)) return;
    viewedSlideIdsRef.current.add(currentSlide.id);
    postLessonSignal(lessonId, "events", {
      sessionId,
      ...assignmentSignal,
      ...previewSignal,
      eventType: "slide_viewed",
      slideId: currentSlide.id,
      payload: {
        slideNumber: currentSlide.slideNumber,
        slideType: currentSlide.slideType,
      },
    });
  }, [lessonId, sessionId, currentSlide]);

  useEffect(() => {
    if (!lessonId || !sessionId || currentPracticeItems.length === 0) return;
    for (const item of currentPracticeItems) {
      if (viewedPracticeIdsRef.current.has(item.id)) continue;
      viewedPracticeIdsRef.current.add(item.id);
      postLessonSignal(lessonId, "events", {
        sessionId,
        ...assignmentSignal,
        ...previewSignal,
        eventType: "practice_viewed",
        slideId: currentSlide?.id,
        itemId: item.id,
        payload: {
          difficulty: item.difficulty,
        },
      });
    }
  }, [lessonId, sessionId, currentPracticeItems, currentSlide?.id]);

  const recordPracticeAttempt = async (item: PracticeItem, selectedAnswer: string) => {
    setPracticeAnswers((answers) => ({ ...answers, [item.id]: selectedAnswer }));
    if (!lessonId || !sessionId || attemptedPracticeIdsRef.current.has(item.id)) return;
    attemptedPracticeIdsRef.current.add(item.id);
    await postLessonSignal(lessonId, "events", {
      sessionId,
      ...assignmentSignal,
      ...previewSignal,
      eventType: "practice_attempted",
      slideId: currentSlide?.id,
      itemId: item.id,
      payload: {
        selectedAnswer,
        correctAnswer: item.correctAnswer,
        isCorrect: selectedAnswer === item.correctAnswer,
        difficulty: item.difficulty,
      },
    });
  };

  const markLessonComplete = async () => {
    if (!lessonId || !sessionId || lessonCompleted) return;
    setLessonCompleted(true);
    await postLessonSignal(lessonId, "events", {
      sessionId,
      ...assignmentSignal,
      ...previewSignal,
      eventType: "lesson_completed",
      slideId: currentSlide?.id,
      payload: {
        viewedSlideCount: viewedSlideIdsRef.current.size,
        slideCount: slides.length,
      },
    });
  };

  const saveLesson = async () => {
    if (!lessonId || !sessionId || lessonSaved) return;
    setLessonSaved(true);
    rememberSavedLesson(lessonId);
    await postLessonSignal(lessonId, "events", {
      sessionId,
      ...assignmentSignal,
      ...previewSignal,
      eventType: "lesson_saved",
      slideId: currentSlide?.id,
      payload: {
        title: lesson?.package.title,
        weakTopic: lesson?.package.assessmentBridge?.weakTopic || null,
      },
    });
  };

  const scrollToLessonSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitFeedback = async () => {
    if (!lessonId || !sessionId || feedbackSubmitted) return;
    await postLessonSignal(lessonId, "feedback", {
      sessionId,
      ...assignmentSignal,
      ...previewSignal,
      slideId: currentSlide?.id,
      rating: feedbackRating,
      comment: feedbackComment,
      payload: {
        slideNumber: currentSlide?.slideNumber,
      },
    });
    setFeedbackSubmitted(true);
  };

  const submitPreviewReviewOutcome = async () => {
    if (!lessonId || !previewKey || previewReviewSubmitted) return;
    try {
      const response = await fetch(`/api/lessons/${lessonId}/preview-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previewKey,
          outcome: previewReviewOutcome,
          reviewerNotes: previewReviewNotes,
        }),
      });
      if (!response.ok) throw new Error("Preview review was not recorded.");
      setPreviewReviewSubmitted(true);
    } catch (error) {
      console.warn("Preview review could not be recorded", error);
    }
  };

  if (lessonQuery.isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl rounded-md border bg-white p-6 text-slate-700">Loading lesson...</div>
      </main>
    );
  }

  if (lessonQuery.isError || !lesson || !currentSlide) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-md border border-red-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-950">Lesson unavailable</h1>
          <p className="mt-2 text-slate-600">{lessonQuery.error instanceof Error ? lessonQuery.error.message : "The lesson could not be loaded."}</p>
        </div>
      </main>
    );
  }

  const canGoBack = currentSlideIndex > 0;
  const canGoNext = currentSlideIndex < slides.length - 1;
  const isControlledPreview = Boolean(previewKey && lesson.package.status !== "published");
  const slideProgressPercent = Math.round(((currentSlideIndex + 1) / Math.max(1, slides.length)) * 100);
  const guidedNotesCount = slides.filter((slide) => Boolean(String(slide.guidedNotes || "").trim())).length;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <BookOpenCheck className="h-4 w-4" />
              <span>{lesson.package.audience}</span>
              <Badge variant="outline" className="max-w-full whitespace-normal text-left">{lesson.deck.grammar}</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">{lesson.package.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{lesson.package.topic}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/student"; }}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to library
            </Button>
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/student/progress"; }}>
              <ListChecks className="mr-1 h-4 w-4" />
              Study path
            </Button>
            <Button variant={lessonSaved ? "default" : "outline"} size="sm" onClick={saveLesson} disabled={lessonSaved}>
              <Bookmark className="mr-1 h-4 w-4" />
              {lessonSaved ? "Saved" : "Save lesson"}
            </Button>
            {isControlledPreview ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Controlled preview
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Published
              </Badge>
            )}
            <Badge variant={lessonCompleted ? "default" : "outline"} className={lessonCompleted ? "bg-blue-600 text-white" : ""}>
              {lessonCompleted ? "Completed" : "In progress"}
            </Badge>
            <Badge variant="outline">{slides.length} slides</Badge>
            <Badge variant="outline">{lesson.practiceItems.length} practice item</Badge>
          </div>
        </div>
      </div>

      {lesson.assignment ? (
        <div className="border-b bg-blue-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 text-sm text-blue-950 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="font-semibold">{lesson.assignment.title}</span>
              <span className="ml-2 text-blue-800">{lesson.assignment.cohortName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white text-blue-800 hover:bg-white">{lesson.assignment.learner.learnerName}</Badge>
              <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">{lesson.assignment.learner.status.replace(/_/g, " ")}</Badge>
              {lesson.assignment.dueDate ? (
                <span className="text-blue-800">Due {new Date(lesson.assignment.dueDate).toLocaleDateString()}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {lesson.package.assessmentBridge?.weakTopic ? (
        <div className="border-b bg-emerald-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 text-sm text-emerald-950 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="font-semibold">Assessment anchor</span>
              <span className="ml-2 text-emerald-800">{lesson.package.assessmentBridge.weakTopic}</span>
              {lesson.package.assessmentBridge.sourceTitle ? (
                <span className="ml-2 text-emerald-700">Source: {lesson.package.assessmentBridge.sourceTitle}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                lesson.package.assessmentBridge.atiCategory,
                lesson.package.assessmentBridge.nclexCategory,
                lesson.package.assessmentBridge.cjmStep,
              ].filter(Boolean).map((tag) => (
                <Badge key={String(tag)} variant="outline" className="border-emerald-200 bg-white text-emerald-800">{String(tag)}</Badge>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
              <GraduationCap className="h-4 w-4 text-slate-500" />
              My study path
              <Badge variant="outline">{slideProgressPercent}% deck</Badge>
              <Badge variant="outline">{answeredPracticeCount}/{lesson.practiceItems.length} quiz</Badge>
              <Badge variant="outline">{guidedNotesCount} note prompts</Badge>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${slideProgressPercent}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => scrollToLessonSection("lesson-deck")}>Deck</Button>
            <Button size="sm" variant="outline" onClick={() => scrollToLessonSection("lesson-practice")}>Practice</Button>
            <Button size="sm" variant="outline" onClick={() => scrollToLessonSection("lesson-guided-notes")}>Guided notes</Button>
            <Button size="sm" variant="outline" onClick={() => scrollToLessonSection("lesson-citations")}>Citations</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside id="lesson-deck" className="min-w-0 scroll-mt-24 rounded-md border bg-white p-3 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-slate-500" />
            Lesson Deck
          </div>
          <div className="space-y-1">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentSlideIndex(index)}
                className={`w-full min-w-0 rounded-md px-3 py-2 text-left text-sm transition ${
                  index === currentSlideIndex
                    ? "bg-blue-50 text-blue-800"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="block text-xs font-medium uppercase text-slate-500">Slide {slide.slideNumber}</span>
                <span className="line-clamp-2 break-words">{slide.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-md border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium uppercase text-slate-500">Slide {currentSlide.slideNumber}</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{currentSlide.title}</h2>
              </div>
              <Badge variant="outline">{formatLabel(currentSlide.slideType)}</Badge>
            </div>

            <div className="mt-5 grid gap-4">
              {Object.entries(currentSlide.visibleContent || {}).map(([key, value]) => (
                <div key={key} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">{formatLabel(key)}</div>
                  <div className="mt-2 text-base leading-7 text-slate-900">{renderVisibleValue(value)}</div>
                </div>
              ))}
            </div>

            {currentSlide.retrievalPrompt ? (
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
                <div className="text-xs font-semibold uppercase text-blue-700">Practice Prompt</div>
                <p className="mt-2 leading-7 text-blue-950">{currentSlide.retrievalPrompt}</p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                currentSlide.nclexCategory,
                currentSlide.cjmStep,
                currentSlide.nursingProcess,
                currentSlide.bloomLevel,
              ].filter(Boolean).map((tag) => (
                <Badge key={String(tag)} variant="outline">{String(tag)}</Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setCurrentSlideIndex((value) => Math.max(0, value - 1))} disabled={!canGoBack}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm text-slate-500">{currentSlideIndex + 1} of {slides.length}</div>
            <Button variant="outline" onClick={() => setCurrentSlideIndex((value) => Math.min(slides.length - 1, value + 1))} disabled={!canGoNext}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div id="lesson-practice" className="scroll-mt-24 space-y-4">
          {currentPracticeItems.map((item) => {
            const selectedAnswer = practiceAnswers[item.id];
            const hasAttempted = Boolean(selectedAnswer);
            return (
            <div key={item.id} className="rounded-md border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText className="h-4 w-4 text-slate-500" />
                  Practice Item
                </div>
                {item.difficulty ? <Badge variant="outline">{item.difficulty}</Badge> : null}
              </div>
              <p className="mt-4 text-base font-medium leading-7 text-slate-950">{item.stem}</p>
              <div className="mt-4 grid gap-2">
                {item.options.map((option) => {
                  const isSelected = selectedAnswer === option.id;
                  const isCorrect = item.correctAnswer === option.id;
                  const answerStateClass = !hasAttempted
                    ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    : isCorrect
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : isSelected
                        ? "border-rose-300 bg-rose-50 text-rose-950"
                        : "border-slate-200 bg-white text-slate-700";
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => recordPracticeAttempt(item, option.id)}
                      className={`rounded-md border p-3 text-left text-sm transition ${answerStateClass} ${isSelected ? "ring-2 ring-blue-300" : ""}`}
                    >
                      <span className="font-semibold">{option.id}.</span> {option.text}
                      {hasAttempted && isCorrect ? <span className="ml-2 text-xs font-medium text-emerald-700">Correct answer</span> : null}
                      {hasAttempted && isSelected && !isCorrect ? <span className="ml-2 text-xs font-medium text-rose-700">Selected</span> : null}
                    </button>
                  );
                })}
              </div>
              {practiceAnswers[item.id] ? (
                <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                  Practice attempt recorded: {practiceAnswers[item.id]}.
                </div>
              ) : null}
              {hasAttempted ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold uppercase text-emerald-700">Rationale</div>
                  <p className="mt-2 leading-7 text-emerald-950">{item.rationale}</p>
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Select an answer to review the rationale.
                </div>
              )}
            </div>
            );
          })}
          </div>
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div id="lesson-guided-notes" className="scroll-mt-24 rounded-md border bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Guided Notes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
              {currentSlide.guidedNotes || "No guided notes for this slide."}
            </p>
          </div>

          <div id="lesson-citations" className="scroll-mt-24 rounded-md border bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Citations</h2>
            <div className="mt-3">
              <CitationList citations={currentSlide.citations} />
            </div>
          </div>

          {isControlledPreview && lesson.package.reviewSummary ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase text-amber-800">Preview Review Checklist</h2>
                <Badge variant="outline" className="border-amber-300 bg-white text-amber-800">
                  {lesson.package.reviewSummary.passedCount}/{lesson.package.reviewSummary.totalCount}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {lesson.package.reviewSummary.checklist.map((check) => (
                  <div key={check.label} className="rounded-md border border-amber-200 bg-white p-2 text-xs text-amber-950">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className={`h-3.5 w-3.5 ${check.passed ? "text-emerald-600" : "text-amber-600"}`} />
                      {check.label}
                    </div>
                    <div className="mt-1 text-amber-800">{check.detail}</div>
                  </div>
                ))}
              </div>
              {lesson.package.reviewSummary.reviewerFocus?.length ? (
                <div className="mt-3 rounded-md bg-white p-2 text-xs text-amber-950">
                  <div className="font-medium">Reviewer focus</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {lesson.package.reviewSummary.reviewerFocus.map((focus) => (
                      <li key={focus}>{focus}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lesson.package.reviewSummary.recommendation ? (
                <p className="mt-3 text-xs font-medium text-amber-900">{lesson.package.reviewSummary.recommendation}</p>
              ) : null}
              <div className="mt-4 rounded-md bg-white p-3">
                <div className="text-xs font-semibold uppercase text-amber-800">Record preview outcome</div>
                <div className="mt-2 grid gap-2">
                  {[
                    ["ready_for_release", "Ready"],
                    ["needs_fix", "Needs fixes"],
                    ["hold_release", "Hold"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPreviewReviewOutcome(value)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${previewReviewOutcome === value ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={previewReviewNotes}
                  onChange={(event) => setPreviewReviewNotes(event.target.value)}
                  className="mt-3 min-h-16 w-full rounded-md border border-amber-200 p-3 text-sm text-slate-800 outline-none focus:border-amber-400"
                  placeholder="Optional reviewer note for the admin launch gate"
                />
                <Button className="mt-3 w-full" variant="outline" onClick={submitPreviewReviewOutcome} disabled={previewReviewSubmitted}>
                  {previewReviewSubmitted ? "Outcome recorded" : "Record outcome"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-md border bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Lesson Feedback</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
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
            <textarea
              value={feedbackComment}
              onChange={(event) => setFeedbackComment(event.target.value)}
              className="mt-3 min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-blue-400"
              placeholder="Optional note for the faculty reviewer"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={submitFeedback} disabled={feedbackSubmitted}>
                {feedbackSubmitted ? "Feedback sent" : "Send Feedback"}
              </Button>
              <Button variant="outline" onClick={markLessonComplete} disabled={lessonCompleted}>
                {lessonCompleted ? "Complete" : "Mark Complete"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Package</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Sources</dt>
                <dd className="font-medium text-slate-900">{lesson.sources.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Citations</dt>
                <dd className="font-medium text-slate-900">{lesson.citations.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Export files</dt>
                <dd className="font-medium text-slate-900">{lesson.package.manifestSummary?.requiredFileCount || 0}</dd>
              </div>
              {lesson.package.publishedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Published</dt>
                  <dd className="text-right font-medium text-slate-900">{new Date(lesson.package.publishedAt).toLocaleDateString()}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Source labels</div>
              {lesson.sources.map((source, index) => (
                <div key={`${source.title}-${index}`} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <div className="font-medium text-slate-900">{source.title}</div>
                  <div>{source.subject || source.sourceType || "Nursing source"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
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
