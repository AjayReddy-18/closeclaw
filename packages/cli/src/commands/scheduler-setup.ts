import { homedir } from "node:os";
import { join } from "node:path";
import { createLiveMessage, type BotAdapter } from "@closeclaw/bot-adapters";
import type { createMessageProcessor } from "@closeclaw/ai-agent";
import {
  createTaskStore,
  createTaskExecutor,
  createTaskScheduler,
  createDynamicScheduleTaskTool,
  createUnscheduleTaskTool,
  createListTasksTool,
  type TaskScheduler,
  type TaskStore,
} from "@closeclaw/ai-agent";

export interface SchedulerAssembly {
  taskStore: TaskStore;
  scheduler: TaskScheduler;
}

export function createSchedulerTaskStore(): TaskStore {
  const storePath = join(homedir(), ".closeclaw", "cron", "tasks.json");
  return createTaskStore(storePath);
}

export function createSchedulerTools(
  taskStore: TaskStore,
  assemblyRef: { current?: SchedulerAssembly },
  senderRef: { platform: string; senderId: string },
): Record<string, unknown> {
  const schedulerProxy = {
    start: () => {},
    stop: () => {},
    scheduleTask: (t: Parameters<TaskScheduler["scheduleTask"]>[0]) =>
      assemblyRef.current?.scheduler.scheduleTask(t),
    unscheduleTask: (id: string) =>
      assemblyRef.current?.scheduler.unscheduleTask(id),
    runNow: (id: string) =>
      assemblyRef.current?.scheduler.runNow(id) ?? Promise.resolve(undefined),
  };
  return {
    schedule_task: createDynamicScheduleTaskTool({
      taskStore,
      scheduler: schedulerProxy,
      getSender: () => senderRef,
    }),
    unschedule_task: createUnscheduleTaskTool({
      taskStore,
      scheduler: schedulerProxy,
    }),
    list_tasks: createListTasksTool({
      taskStore,
      scheduler: schedulerProxy,
    }),
  };
}

export function setupScheduler(
  taskStore: TaskStore,
  processor: ReturnType<typeof createMessageProcessor>,
  adapters: BotAdapter[],
): SchedulerAssembly {
  const executor = createTaskExecutor((platform, senderId, prompt) =>
    processor.processMessage(platform, senderId, prompt),
  );
  const deliver = buildDeliveryFn(adapters);
  const scheduler = createTaskScheduler(taskStore, executor, deliver);
  return { taskStore, scheduler };
}

function buildDeliveryFn(
  adapters: BotAdapter[],
): (platform: string, senderId: string, text: string) => Promise<void> {
  return async (_platform, senderId, text) => {
    const adapter = adapters[0];
    if (!adapter) return;
    if (adapter.editMessage) {
      const live = createLiveMessage({
        sendMessage: (t) => adapter.sendMessage(senderId, t),
        editMessage: (msgId, t) => adapter.editMessage!(senderId, msgId, t),
      });
      live.update("Running scheduled task...");
      await live.finalize(text);
    } else {
      await adapter.sendMessage(senderId, text);
    }
  };
}
