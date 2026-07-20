export const NCLEX_FRAMEWORK_ID = "nclex-rn-2026";
export const REMEDIATION_ALGORITHM_VERSION = "directed-remediation-v1";

export const NCJMM_FUNCTIONS = [
  "Recognize Cues",
  "Analyze Cues",
  "Prioritize Hypotheses",
  "Generate Solutions",
  "Take Action",
  "Evaluate Outcomes",
] as const;

export const INTEGRATED_PROCESSES = [
  "Caring",
  "Clinical Judgment",
  "Communication and Documentation",
  "Culture and Spirituality",
  "Nursing Process",
  "Teaching and Learning",
] as const;

export type ReleaseStage = "draft" | "clinical_review" | "approved" | "export_ready";
export type SafetyRisk = "standard" | "elevated" | "high";

export interface NclexCategory {
  id: string;
  label: string;
  blueprintRange: [number, number];
  blueprintWeight: number;
}

export const NCLEX_CATEGORIES: NclexCategory[] = [
  { id: "management-of-care", label: "Management of Care", blueprintRange: [15, 21], blueprintWeight: 18 },
  { id: "safety-infection-control", label: "Safety and Infection Prevention and Control", blueprintRange: [10, 16], blueprintWeight: 13 },
  { id: "health-promotion", label: "Health Promotion and Maintenance", blueprintRange: [6, 12], blueprintWeight: 9 },
  { id: "psychosocial-integrity", label: "Psychosocial Integrity", blueprintRange: [6, 12], blueprintWeight: 9 },
  { id: "basic-care-comfort", label: "Basic Care and Comfort", blueprintRange: [6, 12], blueprintWeight: 9 },
  { id: "pharmacological-therapies", label: "Pharmacological and Parenteral Therapies", blueprintRange: [13, 19], blueprintWeight: 16 },
  { id: "reduction-of-risk", label: "Reduction of Risk Potential", blueprintRange: [9, 15], blueprintWeight: 12 },
  { id: "physiological-adaptation", label: "Physiological Adaptation", blueprintRange: [11, 17], blueprintWeight: 14 },
];

export interface EvidenceSource {
  id: string;
  title: string;
  publisher: string;
  license: string;
  sourceUri: string;
  locator: string;
  approvalStatus: "approved" | "pending";
}

export interface ClinicalFact {
  cue: string;
  action: string;
  rationale: string;
  distractors: [string, string, string];
  sourceId: string;
  locator: string;
}

export interface ExemplarTopic {
  id: string;
  categoryId: string;
  title: string;
  concept: string;
  summary: string;
  safetyRisk: SafetyRisk;
  prerequisites: string[];
  objectives: string[];
  integratedProcesses: string[];
  lessonSections: Array<{ heading: string; body: string }>;
  guidedNotes: string[];
  focusedReview: string[];
  sources: EvidenceSource[];
  facts: ClinicalFact[];
  releaseStage: ReleaseStage;
}

const openStax = (id: string, title: string, slug: string, locator: string): EvidenceSource => ({
  id,
  title,
  publisher: "OpenStax",
  license: "CC BY 4.0",
  sourceUri: `https://openstax.org/books/${slug}/pages/1-introduction`,
  locator,
  approvalStatus: "approved",
});

const sharedDistractors: [string, string, string] = [
  "Delay action until the end of the shift.",
  "Document the finding without reassessment or follow-up.",
  "Delegate the clinical judgment decision to unlicensed assistive personnel.",
];

export const EXEMPLAR_TOPICS: ExemplarTopic[] = [
  {
    id: "moc-safe-delegation",
    categoryId: "management-of-care",
    title: "Safe Delegation and Supervision",
    concept: "Care Coordination",
    summary: "Match the task to the delegatee, retain nursing judgment, communicate expectations, and evaluate the result.",
    safetyRisk: "high",
    prerequisites: ["scope-of-practice", "patient-stability", "nursing-process"],
    objectives: [
      "Differentiate tasks that require nursing judgment from tasks that may be delegated.",
      "Select an appropriate delegatee using patient stability, task predictability, and local scope.",
      "Provide direction, supervision, and outcome evaluation after delegation.",
    ],
    integratedProcesses: ["Clinical Judgment", "Communication and Documentation", "Nursing Process"],
    lessonSections: [
      { heading: "Decision frame", body: "The nurse assesses the patient and task before delegating. Assessment, teaching, evaluation, and unstable-patient decisions remain with the licensed nurse." },
      { heading: "Communication", body: "State the task, expected result, reporting parameters, and time frame. Confirm understanding and availability for questions." },
      { heading: "Supervision", body: "Delegation transfers performance of a task, not accountability for the nursing decision. Reassess the patient and evaluate completion." },
    ],
    guidedNotes: ["Patient stability:", "Task predictability:", "Required nursing judgment:", "Directions and report-back criteria:", "Evaluation completed:"],
    focusedReview: ["Assess before delegating.", "Do not delegate nursing judgment.", "Give explicit report-back parameters.", "Evaluate the patient outcome."],
    sources: [openStax("src-fundamentals-delegation", "Fundamentals of Nursing", "fundamentals-nursing", "Leadership, delegation, and care coordination")],
    facts: [
      { cue: "A newly admitted patient has changing neurologic findings.", action: "The registered nurse performs the focused assessment and determines the next intervention.", rationale: "An unstable or changing condition requires licensed nursing assessment and judgment.", distractors: sharedDistractors, sourceId: "src-fundamentals-delegation", locator: "Delegation and patient stability" },
      { cue: "A stable patient needs routine intake and output recorded.", action: "Delegate measurement with clear reporting parameters and review the result.", rationale: "A predictable task may be delegated when direction and supervision are provided.", distractors: sharedDistractors, sourceId: "src-fundamentals-delegation", locator: "Delegation communication" },
      { cue: "A patient requires initial teaching for a new diagnosis.", action: "The registered nurse performs and evaluates the initial teaching.", rationale: "Initial teaching and evaluation require nursing judgment.", distractors: sharedDistractors, sourceId: "src-fundamentals-delegation", locator: "Responsibilities retained by the nurse" },
      { cue: "A delegatee reports a value outside the stated parameters.", action: "Assess the patient and determine the appropriate nursing response.", rationale: "The nurse must interpret abnormal findings and act on the patient response.", distractors: sharedDistractors, sourceId: "src-fundamentals-delegation", locator: "Supervision and evaluation" },
      { cue: "The task is permitted by policy but the delegatee has not demonstrated competence.", action: "Assign the task to a competent team member or complete it as the nurse.", rationale: "Permitted scope does not replace validation of individual competence.", distractors: sharedDistractors, sourceId: "src-fundamentals-delegation", locator: "Delegatee competence" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "sic-standard-precautions",
    categoryId: "safety-infection-control",
    title: "Standard Precautions and Exposure Prevention",
    concept: "Infection Prevention",
    summary: "Select hand hygiene and protective equipment from the anticipated exposure, then remove equipment without contaminating clean areas.",
    safetyRisk: "high",
    prerequisites: ["chain-of-infection", "hand-hygiene"],
    objectives: ["Apply standard precautions to every patient encounter.", "Select PPE from the anticipated exposure.", "Respond safely to a sharps or body-fluid exposure."],
    integratedProcesses: ["Clinical Judgment", "Nursing Process", "Teaching and Learning"],
    lessonSections: [
      { heading: "Anticipate exposure", body: "Standard precautions apply to every patient. Add gloves, gown, mask, and eye protection according to likely contact with blood, body fluids, mucous membranes, nonintact skin, or contaminated equipment." },
      { heading: "Hand hygiene", body: "Perform hand hygiene at indicated moments and after glove removal. Gloves do not replace hand hygiene." },
      { heading: "Exposure response", body: "Immediately wash or flush the exposed area, report the event, and follow the organization's exposure evaluation process." },
    ],
    guidedNotes: ["Expected exposure:", "Required PPE:", "Clean-to-dirty sequence:", "Hand-hygiene moment:", "Exposure follow-up:"],
    focusedReview: ["Standard precautions apply to all patients.", "Match PPE to exposure risk.", "Remove PPE to prevent self-contamination.", "Report occupational exposures immediately."],
    sources: [openStax("src-clinical-skills-precautions", "Clinical Nursing Skills", "clinical-nursing-skills", "Infection control and personal protective equipment")],
    facts: [
      { cue: "A procedure may splash body fluid toward the face.", action: "Use gloves plus facial and eye protection appropriate to the splash risk.", rationale: "PPE selection is based on the anticipated route and extent of exposure.", distractors: sharedDistractors, sourceId: "src-clinical-skills-precautions", locator: "PPE selection" },
      { cue: "Gloves are removed after contact with contaminated material.", action: "Perform hand hygiene immediately after glove removal.", rationale: "Gloves can have defects and hands can be contaminated during removal.", distractors: sharedDistractors, sourceId: "src-clinical-skills-precautions", locator: "Hand hygiene" },
      { cue: "A nurse sustains a needlestick injury.", action: "Wash the area, report promptly, and begin the exposure protocol.", rationale: "Immediate cleansing and timely evaluation reduce preventable harm and enable indicated prophylaxis.", distractors: sharedDistractors, sourceId: "src-clinical-skills-precautions", locator: "Occupational exposure" },
      { cue: "Clean supplies are placed near used wound-care materials.", action: "Separate clean and contaminated fields before continuing care.", rationale: "Maintaining separation limits indirect transmission.", distractors: sharedDistractors, sourceId: "src-clinical-skills-precautions", locator: "Aseptic work areas" },
      { cue: "A nurse plans to recap a used needle by hand.", action: "Activate the safety device and place the needle directly in an approved sharps container.", rationale: "Avoiding manipulation of used sharps reduces percutaneous injury risk.", distractors: sharedDistractors, sourceId: "src-clinical-skills-precautions", locator: "Sharps safety" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "hpm-postpartum-warning-signs",
    categoryId: "health-promotion",
    title: "Postpartum Discharge Teaching and Warning Signs",
    concept: "Maternal Health Promotion",
    summary: "Teach expected recovery, self-care, follow-up, and urgent warning signs using confirmation of understanding.",
    safetyRisk: "high",
    prerequisites: ["postpartum-assessment", "patient-teaching"],
    objectives: ["Distinguish expected postpartum changes from warning signs.", "Prioritize urgent follow-up instructions.", "Use teach-back to verify understanding."],
    integratedProcesses: ["Caring", "Communication and Documentation", "Culture and Spirituality", "Teaching and Learning"],
    lessonSections: [
      { heading: "Expected recovery", body: "Explain the usual progression of lochia, comfort measures, hydration, rest, and follow-up while emphasizing that symptoms must be interpreted with the whole clinical picture." },
      { heading: "Escalation", body: "Urgent evaluation is needed for heavy bleeding, breathing difficulty, chest pain, seizure, severe headache with concerning features, or thoughts of self-harm or harming the infant." },
      { heading: "Teach-back", body: "Ask the patient to explain when and how they would obtain help; correct gaps and include the support person when desired." },
    ],
    guidedNotes: ["Expected finding:", "Urgent warning sign:", "Who to call:", "Follow-up appointment:", "Teach-back response:"],
    focusedReview: ["Pair self-care with escalation instructions.", "Heavy bleeding and cardiopulmonary symptoms require urgent action.", "Include mental-health safety.", "Verify learning with teach-back."],
    sources: [openStax("src-maternal-postpartum", "Maternal-Newborn Nursing", "maternal-newborn-nursing", "Postpartum care and discharge education")],
    facts: [
      { cue: "The patient reports soaking a pad rapidly with ongoing heavy bleeding.", action: "Direct the patient to obtain urgent evaluation for possible postpartum hemorrhage.", rationale: "Heavy postpartum bleeding can represent a time-sensitive maternal emergency.", distractors: sharedDistractors, sourceId: "src-maternal-postpartum", locator: "Postpartum warning signs" },
      { cue: "The patient reports sudden shortness of breath and chest pain.", action: "Instruct the patient to activate emergency services immediately.", rationale: "Acute cardiopulmonary symptoms may indicate a life-threatening complication.", distractors: sharedDistractors, sourceId: "src-maternal-postpartum", locator: "Emergency symptoms" },
      { cue: "The patient expresses thoughts of harming themself or the infant.", action: "Maintain safety and arrange immediate emergency mental-health evaluation.", rationale: "Thoughts of harm require immediate safety intervention, not routine follow-up.", distractors: sharedDistractors, sourceId: "src-maternal-postpartum", locator: "Postpartum mental-health emergency" },
      { cue: "The patient cannot state whom to contact for worsening symptoms.", action: "Repeat the escalation plan and use teach-back before discharge.", rationale: "Teach-back identifies and corrects gaps in actionable discharge knowledge.", distractors: sharedDistractors, sourceId: "src-maternal-postpartum", locator: "Discharge teaching" },
      { cue: "The patient reports unilateral leg swelling and pain.", action: "Arrange prompt evaluation for a possible thromboembolic complication.", rationale: "Unilateral pain and swelling can signal venous thrombosis and require timely assessment.", distractors: sharedDistractors, sourceId: "src-maternal-postpartum", locator: "Thromboembolic warning signs" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "psi-therapeutic-communication",
    categoryId: "psychosocial-integrity",
    title: "Therapeutic Communication During Emotional Distress",
    concept: "Therapeutic Communication",
    summary: "Use presence, observation, open invitations, reflection, and direct safety assessment without false reassurance or judgment.",
    safetyRisk: "high",
    prerequisites: ["communication-basics", "mental-status-assessment"],
    objectives: ["Select therapeutic responses to distress.", "Avoid common nontherapeutic communication barriers.", "Escalate statements that indicate possible self-harm."],
    integratedProcesses: ["Caring", "Clinical Judgment", "Communication and Documentation"],
    lessonSections: [
      { heading: "Create space", body: "Use calm presence, observations, and open invitations that allow the patient to set the pace and describe their experience." },
      { heading: "Clarify", body: "Reflect or restate the patient's meaning and ask focused questions when safety or symptoms require clarification." },
      { heading: "Assess safety", body: "Statements suggesting hopelessness or self-harm require direct, nonjudgmental assessment and immediate protection according to risk." },
    ],
    guidedNotes: ["Observed cue:", "Therapeutic response:", "Nontherapeutic trap:", "Safety question:", "Follow-up action:"],
    focusedReview: ["Acknowledge emotion before problem-solving.", "Avoid advice and false reassurance.", "Silence can be therapeutic.", "Ask directly about self-harm when indicated."],
    sources: [openStax("src-psych-communication", "Psychiatric-Mental Health Nursing", "psychiatric-mental-health", "Therapeutic communication and suicide safety assessment")],
    facts: [
      { cue: "A patient says, “Nothing will ever get better.”", action: "Acknowledge the distress and ask directly about thoughts of self-harm.", rationale: "Hopeless statements warrant therapeutic exploration and direct safety assessment.", distractors: sharedDistractors, sourceId: "src-psych-communication", locator: "Suicide safety assessment" },
      { cue: "A grieving patient becomes silent and tearful.", action: "Remain present and allow silence while offering the patient time to speak.", rationale: "Therapeutic silence communicates presence without forcing conversation.", distractors: sharedDistractors, sourceId: "src-psych-communication", locator: "Use of silence" },
      { cue: "A patient says, “Everyone is judging me.”", action: "Respond, “It sounds as though you feel judged; tell me more about that.”", rationale: "Reflection validates the expressed feeling and invites clarification.", distractors: sharedDistractors, sourceId: "src-psych-communication", locator: "Reflection" },
      { cue: "A patient is anxious about a procedure.", action: "Ask what concerns them most and provide information responsive to that concern.", rationale: "Open exploration identifies the patient's need before teaching.", distractors: sharedDistractors, sourceId: "src-psych-communication", locator: "Open-ended communication" },
      { cue: "The nurse is tempted to say, “Everything will be fine.”", action: "Acknowledge uncertainty and explore the patient's specific concern instead.", rationale: "False reassurance can close communication and minimize distress.", distractors: sharedDistractors, sourceId: "src-psych-communication", locator: "Communication barriers" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "bcc-pressure-injury-prevention",
    categoryId: "basic-care-comfort",
    title: "Pressure Injury Prevention and Comfort",
    concept: "Mobility and Skin Integrity",
    summary: "Identify individual pressure-injury risks and combine repositioning, surface selection, moisture management, nutrition, and skin reassessment.",
    safetyRisk: "elevated",
    prerequisites: ["skin-assessment", "mobility-assessment"],
    objectives: ["Identify modifiable pressure-injury risks.", "Select individualized prevention interventions.", "Evaluate skin response and update the plan."],
    integratedProcesses: ["Caring", "Clinical Judgment", "Nursing Process"],
    lessonSections: [
      { heading: "Risk assessment", body: "Assess mobility, sensation, moisture, perfusion, nutrition, friction, shear, devices, and current skin findings." },
      { heading: "Prevention bundle", body: "Use individualized repositioning, pressure redistribution, heel off-loading, moisture protection, nutrition support, and device checks." },
      { heading: "Evaluate", body: "Inspect high-risk areas and device contact points, document changes, and revise the prevention plan when skin tolerance worsens." },
    ],
    guidedNotes: ["Mobility risk:", "Moisture risk:", "Pressure point/device:", "Prevention intervention:", "Reassessment finding:"],
    focusedReview: ["Prevention is individualized.", "Avoid friction and shear.", "Check beneath devices.", "Escalate new nonblanching or worsening skin changes."],
    sources: [openStax("src-fundamentals-skin", "Fundamentals of Nursing", "fundamentals-nursing", "Skin integrity and pressure injury prevention")],
    facts: [
      { cue: "An immobile patient slides down repeatedly in bed.", action: "Reposition with lift assistance and reduce shear while supporting alignment.", rationale: "Dragging and sliding increase shear forces that damage tissue.", distractors: sharedDistractors, sourceId: "src-fundamentals-skin", locator: "Friction and shear" },
      { cue: "Moisture is trapped against the sacral skin.", action: "Cleanse gently, manage the moisture source, and apply an appropriate moisture barrier.", rationale: "Persistent moisture weakens the skin barrier and increases injury risk.", distractors: sharedDistractors, sourceId: "src-fundamentals-skin", locator: "Moisture management" },
      { cue: "A medical device rests tightly against the patient's skin.", action: "Inspect beneath and around the device and relieve avoidable pressure.", rationale: "Medical devices can concentrate pressure and conceal evolving injury.", distractors: sharedDistractors, sourceId: "src-fundamentals-skin", locator: "Device-related pressure" },
      { cue: "The patient has limited mobility and poor nutritional intake.", action: "Initiate a coordinated prevention plan including mobility and nutrition interventions.", rationale: "Multiple risks require a bundled, interdisciplinary approach.", distractors: sharedDistractors, sourceId: "src-fundamentals-skin", locator: "Risk-based prevention" },
      { cue: "A high-risk area shows a new persistent color change.", action: "Relieve pressure, reassess the area, document the finding, and escalate per policy.", rationale: "Early recognition and pressure relief help prevent progression.", distractors: sharedDistractors, sourceId: "src-fundamentals-skin", locator: "Skin reassessment" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "ppt-high-alert-medication",
    categoryId: "pharmacological-therapies",
    title: "High-Alert Medication Administration",
    concept: "Medication Safety",
    summary: "Verify the complete medication order, patient-specific parameters, independent checks when required, monitoring, and response to harm.",
    safetyRisk: "high",
    prerequisites: ["medication-rights", "dosage-calculation", "patient-identification"],
    objectives: ["Identify safeguards for high-alert medications.", "Recognize parameters that require holding and clarification.", "Monitor for therapeutic and adverse effects."],
    integratedProcesses: ["Clinical Judgment", "Communication and Documentation", "Nursing Process"],
    lessonSections: [
      { heading: "Before administration", body: "Verify patient identity, medication, indication, dose, route, time, allergies, relevant laboratory data, interactions, and required independent checks." },
      { heading: "During administration", body: "Use the correct equipment and rate, minimize interruptions, and do not bypass smart-device or barcode safeguards without resolving the cause." },
      { heading: "After administration", body: "Monitor the expected effect and predictable harms, document the response, and act immediately on evidence of an adverse event." },
    ],
    guidedNotes: ["Medication and indication:", "Patient-specific parameter:", "Independent check:", "Monitoring plan:", "Adverse-response action:"],
    focusedReview: ["Know why the patient is receiving the medication.", "Resolve incomplete or inconsistent orders.", "Use required independent checks.", "Monitoring is part of administration."],
    sources: [openStax("src-pharmacology-safety", "Pharmacology for Nurses", "pharmacology", "Medication safety and administration")],
    facts: [
      { cue: "The prescribed dose is inconsistent with the available concentration and usual range.", action: "Hold administration and clarify the order before preparing the dose.", rationale: "A dose discrepancy must be resolved before medication reaches the patient.", distractors: sharedDistractors, sourceId: "src-pharmacology-safety", locator: "Order verification" },
      { cue: "A required patient-specific laboratory result is unavailable.", action: "Obtain or verify the required result before administering the medication.", rationale: "Relevant laboratory data can determine whether administration is safe.", distractors: sharedDistractors, sourceId: "src-pharmacology-safety", locator: "Pre-administration assessment" },
      { cue: "Barcode scanning produces a mismatch alert.", action: "Stop and resolve the patient, medication, and order mismatch.", rationale: "A mismatch alert is a safety signal and should not be bypassed for convenience.", distractors: sharedDistractors, sourceId: "src-pharmacology-safety", locator: "Barcode safeguards" },
      { cue: "Policy requires an independent double check for this medication.", action: "Have the qualified second clinician independently verify the required elements.", rationale: "An independent check is performed separately to reduce shared-error bias.", distractors: sharedDistractors, sourceId: "src-pharmacology-safety", locator: "Independent verification" },
      { cue: "The patient develops signs of an acute adverse reaction during administration.", action: "Stop the medication when appropriate, assess the patient, and activate the emergency response pathway.", rationale: "Immediate assessment and response limit ongoing exposure and address instability.", distractors: sharedDistractors, sourceId: "src-pharmacology-safety", locator: "Adverse drug response" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "rrp-transfusion-reaction",
    categoryId: "reduction-of-risk",
    title: "Recognition of an Acute Transfusion Reaction",
    concept: "Complication Recognition",
    summary: "Recognize new symptoms during transfusion, stop the blood product, maintain access with appropriate compatible fluid and tubing per policy, assess, and notify.",
    safetyRisk: "high",
    prerequisites: ["blood-product-administration", "focused-assessment"],
    objectives: ["Recognize findings associated with a possible transfusion reaction.", "Sequence immediate nursing actions.", "Complete required notification and specimen/product handling."],
    integratedProcesses: ["Clinical Judgment", "Communication and Documentation", "Nursing Process"],
    lessonSections: [
      { heading: "Recognize", body: "Treat new fever, chills, dyspnea, chest or back discomfort, hypotension, urticaria, or other acute change during transfusion as a possible reaction until evaluated." },
      { heading: "Stop and assess", body: "Stop the transfusion immediately, maintain venous access using new tubing and compatible solution according to policy, assess the patient, and obtain vital signs." },
      { heading: "Notify and investigate", body: "Notify the provider and transfusion service, follow emergency orders, and send the product, tubing, or specimens as required by organizational policy." },
    ],
    guidedNotes: ["New cue during transfusion:", "First action:", "Access maintained with:", "Notifications:", "Required follow-up:"],
    focusedReview: ["Stop the transfusion first.", "Assess airway, breathing, circulation, and vital signs.", "Do not restart the implicated unit.", "Follow the transfusion-reaction protocol."],
    sources: [openStax("src-med-surg-transfusion", "Medical-Surgical Nursing", "medical-surgical-nursing", "Blood product administration and transfusion reactions")],
    facts: [
      { cue: "The patient develops chills and dyspnea shortly after a transfusion begins.", action: "Stop the transfusion immediately and assess the patient.", rationale: "Stopping exposure and assessing stability are the immediate priorities for a suspected reaction.", distractors: sharedDistractors, sourceId: "src-med-surg-transfusion", locator: "Suspected transfusion reaction" },
      { cue: "The transfusion has been stopped for a suspected reaction.", action: "Maintain venous access with new tubing and compatible solution according to policy.", rationale: "Separate tubing avoids infusing residual blood while preserving access for treatment.", distractors: sharedDistractors, sourceId: "src-med-surg-transfusion", locator: "Immediate response sequence" },
      { cue: "The patient's blood pressure is falling during the reaction.", action: "Activate urgent assistance and support airway, breathing, and circulation while following emergency orders.", rationale: "Hemodynamic instability requires immediate escalation and resuscitative priorities.", distractors: sharedDistractors, sourceId: "src-med-surg-transfusion", locator: "Unstable transfusion reaction" },
      { cue: "Symptoms improve after the unit is stopped.", action: "Continue the reaction protocol and do not restart the implicated blood product.", rationale: "Improvement does not establish that the product is safe to resume.", distractors: sharedDistractors, sourceId: "src-med-surg-transfusion", locator: "Product handling" },
      { cue: "A possible reaction has been stabilized.", action: "Notify the provider and transfusion service and complete required specimens and documentation.", rationale: "Investigation and reporting support diagnosis, treatment, and prevention of further harm.", distractors: sharedDistractors, sourceId: "src-med-surg-transfusion", locator: "Notification and investigation" },
    ],
    releaseStage: "clinical_review",
  },
  {
    id: "pa-sepsis-recognition",
    categoryId: "physiological-adaptation",
    title: "Early Recognition and Escalation of Sepsis",
    concept: "Perfusion and Infection",
    summary: "Recognize a concerning infection-associated change, assess perfusion and organ function, and activate the local sepsis pathway without delaying stabilization.",
    safetyRisk: "high",
    prerequisites: ["infection-assessment", "perfusion-assessment", "vital-sign-trends"],
    objectives: ["Recognize clinical deterioration consistent with possible sepsis.", "Prioritize immediate assessment and escalation.", "Evaluate response to time-sensitive interventions."],
    integratedProcesses: ["Clinical Judgment", "Communication and Documentation", "Nursing Process"],
    lessonSections: [
      { heading: "Recognize change", body: "Possible infection plus altered mentation, abnormal perfusion, respiratory change, hypotension, reduced urine output, or other new organ dysfunction requires urgent assessment." },
      { heading: "Escalate", body: "Activate the organization's sepsis or rapid-response pathway, communicate the trend and suspected source, obtain ordered diagnostics promptly, and begin stabilization." },
      { heading: "Evaluate", body: "Trend mental status, perfusion, blood pressure, oxygenation, urine output, laboratory results, and response to treatment; escalate persistent deterioration." },
    ],
    guidedNotes: ["Suspected infection source:", "Organ dysfunction cue:", "Perfusion finding:", "Escalation pathway:", "Response trend:"],
    focusedReview: ["Trend changes rather than relying on one value.", "New organ dysfunction raises urgency.", "Escalation and stabilization occur together.", "Reassess response continuously."],
    sources: [openStax("src-med-surg-sepsis", "Medical-Surgical Nursing", "medical-surgical-nursing", "Systemic infection, sepsis, and shock")],
    facts: [
      { cue: "A patient with suspected infection develops new confusion and hypotension.", action: "Activate urgent sepsis evaluation and assess airway, breathing, circulation, and perfusion.", rationale: "Possible infection with new organ dysfunction and hypotension requires immediate escalation.", distractors: sharedDistractors, sourceId: "src-med-surg-sepsis", locator: "Recognition of sepsis" },
      { cue: "Urine output is falling while heart rate and respiratory rate rise.", action: "Report the deterioration promptly and reassess perfusion and the full vital-sign trend.", rationale: "The combined trend can signal worsening organ perfusion.", distractors: sharedDistractors, sourceId: "src-med-surg-sepsis", locator: "Perfusion assessment" },
      { cue: "The patient has a possible infection but a normal temperature.", action: "Continue evaluating for sepsis using the complete clinical picture and organ-function findings.", rationale: "A normal temperature does not exclude serious infection or sepsis.", distractors: sharedDistractors, sourceId: "src-med-surg-sepsis", locator: "Variable presentation" },
      { cue: "Ordered cultures and treatment are pending while the patient deteriorates.", action: "Coordinate time-sensitive diagnostics and treatment while continuing stabilization and escalation.", rationale: "Deterioration requires parallel action rather than waiting passively for one step to finish.", distractors: sharedDistractors, sourceId: "src-med-surg-sepsis", locator: "Time-sensitive response" },
      { cue: "Blood pressure remains low after initial interventions.", action: "Escalate immediately and continue reassessing perfusion and treatment response.", rationale: "Persistent hypotension indicates ongoing instability and need for higher-level support.", distractors: sharedDistractors, sourceId: "src-med-surg-sepsis", locator: "Reassessment and escalation" },
    ],
    releaseStage: "clinical_review",
  },
];

const contexts = [
  "During the initial assessment",
  "While reviewing the care plan",
  "During a change-of-condition reassessment",
] as const;

export function buildAssessmentItems(topic: ExemplarTopic) {
  return contexts.flatMap((context, contextIndex) => topic.facts.map((fact, factIndex) => ({
    id: `${topic.id}-item-${contextIndex * topic.facts.length + factIndex + 1}`,
    itemType: "multiple_choice",
    stem: `${context}, the nurse notes: ${fact.cue} Which action is the priority?`,
    options: [
      { id: "A", text: fact.action },
      { id: "B", text: fact.distractors[0] },
      { id: "C", text: fact.distractors[1] },
      { id: "D", text: fact.distractors[2] },
    ],
    correctAnswer: "A",
    rationale: fact.rationale,
    objectiveId: `${topic.id}-objective-${(factIndex % topic.objectives.length) + 1}`,
    categoryId: topic.categoryId,
    sourceId: fact.sourceId,
    locator: fact.locator,
    difficulty: contextIndex === 0 ? "application" : "analysis",
  })));
}

export function buildClinicalJudgmentCase(topic: ExemplarTopic) {
  const fact = topic.facts[0];
  const prompts = [
    `Identify the findings in this scenario that require follow-up: ${fact.cue}`,
    "Explain how the cue changes the patient's immediate risk.",
    "State the highest-priority problem supported by the available cues.",
    "Identify two safe nursing responses and one action to avoid.",
    `Select and perform the priority response: ${fact.action}`,
    "Identify the findings that would demonstrate improvement or require escalation.",
  ];
  return NCJMM_FUNCTIONS.map((functionName, index) => ({
    id: `${topic.id}-case-${index + 1}`,
    function: functionName,
    prompt: prompts[index],
    rationale: index === 4 ? fact.rationale : `This item evaluates ${functionName.toLowerCase()} within ${topic.title}.`,
    sourceId: fact.sourceId,
    locator: fact.locator,
  }));
}

export function buildExemplarPackage(topic: ExemplarTopic) {
  return {
    schemaVersion: "1.0.0",
    frameworkId: NCLEX_FRAMEWORK_ID,
    topic: {
      id: topic.id,
      title: topic.title,
      categoryId: topic.categoryId,
      concept: topic.concept,
      safetyRisk: topic.safetyRisk,
      prerequisites: topic.prerequisites,
      integratedProcesses: topic.integratedProcesses,
    },
    releaseStage: topic.releaseStage,
    clinicalReviewRequired: true,
    objectives: topic.objectives.map((text, index) => ({ id: `${topic.id}-objective-${index + 1}`, text })),
    coreLesson: { summary: topic.summary, sections: topic.lessonSections },
    focusedReview: topic.focusedReview,
    guidedNotes: topic.guidedNotes,
    assessmentItems: buildAssessmentItems(topic),
    clinicalJudgmentCase: buildClinicalJudgmentCase(topic),
    masteryCheck: { thresholdPercent: 85, retryMode: "smallest_failed_objective_branch" },
    remediationBlocks: topic.objectives.map((objective, index) => ({
      id: `${topic.id}-remediation-${index + 1}`,
      objectiveId: `${topic.id}-objective-${index + 1}`,
      focus: objective,
      review: topic.focusedReview[index % topic.focusedReview.length],
    })),
    sources: topic.sources,
    accessibility: { language: "en-US", readingOrderDefined: true, headingsStructured: true, mediaAlternativesRequired: true },
  };
}

export function validateExemplarPackage(pkg: ReturnType<typeof buildExemplarPackage>) {
  const issues: string[] = [];
  const sourceIds = new Set(pkg.sources.map((source) => source.id));
  const objectiveIds = new Set(pkg.objectives.map((objective) => objective.id));
  if (pkg.objectives.length < 3) issues.push("At least three measurable objectives are required.");
  if (pkg.assessmentItems.length < 15) issues.push("At least fifteen assessment items are required.");
  if (pkg.clinicalJudgmentCase.length !== NCJMM_FUNCTIONS.length) issues.push("The clinical judgment case must cover all six NCJMM functions.");
  if (!pkg.coreLesson.summary || !pkg.coreLesson.sections.length || pkg.coreLesson.sections.some((section) => !section.heading || !section.body)) issues.push("The core lesson requires a summary and populated sections.");
  if (!pkg.focusedReview.length || !pkg.guidedNotes.length || pkg.remediationBlocks.length !== pkg.objectives.length) issues.push("Focused review, guided notes, and objective remediation blocks are required.");
  if (!pkg.sources.length || pkg.sources.some((source) => !source.license || !source.sourceUri || !source.locator)) issues.push("All sources require licensing, provenance, and a locator.");
  if (pkg.sources.some((source) => source.approvalStatus !== "approved")) issues.push("Pending evidence sources cannot support a clinical-review package.");
  if (pkg.sources.some((source) => !/^https:\/\//.test(source.sourceUri))) issues.push("Evidence sources must use an HTTPS provenance URI.");
  if (sourceIds.size !== pkg.sources.length) issues.push("Evidence source identifiers must be unique within a package.");
  if (pkg.assessmentItems.some((item) => !item.sourceId || !item.locator || !item.rationale)) issues.push("Every assessment item requires a rationale and source locator.");
  if (pkg.assessmentItems.some((item) => !sourceIds.has(item.sourceId))) issues.push("Every assessment item must reference a package evidence source.");
  if (pkg.assessmentItems.some((item) => !objectiveIds.has(item.objectiveId))) issues.push("Every assessment item must reference a package objective.");
  if (pkg.clinicalJudgmentCase.some((item) => !item.sourceId || !item.locator || !item.rationale || !sourceIds.has(item.sourceId))) issues.push("Every clinical-judgment item requires valid provenance and rationale.");
  if (!pkg.accessibility.language || !pkg.accessibility.readingOrderDefined || !pkg.accessibility.headingsStructured || !pkg.accessibility.mediaAlternativesRequired) issues.push("Accessibility metadata is incomplete.");
  if (pkg.releaseStage === "approved" || pkg.releaseStage === "export_ready") issues.push("Generated exemplars cannot bypass licensed clinical review.");
  return { valid: issues.length === 0, issues };
}
