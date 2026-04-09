import type { AvailabilityResult } from "./cursor-availability.js";
import type { SessionStore } from "./session-store.js";
import type { TaskResult, ExecutionMode, SessionRecord } from "./types.js";
import { DEFAULT_TIMEOUT_MS } from "./types.js";

export interface CursorSessionManagerDeps {
  checkAvailability: () => Promise<AvailabilityResult>;
  runTrust: (
    params: { prompt: string; projectDir: string; timeoutMs: number },
    onProgress: (text: string) => void,
  ) => Promise<TaskResult>;
  runSafe: (
    params: { prompt: string; projectDir: string; timeoutMs: number },
    onProgress: (text: string) => void,
    onPermission: (prompt: string) => Promise<"accept" | "deny">,
  ) => Promise<TaskResult>;
  sessionStore: SessionStore;
}

export interface SessionStartParams {
  prompt: string;
  projectDir: string;
  mode: ExecutionMode;
  platform: string;
  senderId: string;
  onProgress: (text: string) => void;
  onPermission: (prompt: string) => Promise<"accept" | "deny">;
  timeoutMs?: number;
}

export interface CursorSessionManager {
  start(params: SessionStartParams): Promise<TaskResult>;
  cancel(platform: string, senderId: string): Promise<void>;
  getActive(platform: string, senderId: string): boolean;
  listSessions(): SessionRecord[];
  resume: (
    chatId: string | undefined,
    onProgress: (text: string) => void,
    onPermission: (prompt: string) => Promise<"accept" | "deny">,
  ) => Promise<TaskResult>;
}

function userKey(platform: string, senderId: string): string {
  return `${platform}:${senderId}`;
}

function failResult(message: string): TaskResult {
  return { sessionId: "", status: "failed", summary: message, outputLog: [] };
}

export function createCursorSessionManager(
  deps: CursorSessionManagerDeps,
): CursorSessionManager {
  const activeSessions = new Set<string>();

  return {
    async start(params) {
      const key = userKey(params.platform, params.senderId);
      if (activeSessions.has(key)) {
        return failResult("A Cursor task is already running. Cancel it first.");
      }
      const availability = await deps.checkAvailability();
      if (!availability.available) {
        return failResult("Cursor CLI is not available on this machine.");
      }
      activeSessions.add(key);
      const timeout = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      try {
        const runParams = {
          prompt: params.prompt,
          projectDir: params.projectDir,
          timeoutMs: timeout,
        };
        const result =
          params.mode === "trust"
            ? await deps.runTrust(runParams, params.onProgress)
            : await deps.runSafe(
                runParams,
                params.onProgress,
                params.onPermission,
              );
        deps.sessionStore.save({
          id: result.sessionId || crypto.randomUUID(),
          cursorChatId: result.sessionId || "unknown",
          projectDir: params.projectDir,
          prompt: params.prompt,
          status: result.status,
          createdAt: new Date().toISOString(),
        });
        return result;
      } finally {
        activeSessions.delete(key);
      }
    },

    async cancel(platform, senderId) {
      activeSessions.delete(userKey(platform, senderId));
    },

    getActive(platform, senderId) {
      return activeSessions.has(userKey(platform, senderId));
    },

    listSessions() {
      return deps.sessionStore.list();
    },

    async resume(chatId, onProgress, _onPermission) {
      const target = chatId
        ? deps.sessionStore.findByCursorChatId(chatId)
        : deps.sessionStore.getMostRecent();
      if (!target) {
        return failResult("No sessions to resume.");
      }
      const runParams = {
        prompt: `--resume=${target.cursorChatId}`,
        projectDir: target.projectDir,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };
      return deps.runTrust(runParams, onProgress);
    },
  };
}
