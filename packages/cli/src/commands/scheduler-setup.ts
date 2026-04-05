import { homedir } from "node:os";
import { join } from "node:path";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { createMessageProcessor } from "@closeclaw/ai-agent";
import {
  createTaskStore,
  createTaskExecutor,
  createTaskScheduler,
  type TaskScheduler,
  type TaskStore,
} from "@closeclaw/ai-agent";

export interface SchedulerAssembly {
  taskStore: TaskStore;
  scheduler: TaskScheduler;
}

export function setupScheduler(
  processor: ReturnType<typeof createMessageProcessor>,
  adapters: BotAdapter[],
): SchedulerAssembly {
  const baseDir = join(homedir(), ".closeclaw", "cron");
  const taskStorePath = join(baseDir, "tasks.json");
  const taskStore = createTaskStore(taskStorePath);
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
