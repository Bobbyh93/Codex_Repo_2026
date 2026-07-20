import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { EXEMPLAR_TOPICS, NCLEX_CATEGORIES, buildExemplarPackage, validateExemplarPackage } from "../../shared/nclex-rn-2026";
import { buildDirectedRemediationPlan, remediationBand } from "../directed-remediation-engine";
import {
  canvasOutcomesCsv,
  commonCartridgeArchive,
  curriculumManifest,
  executionStatus,
  qtiAssessmentXml,
  validateCurriculum,
} from "../nclex-curriculum-service";

describe("NCLEX-RN 2026 curriculum contract", () => {
  it("represents all eight client-needs categories", () => {
    const represented = new Set(EXEMPLAR_TOPICS.map((topic) => topic.categoryId));
    expect(represented.size).toBe(8);
    expect(NCLEX_CATEGORIES.every((category) => represented.has(category.id))).toBe(true);
  });

  it("keeps generated exemplars in licensed clinical review", () => {
    for (const topic of EXEMPLAR_TOPICS) {
      const pkg = buildExemplarPackage(topic);
      expect(pkg.releaseStage).toBe("clinical_review");
      expect(pkg.clinicalReviewRequired).toBe(true);
      expect(pkg.assessmentItems).toHaveLength(15);
      expect(pkg.clinicalJudgmentCase).toHaveLength(6);
      expect(pkg.assessmentItems.every((item) => item.rationale && item.sourceId && item.locator)).toBe(true);
    }
  });

  it("passes coverage, provenance, and content validation", () => {
    const result = validateCurriculum();
    expect(result.valid, result.issues.join("\n")).toBe(true);
    expect(result.content.assessmentItems).toBe(120);
    expect(result.content.clinicalJudgmentItems).toBe(48);
    expect(result.content.approved).toBe(0);
    expect(result.content.awaitingClinicalReview).toBe(8);
  });

  it("describes legacy migration without treating ATI as content", () => {
    const manifest = curriculumManifest();
    expect(manifest.compatibility.legacyTopicCount).toBe(77);
    expect(manifest.compatibility.maternalNewbornMigrationRows).toBe(94);
    expect(manifest.compatibility.atiPolicy).toContain("Aliases");
  });

  it("blocks pending evidence and broken objective mappings", () => {
    const pendingSource = structuredClone(buildExemplarPackage(EXEMPLAR_TOPICS[0]));
    pendingSource.sources[0].approvalStatus = "pending";
    expect(validateExemplarPackage(pendingSource).issues).toContain("Pending evidence sources cannot support a clinical-review package.");

    const orphanedObjective = structuredClone(buildExemplarPackage(EXEMPLAR_TOPICS[0]));
    orphanedObjective.assessmentItems[0].objectiveId = "missing-objective";
    expect(validateExemplarPackage(orphanedObjective).issues).toContain("Every assessment item must reference a package objective.");
  });
});

describe("directed remediation", () => {
  it.each([
    [59.99, "foundational_intensive"],
    [60, "targeted_remediation"],
    [74.99, "targeted_remediation"],
    [75, "focused_reinforcement"],
    [84.99, "focused_reinforcement"],
    [85, "mastered"],
  ])("maps %s to %s", (score, expected) => {
    expect(remediationBand(score)).toBe(expected);
  });

  it("ranks high-risk performance gaps and records the algorithm audit", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const plan = buildDirectedRemediationPlan("learner-1", [
      { objectiveId: "pa-sepsis-recognition-objective-1", topicId: "pa-sepsis-recognition", score: 48, confidence: 0.95, observedAt: now.toISOString(), sourceKind: "quiz" },
      { objectiveId: "bcc-pressure-injury-prevention-objective-1", topicId: "bcc-pressure-injury-prevention", score: 80, confidence: 0.95, observedAt: now.toISOString(), sourceKind: "generic_csv" },
    ], now);
    expect(plan.recommendations[0].topicId).toBe("pa-sepsis-recognition");
    expect(plan.algorithmVersion).toBe("directed-remediation-v1");
    expect(plan.audit.weights.gapSeverity).toBe(0.45);
  });

  it("uses a broad diagnostic when confidence is low", () => {
    const plan = buildDirectedRemediationPlan("learner-2", [
      { objectiveId: "moc-safe-delegation-objective-1", topicId: "moc-safe-delegation", score: 40, confidence: 0.4, observedAt: "2026-07-19T12:00:00.000Z", sourceKind: "ati_alias_report" },
    ], new Date("2026-07-19T12:00:00.000Z"));
    expect(plan.recommendations[0].lowConfidenceDiagnostic).toBe(true);
    expect(plan.recommendations[0].reasons[0]).toContain("broader diagnostic");
  });
});

describe("Canvas-portable exports", () => {
  it("builds outcomes CSV and QTI with every exemplar item", () => {
    const csv = canvasOutcomesCsv();
    expect(csv).toContain("vendor_guid");
    expect(csv).toContain("nclex-rn-2026:management-of-care");
    const qti = qtiAssessmentXml();
    expect(qti.match(/<assessmentItem /g)).toHaveLength(120);
  });

  it("builds a Common Cartridge containing manifest and modules", async () => {
    const archive = await commonCartridgeArchive();
    const zip = await JSZip.loadAsync(archive);
    expect(zip.file("imsmanifest.xml")).toBeTruthy();
    expect(zip.file("curriculum-manifest.json")).toBeTruthy();
    expect(zip.file("modules/pa-sepsis-recognition.html")).toBeTruthy();
    const moduleHtml = await zip.file("modules/pa-sepsis-recognition.html")!.async("string");
    expect(moduleHtml).toContain('lang="en-US"');
    expect(moduleHtml).toContain('href="#lesson-content"');
  });

  it("publishes only aggregate, non-sensitive execution status", () => {
    const status = executionStatus();
    expect(status.reviewQueue.awaitingLicensedRn).toBe(8);
    expect(status.privacy).toContain("no learner or patient data");
    expect(JSON.stringify(status)).not.toContain("learnerKey");
  });
});
