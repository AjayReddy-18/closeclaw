import { describe, it, expect, vi } from "vitest";
import type { StepOutputContext } from "@closeclaw/workflow";

describe("evaluateCondition", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/condition-evaluator.js");
  }

  function makeDeps(response: string | Error = "true") {
    const processMessage =
      response instanceof Error
        ? vi.fn().mockRejectedValue(response)
        : vi.fn().mockResolvedValue(response);
    return { processMessage, platform: "telegram", senderId: "user-1" };
  }

  it("returns true when AI responds with true", async () => {
    const { evaluateCondition } = await loadModule();
    const deps = makeDeps("true");
    const context: StepOutputContext = { prev: "some data" };
    const result = await evaluateCondition("Is it good?", deps, context);
    expect(result).toBe(true);
  });

  it("returns false when AI responds with false", async () => {
    const { evaluateCondition } = await loadModule();
    const deps = makeDeps("false");
    const context: StepOutputContext = {};
    const result = await evaluateCondition("Is it bad?", deps, context);
    expect(result).toBe(false);
  });

  it("returns false when AI response does not contain true", async () => {
    const { evaluateCondition } = await loadModule();
    const deps = makeDeps("I'm not sure about that");
    const context: StepOutputContext = {};
    const result = await evaluateCondition("Check?", deps, context);
    expect(result).toBe(false);
  });

  it("returns false when processMessage throws", async () => {
    const { evaluateCondition } = await loadModule();
    const deps = makeDeps(new Error("AI down"));
    const context: StepOutputContext = {};
    const result = await evaluateCondition("Check?", deps, context);
    expect(result).toBe(false);
  });

  it("passes context summary to processMessage", async () => {
    const { evaluateCondition } = await loadModule();
    const deps = makeDeps("true");
    const context: StepOutputContext = { "step-1": "result data" };
    await evaluateCondition("Is it valid?", deps, context);
    const prompt = deps.processMessage.mock.calls[0][2] as string;
    expect(prompt).toContain("Is it valid?");
    expect(prompt).toContain("result data");
  });

  it("handles TRUE in mixed case", async () => {
    const { evaluateCondition } = await loadModule();
    const deps = makeDeps("True");
    const context: StepOutputContext = {};
    const result = await evaluateCondition("Check?", deps, context);
    expect(result).toBe(true);
  });
});
