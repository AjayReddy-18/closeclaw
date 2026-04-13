import type {
  PtyHandle,
  PtySpawnFn,
  RejectedTool,
  StreamJsonEvent,
  TaskResult,
} from "./types.js";
import { CURSOR_AGENT_BINARY, PROGRESS_THROTTLE_MS } from "./types.js";
import { createLineBuffer } from "./pty-output-parser.js";

export interface InteractiveRunnerDeps {
  spawnPty: PtySpawnFn;
}

export interface InteractiveRunParams {
  prompt: string;
  projectDir: string;
  timeoutMs: number;
  binary?: string;
  forceMode?: boolean;
  resumeSessionId?: string;
}

export interface InteractiveResult extends TaskResult {
  toolCallCount: number;
}

export function buildArgs(params: InteractiveRunParams): string[] {
  const args = [
    "-p",
    "--trust",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
  ];
  if (params.forceMode) args.push("--force");
  if (params.resumeSessionId) args.push(`--resume=${params.resumeSessionId}`);
  args.push(params.prompt);
  return args;
}

function tryParseEvent(line: string): StreamJsonEvent | null {
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
  return null;
}

function isPartialDelta(event: StreamJsonEvent): boolean {
  return event.timestamp_ms !== undefined;
}

function extractRejection(event: StreamJsonEvent): RejectedTool | null {
  if (event.type !== "tool_call" || event.subtype !== "completed") return null;
  const rejected = event.tool_call?.shellToolCall?.result?.rejected;
  if (!rejected) return null;
  return {
    command: rejected.command ?? "unknown command",
    description:
      event.tool_call?.shellToolCall?.description ??
      rejected.command ??
      "shell command",
  };
}

function formatToolProgress(event: StreamJsonEvent): string | null {
  const tc = event.tool_call;
  if (!tc || event.subtype !== "started") return null;
  if (tc.editToolCall?.args?.path) {
    const file = tc.editToolCall.args.path.split("/").pop() ?? "file";
    return `Writing ${file}`;
  }
  if (tc.shellToolCall?.args?.command)
    return `Running: ${tc.shellToolCall.args.command}`;
  if (tc.shellToolCall?.description) return tc.shellToolCall.description;
  if (tc.shellToolCall) return "Running shell command";
  if (tc.readFileToolCall?.path) {
    const file = tc.readFileToolCall.path.split("/").pop() ?? "file";
    return `Reading ${file}`;
  }
  return tc.description ?? "Running tool";
}

function failedResult(summary: string): InteractiveResult {
  return {
    sessionId: "",
    status: "failed",
    summary,
    outputLog: [],
    toolCallCount: 0,
  };
}

function buildSummary(events: StreamJsonEvent[]): string {
  const resultEvent = events.find((e) => e.type === "result");
  if (resultEvent) {
    const text = extractText(resultEvent);
    if (text) return text;
  }
  const lastFinal = [...events]
    .reverse()
    .find((e) => e.type === "assistant" && !isPartialDelta(e));
  if (lastFinal) {
    const text = extractText(lastFinal);
    if (text) return text;
  }
  return "Task completed with no output.";
}

export async function runInteractiveMode(
  params: InteractiveRunParams,
  deps: InteractiveRunnerDeps,
  onProgress: (text: string) => void,
): Promise<InteractiveResult> {
  const args = buildArgs(params);
  console.log(`[cursor] Interactive spawn: cwd=${params.projectDir}`);
  let handle: PtyHandle;
  try {
    handle = deps.spawnPty({
      binary: params.binary ?? CURSOR_AGENT_BINARY,
      args,
      cwd: params.projectDir,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failedResult(`PTY spawn failed: ${msg}`);
  }

  const lineBuffer = createLineBuffer();
  const events: StreamJsonEvent[] = [];
  const outputLog: string[] = [];
  const rejectedTools: RejectedTool[] = [];
  let sessionId = "";
  let toolCallCount = 0;
  let lastTextAt = 0;
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    handle.kill();
  }, params.timeoutMs);

  handle.onData((rawChunk) => {
    for (const line of lineBuffer.push(rawChunk)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      outputLog.push(trimmed);
      const event = tryParseEvent(trimmed);
      if (!event) continue;
      events.push(event);
      if (event.session_id && !sessionId) sessionId = event.session_id;
      if (event.type === "tool_call" && event.subtype === "started") {
        toolCallCount++;
        const msg = formatToolProgress(event);
        if (msg) onProgress(msg);
      }
      const rejection = extractRejection(event);
      if (rejection) rejectedTools.push(rejection);
      if (event.type === "assistant" && !isPartialDelta(event)) {
        const text = extractText(event);
        if (text && text.length > 5) {
          const now = Date.now();
          if (now - lastTextAt >= PROGRESS_THROTTLE_MS) {
            lastTextAt = now;
            onProgress(text.length > 300 ? text.slice(0, 300) + "..." : text);
          }
        }
      }
    }
  });

  const exitCode = await waitForExit(handle);
  clearTimeout(timeout);
  const remaining = lineBuffer.flush().trim();
  if (remaining) {
    outputLog.push(remaining);
    const event = tryParseEvent(remaining);
    if (event) events.push(event);
  }

  const status = timedOut
    ? "timed_out"
    : exitCode === 0
      ? "completed"
      : "failed";
  if (events.length === 0 && status === "failed") {
    const raw = outputLog.join(" ").slice(0, 200) || "no output received";
    console.log(
      `[cursor] Interactive failed: exit=${String(exitCode)} raw=${raw}`,
    );
    return failedResult(
      `Cursor agent exited (code ${String(exitCode)}): ${raw}`,
    );
  }
  return {
    sessionId,
    status,
    summary: buildSummary(events),
    outputLog,
    toolCallCount,
    rejectedTools: rejectedTools.length > 0 ? rejectedTools : undefined,
  };
}

function waitForExit(handle: PtyHandle): Promise<number> {
  return new Promise((resolve) => {
    handle.onExit((info) => resolve(info.exitCode));
  });
}
