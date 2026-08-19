import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardCheck, LockKeyhole, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { GovernanceEvaluation, GovernanceGate, GovernanceRecordV1 } from "@shared/lesson-governance";

type GovernanceResponse = {
  packageId: string;
  governance: GovernanceRecordV1;
  evaluation: GovernanceEvaluation;
};

type SlideOption = { id: string; slideNumber: number; title: string };

const GATES: Array<{ key: GovernanceGate; label: string }> = [
  { key: "taxonomy", label: "Taxonomy" },
  { key: "objectives", label: "Objectives" },
  { key: "outline", label: "Outline" },
  { key: "script", label: "Script" },
  { key: "accessibility", label: "Accessibility" },
];

const ACCESSIBILITY_FIELDS = [
  ["readingOrderChecked", "Reading order"],
  ["contrastChecked", "Color contrast"],
  ["meaningNotColorOnly", "Meaning is not color-only"],
  ["transcriptAvailable", "Transcript available"],
] as const;

function lines(value: string[]) {
  return value.join("\n");
}

function parseLines(value: string) {
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

export function LessonGovernancePanel({ packageId, slides }: { packageId: string; slides: SlideOption[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["/api/admin/lesson-builder/packages", packageId, "governance"];
  const governanceQuery = useQuery<GovernanceResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/admin/lesson-builder/packages/${packageId}/governance`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not load governance status.");
      return response.json();
    },
    enabled: Boolean(packageId),
  });
  const [draft, setDraft] = useState<GovernanceRecordV1 | null>(null);
  const [approvalNote, setApprovalNote] = useState("Reviewed against the current lesson package.");

  useEffect(() => {
    if (governanceQuery.data?.governance) setDraft(governanceQuery.data.governance);
  }, [governanceQuery.data?.governance]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/packages", packageId] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder/release-readiness"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Governance record is not loaded.");
      const response = await apiRequest("PUT", `/api/admin/lesson-builder/packages/${packageId}/governance`, {
        expectedRevision: draft.revision,
        lessonId: draft.lessonId,
        administrative: draft.administrative,
        sourceGovernance: draft.sourceGovernance,
        taxonomy: draft.taxonomy,
        learningOutcomes: draft.learningOutcomes,
        slideTraceability: draft.slideTraceability,
      });
      return response.json();
    },
    onSuccess: async (data: GovernanceResponse) => {
      setDraft(data.governance);
      await refresh();
      toast({ title: "Governance saved", description: `Revision ${data.governance.revision} is now current.` });
    },
    onError: (error: any) => toast({ title: "Governance save failed", description: error?.message || "Review the governance fields and try again.", variant: "destructive" }),
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ gate, decision }: { gate: GovernanceGate; decision: "approved" | "revoked" }) => {
      if (!draft) throw new Error("Governance record is not loaded.");
      const response = await apiRequest("POST", `/api/admin/lesson-builder/packages/${packageId}/governance/approvals`, {
        expectedRevision: draft.revision,
        gate,
        decision,
        note: approvalNote,
      });
      return response.json();
    },
    onSuccess: async (data: GovernanceResponse) => {
      setDraft(data.governance);
      await refresh();
      toast({ title: "Governance decision recorded", description: "The stage ladder has been recalculated." });
    },
    onError: (error: any) => toast({ title: "Decision not recorded", description: error?.message || "Resolve the prior gate blockers first.", variant: "destructive" }),
  });

  if (governanceQuery.isLoading || !draft) {
    return <Card><CardContent className="py-8 text-sm text-slate-500">Loading governance workflow…</CardContent></Card>;
  }
  if (governanceQuery.isError || !governanceQuery.data) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Governance unavailable</AlertTitle><AlertDescription>Repair the package detail or retry the request.</AlertDescription></Alert>;
  }

  const updateAdmin = (field: keyof GovernanceRecordV1["administrative"], value: string) => {
    setDraft((current) => current ? { ...current, administrative: { ...current.administrative, [field]: value } } : current);
  };
  const updateTaxonomy = (field: keyof GovernanceRecordV1["taxonomy"], value: string | string[]) => {
    setDraft((current) => current ? { ...current, taxonomy: { ...current.taxonomy, [field]: value } } : current);
  };
  const staleGates = GATES.filter(({ key }) => {
    const latest = draft.approvals.find((approval) => approval.gate === key);
    return latest?.decision === "approved" && governanceQuery.data.evaluation.currentApprovals[key] !== true;
  });

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />Governance &amp; Release Gate</CardTitle>
            <CardDescription>Revision {draft.revision}. Content changes automatically stale the affected approval and every downstream gate.</CardDescription>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save governance"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          {governanceQuery.data.evaluation.stages.map((stage) => (
            <div key={stage.key} className={`rounded-md border p-3 ${stage.status === "pass" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {stage.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
                {stage.key.replace(/_/g, " ")}
              </div>
              <div className="mt-1 text-xs text-slate-600">{stage.blockerCount} blocker{stage.blockerCount === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>

        {staleGates.length > 0 ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Stale approvals</AlertTitle><AlertDescription>{staleGates.map((gate) => gate.label).join(", ")} changed after approval and must be reviewed again.</AlertDescription></Alert> : null}

        <section className="space-y-3">
          <h3 className="font-semibold">Lesson identity</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1"><Label>Lesson ID</Label><Input value={draft.lessonId} onChange={(event) => setDraft({ ...draft, lessonId: event.target.value })} /></div>
            {([
              ["courseId", "Course ID"], ["courseName", "Course name"], ["programLevel", "Program level"],
              ["contentOwner", "Content owner"], ["facultyReviewer", "Faculty reviewer"],
            ] as const).map(([field, label]) => <div key={field} className="space-y-1"><Label>{label}</Label><Input value={draft.administrative[field]} onChange={(event) => updateAdmin(field, event.target.value)} /></div>)}
          </div>
          <div className="space-y-1"><Label>Organizing clinical question</Label><Textarea value={draft.sourceGovernance.organizingClinicalQuestion} onChange={(event) => setDraft({ ...draft, sourceGovernance: { ...draft.sourceGovernance, organizingClinicalQuestion: event.target.value } })} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.sourceGovernance.coverageComplete} onCheckedChange={(checked) => setDraft({ ...draft, sourceGovernance: { ...draft.sourceGovernance, coverageComplete: checked === true } })} />Source coverage reviewed and complete</label>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Taxonomy</h3><Badge variant={draft.taxonomyStatus === "locked" ? "default" : "outline"}>{draft.taxonomyStatus}</Badge></div>
          <div className="grid gap-3 md:grid-cols-2">
            {([[
              "concept", "Concept"], ["nclexClientNeed", "NCLEX Client Need"], ["bodySystem", "Body system"], ["priorityFramework", "Priority framework"],
            ] as const).map(([field, label]) => <div key={field} className="space-y-1"><Label>{label}</Label><Input value={draft.taxonomy[field]} onChange={(event) => updateTaxonomy(field, event.target.value)} /></div>)}
            {([[
              "bloomLevels", "Bloom levels"], ["qsenDomains", "QSEN domains"], ["aacnCompetencies", "AACN competencies"], ["ncjmmFunctions", "NCJMM functions"],
            ] as const).map(([field, label]) => <div key={field} className="space-y-1"><Label>{label} (one per line)</Label><Textarea rows={4} value={lines(draft.taxonomy[field])} onChange={(event) => updateTaxonomy(field, parseLines(event.target.value))} /></div>)}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Learning outcomes</h3><Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, learningOutcomes: [...draft.learningOutcomes, { objectiveId: `LO-${String(draft.learningOutcomes.length + 1).padStart(2, "0")}`, statement: "", bloomLevel: "Apply", assessmentMethod: "" }] })}><Plus className="mr-2 h-4 w-4" />Add outcome</Button></div>
          {draft.learningOutcomes.map((outcome, index) => (
            <div key={`${outcome.objectiveId}-${index}`} className="grid gap-2 rounded-md border p-3 md:grid-cols-[110px_1fr_160px_1fr_auto]">
              {(["objectiveId", "statement", "bloomLevel", "assessmentMethod"] as const).map((field) => <Input key={field} value={outcome[field]} placeholder={field.replace(/([A-Z])/g, " $1")} onChange={(event) => setDraft({ ...draft, learningOutcomes: draft.learningOutcomes.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: event.target.value } : entry) })} />)}
              <Button variant="ghost" size="icon" aria-label="Remove learning outcome" onClick={() => setDraft({ ...draft, learningOutcomes: draft.learningOutcomes.filter((_, entryIndex) => entryIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Slide traceability and accessibility</h3>
          {slides.map((slide) => {
            const trace = draft.slideTraceability.find((entry) => entry.slideId === slide.id) || { slideId: slide.id, objectiveIds: [], accessibility: { readingOrderChecked: false, contrastChecked: false, meaningNotColorOnly: false, transcriptAvailable: false } };
            const replaceTrace = (next: typeof trace) => setDraft({ ...draft, slideTraceability: [...draft.slideTraceability.filter((entry) => entry.slideId !== slide.id), next] });
            return <div key={slide.id} className="rounded-md border p-3">
              <div className="font-medium">{slide.slideNumber}. {slide.title}</div>
              <div className="mt-2 space-y-1"><Label>Objective IDs (comma separated)</Label><Input value={trace.objectiveIds.join(", ")} onChange={(event) => replaceTrace({ ...trace, objectiveIds: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) })} /></div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {ACCESSIBILITY_FIELDS.map(([field, label]) => <label key={field} className="flex items-center gap-2 text-sm"><Checkbox checked={trace.accessibility[field]} onCheckedChange={(checked) => replaceTrace({ ...trace, accessibility: { ...trace.accessibility, [field]: checked === true } })} />{label}</label>)}
              </div>
            </div>;
          })}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Intermediate approvals</h3>
          <div className="space-y-1"><Label>Decision note</Label><Input value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} /></div>
          <div className="grid gap-2 md:grid-cols-5">
            {GATES.map((gate) => {
              const approved = governanceQuery.data.evaluation.currentApprovals[gate.key] === true;
              const latest = draft.approvals.find((approval) => approval.gate === gate.key);
              const state = approved ? "current" : latest?.decision === "approved" ? "stale" : latest?.decision === "revoked" ? "revoked" : "not approved";
              return <div key={gate.key} className="rounded-md border p-3 text-center">
                <div className="text-sm font-semibold">{gate.label}</div>
                <Badge className="my-2" variant={approved ? "default" : state === "stale" ? "destructive" : "outline"}>{state}</Badge>
                <Button className="w-full" size="sm" variant={approved ? "outline" : "default"} disabled={approvalMutation.isPending || approvalNote.trim().length < 3} onClick={() => approvalMutation.mutate({ gate: gate.key, decision: approved ? "revoked" : "approved" })}>
                  <ClipboardCheck className="mr-2 h-3.5 w-3.5" />{approved ? "Revoke" : "Approve"}
                </Button>
              </div>;
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href="#faculty-review-workflow">Open faculty rubric</a></Button>
            <Button asChild variant="outline" size="sm"><a href={`/api/admin/lesson-builder/packages/${packageId}/faculty-review/certificate`} target="_blank" rel="noreferrer">Open review certificate</a></Button>
          </div>
        </section>

        {governanceQuery.data.evaluation.blockers.length > 0 ? <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Current blockers</AlertTitle><AlertDescription><ul className="mt-2 list-disc space-y-1 pl-5">{governanceQuery.data.evaluation.blockers.slice(0, 20).map((blocker) => <li key={`${blocker.stage}-${blocker.location}-${blocker.code}`}>{blocker.message} <span className="text-slate-500">({blocker.location})</span></li>)}</ul></AlertDescription></Alert> : null}
      </CardContent>
    </Card>
  );
}
