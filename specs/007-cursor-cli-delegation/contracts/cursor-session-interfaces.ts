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

export interface CursorSessionManager {
  start(
    prompt: string,
    projectDir: string,
    mode: ExecutionMode,
    onProgress: (text: string) => Promise<void>,
    onPermission: (prompt: string) => Promise<"accept" | "deny">,
  ): Promise<CursorSession>;
  cancel(sessionId: string): Promise<void>;
  resume(
    cursorChatId: string,
    onProgress: (text: string) => Promise<void>,
    onPermission: (prompt: string) => Promise<"accept" | "deny">,
  ): Promise<CursorSession>;
  listSessions(): SessionRecord[];
  getActive(platform: string, senderId: string): CursorSession | undefined;
}

export interface TmuxController {
  createSession(name: string, cwd: string): Promise<void>;
  sendKeys(name: string, keys: string): Promise<void>;
  capturePane(name: string, lines: number): Promise<string>;
  killSession(name: string): Promise<void>;
  sessionExists(name: string): Promise<boolean>;
}

export interface StreamJsonEvent {
  type: "system" | "assistant" | "tool_call" | "result" | "error";
  content?: string;
  toolName?: string;
  status?: string;
}
