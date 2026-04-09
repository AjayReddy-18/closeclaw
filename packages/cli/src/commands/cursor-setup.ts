import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  checkCursorAvailability,
  createSessionStore,
  createCursorSessionManager,
  runTrustMode,
  type SessionStore,
  type CursorSessionManager,
} from "@closeclaw/cursor-agent";
import { createCursorAgentTool } from "@closeclaw/ai-agent";

const execFileAsync = promisify(execFile);

async function whichExists(binary: string): Promise<boolean> {
  try {
    await execFileAsync("which", [binary]);
    return true;
  } catch {
    return false;
  }
}

function buildSpawnAgent() {
  return async (prompt: string, cwd: string, timeoutMs: number) => {
    const { spawn } = await import("node:child_process");
    return new Promise<{ stdout: string[]; exitCode: number }>((resolve) => {
      const args = [
        "-p",
        "--force",
        "--output-format",
        "stream-json",
        "--stream-partial-output",
        prompt,
      ];
      const child = spawn("agent", args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
      const lines: string[] = [];
      let buffer = "";
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (part.trim()) lines.push(part);
        }
      });
      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (buffer.trim()) lines.push(buffer.trim());
        resolve({ stdout: lines, exitCode: code ?? 1 });
      });
    });
  };
}

export interface CursorSetupResult {
  tools: Record<string, unknown>;
  sessionManager: CursorSessionManager;
  sessionStore: SessionStore;
}

export async function setupCursorAgent(): Promise<CursorSetupResult | null> {
  const availability = await checkCursorAvailability(whichExists);
  if (!availability.available) return null;
  const sessionStore = createSessionStore();
  const trustDeps = { spawnAgent: buildSpawnAgent() };
  const manager = createCursorSessionManager({
    checkAvailability: () => checkCursorAvailability(whichExists),
    runTrust: (params, onProgress) => runTrustMode(params, trustDeps, onProgress),
    runSafe: async () => ({
      sessionId: "",
      status: "failed" as const,
      summary: "Safe mode not yet implemented.",
      outputLog: [],
    }),
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
  };
}
