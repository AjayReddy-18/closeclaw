import type {
  PtyHandle,
  PtySpawnFn,
  DetectedPermission,
  TaskResult,
} from "./types.js";
import {
  CURSOR_AGENT_BINARY,
  PROGRESS_THROTTLE_MS,
  APPROVAL_TIMEOUT_MS,
} from "./types.js";
import type { LineBuffer } from "./pty-output-parser.js";
import { createLineBuffer } from "./pty-output-parser.js";

export interface InteractiveRunnerDeps {
  spawnPty: PtySpawnFn;
  stripAnsi: (text: string) => string;
  detectPermission: (lines: string[]) => DetectedPermission | null;
}

interface InteractiveRunParams {
  prompt: string;
  projectDir: string;
  timeoutMs: number;
}

interface PermissionStats {
  requested: number;
  accepted: number;
  denied: number;
}

export interface InteractiveResult extends TaskResult {
  permissionsRequested: number;
  permissionsAccepted: number;
  permissionsDenied: number;
}

export async function runInteractiveMode(
  params: InteractiveRunParams,
  deps: InteractiveRunnerDeps,
  onProgress: (text: string) => void,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
): Promise<InteractiveResult> {
  const handle = deps.spawnPty({
    binary: CURSOR_AGENT_BINARY,
    args: [params.prompt],
    cwd: params.projectDir,
  });
  const lineBuffer = createLineBuffer();
  const outputLog: string[] = [];
  const recentLines: string[] = [];
  const stats: PermissionStats = { requested: 0, accepted: 0, denied: 0 };
  let lastProgressAt = 0;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    handle.kill();
  }, params.timeoutMs);

  const dedup = { lastPromptText: "" };
  setupDataHandler(handle, lineBuffer, deps, recentLines, outputLog, stats, onProgress, onPermission, () => lastProgressAt, (t) => { lastProgressAt = t; }, dedup);

  const exitCode = await waitForExit(handle);
  clearTimeout(timeout);
  flushRemainingBuffer(lineBuffer, deps, outputLog);
  const status = resolveStatus(timedOut, exitCode);
  const summary = buildOutputSummary(outputLog);

  return {
    sessionId: "",
    status,
    summary,
    outputLog,
    permissionsRequested: stats.requested,
    permissionsAccepted: stats.accepted,
    permissionsDenied: stats.denied,
  };
}

interface DedupState {
  lastPromptText: string;
}

function setupDataHandler(
  handle: PtyHandle,
  lineBuffer: LineBuffer,
  deps: InteractiveRunnerDeps,
  recentLines: string[],
  outputLog: string[],
  stats: PermissionStats,
  onProgress: (text: string) => void,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
  getLastProgress: () => number,
  setLastProgress: (t: number) => void,
  dedup: DedupState,
): void {
  handle.onData((rawChunk) => {
    const stripped = deps.stripAnsi(rawChunk);
    const lines = lineBuffer.push(stripped);
    for (const line of lines) {
      outputLog.push(line);
      recentLines.push(line);
      if (recentLines.length > 10) recentLines.shift();
      handleLine(recentLines, deps, handle, stats, onPermission, dedup);
      maybeEmitProgress(line, onProgress, getLastProgress, setLastProgress);
    }
  });
}

function handleLine(
  recentLines: string[],
  deps: InteractiveRunnerDeps,
  handle: PtyHandle,
  stats: PermissionStats,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
  dedup: DedupState,
): void {
  const detected = deps.detectPermission(recentLines);
  if (!detected) return;
  if (detected.promptText === dedup.lastPromptText) return;
  dedup.lastPromptText = detected.promptText;
  stats.requested++;
  handlePermissionPrompt(detected, handle, stats, onPermission);
}

function handlePermissionPrompt(
  detected: DetectedPermission,
  handle: PtyHandle,
  stats: PermissionStats,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
): void {
  const timer = setTimeout(() => {
    stats.denied++;
    handle.write("n\r");
  }, APPROVAL_TIMEOUT_MS);
  onPermission(detected.displayText).then((decision) => {
    clearTimeout(timer);
    if (decision === "accept") {
      stats.accepted++;
      handle.write("Y\r");
    } else {
      stats.denied++;
      handle.write("n\r");
    }
  });
}

function maybeEmitProgress(
  line: string,
  onProgress: (text: string) => void,
  getLastProgress: () => number,
  setLastProgress: (t: number) => void,
): void {
  if (line.trim().length === 0) return;
  const now = Date.now();
  if (now - getLastProgress() < PROGRESS_THROTTLE_MS) return;
  setLastProgress(now);
  onProgress(line.trim());
}

function waitForExit(handle: PtyHandle): Promise<number> {
  return new Promise((resolve) => {
    handle.onExit((info) => resolve(info.exitCode));
  });
}

function flushRemainingBuffer(
  lineBuffer: LineBuffer,
  deps: InteractiveRunnerDeps,
  outputLog: string[],
): void {
  const remaining = lineBuffer.flush();
  if (remaining.trim().length > 0) {
    outputLog.push(deps.stripAnsi(remaining));
  }
}

function resolveStatus(
  timedOut: boolean,
  exitCode: number,
): "completed" | "failed" | "timed_out" {
  if (timedOut) return "timed_out";
  return exitCode === 0 ? "completed" : "failed";
}

function buildOutputSummary(outputLog: string[]): string {
  const meaningful = outputLog.filter((l) => l.trim().length > 0);
  if (meaningful.length === 0) return "Task completed with no output.";
  const last = meaningful[meaningful.length - 1];
  return last.length > 500 ? last.slice(0, 500) + "..." : last;
}
