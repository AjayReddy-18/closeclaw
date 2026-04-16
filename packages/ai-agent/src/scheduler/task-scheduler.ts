import type { BotPlatform } from "@closeclaw/shared-types";
import type { ScheduledTask, TaskRun } from "./task-types.js";
import type { TaskStore } from "./task-store.js";
import type { TaskExecutor } from "./task-executor.js";
import { parseDuration } from "./duration-parser.js";
import { nextCronOccurrence } from "./cron-utils.js";
import {
  evaluateResponse,
  DEFAULT_SAFETY_VALVE_MS,
} from "./suppression-filter.js";

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
  const activeTaskIds = new Set<string>();
  let executing = false;
  const queue: ScheduledTask[] = [];

  async function processQueue(): Promise<void> {
    if (executing) return;
    executing = true;
    try {
      while (queue.length > 0) {
        const task = queue.shift()!;
        if (activeTaskIds.has(task.id)) continue;
        activeTaskIds.add(task.id);
        try {
          await executeAndRecord(task);
        } catch {
          safeReschedule(task);
        } finally {
          activeTaskIds.delete(task.id);
        }
      }
    } finally {
      executing = false;
    }
  }

  function safeReschedule(task: ScheduledTask): void {
    try {
      rescheduleRecurring(task);
    } catch (err: unknown) {
      console.error(`[scheduler] reschedule failed for ${task.id}:`, err);
    }
  }

  async function executeAndRecord(task: ScheduledTask): Promise<void> {
    let run: TaskRun;
    try {
      run = await executor.executeTask(task);
    } catch (err: unknown) {
      console.error(`[scheduler] AI call failed for task ${task.id}:`, err);
      throw err;
    }
    store.addRun(run);
    store.updateTask(task.id, {
      lastRunAt: run.ranAt,
      runCount: task.runCount + 1,
    });
    try {
      if (run.outcome === "success" && run.response) {
        await attemptDelivery(task, run.response);
      }
    } catch (err: unknown) {
      console.error(`[scheduler] delivery error for task ${task.id}:`, err);
    }
    handlePostExecution(task, run);
  }

  async function attemptDelivery(
    task: ScheduledTask,
    response: string,
  ): Promise<void> {
    const context = {
      lastDeliveredAt: task.lastDeliveredAt,
      safetyValveMs: DEFAULT_SAFETY_VALVE_MS,
    };
    const result = evaluateResponse(response, context);
    if (result.suppressed) {
      console.log(
        `[scheduler] suppressed for task ${task.id}: ${result.reason}`,
      );
      return;
    }
    try {
      await deliver(
        task.targetPlatform,
        task.targetSenderId,
        result.cleanedResponse,
      );
      store.updateTask(task.id, { lastDeliveredAt: new Date().toISOString() });
    } catch (e: unknown) {
      console.error(`[scheduler] delivery failed for task ${task.id}:`, e);
    }
  }

  function isConditionMet(run: TaskRun): boolean {
    if (!run.response) return false;
    return run.response.trimStart().startsWith("TASK_COMPLETE:");
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
    if (isConditionMet(run)) {
      store.updateTask(task.id, { status: "completed" });
      clearExistingTimer(task.id);
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
    console.log(
      `[scheduler] armed ${task.id} in ${String(Math.round(delay / 1000))}s`,
    );
    const timer = setTimeout(() => {
      timers.delete(task.id);
      const current = store.getTask(task.id);
      if (!current || current.status !== "active") return;
      if (!isReadyToFire(current)) {
        scheduleTimer(current);
        return;
      }
      console.log(`[scheduler] firing ${current.id}`);
      queue.push(current);
      processQueue().catch((err: unknown) => {
        console.error("[scheduler] processQueue crashed:", err);
        executing = false;
      });
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
      const pruned = store.pruneOrphanedRuns();
      if (pruned > 0) {
        console.log(`[scheduler] pruned ${String(pruned)} orphaned run records`);
      }
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
