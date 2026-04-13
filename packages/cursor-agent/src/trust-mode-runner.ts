import type { StreamJsonEvent, TaskResult } from "./types.js";

export interface TrustModeRunnerDeps {
  spawnAgent: (
    prompt: string,
    cwd: string,
    timeoutMs: number,
  ) => Promise<{ stdout: string[]; exitCode: number }>;
}

interface TrustModeParams {
  prompt: string;
  projectDir: string;
  timeoutMs: number;
}

function parseEvent(line: string): StreamJsonEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (typeof parsed.type !== "string") return null;
    return parsed as unknown as StreamJsonEvent;
  } catch {
    return null;
  }
}

function buildSummary(events: StreamJsonEvent[]): string {
  const resultEvent = events.find((e) => e.type === "result");
  if (resultEvent?.content) return resultEvent.content;
  const lastAssistant = [...events]
    .reverse()
    .find((e) => e.type === "assistant");
  return lastAssistant?.content ?? "Task completed with no output.";
}

export async function runTrustMode(
  params: TrustModeParams,
  deps: TrustModeRunnerDeps,
  onProgress: (text: string) => void,
): Promise<TaskResult> {
  const { stdout, exitCode } = await deps.spawnAgent(
    params.prompt,
    params.projectDir,
    params.timeoutMs,
  );
  const events: StreamJsonEvent[] = [];
  const outputLog: string[] = [];
  for (const line of stdout) {
    const event = parseEvent(line);
    if (!event) continue;
    events.push(event);
    outputLog.push(line);
    if (event.type === "assistant" && event.content) {
      onProgress(event.content);
    }
    if (event.type === "tool_call") {
      const label = event.toolName ?? "tool";
      outputLog.push(`[${label}] ${event.status ?? ""}`);
    }
  }
  const status = exitCode === 0 ? "completed" : "failed";
  return {
    sessionId: "",
    status,
    summary: buildSummary(events),
    outputLog,
  };
}
