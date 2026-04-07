import type { BotPlatform } from "@closeclaw/shared-types";
import type { ScheduledTask, TaskRun } from "./task-types.js";

export interface TaskExecutor {
  executeTask(task: ScheduledTask): Promise<TaskRun>;
}

type ProcessFn = (
  platform: BotPlatform,
  senderId: string,
  prompt: string,
) => Promise<string>;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function createTaskExecutor(processMessage: ProcessFn): TaskExecutor {
  return {
    async executeTask(task) {
      const start = Date.now();
      try {
        const response = await processMessage(
          task.targetPlatform,
          task.targetSenderId,
          task.prompt,
        );
        return {
          taskId: task.id,
          ranAt: new Date().toISOString(),
          outcome: "success",
          response,
          durationMs: Date.now() - start,
          delivered: true,
        };
      } catch (err) {
        return {
          taskId: task.id,
          ranAt: new Date().toISOString(),
          outcome: "failure",
          error: errorMessage(err),
          durationMs: Date.now() - start,
          delivered: false,
        };
      }
    },
  };
}
