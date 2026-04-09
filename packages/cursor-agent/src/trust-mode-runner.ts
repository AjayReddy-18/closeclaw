import type { StreamJsonEvent, TaskResult } from "./types.js";

export interface SpawnAgentHandle {
  onLine: (cb: (line: string) => void) => void;
  wait: () => Promise<number>;
}

export type SpawnAgentFn = (
  prompt: string,
  cwd: string,
  timeoutMs: number,
) => SpawnAgentHandle;

export interface TrustModeRunnerDeps {
  spawnAgent: SpawnAgentFn;
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

function extractText(event: StreamJsonEvent): string | null {
  if (event.message?.content) {
    const textPart = event.message.content.find((c) => c.type === "text");
    if (textPart?.text) return textPart.text;
  }
  if (event.result) return event.result;
  if (event.content) return event.content;
  return null;
}

function formatToolEvent(event: StreamJsonEvent): string | null {
  const tc = event.tool_call;
  if (!tc) return null;
  const desc = tc.shellToolCall?.description ?? tc.description;
  if (event.subtype === "started") {
    const label = desc ?? "Running tool";
    return `⚙ ${label}`;
  }
  return null;
}

function buildSummary(events: StreamJsonEvent[]): string {
  const resultEvent = events.find((e) => e.type === "result");
  if (resultEvent) {
    const text = extractText(resultEvent);
    if (text) return text;
  }
  const lastAssistant = [...events]
    .reverse()
    .find((e) => e.type === "assistant");
  if (lastAssistant) {
    const text = extractText(lastAssistant);
    if (text) return text;
  }
  return "Task completed with no output.";
}

export async function runTrustMode(
  params: TrustModeParams,
  deps: TrustModeRunnerDeps,
  onProgress: (text: string) => void,
): Promise<TaskResult> {
  const handle = deps.spawnAgent(
    params.prompt,
    params.projectDir,
    params.timeoutMs,
  );
  const events: StreamJsonEvent[] = [];
  const outputLog: string[] = [];
  let sessionId = "";

  handle.onLine((line) => {
    const event = parseEvent(line);
    if (!event) return;
    events.push(event);
    outputLog.push(line);
    if (event.session_id && !sessionId) sessionId = event.session_id;
    if (event.type === "assistant") {
      const text = extractText(event);
      if (text) onProgress(text);
    }
    if (event.type === "tool_call") {
      const msg = formatToolEvent(event);
      if (msg) onProgress(msg);
    }
  });

  const exitCode = await handle.wait();
  const status = exitCode === 0 ? "completed" : "failed";
  return {
    sessionId,
    status,
    summary: buildSummary(events),
    outputLog,
  };
}
