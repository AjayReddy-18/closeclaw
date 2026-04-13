import type { ApprovalQueue } from "./types.js";

type AskFn = (prompt: string) => Promise<"approve" | "deny">;

interface QueueEntry {
  taskLabel: string;
  prompt: string;
  resolve: (value: "approve" | "deny") => void;
  reject: (reason: Error) => void;
}

function formatApprovalPrompt(
  label: string,
  items: Array<{ command: string; description: string }>,
): string {
  const cmds = items.map((i) => `  • ${i.command}`).join("\n");
  return `[${label}] Needs approval:\n${cmds}`;
}

export function createApprovalQueue(askFn: AskFn): ApprovalQueue {
  const queue: QueueEntry[] = [];
  let processing = false;
  let disposed = false;

  async function processNext(): Promise<void> {
    if (processing || queue.length === 0 || disposed) return;
    processing = true;
    const entry = queue.shift()!;
    try {
      const result = await askFn(entry.prompt);
      entry.resolve(result);
    } catch (err) {
      entry.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      processing = false;
      void processNext();
    }
  }

  function enqueue(
    taskId: string,
    items: Array<{ command: string; description: string }>,
  ): Promise<"approve" | "deny"> {
    if (disposed) return Promise.reject(new Error("Queue disposed"));
    const prompt = formatApprovalPrompt(taskId, items);
    return new Promise<"approve" | "deny">((resolve, reject) => {
      queue.push({ taskLabel: taskId, prompt, resolve, reject });
      void processNext();
    });
  }

  function dispose(): void {
    disposed = true;
    const remaining = queue.splice(0);
    for (const entry of remaining) {
      entry.reject(new Error("Approval queue disposed"));
    }
  }

  return { enqueue, dispose };
}
