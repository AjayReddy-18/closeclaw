import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  checkCursorAvailability,
  createSessionStore,
  createCursorSessionManager,
  createTmuxController,
  runTrustMode,
  runSafeMode,
  detectPermissionPrompt,
  CURSOR_AGENT_BINARY,
  type SessionStore,
  type CursorSessionManager,
  type ShellExec,
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

export interface CursorSetupResult {
  tools: Record<string, unknown>;
  sessionManager: CursorSessionManager;
  sessionStore: SessionStore;
}

function buildTmuxExec(): ShellExec {
  return async (...args: string[]) => {
    const { stdout } = await execFileAsync(args[0], args.slice(1));
    return stdout;
  };
}

function isSessionDone(output: string): boolean {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 4) return false;
  const hasAgentOutput = lines.some((l) => l.includes(CURSOR_AGENT_BINARY));
  if (!hasAgentOutput) return false;
  const last = lines[lines.length - 1].trim();
  const isShellPrompt = /[$%#]\s*$/.test(last);
  const cmdIdx = lines.findIndex((l) => l.includes(CURSOR_AGENT_BINARY));
  return isShellPrompt && cmdIdx < lines.length - 2;
}

function logAvailability(
  agentInstalled: boolean,
  tmuxInstalled: boolean,
): void {
  if (!agentInstalled) {
    console.log("[cursor] Skipped: cursor-agent binary not found");
    return;
  }
  if (!tmuxInstalled) {
    console.log(
      "[cursor] tmux not found — safe mode disabled, trust mode only",
    );
  }
}

function buildSafeRunner(tmuxAvailable: boolean) {
  if (!tmuxAvailable) {
    return async () => ({
      sessionId: "",
      status: "failed" as const,
      summary: "Safe mode unavailable: tmux is not installed.",
      outputLog: [] as string[],
    });
  }
  const tmux = createTmuxController(buildTmuxExec());
  const safeDeps = {
    tmux,
    detectPrompt: detectPermissionPrompt,
    isSessionDone,
  };
  return (
    params: { prompt: string; projectDir: string; timeoutMs: number },
    onProgress: (text: string) => void,
    onPermission: (prompt: string) => Promise<"accept" | "deny">,
  ) => runSafeMode(params, safeDeps, onProgress, onPermission);
}

export async function setupCursorAgent(): Promise<CursorSetupResult | null> {
  const availability = await checkCursorAvailability(whichExists);
  logAvailability(availability.agentInstalled, availability.tmuxInstalled);
  if (!availability.available) return null;
  const agentPath = await resolveAbsolutePath(CURSOR_AGENT_BINARY);
  const sessionStore = createSessionStore();
  const trustDeps = { spawnAgent: buildSpawnAgent(agentPath) };
  const manager = createCursorSessionManager({
    checkAvailability: () => checkCursorAvailability(whichExists),
    runTrust: (params, onProgress) =>
      runTrustMode(params, trustDeps, onProgress),
    runSafe: buildSafeRunner(availability.safeModeAvailable),
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
