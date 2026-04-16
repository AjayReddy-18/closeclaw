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

const SCHEDULED_PREAMBLE = [
  "[SCHEDULED TASK — automated execution, not a live user message]",
  "You MUST prefix your entire response with exactly one of:",
  "  TASK_COMPLETE: <result>   — if the task finished or a condition was met",
  "  TASK_FAILED: <error>      — if something went wrong",
  "  TASK_IN_PROGRESS: <note>  — if a condition is NOT yet met (this will be silently suppressed)",
  "Do NOT output anything before the prefix. Now execute:\n",
].join("\n");

const TASK_TIMEOUT_MS = 120_000;

function wrapScheduledPrompt(prompt: string): string {
  return `${SCHEDULED_PREAMBLE}${prompt}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Task timed out after ${String(ms)}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function createTaskExecutor(processMessage: ProcessFn): TaskExecutor {
  return {
    async executeTask(task) {
      const start = Date.now();
      try {
        const response = await withTimeout(
          processMessage(
            task.targetPlatform,
            task.targetSenderId,
            wrapScheduledPrompt(task.prompt),
          ),
          TASK_TIMEOUT_MS,
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
