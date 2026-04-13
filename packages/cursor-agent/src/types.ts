export type ExecutionMode = "safe" | "trust";

export type SessionStatus =
  | "spawning"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface CursorSession {
  id: string;
  cursorChatId: string | undefined;
  tmuxSessionName: string;
  projectDir: string;
  prompt: string;
  mode: ExecutionMode;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | undefined;
  timeoutMs: number;
  platform: string;
  senderId: string;
  outputLog: string[];
}

export interface PermissionRequest {
  sessionId: string;
  promptText: string;
  detectedAt: Date;
  respondedAt: Date | undefined;
  decision: "accept" | "deny" | undefined;
}

export interface SessionRecord {
  id: string;
  cursorChatId: string;
  projectDir: string;
  prompt: string;
  status: SessionStatus;
  createdAt: string;
}

export interface StreamJsonEvent {
  type: "system" | "assistant" | "tool_call" | "result" | "error";
  content?: string;
  toolName?: string;
  status?: string;
}

export interface TaskResult {
  sessionId: string;
  status: SessionStatus;
  summary: string;
  outputLog: string[];
}

export const CURSOR_AGENT_BINARY = "cursor-agent";
export const DEFAULT_TIMEOUT_MS = 600_000;
export const POLL_INTERVAL_MS = 2_000;
export const PROGRESS_THROTTLE_MS = 10_000;
export const HEARTBEAT_SILENCE_MS = 60_000;
export const APPROVAL_TIMEOUT_MS = 120_000;
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const TMUX_CAPTURE_LINES = 50;
