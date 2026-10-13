import { describe, expect, it } from "vitest";
import {
  defaultGovernanceRecord,
  evaluateGovernance,
  invalidateApprovals,
  type GovernanceGate,
  type GovernanceRecordV1,
} from "../../shared/lesson-governance";

const fingerprint = "a".repeat(64);
const fingerprints = Object.fromEntries(["taxonomy", "objectives", "outline", "script", "accessibility"].map((gate) => [gate, fingerprint])) as Record<GovernanceGate, string>;

function readyRecord(): GovernanceRecordV1 {
  const record = defaultGovernanceRecord("PKG-1", ["SLIDE-1"]);
  record.lessonId = "LESSON-1";
  record.administrative = { courseId: "NUR-1", courseName: "Nursing", programLevel: "Prelicensure RN", contentOwner: "Owner", facultyReviewer: "Reviewer" };
  record.sourceGovernance = { organizingClinicalQuestion: "What is the priority response?", coverageComplete: true };
  record.taxonomy = {
    concept: "Communication", nclexClientNeed: "Psychosocial Integrity", bodySystem: "Psychosocial",
    priorityFramework: "Assessment first", bloomLevels: ["Apply"], qsenDomains: ["Patient-Centered Care"],
    aacnCompetencies: ["Domain 2"], ncjmmFunctions: ["Recognize Cues"],
  };
  record.learningOutcomes = [{ objectiveId: "LO-01", statement: "Select the priority response.", bloomLevel: "Apply", assessmentMethod: "Case item" }];
  record.slideTraceability = [{
    slideId: "SLIDE-1", objectiveIds: ["LO-01"],
    accessibility: { readingOrderChecked: true, contrastChecked: true, meaningNotColorOnly: true, transcriptAvailable: true },
  }];
  record.taxonomyStatus = "locked";
  record.approvals = (["taxonomy", "objectives", "outline", "script", "accessibility"] as GovernanceGate[]).map((gate) => ({
    gate, decision: "approved" as const, note: "Reviewed and approved.", actorId: "ADMIN-1", actorLabel: "Admin", decidedAt: new Date().toISOString(), fingerprint,
  }));
  return record;
}

const readyContext = {
  sourceStatuses: ["approved"], slideIds: ["SLIDE-1"], citedSlideIds: ["SLIDE-1"], unknownSourceReferenceIds: [], failedQaCount: 0,
  mediaReady: true, playbackPassed: true, facultyPilotApproved: true, facultyReleaseApproved: true,
  facultyReviewFingerprint: fingerprint, releaseReviewFingerprint: fingerprint,
};

describe("lesson governance", () => {
  it("fails closed for a new package", () => {
    const evaluation = evaluateGovernance(defaultGovernanceRecord("PKG-1", ["SLIDE-1"]), fingerprint, { ...readyContext, sourceStatuses: [] }, fingerprints);
    expect(evaluation.stages.every((stage) => stage.status === "blocked")).toBe(true);
    expect(evaluation.blockers.some((blocker) => blocker.code === "source_approval")).toBe(true);
  });

  it("passes all gates only with current approvals and RN release evidence", () => {
    const evaluation = evaluateGovernance(readyRecord(), fingerprint, readyContext, fingerprints);
    expect(evaluation.stages.at(-1)?.status).toBe("pass");
  });

  it("rejects stale approvals", () => {
    const evaluation = evaluateGovernance(readyRecord(), "b".repeat(64), readyContext, Object.fromEntries(Object.keys(fingerprints).map((gate) => [gate, "b".repeat(64)])) as Record<GovernanceGate, string>);
    expect(evaluation.currentApprovals.taxonomy).toBe(false);
    expect(evaluation.stages.find((stage) => stage.key === "production_ready")?.status).toBe("blocked");
  });

  it("does not accept client content as source approval", () => {
    const evaluation = evaluateGovernance(readyRecord(), fingerprint, { ...readyContext, sourceStatuses: ["pending"] }, fingerprints);
    expect(evaluation.blockers.some((blocker) => blocker.code === "source_approval")).toBe(true);
  });

  it("fails closed for missing mappings and unknown source IDs", () => {
    const record = readyRecord();
    record.slideTraceability[0].objectiveIds = [];
    const evaluation = evaluateGovernance(record, fingerprint, { ...readyContext, unknownSourceReferenceIds: ["SRC-UNKNOWN"] }, fingerprints);
    expect(evaluation.blockers.some((blocker) => blocker.code === "missing_objective_mapping")).toBe(true);
    expect(evaluation.blockers.some((blocker) => blocker.code === "unknown_source")).toBe(true);
  });

  it("invalidates the changed gate and downstream approvals", () => {
    const remaining = invalidateApprovals(readyRecord().approvals, ["objectives"]);
    expect(remaining.map((approval) => approval.gate)).toEqual(["taxonomy"]);
  });

  it("blocks release without current licensed-RN review evidence", () => {
    const evaluation = evaluateGovernance(readyRecord(), fingerprint, { ...readyContext, facultyReleaseApproved: false }, fingerprints);
    expect(evaluation.blockers.some((blocker) => blocker.code === "licensed_rn_release")).toBe(true);
  });
});
