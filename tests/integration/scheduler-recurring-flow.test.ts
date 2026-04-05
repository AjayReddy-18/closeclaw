import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTaskStore } from "../../packages/ai-agent/src/scheduler/task-store.js";
import { createTaskExecutor } from "../../packages/ai-agent/src/scheduler/task-executor.js";
import { createTaskScheduler } from "../../packages/ai-agent/src/scheduler/task-scheduler.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "recurring-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("recurring task lifecycle", () => {
  it("runNow twice on interval task records both runs", async () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    const processMessage = vi.fn().mockResolvedValue("check done");
    const executor = createTaskExecutor(processMessage);
    const delivered: string[] = [];
    const deliver = vi
      .fn()
      .mockImplementation(async (_p: string, _s: string, text: string) => {
        delivered.push(text);
      });
    const scheduler = createTaskScheduler(store, executor, deliver);

    store.addTask({
      id: "r1",
      name: "Interval check",
      prompt: "run check",
      scheduleType: "every",
      scheduleValue: "1h",
      targetPlatform: "telegram",
      targetSenderId: "50",
      status: "active",
      createdAt: new Date().toISOString(),
      runCount: 0,
      maxRetries: 3,
    });

    await scheduler.runNow("r1");
    await scheduler.runNow("r1");

    expect(processMessage).toHaveBeenCalledTimes(2);
    expect(delivered).toHaveLength(2);

    const runs = store.getRunsForTask("r1");
    expect(runs).toHaveLength(2);

    scheduler.stop();
  });

  it("runNow on cron task records run and remains active", async () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    const processMessage = vi.fn().mockResolvedValue("morning brief");
    const executor = createTaskExecutor(processMessage);
    const deliver = vi.fn().mockResolvedValue(undefined);
    const scheduler = createTaskScheduler(store, executor, deliver);

    store.addTask({
      id: "c1",
      name: "Morning brief",
      prompt: "summarize",
      scheduleType: "cron",
      scheduleValue: "0 9 * * *",
      targetPlatform: "telegram",
      targetSenderId: "77",
      status: "active",
      createdAt: new Date().toISOString(),
      runCount: 0,
      maxRetries: 3,
    });

    const run = await scheduler.runNow("c1");
    expect(run?.outcome).toBe("success");
    expect(deliver).toHaveBeenCalledWith("telegram", "77", "morning brief");

    const task = store.getTask("c1");
    expect(task?.runCount).toBe(1);

    scheduler.stop();
  });
});
