import { describe, it, expect, vi } from "vitest";
import type { StepNode, StepOutputContext } from "@closeclaw/workflow";

describe("ParallelExecutor", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/parallel-executor.js");
  }

  function makeActionStep(id: string): StepNode {
    return {
      id,
      type: "action",
      label: `Step ${id}`,
      prompt: `Do ${id}`,
      onError: "continue",
    };
  }

  function makeDeps(responses: string[] = ["Done"]) {
    let idx = 0;
    return {
      processMessage: vi.fn().mockImplementation(async () => {
        const r = responses[idx] ?? responses[responses.length - 1];
        idx++;
        return r;
      }),
      platform: "telegram",
      senderId: "user-1",
    };
  }

  it("executes branches concurrently", async () => {
    const { executeParallel } = await loadModule();
    const branches: StepNode[][] = [
      [makeActionStep("a1")],
      [makeActionStep("a2")],
      [makeActionStep("a3")],
    ];
    const deps = makeDeps(["r1", "r2", "r3"]);
    const context: StepOutputContext = {};
    const results = await executeParallel(branches, deps, context);
    expect(results).toHaveLength(3);
    expect(deps.processMessage).toHaveBeenCalledTimes(3);
  });

  it("continues when one branch fails", async () => {
    const { executeParallel } = await loadModule();
    const branches: StepNode[][] = [
      [makeActionStep("ok1")],
      [makeActionStep("fail1")],
    ];
    const deps = makeDeps([]);
    deps.processMessage
      .mockResolvedValueOnce("success")
      .mockRejectedValueOnce(new Error("branch fail"));
    const context: StepOutputContext = {};
    const results = await executeParallel(branches, deps, context);
    expect(results).toHaveLength(2);
  });

  it("merges results into context", async () => {
    const { executeParallel } = await loadModule();
    const branches: StepNode[][] = [
      [makeActionStep("b1")],
      [makeActionStep("b2")],
    ];
    const deps = makeDeps(["output-1", "output-2"]);
    const context: StepOutputContext = {};
    await executeParallel(branches, deps, context);
    expect(context["b1"]).toBe("output-1");
    expect(context["b2"]).toBe("output-2");
  });

  it("enforces MAX_PARALLEL_BRANCHES limit", async () => {
    const { executeParallel } = await loadModule();
    const branches: StepNode[][] = Array.from({ length: 6 }, (_, i) => [
      makeActionStep(`s${String(i)}`),
    ]);
    const deps = makeDeps(["ok"]);
    const context: StepOutputContext = {};
    await expect(executeParallel(branches, deps, context)).rejects.toThrow();
  });

  it("captures failed step result when processMessage rejects", async () => {
    const { executeParallel } = await loadModule();
    const branches: StepNode[][] = [
      [makeActionStep("a1")],
      [makeActionStep("a2")],
    ];
    const deps = makeDeps([]);
    deps.processMessage
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("branch fail"));
    const context: StepOutputContext = {};
    const results = await executeParallel(branches, deps, context);
    const failed = results.find(
      (r: { status: string }) => r.status === "failed",
    );
    expect(failed).toBeDefined();
    expect(failed!.stepId).toBe("a2");
    expect(failed!.error).toBe("branch fail");
  });

  it("skips non-action steps in branches", async () => {
    const { executeParallel } = await loadModule();
    const branches: StepNode[][] = [
      [
        {
          id: "cond",
          type: "condition",
          label: "Cond",
          condition: "check",
          thenSteps: [],
          elseSteps: [],
        } as StepNode,
      ],
    ];
    const deps = makeDeps([]);
    const context: StepOutputContext = {};
    const results = await executeParallel(branches, deps, context);
    expect(results).toHaveLength(0);
    expect(deps.processMessage).not.toHaveBeenCalled();
  });
});
