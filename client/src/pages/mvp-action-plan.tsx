import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, CheckCircle, ArrowLeft, FileText, Mail, Clock, ChevronDown, Info } from "lucide-react";
import { AnalyzingLoader } from "@/components/ui/loading-state";
import { TopicListSkeleton } from "@/components/ui/skeleton";
import { NoTopicsFound } from "@/components/ui/empty-state";
import { useSuccessFeedback } from "@/components/ui/success-feedback";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { track, EVENTS } from "@/lib/analytics";
import { PageHeader, BrandLogo } from "@/components/ui/page-header";
import { Link, useLocation, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";

const BANNED_BRANDS = /\b(ATI|HESI|Pearson|Kaplan|UWorld)\b/gi;
function sanitizeAssessmentName(name?: string | null): string {
  if (!name) return "Nursing Assessment";
  const cleaned = name.replace(BANNED_BRANDS, "").replace(/\s{2,}/g, " ").trim();
  return cleaned || "Nursing Assessment";
}

// Ratio below which the partial-coverage notice is shown (1 = full coverage required)
const PARTIAL_COVERAGE_THRESHOLD = 1;

// ── CJM phase metadata ──────────────────────────────────────────────────────
const CJM_META: Record<string, { color: string; npLabel: string; description: string }> = {
  "Recognize Cues": {
    color: "#0369a1",
    npLabel: "Assessment",
    description: "Collect & identify abnormal findings",
  },
  "Analyze Cues": {
    color: "#7c3aed",
    npLabel: "Pathophysiology",
    description: "Understand the disease process & causes",
  },
  "Prioritize Hypotheses": {
    color: "#b45309",
    npLabel: "Nursing Diagnosis",
    description: "Identify priority nursing problems",
  },
  "Generate Solutions & Take Action": {
    color: "#059669",
    npLabel: "Interventions",
    description: "Apply nursing interventions & treatment",
  },
  "Evaluate Outcomes": {
    color: "#dc2626",
    npLabel: "Evaluation",
    description: "Monitor expected outcomes & complications",
  },
};

const SUBJECT_COLORS: Record<string, string> = {
  "Med-Surg":                   "bg-blue-600",
  "Medical-Surgical Nursing":   "bg-blue-600",
  "Pharmacology":               "bg-amber-600",
  "Fundamentals":               "bg-teal-600",
  "Fundamentals of Nursing":    "bg-teal-600",
  "Mental Health":              "bg-purple-600",
  "Mental Health Nursing":      "bg-purple-600",
  "Maternal/Newborn":           "bg-pink-600",
  "Maternal-Newborn Nursing":   "bg-pink-600",
  "Pediatrics":                 "bg-orange-500",
  "Community Health":           "bg-emerald-600",
  "Leadership":                 "bg-slate-600",
};

function subjectColorClass(subject: string) {
  return SUBJECT_COLORS[subject] ?? "bg-primary";
}

function gapColor(gap: number): string {
  if (gap >= 35) return "text-red-600";
  if (gap >= 20) return "text-orange-500";
  return "text-green-600";
}

function scoreBadgeBg(score: number): string {
  if (score < 70) return "bg-red-50 border-red-200 text-red-700";
  if (score < 80) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-green-50 border-green-200 text-green-700";
}

function scoreTextColor(score: number): string {
  if (score < 70) return "text-red-600";
  if (score < 80) return "text-orange-500";
  return "text-green-600";
}

function studyTimeLabel(gap: number): string {
  const mins = Math.ceil(gap * 2);
  if (mins <= 15) return "~15 min";
  if (mins <= 30) return "~30 min";
  if (mins <= 45) return "~45 min";
  if (mins <= 75) return "~1 hr";
  return "~1–2 hrs";
}

function formatTotalTime(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr${hrs !== 1 ? "s" : ""}`;
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ${mins} min`;
}

// ── Types ───────────────────────────────────────────────────────────────────
interface FlatTopic { name: string; altType?: string; groupScore: number | null; subcategory?: string; cjmPhase: string; }
interface SubjectCluster {
  name: string;
  bodySystem?: string;
  population?: string;
  avgScore: number;
  cjmGroups: Array<{ phase: string; topics: FlatTopic[] }>;
}
interface SubjectReport {
  reportNumber: number;
  subject: string;
  displaySubject: string;
  avgGap: number;
  topicCount: number;
  allTopics: FlatTopic[];
  clusters: SubjectCluster[];
}
interface StudyPlan { reports: SubjectReport[]; totalTopics: number; }
interface ChapterRef {
  chapterId: string | null;
  chapterNumber: string | null;
  chapterTitle: string | null;
  textbookTitle: string | null;
  pageStart: number | null;
  pageEnd: number | null;
}
interface TopicChaptersMeta { coverageRatio: number; coveredTopics: number; totalTopics: number; }
interface TopicChaptersResponse {
  refs: Record<string, ChapterRef[]>;
  refsByTopicName: Record<string, ChapterRef[]>;
  coverageRatio: number;
  coveredTopics: number;
  totalTopics: number;
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ExamRecoveryBlueprint() {
  const [step, setStep]                     = useState<"upload" | "plan">("upload");
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [email, setEmail]                   = useState("");
  const [emailSent, setEmailSent]           = useState(false);
  const [agreedToSubscribe, setAgreedToSubscribe] = useState(false);
  const [reportId, setReportId]             = useState<string | null>(null);
  const [activeReport, setActiveReport]     = useState(0);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [shareEmail, setShareEmail]         = useState("");
  const { toast }                           = useToast();
  const [, navigate]                        = useLocation();
  const successFeedback                     = useSuccessFeedback();
  const params                              = useParams<{ reportId?: string }>();
  const { isAuthenticated, token }          = useAuth();

  useEffect(() => {
    if (params.reportId) { setReportId(params.reportId); setStep("plan"); return; }
    const urlParams = new URLSearchParams(window.location.search);
    const urlId     = urlParams.get("reportId");
    const storedId  = localStorage.getItem("lastReportId");
    if (urlId)      { setReportId(urlId);      setStep("plan"); }
    else if (storedId) { setReportId(storedId); setStep("plan"); }
  }, [params.reportId]);

  const { data: assessmentReport } = useQuery<any>({
    queryKey: ["/api/assessment-reports", reportId],
    enabled: !!reportId,
    retry: (n, e: any) => e?.status !== 404 && n < 3,
  });

  const {
    data: studyPlan,
    isLoading: isLoadingPlan,
    error: planError,
    refetch: refetchPlan,
  } = useQuery<StudyPlan>({
    queryKey: ["/api/assessment-reports", reportId, "focused-clusters"],
    enabled: !!reportId,
    retry: (n, e: any) => e?.status !== 404 && n < 3,
  });

  const { data: userProgress } = useQuery<any[]>({
    queryKey: ["/api/progress/topics"],
    enabled: !!reportId && isAuthenticated,
    retry: false,
  });

  const { data: topicChapters } = useQuery<TopicChaptersResponse>({
    queryKey: ["/api/assessment-reports", reportId, "topic-chapters"],
    enabled: !!reportId,
    retry: false,
  });
  const topicChaptersMeta: TopicChaptersMeta | undefined = topicChapters
    ? { coverageRatio: topicChapters.coverageRatio ?? 0, coveredTopics: topicChapters.coveredTopics ?? 0, totalTopics: topicChapters.totalTopics ?? 0 }
    : undefined;

  const markCompleteMutation = useMutation({
    mutationFn: async ({ topicId, studyTimeMinutes }: { topicId: string; studyTimeMinutes?: number }) =>
      apiRequest("POST", "/api/progress/mark-complete", { topicId, studyTimeMinutes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/progress/topics"] }),
    onError: (_err, vars) => {
      setLocalCompleted(prev => [...prev, vars.topicId]);
      toast({ title: "Saved Locally", description: "Progress saved locally and will sync when reconnected." });
    },
  });

  const emailPdfMutation = useMutation({
    mutationFn: async (recipientEmail: string) =>
      apiRequest("POST", `/api/assessment-reports/${reportId}/email-pdf`, { recipientEmail }),
    onSuccess: () => {
      toast({ title: "Study guide sent!", description: `A copy was emailed to ${shareEmail}.` });
      setEmailModalOpen(false);
      setShareEmail("");
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const completedIds = (): string[] => {
    const backend = userProgress?.map((p: any) => p.topicId) ?? [];
    return Array.from(new Set([...backend, ...localCompleted]));
  };
  const isCompleted = (id: string) => completedIds().includes(id);
  const markDone    = (id: string) => markCompleteMutation.mutate({ topicId: id, studyTimeMinutes: 30 });

  const handleFileUpload = async (file: File, uploadResult?: any) => {
    setUploading(true);
    setUploadProgress(0);
    track(EVENTS.UPLOAD_START);

    if (uploadResult) {
      setReportId(uploadResult.reportId);
      localStorage.setItem("lastReportId", uploadResult.reportId);
      setStep("plan");
      track(EVENTS.UPLOAD_COMPLETE);
      successFeedback.showUploadSuccess(uploadResult.topicsFound);
      setTimeout(() => successFeedback.showStudyPlanGenerated(uploadResult.topicsFound), 1500);
      setUploading(false);
      return;
    }

    const interval = setInterval(() => setUploadProgress(p => Math.min(p + 5, 80)), 800);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers: Record<string, string> = {};
      if (isAuthenticated && token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/assessment-reports", { method: "POST", body: formData, headers });
      clearInterval(interval);
      setUploadProgress(90);
      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json();
      setUploadProgress(100);
      setReportId(data.reportId);
      localStorage.setItem("lastReportId", data.reportId);
      setStep("plan");
      track(EVENTS.UPLOAD_COMPLETE);
      successFeedback.showUploadSuccess(data.topicsFound);
      setTimeout(() => successFeedback.showStudyPlanGenerated(data.topicsFound), 1500);
    } catch {
      toast({ title: "Upload Failed", description: "Please try again with a valid assessment PDF", variant: "destructive" });
    } finally {
      clearInterval(interval);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => { if (files.length > 0) handleFileUpload(files[0]); },
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  // ── UPLOAD STEP ────────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="min-h-screen bg-white mobile-p-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Personalized Study Plan"
            description="Upload your assessment to see your specific topics to review"
            showHomeButton={true}
            showEducatorLogin={true}
            showBranding={true}
            variant="centered"
          />
          <div className="flex justify-center px-4 md:px-0">
            <div className="max-w-md w-full">
              <Card>
                <CardContent className="p-6">
                  {uploading ? (
                    <AnalyzingLoader progress={uploadProgress} />
                  ) : (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium mb-2">Drop your assessment PDF here</p>
                      <p className="text-sm text-gray-600">or click to browse</p>
                    </div>
                  )}
                  <p className="mt-4 text-sm text-muted-foreground text-center">
                    Upload your nursing assessment PDF — we'll identify your top study priorities
                  </p>
                </CardContent>
              </Card>
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Looking for reading materials?{" "}
                <Link href="/references" className="underline hover:text-foreground transition-colors">
                  View Open RN textbook references
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAN STEP ──────────────────────────────────────────────────────────────
  const reports   = studyPlan?.reports ?? [];
  const activeRpt = reports[activeReport] ?? null;

  const activeClusters = activeRpt?.clusters ?? [];

  const totalStudyMins = activeClusters.reduce((sum, cl) =>
    sum + cl.cjmGroups.reduce((s, g) =>
      s + g.topics.reduce((ts, t) =>
        ts + (t.groupScore != null ? Math.ceil((100 - t.groupScore) * 2) : 50), 0), 0), 0);

  const remainingStudyMins = activeClusters.reduce((sum, cl, ci) =>
    sum + cl.cjmGroups.reduce((s, g, pi) =>
      s + g.topics.reduce((ts, t, ti) => {
        const topicKey = `r${activeReport}-cl${ci}-ph${pi}-t${ti}`;
        if (isCompleted(topicKey)) return ts;
        return ts + (t.groupScore != null ? Math.ceil((100 - t.groupScore) * 2) : 50);
      }, 0), 0), 0);
  const allTopicsDone = totalStudyMins > 0 && remainingStudyMins === 0;

  return (
    <div className="min-h-screen bg-white mobile-p-4">
      <div className="max-w-2xl mx-auto">

        {/* Branded top bar */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <BrandLogo />
          <Link href="/admin/login">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Educator Login
            </span>
          </Link>
        </div>

        {/* Nav + download bar */}
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              localStorage.removeItem("lastReportId");
              localStorage.removeItem("lastReportTime");
              setReportId(null);
              setStep("upload");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Analyze New Report
          </Button>
          {reportId && (
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setEmailModalOpen(true)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Study Guide
              </Button>
              <Button
                variant="default" size="sm"
                onClick={() => window.open(`/api/assessment-reports/${reportId}/pdf`, "_blank")}
              >
                <FileText className="h-4 w-4 mr-2" />
                Download Study Guide (PDF)
              </Button>
            </div>
          )}
        </div>

        {/* Score bar */}
        {assessmentReport && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-5">
            <div>
              <p className="text-sm font-medium text-primary">
                {sanitizeAssessmentName(assessmentReport.assessmentName)}
              </p>
              {assessmentReport.testDate && (
                <p className="text-xs text-muted-foreground mt-0.5">{assessmentReport.testDate}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{assessmentReport.overallScore || "0"}%</div>
              <p className="text-xs text-muted-foreground">Overall Score</p>
            </div>
          </div>
        )}

        {/* Loading / error */}
        {isLoadingPlan ? (
          <TopicListSkeleton count={3} />
        ) : planError ? (
          <NoTopicsFound onRetry={() => refetchPlan()} />
        ) : reports.length === 0 ? (
          <NoTopicsFound onRetry={() => refetchPlan()} />
        ) : (
          <div className="space-y-4">

            {/* ── Report selector ─────────────────────────────────────── */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center justify-between w-full border border-gray-200 rounded-lg px-4 py-3 bg-white shadow-sm hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("text-white text-xs font-bold px-2 py-0.5 rounded", subjectColorClass(activeRpt?.subject ?? ""))}>
                    Report {(activeRpt?.reportNumber ?? 1)}
                  </span>
                  <span className="font-semibold text-sm">{activeRpt?.displaySubject ?? activeRpt?.subject ?? ""}</span>
                  <span className={cn("text-xs font-bold", scoreTextColor(100 - (activeRpt?.avgGap ?? 0)))}>
                    {100 - (activeRpt?.avgGap ?? 0)}% avg score
                  </span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", dropdownOpen && "rotate-180")} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {reports.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveReport(i); setDropdownOpen(false); }}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0",
                        i === activeReport && "bg-primary/5"
                      )}
                    >
                      <span className={cn("text-white text-xs font-bold px-2 py-0.5 rounded shrink-0", subjectColorClass(r.subject))}>
                        Report {r.reportNumber}
                      </span>
                      <span className="font-medium text-sm flex-1">{r.displaySubject ?? r.subject}</span>
                      <span className={cn("text-xs font-bold", scoreTextColor(100 - r.avgGap))}>{100 - r.avgGap}% avg score</span>
                      <span className="text-xs text-muted-foreground">{r.topicCount} topics</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Subject headline ─────────────────────────────────────── */}
            {activeRpt && (
              <div className={cn("text-white rounded-lg px-4 py-4", subjectColorClass(activeRpt.subject))}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-0.5">
                  Report {activeRpt.reportNumber} — Highest Priority Study Area
                </p>
                <h2 className="text-xl font-bold">{activeRpt.displaySubject ?? activeRpt.subject}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm opacity-90">
                  <span className="font-semibold">{100 - activeRpt.avgGap}% avg score</span>
                  <span>·</span>
                  <span>{activeRpt.topicCount} topics to review</span>
                  {totalStudyMins > 0 && (
                    <>
                      <span>·</span>
                      {allTopicsDone ? (
                        <span className="flex items-center gap-1 font-semibold">
                          🎉 All topics complete!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTotalTime(remainingStudyMins)} remaining
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Topic list — Body System → Disorder → CJM phase → topics ── */}
            {/* Fallback: if server returned no clusters but topics exist, show flat allTopics */}
            {activeRpt && activeClusters.length === 0 && activeRpt.allTopics.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                {activeRpt.allTopics.map((topic, ti) => {
                  const topicKey = `r${activeReport}-ft${ti}`;
                  const done  = isCompleted(topicKey);
                  const score = topic.groupScore != null ? Math.round(topic.groupScore) : null;
                  const gap   = topic.groupScore != null ? Math.round(100 - topic.groupScore) : null;
                  return (
                    <div key={ti} className={cn("flex items-start justify-between px-4 py-3 border-b last:border-b-0 gap-3", done && "opacity-55 bg-gray-50")}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{topic.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={cn("text-xs font-bold px-2 py-0.5 rounded border", score != null ? scoreBadgeBg(score) : "bg-gray-50 border-gray-200 text-gray-500")}>
                          {score != null ? `${score}% score` : '–'}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {gap != null ? studyTimeLabel(gap) : '–'}
                        </div>
                        <Button size="sm" variant={done ? "outline" : "ghost"} onClick={() => { if (!done) markDone(topicKey); }} disabled={done} className="text-xs h-6 px-2 mt-0.5">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {done ? "Done" : "Mark Done"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {activeRpt && activeClusters.length > 0 ? (() => {
              // Collect body-system groups in first-appearance order (clusters already sorted by priority)
              const bodySystems: string[] = [];
              const bsSeen = new Set<string>();
              for (const cl of activeClusters) {
                const bs = cl.bodySystem ?? 'Other';
                if (!bsSeen.has(bs)) { bodySystems.push(bs); bsSeen.add(bs); }
              }
              // Always move "Other" to the end
              if (bsSeen.has('Other') && bodySystems[bodySystems.length - 1] !== 'Other') {
                bodySystems.splice(bodySystems.indexOf('Other'), 1);
                bodySystems.push('Other');
              }

              return (
                <div className="space-y-4">
                  {bodySystems.map(bs => (
                    <div key={bs} className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      {/* Body-system header */}
                      <div className="px-4 py-2.5 bg-primary text-white flex items-center justify-between">
                        <p className="text-sm font-bold uppercase tracking-wide">{bs}</p>
                      </div>

                      {/* Disorder clusters within this body system */}
                      {activeClusters.map((cluster, ci) => {
                        if ((cluster.bodySystem ?? 'Other') !== bs) return null;
                        return (
                          <div key={ci} className="border-t border-gray-200">
                            {/* Disorder sub-header */}
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{cluster.name}</p>
                            </div>

                            {/* CJM phase groups */}
                            {cluster.cjmGroups.map((group, pi) => {
                              const meta = CJM_META[group.phase] ?? { color: "#64748b", npLabel: group.phase };
                              return (
                                <div key={pi}>
                                  {/* Phase banner */}
                                  <div
                                    className="px-4 py-1.5 border-b border-gray-100 flex items-center gap-2"
                                    style={{ backgroundColor: meta.color + '14' }}
                                  >
                                    <span className="text-[11px] font-bold" style={{ color: meta.color }}>
                                      {meta.npLabel}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">— {group.phase}</span>
                                  </div>

                                  {/* Topics */}
                                  {group.topics.map((topic, ti) => {
                                    const topicKey = `r${activeReport}-cl${ci}-ph${pi}-t${ti}`;
                                    const done  = isCompleted(topicKey);
                                    const score = topic.groupScore != null ? Math.round(topic.groupScore) : null;
                                    const gap   = topic.groupScore != null ? Math.round(100 - topic.groupScore) : null;
                                    const chapterRefs = topicChapters?.refsByTopicName?.[topic.name]?.slice(0, 2) ?? [];
                                    return (
                                      <div
                                        key={ti}
                                        className={cn(
                                          "flex items-start justify-between px-4 py-3 border-b last:border-b-0 gap-3",
                                          done && "opacity-55 bg-gray-50",
                                        )}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium leading-snug">{topic.name}</p>
                                          {chapterRefs.length > 0 && (
                                            <div className="mt-1 space-y-0.5">
                                              {chapterRefs.map((ref, ri) => {
                                                const label = [
                                                  ref.textbookTitle,
                                                  ref.chapterNumber ? `Ch. ${ref.chapterNumber}` : null,
                                                  ref.chapterTitle,
                                                ].filter(Boolean).join(" — ");
                                                return (
                                                  <div key={ri} className="flex items-start gap-1">
                                                    <span className="text-[11px] text-muted-foreground mt-px shrink-0">Read:</span>
                                                    {ref.chapterId ? (
                                                      <Link href={`/curriculum/chapter/${ref.chapterId}`} className="flex-1 text-[11px] text-blue-700 underline-offset-2 hover:underline leading-tight">
                                                        {label}
                                                      </Link>
                                                    ) : (
                                                      <span className="flex-1 text-[11px] text-muted-foreground leading-tight">{label}</span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                          <div className={cn("text-xs font-bold px-2 py-0.5 rounded border", score != null ? scoreBadgeBg(score) : "bg-gray-50 border-gray-200 text-gray-500")}>
                                            {score != null ? `${score}% score` : '–'}
                                          </div>
                                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {gap != null ? studyTimeLabel(gap) : '–'}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant={done ? "outline" : "ghost"}
                                            onClick={() => { if (!done) markDone(topicKey); }}
                                            disabled={done}
                                            className="text-xs h-6 px-2 mt-0.5"
                                          >
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            {done ? "Done" : "Mark Done"}
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })() : activeRpt ? (
              <NoTopicsFound onRetry={() => refetchPlan()} />
            ) : null}

            {/* Textbook coverage notices */}
            {(() => {
              if (!topicChaptersMeta || topicChaptersMeta.totalTopics === 0) return null;
              const { coverageRatio, coveredTopics, totalTopics } = topicChaptersMeta;
              if (coverageRatio === 0) {
                return (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                    <p>
                      <span className="font-semibold">Textbook references not yet configured.</span>{" "}
                      Chapter reading recommendations will appear here once your school's catalog is set up.
                      Check back later or contact your program administrator.
                    </p>
                  </div>
                );
              }
              if (coverageRatio < PARTIAL_COVERAGE_THRESHOLD) {
                return (
                  <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                    <p>
                      <span className="font-semibold">Textbook chapters are available for {coveredTopics} of your {totalTopics} topics.</span>{" "}
                      More coverage coming once your school's catalog is fully configured.
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Nursing process reference */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-gray-700">Study tip: </span>
              Topics are grouped by body system and disorder, then by NGN Clinical Judgment phase — Assessment, Analysis,
              Prioritization, Interventions, or Evaluation. Work through each disorder cluster top-to-bottom for the most efficient review.
            </div>

            {/* Email capture */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <p className="text-sm font-medium">Get your personalized study plan via email</p>
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={emailSent}
                    />
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToSubscribe}
                        onChange={e => setAgreedToSubscribe(e.target.checked)}
                        className="mt-0.5"
                        disabled={emailSent}
                      />
                      <span className="text-xs text-gray-600">
                        I agree to subscribe and receive my personalized study plan and future nursing education tips via email
                      </span>
                    </label>
                  </div>
                  <Button
                    className="w-full"
                    variant={agreedToSubscribe ? "default" : "outline"}
                    onClick={() => {
                      if (!agreedToSubscribe) {
                        toast({ title: "Please agree to subscribe", variant: "destructive" });
                      } else if (email?.includes("@")) {
                        setEmailSent(true);
                        track(EVENTS.EMAIL_COLLECTED, { email, subscribed: true });
                        toast({ title: "Welcome! Study plan sent!", description: "Check your email for your personalized study plan" });
                      } else {
                        toast({ title: "Please enter a valid email", variant: "destructive" });
                      }
                    }}
                    disabled={emailSent || !email}
                  >
                    {emailSent ? "✓ Subscribed & Sent!" : "Subscribe & Get Study Plan"}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground pb-4">
          <Link href="/references" className="underline hover:text-foreground transition-colors">
            View Open RN textbook references
          </Link>
        </p>

      </div>

      {/* Email Study Guide Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Email Study Guide</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              Enter an email address and we'll send a copy of your personalized study guide PDF.
            </p>
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={shareEmail}
              onChange={e => setShareEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail)) {
                  emailPdfMutation.mutate(shareEmail);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => emailPdfMutation.mutate(shareEmail)}
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail) || emailPdfMutation.isPending}
            >
              {emailPdfMutation.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
