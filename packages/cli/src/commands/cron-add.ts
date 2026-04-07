import { randomUUID } from "node:crypto";
import type { TaskStore, ScheduledTask } from "@closeclaw/ai-agent";
import { parseDuration, isValidCronExpression } from "@closeclaw/ai-agent";

export interface CronAddOptions {
  name: string;
  message: string;
  at?: string;
  every?: string;
  cron?: string;
  tz?: string;
  platform?: string;
  senderId?: string;
}

function resolveSchedule(
  opts: CronAddOptions,
):
  | Pick<ScheduledTask, "scheduleType" | "scheduleValue" | "nextRunAt">
  | undefined {
  if (opts.at) {
    const ms = parseDuration(opts.at);
    if (!ms) return undefined;
    return {
      scheduleType: "at",
      scheduleValue: opts.at,
      nextRunAt: new Date(Date.now() + ms).toISOString(),
    };
  }
  if (opts.every) {
    const ms = parseDuration(opts.every);
    if (!ms) return undefined;
    return {
      scheduleType: "every",
      scheduleValue: opts.every,
      nextRunAt: new Date(Date.now() + ms).toISOString(),
    };
  }
  if (opts.cron) {
    if (!isValidCronExpression(opts.cron)) return undefined;
    return { scheduleType: "cron", scheduleValue: opts.cron };
  }
  return undefined;
}

export function runCronAdd(store: TaskStore, opts: CronAddOptions): void {
  const schedule = resolveSchedule(opts);
  if (!schedule) {
    console.error("Invalid schedule. Use --at, --every, or --cron.");
    return;
  }
  const task: ScheduledTask = {
    id: randomUUID().slice(0, 8),
    name: opts.name,
    prompt: opts.message,
    ...schedule,
    timezone: opts.tz,
    targetPlatform: (opts.platform ??
      "telegram") as ScheduledTask["targetPlatform"],
    targetSenderId: opts.senderId ?? "default",
    status: "active",
    createdAt: new Date().toISOString(),
    runCount: 0,
    maxRetries: 3,
  };
  store.addTask(task);
  console.log(`Task "${task.name}" created (${task.id}).`);
}
