import { describe, it, expect, vi } from "vitest";
import { createTaskExecutor } from "../../../../packages/ai-agent/src/scheduler/task-executor.js";
import type { ScheduledTask } from "../../../../packages/ai-agent/src/scheduler/task-types.js";

function sampleTask(overrides?: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: "task-1",
    name: "Test",
    prompt: "Do the thing",
    scheduleType: "at",
    scheduleValue: "30m",
    targetPlatform: "telegram",
    targetSenderId: "123",
    status: "active",
    createdAt: new Date().toISOString(),
    runCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

describe("createTaskExecutor", () => {
  it("executes a task and returns success run", async () => {
    const processMessage = vi.fn().mockResolvedValue("Done!");
    const executor = createTaskExecutor(processMessage);
    const run = await executor.executeTask(sampleTask());
    expect(run.outcome).toBe("success");
    expect(run.response).toBe("Done!");
    expect(run.taskId).toBe("task-1");
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.delivered).toBe(true);
    expect(processMessage).toHaveBeenCalledWith(
      "telegram",
      "123",
      expect.stringContaining("Do the thing"),
    );
    const actualPrompt = processMessage.mock.calls[0][2];
    expect(actualPrompt).toContain("[SCHEDULED TASK");
    expect(actualPrompt).toContain("TASK_COMPLETE:");
    expect(actualPrompt).toContain("TASK_IN_PROGRESS:");
  });

  it("returns failure run on error", async () => {
    const processMessage = vi.fn().mockRejectedValue(new Error("AI down"));
    const executor = createTaskExecutor(processMessage);
    const run = await executor.executeTask(sampleTask());
    expect(run.outcome).toBe("failure");
    expect(run.error).toBe("AI down");
    expect(run.delivered).toBe(false);
  });

  it("captures non-Error thrown values", async () => {
    const processMessage = vi.fn().mockRejectedValue("string error");
    const executor = createTaskExecutor(processMessage);
    const run = await executor.executeTask(sampleTask());
    expect(run.outcome).toBe("failure");
    expect(run.error).toBe("string error");
  });

  it("measures execution duration", async () => {
    const processMessage = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50, "ok")),
      );
    const executor = createTaskExecutor(processMessage);
    const run = await executor.executeTask(sampleTask());
    expect(run.durationMs).toBeGreaterThanOrEqual(40);
  });
});
