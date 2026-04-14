import { describe, it, expect, vi } from "vitest";
import type { ActionStep, StepOutputContext } from "@closeclaw/workflow";

describe("executeStep", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/step-executor.js");
  }

  function makeStep(overrides?: Partial<ActionStep>): ActionStep {
    return {
      id: "step-1",
      type: "action",
      label: "Fetch data",
      prompt: "Get the latest data",
      onError: "stop",
      ...overrides,
    };
  }

  function makeDeps(result: string | Error = "Done") {
    const processMessage =
      result instanceof Error
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue(result);
    return {
      processMessage,
      platform: "telegram",
      senderId: "user-1",
    };
  }

  it("returns success result when processMessage succeeds", async () => {
    const { executeStep } = await loadModule();
    const deps = makeDeps("Task completed");
    const context: StepOutputContext = {};
    const result = await executeStep(makeStep(), deps, context);
    expect(result.status).toBe("success");
    expect(result.output).toBe("Task completed");
    expect(result.stepId).toBe("step-1");
  });

  it("calls processMessage with interpolated prompt", async () => {
    const { executeStep } = await loadModule();
    const deps = makeDeps("OK");
    const context: StepOutputContext = { prev: "data" };
    const step = makeStep({ prompt: "Use {{prev.output}}" });
    await executeStep(step, deps, context);
    expect(deps.processMessage).toHaveBeenCalledWith(
      "telegram",
      "user-1",
      "Use data",
    );
  });

  it("returns failed result when processMessage throws", async () => {
    const { executeStep } = await loadModule();
    const deps = makeDeps(new Error("API timeout"));
    const context: StepOutputContext = {};
    const result = await executeStep(makeStep(), deps, context);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("API timeout");
  });

  it("captures output in result", async () => {
    const { executeStep } = await loadModule();
    const deps = makeDeps("Important output");
    const context: StepOutputContext = {};
    const result = await executeStep(makeStep(), deps, context);
    expect(result.output).toBe("Important output");
  });

  it("records timing information", async () => {
    const { executeStep } = await loadModule();
    const deps = makeDeps("Fast");
    const context: StepOutputContext = {};
    const result = await executeStep(makeStep(), deps, context);
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("sets stepLabel from the step", async () => {
    const { executeStep } = await loadModule();
    const deps = makeDeps("OK");
    const context: StepOutputContext = {};
    const result = await executeStep(
      makeStep({ label: "Custom Label" }),
      deps,
      context,
    );
    expect(result.stepLabel).toBe("Custom Label");
  });
});
