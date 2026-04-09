import { z } from "zod";
import { tool } from "ai";

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
    .enum(["safe", "trust"])
    .optional()
    .default("safe")
    .describe("Execution mode: safe (interactive) or trust (--force)"),
});

export function createCursorAgentTool(deps: CursorAgentToolDeps) {
  return tool({
    description:
      "Delegate a coding task to a local Cursor CLI agent. " +
      "Use for refactoring, adding tests, fixing lint, writing code.",
    inputSchema,
    execute: async (params) => {
      const result = await deps.sessionManager.start({
        prompt: params.prompt,
        projectDir: params.projectDir,
        mode: params.mode ?? "safe",
        platform: deps.platform,
        senderId: deps.senderId,
        onProgress: deps.onProgress,
        onPermission: deps.onPermission,
      });
      const label = result.status === "completed" ? "completed" : "failed";
      return `Cursor task ${label}: ${result.summary}`;
    },
  });
}
