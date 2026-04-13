import { describe, it, expect, vi } from "vitest";
import {
  runInteractiveMode,
  type PtyHandle,
  type InteractiveRunnerDeps,
} from "@closeclaw/cursor-agent";

function createMockHandle(): PtyHandle & {
  emitData: (data: string) => void;
  emitExit: (code: number) => void;
} {
  let dataCb: ((data: string) => void) | undefined;
  let exitCb: ((info: { exitCode: number }) => void) | undefined;
  return {
    onData(cb) {
      dataCb = cb;
    },
    onExit(cb) {
      exitCb = cb;
    },
    write: vi.fn(),
    kill: vi.fn(),
    emitData(data) {
      dataCb?.(data);
    },
    emitExit(code) {
      exitCb?.({ exitCode: code });
    },
  };
}

function jsonLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj) + "\n";
}

describe("PTY interactive flow end-to-end", () => {
  it("streams progress from JSON events and completes", async () => {
    const handle = createMockHandle();
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockReturnValue(handle),
    };
    const progress: string[] = [];
    const p = runInteractiveMode(
      { prompt: "build app", projectDir: "/tmp", timeoutMs: 60_000 },
      deps,
      (text) => progress.push(text),
    );

    handle.emitData(
      jsonLine({
        type: "system",
        subtype: "init",
        session_id: "sess-1",
        apiKeySource: "login",
        cwd: "/tmp",
        model: "Opus 4.6",
      }),
    );
    handle.emitData(
      jsonLine({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Creating project..." }],
        },
      }),
    );
    handle.emitData(
      jsonLine({
        type: "tool_call",
        subtype: "started",
        tool_call: { editToolCall: { args: { path: "/tmp/index.ts" } } },
      }),
    );
    handle.emitData(
      jsonLine({
        type: "tool_call",
        subtype: "completed",
        tool_call: { editToolCall: { args: { path: "/tmp/index.ts" } } },
      }),
    );
    handle.emitData(
      jsonLine({
        type: "result",
        subtype: "success",
        result: "Project created successfully",
        session_id: "sess-1",
      }),
    );
    handle.emitExit(0);

    const result = await p;
    expect(result.status).toBe("completed");
    expect(result.sessionId).toBe("sess-1");
    expect(result.toolCallCount).toBe(1);
    expect(result.summary).toBe("Project created successfully");
    expect(progress.length).toBeGreaterThan(0);
  });

  it("handles multi-chunk JSON lines correctly", async () => {
    const handle = createMockHandle();
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockReturnValue(handle),
    };
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 60_000 },
      deps,
      vi.fn(),
    );

    const fullLine = JSON.stringify({
      type: "result",
      result: "All good",
    });
    handle.emitData(fullLine.slice(0, 10));
    handle.emitData(fullLine.slice(10) + "\n");
    handle.emitExit(0);

    const result = await p;
    expect(result.summary).toBe("All good");
  });

  it("handles non-JSON lines gracefully", async () => {
    const handle = createMockHandle();
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockReturnValue(handle),
    };
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 60_000 },
      deps,
      vi.fn(),
    );

    handle.emitData("[?25l\n");
    handle.emitData(jsonLine({ type: "result", result: "Done" }));
    handle.emitData("[?25h\n");
    handle.emitExit(0);

    const result = await p;
    expect(result.status).toBe("completed");
    expect(result.summary).toBe("Done");
  });
});
