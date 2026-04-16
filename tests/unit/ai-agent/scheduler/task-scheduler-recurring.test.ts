import { describe, it, expect, vi } from "vitest";
import { createTaskScheduler } from "../../../../packages/ai-agent/src/scheduler/task-scheduler.js";
import type { TaskStore } from "../../../../packages/ai-agent/src/scheduler/task-store.js";
import type { TaskExecutor } from "../../../../packages/ai-agent/src/scheduler/task-executor.js";
import type {
  ScheduledTask,
  TaskRun,
} from "../../../../packages/ai-agent/src/scheduler/task-types.js";

function successRun(taskId: string): TaskRun {
  return {
    taskId,
    ranAt: new Date().toISOString(),
    outcome: "success",
    response: "ok",
    durationMs: 50,
    delivered: true,
  };
}

function makeStore(): TaskStore {
  const tasks: ScheduledTask[] = [];
  return {
    listTasks: vi.fn(() => [...tasks]),
    getTask: vi.fn((id) => tasks.find((t) => t.id === id)),
    addTask: vi.fn((t: ScheduledTask) => tasks.push(t)),
    removeTask: vi.fn(() => true),
    updateTask: vi.fn((id, updates) => {
      const t = tasks.find((x) => x.id === id);
      if (t) Object.assign(t, updates);
    }),
    addRun: vi.fn(),
    getRunsForTask: vi.fn(() => []),
    pruneOrphanedRuns: vi.fn(() => 0),
  };
}

describe("recurring task scheduling", () => {
  it("runNow on interval task delivers and records", async () => {
    const store = makeStore();
    store.addTask({
      id: "r1",
      name: "Recurring",
      prompt: "check",
      scheduleType: "every",
      scheduleValue: "30m",
      targetPlatform: "telegram",
      targetSenderId: "42",
      status: "active",
      createdAt: new Date().toISOString(),
      runCount: 0,
      maxRetries: 3,
    });
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const run = await scheduler.runNow("r1");
    expect(run?.outcome).toBe("success");
    expect(deliver).toHaveBeenCalledWith("telegram", "42", "ok");
    expect(store.addRun).toHaveBeenCalled();

    scheduler.stop();
  });

  it("runNow on cron task delivers and records", async () => {
    const store = makeStore();
    store.addTask({
      id: "c1",
      name: "Cron",
      prompt: "daily",
      scheduleType: "cron",
      scheduleValue: "0 9 * * *",
      targetPlatform: "telegram",
      targetSenderId: "99",
      status: "active",
      createdAt: new Date().toISOString(),
      runCount: 0,
      maxRetries: 3,
    });
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const run = await scheduler.runNow("c1");
    expect(run?.outcome).toBe("success");
    expect(deliver).toHaveBeenCalledWith("telegram", "99", "ok");

    scheduler.stop();
  });

  it("scheduleTask sets timer for interval task", () => {
    vi.useFakeTimers();
    const store = makeStore();
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const spy = vi.spyOn(globalThis, "setTimeout");
    scheduler.scheduleTask({
      id: "r2",
      name: "Every hour",
      prompt: "check",
      scheduleType: "every",
      scheduleValue: "1h",
      targetPlatform: "telegram",
      targetSenderId: "42",
      status: "active",
      createdAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + 3_600_000).toISOString(),
      runCount: 0,
      maxRetries: 3,
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    scheduler.stop();
    vi.useRealTimers();
  });
});
