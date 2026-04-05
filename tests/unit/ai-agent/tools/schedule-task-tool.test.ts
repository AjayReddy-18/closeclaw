import { describe, it, expect, vi } from "vitest";
import { createScheduleTaskTool } from "../../../../packages/ai-agent/src/tools/schedule-task-tool.js";
import type { TaskStore } from "../../../../packages/ai-agent/src/scheduler/task-store.js";
import type { TaskScheduler } from "../../../../packages/ai-agent/src/scheduler/task-scheduler.js";

function makeDeps() {
  const taskStore: TaskStore = {
    listTasks: vi.fn(() => []),
    getTask: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(() => true),
    updateTask: vi.fn(),
    addRun: vi.fn(),
    getRunsForTask: vi.fn(() => []),
  };
  const scheduler: TaskScheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    scheduleTask: vi.fn(),
    unscheduleTask: vi.fn(),
    runNow: vi.fn(),
  };
  return { taskStore, scheduler, platform: "telegram", senderId: "42" };
}

describe("createScheduleTaskTool", () => {
  it("creates a one-shot task with duration schedule", async () => {
    const deps = makeDeps();
    const tool = createScheduleTaskTool(deps);
    const result = await tool.execute(
      {
        name: "Reminder",
        prompt: "Check inbox",
        schedule: "30m",
        reason: "User asked for a reminder",
      },
      { toolCallId: "test", messages: [] },
    );
    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
    expect(deps.taskStore.addTask).toHaveBeenCalledTimes(1);
    expect(deps.scheduler.scheduleTask).toHaveBeenCalledTimes(1);
  });

  it("creates a cron task", async () => {
    const deps = makeDeps();
    const tool = createScheduleTaskTool(deps);
    const result = await tool.execute(
      {
        name: "Morning brief",
        prompt: "Summarize jira",
        schedule: "0 9 * * *",
        reason: "Daily recurring task",
      },
      { toolCallId: "test", messages: [] },
    );
    expect(result.success).toBe(true);
    expect(deps.taskStore.addTask).toHaveBeenCalledTimes(1);
    const task = (deps.taskStore.addTask as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(task.scheduleType).toBe("cron");
  });

  it("returns error for invalid schedule", async () => {
    const deps = makeDeps();
    const tool = createScheduleTaskTool(deps);
    const result = await tool.execute(
      {
        name: "Bad",
        prompt: "nope",
        schedule: "invalid",
        reason: "test",
      },
      { toolCallId: "test", messages: [] },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid schedule");
    expect(deps.taskStore.addTask).not.toHaveBeenCalled();
  });

  it("sets correct target platform and sender", async () => {
    const deps = makeDeps();
    deps.platform = "discord";
    deps.senderId = "99";
    const tool = createScheduleTaskTool(deps);
    await tool.execute(
      {
        name: "Test",
        prompt: "test",
        schedule: "1h",
        reason: "test",
      },
      { toolCallId: "test", messages: [] },
    );
    const task = (deps.taskStore.addTask as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(task.targetPlatform).toBe("discord");
    expect(task.targetSenderId).toBe("99");
  });

  it("rejects duplicate task by name", async () => {
    const deps = makeDeps();
    deps.taskStore.listTasks = vi.fn(() => [
      {
        id: "existing",
        name: "Reminder",
        prompt: "Check inbox",
        scheduleType: "at" as const,
        scheduleValue: "30m",
        status: "active" as const,
        targetPlatform: "telegram" as const,
        targetSenderId: "42",
        createdAt: new Date().toISOString(),
        runCount: 0,
        maxRetries: 3,
      },
    ]);
    const tool = createScheduleTaskTool(deps);
    const result = await tool.execute(
      {
        name: "Reminder",
        prompt: "Check inbox again",
        schedule: "1h",
        reason: "test",
      },
      { toolCallId: "test", messages: [] },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("similar task already exists");
    expect(deps.taskStore.addTask).not.toHaveBeenCalled();
  });
});
