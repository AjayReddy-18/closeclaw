export type ExecutionMode = "interactive" | "trust";

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

export interface RejectedTool {
  command: string;
  description: string;
}

export interface StreamJsonEvent {
  type: string;
  subtype?: string;
  content?: string;
  result?: string;
  timestamp_ms?: number;
  message?: {
    role?: string;
    content?: Array<{ type: string; text?: string }>;
  };
  tool_call?: {
    editToolCall?: {
      args?: { path?: string };
      result?: Record<string, unknown>;
    };
    shellToolCall?: {
      description?: string;
      args?: { command?: string };
      result?: { rejected?: { command?: string; reason?: string } };
    };
    readFileToolCall?: { path?: string };
    description?: string;
    [key: string]: unknown;
  };
  session_id?: string;
}

export interface TaskResult {
  sessionId: string;
  status: SessionStatus;
  summary: string;
  outputLog: string[];
  rejectedTools?: RejectedTool[];
}

export interface PtySpawnOptions {
  binary: string;
  args: string[];
  cwd: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface PtyHandle {
  onData(cb: (data: string) => void): void;
  onExit(cb: (info: { exitCode: number }) => void): void;
  write(data: string): void;
  kill(): void;
}

export type PtySpawnFn = (options: PtySpawnOptions) => PtyHandle;

export interface ProgressEvent {
  type: "text" | "tool" | "status";
  content: string;
  timestamp: number;
}

export interface DetectedPermission {
  promptText: string;
  displayText: string;
}

export interface InteractiveTaskResult {
  sessionId: string;
  status: SessionStatus;
  summary: string;
  outputLog: string[];
  toolCallCount: number;
}

export const CURSOR_AGENT_BINARY = "cursor-agent";
export const DEFAULT_TIMEOUT_MS = 600_000;
export const PROGRESS_THROTTLE_MS = 3_000;
export const APPROVAL_TIMEOUT_MS = 120_000;
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PTY_DEFAULT_COLS = 120;
export const PTY_DEFAULT_ROWS = 40;
