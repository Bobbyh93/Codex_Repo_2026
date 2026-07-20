import {
  EXEMPLAR_TOPICS,
  NCLEX_CATEGORIES,
  NCLEX_FRAMEWORK_ID,
  REMEDIATION_ALGORITHM_VERSION,
  type SafetyRisk,
} from "../shared/nclex-rn-2026";

export interface PerformanceSignal {
  objectiveId: string;
  topicId: string;
  score: number;
  confidence: number;
  observedAt: string;
  frequency?: number;
  sourceKind: "generic_csv" | "ati_alias_report" | "canvas_outcome" | "quiz";
}

export type RemediationBand = "foundational_intensive" | "targeted_remediation" | "focused_reinforcement" | "mastered";

export interface DirectedRecommendation {
  objectiveId: string;
  topicId: string;
  band: RemediationBand;
  priorityScore: number;
  masteryThreshold: 85;
  lowConfidenceDiagnostic: boolean;
  reasons: string[];
}

const safetyWeight: Record<SafetyRisk, number> = { standard: 0.35, elevated: 0.7, high: 1 };

export function remediationBand(score: number): RemediationBand {
  if (score < 60) return "foundational_intensive";
  if (score < 75) return "targeted_remediation";
  if (score < 85) return "focused_reinforcement";
  return "mastered";
}

function recencyFrequency(signal: PerformanceSignal, now: Date) {
  const ageDays = Math.max(0, (now.getTime() - new Date(signal.observedAt).getTime()) / 86_400_000);
  const recency = Math.max(0, 1 - ageDays / 180);
  const frequency = Math.min(1, Math.max(1, signal.frequency || 1) / 5);
  return (recency + frequency) / 2;
}

export function buildDirectedRemediationPlan(
  learnerKey: string,
  signals: PerformanceSignal[],
  now = new Date(),
) {
  const recommendations: DirectedRecommendation[] = signals.map((signal) => {
    const topic = EXEMPLAR_TOPICS.find((entry) => entry.id === signal.topicId);
    const category = NCLEX_CATEGORIES.find((entry) => entry.id === topic?.categoryId);
    const confidence = Math.min(1, Math.max(0, signal.confidence));
    const gapSeverity = Math.max(0, 85 - signal.score) / 85;
    const blueprint = (category?.blueprintWeight || 0) / 100;
    const risk = safetyWeight[topic?.safetyRisk || "standard"];
    const evidenceTiming = recencyFrequency(signal, now);
    const lowConfidenceDiagnostic = confidence < 0.6;
    const rawPriority = lowConfidenceDiagnostic
      ? 0.25 + gapSeverity * 0.2
      : gapSeverity * 0.45 + blueprint * 0.25 + risk * 0.2 + evidenceTiming * 0.1;
    const band = lowConfidenceDiagnostic ? "targeted_remediation" : remediationBand(signal.score);

    return {
      objectiveId: signal.objectiveId,
      topicId: signal.topicId,
      band,
      priorityScore: Number((rawPriority * 100).toFixed(2)),
      masteryThreshold: 85 as const,
      lowConfidenceDiagnostic,
      reasons: lowConfidenceDiagnostic
        ? ["Evidence confidence is below 0.60; assign a broader diagnostic before precise remediation."]
        : [
          `Performance gap contributes 45% (${signal.score.toFixed(1)}% observed).`,
          `NCLEX blueprint weight contributes 25% (${category?.blueprintWeight || 0}% category midpoint).`,
          `Clinical safety risk contributes 20% (${topic?.safetyRisk || "standard"}).`,
          "Evidence recency and frequency contribute 10%.",
        ],
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    id: `${learnerKey}-${now.toISOString()}`,
    learnerKey,
    frameworkId: NCLEX_FRAMEWORK_ID,
    algorithmVersion: REMEDIATION_ALGORITHM_VERSION,
    createdAt: now.toISOString(),
    masteryThreshold: 85,
    recommendations,
    audit: {
      weights: { gapSeverity: 0.45, blueprintWeight: 0.25, clinicalSafetyRisk: 0.2, recencyFrequency: 0.1 },
      bands: { foundationalIntensive: "<60", targetedRemediation: "60-74", focusedReinforcement: "75-84", mastered: ">=85" },
      lowConfidenceThreshold: 0.6,
      completionRule: "A failed mastery check loops to the smallest failed objective branch; 85% unlocks the next ranked objective.",
    },
  };
}
