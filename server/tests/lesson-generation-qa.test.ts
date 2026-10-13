import { describe, expect, it } from "vitest";
import { evaluateGenerationProvenance } from "../../shared/lesson-generation-qa";

describe("evaluateGenerationProvenance", () => {
  it("passes agent-generated content", () => {
    expect(evaluateGenerationProvenance({ requestedMode: "agent_assisted", usedMode: "agent_assisted" }).status).toBe("pass");
  });

  it("fails when an agent-assisted request fell back to the template", () => {
    const verdict = evaluateGenerationProvenance({ requestedMode: "agent_assisted", usedMode: "template", fallbackUsed: true });
    expect(verdict.status).toBe("fail");
  });

  it("fails a fallback even when the fallbackUsed flag is missing", () => {
    expect(evaluateGenerationProvenance({ requestedMode: "agent_assisted", usedMode: "template" }).status).toBe("fail");
  });

  it("fails template content that carries a credential error in its risks", () => {
    const verdict = evaluateGenerationProvenance({ usedMode: "template" }, ["401 Incorrect API key provided."]);
    expect(verdict.status).toBe("fail");
  });

  it("warns, without blocking, when the template was requested on purpose", () => {
    expect(evaluateGenerationProvenance({ requestedMode: "template", usedMode: "template" }).status).toBe("warn");
  });

  it("warns when no generation record exists", () => {
    expect(evaluateGenerationProvenance(null).status).toBe("warn");
  });
});
