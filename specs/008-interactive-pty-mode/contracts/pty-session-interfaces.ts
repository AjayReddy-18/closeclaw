/**
 * Contract interfaces for the Interactive PTY Mode feature.
 * These define the boundaries between modules.
 */

// --- PtySpawner contract ---

export interface PtyHandle {
  onData(cb: (data: string) => void): void;
  onExit(cb: (info: { exitCode: number }) => void): void;
  write(data: string): void;
  kill(): void;
  resize(cols: number, rows: number): void;
}

export interface PtySpawnOptions {
  binary: string;
  args: string[];
  cwd: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export type PtySpawnFn = (options: PtySpawnOptions) => PtyHandle;

// --- PtyOutputParser contract ---

export interface ParsedLine {
  raw: string;
  stripped: string;
  isPrompt: boolean;
}

export type StripAnsiFn = (text: string) => string;
export type ExtractLinesFn = (rawChunk: string) => string[];

// --- PtyPermissionDetector contract ---

export interface DetectedPermission {
  promptText: string;
  displayText: string;
}

export type DetectPermissionFn = (
  recentLines: string[],
) => DetectedPermission | null;

// --- InteractiveRunner contract ---

export interface InteractiveRunnerDeps {
  spawnPty: PtySpawnFn;
  stripAnsi: StripAnsiFn;
  detectPermission: DetectPermissionFn;
}

export interface InteractiveRunParams {
  prompt: string;
  projectDir: string;
  timeoutMs: number;
}

export interface InteractiveTaskResult {
  sessionId: string;
  status: "completed" | "failed" | "timed_out" | "cancelled";
  summary: string;
  outputLog: string[];
  permissionsRequested: number;
  permissionsAccepted: number;
  permissionsDenied: number;
}

export type OnProgressFn = (text: string) => void;
export type OnPermissionFn = (
  prompt: string,
) => Promise<"accept" | "deny">;

export type InteractiveRunFn = (
  params: InteractiveRunParams,
  deps: InteractiveRunnerDeps,
  onProgress: OnProgressFn,
  onPermission: OnPermissionFn,
) => Promise<InteractiveTaskResult>;
