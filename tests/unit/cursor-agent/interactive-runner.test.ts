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

function createMockDeps(
  handle: ReturnType<typeof createMockHandle>,
): InteractiveRunnerDeps {
  return {
    spawnPty: vi.fn().mockReturnValue(handle),
    stripAnsi: (text: string) => text,
    detectPermission: vi.fn().mockReturnValue(null),
  };
}

describe("runInteractiveMode", () => {
  it("spawns PTY with correct binary and args", async () => {
    const handle = createMockHandle();
    const deps = createMockDeps(handle);
    const resultPromise = runInteractiveMode(
      { prompt: "fix lint", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
      vi.fn(),
    );
    handle.emitExit(0);
    await resultPromise;
    expect(deps.spawnPty).toHaveBeenCalledWith(
      expect.objectContaining({ args: expect.arrayContaining(["fix lint"]) }),
    );
  });

  it("returns completed status on exit code 0", async () => {
    const handle = createMockHandle();
    const deps = createMockDeps(handle);
    const resultPromise = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
      vi.fn(),
    );
    handle.emitExit(0);
    const result = await resultPromise;
    expect(result.status).toBe("completed");
  });

  it("returns failed status on non-zero exit", async () => {
    const handle = createMockHandle();
    const deps = createMockDeps(handle);
    const resultPromise = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
      vi.fn(),
    );
    handle.emitExit(1);
    const result = await resultPromise;
    expect(result.status).toBe("failed");
  });

  it("fires onProgress with stripped output lines", async () => {
    const handle = createMockHandle();
    const deps = createMockDeps(handle);
    const progress: string[] = [];
    const resultPromise = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      (text) => progress.push(text),
      vi.fn(),
    );
    handle.emitData("Analyzing code...\n");
    handle.emitExit(0);
    await resultPromise;
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.some((p) => p.includes("Analyzing code"))).toBe(true);
  });

  it("collects output lines in outputLog", async () => {
    const handle = createMockHandle();
    const deps = createMockDeps(handle);
    const resultPromise = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 30_000 },
      deps,
      vi.fn(),
      vi.fn(),
    );
    handle.emitData("line one\nline two\n");
    handle.emitExit(0);
    const result = await resultPromise;
    expect(result.outputLog).toContain("line one");
    expect(result.outputLog).toContain("line two");
  });

  it("times out and kills process after deadline", async () => {
    vi.useFakeTimers();
    const handle = createMockHandle();
    const deps = createMockDeps(handle);
    const resultPromise = runInteractiveMode(
      { prompt: "fix", projectDir: "/tmp", timeoutMs: 5_000 },
      deps,
      vi.fn(),
      vi.fn(),
    );
    vi.advanceTimersByTime(5_001);
    handle.emitExit(143);
    const result = await resultPromise;
    expect(result.status).toBe("timed_out");
    expect(handle.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
