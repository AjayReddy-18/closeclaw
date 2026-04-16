import { describe, it, expect } from "vitest";
import type { StepOutputContext } from "@closeclaw/workflow";

describe("interpolateOutputs", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/output-interpolator.js");
  }

  it("replaces a single reference", async () => {
    const { interpolateOutputs } = await loadModule();
    const context: StepOutputContext = { "step-1": "Hello world" };
    const result = interpolateOutputs("Result: {{step-1.output}}", context);
    expect(result).toBe("Result: Hello world");
  });

  it("replaces multiple references", async () => {
    const { interpolateOutputs } = await loadModule();
    const context: StepOutputContext = {
      "step-1": "foo",
      "step-2": "bar",
    };
    const result = interpolateOutputs(
      "{{step-1.output}} and {{step-2.output}}",
      context,
    );
    expect(result).toBe("foo and bar");
  });

  it("leaves unresolved references as-is when step is missing", async () => {
    const { interpolateOutputs } = await loadModule();
    const context: StepOutputContext = {};
    const result = interpolateOutputs("Value: {{missing.output}}", context);
    expect(result).toBe("Value: {{missing.output}}");
  });

  it("returns text unchanged when no templates present", async () => {
    const { interpolateOutputs } = await loadModule();
    const context: StepOutputContext = { "step-1": "data" };
    const result = interpolateOutputs("No templates here", context);
    expect(result).toBe("No templates here");
  });

  it("handles empty string input", async () => {
    const { interpolateOutputs } = await loadModule();
    const result = interpolateOutputs("", {});
    expect(result).toBe("");
  });

  it("handles step IDs with hyphens and numbers", async () => {
    const { interpolateOutputs } = await loadModule();
    const context: StepOutputContext = { "check-ci-2": "passed" };
    const result = interpolateOutputs("CI: {{check-ci-2.output}}", context);
    expect(result).toBe("CI: passed");
  });
});
