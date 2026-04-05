import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTaskStore } from "../../packages/ai-agent/src/scheduler/task-store.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "schema-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("task store JSON schema", () => {
  it("writes valid JSON with version, tasks, and runs arrays", () => {
    const path = join(dir, "tasks.json");
    const store = createTaskStore(path);
    store.addTask({
      id: "t1",
      name: "Schema test",
      prompt: "hello",
      scheduleType: "at",
      scheduleValue: "10m",
      targetPlatform: "telegram",
      targetSenderId: "42",
      status: "active",
      createdAt: "2026-04-05T00:00:00Z",
      runCount: 0,
      maxRetries: 3,
    });
    store.addRun({
      taskId: "t1",
      ranAt: "2026-04-05T00:10:00Z",
      outcome: "success",
      response: "hi",
      durationMs: 500,
      delivered: true,
    });
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    expect(raw).toHaveProperty("version", "1.0.0");
    expect(raw.tasks).toHaveLength(1);
    expect(raw.runs).toHaveLength(1);
    expect(raw.tasks[0]).toHaveProperty("id", "t1");
    expect(raw.tasks[0]).toHaveProperty("scheduleType", "at");
    expect(raw.runs[0]).toHaveProperty("outcome", "success");
  });

  it("persists all required task fields", () => {
    const path = join(dir, "tasks.json");
    const store = createTaskStore(path);
    store.addTask({
      id: "t2",
      name: "Full fields",
      prompt: "prompt",
      scheduleType: "cron",
      scheduleValue: "0 9 * * *",
      timezone: "UTC",
      targetPlatform: "discord",
      targetSenderId: "99",
      status: "active",
      createdAt: "2026-04-05T00:00:00Z",
      nextRunAt: "2026-04-06T09:00:00Z",
      lastRunAt: "2026-04-05T09:00:00Z",
      runCount: 5,
      maxRetries: 2,
    });
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    const task = raw.tasks[0];
    expect(task.timezone).toBe("UTC");
    expect(task.nextRunAt).toBeDefined();
    expect(task.lastRunAt).toBeDefined();
    expect(task.maxRetries).toBe(2);
  });
});
