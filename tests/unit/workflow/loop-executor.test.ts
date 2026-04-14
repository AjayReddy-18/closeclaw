import { describe, it, expect, vi } from "vitest";
import type { StepOutputContext, LoopStep } from "@closeclaw/workflow";

describe("LoopExecutor", () => {
  async function loadModule() {
    return import("../../../packages/workflow/src/loop-executor.js");
  }

  function makeLoop(overrides?: Partial<LoopStep>): LoopStep {
    return {
      id: "loop-1",
      type: "loop",
      label: "Poll",
      untilCondition: "Is it done?",
      maxIterations: 5,
      delaySeconds: 0,
      steps: [
        {
          id: "check",
          type: "action",
          label: "Check",
          prompt: "Check status",
          onError: "continue",
        },
      ],
      ...overrides,
    };
  }

  function makeDeps(responses: (string | Error)[] = ["Done"]) {
    let idx = 0;
    return {
      processMessage: vi.fn().mockImplementation(async () => {
        const r = responses[idx] ?? responses[responses.length - 1];
        idx++;
        if (r instanceof Error) throw r;
        return r;
      }),
      platform: "telegram",
      senderId: "user-1",
    };
  }

  it("exits when condition is met", async () => {
    const { executeLoop } = await loadModule();
    const deps = makeDeps(["status: pending", "false", "status: done", "true"]);
    const context: StepOutputContext = {};
    const results = await executeLoop(makeLoop(), deps, context);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("exits on max iterations", async () => {
    const { executeLoop } = await loadModule();
    const loop = makeLoop({ maxIterations: 3 });
    const deps = makeDeps(["pending", "false", "pending", "false", "pending", "false"]);
    const context: StepOutputContext = {};
    const results = await executeLoop(loop, deps, context);
    expect(results).toHaveLength(3);
  });

  it("handles step failure within loop", async () => {
    const { executeLoop } = await loadModule();
    const deps = makeDeps([new Error("fail"), "false"]);
    const context: StepOutputContext = {};
    const results = await executeLoop(
      makeLoop({ maxIterations: 2 }),
      deps,
      context,
    );
    expect(results.some((r) => r.status === "failed")).toBe(true);
  });

  it("records loop iteration in results", async () => {
    const { executeLoop } = await loadModule();
    const deps = makeDeps(["data", "true"]);
    const context: StepOutputContext = {};
    const results = await executeLoop(makeLoop(), deps, context);
    expect(results[0].loopIteration).toBe(1);
  });
});
