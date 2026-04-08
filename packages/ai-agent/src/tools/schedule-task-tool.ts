import { z } from "zod";
import { tool } from "ai";
import { randomUUID } from "node:crypto";
import type { TaskStore } from "../scheduler/task-store.js";
import type { ScheduledTask } from "../scheduler/task-types.js";
import type { TaskScheduler } from "../scheduler/task-scheduler.js";
import { parseDuration } from "../scheduler/duration-parser.js";
import { isValidCronExpression } from "../scheduler/cron-utils.js";

const SCHEDULE_TASK_DESCRIPTION = [
  "Schedule a task for future execution.",
  "ONE-SHOT: use a duration like '3m', '1h', '30s' to run ONCE after that delay. One-shot tasks are auto-deleted after running.",
  "RECURRING: use a cron expression like '0 9 * * *' to run repeatedly on a schedule.",
  "IMPORTANT: If the user asks for something 'just once' or 'only today', use a duration (one-shot), NOT cron.",
  "BEFORE creating a task: call list_tasks first to check for duplicates. If a similar task already exists, ask the user if they want to add another.",
  "The 'prompt' field is the EXACT instruction the AI will execute later — keep it faithful to what the user asked. Do NOT add topics or details the user did not request.",
  "The 'name' field should be a short summary of ONLY what the user asked for.",
  "Only use this when the user explicitly asks to be reminded or schedule something.",
  "Do NOT schedule tasks for things that can be answered immediately.",
].join(" ");

export interface ScheduleTaskToolDeps {
  taskStore: TaskStore;
  scheduler: TaskScheduler;
  platform: string;
  senderId: string;
}

export interface DynamicScheduleTaskToolDeps {
  taskStore: TaskStore;
  scheduler: TaskScheduler;
  getSender: () => { platform: string; senderId: string };
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
  return createDynamicScheduleTaskTool({
    taskStore: deps.taskStore,
    scheduler: deps.scheduler,
    getSender: () => ({ platform: deps.platform, senderId: deps.senderId }),
  });
}

export function createDynamicScheduleTaskTool(
  deps: DynamicScheduleTaskToolDeps,
) {
  return tool({
    description: SCHEDULE_TASK_DESCRIPTION,
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          "Short name reflecting ONLY what the user asked for — do not embellish",
        ),
      prompt: z
        .string()
        .describe(
          "The EXACT instruction to execute later — only include what the user requested, nothing extra",
        ),
      schedule: z
        .string()
        .describe(
          "For one-shot: duration like '30s','5m','2h','1d'. For recurring: cron expression like '0 9 * * *'. Use duration for 'just once' requests.",
        ),
      reason: z
        .string()
        .describe("Why scheduling is needed instead of answering now"),
    }),
    execute: async (input) => {
      const existing = deps.taskStore.listTasks();
      const similar = existing.find(
        (t) =>
          t.status === "active" &&
          t.name.toLowerCase() === input.name.toLowerCase(),
      );
      if (similar) {
        return {
          success: false,
          error: `A similar task already exists: "${similar.name}" (id: ${similar.id}, schedule: ${similar.scheduleValue}). Ask the user if they want to add another before creating a duplicate.`,
        };
      }
      const { platform, senderId } = deps.getSender();
      const result = buildTask(input, platform, senderId);
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
