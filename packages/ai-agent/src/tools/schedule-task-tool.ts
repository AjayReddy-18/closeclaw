import { z } from "zod";
import { tool } from "ai";
import { randomUUID } from "node:crypto";
import type { TaskStore } from "../scheduler/task-store.js";
import type { ScheduledTask } from "../scheduler/task-types.js";
import type { TaskScheduler } from "../scheduler/task-scheduler.js";
import { parseDuration } from "../scheduler/duration-parser.js";
import { isValidCronExpression } from "../scheduler/cron-utils.js";

const SCHEDULE_TASK_DESCRIPTION = `Schedule a task for future execution. Only use this when the user explicitly asks to be reminded, to schedule something, or to set up periodic checks. Do NOT schedule tasks for things that can be answered immediately. You MUST provide a reason justifying why scheduling is needed.`;

export interface ScheduleTaskToolDeps {
  taskStore: TaskStore;
  scheduler: TaskScheduler;
  platform: string;
  senderId: string;
}

function buildTask(
  input: { name: string; prompt: string; schedule: string; reason: string },
  platform: string,
  senderId: string,
): ScheduledTask | string {
  const { name, prompt, schedule } = input;
  const durationMs = parseDuration(schedule);
  if (durationMs) {
    return {
      id: randomUUID().slice(0, 8),
      name,
      prompt,
      scheduleType: "at",
      scheduleValue: schedule,
      targetPlatform: platform as ScheduledTask["targetPlatform"],
      targetSenderId: senderId,
      status: "active",
      createdAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + durationMs).toISOString(),
      runCount: 0,
      maxRetries: 3,
    };
  }
  if (isValidCronExpression(schedule)) {
    return {
      id: randomUUID().slice(0, 8),
      name,
      prompt,
      scheduleType: "cron",
      scheduleValue: schedule,
      targetPlatform: platform as ScheduledTask["targetPlatform"],
      targetSenderId: senderId,
      status: "active",
      createdAt: new Date().toISOString(),
      runCount: 0,
      maxRetries: 3,
    };
  }
  return `Invalid schedule: "${schedule}". Use duration (e.g. 30m, 2h, 1d) or cron expression.`;
}

export function createScheduleTaskTool(deps: ScheduleTaskToolDeps) {
  return tool({
    description: SCHEDULE_TASK_DESCRIPTION,
    inputSchema: z.object({
      name: z.string().describe("Short descriptive name for the task"),
      prompt: z.string().describe("The prompt to execute when the task fires"),
      schedule: z
        .string()
        .describe("When to run: duration like '30m' or cron like '0 9 * * *'"),
      reason: z
        .string()
        .describe("Why scheduling is needed instead of answering now"),
    }),
    execute: async (input) => {
      const result = buildTask(input, deps.platform, deps.senderId);
      if (typeof result === "string") return { success: false, error: result };
      deps.taskStore.addTask(result);
      deps.scheduler.scheduleTask(result);
      return {
        success: true,
        taskId: result.id,
        name: result.name,
        scheduledFor: result.nextRunAt ?? result.scheduleValue,
      };
    },
  });
}
