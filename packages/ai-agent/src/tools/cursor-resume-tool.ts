import { z } from "zod";
import { tool } from "ai";

export interface CursorResumeToolDeps {
  sessionManager: {
    resume: (
      chatId: string | undefined,
      onProgress: (text: string) => void,
      onPermission: (prompt: string) => Promise<"accept" | "deny">,
    ) => Promise<{ status: string; summary: string }>;
    listSessions: () => unknown[];
  };
  onProgress: (text: string) => void;
  onPermission: (prompt: string) => Promise<"accept" | "deny">;
}

const inputSchema = z.object({
  chatId: z
    .string()
    .optional()
    .describe("Specific Cursor chat ID to resume. Omit for most recent."),
});

export function createCursorResumeTool(deps: CursorResumeToolDeps) {
  return tool({
    description:
      "Resume a previous Cursor CLI agent session from where it left off.",
    inputSchema,
    execute: async (params) => {
      const result = await deps.sessionManager.resume(
        params.chatId,
        deps.onProgress,
        deps.onPermission,
      );
      const label = result.status === "completed" ? "completed" : "failed";
      return `Cursor resume ${label}: ${result.summary}`;
    },
  });
}
