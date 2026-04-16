import { describe, it, expect, vi, afterEach } from "vitest";
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

function makeStore(initial: ScheduledTask[] = []): TaskStore {
  const tasks = [...initial];
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

function successRun(taskId: string): TaskRun {
  return {
    taskId,
    ranAt: new Date().toISOString(),
    outcome: "success",
    response: "done",
    durationMs: 50,
    delivered: true,
  };
}

function failRun(taskId: string): TaskRun {
  return {
    taskId,
    ranAt: new Date().toISOString(),
    outcome: "failure",
    response: "",
    durationMs: 50,
    delivered: false,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("task-scheduler post-execution paths", () => {
  it("marks one-shot task as completed after timer fires", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);

    await vi.advanceTimersByTimeAsync(0);

    expect(executor.executeTask).toHaveBeenCalled();
    expect(store.removeTask).toHaveBeenCalledWith("t1");
    scheduler.stop();
  });

  it("marks recurring task as failed when retries exceeded", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      id: "r-fail",
      scheduleType: "every",
      scheduleValue: "1m",
      runCount: 2,
      maxRetries: 3,
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => failRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.updateTask).toHaveBeenCalledWith(
      "r-fail",
      expect.objectContaining({ status: "failed" }),
    );
    scheduler.stop();
  });

  it("reschedules recurring interval task after success", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      id: "r-ok",
      scheduleType: "every",
      scheduleValue: "30m",
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    const updateCalls = (store.updateTask as ReturnType<typeof vi.fn>).mock
      .calls;
    const nextRunUpdate = updateCalls.find(
      ([, u]: [string, Partial<ScheduledTask>]) => u.nextRunAt !== undefined,
    );
    expect(nextRunUpdate).toBeDefined();
    scheduler.stop();
  });

  it("reschedules recurring cron task after success", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      id: "c-ok",
      scheduleType: "cron",
      scheduleValue: "0 9 * * *",
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    const updateCalls = (store.updateTask as ReturnType<typeof vi.fn>).mock
      .calls;
    const nextRunUpdate = updateCalls.find(
      ([, u]: [string, Partial<ScheduledTask>]) => u.nextRunAt !== undefined,
    );
    expect(nextRunUpdate).toBeDefined();
    scheduler.stop();
  });

  it("does not deliver when run has no response", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const noResponseRun: TaskRun = {
      ...successRun("t1"),
      response: "",
    };
    const executor: TaskExecutor = {
      executeTask: vi.fn(async () => noResponseRun),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    expect(deliver).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("auto-completes recurring task when response has TASK_COMPLETE prefix", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      id: "monitor-pr",
      scheduleType: "cron",
      scheduleValue: "*/5 * * * *",
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const completeRun: TaskRun = {
      taskId: "monitor-pr",
      ranAt: new Date().toISOString(),
      outcome: "success",
      response: "TASK_COMPLETE: PR #304 has been merged!",
      durationMs: 50,
      delivered: true,
    };
    const executor: TaskExecutor = {
      executeTask: vi.fn(async () => completeRun),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.updateTask).toHaveBeenCalledWith(
      "monitor-pr",
      expect.objectContaining({ status: "completed" }),
    );
    const updateCalls = (store.updateTask as ReturnType<typeof vi.fn>).mock
      .calls;
    const nextRunUpdate = updateCalls.find(
      ([, u]: [string, Partial<ScheduledTask>]) => u.nextRunAt !== undefined,
    );
    expect(nextRunUpdate).toBeUndefined();
    scheduler.stop();
  });

  it("keeps recurring when response has TASK_IN_PROGRESS prefix", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      id: "still-polling",
      scheduleType: "cron",
      scheduleValue: "*/5 * * * *",
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const inProgressRun: TaskRun = {
      taskId: "still-polling",
      ranAt: new Date().toISOString(),
      outcome: "success",
      response: "TASK_IN_PROGRESS: PR still open",
      durationMs: 50,
      delivered: true,
    };
    const executor: TaskExecutor = {
      executeTask: vi.fn(async () => inProgressRun),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    const updateCalls = (store.updateTask as ReturnType<typeof vi.fn>).mock
      .calls;
    const completedUpdate = updateCalls.find(
      ([, u]: [string, Partial<ScheduledTask>]) => u.status === "completed",
    );
    expect(completedUpdate).toBeUndefined();
    const nextRunUpdate = updateCalls.find(
      ([, u]: [string, Partial<ScheduledTask>]) => u.nextRunAt !== undefined,
    );
    expect(nextRunUpdate).toBeDefined();
    scheduler.stop();
  });

  it("skips execution when task is no longer active at fire time", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const executor: TaskExecutor = {
      executeTask: vi.fn(async (t) => successRun(t.id)),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    task.status = "paused";
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    expect(executor.executeTask).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it("reschedules recurring task even when executeTask throws", async () => {
    vi.useFakeTimers();
    const task = sampleTask({
      id: "err-task",
      scheduleType: "cron",
      scheduleValue: "*/5 * * * *",
      nextRunAt: new Date(Date.now() + 100).toISOString(),
    });
    const store = makeStore([task]);
    const executor: TaskExecutor = {
      executeTask: vi.fn(async () => {
        throw new Error("AI API timeout");
      }),
    };
    const deliver = vi.fn().mockResolvedValue(undefined);
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    scheduler.scheduleTask(task);
    vi.advanceTimersByTime(200);
    await vi.advanceTimersByTimeAsync(0);

    const updateCalls = (store.updateTask as ReturnType<typeof vi.fn>).mock
      .calls;
    const nextRunUpdate = updateCalls.find(
      ([, u]: [string, Partial<ScheduledTask>]) => u.nextRunAt !== undefined,
    );
    expect(nextRunUpdate).toBeDefined();

    consoleSpy.mockRestore();
    scheduler.stop();
  });
});
