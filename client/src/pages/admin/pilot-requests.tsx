import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, ExternalLink, RefreshCw, Rocket, Save, Users } from "lucide-react";

type PilotRequest = {
  id: string;
  status: string;
  score: number;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  companyName?: string;
  jobTitle?: string;
  industry?: string;
  interestedTopics: string[];
  tags: string[];
  pilotGoal?: string;
  adminNotes?: string;
  followUpDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PilotRequestsResponse = {
  requests: PilotRequest[];
  statuses: string[];
  summary: {
    total: number;
    open: number;
    qualified: number;
    followUp: number;
    demoReady: number;
    closed: number;
    newestRequest?: PilotRequest | null;
    statusCounts: Record<string, number>;
  };
};

const statusLabels: Record<string, string> = {
  new: "New",
  qualified: "Qualified",
  follow_up: "Follow Up",
  demo_ready: "Demo Ready",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function requestBadge(status: string) {
  if (status === "closed_won") return "default";
  if (status === "closed_lost") return "destructive";
  if (status === "demo_ready" || status === "qualified") return "secondary";
  return "outline";
}

function topicsText(request?: PilotRequest | null) {
  return request?.interestedTopics?.length ? request.interestedTopics.join("\n") : "";
}

export default function PilotRequestsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState("qualified");
  const [reviewScore, setReviewScore] = useState(60);
  const [reviewFollowUpDate, setReviewFollowUpDate] = useState("");
  const [reviewTopics, setReviewTopics] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const requestsQuery = useQuery<PilotRequestsResponse>({
    queryKey: ["/api/admin/pilot-requests", statusFilter],
    queryFn: async () => {
      const statusParam = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/admin/pilot-requests${statusParam}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load pilot requests");
      return response.json();
    },
  });

  const requests = requestsQuery.data?.requests || [];
  const summary = requestsQuery.data?.summary;
  const statuses = requestsQuery.data?.statuses || Object.keys(statusLabels);
  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  function loadRequestForReview(request: PilotRequest) {
    setSelectedRequestId(request.id);
    setReviewStatus(request.status || "qualified");
    setReviewScore(request.score || 60);
    setReviewFollowUpDate(request.followUpDate ? request.followUpDate.slice(0, 10) : "");
    setReviewTopics(topicsText(request));
    setReviewNotes(request.adminNotes || "");
  }

  const updateRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) throw new Error("Select a request first");
      const response = await apiRequest("PATCH", `/api/admin/pilot-requests/${selectedRequest.id}`, {
        status: reviewStatus,
        score: reviewScore,
        followUpDate: reviewFollowUpDate || null,
        interestedTopics: reviewTopics
          .split(/\r?\n|,/)
          .map((topic) => topic.trim())
          .filter(Boolean),
        adminNotes: reviewNotes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pilot-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lesson-builder"] });
      toast({
        title: "Pilot request updated",
        description: "The public launch request review state has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const newest = summary?.newestRequest;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-teal-700" />
              <h1 className="text-2xl font-semibold text-slate-950">Pilot Requests</h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Review controlled public launch requests without turning NurseStudy into a broad CRM. The student product remains the lesson, guide, quiz, and resource experience.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => requestsQuery.refetch()} disabled={requestsQuery.isFetching}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = "/api/admin/pilot-requests/export?format=csv"; }}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = "/api/admin/pilot-requests/export?format=json"; }}>
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["Total", summary?.total || 0],
            ["Open", summary?.open || 0],
            ["Qualified", summary?.qualified || 0],
            ["Follow Up", summary?.followUp || 0],
            ["Demo Ready", summary?.demoReady || 0],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="px-4 py-3">
                <div className="text-2xl font-semibold text-slate-950">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {newest ? (
          <Card className="border-teal-200 bg-teal-50/60">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-teal-950">Newest request: {newest.contactName || newest.contactEmail}</div>
                <div className="text-sm text-teal-800">{newest.companyName || newest.industry || "Nursing education"} · {formatDate(newest.createdAt)}</div>
              </div>
              <Button variant="outline" onClick={() => loadRequestForReview(newest)}>
                Review Request
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Request Queue</CardTitle>
                <CardDescription>Filtered to public launch interest records only.</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>{statusLabels[status] || status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {requestsQuery.isLoading ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">Loading pilot requests...</div>
              ) : requests.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">No public pilot requests match this filter.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Topics</TableHead>
                      <TableHead>Follow Up</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="font-medium text-slate-950">{request.contactName || "Unnamed contact"}</div>
                          <div className="text-xs text-slate-500">{request.contactEmail}</div>
                        </TableCell>
                        <TableCell>
                          <div>{request.companyName || "-"}</div>
                          <div className="text-xs text-slate-500">{request.jobTitle || request.industry || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={requestBadge(request.status) as any}>{statusLabels[request.status] || request.status}</Badge>
                          <div className="mt-1 text-xs text-slate-500">Score {request.score || 0}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[220px] truncate text-sm">{request.interestedTopics?.join(", ") || "-"}</div>
                        </TableCell>
                        <TableCell>{formatDate(request.followUpDate)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => loadRequestForReview(request)}>
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Review State
              </CardTitle>
              <CardDescription>Qualify the request and capture the next action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRequest ? (
                <>
                  <div className="rounded-md border bg-slate-50 p-3 text-sm">
                    <div className="font-medium text-slate-950">{selectedRequest.contactName || selectedRequest.contactEmail}</div>
                    <div className="text-slate-600">{selectedRequest.companyName || selectedRequest.industry || "Nursing education"}</div>
                    {selectedRequest.pilotGoal ? (
                      <div className="mt-2 text-slate-700">{selectedRequest.pilotGoal}</div>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={reviewStatus} onValueChange={setReviewStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>{statusLabels[status] || status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Score</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={reviewScore}
                          onChange={(event) => setReviewScore(Number(event.target.value))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Follow-up</Label>
                        <Input
                          type="date"
                          value={reviewFollowUpDate}
                          onChange={(event) => setReviewFollowUpDate(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Interested topics</Label>
                      <Textarea value={reviewTopics} onChange={(event) => setReviewTopics(event.target.value)} rows={4} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Internal notes</Label>
                      <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={5} />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-2">
                    <Button onClick={() => updateRequestMutation.mutate()} disabled={updateRequestMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {updateRequestMutation.isPending ? "Saving..." : "Save Review"}
                    </Button>
                    <Button variant="outline" onClick={() => window.open("/admin/lesson-builder", "_blank")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Launch Console
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                  Select a public launch request to review.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
