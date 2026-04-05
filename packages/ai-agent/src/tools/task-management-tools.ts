import { z } from "zod";
import { tool } from "ai";
import type { TaskStore } from "../scheduler/task-store.js";
import type { TaskScheduler } from "../scheduler/task-scheduler.js";

export interface TaskManagementDeps {
  taskStore: TaskStore;
  scheduler: TaskScheduler;
}

export function createUnscheduleTaskTool(deps: TaskManagementDeps) {
  return tool({
    description:
      "Delete/cancel a scheduled task by its ID. Use this when the user asks to " +
      "remove, cancel, stop, or delete a previously scheduled task. You can find " +
      "task IDs by calling list_tasks first.",
    inputSchema: z.object({
      taskId: z.string().describe("The task ID to remove (8-character hex string)"),
      reason: z.string().describe("Why this task is being removed"),
    }),
    execute: async (input) => {
      deps.scheduler.unscheduleTask(input.taskId);
      const removed = deps.taskStore.removeTask(input.taskId);
      if (!removed) {
        return { success: false, error: `Task ${input.taskId} not found.` };
      }
      return { success: true, taskId: input.taskId };
    },
  });
}

export function createListTasksTool(deps: TaskManagementDeps) {
  return tool({
    description:
      "List all scheduled tasks. Use this to see existing scheduled tasks, " +
      "their IDs, names, schedules, and statuses. Useful before deleting or " +
      "modifying tasks.",
    inputSchema: z.object({}),
    execute: async () => {
      const tasks = deps.taskStore.listTasks();
      if (tasks.length === 0) return { tasks: [], message: "No scheduled tasks." };
      return {
        tasks: tasks.map((t) => ({
          id: t.id,
          name: t.name,
          schedule: t.scheduleType === "cron" ? `cron: ${t.scheduleValue}` : `${t.scheduleType}: ${t.scheduleValue}`,
          status: t.status,
          runs: t.runCount,
        })),
      };
    },
  });
}
