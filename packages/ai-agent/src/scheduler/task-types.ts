import type { BotPlatform } from "@closeclaw/shared-types";

export type ScheduleType = "at" | "every" | "cron";
export type TaskStatus = "active" | "paused" | "completed" | "failed";
export type RunOutcome = "success" | "failure";

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  scheduleType: ScheduleType;
  scheduleValue: string;
  timezone?: string;
  targetPlatform: BotPlatform;
  targetSenderId: string;
  status: TaskStatus;
  createdAt: string;
  nextRunAt?: string;
  lastRunAt?: string;
  runCount: number;
  maxRetries: number;
  lastDeliveredAt?: string;
}

export interface TaskRun {
  taskId: string;
  ranAt: string;
  outcome: RunOutcome;
  response?: string;
  error?: string;
  durationMs: number;
  delivered: boolean;
}

export interface TaskStoreData {
  version: string;
  tasks: ScheduledTask[];
  runs: TaskRun[];
}

export const TASK_STORE_VERSION = "1.0.0";

export const DEFAULT_MAX_RETRIES = 3;
export const MAX_RUNS_PER_TASK = 50;
