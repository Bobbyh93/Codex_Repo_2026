import { z } from "zod";

export const LEGACY_NCLEX_STANDARDS = {
  100: "Safe and Effective Care Environment",
  101: "Management of Care",
  102: "Safety and Infection Prevention and Control",
  200: "Health Promotion and Maintenance",
  300: "Psychosocial Integrity",
  400: "Physiological Integrity",
  401: "Basic Care and Comfort",
  402: "Pharmacological and Parenteral Therapies",
  403: "Reduction of Risk Potential",
  404: "Physiological Adaptation",
} as const;

export type LegacyNclexStandardId = keyof typeof LEGACY_NCLEX_STANDARDS;

export const nclexOptionSchema = z.object({
  option_text: z.string().trim().min(1).max(500),
  is_correct: z.boolean(),
  rationale_text: z.string().trim().min(4).max(1200),
}).strict();

export const generatedNclexContentSchema = z.object({
  question_stem: z.string().trim().min(12).max(1200),
  options: z.array(nclexOptionSchema).length(4),
  video_script: z.object({
    title: z.string().trim().min(2).max(120),
    asset_content: z.string().trim().min(8).max(500),
  }).strict(),
  keyword_to_highlight: z.string().trim().min(1).max(80),
  caption: z.string().trim().min(2).max(500),
  cta: z.string().trim().min(2).max(180),
}).strict();

export const nclexIngestSourceSchema = z.object({
  unit_id: z.number().int().positive().max(1_000_000),
  topic_name: z.string().trim().min(2).max(200),
  raw_content: z.string().trim().min(20).max(20_000),
  standard_id: z.number().int().positive(),
  request_id: z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/).optional(),
}).strict();

export const nclexAutomationIngestSchema = nclexIngestSourceSchema.extend({
  generated: generatedNclexContentSchema,
}).strict();

const promptInjectionPatterns = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/i,
  /(?:system|developer)\s+message\s*:/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
];

const sensitivePatterns = [
  /\b(?:api[_ -]?key|access[_ -]?token|password|secret)\s*[:=]/i,
  /\b(?:sk|AIza)[-_A-Za-z0-9]{16,}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:MRN|medical record number)\s*[:#]?\s*[A-Za-z0-9-]{4,}\b/i,
  /\b(?:date of birth|DOB)\s*[:#]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

const prohibitedOutputPatterns = [
  /https?:\/\//i,
  /```/,
  /\*\*|__/,
  /\[[^\]]+\]\([^)]+\)/,
  /(?:^|\n)\s*[-*]\s+/m,
  /^\s{0,3}#{1,6}\s/m,
  ...promptInjectionPatterns,
  ...sensitivePatterns,
];

const clinicalNumberPattern = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|kg|mL|L|mEq|mmHg|bpm|%|seconds?|minutes?|hours?|days?|\/\s*(?:dL|L|mm3|mm³|mcL))\b/gi;
const absoluteClaimPattern = /\b(?:always|never|guarantees?|completely safe|no risk|must)\b/gi;

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function clinicalNumbers(value: string) {
  return Array.from(value.matchAll(clinicalNumberPattern), (match) => normalized(match[0]));
}

export function resolveLegacyNclexStandard(standardId: number) {
  return LEGACY_NCLEX_STANDARDS[standardId as LegacyNclexStandardId] || null;
}

export function validateNclexSourceSafety(rawContent: string) {
  const issues: string[] = [];
  if (promptInjectionPatterns.some((pattern) => pattern.test(rawContent))) {
    issues.push("raw_content contains prompt-injection language");
  }
  if (sensitivePatterns.some((pattern) => pattern.test(rawContent))) {
    issues.push("raw_content appears to contain credentials, PHI, or personal contact data");
  }
  return issues;
}

export function validateGeneratedNclexContent(
  rawContent: string,
  generated: z.infer<typeof generatedNclexContentSchema>,
) {
  const issues: string[] = [];
  const optionTexts = generated.options.map((option) => normalized(option.option_text));
  if (new Set(optionTexts).size !== 4) issues.push("options must be distinct");

  const correctOptions = generated.options.filter((option) => option.is_correct);
  if (correctOptions.length !== 1) issues.push("exactly one option must be correct");

  const correctRationale = correctOptions[0]?.rationale_text || "";
  if (/\b(?:incorrect|not\s+(?:the\s+)?correct|should\s+not)\b/i.test(correctRationale)) {
    issues.push("the correct option rationale contradicts the marked answer");
  }

  const scriptWords = wordCount(generated.video_script.asset_content);
  if (scriptWords < 25) issues.push("video_script.asset_content must contain at least 25 words");
  if (scriptWords > 30) issues.push("video_script.asset_content must not exceed 30 words");

  const outputText = JSON.stringify(generated);
  if (prohibitedOutputPatterns.some((pattern) => pattern.test(outputText))) {
    issues.push("generated output contains a URL, markdown, prompt injection, or sensitive data");
  }

  const sourceNumbers = new Set(clinicalNumbers(rawContent));
  const unsupportedNumbers = clinicalNumbers(outputText).filter((claim) => !sourceNumbers.has(claim));
  if (unsupportedNumbers.length > 0) {
    issues.push(`generated output introduces unsupported clinical numbers: ${Array.from(new Set(unsupportedNumbers)).join(", ")}`);
  }

  const sourceAbsoluteTerms = new Set(Array.from(rawContent.matchAll(absoluteClaimPattern), (match) => normalized(match[0])));
  const unsupportedAbsoluteTerms = Array.from(outputText.matchAll(absoluteClaimPattern), (match) => normalized(match[0]))
    .filter((claim) => !sourceAbsoluteTerms.has(claim));
  if (unsupportedAbsoluteTerms.length > 0) {
    issues.push(`generated output introduces unsupported absolute claims: ${Array.from(new Set(unsupportedAbsoluteTerms)).join(", ")}`);
  }

  return issues;
}

export type NclexAutomationIngest = z.infer<typeof nclexAutomationIngestSchema>;
export type GeneratedNclexContent = z.infer<typeof generatedNclexContentSchema>;
