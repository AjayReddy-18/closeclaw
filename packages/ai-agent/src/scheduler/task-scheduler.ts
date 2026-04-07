import type { BotPlatform } from "@closeclaw/shared-types";
import type { ScheduledTask, TaskRun } from "./task-types.js";
import type { TaskStore } from "./task-store.js";
import type { TaskExecutor } from "./task-executor.js";
import { parseDuration } from "./duration-parser.js";
import { nextCronOccurrence } from "./cron-utils.js";
import { evaluateResponse } from "./suppression-filter.js";

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

const MAX_TIMEOUT_MS = 2_147_483_647;

function computeDelayMs(task: ScheduledTask): number {
  if (task.nextRunAt) {
    const raw = Math.max(0, new Date(task.nextRunAt).getTime() - Date.now());
    return Math.min(raw, MAX_TIMEOUT_MS);
  }
  const dur = parseDuration(task.scheduleValue) ?? 60_000;
  return Math.min(dur, MAX_TIMEOUT_MS);
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
      await attemptDelivery(task, run.response);
    }
    handlePostExecution(task, run);
  }

  async function attemptDelivery(
    task: ScheduledTask,
    response: string,
  ): Promise<void> {
    const context = {
      lastDeliveredAt: task.lastDeliveredAt,
      safetyValveMs: 30 * 60 * 1000,
    };
    const result = evaluateResponse(response, context);
    if (result.suppressed) {
      console.log(`[scheduler] suppressed for task ${task.id}: ${result.reason}`);
      return;
    }
    try {
      await deliver(task.targetPlatform, task.targetSenderId, result.cleanedResponse);
      store.updateTask(task.id, { lastDeliveredAt: new Date().toISOString() });
    } catch (e: unknown) {
      console.error(`[scheduler] delivery failed for task ${task.id}:`, e);
    }
  }

  function handlePostExecution(task: ScheduledTask, run: TaskRun): void {
    if (task.scheduleType === "at") {
      store.removeTask(task.id);
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

  function isReadyToFire(task: ScheduledTask): boolean {
    if (!task.nextRunAt) return true;
    return new Date(task.nextRunAt).getTime() <= Date.now() + 1000;
  }

  function scheduleTimer(task: ScheduledTask): void {
    clearExistingTimer(task.id);
    const delay = computeDelayMs(task);
    const timer = setTimeout(() => {
      timers.delete(task.id);
      const current = store.getTask(task.id);
      if (!current || current.status !== "active") return;
      if (!isReadyToFire(current)) {
        scheduleTimer(current);
        return;
      }
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
