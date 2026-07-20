interface StudyPlanData {
  topics: Array<{
    name: string;
    score: number;
    category: string;
    priority: string;
    estimatedTime: number;
    resources: Array<{
      type: string;
      title: string;
      duration: number;
    }>;
  }>;
  totalTime: number;
  focusAreas: string[];
}

export function generateStudyPlanCSV(data: StudyPlanData): string {
  const rows: string[] = [];
  
  // Header
  rows.push("NursePrep Analytics - Study Plan Export");
  rows.push(`Generated: ${new Date().toLocaleDateString()}`);
  rows.push(`Total Study Time: ${Math.round(data.totalTime / 60)} hours`);
  rows.push(`Focus Areas: ${data.focusAreas.join(", ")}`);
  rows.push("");
  
  // Column headers
  rows.push("Topic,Current Score,Category,Priority,Study Time (min),Resource Type,Resource Title,Duration (min)");
  
  // Data rows
  for (const topic of data.topics) {
    // First resource row includes topic info
    if (topic.resources.length > 0) {
      const firstResource = topic.resources[0];
      rows.push([
        topic.name,
        topic.score.toString(),
        topic.category,
        topic.priority,
        topic.estimatedTime.toString(),
        firstResource.type,
        firstResource.title,
        firstResource.duration.toString()
      ].join(","));
      
      // Additional resources for the same topic
      for (let i = 1; i < topic.resources.length; i++) {
        const resource = topic.resources[i];
        rows.push([
          "", // Empty topic columns
          "",
          "",
          "",
          "",
          resource.type,
          resource.title,
          resource.duration.toString()
        ].join(","));
      }
    } else {
      // Topic without resources
      rows.push([
        topic.name,
        topic.score.toString(),
        topic.category,
        topic.priority,
        topic.estimatedTime.toString(),
        "No resources available",
        "",
        ""
      ].join(","));
    }
  }
  
  rows.push("");
  rows.push("Summary Statistics");
  rows.push(`Topics Needing Improvement: ${data.topics.filter(t => t.score < 75).length}`);
  rows.push(`High Priority Topics: ${data.topics.filter(t => t.priority === "high").length}`);
  rows.push(`Average Score: ${Math.round(data.topics.reduce((sum, t) => sum + t.score, 0) / data.topics.length)}%`);
  
  return rows.join("\n");
}

export function generateDiagnosisTrackingCSV(diagnoses: Array<{
  diagnosis: string;
  system: string;
  vitalBaselines: Array<{
    parameter: string;
    baseline: string;
    alertThreshold: string;
  }>;
  labBaselines: Array<{
    test: string;
    expectedValue: string;
    criticalValue: string;
  }>;
}>): string {
  const rows: string[] = [];
  
  // Header
  rows.push("Diagnosis-Specific Baselines Export");
  rows.push(`Generated: ${new Date().toLocaleDateString()}`);
  rows.push("");
  
  for (const diagnosis of diagnoses) {
    rows.push(`Diagnosis: ${diagnosis.diagnosis}`);
    rows.push(`System: ${diagnosis.system}`);
    rows.push("");
    
    // Vital Signs
    rows.push("Vital Sign Baselines");
    rows.push("Parameter,Expected Baseline,Alert Threshold");
    for (const vital of diagnosis.vitalBaselines) {
      rows.push([
        vital.parameter,
        `"${vital.baseline}"`, // Quote to handle commas in values
        `"${vital.alertThreshold}"`
      ].join(","));
    }
    rows.push("");
    
    // Lab Values
    rows.push("Laboratory Baselines");
    rows.push("Test,Expected Value,Critical Value");
    for (const lab of diagnosis.labBaselines) {
      rows.push([
        lab.test,
        `"${lab.expectedValue}"`,
        `"${lab.criticalValue}"`
      ].join(","));
    }
    rows.push("");
    rows.push("---");
    rows.push("");
  }
  
  return rows.join("\n");
}