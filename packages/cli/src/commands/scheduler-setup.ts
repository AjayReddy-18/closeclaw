import { homedir } from "node:os";
import { join } from "node:path";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { createMessageProcessor } from "@closeclaw/ai-agent";
import {
  createTaskStore,
  createTaskExecutor,
  createTaskScheduler,
  createDynamicScheduleTaskTool,
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

export function createScheduleToolProxy(
  taskStore: TaskStore,
  assemblyRef: { current?: SchedulerAssembly },
  senderRef: { platform: string; senderId: string },
) {
  return createDynamicScheduleTaskTool({
    taskStore,
    scheduler: {
      start: () => {},
      stop: () => {},
      scheduleTask: (t) => assemblyRef.current?.scheduler.scheduleTask(t),
      unscheduleTask: (id) => assemblyRef.current?.scheduler.unscheduleTask(id),
      runNow: (id) =>
        assemblyRef.current?.scheduler.runNow(id) ?? Promise.resolve(undefined),
    },
    getSender: () => senderRef,
  });
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
    await adapter.sendMessage(senderId, text);
  };
}
