import type { TaskStore } from "@closeclaw/ai-agent";

export function runCronRemove(store: TaskStore, taskId: string): void {
  const removed = store.removeTask(taskId);
  if (removed) {
    console.log(`Task ${taskId} removed.`);
  } else {
    console.error(`Task ${taskId} not found.`);
  }
}
