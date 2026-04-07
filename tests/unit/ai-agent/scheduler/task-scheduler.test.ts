import { describe, it, expect, vi } from "vitest";
import { createTaskScheduler } from "../../../../packages/ai-agent/src/scheduler/task-scheduler.js";
import type { TaskStore } from "../../../../packages/ai-agent/src/scheduler/task-store.js";
import type { TaskExecutor } from "../../../../packages/ai-agent/src/scheduler/task-executor.js";
import type {
  ScheduledTask,
  TaskRun,
} from "../../../../packages/ai-agent/src/scheduler/task-types.js";

function sampleTask(overrides?: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: "t1",
    name: "Test",
    prompt: "hi",
    scheduleType: "at",
    scheduleValue: "1s",
    targetPlatform: "telegram",
    targetSenderId: "42",
    status: "active",
    createdAt: new Date().toISOString(),
    runCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

function successRun(taskId: string): TaskRun {
  return {
    taskId,
    ranAt: new Date().toISOString(),
    outcome: "success",
    response: "ok",
    durationMs: 100,
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
  };
}

function makeExecutor(): TaskExecutor {
  return {
    executeTask: vi.fn(async (task) => successRun(task.id)),
  };
}

describe("createTaskScheduler", () => {
  it("runNow executes immediately and records run", async () => {
    const store = makeStore();
    store.addTask(sampleTask());
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const run = await scheduler.runNow("t1");
    expect(run).toBeDefined();
    expect(run!.outcome).toBe("success");
    expect(executor.executeTask).toHaveBeenCalledTimes(1);
    expect(store.addRun).toHaveBeenCalled();
    expect(deliver).toHaveBeenCalledWith("telegram", "42", "ok");

    scheduler.stop();
  });

  it("runNow returns undefined for unknown task", async () => {
    const store = makeStore();
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const run = await scheduler.runNow("nonexistent");
    expect(run).toBeUndefined();

    scheduler.stop();
  });

  it("runNow updates task runCount and lastRunAt", async () => {
    const store = makeStore();
    store.addTask(sampleTask());
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    await scheduler.runNow("t1");
    expect(store.updateTask).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ runCount: 1 }),
    );

    scheduler.stop();
  });

  it("unscheduleTask prevents future execution", () => {
    vi.useFakeTimers();
    const store = makeStore();
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const task = sampleTask({
      nextRunAt: new Date(Date.now() + 2000).toISOString(),
    });
    scheduler.scheduleTask(task);
    scheduler.unscheduleTask("t1");

    vi.advanceTimersByTime(3000);
    expect(executor.executeTask).not.toHaveBeenCalled();

    scheduler.stop();
    vi.useRealTimers();
  });

  it("stop clears all timers", () => {
    vi.useFakeTimers();
    const store = makeStore();
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(
      sampleTask({ nextRunAt: new Date(Date.now() + 5000).toISOString() }),
    );
    scheduler.stop();

    vi.advanceTimersByTime(10_000);
    expect(executor.executeTask).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("start loads active tasks from store", () => {
    vi.useFakeTimers();
    const store = makeStore();
    store.addTask(
      sampleTask({
        nextRunAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.start();
    expect(store.listTasks).toHaveBeenCalled();

    scheduler.stop();
    vi.useRealTimers();
  });

  it("scheduleTask sets up a timer", () => {
    vi.useFakeTimers();
    const store = makeStore();
    const executor = makeExecutor();
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const spy = vi.spyOn(globalThis, "setTimeout");
    scheduler.scheduleTask(
      sampleTask({ nextRunAt: new Date(Date.now() + 1000).toISOString() }),
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    scheduler.stop();
    vi.useRealTimers();
  });
});
