import type { BotPlatform } from "@closeclaw/shared-types";
import type { ScheduledTask, TaskRun } from "./task-types.js";
import type { TaskStore } from "./task-store.js";
import type { TaskExecutor } from "./task-executor.js";
import { parseDuration } from "./duration-parser.js";
import { nextCronOccurrence } from "./cron-utils.js";

export interface TaskScheduler {
  start(): void;
  stop(): void;
  scheduleTask(task: ScheduledTask): void;
  unscheduleTask(id: string): void;
  runNow(id: string): Promise<TaskRun | undefined>;
}

type DeliverFn = (
  platform: BotPlatform,
  senderId: string,
  text: string,
) => Promise<void>;

function computeDelayMs(task: ScheduledTask): number {
  if (task.nextRunAt) {
    return Math.max(0, new Date(task.nextRunAt).getTime() - Date.now());
  }
  return parseDuration(task.scheduleValue) ?? 60_000;
}

function computeNextRun(task: ScheduledTask): string | undefined {
  if (task.scheduleType === "every") {
    const ms = parseDuration(task.scheduleValue);
    if (!ms) return undefined;
    return new Date(Date.now() + ms).toISOString();
  }
  if (task.scheduleType === "cron") {
    const next = nextCronOccurrence(
      task.scheduleValue,
      new Date(),
      task.timezone,
    );
    return next?.toISOString();
  }
  return undefined;
}

export function createTaskScheduler(
  store: TaskStore,
  executor: TaskExecutor,
  deliver: DeliverFn,
): TaskScheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let executing = false;
  const queue: ScheduledTask[] = [];

  async function processQueue(): Promise<void> {
    if (executing) return;
    executing = true;
    while (queue.length > 0) {
      const task = queue.shift()!;
      await executeAndRecord(task);
    }
    executing = false;
  }

  async function executeAndRecord(task: ScheduledTask): Promise<void> {
    const run = await executor.executeTask(task);
    store.addRun(run);
    store.updateTask(task.id, {
      lastRunAt: run.ranAt,
      runCount: task.runCount + 1,
    });
    if (run.outcome === "success" && run.response) {
      await deliver(task.targetPlatform, task.targetSenderId, run.response);
    }
    handlePostExecution(task, run);
  }

  function handlePostExecution(task: ScheduledTask, run: TaskRun): void {
    if (task.scheduleType === "at") {
      store.updateTask(task.id, { status: "completed" });
      return;
    }
    if (run.outcome === "failure" && task.runCount + 1 >= task.maxRetries) {
      store.updateTask(task.id, { status: "failed" });
      return;
    }
    rescheduleRecurring(task);
  }

  function rescheduleRecurring(task: ScheduledTask): void {
    const nextRun = computeNextRun(task);
    if (!nextRun) return;
    store.updateTask(task.id, { nextRunAt: nextRun });
    const updated = store.getTask(task.id);
    if (updated && updated.status === "active") {
      scheduleTimer(updated);
    }
  }

  function scheduleTimer(task: ScheduledTask): void {
    clearExistingTimer(task.id);
    const delay = computeDelayMs(task);
    const timer = setTimeout(() => {
      timers.delete(task.id);
      const current = store.getTask(task.id);
      if (!current || current.status !== "active") return;
      queue.push(current);
      void processQueue();
    }, delay);
    timers.set(task.id, timer);
  }

  function clearExistingTimer(id: string): void {
    const existing = timers.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.delete(id);
    }
  }

  return {
    start() {
      for (const task of store.listTasks()) {
        if (task.status === "active") scheduleTimer(task);
      }
    },

    stop() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },

    scheduleTask: (task) => scheduleTimer(task),

    unscheduleTask: (id) => clearExistingTimer(id),

    async runNow(id) {
      const task = store.getTask(id);
      if (!task) return undefined;
      const run = await executor.executeTask(task);
      store.addRun(run);
      store.updateTask(id, {
        lastRunAt: run.ranAt,
        runCount: task.runCount + 1,
      });
      if (run.outcome === "success" && run.response) {
        await deliver(task.targetPlatform, task.targetSenderId, run.response);
      }
      return run;
    },
  };
}
