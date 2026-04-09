import { z } from "zod";
import { tool } from "ai";

const THROTTLE_MS = 10_000;

export interface CursorAgentToolDeps {
  sessionManager: {
    start: (params: {
      prompt: string;
      projectDir: string;
      mode: "safe" | "trust";
      platform: string;
      senderId: string;
      onProgress: (text: string) => void;
      onPermission: (prompt: string) => Promise<"accept" | "deny">;
      timeoutMs?: number;
    }) => Promise<{ status: string; summary: string }>;
    cancel: (platform: string, senderId: string) => Promise<void>;
    getActive: (platform: string, senderId: string) => boolean;
    listSessions: () => unknown[];
    resume: (
      chatId: string | undefined,
      onProgress: (text: string) => void,
      onPermission: (prompt: string) => Promise<"accept" | "deny">,
    ) => Promise<{ status: string; summary: string }>;
  };
  onProgress: (text: string) => void;
  onPermission: (prompt: string) => Promise<"accept" | "deny">;
  platform: string;
  senderId: string;
}

const inputSchema = z.object({
  prompt: z.string().describe("The coding task to delegate"),
  projectDir: z.string().describe("Absolute path to the project"),
    mode: z
    .enum(["interactive", "trust"])
    .optional()
    .default("interactive")
    .describe("Execution mode: interactive (PTY with prompts) or trust (--force)"),
});

function throttledProgress(
  send: (text: string) => void,
): (text: string) => void {
  let lastSentAt = 0;
  return (text: string) => {
    const now = Date.now();
    if (now - lastSentAt < THROTTLE_MS) return;
    lastSentAt = now;
    send(text);
  };
}

export function createCursorAgentTool(deps: CursorAgentToolDeps) {
  return tool({
    description:
      "Delegate a coding task to a local Cursor CLI agent. " +
      "Use for refactoring, adding tests, fixing lint, writing code.",
    inputSchema,
    execute: async (params) => {
      deps.onProgress("Delegating to Cursor agent...");
      const onProgress = throttledProgress(deps.onProgress);
      const result = await deps.sessionManager.start({
        prompt: params.prompt,
        projectDir: params.projectDir,
        mode: params.mode ?? "interactive",
        platform: deps.platform,
        senderId: deps.senderId,
        onProgress,
        onPermission: deps.onPermission,
      });
      const label = result.status === "completed" ? "completed" : "failed";
      return `Cursor task ${label}: ${result.summary}`;
    },
  });
}
