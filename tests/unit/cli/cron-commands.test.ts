import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCronList } from "../../../packages/cli/src/commands/cron-list.js";
import { runCronAdd } from "../../../packages/cli/src/commands/cron-add.js";
import { runCronRemove } from "../../../packages/cli/src/commands/cron-remove.js";
import { runCronRuns } from "../../../packages/cli/src/commands/cron-runs.js";
import type { TaskStore } from "@closeclaw/ai-agent";

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

let consoleSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cron list", () => {
  it("shows no tasks message when empty", () => {
    runCronList(makeStore());
    expect(consoleSpy).toHaveBeenCalledWith("No scheduled tasks.");
  });

  it("lists tasks in table format", () => {
    const store = makeStore();
    store.listTasks = vi.fn(() => [
      {
        id: "abc12345",
        name: "Test task",
        scheduleType: "every" as const,
        scheduleValue: "30m",
        status: "active" as const,
        runCount: 2,
        prompt: "test",
        targetPlatform: "telegram" as const,
        targetSenderId: "42",
        createdAt: "2026-01-01",
        maxRetries: 3,
      },
    ]);
    runCronList(store);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("abc12345"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 task(s)"),
    );
  });
});

describe("cron add", () => {
  it("adds a one-shot task with --at", () => {
    const store = makeStore();
    runCronAdd(store, { name: "Remind", message: "check inbox", at: "30m" });
    expect(store.addTask).toHaveBeenCalledTimes(1);
    const task = (store.addTask as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(task.scheduleType).toBe("at");
    expect(task.name).toBe("Remind");
  });

  it("adds a recurring task with --every", () => {
    const store = makeStore();
    runCronAdd(store, { name: "Check CI", message: "ci check", every: "2h" });
    expect(store.addTask).toHaveBeenCalledTimes(1);
    const task = (store.addTask as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(task.scheduleType).toBe("every");
  });

  it("adds a cron task", () => {
    const store = makeStore();
    runCronAdd(store, {
      name: "Daily",
      message: "brief",
      cron: "0 9 * * *",
      tz: "UTC",
    });
    expect(store.addTask).toHaveBeenCalledTimes(1);
    const task = (store.addTask as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(task.scheduleType).toBe("cron");
    expect(task.timezone).toBe("UTC");
  });

  it("rejects invalid schedule", () => {
    const store = makeStore();
    runCronAdd(store, { name: "Bad", message: "nope" });
    expect(store.addTask).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid"));
  });

  it("rejects invalid duration", () => {
    const store = makeStore();
    runCronAdd(store, { name: "Bad", message: "nope", at: "badformat" });
    expect(store.addTask).not.toHaveBeenCalled();
  });
});

describe("cron remove", () => {
  it("removes existing task", () => {
    const store = makeStore();
    runCronRemove(store, "abc123");
    expect(store.removeTask).toHaveBeenCalledWith("abc123");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("removed"));
  });

  it("shows error for missing task", () => {
    const store = makeStore();
    store.removeTask = vi.fn(() => false);
    runCronRemove(store, "missing");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });
});

describe("cron runs", () => {
  it("shows no runs message when empty", () => {
    const store = makeStore();
    runCronRuns(store, "t1");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No runs"));
  });

  it("shows run history in table format", () => {
    const store = makeStore();
    store.getRunsForTask = vi.fn(() => [
      {
        taskId: "t1",
        ranAt: new Date().toISOString(),
        outcome: "success" as const,
        response: "done",
        durationMs: 500,
        delivered: true,
      },
    ]);
    runCronRuns(store, "t1");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("1 run(s)"),
    );
  });
});
