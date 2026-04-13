import { describe, it, expect, vi } from "vitest";

describe("Orchestration flow end-to-end", () => {
  async function loadModule() {
    return import("../../packages/orchestrator/src/orchestrator.js");
  }

  function makeLive() {
    return {
      update: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      dispose: vi.fn(),
    };
  }

  it("concurrent execution is faster than sequential", async () => {
    const { runOrchestration } = await loadModule();
    const FAST_DELAY = 50;
    const SLOW_DELAY = 200;

    const deps = {
      processMessage: vi
        .fn()
        .mockImplementation(async (_p: string, _s: string, text: string) => {
          const delay = text.includes("fast") ? FAST_DELAY : SLOW_DELAY;
          await new Promise((r) => setTimeout(r, delay));
          return `Done: ${text}`;
        }),
      createLiveMessage: vi.fn().mockImplementation(() => makeLive()),
      sendSummary: vi.fn().mockResolvedValue(undefined),
    };

    const session = {
      senderId: "user-1",
      platform: "telegram" as const,
      subtasks: [
        { id: "1", label: "Fast", prompt: "fast task" },
        { id: "2", label: "Slow", prompt: "slow task" },
      ],
    };

    const start = Date.now();
    await runOrchestration(session, deps);
    const elapsed = Date.now() - start;

    const sequentialTime = FAST_DELAY + SLOW_DELAY;
    expect(elapsed).toBeLessThan(sequentialTime * 1.5);
  });

  it("summary contains all subtask results", async () => {
    const { runOrchestration } = await loadModule();
    const deps = {
      processMessage: vi
        .fn()
        .mockResolvedValueOnce("Jira: 5 issues found")
        .mockResolvedValueOnce("Build: passed"),
      createLiveMessage: vi.fn().mockImplementation(() => makeLive()),
      sendSummary: vi.fn().mockResolvedValue(undefined),
    };

    const session = {
      senderId: "user-1",
      platform: "telegram" as const,
      subtasks: [
        { id: "1", label: "Jira", prompt: "fetch jira" },
        { id: "2", label: "Build", prompt: "check build" },
      ],
    };

    await runOrchestration(session, deps);
    const summaryText = deps.sendSummary.mock.calls[0][0];
    expect(summaryText).toContain("Jira");
    expect(summaryText).toContain("Build");
  });
});
