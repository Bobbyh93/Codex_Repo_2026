import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, CheckCircle2, ClipboardCheck, FileStack, GraduationCap, Loader2, ShieldCheck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type DeployProof = {
  commit: string;
  branch: string;
  environment: string;
  serviceName: string;
  startedAt: string;
  internalPilotAccepted: boolean;
  internalPilotPackageId: string;
};

const launchTopics = [
  "Generate cited nursing lessons",
  "Map course sources",
  "Pilot a cohort",
  "Review learner outcomes",
  "Export evidence reports",
];

const readinessSteps = [
  { label: "Approved source intake", icon: FileStack },
  { label: "Content mapping review", icon: ClipboardCheck },
  { label: "AI-reviewed lesson package", icon: BookOpenCheck },
  { label: "Learner assignment loop", icon: UsersRound },
  { label: "Pilot evidence export", icon: ShieldCheck },
];

export default function PublicLaunch() {
  const { toast } = useToast();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    "Generate cited nursing lessons",
    "Pilot a cohort",
  ]);
  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    companyName: "",
    jobTitle: "",
    organizationType: "",
    pilotGoal: "",
  });

  const proofQuery = useQuery<DeployProof>({
    queryKey: ["/api/public/deploy-proof"],
    queryFn: async () => {
      const response = await fetch("/api/public/deploy-proof");
      if (!response.ok) throw new Error("Failed to load launch proof");
      return response.json();
    },
    retry: false,
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/public/launch-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          interestedTopics: selectedTopics,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Request failed");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Pilot request captured",
        description: "Your program is in the launch review queue.",
      });
      setForm({
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        companyName: "",
        jobTitle: "",
        organizationType: "",
        pilotGoal: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request not saved",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const shortCommit = useMemo(() => {
    const commit = proofQuery.data?.commit || "";
    return commit.length > 10 ? commit.slice(0, 7) : commit || "live";
  }, [proofQuery.data?.commit]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    launchMutation.mutate();
  };

  return (
    <main className="min-h-screen bg-[#f7faf8] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#123c42] text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-semibold">NurseStudy</span>
              <span className="block text-xs text-slate-600">Harrity Lesson Builder</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/lessons/bf472933-fdb6-4e67-b893-491c00c7bcd4">
              <Button variant="ghost" size="sm">Pilot Lesson</Button>
            </Link>
            <Link href="/admin/login">
              <Button size="sm" className="bg-[#123c42] hover:bg-[#0d2f34]">
                Admin Login
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-14">
        <div className="flex flex-col justify-center">
          <Badge className="mb-5 w-fit border-[#b58b00] bg-[#fff6d8] text-[#6f5200] hover:bg-[#fff6d8]">
            Internal pilot accepted
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
            Launch a source-traceable nursing lesson pilot from approved course materials.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            NurseStudy turns nursing source packs into learner-facing web lessons with citations,
            clinical judgment alignment, guided notes, practice, completion tracking, and pilot evidence export.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {readinessSteps.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e1f0ec] text-[#0f6b5b]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-slate-800">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pilot-request">
              <Button className="bg-[#123c42] hover:bg-[#0d2f34]">
                Request controlled pilot <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <Link href="/lessons/bf472933-fdb6-4e67-b893-491c00c7bcd4">
              <Button variant="outline">Open pilot lesson</Button>
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-md bg-[#123c42] p-4 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[#b9ddd5]">Pilot Launch Console</p>
                <h2 className="mt-1 text-xl font-semibold">Therapeutic Communication Live AI MVP</h2>
              </div>
              <Badge className="bg-[#d8f2e6] text-[#18523d] hover:bg-[#d8f2e6]">Ready</Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ["Source registry", "Approved and chunked"],
              ["AI review", "Approved for pilot"],
              ["Assignment", "Active cohort link"],
              ["Learner outcome", "Completion and feedback captured"],
              ["Evidence", "Harrity bundle plus pilot report"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-600">{value}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-[#0f6b5b]" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            Live proof: {proofQuery.data?.environment || "production"} · {proofQuery.data?.serviceName || "Render"} · {shortCommit}
          </div>
        </div>
      </section>

      <section id="pilot-request" className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold">Controlled public launch path</h2>
            <p className="mt-3 text-slate-700">
              This request creates a pilot lead for program review. It does not create student accounts,
              publish source content, or bypass faculty review.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-700">
              <p>Included: source intake, lesson generation, assignment, outcomes, and evidence export.</p>
              <p>Later: ATI automation, LMS/email invites, marketplace workflows, and full student dashboards.</p>
            </div>
          </div>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>Request pilot access</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Name</Label>
                    <Input
                      id="contactName"
                      required
                      value={form.contactName}
                      onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      required
                      value={form.contactEmail}
                      onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Program or organization</Label>
                    <Input
                      id="companyName"
                      value={form.companyName}
                      onChange={(event) => setForm({ ...form, companyName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Role</Label>
                    <Input
                      id="jobTitle"
                      value={form.jobTitle}
                      onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizationType">Organization type</Label>
                    <Input
                      id="organizationType"
                      placeholder="ADN, BSN, review, faculty team"
                      value={form.organizationType}
                      onChange={(event) => setForm({ ...form, organizationType: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone optional</Label>
                    <Input
                      id="contactPhone"
                      value={form.contactPhone}
                      onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Launch priorities</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {launchTopics.map((topic) => (
                      <label key={topic} className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-sm">
                        <Checkbox
                          checked={selectedTopics.includes(topic)}
                          onCheckedChange={() => toggleTopic(topic)}
                        />
                        {topic}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pilotGoal">Pilot goal</Label>
                  <Textarea
                    id="pilotGoal"
                    rows={4}
                    placeholder="Example: validate one source-traceable lesson with 10 faculty reviewers before fall term."
                    value={form.pilotGoal}
                    onChange={(event) => setForm({ ...form, pilotGoal: event.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full bg-[#123c42] hover:bg-[#0d2f34]" disabled={launchMutation.isPending}>
                  {launchMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving request
                    </>
                  ) : (
                    <>
                      Submit pilot request <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
