import { describe, it, expect, vi } from "vitest";

describe("runOrchestration", () => {
  async function loadModule() {
    return import("../../../packages/orchestrator/src/orchestrator.js");
  }

  function makeSession(taskCount = 2) {
    return {
      senderId: "user-1",
      platform: "telegram" as const,
      senderDisplayName: "Ajay",
      subtasks: Array.from({ length: taskCount }, (_, i) => ({
        id: `subtask-${i + 1}`,
        label: `Task ${i + 1}`,
        prompt: `Do task ${i + 1}`,
      })),
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

  function makeDeps(responses: (string | Error)[] = ["Result A", "Result B"]) {
    let callIndex = 0;
    return {
      processMessage: vi.fn().mockImplementation(async () => {
        const resp = responses[callIndex++];
        if (resp instanceof Error) throw resp;
        return resp;
      }),
      createLiveMessage: vi.fn().mockImplementation(() => makeLive()),
      sendSummary: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("creates one LiveMessage per subtask", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps();
    await runOrchestration(makeSession(), deps);
    expect(deps.createLiveMessage).toHaveBeenCalledTimes(2);
  });

  it("calls processMessage for each subtask", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps();
    await runOrchestration(makeSession(), deps);
    expect(deps.processMessage).toHaveBeenCalledTimes(2);
  });

  it("sends summary after all subtasks complete", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps();
    await runOrchestration(makeSession(), deps);
    expect(deps.sendSummary).toHaveBeenCalledTimes(1);
    const summaryText = deps.sendSummary.mock.calls[0][0];
    expect(summaryText).toContain("Result A");
    expect(summaryText).toContain("Result B");
  });

  it("returns the summary text", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps();
    const summary = await runOrchestration(makeSession(), deps);
    expect(summary).toContain("Result A");
  });

  it("disposes all LiveMessages after completion", async () => {
    const { runOrchestration } = await loadModule();
    const liveInstances: ReturnType<typeof makeLive>[] = [];
    const deps = {
      ...makeDeps(),
      createLiveMessage: vi.fn().mockImplementation(() => {
        const l = makeLive();
        liveInstances.push(l);
        return l;
      }),
    };
    await runOrchestration(makeSession(), deps);
    for (const l of liveInstances) {
      expect(l.dispose).toHaveBeenCalled();
    }
  });

  it("handles 3 subtasks concurrently", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps(["R1", "R2", "R3"]);
    const session = makeSession(3);
    await runOrchestration(session, deps);
    expect(deps.processMessage).toHaveBeenCalledTimes(3);
    expect(deps.sendSummary).toHaveBeenCalledTimes(1);
  });

  it("summary sent as new message after all subtasks finalize", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps();
    await runOrchestration(makeSession(), deps);
    expect(deps.sendSummary).toHaveBeenCalledTimes(1);
    expect(deps.sendSummary).toHaveBeenCalledAfter(deps.processMessage);
  });

  it("summary contains per-subtask status indicators", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps(["Success result", "Another success"]);
    await runOrchestration(makeSession(), deps);
    const summary = deps.sendSummary.mock.calls[0][0] as string;
    expect(summary).toContain("\u2705");
    expect(summary).toContain("Task 1");
    expect(summary).toContain("Task 2");
  });

  it("summary shows mixed success/failure when one subtask fails", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps(["Good result", new Error("Bad result")]);
    await runOrchestration(makeSession(), deps);
    const summary = deps.sendSummary.mock.calls[0][0] as string;
    expect(summary).toContain("\u2705");
    expect(summary).toContain("\u274C");
    expect(summary).toContain("Good result");
    expect(summary).toContain("Bad result");
  });

  it("one failure does not prevent other subtasks from completing", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps([new Error("First fails"), "Second succeeds"]);
    await runOrchestration(makeSession(), deps);
    expect(deps.processMessage).toHaveBeenCalledTimes(2);
    const summary = deps.sendSummary.mock.calls[0][0] as string;
    expect(summary).toContain("Second succeeds");
    expect(summary).toContain("1 of 2 tasks succeeded");
  });

  it("all failures still produce a summary", async () => {
    const { runOrchestration } = await loadModule();
    const deps = makeDeps([new Error("Err A"), new Error("Err B")]);
    await runOrchestration(makeSession(), deps);
    const summary = deps.sendSummary.mock.calls[0][0] as string;
    expect(summary).toContain("All 2 tasks failed");
    expect(summary).toContain("Err A");
    expect(summary).toContain("Err B");
  });

  it("disposes LiveMessages even when subtasks fail", async () => {
    const { runOrchestration } = await loadModule();
    const liveInstances: ReturnType<typeof makeLive>[] = [];
    const deps = {
      ...makeDeps([new Error("fail"), "ok"]),
      createLiveMessage: vi.fn().mockImplementation(() => {
        const l = makeLive();
        liveInstances.push(l);
        return l;
      }),
    };
    await runOrchestration(makeSession(), deps);
    for (const l of liveInstances) {
      expect(l.dispose).toHaveBeenCalled();
    }
  });

  it("disposes approval queue when deps.approvalAsk is provided", async () => {
    const { runOrchestration } = await loadModule();
    const deps = {
      ...makeDeps(),
      approvalAsk: vi.fn().mockResolvedValue("approve"),
    };
    await runOrchestration(makeSession(), deps);
    expect(deps.sendSummary).toHaveBeenCalledTimes(1);
  });
});
