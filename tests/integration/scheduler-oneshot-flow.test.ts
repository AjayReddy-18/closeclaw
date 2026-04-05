import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTaskStore } from "../../packages/ai-agent/src/scheduler/task-store.js";
import { createTaskExecutor } from "../../packages/ai-agent/src/scheduler/task-executor.js";
import { createTaskScheduler } from "../../packages/ai-agent/src/scheduler/task-scheduler.js";
import type { ScheduledTask } from "../../packages/ai-agent/src/scheduler/task-types.js";

let dir: string;

function sampleTask(overrides?: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: "os-1",
    name: "One-shot test",
    prompt: "Run report",
    scheduleType: "at",
    scheduleValue: "1s",
    targetPlatform: "telegram",
    targetSenderId: "99",
    status: "active",
    createdAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 500).toISOString(),
    runCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  dir = mkdtempSync(join(tmpdir(), "oneshot-"));
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

describe("one-shot task lifecycle", () => {
  it("schedule -> fire -> deliver -> mark completed", async () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    const processMessage = vi.fn().mockResolvedValue("Report done");
    const executor = createTaskExecutor(processMessage);
    const delivered: string[] = [];
    const deliver = vi
      .fn()
      .mockImplementation(async (_p: string, _s: string, text: string) => {
        delivered.push(text);
      });
    const scheduler = createTaskScheduler(store, executor, deliver);

    const task = sampleTask();
    store.addTask(task);
    scheduler.scheduleTask(task);

    await vi.advanceTimersByTimeAsync(600);

    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(delivered).toEqual(["Report done"]);

    const runs = store.getRunsForTask("os-1");
    expect(runs).toHaveLength(1);
    expect(runs[0].outcome).toBe("success");

    const updated = store.getTask("os-1");
    expect(updated?.status).toBe("completed");
    expect(updated?.runCount).toBe(1);

    scheduler.stop();
  });

  it("runNow executes immediately without waiting", async () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    const processMessage = vi.fn().mockResolvedValue("Immediate");
    const executor = createTaskExecutor(processMessage);
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    const task = sampleTask();
    store.addTask(task);

    const run = await scheduler.runNow("os-1");
    expect(run?.outcome).toBe("success");
    expect(deliver).toHaveBeenCalledWith("telegram", "99", "Immediate");

    scheduler.stop();
  });
});
