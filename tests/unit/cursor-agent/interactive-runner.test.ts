import { describe, it, expect, vi } from "vitest";
import {
  runInteractiveMode,
  type InteractiveRunnerDeps,
  type PtyHandle,
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

function createDeps(
  handle: ReturnType<typeof createMockHandle>,
): InteractiveRunnerDeps {
  return { spawnPty: vi.fn().mockReturnValue(handle) };
}

function jsonLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj) + "\n";
}

describe("runInteractiveMode", () => {
  it("spawns PTY and passes prompt in args", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix lint", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitExit(0);
    await p;
    expect(deps.spawnPty).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["fix lint"]),
      }),
    );
  });

  it("returns completed on exit code 0", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitExit(0);
    const result = await p;
    expect(result.status).toBe("completed");
  });

  it("returns failed on non-zero exit", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitExit(1);
    const result = await p;
    expect(result.status).toBe("failed");
  });

  it("extracts session_id from init event", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitData(
      jsonLine({ type: "system", subtype: "init", session_id: "abc-123" }),
    );
    handle.emitExit(0);
    const result = await p;
    expect(result.sessionId).toBe("abc-123");
  });

  it("fires progress on assistant events", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const progress: string[] = [];
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      (text) => progress.push(text),
    );
    handle.emitData(
      jsonLine({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Analyzing code..." }],
        },
      }),
    );
    handle.emitExit(0);
    await p;
    expect(progress.some((p) => p.includes("Analyzing code"))).toBe(true);
  });

  it("counts tool calls", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitData(
      jsonLine({
        type: "tool_call",
        subtype: "started",
        tool_call: { editToolCall: { args: { path: "/tmp/foo.ts" } } },
      }),
    );
    handle.emitData(
      jsonLine({
        type: "tool_call",
        subtype: "completed",
        tool_call: { editToolCall: {} },
      }),
    );
    handle.emitExit(0);
    const result = await p;
    expect(result.toolCallCount).toBe(1);
  });

  it("collects output lines", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitData(
      jsonLine({ type: "system", subtype: "init", session_id: "s1" }),
    );
    handle.emitData(jsonLine({ type: "result", result: "Done" }));
    handle.emitExit(0);
    const result = await p;
    expect(result.outputLog.length).toBe(2);
  });

  it("builds summary from result event", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    handle.emitData(jsonLine({ type: "result", result: "Created hello.txt" }));
    handle.emitExit(0);
    const result = await p;
    expect(result.summary).toBe("Created hello.txt");
  });

  it("times out and kills process", async () => {
    vi.useFakeTimers();
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 5_000 },
      deps,
      vi.fn(),
    );
    vi.advanceTimersByTime(5_001);
    handle.emitExit(143);
    const result = await p;
    expect(result.status).toBe("timed_out");
    expect(handle.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("includes --force in args when forceMode is true", async () => {
    const handle = createMockHandle();
    const deps = createDeps(handle);
    const p = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000, forceMode: true },
      deps,
      vi.fn(),
    );
    handle.emitExit(0);
    await p;
    const callArgs = (deps.spawnPty as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(callArgs.args).toContain("--force");
  });

  it("returns failed result when PTY spawn throws", async () => {
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockImplementation(() => {
        throw new Error("spawn-helper missing");
      }),
    };
    const result = await runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("failed");
    expect(result.summary).toContain("PTY spawn failed");
  });
});
