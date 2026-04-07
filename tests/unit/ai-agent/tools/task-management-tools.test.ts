import { describe, it, expect, vi } from "vitest";
import {
  createUnscheduleTaskTool,
  createListTasksTool,
} from "../../../../packages/ai-agent/src/tools/task-management-tools.js";
import type { TaskStore } from "../../../../packages/ai-agent/src/scheduler/task-store.js";

function makeStore(): TaskStore {
  return {
    listTasks: vi.fn(() => []),
    getTask: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(() => true),
    updateTask: vi.fn(),
    addRun: vi.fn(),
    getRunsForTask: vi.fn(() => []),
  };
}

function makeScheduler() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    scheduleTask: vi.fn(),
    unscheduleTask: vi.fn(),
    runNow: vi.fn(),
  };
}

describe("unschedule_task tool", () => {
  it("removes an existing task", async () => {
    const store = makeStore();
    const scheduler = makeScheduler();
    const tool = createUnscheduleTaskTool({ taskStore: store, scheduler });
    const result = await tool.execute(
      { taskId: "abc123", reason: "no longer needed" },
      { toolCallId: "t1", messages: [], abortSignal: new AbortController().signal },
    );
    expect(scheduler.unscheduleTask).toHaveBeenCalledWith("abc123");
    expect(store.removeTask).toHaveBeenCalledWith("abc123");
    expect(result).toEqual({ success: true, taskId: "abc123" });
  });

  it("returns error for missing task", async () => {
    const store = makeStore();
    store.removeTask = vi.fn(() => false);
    const scheduler = makeScheduler();
    const tool = createUnscheduleTaskTool({ taskStore: store, scheduler });
    const result = await tool.execute(
      { taskId: "missing", reason: "test" },
      { toolCallId: "t1", messages: [], abortSignal: new AbortController().signal },
    );
    expect(result).toEqual({
      success: false,
      error: "Task missing not found.",
    });
  });
});

describe("list_tasks tool", () => {
  it("returns empty list message", async () => {
    const store = makeStore();
    const scheduler = makeScheduler();
    const tool = createListTasksTool({ taskStore: store, scheduler });
    const result = await tool.execute(
      {},
      { toolCallId: "t1", messages: [], abortSignal: new AbortController().signal },
    );
    expect(result.tasks).toEqual([]);
    expect(result.message).toBe("No scheduled tasks.");
  });

  it("returns formatted task list", async () => {
    const store = makeStore();
    store.listTasks = vi.fn(() => [
      {
        id: "abc123",
        name: "Daily check",
        scheduleType: "cron" as const,
        scheduleValue: "0 9 * * *",
        status: "active" as const,
        runCount: 5,
        prompt: "test",
        targetPlatform: "telegram" as const,
        targetSenderId: "42",
        createdAt: "2026-01-01",
        maxRetries: 3,
      },
    ]);
    const scheduler = makeScheduler();
    const tool = createListTasksTool({ taskStore: store, scheduler });
    const result = await tool.execute(
      {},
      { toolCallId: "t1", messages: [], abortSignal: new AbortController().signal },
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toEqual({
      id: "abc123",
      name: "Daily check",
      schedule: "cron: 0 9 * * *",
      status: "active",
      runs: 5,
    });
  });
});
