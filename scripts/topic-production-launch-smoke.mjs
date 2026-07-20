#!/usr/bin/env node

const baseUrl = (process.env.TOPIC_PRODUCTION_BASE_URL || process.env.APP_URL || "http://127.0.0.1:5055").replace(/\/+$/, "");
const results = [];
const publicPublishConfirmationText = "I understand this makes the lesson public";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.json !== undefined) headers.set("content-type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    headers,
  });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload = text;
  if (contentType.includes("application/json") && text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { contentType, ok: response.ok, payload, status: response.status };
}

function record(name, passed, detail, level = "fail") {
  results.push({ name, status: passed ? "pass" : level, detail });
}

function assertRecord(name, passed, detail) {
  record(name, passed, detail);
  if (!passed) {
    const error = new Error(`${name}: ${detail}`);
    error.results = results;
    throw error;
  }
}

function isJson(result) {
  return result.contentType.includes("application/json");
}

function topicKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function targetPackets(packets) {
  return packets.filter((packet) => {
    const key = topicKey(`${packet.topic} ${packet.nursingSubject}`);
    return key.includes("maternal newborn") || key.includes("pediatrics asthma") || key.includes("asthma");
  }).slice(0, 2);
}

function generateBody(packet) {
  return {
    title: `${packet.topic} Template Draft`,
    topic: packet.topic,
    audience: "Prelicensure RN",
    sourceIds: [packet.sourceTruth?.sourceId].filter(Boolean),
    settings: {
      slideCount: Number(packet.lessonBuilderInput?.slideTarget || 8),
      difficulty: "application",
      includeGuidedNotes: true,
      generationMode: "template",
      topicProductionPacket: {
        sourceId: packet.sourceId,
        buildOrder: packet.buildOrder,
        phase: "phase_2_template_draft_smoke",
      },
    },
  };
}

async function run() {
  console.log("NurseStudy topic-production launch smoke");
  console.log(`Target: ${baseUrl}`);
  console.log("Mode: no AI calls; template-only milestone check");
  console.log("");

  const matrix = await request("/api/admin/topic-production-matrix");
  assertRecord("topic matrix API", matrix.status === 200 && isJson(matrix), `status ${matrix.status}`);
  const matrixRows = Array.isArray(matrix.payload?.rows) ? matrix.payload.rows : [];
  const phaseTwoCandidates = matrixRows.filter((row) => row.sourceType === "topic_candidate");
  const phaseTwoTopicNames = [
    "Postpartum Hemorrhage Priorities",
    "Newborn Assessment Cues",
    "Pediatric Emergency Priorities",
  ];
  const phaseTwoTopicRows = phaseTwoTopicNames
    .map((topic) => matrixRows.find((row) => row.topic === topic))
    .filter(Boolean);
  assertRecord(
    "phase 2 five-topic catalog",
    matrix.payload?.summary?.totalTopics >= 5
      && phaseTwoTopicRows.length === phaseTwoTopicNames.length,
    `${matrix.payload?.summary?.totalTopics || 0} topics, ${phaseTwoCandidates.length} raw candidates, ${phaseTwoTopicRows.length} phase-2 topic row(s)`
  );
  assertRecord(
    "phase 2 candidates mapped",
    phaseTwoTopicRows.length === phaseTwoTopicNames.length
      && phaseTwoTopicRows.every((row) => row.concept && row.nursingSubject && row.weakTopic && row.nclexCategory && row.cjmStep),
    phaseTwoTopicRows.map((row) => `${row.topic}: ${row.concept || "missing"} / ${row.nursingSubject || "missing"}`).join("; ")
  );
  assertRecord(
    "phase 2 candidates hold media spend",
    phaseTwoTopicRows.length === phaseTwoTopicNames.length
      && phaseTwoTopicRows.every((row) => row.packageStatus !== "published")
      && phaseTwoTopicRows.every((row) => row.placement?.studentVisible !== true)
      && phaseTwoTopicRows.every((row) => /Hold|missing assets|human review|not queued/i.test(row.placement?.productionQueue || "")),
    phaseTwoTopicRows.map((row) => `${row.topic}: ${row.sourceType} / ${row.packageStatus}`).join("; ")
  );
  const humanReviewPack = await request("/api/admin/topic-production-matrix/human-review-pack?format=json");
  const humanReviewRecords = Array.isArray(humanReviewPack.payload?.records) ? humanReviewPack.payload.records : [];
  const requiredHumanReviewFields = [
    "Review Stage",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Review Decision",
    "Recommended Decision",
    "Next Owner Action",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 3 human review pack API",
    humanReviewPack.status === 200 && humanReviewRecords.length >= 5,
    `status ${humanReviewPack.status}, ${humanReviewRecords.length} record(s)`
  );
  assertRecord(
    "phase 3 human review pack fields",
    humanReviewRecords.every((record) => requiredHumanReviewFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredHumanReviewFields.length} required human-review field(s)`
  );
  assertRecord(
    "phase 3 human review pack catalog",
    ["Maternal-Newborn Lesson Guide", "Pediatrics Asthma", "Postpartum Hemorrhage Priorities", "Newborn Assessment Cues", "Pediatric Emergency Priorities"]
      .every((topic) => humanReviewRecords.some((record) => record.Topic === topic)),
    humanReviewRecords.map((record) => record.Topic || "untitled").join("; ")
  );
  assertRecord(
    "phase 3 human review pack holds spend",
    humanReviewRecords.every((record) => String(record["Cost Guardrail"] || "").includes("Human review only")),
    humanReviewRecords.map((record) => `${record.Topic}: ${record["Cost Guardrail"] || "missing"}`).slice(0, 5).join("; ")
  );
  const postpartumReviewRecord = humanReviewRecords.find((record) => record.Topic === "Postpartum Hemorrhage Priorities");
  const savedHumanReview = postpartumReviewRecord
    ? await request(`/api/admin/topic-production-matrix/${encodeURIComponent(String(postpartumReviewRecord["Source Type"]))}/${encodeURIComponent(String(postpartumReviewRecord["Source ID"]))}/review`, {
      method: "PATCH",
      json: {
        decision: "approve_mapping",
        reviewerNotes: "Launch smoke approves placement only; media spend remains held.",
      },
    })
    : { status: 0, payload: null };
  record("phase 3 human review decision save", savedHumanReview.status === 200 && isJson(savedHumanReview), `status ${savedHumanReview.status}`);
  const humanReviewAfterDecision = await request("/api/admin/topic-production-matrix/human-review-pack?format=json");
  const humanReviewDecisionRecords = Array.isArray(humanReviewAfterDecision.payload?.records) ? humanReviewAfterDecision.payload.records : [];
  assertRecord(
    "phase 3 human review decision persists",
    humanReviewAfterDecision.status === 200
      && humanReviewDecisionRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities" && record["Review Decision"] === "approve_mapping"),
    humanReviewDecisionRecords.map((record) => `${record.Topic}: ${record["Review Decision"] || "missing"}`).join("; ")
  );
  const humanReviewCsv = await request("/api/admin/topic-production-matrix/human-review-pack?format=csv");
  const humanReviewHeader = String(humanReviewCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 3 human review CSV fields",
    humanReviewCsv.status === 200
      && requiredHumanReviewFields.every((field) => humanReviewHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${humanReviewCsv.status}, ${requiredHumanReviewFields.length} required human-review field(s)`
  );
  const mediaPilotPack = await request("/api/admin/topic-production-matrix/media-pilot-pack?format=json");
  const mediaPilotRecords = Array.isArray(mediaPilotPack.payload?.records) ? mediaPilotPack.payload.records : [];
  const requiredMediaPilotFields = [
    "Pilot Stage",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Slide Deck Plan",
    "Study Guide Plan",
    "Visual Plan",
    "Quiz/Rationale Plan",
    "Narration Script Plan",
    "Video Status",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 4 media pilot pack API",
    mediaPilotPack.status === 200 && mediaPilotRecords.length >= 1,
    `status ${mediaPilotPack.status}, ${mediaPilotRecords.length} record(s)`
  );
  assertRecord(
    "phase 4 media pilot pack fields",
    mediaPilotRecords.every((record) => requiredMediaPilotFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredMediaPilotFields.length} required media-pilot field(s)`
  );
  assertRecord(
    "phase 4 media pilot approved topic",
    mediaPilotRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities"),
    mediaPilotRecords.map((record) => record.Topic || "untitled").join("; ")
  );
  assertRecord(
    "phase 4 media pilot blocks generation",
    mediaPilotRecords.every((record) => /not_started|manual approval/i.test(String(record["Video Status"] || record["Required Human Approval"] || ""))),
    mediaPilotRecords.map((record) => `${record.Topic}: ${record["Video Status"] || "missing"}`).join("; ")
  );
  const mediaPilotCsv = await request("/api/admin/topic-production-matrix/media-pilot-pack?format=csv");
  const mediaPilotHeader = String(mediaPilotCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 4 media pilot CSV fields",
    mediaPilotCsv.status === 200
      && requiredMediaPilotFields.every((field) => mediaPilotHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${mediaPilotCsv.status}, ${requiredMediaPilotFields.length} required media-pilot field(s)`
  );
  const mediaWorkOrders = await request("/api/admin/topic-production-matrix/media-work-orders?format=json");
  const mediaWorkOrderRecords = Array.isArray(mediaWorkOrders.payload?.records) ? mediaWorkOrders.payload.records : [];
  const requiredMediaWorkOrderFields = [
    "Work Order ID",
    "Approval Status",
    "Cost Basis",
    "Estimated Token Budget",
    "Estimated Dollar Budget",
    "Topic",
    "Production Line Items",
    "Slide Deck Work",
    "Study Guide Work",
    "Quiz Work",
    "Narration Work",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 4 dollar work orders API",
    mediaWorkOrders.status === 200
      && mediaWorkOrders.payload?.estimatedDollarsPerTopic === 140
      && mediaWorkOrderRecords.length >= 1,
    `status ${mediaWorkOrders.status}, $${mediaWorkOrders.payload?.estimatedDollarsPerTopic || "missing"}, ${mediaWorkOrderRecords.length} record(s)`
  );
  assertRecord(
    "phase 4 dollar work order fields",
    mediaWorkOrderRecords.every((record) => requiredMediaWorkOrderFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredMediaWorkOrderFields.length} required work-order field(s)`
  );
  assertRecord(
    "phase 4 dollar work order cost gate",
    mediaWorkOrderRecords.every((record) => ["manual_approval_required", "approved_for_single_topic_scaffold"].includes(String(record["Approval Status"] || "")))
      && mediaWorkOrderRecords.every((record) => /No batch generation|no TTS|no rendered video/i.test(String(record["Cost Guardrail"] || ""))),
    mediaWorkOrderRecords.map((record) => `${record.Topic}: ${record["Approval Status"] || "missing"}`).join("; ")
  );
  const mediaWorkOrdersCsv = await request("/api/admin/topic-production-matrix/media-work-orders?format=csv");
  const mediaWorkOrdersHeader = String(mediaWorkOrdersCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 4 dollar work order CSV fields",
    mediaWorkOrdersCsv.status === 200
      && requiredMediaWorkOrderFields.every((field) => mediaWorkOrdersHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${mediaWorkOrdersCsv.status}, ${requiredMediaWorkOrderFields.length} required work-order field(s)`
  );
  const firstWorkOrderId = mediaWorkOrderRecords[0]?.["Work Order ID"];
  const savedWorkOrderReview = firstWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/media-work-orders/${encodeURIComponent(firstWorkOrderId)}/review`, {
        method: "PATCH",
        json: {
          decision: "approve_single_topic_scaffold",
          reviewerNotes: "Smoke approves the one-topic scaffold plan only; media rendering remains blocked.",
        },
      })
    : { status: 0, payload: null };
  assertRecord(
    "phase 4 dollar work order decision save",
    savedWorkOrderReview.status === 200 && isJson(savedWorkOrderReview),
    `status ${savedWorkOrderReview.status}`
  );
  const mediaWorkOrdersAfterDecision = await request("/api/admin/topic-production-matrix/media-work-orders?format=json");
  const mediaWorkOrderDecisionRecords = Array.isArray(mediaWorkOrdersAfterDecision.payload?.records) ? mediaWorkOrdersAfterDecision.payload.records : [];
  assertRecord(
    "phase 4 dollar work order decision persists",
    mediaWorkOrdersAfterDecision.status === 200
      && mediaWorkOrderDecisionRecords.some((record) => record["Work Order Review Decision"] === "approve_single_topic_scaffold" && record["Approval Status"] === "approved_for_single_topic_scaffold")
      && mediaWorkOrderDecisionRecords.every((record) => /No batch generation|no TTS|no rendered video/i.test(String(record["Cost Guardrail"] || ""))),
    mediaWorkOrderDecisionRecords.map((record) => `${record.Topic}: ${record["Work Order Review Decision"] || "missing"} / ${record["Approval Status"] || "missing"}`).join("; ")
  );
  const mediaScaffoldPack = await request("/api/admin/topic-production-matrix/media-scaffold-pack?format=json");
  const mediaScaffoldRecords = Array.isArray(mediaScaffoldPack.payload?.records) ? mediaScaffoldPack.payload.records : [];
  const requiredMediaScaffoldFields = [
    "Scaffold Stage",
    "Approved Work Order ID",
    "Scaffold Approval Status",
    "Scaffold Review Decision",
    "Scaffold Review Notes",
    "Scaffold Reviewed At",
    "Topic",
    "Slide Deck Scaffold",
    "Study Guide Scaffold",
    "Visual Storyboard",
    "Quiz Scaffold",
    "Narration Outline",
    "Creator Review Checklist",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 4 scaffold pack API",
    mediaScaffoldPack.status === 200 && mediaScaffoldRecords.length >= 1,
    `status ${mediaScaffoldPack.status}, ${mediaScaffoldRecords.length} scaffold row(s)`
  );
  assertRecord(
    "phase 4 scaffold pack fields",
    mediaScaffoldRecords.every((record) => requiredMediaScaffoldFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredMediaScaffoldFields.length} required scaffold field(s)`
  );
  assertRecord(
    "phase 4 scaffold approved topic",
    mediaScaffoldRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities" && String(record["Slide Deck Scaffold"] || "").includes("Slide 1")),
    mediaScaffoldRecords.map((record) => `${record.Topic}: ${String(record["Slide Deck Scaffold"] || "").slice(0, 40)}`).join("; ")
  );
  assertRecord(
    "phase 4 scaffold blocks media rendering",
    mediaScaffoldRecords.every((record) => /No AI generation call|no TTS|no rendered video|no paid visual/i.test(String(record["Cost Guardrail"] || ""))),
    mediaScaffoldRecords.map((record) => `${record.Topic}: ${record["Cost Guardrail"] || "missing"}`).join("; ")
  );
  const mediaScaffoldCsv = await request("/api/admin/topic-production-matrix/media-scaffold-pack?format=csv");
  const mediaScaffoldHeader = String(mediaScaffoldCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 4 scaffold CSV fields",
    mediaScaffoldCsv.status === 200
      && requiredMediaScaffoldFields.every((field) => mediaScaffoldHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${mediaScaffoldCsv.status}, ${requiredMediaScaffoldFields.length} required scaffold field(s)`
  );
  const firstScaffoldWorkOrderId = mediaScaffoldRecords[0]?.["Approved Work Order ID"];
  const savedScaffoldReview = firstScaffoldWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/media-scaffold-pack/${encodeURIComponent(firstScaffoldWorkOrderId)}/review`, {
        method: "PATCH",
        json: {
          decision: "approve_ai_draft_checkpoint",
          reviewerNotes: "Smoke approves only the next AI text-draft checkpoint; media rendering remains blocked.",
        },
      })
    : { status: 0, payload: null };
  assertRecord(
    "phase 4 scaffold review decision save",
    savedScaffoldReview.status === 200 && isJson(savedScaffoldReview),
    `status ${savedScaffoldReview.status}`
  );
  const mediaScaffoldAfterReview = await request("/api/admin/topic-production-matrix/media-scaffold-pack?format=json");
  const mediaScaffoldReviewRecords = Array.isArray(mediaScaffoldAfterReview.payload?.records) ? mediaScaffoldAfterReview.payload.records : [];
  assertRecord(
    "phase 4 scaffold review decision persists",
    mediaScaffoldAfterReview.status === 200
      && mediaScaffoldReviewRecords.some((record) => record["Scaffold Review Decision"] === "approve_ai_draft_checkpoint" && record["Scaffold Approval Status"] === "approved_for_ai_draft_checkpoint")
      && mediaScaffoldReviewRecords.every((record) => /no TTS|no rendered video|no paid visual/i.test(String(record["Cost Guardrail"] || ""))),
    mediaScaffoldReviewRecords.map((record) => `${record.Topic}: ${record["Scaffold Review Decision"] || "missing"} / ${record["Scaffold Approval Status"] || "missing"}`).join("; ")
  );
  const mediaTextDraftPack = await request("/api/admin/topic-production-matrix/media-text-draft-pack?format=json");
  const mediaTextDraftRecords = Array.isArray(mediaTextDraftPack.payload?.records) ? mediaTextDraftPack.payload.records : [];
  const requiredMediaTextDraftFields = [
    "Draft Stage",
    "Approved Work Order ID",
    "Text Draft Approval Status",
    "Text Draft Review Decision",
    "Text Draft Review Notes",
    "Text Draft Reviewed At",
    "Topic",
    "Slide Deck Text Draft",
    "Study Guide Text Draft",
    "Visual Brief Text",
    "Quiz/Rationale Text Draft",
    "Narration Script Draft",
    "Creator Review Questions",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 5 text draft pack API",
    mediaTextDraftPack.status === 200 && mediaTextDraftRecords.length >= 1,
    `status ${mediaTextDraftPack.status}, ${mediaTextDraftRecords.length} draft row(s)`
  );
  assertRecord(
    "phase 5 text draft pack fields",
    mediaTextDraftRecords.every((record) => requiredMediaTextDraftFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredMediaTextDraftFields.length} required text-draft field(s)`
  );
  assertRecord(
    "phase 5 text draft approved topic",
    mediaTextDraftRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities" && String(record["Slide Deck Text Draft"] || "").includes("Slide 1")),
    mediaTextDraftRecords.map((record) => `${record.Topic}: ${String(record["Slide Deck Text Draft"] || "").slice(0, 40)}`).join("; ")
  );
  assertRecord(
    "phase 5 text draft blocks media rendering",
    mediaTextDraftRecords.every((record) => /No TTS|no rendered video|no paid visual|no batch generation/i.test(String(record["Cost Guardrail"] || ""))),
    mediaTextDraftRecords.map((record) => `${record.Topic}: ${record["Cost Guardrail"] || "missing"}`).join("; ")
  );
  const mediaTextDraftCsv = await request("/api/admin/topic-production-matrix/media-text-draft-pack?format=csv");
  const mediaTextDraftHeader = String(mediaTextDraftCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 5 text draft CSV fields",
    mediaTextDraftCsv.status === 200
      && requiredMediaTextDraftFields.every((field) => mediaTextDraftHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${mediaTextDraftCsv.status}, ${requiredMediaTextDraftFields.length} required text-draft field(s)`
  );
  const firstTextDraftWorkOrderId = mediaTextDraftRecords[0]?.["Approved Work Order ID"];
  const savedTextDraftReview = firstTextDraftWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/media-text-draft-pack/${encodeURIComponent(firstTextDraftWorkOrderId)}/review`, {
        method: "PATCH",
        json: {
          decision: "approve_package_assembly_checkpoint",
          reviewerNotes: "Smoke approves only lesson-package assembly; media rendering remains blocked.",
        },
      })
    : { status: 0, payload: null };
  assertRecord(
    "phase 5 text draft review decision save",
    savedTextDraftReview.status === 200 && isJson(savedTextDraftReview),
    `status ${savedTextDraftReview.status}`
  );
  const mediaTextDraftAfterReview = await request("/api/admin/topic-production-matrix/media-text-draft-pack?format=json");
  const mediaTextDraftReviewRecords = Array.isArray(mediaTextDraftAfterReview.payload?.records) ? mediaTextDraftAfterReview.payload.records : [];
  assertRecord(
    "phase 5 text draft review decision persists",
    mediaTextDraftAfterReview.status === 200
      && mediaTextDraftReviewRecords.some((record) => record["Text Draft Review Decision"] === "approve_package_assembly_checkpoint" && record["Text Draft Approval Status"] === "approved_for_package_assembly_checkpoint")
      && mediaTextDraftReviewRecords.every((record) => /No TTS|no rendered video|no paid visual|no batch generation/i.test(String(record["Cost Guardrail"] || ""))),
    mediaTextDraftReviewRecords.map((record) => `${record.Topic}: ${record["Text Draft Review Decision"] || "missing"} / ${record["Text Draft Approval Status"] || "missing"}`).join("; ")
  );
  const packageAssemblyPack = await request("/api/admin/topic-production-matrix/package-assembly-pack?format=json");
  const packageAssemblyRecords = Array.isArray(packageAssemblyPack.payload?.records) ? packageAssemblyPack.payload.records : [];
  const requiredPackageAssemblyFields = [
    "Assembly Stage",
    "Approved Work Order ID",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Lesson Package Title",
    "Slide Assembly Plan",
    "Guided Notes Assembly Plan",
    "Practice Item Assembly Plan",
    "Citation Plan",
    "Learner Surface Plan",
    "Export Plan",
    "Review Gate",
    "Next Allowed Action",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 6 package assembly pack API",
    packageAssemblyPack.status === 200 && packageAssemblyRecords.length >= 1,
    `status ${packageAssemblyPack.status}, ${packageAssemblyRecords.length} assembly row(s)`
  );
  assertRecord(
    "phase 6 package assembly fields",
    packageAssemblyRecords.every((record) => requiredPackageAssemblyFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredPackageAssemblyFields.length} required package-assembly field(s)`
  );
  assertRecord(
    "phase 6 package assembly approved topic",
    packageAssemblyRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities" && String(record["Lesson Package Title"] || "").includes("NurseStudy Review Package")),
    packageAssemblyRecords.map((record) => `${record.Topic}: ${record["Lesson Package Title"] || "missing"}`).join("; ")
  );
  assertRecord(
    "phase 6 package assembly blocks media and publish",
    packageAssemblyRecords.every((record) => /No TTS|no rendered video|no paid visual|no batch generation|no public publish/i.test(String(record["Cost Guardrail"] || ""))),
    packageAssemblyRecords.map((record) => `${record.Topic}: ${record["Cost Guardrail"] || "missing"}`).join("; ")
  );
  const packageAssemblyCsv = await request("/api/admin/topic-production-matrix/package-assembly-pack?format=csv");
  const packageAssemblyHeader = String(packageAssemblyCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 6 package assembly CSV fields",
    packageAssemblyCsv.status === 200
      && requiredPackageAssemblyFields.every((field) => packageAssemblyHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${packageAssemblyCsv.status}, ${requiredPackageAssemblyFields.length} required package-assembly field(s)`
  );
  const packageReviewBlueprint = await request("/api/admin/topic-production-matrix/package-review-blueprint?format=json");
  const packageReviewBlueprintRecords = Array.isArray(packageReviewBlueprint.payload?.records) ? packageReviewBlueprint.payload.records : [];
  const requiredPackageReviewBlueprintFields = [
    "Blueprint Stage",
    "Approved Work Order ID",
    "Build Approval Status",
    "Blueprint Review Decision",
    "Blueprint Review Notes",
    "Blueprint Reviewed At",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Lesson Package Title",
    "Learner Outcome",
    "Slide Blueprint",
    "Guided Notes Blueprint",
    "Practice Blueprint",
    "Visual Placeholder Blueprint",
    "Citation Slot Blueprint",
    "Export File Blueprint",
    "Review Checklist",
    "Human Expert Questions",
    "Stop Conditions",
    "Next Allowed Action",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 7 package review blueprint API",
    packageReviewBlueprint.status === 200 && packageReviewBlueprintRecords.length >= 1,
    `status ${packageReviewBlueprint.status}, ${packageReviewBlueprintRecords.length} blueprint row(s)`
  );
  assertRecord(
    "phase 7 package review blueprint fields",
    packageReviewBlueprintRecords.every((record) => requiredPackageReviewBlueprintFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredPackageReviewBlueprintFields.length} required package-review-blueprint field(s)`
  );
  assertRecord(
    "phase 7 package review blueprint approved topic",
    packageReviewBlueprintRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities" && String(record["Slide Blueprint"] || "").includes("Slide 1")),
    packageReviewBlueprintRecords.map((record) => `${record.Topic}: ${String(record["Slide Blueprint"] || "").slice(0, 60)}`).join("; ")
  );
  assertRecord(
    "phase 7 package review blueprint blocks publish and media",
    packageReviewBlueprintRecords.every((record) => /No package publish|no TTS|no rendered video|no paid visual|no batch generation/i.test(String(record["Cost Guardrail"] || ""))),
    packageReviewBlueprintRecords.map((record) => `${record.Topic}: ${record["Cost Guardrail"] || "missing"}`).join("; ")
  );
  const packageReviewBlueprintCsv = await request("/api/admin/topic-production-matrix/package-review-blueprint?format=csv");
  const packageReviewBlueprintHeader = String(packageReviewBlueprintCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 7 package review blueprint CSV fields",
    packageReviewBlueprintCsv.status === 200
      && requiredPackageReviewBlueprintFields.every((field) => packageReviewBlueprintHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${packageReviewBlueprintCsv.status}, ${requiredPackageReviewBlueprintFields.length} required blueprint field(s)`
  );
  const firstBlueprintWorkOrderId = packageReviewBlueprintRecords[0]?.["Approved Work Order ID"];
  const savedBlueprintReview = firstBlueprintWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/package-review-blueprint/${encodeURIComponent(firstBlueprintWorkOrderId)}/review`, {
        method: "PATCH",
        json: {
          decision: "approve_review_package_build",
          reviewerNotes: "Smoke approves only one deterministic unpublished review-package build; media and public publish remain blocked.",
        },
      })
    : { status: 0, payload: null };
  assertRecord(
    "phase 8 blueprint build-gate decision save",
    savedBlueprintReview.status === 200 && isJson(savedBlueprintReview),
    `status ${savedBlueprintReview.status}`
  );
  const packageReviewBlueprintAfterReview = await request("/api/admin/topic-production-matrix/package-review-blueprint?format=json");
  const packageReviewBlueprintDecisionRecords = Array.isArray(packageReviewBlueprintAfterReview.payload?.records) ? packageReviewBlueprintAfterReview.payload.records : [];
  assertRecord(
    "phase 8 blueprint build-gate decision persists",
    packageReviewBlueprintAfterReview.status === 200
      && packageReviewBlueprintDecisionRecords.some((record) => record["Blueprint Review Decision"] === "approve_review_package_build" && record["Build Approval Status"] === "approved_for_deterministic_review_package_build")
      && packageReviewBlueprintDecisionRecords.every((record) => /one deterministic unpublished review package build|No package publish|no TTS|no rendered video|no paid visual|no batch generation/i.test(String(record["Cost Guardrail"] || ""))),
    packageReviewBlueprintDecisionRecords.map((record) => `${record.Topic}: ${record["Blueprint Review Decision"] || "missing"} / ${record["Build Approval Status"] || "missing"}`).join("; ")
  );
  const reviewPackageBuilds = await request("/api/admin/topic-production-matrix/review-package-builds?format=json");
  const reviewPackageBuildRecords = Array.isArray(reviewPackageBuilds.payload?.records) ? reviewPackageBuilds.payload.records : [];
  const requiredReviewPackageBuildFields = [
    "Build Stage",
    "Approved Work Order ID",
    "Topic",
    "Concept",
    "Nursing Subject",
    "Weak Topic",
    "NCLEX Category",
    "CJM Step",
    "Lesson Package Title",
    "Build Mode",
    "Publish Status",
    "Media Status",
    "Bundle File Count",
    "Bundle Files",
    "Review Manifest",
    "Learner Slides",
    "Guided Notes",
    "Practice Item",
    "Citations",
    "Creator Review Checklist",
    "Next Allowed Action",
    "Cost Guardrail",
  ];
  const requiredReviewPackageFiles = [
    "review_manifest.json",
    "learner_slides.md",
    "guided_notes.md",
    "practice_item.md",
    "citations.md",
    "creator_review_checklist.md",
  ];
  assertRecord(
    "phase 9 review package build API",
    reviewPackageBuilds.status === 200 && reviewPackageBuildRecords.length >= 1,
    `status ${reviewPackageBuilds.status}, ${reviewPackageBuildRecords.length} review package build(s)`
  );
  assertRecord(
    "phase 9 review package build fields",
    reviewPackageBuildRecords.every((record) => requiredReviewPackageBuildFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredReviewPackageBuildFields.length} required review-package field(s)`
  );
  assertRecord(
    "phase 9 review package file contract",
    reviewPackageBuildRecords.some((record) => record.Topic === "Postpartum Hemorrhage Priorities"
      && requiredReviewPackageFiles.every((fileName) => String(record["Bundle Files"] || "").includes(fileName))
      && String(record["Review Manifest"] || "").includes("deterministic_unpublished_review_package")
      && String(record["Learner Slides"] || "").includes("Student-facing draft content placeholder")
      && String(record["Practice Item"] || "").includes("Rationale Review")),
    reviewPackageBuildRecords.map((record) => `${record.Topic}: ${record["Bundle Files"] || "missing"}`).join("; ")
  );
  assertRecord(
    "phase 9 review package blocks publish and media",
    reviewPackageBuildRecords.every((record) => record["Publish Status"] === "not_published"
      && record["Media Status"] === "not_started"
      && /No public publish|no TTS|no rendered video|no paid visual|no batch generation/i.test(String(record["Cost Guardrail"] || ""))),
    reviewPackageBuildRecords.map((record) => `${record.Topic}: ${record["Publish Status"] || "missing"} / ${record["Media Status"] || "missing"} / ${record["Cost Guardrail"] || "missing"}`).join("; ")
  );
  const reviewPackageBuildCsv = await request("/api/admin/topic-production-matrix/review-package-builds?format=csv");
  const reviewPackageBuildHeader = String(reviewPackageBuildCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 9 review package CSV fields",
    reviewPackageBuildCsv.status === 200
      && requiredReviewPackageBuildFields.filter((field) => !["Review Manifest", "Learner Slides", "Guided Notes", "Practice Item", "Citations", "Creator Review Checklist"].includes(field)).every((field) => reviewPackageBuildHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${reviewPackageBuildCsv.status}, review package CSV header ${reviewPackageBuildHeader}`
  );
  const reviewPackageBuildZip = await request("/api/admin/topic-production-matrix/review-package-builds?format=zip");
  assertRecord(
    "phase 9 review package ZIP export",
    reviewPackageBuildZip.status === 200
      && reviewPackageBuildZip.contentType.includes("application/zip")
      && String(reviewPackageBuildZip.payload || "").length > 500,
    `status ${reviewPackageBuildZip.status}, content-type ${reviewPackageBuildZip.contentType}, bytes ${String(reviewPackageBuildZip.payload || "").length}`
  );
  const reviewPackageWorkOrderId = String(reviewPackageBuildRecords.find((record) => record.Topic === "Postpartum Hemorrhage Priorities")?.["Approved Work Order ID"] || reviewPackageBuildRecords[0]?.["Approved Work Order ID"] || "");
  const promotedReviewPackage = reviewPackageWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(reviewPackageWorkOrderId)}/promote`, { method: "POST", json: {} })
    : { status: 0, payload: null, contentType: "" };
  const promotedPackageId = promotedReviewPackage.payload?.package?.id;
  assertRecord(
    "phase 10 unpublished draft promotion API",
    promotedReviewPackage.status === 200
      && isJson(promotedReviewPackage)
      && promotedReviewPackage.payload?.package?.status === "draft"
      && promotedReviewPackage.payload?.promotion?.publishStatus === "not_published"
      && promotedReviewPackage.payload?.promotion?.mediaStatus === "not_started",
    `status ${promotedReviewPackage.status}, package ${promotedPackageId || "missing"}`
  );
  const promotedBundle = promotedPackageId
    ? await request(`/api/admin/lesson-builder/packages/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 10 unpublished draft package shape",
    promotedBundle.status === 200
      && promotedBundle.payload?.package?.status === "draft"
      && promotedBundle.payload?.package?.manifest?.topicProduction?.phase === "phase_10_unpublished_lesson_builder_draft"
      && Array.isArray(promotedBundle.payload?.slides)
      && promotedBundle.payload.slides.length >= 6
      && Array.isArray(promotedBundle.payload?.items)
      && promotedBundle.payload.items.length >= 1
      && Array.isArray(promotedBundle.payload?.citations)
      && promotedBundle.payload.citations.length >= promotedBundle.payload.slides.length,
    `status ${promotedBundle.status}, slides ${promotedBundle.payload?.slides?.length || 0}, items ${promotedBundle.payload?.items?.length || 0}, citations ${promotedBundle.payload?.citations?.length || 0}`
  );
  const promotedPublicLesson = promotedPackageId
    ? await request(`/api/lessons/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 10 unpublished draft hidden from public lesson route",
    promotedPublicLesson.status === 404,
    `status ${promotedPublicLesson.status}`
  );
  const creatorQaGate = reviewPackageWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(reviewPackageWorkOrderId)}/creator-qa`, { method: "POST", json: {} })
    : { status: 0, payload: null, contentType: "" };
  const creatorQaStatus = creatorQaGate.payload?.creatorQaGate?.status;
  assertRecord(
    "phase 12 creator QA repair gate API",
    creatorQaGate.status === 200
      && isJson(creatorQaGate)
      && creatorQaStatus === "ready_for_controlled_preview"
      && creatorQaGate.payload?.creatorQaGate?.publishStatus === "not_published"
      && creatorQaGate.payload?.creatorQaGate?.mediaStatus === "not_started",
    `status ${creatorQaGate.status}, gate ${creatorQaStatus || "missing"}`
  );
  const creatorQaBundle = promotedPackageId
    ? await request(`/api/admin/lesson-builder/packages/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 12 creator QA package metadata",
    creatorQaBundle.status === 200
      && creatorQaBundle.payload?.package?.status === "qa_ready"
      && creatorQaBundle.payload?.package?.manifest?.topicProduction?.phase === "phase_11_creator_qa_gate"
      && creatorQaBundle.payload?.package?.manifest?.topicProduction?.creatorQaGate?.status === creatorQaStatus
      && Array.isArray(creatorQaBundle.payload?.qaResults)
      && creatorQaBundle.payload.qaResults.length >= 1
      && Array.isArray(creatorQaBundle.payload?.contractValidations)
      && creatorQaBundle.payload.contractValidations.length >= 1,
    `status ${creatorQaBundle.status}, package ${creatorQaBundle.payload?.package?.status || "missing"}, gate ${creatorQaStatus || "missing"}`
  );
  const creatorQaPublicLesson = promotedPackageId
    ? await request(`/api/lessons/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 12 qa-ready draft remains hidden from public lesson route",
    creatorQaPublicLesson.status === 404,
    `status ${creatorQaPublicLesson.status}`
  );
  const controlledPreviewDecision = reviewPackageWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(reviewPackageWorkOrderId)}/controlled-preview-decision`, {
        method: "PATCH",
        json: {
          decision: "approve_student_preview",
          reviewerNotes: "Smoke approves controlled preview only; public publish and media remain blocked.",
        },
      })
    : { status: 0, payload: null, contentType: "" };
  const phase13PreviewUrl = String(controlledPreviewDecision.payload?.controlledPreviewDecision?.studentPreviewUrl || "");
  const phase13PreviewKey = phase13PreviewUrl ? new URL(`${baseUrl}${phase13PreviewUrl}`).searchParams.get("previewKey") : "";
  assertRecord(
    "phase 13 controlled preview decision",
    controlledPreviewDecision.status === 200
      && isJson(controlledPreviewDecision)
      && controlledPreviewDecision.payload?.controlledPreviewDecision?.decision === "approve_student_preview"
      && controlledPreviewDecision.payload?.controlledPreviewDecision?.previewKeyStatus === "active"
      && phase13PreviewUrl.includes("previewKey=")
      && controlledPreviewDecision.payload?.controlledPreviewDecision?.publishStatus === "not_published"
      && controlledPreviewDecision.payload?.controlledPreviewDecision?.mediaStatus === "not_started",
    `status ${controlledPreviewDecision.status}, preview ${phase13PreviewUrl || "missing"}`
  );
  const phase13PreviewLesson = phase13PreviewUrl
    ? await request(phase13PreviewUrl.replace(/^\/lessons\//, "/api/lessons/"))
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 13 controlled preview link loads",
    phase13PreviewLesson.status === 200
      && isJson(phase13PreviewLesson)
      && phase13PreviewLesson.payload?.package?.id === promotedPackageId
      && Array.isArray(phase13PreviewLesson.payload?.slides)
      && phase13PreviewLesson.payload.slides.length >= 5
      && Array.isArray(phase13PreviewLesson.payload?.package?.reviewSummary?.checklist)
      && phase13PreviewLesson.payload.package.reviewSummary.checklist.length >= 5,
    `status ${phase13PreviewLesson.status}, previewKey ${phase13PreviewKey || "missing"}`
  );
  const phase13PublicLesson = promotedPackageId
    ? await request(`/api/lessons/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 13 controlled preview remains hidden without key",
    phase13PublicLesson.status === 404,
    `status ${phase13PublicLesson.status}`
  );
  const phase14PreviewReview = reviewPackageWorkOrderId
    ? await request(`/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(reviewPackageWorkOrderId)}/preview-review`, {
        method: "PATCH",
        json: {
          outcome: "ready_for_release",
          reviewerNotes: "Smoke marks the controlled preview ready for release review only; public publish and media remain blocked.",
        },
      })
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 14 controlled preview review outcome",
    phase14PreviewReview.status === 200
      && isJson(phase14PreviewReview)
      && phase14PreviewReview.payload?.previewReview?.outcome === "ready_for_release"
      && phase14PreviewReview.payload?.controlledPreviewReview?.outcome === "ready_for_release"
      && phase14PreviewReview.payload?.controlledPreviewReview?.publishStatus === "not_published"
      && phase14PreviewReview.payload?.controlledPreviewReview?.mediaStatus === "not_started",
    `status ${phase14PreviewReview.status}, outcome ${phase14PreviewReview.payload?.previewReview?.outcome || "missing"}`
  );
  const phase14Bundle = promotedPackageId
    ? await request(`/api/admin/lesson-builder/packages/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 14 review stored in manifest",
    phase14Bundle.status === 200
      && phase14Bundle.payload?.package?.status !== "published"
      && phase14Bundle.payload?.package?.manifest?.topicProduction?.phase === "phase_14_controlled_preview_review"
      && phase14Bundle.payload?.package?.manifest?.topicProduction?.controlledPreviewReview?.outcome === "ready_for_release"
      && phase14Bundle.payload?.package?.manifest?.topicProductionStudentLaunchDecision?.previewReview?.outcome === "ready_for_release",
    `status ${phase14Bundle.status}, package ${phase14Bundle.payload?.package?.status || "missing"}`
  );
  const phase14PublicLesson = promotedPackageId
    ? await request(`/api/lessons/${encodeURIComponent(promotedPackageId)}`)
    : { status: 0, payload: null, contentType: "" };
  assertRecord(
    "phase 14 reviewed preview remains hidden without key",
    phase14PublicLesson.status === 404,
    `status ${phase14PublicLesson.status}`
  );
  assertRecord(
    "Drive project inventory",
    matrix.payload?.driveProject?.id === "1c0Ayvgi8Av0c8M4SdOrwvHGhieXz553k"
      && Array.isArray(matrix.payload.driveProject.assets)
      && matrix.payload.driveProject.assets.length >= 6,
    `${matrix.payload?.driveProject?.assetCount || 0} assets`
  );
  const tracker = matrix.payload?.airtableTracker;
  const requiredHeaders = Array.isArray(tracker?.requiredCsvHeaders) ? tracker.requiredCsvHeaders : [];
  assertRecord(
    "Airtable tracker contract",
    tracker?.tableName === "Viral Shorts Workflow"
      && requiredHeaders.includes("Topic")
      && requiredHeaders.includes("Drive Project Assets")
      && requiredHeaders.includes("Cost Guardrail"),
    `${tracker?.tableName || "missing"}, ${requiredHeaders.length} headers`
  );

  const contract = await request("/api/admin/topic-production-matrix/airtable-tracker-contract");
  assertRecord(
    "Airtable tracker contract endpoint",
    contract.status === 200
      && isJson(contract)
      && contract.payload?.tracker?.requiredCsvHeaders?.length === requiredHeaders.length,
    `status ${contract.status}`
  );

  const queue = await request("/api/admin/topic-production-matrix/phase-one/queue", { method: "POST", json: {} });
  assertRecord("phase one queue", queue.status === 200 && isJson(queue), `status ${queue.status}`);

  let packetResult = await request("/api/admin/topic-production-matrix/build-packets?format=json");
  assertRecord("build packets API", packetResult.status === 200 && isJson(packetResult), `status ${packetResult.status}`);
  let packets = targetPackets(packetResult.payload?.packets || []);
  assertRecord("two starter packets", packets.length >= 2, `${packets.length} target packet(s)`);
  assertRecord(
    "Drive assets attached to packets",
    packets.every((packet) => Array.isArray(packet.driveProjectAssets) && packet.driveProjectAssets.length > 0),
    packets.map((packet) => `${packet.topic}: ${packet.driveProjectAssets?.length || 0}`).join("; ")
  );

  for (const packet of packets) {
    if (packet.draftPackage?.packageId) continue;
    const generated = await request("/api/admin/lesson-builder/generate", {
      method: "POST",
      json: generateBody(packet),
    });
    const pkg = generated.payload?.package || generated.payload?.bundle?.package;
    record(
      `template draft generation: ${packet.topic}`,
      generated.status === 200 && Boolean(pkg?.id),
      `status ${generated.status}, package ${pkg?.id || "missing"}`
    );
  }

  packetResult = await request("/api/admin/topic-production-matrix/build-packets?format=json");
  packets = targetPackets(packetResult.payload?.packets || []);
  assertRecord(
    "template drafts present",
    packets.every((packet) => packet.draftPackage?.packageId),
    packets.map((packet) => `${packet.topic}: ${packet.draftPackage?.packageId || "missing"}`).join("; ")
  );
  assertRecord(
    "draft package counts",
    packets.every((packet) => (
      packet.draftPackage?.slideCount >= 8
      && packet.draftPackage?.itemCount >= 1
      && packet.draftPackage?.citationCount >= 1
    )),
    packets.map((packet) => `${packet.topic}: ${packet.draftPackage?.slideCount || 0}/${packet.draftPackage?.itemCount || 0}/${packet.draftPackage?.citationCount || 0}`).join("; ")
  );
  assertRecord(
    "review checklist complete",
    packets.every((packet) => packet.draftPackage?.reviewPassedCount === packet.draftPackage?.reviewTotalCount),
    packets.map((packet) => `${packet.topic}: ${packet.draftPackage?.reviewPassedCount || 0}/${packet.draftPackage?.reviewTotalCount || 0}`).join("; ")
  );

  const draftReviewPack = await request("/api/admin/topic-production-matrix/draft-review-pack?format=json");
  const draftReviewRecords = Array.isArray(draftReviewPack.payload?.records) ? draftReviewPack.payload.records : [];
  const requiredReviewFields = [
    "Review Stage",
    "Template Draft Package ID",
    "Practice Stem",
    "Rationale",
    "Drive Project Assets",
    "Human Review Questions",
    "Cost Guardrail",
  ];
  assertRecord(
    "draft review pack API",
    draftReviewPack.status === 200 && draftReviewRecords.length >= 2,
    `status ${draftReviewPack.status}, ${draftReviewRecords.length} record(s)`
  );
  assertRecord(
    "draft review pack fields",
    draftReviewRecords.every((record) => requiredReviewFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredReviewFields.length} required review field(s)`
  );
  assertRecord(
    "draft review pack quality content",
    draftReviewRecords.every((record) => record["Practice Stem"] && record.Rationale && record["Cost Guardrail"]),
    draftReviewRecords.map((record) => record.Topic || "untitled").join("; ")
  );

  const draftReviewCsv = await request("/api/admin/topic-production-matrix/draft-review-pack?format=csv");
  const draftReviewHeader = String(draftReviewCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "draft review CSV fields",
    draftReviewCsv.status === 200
      && requiredReviewFields.every((field) => draftReviewHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${draftReviewCsv.status}, ${requiredReviewFields.length} required review field(s)`
  );

  for (const packet of packets) {
    const packageId = packet.draftPackage?.packageId;
    if (!packageId || packet.draftPackage?.nextSpendApproved) continue;
    const approved = await request(`/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/review`, {
      method: "PATCH",
      json: {
        decision: "approve_polish",
        reviewerNotes: "Launch smoke approves this deterministic template draft for the next $100-$250 review checkpoint.",
      },
    });
    record(`phase two approval: ${packet.topic}`, approved.status === 200 && isJson(approved), `status ${approved.status}`);
  }

  const nextSpend = await request("/api/admin/topic-production-matrix/next-spend-queue?format=json");
  const nextSpendPackets = targetPackets(nextSpend.payload?.packets || []);
  assertRecord("next spend queue", nextSpend.status === 200 && nextSpendPackets.length >= 2, `${nextSpendPackets.length} approved target packet(s)`);

  const shorts = await request("/api/admin/topic-production-matrix/shorts-workflow?format=json");
  const shortsRows = shorts.payload?.records || shorts.payload?.rows || shorts.payload || [];
  const records = Array.isArray(shortsRows) ? shortsRows : [];
  assertRecord("shorts workflow API", shorts.status === 200 && records.length >= 2, `${records.length} record(s)`);
  assertRecord(
    "shorts workflow fields",
    records.every((record) => record["Short Hook"] && record["Short Script Draft"] && record["Visual Brief"]),
    records.map((record) => record.Topic || "untitled").join("; ")
  );
  assertRecord(
    "shorts JSON matches Airtable contract",
    records.every((record) => requiredHeaders.every((header) => Object.prototype.hasOwnProperty.call(record, header))),
    `${requiredHeaders.length} required header(s)`
  );

  const shortsCsv = await request("/api/admin/topic-production-matrix/shorts-workflow?format=csv");
  const csvHeaderLine = String(shortsCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "shorts CSV matches Airtable contract",
    shortsCsv.status === 200
      && requiredHeaders.every((header) => csvHeaderLine.includes(`"${header.replace(/"/g, '""')}"`)),
    `status ${shortsCsv.status}, ${requiredHeaders.length} required header(s)`
  );

  const phaseThree = await request("/api/admin/topic-production-matrix/phase-3-handoff?format=json");
  const phaseThreeRecords = Array.isArray(phaseThree.payload?.records) ? phaseThree.payload.records : [];
  const requiredHandoffFields = [
    "Topic",
    "Template Draft Package ID",
    "Airtable Tracker Row",
    "Shorts Workflow Row",
    "Current Asset Coverage",
    "Immediate Human Decision",
    "Recorded Decision",
    "Next Owner Action",
    "Cost Guardrail",
  ];
  assertRecord(
    "phase 3 handoff API",
    phaseThree.status === 200 && phaseThreeRecords.length >= 2,
    `status ${phaseThree.status}, ${phaseThreeRecords.length} record(s)`
  );
  assertRecord(
    "phase 3 handoff fields",
    phaseThreeRecords.every((record) => requiredHandoffFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredHandoffFields.length} required handoff field(s)`
  );
  assertRecord(
    "phase 3 cost guardrails",
    phaseThreeRecords.every((record) => String(record["Cost Guardrail"] || "").includes("No batch generation")),
    phaseThreeRecords.map((record) => record.Topic || "untitled").join("; ")
  );

  const phaseThreeCsv = await request("/api/admin/topic-production-matrix/phase-3-handoff?format=csv");
  const phaseThreeHeader = String(phaseThreeCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "phase 3 CSV fields",
    phaseThreeCsv.status === 200
      && requiredHandoffFields.every((field) => phaseThreeHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${phaseThreeCsv.status}, ${requiredHandoffFields.length} required handoff field(s)`
  );

  const phaseThreeDecisions = ["approve_polish_pass", "approve_short_planning"];
  for (let index = 0; index < Math.min(phaseThreeRecords.length, phaseThreeDecisions.length); index += 1) {
    const recordRow = phaseThreeRecords[index];
    const packageId = recordRow["Template Draft Package ID"];
    const decision = phaseThreeDecisions[index];
    const savedDecision = await request(`/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/phase-3-decision`, {
      method: "PATCH",
      json: {
        decision,
        reviewerNotes: `Launch smoke records ${decision} as the next bounded Phase 3 action.`,
      },
    });
    record(`phase 3 decision save: ${recordRow.Topic}`, savedDecision.status === 200 && isJson(savedDecision), `status ${savedDecision.status}`);
  }

  const phaseThreeAfterDecision = await request("/api/admin/topic-production-matrix/phase-3-handoff?format=json");
  const phaseThreeDecisionRecords = Array.isArray(phaseThreeAfterDecision.payload?.records) ? phaseThreeAfterDecision.payload.records : [];
  assertRecord(
    "phase 3 decisions persist",
    phaseThreeAfterDecision.status === 200
      && phaseThreeDecisionRecords.slice(0, 2).every((record, index) => record["Recorded Decision"] === phaseThreeDecisions[index]),
    phaseThreeDecisionRecords.slice(0, 2).map((record) => `${record.Topic}: ${record["Recorded Decision"] || "missing"}`).join("; ")
  );

  const studentLaunch = await request("/api/admin/topic-production-matrix/student-launch-readiness?format=json");
  const studentLaunchRecords = Array.isArray(studentLaunch.payload?.records) ? studentLaunch.payload.records : [];
  const requiredStudentLaunchFields = [
    "Launch Gate Status",
    "Topic",
    "Template Draft Package ID",
    "Student Preview URL",
    "Public Visibility",
    "Student Launch Decision",
    "Preview Key Status",
    "Preview Review Outcome",
    "Preview Review Notes",
    "Preview Review Recorded At",
    "Phase 3 Decision",
    "Blockers",
    "Next Action",
    "Cost Guardrail",
  ];
  assertRecord(
    "student launch readiness API",
    studentLaunch.status === 200 && studentLaunchRecords.length >= 2,
    `status ${studentLaunch.status}, ${studentLaunchRecords.length} record(s)`
  );
  assertRecord(
    "student launch readiness fields",
    studentLaunchRecords.every((record) => requiredStudentLaunchFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredStudentLaunchFields.length} required launch field(s)`
  );
  assertRecord(
    "student launch no blockers after decisions",
    studentLaunchRecords.slice(0, 2).every((record) => !record.Blockers),
    studentLaunchRecords.slice(0, 2).map((record) => `${record.Topic}: ${record.Blockers || "none"}`).join("; ")
  );

  const studentLaunchCsv = await request("/api/admin/topic-production-matrix/student-launch-readiness?format=csv");
  const studentLaunchHeader = String(studentLaunchCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "student launch CSV fields",
    studentLaunchCsv.status === 200
      && requiredStudentLaunchFields.every((field) => studentLaunchHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${studentLaunchCsv.status}, ${requiredStudentLaunchFields.length} required launch field(s)`
  );

  for (const recordRow of studentLaunchRecords.slice(0, 2)) {
    const packageId = recordRow["Template Draft Package ID"];
    const savedDecision = await request(`/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/student-launch-decision`, {
      method: "PATCH",
      json: {
        decision: "approve_student_preview",
        reviewerNotes: "Launch smoke approves controlled student preview only; broad public publish remains separate.",
      },
    });
    record(`student launch decision save: ${recordRow.Topic}`, savedDecision.status === 200 && isJson(savedDecision), `status ${savedDecision.status}`);
  }

  const studentLaunchAfterDecision = await request("/api/admin/topic-production-matrix/student-launch-readiness?format=json");
  const studentLaunchDecisionRecords = Array.isArray(studentLaunchAfterDecision.payload?.records) ? studentLaunchAfterDecision.payload.records : [];
  const acceptedStudentLaunchStatuses = new Set(["approved_for_student_preview", "reviewed_ready_for_release", "published"]);
  assertRecord(
    "student launch decisions persist",
    studentLaunchAfterDecision.status === 200
      && studentLaunchDecisionRecords.slice(0, 2).every((record) => record["Student Launch Decision"] === "approve_student_preview")
      && studentLaunchDecisionRecords.slice(0, 2).every((record) => acceptedStudentLaunchStatuses.has(record["Launch Gate Status"])),
    studentLaunchDecisionRecords.slice(0, 2).map((record) => `${record.Topic}: ${record["Student Launch Decision"] || "missing"} / ${record["Launch Gate Status"] || "missing"}`).join("; ")
  );
  assertRecord(
    "controlled preview links generated",
    studentLaunchDecisionRecords.slice(0, 2).every((record) => {
      const previewUrl = String(record["Student Preview URL"] || "");
      const publicUrl = String(record["Public Lesson URL"] || "");
      return (previewUrl.includes("previewKey=") && record["Preview Key Status"] === "active")
        || (record["Launch Gate Status"] === "published" && (publicUrl.includes("/lessons/") || previewUrl.includes("/lessons/")));
    }),
    studentLaunchDecisionRecords.slice(0, 2).map((record) => `${record.Topic}: ${record["Student Preview URL"] || "missing"}`).join("; ")
  );

  for (const recordRow of studentLaunchDecisionRecords.slice(0, 2)) {
    const previewUrl = String(recordRow["Student Preview URL"] || "");
    const apiPreviewPath = previewUrl.replace(/^\/lessons\//, "/api/lessons/");
    const previewKey = new URL(`${baseUrl}${previewUrl}`).searchParams.get("previewKey");
    const isPublishedRow = recordRow["Launch Gate Status"] === "published" && !previewKey;
    const lessonPreview = await request(apiPreviewPath);
    assertRecord(
      `controlled preview lesson loads: ${recordRow.Topic}`,
      lessonPreview.status === 200
        && lessonPreview.payload?.package?.id === recordRow["Template Draft Package ID"]
        && Array.isArray(lessonPreview.payload?.slides)
        && lessonPreview.payload.slides.length >= 5,
      `status ${lessonPreview.status}`
    );
    assertRecord(
      `controlled preview review checklist: ${recordRow.Topic}`,
      isPublishedRow
        ? lessonPreview.payload?.package?.status === "published"
        : lessonPreview.payload?.package?.reviewSummary?.status === "ready_for_human_review"
          && lessonPreview.payload.package.reviewSummary.passedCount === lessonPreview.payload.package.reviewSummary.totalCount
          && lessonPreview.payload.package.reviewSummary.checklist?.length >= 5,
      lessonPreview.payload?.package?.reviewSummary
        ? `${lessonPreview.payload.package.reviewSummary.passedCount}/${lessonPreview.payload.package.reviewSummary.totalCount} checks`
        : `package status ${lessonPreview.payload?.package?.status || "missing"}`
    );
    if (previewKey) {
      const hiddenWithoutKey = await request(`/api/lessons/${encodeURIComponent(recordRow["Template Draft Package ID"])}`);
      assertRecord(
        `unpublished preview hidden without key: ${recordRow.Topic}`,
        hiddenWithoutKey.status === 404,
        `status ${hiddenWithoutKey.status}`
      );
    } else {
      assertRecord(
        `published preview public without key: ${recordRow.Topic}`,
        lessonPreview.status === 200 && lessonPreview.payload?.package?.status === "published",
        `status ${lessonPreview.status}`
      );
    }
    const sessionId = `preview-smoke-${String(recordRow.Topic || "topic").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
    const eventResult = await request(`/api/lessons/${encodeURIComponent(recordRow["Template Draft Package ID"])}/events`, {
      method: "POST",
      json: {
        sessionId,
        previewKey,
        eventType: "lesson_opened",
        payload: { source: "topic-production-launch-smoke" },
      },
    });
    record(`controlled preview event records: ${recordRow.Topic}`, eventResult.status === 200 && isJson(eventResult), `status ${eventResult.status}`);
    const feedbackResult = await request(`/api/lessons/${encodeURIComponent(recordRow["Template Draft Package ID"])}/feedback`, {
      method: "POST",
      json: {
        sessionId,
        previewKey,
        rating: "helpful",
        comment: "Controlled preview smoke feedback.",
      },
    });
    record(`controlled preview feedback records: ${recordRow.Topic}`, feedbackResult.status === 200 && isJson(feedbackResult), `status ${feedbackResult.status}`);
    if (previewKey) {
      const previewReviewResult = await request(`/api/lessons/${encodeURIComponent(recordRow["Template Draft Package ID"])}/preview-review`, {
        method: "POST",
        json: {
          previewKey,
          outcome: "ready_for_release",
          reviewerNotes: "Launch smoke reviewer marks this controlled preview ready for admin release review.",
        },
      });
      record(
        `controlled preview outcome records: ${recordRow.Topic}`,
        previewReviewResult.status === 200
          && isJson(previewReviewResult)
          && previewReviewResult.payload?.previewReview?.outcome === "ready_for_release",
        `status ${previewReviewResult.status}`
      );
    } else {
      record(`controlled preview outcome records: ${recordRow.Topic}`, isPublishedRow, "already published");
    }
  }

  const studentLaunchAfterPreviewReview = await request("/api/admin/topic-production-matrix/student-launch-readiness?format=json");
  const previewReviewRows = Array.isArray(studentLaunchAfterPreviewReview.payload?.records) ? studentLaunchAfterPreviewReview.payload.records : [];
  assertRecord(
    "preview review outcomes persist in launch gate",
    studentLaunchAfterPreviewReview.status === 200
      && previewReviewRows.slice(0, 2).every((record) => (
        record["Launch Gate Status"] === "published"
          || (record["Preview Review Outcome"] === "ready_for_release" && record["Launch Gate Status"] === "reviewed_ready_for_release")
      )),
    previewReviewRows.slice(0, 2).map((record) => `${record.Topic}: ${record["Preview Review Outcome"] || "missing"} / ${record["Launch Gate Status"] || "missing"}`).join("; ")
  );

  const publishReadiness = await request("/api/admin/topic-production-matrix/publish-readiness?format=json");
  const publishReadinessRecords = Array.isArray(publishReadiness.payload?.records) ? publishReadiness.payload.records : [];
  const requiredPublishFields = [
    "Publish Gate Status",
    "Topic",
    "Approved Work Order ID",
    "Template Draft Package ID",
    "Lesson Builder Publish URL",
    "Publish Endpoint",
    "Release Audit Endpoint",
    "Student Release QA Endpoint",
    "Preview Review Outcome",
    "Public Release Decision",
    "Public Release Notes",
    "Public Release Recorded At",
    "Publish Blockers",
    "Next Action",
    "Cost Guardrail",
  ];
  assertRecord(
    "publish readiness API",
    publishReadiness.status === 200 && publishReadinessRecords.length >= 2,
    `status ${publishReadiness.status}, ${publishReadinessRecords.length} record(s)`
  );
  assertRecord(
    "publish readiness fields",
    publishReadinessRecords.every((record) => requiredPublishFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))),
    `${requiredPublishFields.length} required publish field(s)`
  );
  assertRecord(
    "publish readiness requires release decision",
    publishReadinessRecords.slice(0, 2).every((record) => ["release_decision_needed", "published"].includes(record["Publish Gate Status"]))
      && publishReadinessRecords.slice(0, 2).every((record) => !record["Publish Blockers"])
      && publishReadinessRecords.slice(0, 2).every((record) => record["Publish Gate Status"] === "published" || !record["Publish Endpoint"]),
    publishReadinessRecords.slice(0, 2).map((record) => `${record.Topic}: ${record["Publish Gate Status"] || "missing"} / ${record["Public Release Decision"] || "missing"}`).join("; ")
  );

  const publishReadinessCsv = await request("/api/admin/topic-production-matrix/publish-readiness?format=csv");
  const publishReadinessHeader = String(publishReadinessCsv.payload || "").split(/\r?\n/)[0] || "";
  assertRecord(
    "publish readiness CSV fields",
    publishReadinessCsv.status === 200
      && requiredPublishFields.every((field) => publishReadinessHeader.includes(`"${field.replace(/"/g, '""')}"`)),
    `status ${publishReadinessCsv.status}, ${requiredPublishFields.length} required publish field(s)`
  );

  for (const recordRow of publishReadinessRecords.slice(0, 2)) {
    if (recordRow["Publish Gate Status"] === "published") {
      record(`phase 15 public release decision: ${recordRow.Topic}`, true, "already published");
      continue;
    }
    const workOrderId = String(recordRow["Approved Work Order ID"] || "");
    const packageId = String(recordRow["Template Draft Package ID"] || "");
    const endpoint = workOrderId
      ? `/api/admin/topic-production-matrix/review-package-builds/${encodeURIComponent(workOrderId)}/public-release-decision`
      : `/api/admin/topic-production-matrix/drafts/${encodeURIComponent(packageId)}/public-release-decision`;
    const releaseDecisionResult = await request(endpoint, {
      method: "PATCH",
      json: {
        decision: "approve_public_release",
        reviewerNotes: "Launch smoke approves the final public release gate for this single lesson only; media and batch production remain separate.",
      },
    });
    record(
      `phase 15 public release decision: ${recordRow.Topic}`,
      releaseDecisionResult.status === 200
        && isJson(releaseDecisionResult)
        && releaseDecisionResult.payload?.publicReleaseDecision?.decision === "approve_public_release"
        && releaseDecisionResult.payload?.publicReleaseGate?.publishStatus === "approved_for_public_publish"
        && releaseDecisionResult.payload?.publicReleaseGate?.mediaStatus === "not_started",
      `status ${releaseDecisionResult.status}`
    );
  }

  const publishReadinessAfterReleaseDecision = await request("/api/admin/topic-production-matrix/publish-readiness?format=json");
  const releaseApprovedPublishRows = Array.isArray(publishReadinessAfterReleaseDecision.payload?.records) ? publishReadinessAfterReleaseDecision.payload.records : [];
  assertRecord(
    "publish readiness after release decision",
    publishReadinessAfterReleaseDecision.status === 200
      && releaseApprovedPublishRows.slice(0, 2).every((record) => ["ready_for_public_publish", "published"].includes(record["Publish Gate Status"]))
      && releaseApprovedPublishRows.slice(0, 2).every((record) => record["Publish Gate Status"] === "published" || record["Public Release Decision"] === "approve_public_release")
      && releaseApprovedPublishRows.slice(0, 2).every((record) => record["Publish Gate Status"] === "published" || String(record["Publish Endpoint"] || "").includes("/publish")),
    releaseApprovedPublishRows.slice(0, 2).map((record) => `${record.Topic}: ${record["Publish Gate Status"] || "missing"} / ${record["Public Release Decision"] || "missing"}`).join("; ")
  );

  for (const recordRow of releaseApprovedPublishRows.slice(0, 2)) {
    const auditEndpoint = String(recordRow["Release Audit Endpoint"] || "");
    const auditSnapshot = auditEndpoint
      ? await request(auditEndpoint)
      : { status: 0, payload: null, contentType: "" };
    const alreadyPublishedAudit = recordRow["Publish Gate Status"] === "published";
    record(
      `phase 16 release audit snapshot: ${recordRow.Topic}`,
      auditSnapshot.status === 200
        && isJson(auditSnapshot)
        && auditSnapshot.payload?.phase === "phase_16_release_audit_snapshot"
        && auditSnapshot.payload?.package?.id === recordRow["Template Draft Package ID"]
        && auditSnapshot.payload?.publicContentInventory?.slideCount >= 5
        && auditSnapshot.payload?.publicContentInventory?.practiceItemCount >= 1
        && auditSnapshot.payload?.publicContentInventory?.citationCount >= 1
        && (alreadyPublishedAudit || auditSnapshot.payload?.decisions?.publicReleaseDecision?.decision === "approve_public_release")
        && auditSnapshot.payload?.publishReadiness?.status === (alreadyPublishedAudit ? "published" : "ready_for_public_publish")
        && /No public publish|No TTS|no rendered video|no paid visual|no batch production/i.test(String(auditSnapshot.payload?.costGuardrail || "")),
      `status ${auditSnapshot.status}`
    );
  }

  const publishCandidate = releaseApprovedPublishRows.find((record) => record["Publish Gate Status"] === "ready_for_public_publish" && record["Publish Endpoint"]);
  const publishPackageId = publishCandidate?.["Template Draft Package ID"];
  const publishEndpoint = publishCandidate?.["Publish Endpoint"];
  if (publishPackageId && publishEndpoint) {
    const publishWithoutConfirmation = await request(String(publishEndpoint), { method: "POST", json: {} });
    record(
      `phase 17 publish lock rejects missing confirmation: ${publishCandidate.Topic}`,
      publishWithoutConfirmation.status === 400
        && publishWithoutConfirmation.payload?.requiredConfirmationText === publicPublishConfirmationText,
      `status ${publishWithoutConfirmation.status}`
    );

    const publishResult = await request(String(publishEndpoint), {
      method: "POST",
      json: {
        confirmPublicPublish: true,
        confirmationText: publicPublishConfirmationText,
      },
    });
    const clinicalReviewBlocked = publishResult.status === 400
      && publishResult.payload?.error !== "Publish confirmation required";
    record(
      clinicalReviewBlocked
        ? `unreviewed publish blocked by release gates: ${publishCandidate.Topic}`
        : `final publish endpoint: ${publishCandidate.Topic}`,
      clinicalReviewBlocked || (
        publishResult.status === 200
          && publishResult.payload?.package?.status === "published"
          && publishResult.payload?.publishConfirmation?.confirmed === true
      ),
      `status ${publishResult.status}`
    );

    const publicLesson = await request(`/api/lessons/${encodeURIComponent(String(publishPackageId))}`);
    if (clinicalReviewBlocked) {
      assertRecord(
        `unreviewed package remains hidden: ${publishCandidate.Topic}`,
        publicLesson.status === 404,
        `status ${publicLesson.status}`
      );
      console.log(JSON.stringify({
        target: baseUrl,
        mode: "clinical_review_publish_guard",
        packageId: publishPackageId,
        releaseStage: publishResult.payload?.releaseStage || "clinical_review",
        checks: results,
      }, null, 2));
      return;
    }
    assertRecord(
      `public lesson loads after publish: ${publishCandidate.Topic}`,
      publicLesson.status === 200
        && publicLesson.payload?.package?.id === publishPackageId
        && publicLesson.payload?.package?.status === "published",
      `status ${publicLesson.status}`
    );

    const studentReleaseQaEndpoint = String(publishCandidate["Student Release QA Endpoint"] || `/api/admin/topic-production-matrix/drafts/${publishPackageId}/student-release-sanity`);
    const studentReleaseQa = await request(studentReleaseQaEndpoint);
    const studentReleaseChecks = Array.isArray(studentReleaseQa.payload?.checks) ? studentReleaseQa.payload.checks : [];
    assertRecord(
      `phase 18 public student release sanity: ${publishCandidate.Topic}`,
      studentReleaseQa.status === 200
        && studentReleaseQa.payload?.phase === "phase_18_public_student_release_sanity"
        && studentReleaseQa.payload?.package?.id === publishPackageId
        && studentReleaseQa.payload?.summary?.status === "pass"
        && studentReleaseQa.payload?.publicContentInventory?.slideCount >= 5
        && studentReleaseQa.payload?.publicContentInventory?.guidedNotesSlides >= 5
        && studentReleaseQa.payload?.publicContentInventory?.practiceItemCount >= 1
        && studentReleaseQa.payload?.publicContentInventory?.rationaleCount >= 1
        && studentReleaseQa.payload?.publicContentInventory?.citationCount >= 1
        && studentReleaseQa.payload?.studentLabels?.weakTopic
        && studentReleaseQa.payload?.studentLabels?.nclexCategory
        && studentReleaseQa.payload?.studentLabels?.cjmStep
        && studentReleaseQa.payload?.adminSafety?.forbiddenKeysFound?.length === 0
        && studentReleaseChecks.every((check) => check.passed === true),
      `status ${studentReleaseQa.status}, ${studentReleaseQa.payload?.summary?.status || "missing"}`
    );

    const publishReadinessAfterPublish = await request("/api/admin/topic-production-matrix/publish-readiness?format=json");
    const postPublishRows = Array.isArray(publishReadinessAfterPublish.payload?.records) ? publishReadinessAfterPublish.payload.records : [];
    const publishedRow = postPublishRows.find((record) => record["Template Draft Package ID"] === publishPackageId);
    assertRecord(
      `publish readiness records public lesson: ${publishCandidate.Topic}`,
      publishReadinessAfterPublish.status === 200
        && publishedRow?.["Publish Gate Status"] === "published"
        && String(publishedRow?.["Public Lesson URL"] || "").includes(`/lessons/${publishPackageId}`),
      publishedRow ? `${publishedRow["Publish Gate Status"] || "missing"} / ${publishedRow["Public Lesson URL"] || "missing"}` : "missing row"
    );
  } else {
    const publishedTargets = releaseApprovedPublishRows.slice(0, 2).filter((record) => record["Publish Gate Status"] === "published");
    record(
      "final publish candidate available",
      publishedTargets.length === Math.min(2, publishReadinessRecords.length),
      publishedTargets.length
        ? `${publishedTargets.length} target row(s) already published`
        : "no ready_for_public_publish row with Publish Endpoint"
    );
    for (const publishedTarget of publishedTargets) {
      const packageId = String(publishedTarget["Template Draft Package ID"] || "");
      const publicLesson = await request(`/api/lessons/${encodeURIComponent(packageId)}`);
      assertRecord(
        `public lesson already published: ${publishedTarget.Topic}`,
        publicLesson.status === 200
          && publicLesson.payload?.package?.id === packageId
          && publicLesson.payload?.package?.status === "published",
        `status ${publicLesson.status}`
      );
    }
  }

  const publicEntryPackageId = publishPackageId
    || releaseApprovedPublishRows.find((record) => record["Publish Gate Status"] === "published")?.["Template Draft Package ID"]
    || publishReadinessRecords.find((record) => record["Publish Gate Status"] === "published")?.["Template Draft Package ID"]
    || null;
  assertRecord(
    "phase 20 public entry package available",
    Boolean(publicEntryPackageId),
    publicEntryPackageId ? String(publicEntryPackageId) : "no published package id available for public entry"
  );
  const studentHome = await request("/api/student/home");
  const studentHomeLessons = Array.isArray(studentHome.payload?.lessons) ? studentHome.payload.lessons : [];
  const studentHomeLesson = studentHomeLessons.find((lesson) => lesson.id === publicEntryPackageId);
  const studentHomeTopicTiles = Array.isArray(studentHome.payload?.topicTiles) ? studentHome.payload.topicTiles : [];
  assertRecord(
    "phase 20 student home exposes published lesson",
    studentHome.status === 200
      && isJson(studentHome)
      && studentHome.payload?.featuredLesson
      && studentHome.payload?.metrics?.publishedLessons >= 1
      && Boolean(studentHomeLesson)
      && studentHomeLesson.learnerUrl === `/lessons/${publicEntryPackageId}`,
    `status ${studentHome.status}, ${studentHomeLessons.length} lesson(s)`
  );
  assertRecord(
    "phase 20 student home learner labels",
    Boolean(studentHomeLesson)
      && Boolean(studentHomeLesson.weakTopic)
      && Boolean(studentHomeLesson.nclexCategory)
      && Boolean(studentHomeLesson.cjmStep)
      && studentHomeLesson.slideCount >= 5
      && studentHomeLesson.practiceCount >= 1
      && studentHomeLesson.citationCount >= 1
      && studentHomeLesson.guidedNotesAvailable === true
      && studentHomeLesson.trustSignals?.sourceBacked === true
      && studentHomeLesson.trustSignals?.rationales === true,
    studentHomeLesson
      ? `${studentHomeLesson.weakTopic || "missing"} / ${studentHomeLesson.nclexCategory || "missing"} / ${studentHomeLesson.cjmStep || "missing"}`
      : "missing student home lesson"
  );
  assertRecord(
    "phase 20 student home topic tiles",
    studentHomeTopicTiles.length >= 1
      && studentHomeTopicTiles.some((tile) => tile.label === studentHomeLesson?.weakTopic || tile.label === studentHomeLesson?.subject),
    studentHomeTopicTiles.map((tile) => `${tile.label}: ${tile.count}`).join("; ")
  );
  const studentLibrary = await request("/api/student/lessons");
  const studentLibraryLessons = Array.isArray(studentLibrary.payload?.lessons) ? studentLibrary.payload.lessons : [];
  const studentLibraryLesson = studentLibraryLessons.find((lesson) => lesson.id === publicEntryPackageId);
  assertRecord(
    "phase 20 student library handoff",
    studentLibrary.status === 200
      && isJson(studentLibrary)
      && Boolean(studentLibraryLesson)
      && studentLibraryLesson.learnerUrl === `/lessons/${publicEntryPackageId}`
      && studentLibraryLesson.trustSignals?.guidedNotes === true,
    `status ${studentLibrary.status}, ${studentLibraryLessons.length} lesson(s)`
  );

  const workspacePublicLesson = await request(`/api/lessons/${encodeURIComponent(String(publicEntryPackageId))}`);
  const workspacePracticeItems = Array.isArray(workspacePublicLesson.payload?.practiceItems)
    ? workspacePublicLesson.payload.practiceItems
    : Array.isArray(workspacePublicLesson.payload?.items)
      ? workspacePublicLesson.payload.items
      : [];
  assertRecord(
    "phase 21 public lesson source loads",
    workspacePublicLesson.status === 200
      && workspacePublicLesson.payload?.package?.id === publicEntryPackageId
      && workspacePracticeItems.length >= 1,
    `status ${workspacePublicLesson.status}`
  );
  const workspaceSessionId = `launch-smoke-${Date.now()}`;
  const workspacePracticeItem = workspacePracticeItems[0] || {};
  const workspaceItemId = String(workspacePracticeItem.id || studentLibraryLesson?.id || "item-1");
  const workspaceEvents = [
    ["lesson_saved", { source: "phase_21_smoke" }],
    ["lesson_opened", { source: "phase_21_smoke" }],
    ["slide_viewed", { slideNumber: 1, source: "phase_21_smoke" }],
    ["practice_attempted", {
      itemId: workspaceItemId,
      selectedAnswer: "A",
      correctAnswer: String(workspacePracticeItem.correctAnswer || "A"),
      isCorrect: true,
      difficulty: String(workspacePracticeItem.difficulty || "application"),
      source: "phase_21_smoke",
    }],
    ["lesson_completed", { source: "phase_21_smoke" }],
  ];
  for (const [eventType, payload] of workspaceEvents) {
    const eventResult = await request(`/api/lessons/${encodeURIComponent(String(publicEntryPackageId))}/events`, {
      method: "POST",
      json: {
        sessionId: workspaceSessionId,
        eventType,
        itemId: eventType === "practice_attempted" ? workspaceItemId : undefined,
        payload,
      },
    });
    assertRecord(
      `phase 21 workspace event records: ${eventType}`,
      eventResult.status === 200 && eventResult.payload?.recorded === true && eventResult.payload?.sessionId === workspaceSessionId,
      `status ${eventResult.status}`
    );
  }
  const workspaceFeedback = await request(`/api/lessons/${encodeURIComponent(String(publicEntryPackageId))}/feedback`, {
    method: "POST",
    json: {
      sessionId: workspaceSessionId,
      rating: "helpful",
      itemId: workspaceItemId,
      comment: "Launch smoke feedback confirms the student workspace loop.",
      payload: { source: "phase_21_smoke" },
    },
  });
  assertRecord(
    "phase 21 workspace feedback records",
    workspaceFeedback.status === 200
      && workspaceFeedback.payload?.recorded === true
      && workspaceFeedback.payload?.sessionId === workspaceSessionId,
    `status ${workspaceFeedback.status}`
  );

  const workspaceProgress = await request(`/api/student/progress?sessionId=${encodeURIComponent(workspaceSessionId)}`);
  assertRecord(
    "phase 21 student progress reflects events",
    workspaceProgress.status === 200
      && isJson(workspaceProgress)
      && workspaceProgress.payload?.totals?.savedLessons >= 1
      && workspaceProgress.payload?.totals?.openedLessons >= 1
      && workspaceProgress.payload?.totals?.completedLessons >= 1
      && workspaceProgress.payload?.totals?.practiceAttempts >= 1
      && workspaceProgress.payload?.totals?.feedbackSubmitted >= 1
      && workspaceProgress.payload?.continueLesson?.learnerUrl === `/lessons/${publicEntryPackageId}`,
    `status ${workspaceProgress.status}, totals ${JSON.stringify(workspaceProgress.payload?.totals || {})}`
  );

  const workspaceStudyPack = await request(`/api/student/study-pack?sessionId=${encodeURIComponent(workspaceSessionId)}`);
  assertRecord(
    "phase 21 study pack compiles saved lesson",
    workspaceStudyPack.status === 200
      && isJson(workspaceStudyPack)
      && workspaceStudyPack.payload?.totals?.lessons >= 1
      && workspaceStudyPack.payload?.totals?.guidedNotes >= 5
      && workspaceStudyPack.payload?.totals?.practiceItems >= 1
      && workspaceStudyPack.payload?.totals?.citations >= 1
      && Array.isArray(workspaceStudyPack.payload?.lessons)
      && workspaceStudyPack.payload.lessons.some((lesson) => lesson.summary?.id === publicEntryPackageId && lesson.summary?.learnerUrl === `/lessons/${publicEntryPackageId}`),
    `status ${workspaceStudyPack.status}, totals ${JSON.stringify(workspaceStudyPack.payload?.totals || {})}`
  );

  const summary = {
    target: baseUrl,
    driveProject: matrix.payload.driveProject.title,
    driveAssets: matrix.payload.driveProject.assetCount,
    airtableTracker: {
      tableName: tracker.tableName,
      fields: tracker.fields.length,
      requiredCsvHeaders: requiredHeaders.length,
    },
    draftReviewPack: {
      records: draftReviewRecords.length,
      requiredFields: requiredReviewFields.length,
    },
    phaseThreeHandoff: {
      records: phaseThreeDecisionRecords.length || phaseThreeRecords.length,
      requiredFields: requiredHandoffFields.length,
      recordedDecisions: phaseThreeDecisionRecords.slice(0, 2).map((record) => record["Recorded Decision"] || "unreviewed"),
    },
    humanReviewPack: {
      records: humanReviewDecisionRecords.length || humanReviewRecords.length,
      requiredFields: requiredHumanReviewFields.length,
      approvedPlacementTopics: humanReviewDecisionRecords
        .filter((record) => record["Review Decision"] === "approve_mapping")
        .map((record) => record.Topic),
    },
    mediaPilotPack: {
      records: mediaPilotRecords.length,
      requiredFields: requiredMediaPilotFields.length,
      pilotTopics: mediaPilotRecords.map((record) => record.Topic),
      videoStatuses: mediaPilotRecords.map((record) => record["Video Status"] || "missing"),
    },
    mediaWorkOrders: {
      records: mediaWorkOrderDecisionRecords.length || mediaWorkOrderRecords.length,
      requiredFields: requiredMediaWorkOrderFields.length,
      estimatedDollarsPerTopic: mediaWorkOrders.payload?.estimatedDollarsPerTopic,
      approvalStatuses: (mediaWorkOrderDecisionRecords.length ? mediaWorkOrderDecisionRecords : mediaWorkOrderRecords).map((record) => record["Approval Status"] || "missing"),
      reviewDecisions: (mediaWorkOrderDecisionRecords.length ? mediaWorkOrderDecisionRecords : mediaWorkOrderRecords).map((record) => record["Work Order Review Decision"] || "missing"),
    },
    mediaScaffoldPack: {
      records: mediaScaffoldReviewRecords.length || mediaScaffoldRecords.length,
      requiredFields: requiredMediaScaffoldFields.length,
      scaffoldTopics: (mediaScaffoldReviewRecords.length ? mediaScaffoldReviewRecords : mediaScaffoldRecords).map((record) => record.Topic),
      reviewDecisions: (mediaScaffoldReviewRecords.length ? mediaScaffoldReviewRecords : mediaScaffoldRecords).map((record) => record["Scaffold Review Decision"] || "missing"),
    },
    mediaTextDraftPack: {
      records: mediaTextDraftReviewRecords.length || mediaTextDraftRecords.length,
      requiredFields: requiredMediaTextDraftFields.length,
      draftTopics: (mediaTextDraftReviewRecords.length ? mediaTextDraftReviewRecords : mediaTextDraftRecords).map((record) => record.Topic),
      reviewDecisions: (mediaTextDraftReviewRecords.length ? mediaTextDraftReviewRecords : mediaTextDraftRecords).map((record) => record["Text Draft Review Decision"] || "missing"),
    },
    packageAssemblyPack: {
      records: packageAssemblyRecords.length,
      requiredFields: requiredPackageAssemblyFields.length,
      assemblyTopics: packageAssemblyRecords.map((record) => record.Topic),
      reviewGates: packageAssemblyRecords.map((record) => record["Review Gate"] || "missing"),
    },
    packageReviewBlueprint: {
      records: packageReviewBlueprintDecisionRecords.length || packageReviewBlueprintRecords.length,
      requiredFields: requiredPackageReviewBlueprintFields.length,
      blueprintTopics: (packageReviewBlueprintDecisionRecords.length ? packageReviewBlueprintDecisionRecords : packageReviewBlueprintRecords).map((record) => record.Topic),
      reviewDecisions: (packageReviewBlueprintDecisionRecords.length ? packageReviewBlueprintDecisionRecords : packageReviewBlueprintRecords).map((record) => record["Blueprint Review Decision"] || "missing"),
      stopConditions: (packageReviewBlueprintDecisionRecords.length ? packageReviewBlueprintDecisionRecords : packageReviewBlueprintRecords).map((record) => record["Stop Conditions"] || "missing"),
    },
    reviewPackageBuilds: {
      records: reviewPackageBuildRecords.length,
      requiredFields: requiredReviewPackageBuildFields.length,
      buildTopics: reviewPackageBuildRecords.map((record) => record.Topic),
      bundleFiles: reviewPackageBuildRecords.map((record) => record["Bundle Files"] || "missing"),
      promotedPackageId: promotedPackageId || null,
      creatorQaStatus: creatorQaStatus || null,
      previewReviewOutcome: phase14PreviewReview.payload?.controlledPreviewReview?.outcome || null,
    },
    studentLaunchReadiness: {
      records: studentLaunchDecisionRecords.length || studentLaunchRecords.length,
      requiredFields: requiredStudentLaunchFields.length,
      recordedDecisions: studentLaunchDecisionRecords.slice(0, 2).map((record) => record["Student Launch Decision"] || "unreviewed"),
    },
    publishReadiness: {
      records: releaseApprovedPublishRows.length || publishReadinessRecords.length,
      requiredFields: requiredPublishFields.length,
      firstStatuses: (releaseApprovedPublishRows.length ? releaseApprovedPublishRows : publishReadinessRecords).slice(0, 2).map((record) => record["Publish Gate Status"] || "missing"),
      releaseDecisions: (releaseApprovedPublishRows.length ? releaseApprovedPublishRows : publishReadinessRecords).slice(0, 2).map((record) => record["Public Release Decision"] || "missing"),
      auditEndpoints: (releaseApprovedPublishRows.length ? releaseApprovedPublishRows : publishReadinessRecords).slice(0, 2).map((record) => record["Release Audit Endpoint"] || "missing"),
      studentReleaseQaEndpoints: (releaseApprovedPublishRows.length ? releaseApprovedPublishRows : publishReadinessRecords).slice(0, 2).map((record) => record["Student Release QA Endpoint"] || "missing"),
      publishedPackageId: publishPackageId || null,
      publishConfirmation: publishPackageId ? "required_and_confirmed" : "not_exercised",
    },
    publicStudentEntry: {
      packageId: publicEntryPackageId,
      homeLessons: studentHomeLessons.length,
      libraryLessons: studentLibraryLessons.length,
      topicTiles: studentHomeTopicTiles.length,
      learnerUrl: studentHomeLesson?.learnerUrl || studentLibraryLesson?.learnerUrl || null,
    },
    studentWorkspace: {
      sessionId: workspaceSessionId,
      totals: workspaceProgress.payload?.totals || null,
      studyPackTotals: workspaceStudyPack.payload?.totals || null,
    },
    phaseTwoCatalog: {
      totalTopics: matrix.payload?.summary?.totalTopics || 0,
      candidateRows: matrix.payload?.summary?.candidateRows || 0,
      candidateTopics: phaseTwoCandidates.map((row) => row.topic),
    },
    packets: packets.map((packet) => ({
      topic: packet.topic,
      draftPackageId: packet.draftPackage?.packageId,
      driveAssets: (packet.driveProjectAssets || []).map((asset) => asset.title),
      counts: {
        slides: packet.draftPackage?.slideCount || 0,
        quizItems: packet.draftPackage?.itemCount || 0,
        citations: packet.draftPackage?.citationCount || 0,
      },
    })),
    checks: results,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (results.some((result) => result.status === "fail")) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Topic-production launch smoke failed.");
  console.error(error.message || error);
  const priorResults = error.results || results;
  if (priorResults.length) console.error(JSON.stringify({ checks: priorResults }, null, 2));
  process.exitCode = 1;
});
