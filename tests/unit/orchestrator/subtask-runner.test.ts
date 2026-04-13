import { describe, it, expect, vi } from "vitest";

describe("createSubtaskRunner", () => {
  async function loadModule() {
    return import("../../../packages/orchestrator/src/subtask-runner.js");
  }

  function makePlan(overrides?: Partial<{ id: string; label: string; prompt: string }>) {
    return {
      id: overrides?.id ?? "subtask-1",
      label: overrides?.label ?? "Fetch data",
      prompt: overrides?.prompt ?? "Get the latest data",
    };
  }

  function makeLive() {
    return {
      update: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      dispose: vi.fn(),
    };
  }

  function makeDeps(processResult: string | Error = "Done") {
    const processMessage =
      processResult instanceof Error
        ? vi.fn().mockRejectedValue(processResult)
        : vi.fn().mockResolvedValue(processResult);
    return {
      processMessage,
      platform: "telegram" as const,
      senderId: "user-1",
      senderDisplayName: "TestUser",
    };
  }

  it("returns fulfilled SubtaskResult when processMessage succeeds", async () => {
    const { createSubtaskRunner } = await loadModule();
    const plan = makePlan();
    const live = makeLive();
    const deps = makeDeps("Task completed");
    const runner = createSubtaskRunner(plan, live, deps);
    const result = await runner();
    expect(result.id).toBe("subtask-1");
    expect(result.label).toBe("Fetch data");
    expect(result.status).toBe("fulfilled");
    expect(result.response).toBe("Task completed");
  });

  it("calls processMessage with subtask prompt", async () => {
    const { createSubtaskRunner } = await loadModule();
    const plan = makePlan({ prompt: "Do something specific" });
    const live = makeLive();
    const deps = makeDeps("OK");
    const runner = createSubtaskRunner(plan, live, deps);
    await runner();
    expect(deps.processMessage).toHaveBeenCalledWith(
      "telegram",
      "user-1",
      "Do something specific",
      "TestUser",
      expect.any(Function),
    );
  });

  it("updates LiveMessage via onIntermediateResponse", async () => {
    const { createSubtaskRunner } = await loadModule();
    const plan = makePlan();
    const live = makeLive();
    const deps = makeDeps("Final");
    deps.processMessage.mockImplementation(
      async (_p: string, _s: string, _t: string, _d?: string, onIntermediate?: (text: string) => Promise<void>) => {
        if (onIntermediate) await onIntermediate("Working on it...");
        return "Final";
      },
    );
    const runner = createSubtaskRunner(plan, live, deps);
    await runner();
    expect(live.update).toHaveBeenCalled();
  });

  it("finalizes LiveMessage with response text on success", async () => {
    const { createSubtaskRunner } = await loadModule();
    const plan = makePlan();
    const live = makeLive();
    const deps = makeDeps("Result here");
    const runner = createSubtaskRunner(plan, live, deps);
    await runner();
    expect(live.finalize).toHaveBeenCalledWith(expect.stringContaining("Result here"));
  });

  it("returns rejected SubtaskResult when processMessage throws", async () => {
    const { createSubtaskRunner } = await loadModule();
    const plan = makePlan();
    const live = makeLive();
    const deps = makeDeps(new Error("API failed"));
    const runner = createSubtaskRunner(plan, live, deps);
    const result = await runner();
    expect(result.status).toBe("rejected");
    expect(result.error).toContain("API failed");
  });

  it("finalizes LiveMessage with error text on failure", async () => {
    const { createSubtaskRunner } = await loadModule();
    const plan = makePlan();
    const live = makeLive();
    const deps = makeDeps(new Error("Timeout"));
    const runner = createSubtaskRunner(plan, live, deps);
    await runner();
    expect(live.finalize).toHaveBeenCalledWith(expect.stringContaining("Timeout"));
  });
});
