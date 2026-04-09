import type { TmuxController } from "./tmux-controller.js";
import type { DetectedPrompt } from "./permission-detector.js";
import type { TaskResult } from "./types.js";
import { POLL_INTERVAL_MS, TMUX_CAPTURE_LINES } from "./types.js";

export interface SafeModeRunnerDeps {
  tmux: TmuxController;
  detectPrompt: (output: string) => DetectedPrompt | null;
  isSessionDone: (output: string) => boolean;
  pollIntervalMs?: number;
}

interface SafeModeParams {
  prompt: string;
  projectDir: string;
  timeoutMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildAgentCommand(prompt: string): string {
  const escaped = prompt.replace(/"/g, '\\"');
  return `agent -p "${escaped}"`;
}

function sessionName(): string {
  return `closeclaw-${Date.now()}`;
}

async function pollLoop(
  name: string,
  deps: SafeModeRunnerDeps,
  timeoutMs: number,
  onProgress: (text: string) => void,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
): Promise<TaskResult> {
  const interval = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastOutput = "";
  const outputLog: string[] = [];

  while (Date.now() < deadline) {
    const output = await deps.tmux.capturePane(name, TMUX_CAPTURE_LINES);
    if (output !== lastOutput) {
      lastOutput = output;
      outputLog.push(output);
      onProgress(output);
    }

    const prompt = deps.detectPrompt(output);
    if (prompt) {
      const decision = await onPermission(prompt.promptText);
      const key = decision === "accept" ? "Y" : "n";
      await deps.tmux.sendKeys(name, key);
    }

    if (deps.isSessionDone(output)) {
      await deps.tmux.killSession(name).catch(() => {});
      return {
        sessionId: "",
        status: "completed",
        summary: lastOutput,
        outputLog,
      };
    }

    await sleep(interval);
  }

  await deps.tmux.killSession(name).catch(() => {});
  return {
    sessionId: "",
    status: "timed_out",
    summary: "Session timed out.",
    outputLog,
  };
}

export async function runSafeMode(
  params: SafeModeParams,
  deps: SafeModeRunnerDeps,
  onProgress: (text: string) => void,
  onPermission: (prompt: string) => Promise<"accept" | "deny">,
): Promise<TaskResult> {
  const name = sessionName();
  await deps.tmux.createSession(name, params.projectDir);
  const command = buildAgentCommand(params.prompt);
  await deps.tmux.sendKeys(name, command);
  await deps.tmux.sendKeys(name, "Enter");
  return pollLoop(name, deps, params.timeoutMs, onProgress, onPermission);
}
