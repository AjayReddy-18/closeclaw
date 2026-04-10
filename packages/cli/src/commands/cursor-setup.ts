import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
import {
  checkCursorAvailability,
  createSessionStore,
  createCursorSessionManager,
  createPtySpawner,
  runTrustMode,
  runInteractiveMode,
  stripAnsi,
  detectPtyPermission,
  CURSOR_AGENT_BINARY,
  type SessionStore,
  type CursorSessionManager,
  type SpawnAgentHandle,
} from "@closeclaw/cursor-agent";
import {
  createCursorAgentTool,
  createCursorResumeTool,
} from "@closeclaw/ai-agent";

const execFileAsync = promisify(execFile);

async function whichExists(binary: string): Promise<boolean> {
  try {
    await execFileAsync("which", [binary]);
    return true;
  } catch {
    return false;
  }
}

async function resolveAbsolutePath(binary: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("which", [binary]);
    return stdout.trim();
  } catch {
    return binary;
  }
}

function buildSpawnAgent(absolutePath: string) {
  return (prompt: string, cwd: string, timeoutMs: number): SpawnAgentHandle => {
    const args = [
      "-p",
      "--force",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      prompt,
    ];
    const child = spawn(absolutePath, args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let lineCallback: ((line: string) => void) | undefined;
    let buffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.trim() && lineCallback) lineCallback(part);
      }
    });
    const exitPromise = new Promise<number>((resolve) => {
      child.on("error", () => resolve(1));
      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
      child.on("close", (code: number | null) => {
        clearTimeout(timer);
        if (buffer.trim() && lineCallback) lineCallback(buffer.trim());
        resolve(code ?? 1);
      });
    });
    return {
      onLine: (cb) => {
        lineCallback = cb;
      },
      wait: () => exitPromise,
    };
  };
}

function tryLoadNodePty(): boolean {
  try {
    require("node-pty");
    return true;
  } catch {
    return false;
  }
}

function buildPtySpawner(absolutePath: string) {
  const pty = require("node-pty") as typeof import("node-pty");
  return createPtySpawner((_binary, args, opts) =>
    pty.spawn(absolutePath, args, opts),
  );
}

export interface CursorSetupResult {
  tools: Record<string, unknown>;
  sessionManager: CursorSessionManager;
  sessionStore: SessionStore;
}

function logAvailability(agentInstalled: boolean, ptyAvail: boolean): void {
  if (!agentInstalled) {
    console.log("[cursor] Skipped: cursor-agent binary not found");
    return;
  }
  if (ptyAvail) {
    console.log("[cursor] Interactive PTY mode available");
  } else {
    console.log("[cursor] node-pty not available — trust mode only");
  }
}

export async function setupCursorAgent(): Promise<CursorSetupResult | null> {
  const ptyAvail = tryLoadNodePty();
  const availability = await checkCursorAvailability(
    whichExists,
    () => ptyAvail,
  );
  logAvailability(availability.agentInstalled, availability.ptyAvailable);
  if (!availability.available) return null;
  const agentPath = await resolveAbsolutePath(CURSOR_AGENT_BINARY);
  const sessionStore = createSessionStore();
  const trustDeps = { spawnAgent: buildSpawnAgent(agentPath) };
  const interactiveDeps = ptyAvail
    ? {
        spawnPty: buildPtySpawner(agentPath),
        stripAnsi,
        detectPermission: detectPtyPermission,
      }
    : null;
  const manager = createCursorSessionManager({
    checkAvailability: () =>
      checkCursorAvailability(whichExists, () => ptyAvail),
    runTrust: (params, onProgress) =>
      runTrustMode(params, trustDeps, onProgress),
    runInteractive: interactiveDeps
      ? (params, onProgress, onPermission) =>
          runInteractiveMode(params, interactiveDeps, onProgress, onPermission)
      : (params, onProgress) => runTrustMode(params, trustDeps, onProgress),
    sessionStore,
  });
  return { tools: {}, sessionManager: manager, sessionStore };
}

export function buildCursorTools(
  manager: CursorSessionManager,
  platform: string,
  senderId: string,
  onProgress: (text: string) => void,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
): Record<string, unknown> {
  return {
    cursor_agent: createCursorAgentTool({
      sessionManager: manager,
      onProgress,
      onPermission,
      platform,
      senderId,
    }),
    cursor_resume: createCursorResumeTool({
      sessionManager: manager,
      onProgress,
      onPermission,
    }),
  };
}
