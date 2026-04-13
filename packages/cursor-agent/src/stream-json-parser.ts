import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import type { StreamJsonEvent } from "./types.js";

const VALID_TYPES = new Set([
  "system",
  "assistant",
  "tool_call",
  "result",
  "error",
]);

function tryParseEvent(line: string): StreamJsonEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (typeof parsed.type !== "string") return null;
    if (!VALID_TYPES.has(parsed.type)) return null;
    return {
      type: parsed.type as StreamJsonEvent["type"],
      content: typeof parsed.content === "string" ? parsed.content : undefined,
      toolName:
        typeof parsed.toolName === "string" ? parsed.toolName : undefined,
      status: typeof parsed.status === "string" ? parsed.status : undefined,
    };
  } catch {
    return null;
  }
}

export async function parseStreamJsonEvents(
  stream: Readable,
  onEvent: (event: StreamJsonEvent) => void,
): Promise<void> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const event = tryParseEvent(trimmed);
    if (event) onEvent(event);
  }
}
