import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTaskStore } from "../../../../packages/ai-agent/src/scheduler/task-store.js";
import type { ScheduledTask } from "../../../../packages/ai-agent/src/scheduler/task-types.js";

function sampleTask(overrides?: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: "task-1",
    name: "Test task",
    prompt: "Do something",
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

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "taskstore-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("createTaskStore", () => {
  it("starts with empty tasks and runs", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    expect(store.listTasks()).toEqual([]);
    expect(store.getRunsForTask("any")).toEqual([]);
  });

  it("adds and retrieves a task", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    const task = sampleTask();
    store.addTask(task);
    expect(store.getTask("task-1")).toEqual(task);
    expect(store.listTasks()).toHaveLength(1);
  });

  it("removes a task", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    store.addTask(sampleTask());
    expect(store.removeTask("task-1")).toBe(true);
    expect(store.listTasks()).toHaveLength(0);
  });

  it("returns false when removing non-existent task", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    expect(store.removeTask("nope")).toBe(false);
  });

  it("updates a task", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    store.addTask(sampleTask());
    store.updateTask("task-1", { status: "completed", runCount: 1 });
    expect(store.getTask("task-1")?.status).toBe("completed");
    expect(store.getTask("task-1")?.runCount).toBe(1);
  });

  it("persists to disk and reloads", () => {
    const path = join(dir, "tasks.json");
    const store1 = createTaskStore(path);
    store1.addTask(sampleTask());
    const store2 = createTaskStore(path);
    expect(store2.listTasks()).toHaveLength(1);
    expect(store2.getTask("task-1")?.name).toBe("Test task");
  });

  it("adds and retrieves runs", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    store.addRun({
      taskId: "task-1",
      ranAt: new Date().toISOString(),
      outcome: "success",
      response: "Done",
      durationMs: 1000,
      delivered: true,
    });
    const runs = store.getRunsForTask("task-1");
    expect(runs).toHaveLength(1);
    expect(runs[0].outcome).toBe("success");
  });

  it("limits runs per task", () => {
    const store = createTaskStore(join(dir, "tasks.json"));
    for (let i = 0; i < 60; i++) {
      store.addRun({
        taskId: "task-1",
        ranAt: new Date().toISOString(),
        outcome: "success",
        durationMs: 100,
        delivered: true,
      });
    }
    const runs = store.getRunsForTask("task-1");
    expect(runs.length).toBeLessThanOrEqual(50);
  });

  it("uses atomic writes", () => {
    const path = join(dir, "tasks.json");
    const store = createTaskStore(path);
    store.addTask(sampleTask());
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    expect(data.version).toBe("1.0.0");
    expect(data.tasks).toHaveLength(1);
  });

  it("handles corrupted file gracefully", () => {
    const path = join(dir, "tasks.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(path, "NOT JSON", "utf-8");
    const store = createTaskStore(path);
    expect(store.listTasks()).toEqual([]);
  });
});
