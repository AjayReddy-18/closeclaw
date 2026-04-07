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

export interface HeartbeatConfig {
  enabled: boolean;
  every: string;
  activeHours?: { start: string; end: string };
  timezone?: string;
  target: "last" | "none";
}

export interface TaskStore {
  load(): TaskStoreData;
  save(data: TaskStoreData): void;
  addTask(task: ScheduledTask): void;
  removeTask(id: string): boolean;
  getTask(id: string): ScheduledTask | undefined;
  listTasks(): ScheduledTask[];
  addRun(run: TaskRun): void;
  getRunsForTask(taskId: string, limit?: number): TaskRun[];
}

export interface TaskExecutor {
  executeTask(task: ScheduledTask): Promise<TaskRun>;
}

export interface TaskScheduler {
  start(tasks: ScheduledTask[]): void;
  stop(): void;
  scheduleTask(task: ScheduledTask): void;
  unscheduleTask(id: string): void;
  runNow(id: string): Promise<TaskRun>;
}

export interface HeartbeatRunner {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  runNow(): Promise<void>;
}
