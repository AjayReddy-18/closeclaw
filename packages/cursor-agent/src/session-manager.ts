import { mkdir } from "node:fs/promises";
import type { AvailabilityResult } from "./cursor-availability.js";
import type { SessionStore } from "./session-store.js";
import type {
  TaskResult,
  RejectedTool,
  ExecutionMode,
  SessionRecord,
} from "./types.js";
import { DEFAULT_TIMEOUT_MS } from "./types.js";

export interface InteractiveRunParams {
  prompt: string;
  projectDir: string;
  timeoutMs: number;
  forceMode?: boolean;
  resumeSessionId?: string;
}

export interface CursorSessionManagerDeps {
  checkAvailability: () => Promise<AvailabilityResult>;
  runTrust: (
    params: { prompt: string; projectDir: string; timeoutMs: number },
    onProgress: (text: string) => void,
  ) => Promise<TaskResult>;
  runInteractive: (
    params: InteractiveRunParams,
    onProgress: (text: string) => void,
  ) => Promise<TaskResult>;
  sessionStore: SessionStore;
}

export type ApprovalDecision = "approve" | "deny";

export type OnApprovalNeeded = (
  rejected: RejectedTool[],
) => Promise<ApprovalDecision>;

export interface SessionStartParams {
  prompt: string;
  projectDir: string;
  mode: ExecutionMode;
  platform: string;
  senderId: string;
  onProgress: (text: string) => void;
  onApprovalNeeded?: OnApprovalNeeded;
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
  ) => Promise<TaskResult>;
}

function userKey(platform: string, senderId: string): string {
  return `${platform}:${senderId}`;
}

function failResult(message: string): TaskResult {
  return { sessionId: "", status: "failed", summary: message, outputLog: [] };
}

function saveSession(
  deps: CursorSessionManagerDeps,
  result: TaskResult,
  params: SessionStartParams,
): void {
  deps.sessionStore.save({
    id: result.sessionId || crypto.randomUUID(),
    cursorChatId: result.sessionId || "unknown",
    projectDir: params.projectDir,
    prompt: params.prompt,
    status: result.status,
    createdAt: new Date().toISOString(),
  });
}

export function createCursorSessionManager(
  deps: CursorSessionManagerDeps,
): CursorSessionManager {
  const activeSessions = new Set<string>();

  async function runWithApproval(
    params: SessionStartParams,
  ): Promise<TaskResult> {
    const timeout = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    await mkdir(params.projectDir, { recursive: true });
    const result = await deps.runInteractive(
      {
        prompt: params.prompt,
        projectDir: params.projectDir,
        timeoutMs: timeout,
      },
      params.onProgress,
    );
    if (
      !result.rejectedTools?.length ||
      !params.onApprovalNeeded ||
      !result.sessionId
    ) {
      return result;
    }
    params.onProgress(
      `Cursor needs approval to run: ${result.rejectedTools.map((r) => r.command).join(", ")}`,
    );
    const decision = await params.onApprovalNeeded(result.rejectedTools);
    if (decision === "deny") {
      return {
        ...result,
        summary: result.summary + "\n\n(Blocked tools were denied by user.)",
      };
    }
    params.onProgress("Resuming with approval...");
    const resumed = await deps.runInteractive(
      {
        prompt:
          "Continue — the user approved the previously blocked operations. Run them now.",
        projectDir: params.projectDir,
        timeoutMs: timeout,
        forceMode: true,
        resumeSessionId: result.sessionId,
      },
      params.onProgress,
    );
    return {
      sessionId: resumed.sessionId || result.sessionId,
      status: resumed.status,
      summary: resumed.summary,
      outputLog: [...result.outputLog, ...resumed.outputLog],
    };
  }

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
      try {
        const timeout = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        if (params.mode === "trust") {
          await mkdir(params.projectDir, { recursive: true });
          const result = await deps.runTrust(
            {
              prompt: params.prompt,
              projectDir: params.projectDir,
              timeoutMs: timeout,
            },
            params.onProgress,
          );
          saveSession(deps, result, params);
          return result;
        }
        const result = await runWithApproval(params);
        saveSession(deps, result, params);
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

    async resume(chatId, onProgress) {
      const target = chatId
        ? deps.sessionStore.findByCursorChatId(chatId)
        : deps.sessionStore.getMostRecent();
      if (!target) return failResult("No sessions to resume.");
      return deps.runInteractive(
        {
          prompt: `--resume=${target.cursorChatId}`,
          projectDir: target.projectDir,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        },
        onProgress,
      );
    },
  };
}
