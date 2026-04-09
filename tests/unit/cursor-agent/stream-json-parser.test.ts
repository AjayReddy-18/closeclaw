import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import {
  parseStreamJsonEvents,
  type StreamJsonEvent,
} from "@closeclaw/cursor-agent";

function streamFromLines(lines: string[]): Readable {
  return Readable.from(lines.map((l) => l + "\n"));
}

describe("parseStreamJsonEvents", () => {
  it("parses a system event", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "system", content: "Starting agent" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("system");
    expect(events[0].content).toBe("Starting agent");
  });

  it("parses an assistant event", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "assistant", content: "I will fix the lint errors" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events[0].type).toBe("assistant");
  });

  it("parses a tool_call event", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "tool_call", toolName: "read_file", status: "started" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events[0].type).toBe("tool_call");
    expect(events[0].toolName).toBe("read_file");
  });

  it("parses a result event", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "result", content: "Task completed" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events[0].type).toBe("result");
  });

  it("parses an error event", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "error", content: "Something went wrong" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events[0].type).toBe("error");
  });

  it("skips malformed JSON lines", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      "not json",
      JSON.stringify({ type: "assistant", content: "valid" }),
      "{broken",
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe("valid");
  });

  it("skips lines with unknown type", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "unknown_type", content: "ignored" }),
      JSON.stringify({ type: "result", content: "done" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("result");
  });

  it("handles multiple events in sequence", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([
      JSON.stringify({ type: "system", content: "init" }),
      JSON.stringify({ type: "assistant", content: "working" }),
      JSON.stringify({ type: "tool_call", toolName: "edit", status: "done" }),
      JSON.stringify({ type: "result", content: "complete" }),
    ]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events).toHaveLength(4);
  });

  it("handles empty stream", async () => {
    const events: StreamJsonEvent[] = [];
    const stream = streamFromLines([]);
    await parseStreamJsonEvents(stream, (e) => events.push(e));
    expect(events).toHaveLength(0);
  });
});
