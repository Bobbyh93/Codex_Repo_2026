"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type ReviewStatus =
  | "unreviewed"
  | "in_review"
  | "confirmed"
  | "needs_followup"
  | "gap"
  | "not_applicable";

type Priority = "low" | "medium" | "high";

type ReviewItem = {
  id: string;
  item_type: "concept" | "resource";
  title: string;
  source_status: string;
  status: ReviewStatus;
  assignee: string;
  notes: string;
  priority: Priority;
  updated_by: string | null;
  updated_at: string;
};

type Concept = {
  id: string;
  concept: string;
  sourceStatus: string;
  systems: string | null;
  phases: string | null;
  skills: string | null;
  frameworkRows: number;
  csvRows: number;
  titleFileMatches: number;
  contentMatches: number;
  totalMatches: number;
  bestMatches: string | null;
  priority: Priority;
};

type Resource = {
  id: string;
  path: string;
  title: string;
  extension: string;
  category: string;
  sizeMb: number;
  textChars: number;
  readableTextExtracted: string;
  priority: Priority;
};

type ModuleItem = {
  id: string;
  module: string;
  modulePosition: number;
  itemPosition: number;
  title: string;
  type: string;
  state: string;
  href: string;
  resourceType: string;
};

type MatchDetail = {
  id: string;
  concept: string;
  score: number;
  where: string;
  sourceKind: string;
  sourceTitle: string;
  sourcePath: string;
};

type PackageCompare = {
  id: string;
  source: string;
  path: string;
  sizeBytes: number;
  entryCount: number;
  notes: string;
};

type PackageDiff = {
  id: string;
  entry: string;
  standaloneSize: number;
  standaloneCrc: string;
  copySize: number;
  copyCrc: string;
};

type AuditPayload = {
  generatedAt: string;
  summary: string;
  currentUser: string | null;
  metrics: {
    frameworkRows: number;
    csvRows: number;
    conceptsAudited: number;
    titleFileMatches: number;
    contentOnlyMatches: number;
    noDirectPackageMatch: number;
    modules: number;
    moduleItems: number;
    wikiPages: number;
    webResources: number;
    learningOutcomes: number;
    assignments: number;
    coursePackageEntries: number;
  };
  concepts: Concept[];
  matchDetails: MatchDetail[];
  courseModules: ModuleItem[];
  courseResources: Resource[];
  packageCompare: PackageCompare[];
  packageDiffs: PackageDiff[];
  reviewItems: ReviewItem[];
  reviewCounts: Record<string, number>;
};

type TabId =
  | "overview"
  | "concepts"
  | "structure"
  | "resources"
  | "package"
  | "lessons"
  | "integrations";

type QueueId =
  | "all"
  | "unmatched"
  | "content"
  | "in_review"
  | "needs_followup"
  | "gap"
  | "confirmed";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "concepts", label: "Concepts" },
  { id: "structure", label: "Course Structure" },
  { id: "resources", label: "Resources" },
  { id: "package", label: "Package Compare" },
  { id: "lessons", label: "Lesson Builder" },
  { id: "integrations", label: "Integrations" },
];

const queueLabels: Record<QueueId, string> = {
  all: "All",
  unmatched: "Unmatched",
  content: "Content-only",
  in_review: "In review",
  needs_followup: "Follow-up",
  gap: "Gaps",
  confirmed: "Confirmed",
};

const statusLabels: Record<ReviewStatus, string> = {
  unreviewed: "Unreviewed",
  in_review: "In review",
  confirmed: "Confirmed",
  needs_followup: "Needs follow-up",
  gap: "Gap",
  not_applicable: "Not applicable",
};

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const reviewStatuses = Object.keys(statusLabels) as ReviewStatus[];
const priorities = Object.keys(priorityLabels) as Priority[];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function reviewMap(items: ReviewItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function sourceBadgeClass(sourceStatus: string) {
  if (sourceStatus === "No direct package match") return "badge danger";
  if (sourceStatus === "Content match only") return "badge warning";
  return "badge success";
}

function statusClass(status: ReviewStatus) {
  if (status === "confirmed") return "status confirmed";
  if (status === "gap") return "status gap";
  if (status === "needs_followup") return "status followup";
  if (status === "in_review") return "status active";
  if (status === "not_applicable") return "status muted";
  return "status";
}

function metricCards(data: AuditPayload) {
  return [
    {
      label: "Concepts",
      value: data.metrics.conceptsAudited,
      detail: `${data.metrics.titleFileMatches} direct matches`,
      tone: "blue",
    },
    {
      label: "Review rows",
      value: data.reviewItems.length,
      detail: `${data.reviewCounts.confirmed ?? 0} confirmed`,
      tone: "green",
    },
    {
      label: "Content-only",
      value: data.metrics.contentOnlyMatches,
      detail: "Requires reviewer judgment",
      tone: "amber",
    },
    {
      label: "Unmatched",
      value: data.metrics.noDirectPackageMatch,
      detail: "Coverage gaps to resolve",
      tone: "rose",
    },
    {
      label: "Resources",
      value: data.metrics.webResources,
      detail: `${data.metrics.wikiPages} wiki pages`,
      tone: "gray",
    },
  ];
}

function queueCount(queue: QueueId, data: AuditPayload, reviews: Map<string, ReviewItem>) {
  if (queue === "all") return data.reviewItems.length;
  if (queue === "unmatched") {
    return data.concepts.filter(
      (concept) => concept.sourceStatus === "No direct package match",
    ).length;
  }
  if (queue === "content") {
    return data.concepts.filter(
      (concept) => concept.sourceStatus === "Content match only",
    ).length;
  }

  return [...reviews.values()].filter((item) => item.status === queue).length;
}

function conceptMatchesQueue(
  concept: Concept,
  queue: QueueId,
  review?: ReviewItem,
) {
  if (queue === "all") return true;
  if (queue === "unmatched") return concept.sourceStatus === "No direct package match";
  if (queue === "content") return concept.sourceStatus === "Content match only";
  return review?.status === queue;
}

function resourceMatchesQueue(queue: QueueId, review?: ReviewItem) {
  if (queue === "all") return true;
  if (queue === "unmatched" || queue === "content") return false;
  return review?.status === queue;
}

function splitMatches(bestMatches: string | null) {
  if (!bestMatches) return [];
  return bestMatches.split("; ").slice(0, 4);
}

function AppHeader({ data }: { data: AuditPayload }) {
  return (
    <header className="app-header">
      <div className="brand-row">
        <div className="brand-mark">PA</div>
        <div>
          <p className="product-label">Private course audit</p>
          <h1>Pearson Concept Audit Dashboard</h1>
        </div>
      </div>
      <div className="header-actions">
        <a className="primary-button" href="/downloads/pearson_course_concept_audit.xlsx">
          Download Excel Audit
        </a>
        <a className="ghost-button" href="/api/review-export.csv">
          Export review CSV
        </a>
      </div>
      <p className="summary-copy">{data.summary}</p>
      <div className="identity-line">
        <span>Generated {new Date(data.generatedAt).toLocaleDateString()}</span>
        <span>{data.currentUser ? `Reviewer: ${data.currentUser}` : "Read-only local session"}</span>
      </div>
    </header>
  );
}

function Metrics({ data }: { data: AuditPayload }) {
  return (
    <section className="metrics" aria-label="Audit metrics">
      {metricCards(data).map((metric) => (
        <article className={`metric-card ${metric.tone}`} key={metric.label}>
          <strong>{formatNumber(metric.value)}</strong>
          <span>{metric.label}</span>
          <small>{metric.detail}</small>
        </article>
      ))}
    </section>
  );
}

function TabNav({
  activeTab,
  onChange,
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav className="tab-shell" aria-label="Dashboard sections">
      <div className="tab-row">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "tab active" : "tab"}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <label className="tab-select-label">
        Section
        <select
          value={activeTab}
          onChange={(event) => onChange(event.target.value as TabId)}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}

function QueueBar({
  data,
  reviews,
  activeQueue,
  onChange,
}: {
  data: AuditPayload;
  reviews: Map<string, ReviewItem>;
  activeQueue: QueueId;
  onChange: (queue: QueueId) => void;
}) {
  const queues = Object.keys(queueLabels) as QueueId[];

  return (
    <section className="queue-bar" aria-label="Review queues">
      {queues.map((queue) => (
        <button
          className={activeQueue === queue ? "queue-chip active" : "queue-chip"}
          key={queue}
          onClick={() => onChange(queue)}
          type="button"
        >
          <span>{queueLabels[queue]}</span>
          <strong>{queueCount(queue, data, reviews)}</strong>
        </button>
      ))}
    </section>
  );
}

function Overview({
  data,
  reviews,
  onQueue,
  onTab,
}: {
  data: AuditPayload;
  reviews: Map<string, ReviewItem>;
  onQueue: (queue: QueueId) => void;
  onTab: (tab: TabId) => void;
}) {
  const unmatched = data.concepts.filter(
    (concept) => concept.sourceStatus === "No direct package match",
  );
  const contentOnly = data.concepts.filter(
    (concept) => concept.sourceStatus === "Content match only",
  );
  const activeItems = [...reviews.values()].filter(
    (item) => item.status === "in_review" || item.status === "needs_followup",
  );

  return (
    <div className="overview-grid">
      <section className="panel coverage-panel">
        <div className="panel-heading">
          <div>
            <h2>Audit coverage</h2>
            <p>Framework, package, and Canvas extraction coverage.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              onQueue("unmatched");
              onTab("concepts");
            }}
            type="button"
          >
            View gaps
          </button>
        </div>
        <div className="coverage-grid">
          <span>Framework rows<strong>{data.metrics.frameworkRows}</strong></span>
          <span>CSV rows<strong>{data.metrics.csvRows}</strong></span>
          <span>Module items<strong>{data.metrics.moduleItems}</strong></span>
          <span>Wiki pages<strong>{data.metrics.wikiPages}</strong></span>
          <span>Learning outcomes<strong>{data.metrics.learningOutcomes}</strong></span>
          <span>Assignments<strong>{data.metrics.assignments}</strong></span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Coverage review queue</h2>
            <p>{activeItems.length} items currently active or waiting.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              onQueue("content");
              onTab("concepts");
            }}
            type="button"
          >
            Content-only
          </button>
        </div>
        <div className="priority-list">
          {[...unmatched, ...contentOnly].slice(0, 8).map((concept) => (
            <button
              className="priority-row"
              key={concept.id}
              onClick={() => {
                onQueue(
                  concept.sourceStatus === "No direct package match"
                    ? "unmatched"
                    : "content",
                );
                onTab("concepts");
              }}
              type="button"
            >
              <span className={sourceBadgeClass(concept.sourceStatus)}>
                {concept.sourceStatus}
              </span>
              <strong>{concept.concept}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel preview-panel">
        <div className="panel-heading">
          <div>
            <h2>Workbook previews</h2>
            <p>Rendered summary and concept match sheets.</p>
          </div>
        </div>
        <div className="preview-grid">
          <Image
            alt="Rendered summary sheet preview"
            height={594}
            sizes="(max-width: 860px) 100vw, 36vw"
            src="/previews/Summary.png"
            width={1921}
          />
          <Image
            alt="Rendered concept match sheet preview"
            height={2444}
            sizes="(max-width: 860px) 100vw, 60vw"
            src="/previews/Concept_Match.png"
            width={2421}
          />
        </div>
      </section>
    </div>
  );
}

function ReviewPanel({
  item,
  currentUser,
  onSave,
}: {
  item: ReviewItem;
  currentUser: string | null;
  onSave: (id: string, payload: Partial<ReviewItem>) => Promise<string>;
}) {
  const [status, setStatus] = useState<ReviewStatus>(item.status);
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [assignee, setAssignee] = useState(item.assignee);
  const [notes, setNotes] = useState(item.notes);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const result = await onSave(item.id, { status, priority, assignee, notes });
    setMessage(result);
    setSaving(false);
  }

  return (
    <aside className="review-panel">
      <div className="review-panel-title">
        <span className={statusClass(item.status)}>{statusLabels[item.status]}</span>
        <h3>{item.title}</h3>
        <p>{item.source_status}</p>
      </div>

      <label>
        Review status
        <select
          disabled={!currentUser || saving}
          value={status}
          onChange={(event) => setStatus(event.target.value as ReviewStatus)}
        >
          {reviewStatuses.map((reviewStatus) => (
            <option key={reviewStatus} value={reviewStatus}>
              {statusLabels[reviewStatus]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Priority
        <select
          disabled={!currentUser || saving}
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
        >
          {priorities.map((reviewPriority) => (
            <option key={reviewPriority} value={reviewPriority}>
              {priorityLabels[reviewPriority]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Assignee
        <input
          disabled={!currentUser || saving}
          onChange={(event) => setAssignee(event.target.value)}
          placeholder="Reviewer email or name"
          value={assignee}
        />
      </label>

      <label>
        Reviewer notes
        <textarea
          disabled={!currentUser || saving}
          onChange={(event) => setNotes(event.target.value)}
          rows={6}
          value={notes}
        />
      </label>

      <button
        className="primary-button full"
        disabled={!currentUser || saving}
        onClick={submit}
        type="button"
      >
        {saving ? "Saving" : "Save review"}
      </button>
      <p className="form-note">
        {message ||
          (currentUser
            ? `Last updated ${new Date(item.updated_at).toLocaleString()}`
            : "Workspace sign-in is required to save shared review state.")}
      </p>
    </aside>
  );
}

function ConceptsView({
  data,
  reviews,
  activeQueue,
  selectedId,
  setSelectedId,
  onSave,
}: {
  data: AuditPayload;
  reviews: Map<string, ReviewItem>;
  activeQueue: QueueId;
  selectedId: string;
  setSelectedId: (id: string) => void;
  onSave: (id: string, payload: Partial<ReviewItem>) => Promise<string>;
}) {
  const [search, setSearch] = useState("");
  const [sourceStatus, setSourceStatus] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");

  const rows = data.concepts.filter((concept) => {
    const review = reviews.get(concept.id);
    const haystack = `${concept.concept} ${concept.systems ?? ""} ${concept.skills ?? ""} ${concept.bestMatches ?? ""}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (sourceStatus === "all" || concept.sourceStatus === sourceStatus) &&
      (reviewStatus === "all" || review?.status === reviewStatus) &&
      conceptMatchesQueue(concept, activeQueue, review)
    );
  });

  const selected = rows.find((concept) => concept.id === selectedId) ?? rows[0];
  const selectedReview = selected ? reviews.get(selected.id) : null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId, setSelectedId]);

  return (
    <section className="workspace-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Concept review</h2>
            <p>{rows.length} of {data.concepts.length} concepts shown.</p>
          </div>
        </div>
        <div className="filters">
          <label>
            Search concepts and matches
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Source
            <select
              value={sourceStatus}
              onChange={(event) => setSourceStatus(event.target.value)}
            >
              <option value="all">All source statuses</option>
              <option value="Title/file match">Title/file match</option>
              <option value="Content match only">Content match only</option>
              <option value="No direct package match">No direct package match</option>
            </select>
          </label>
          <label>
            Review
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
            >
              <option value="all">All review statuses</option>
              {reviewStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-list concept-list">
          {rows.map((concept) => {
            const review = reviews.get(concept.id);
            return (
              <button
                className={selected?.id === concept.id ? "data-row active" : "data-row"}
                key={concept.id}
                onClick={() => setSelectedId(concept.id)}
                type="button"
              >
                <span>
                  <strong>{concept.concept}</strong>
                  <small>{concept.systems || "No system listed"} / {concept.phases || "No phase listed"}</small>
                </span>
                <span className={sourceBadgeClass(concept.sourceStatus)}>
                  {concept.sourceStatus}
                </span>
                <span className={statusClass(review?.status ?? "unreviewed")}>
                  {statusLabels[review?.status ?? "unreviewed"]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && selectedReview ? (
        <div className="side-stack">
          <ReviewPanel
            currentUser={data.currentUser}
            item={selectedReview}
            key={selectedReview.id}
            onSave={onSave}
          />
          <section className="panel detail-panel">
            <h3>Best source leads</h3>
            <div className="match-list">
              {splitMatches(selected.bestMatches).map((match) => (
                <p key={match}>{match}</p>
              ))}
              {!selected.bestMatches ? <p>No direct package lead recorded.</p> : null}
            </div>
            <h3>Lesson seed</h3>
            <p>{selected.skills || "No skill listed"}</p>
            <p className="muted">{selected.titleFileMatches} title/file matches, {selected.contentMatches} content matches.</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ResourcesView({
  data,
  reviews,
  activeQueue,
  selectedId,
  setSelectedId,
  onSave,
}: {
  data: AuditPayload;
  reviews: Map<string, ReviewItem>;
  activeQueue: QueueId;
  selectedId: string;
  setSelectedId: (id: string) => void;
  onSave: (id: string, payload: Partial<ReviewItem>) => Promise<string>;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [extension, setExtension] = useState("all");
  const categories = [...new Set(data.courseResources.map((resource) => resource.category))].sort();
  const extensions = [...new Set(data.courseResources.map((resource) => resource.extension))].sort();

  const rows = data.courseResources.filter((resource) => {
    const review = reviews.get(resource.id);
    const haystack = `${resource.title} ${resource.path} ${resource.category}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (category === "all" || resource.category === category) &&
      (extension === "all" || resource.extension === extension) &&
      resourceMatchesQueue(activeQueue, review)
    );
  });

  const selected = rows.find((resource) => resource.id === selectedId) ?? rows[0];
  const selectedReview = selected ? reviews.get(selected.id) : null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId, setSelectedId]);

  return (
    <section className="workspace-grid">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Resource review</h2>
            <p>{rows.length} of {data.courseResources.length} resources shown.</p>
          </div>
        </div>
        <div className="filters">
          <label>
            Search resources
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Extension
            <select value={extension} onChange={(event) => setExtension(event.target.value)}>
              <option value="all">All extensions</option>
              {extensions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-list">
          {rows.map((resource) => {
            const review = reviews.get(resource.id);
            return (
              <button
                className={selected?.id === resource.id ? "data-row active" : "data-row"}
                key={resource.id}
                onClick={() => setSelectedId(resource.id)}
                type="button"
              >
                <span>
                  <strong>{resource.title}</strong>
                  <small>{resource.path}</small>
                </span>
                <span className="badge neutral">{resource.extension}</span>
                <span className={statusClass(review?.status ?? "unreviewed")}>
                  {statusLabels[review?.status ?? "unreviewed"]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && selectedReview ? (
        <div className="side-stack">
          <ReviewPanel
            currentUser={data.currentUser}
            item={selectedReview}
            key={selectedReview.id}
            onSave={onSave}
          />
          <section className="panel detail-panel">
            <h3>Resource detail</h3>
            <dl className="detail-list">
              <div><dt>Category</dt><dd>{selected.category}</dd></div>
              <div><dt>Size</dt><dd>{selected.sizeMb} MB</dd></div>
              <div><dt>Readable text</dt><dd>{selected.readableTextExtracted}</dd></div>
              <div><dt>Text chars</dt><dd>{formatNumber(selected.textChars)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function StructureView({ data }: { data: AuditPayload }) {
  const grouped = data.courseModules.reduce<Record<string, ModuleItem[]>>((acc, item) => {
    acc[item.module] = acc[item.module] ?? [];
    acc[item.module].push(item);
    return acc;
  }, {});

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Course modules</h2>
          <p>{data.metrics.modules} modules with {data.metrics.moduleItems} module items from Canvas metadata.</p>
        </div>
      </div>
      <div className="module-grid">
        {Object.entries(grouped).map(([module, items], index) => (
          <article className="module-block" key={module}>
            <div className="module-title">
              <span>{index + 1}</span>
              <h3>{module}</h3>
              <small>{items.length} items</small>
            </div>
            <ol>
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.type} / {item.state}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function PackageView({ data }: { data: AuditPayload }) {
  return (
    <section className="workspace-grid single-side">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Package comparison</h2>
            <p>Archive-level comparison of the ZIP and IMSCC files.</p>
          </div>
        </div>
        <div className="compare-list">
          {data.packageCompare.map((item) => (
            <article key={item.id}>
              <strong>{item.source}</strong>
              <p>{item.path}</p>
              <span>{formatNumber(item.entryCount)} entries / {formatNumber(item.sizeBytes)} bytes</span>
              <small>{item.notes}</small>
            </article>
          ))}
        </div>
      </div>
      <aside className="panel">
        <h3>IMSCC diffs</h3>
        <div className="diff-list">
          {data.packageDiffs.map((diff) => (
            <article key={diff.id}>
              <strong>{diff.entry}</strong>
              <p>Standalone {diff.standaloneCrc} / copy {diff.copyCrc}</p>
              <small>{formatNumber(diff.standaloneSize)} to {formatNumber(diff.copySize)} bytes</small>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}

function LessonBuilder({ data }: { data: AuditPayload }) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");

  const rows = data.concepts.filter((concept) => {
    const haystack = `${concept.concept} ${concept.skills ?? ""} ${concept.systems ?? ""} ${concept.phases ?? ""}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (priority === "all" || concept.priority === priority)
    );
  });

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Harrity Lesson Builder</h2>
          <p>Static lesson seeds derived from audit concepts, systems, phases, skills, and source leads.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            const lines = rows.map((row) => `${row.concept}: ${row.skills || "No skill listed"}`);
            navigator.clipboard?.writeText(lines.join("\n"));
          }}
          type="button"
        >
          Copy seeds
        </button>
      </div>
      <div className="filters">
        <label>
          Search lesson seeds
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">All priorities</option>
            {priorities.map((item) => (
              <option key={item} value={item}>{priorityLabels[item]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="lesson-grid">
        {rows.map((concept) => (
          <article className="lesson-row" key={concept.id}>
            <div>
              <strong>{concept.concept}</strong>
              <p>{concept.skills || "No skill listed"}</p>
            </div>
            <span className={sourceBadgeClass(concept.sourceStatus)}>
              {concept.sourceStatus}
            </span>
            <small>{concept.systems || "No system"} / {concept.phases || "No phase"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Integrations() {
  const prompts = [
    {
      title: "Continue dashboard implementation in Codex",
      body: "Extend the private Sites dashboard without changing the data-safety boundary. Use sanitized audit JSON, generated dashboard data, preview assets, and the private workbook download only.",
    },
    {
      title: "Create or update a Replit lesson-builder app",
      body: "Use static concept, module, status, skill, phase, and best-match summaries to create a lesson-builder workflow. Do not send private course files automatically.",
    },
    {
      title: "Review concept coverage in ChatGPT",
      body: "Review the selected concept row, best source summary, related modules, and workbook reference. Treat content-only hits as leads, not final coverage determinations.",
    },
    {
      title: "Draft a Workspace Agent specification",
      body: "Create a reviewer agent spec from sanitized concept seeds and reviewer-selected context. Require explicit confirmation before sending private data anywhere.",
    },
  ];

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Integration hub</h2>
          <p>Static launch points and handoff prompts. The dashboard does not send data automatically.</p>
        </div>
      </div>
      <div className="integration-grid">
        <article>
          <h3>Related ChatGPT links</h3>
          <a href="https://chatgpt.com/g/g-p-69def0f95a00819184e951302b7bf3fb-nursing-education-concepts-and-topics/project">Nursing Education Concepts and Topics</a>
          <a href="https://chatgpt.com/g/g-p-69e03990710c81919dc7393245419271-a-concept-based-approach-to-nursing/project">A Concept-Based Approach to Nursing</a>
          <a href="https://chatgpt.com/c/69e4535e-2008-8325-aa72-27519afdb902">Related ChatGPT Conversation</a>
        </article>
        {prompts.map((prompt) => (
          <article key={prompt.title}>
            <h3>{prompt.title}</h3>
            <p>{prompt.body}</p>
            <button
              className="secondary-button"
              onClick={() => navigator.clipboard?.writeText(prompt.body)}
              type="button"
            >
              Copy prompt
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<AuditPayload | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [activeQueue, setActiveQueue] = useState<QueueId>("all");
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/audit");
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to load audit data.");
        return;
      }

      setData(payload);
      setSelectedConceptId(payload.concepts[0]?.id ?? "");
      setSelectedResourceId(payload.courseResources[0]?.id ?? "");
    }

    load();
  }, []);

  const reviews = useMemo(
    () => reviewMap(data?.reviewItems ?? []),
    [data?.reviewItems],
  );

  async function saveReview(id: string, payload: Partial<ReviewItem>) {
    const response = await fetch(`/api/review-items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      return result.error ?? "Unable to save review.";
    }

    setData((current) => {
      if (!current) return current;
      const nextItems = current.reviewItems.map((item) =>
        item.id === id ? result.item : item,
      );
      const nextCounts = nextItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {});
      return { ...current, reviewItems: nextItems, reviewCounts: nextCounts };
    });

    return "Review saved.";
  }

  if (error) {
    return (
      <main className="app-shell">
        <section className="panel error-panel">
          <h1>Pearson Concept Audit Dashboard</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-shell">
        <section className="loading-panel">
          <div className="brand-mark">PA</div>
          <p>Loading Pearson audit workflow.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <AppHeader data={data} />
      <Metrics data={data} />
      <TabNav activeTab={activeTab} onChange={setActiveTab} />
      <QueueBar
        activeQueue={activeQueue}
        data={data}
        onChange={setActiveQueue}
        reviews={reviews}
      />

      {activeTab === "overview" ? (
        <Overview
          data={data}
          onQueue={setActiveQueue}
          onTab={setActiveTab}
          reviews={reviews}
        />
      ) : null}
      {activeTab === "concepts" ? (
        <ConceptsView
          activeQueue={activeQueue}
          data={data}
          onSave={saveReview}
          reviews={reviews}
          selectedId={selectedConceptId}
          setSelectedId={setSelectedConceptId}
        />
      ) : null}
      {activeTab === "structure" ? <StructureView data={data} /> : null}
      {activeTab === "resources" ? (
        <ResourcesView
          activeQueue={activeQueue}
          data={data}
          onSave={saveReview}
          reviews={reviews}
          selectedId={selectedResourceId}
          setSelectedId={setSelectedResourceId}
        />
      ) : null}
      {activeTab === "package" ? <PackageView data={data} /> : null}
      {activeTab === "lessons" ? <LessonBuilder data={data} /> : null}
      {activeTab === "integrations" ? <Integrations /> : null}
    </main>
  );
}
