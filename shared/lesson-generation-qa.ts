export type GenerationProvenanceVerdict = {
  status: "pass" | "warn" | "fail";
  details: string;
};

/**
 * Decides whether a package's visible content was actually generated.
 *
 * `generation` is the metadata the lesson draft step stores on the deck model
 * and the manifest. An agent-assisted request that fell back to the
 * deterministic template holds placeholder text, so it must not pass QA.
 * A package that asked for the template on purpose is labelled, not blocked.
 */
export function evaluateGenerationProvenance(
  generation: Record<string, any> | null | undefined,
  risks: unknown[] | null | undefined = [],
): GenerationProvenanceVerdict {
  if (!generation || typeof generation !== "object") {
    return { status: "warn", details: "No generation record is stored for this package; content origin cannot be confirmed." };
  }

  const usedMode = String(generation.usedMode || "");
  const requestedMode = String(generation.requestedMode || "");
  const fellBack = generation.fallbackUsed === true
    || (usedMode === "template" && requestedMode === "agent_assisted");
  const credentialRisk = (risks || []).some((risk) => /\b401\b|incorrect api key|unauthori[sz]ed/i.test(String(risk)));

  if (fellBack || (usedMode === "template" && credentialRisk)) {
    return {
      status: "fail",
      details: "Agent-assisted generation fell back to the deterministic template; slides hold placeholder text, not generated content.",
    };
  }
  if (usedMode === "template") {
    return { status: "warn", details: "Package was built from the deterministic template on request; label it as template content." };
  }
  return { status: "pass", details: `Visible content was generated (${usedMode || "mode not recorded"}).` };
}
