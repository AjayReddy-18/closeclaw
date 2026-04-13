import { describe, it, expect, vi } from "vitest";
import {
  runTrustMode,
  type TrustModeRunnerDeps,
  type SpawnAgentHandle,
} from "@closeclaw/cursor-agent";

function createMockHandle(lines: string[], exitCode: number): SpawnAgentHandle {
  let lineCallback: ((line: string) => void) | undefined;
  return {
    onLine: (cb) => {
      lineCallback = cb;
    },
    wait: () => {
      for (const line of lines) lineCallback?.(line);
      return Promise.resolve(exitCode);
    },
  };
}

function createMockDeps(
  lines: string[] = [],
  exitCode = 0,
): TrustModeRunnerDeps {
  return {
    spawnAgent: vi.fn(() => createMockHandle(lines, exitCode)),
  };
}

describe("runTrustMode", () => {
  it("spawns agent with correct arguments", async () => {
    const deps = createMockDeps(
      [JSON.stringify({ type: "result", result: "Task done" })],
      0,
    );
    await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(deps.spawnAgent).toHaveBeenCalledOnce();
    const call = (deps.spawnAgent as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("fix lint");
    expect(call[1]).toBe("/tmp/proj");
  });

  it("calls onProgress for assistant events", async () => {
    const deps = createMockDeps([
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Working on it" }],
        },
      }),
      JSON.stringify({ type: "result", result: "Done" }),
    ]);
    const onProgress = vi.fn();
    await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      onProgress,
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.stringContaining("Working on it"),
    );
  });

  it("returns completed status on success", async () => {
    const deps = createMockDeps(
      [JSON.stringify({ type: "result", result: "All done" })],
      0,
    );
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("completed");
    expect(result.summary).toContain("All done");
  });

  it("returns failed status on non-zero exit", async () => {
    const deps = createMockDeps(
      [JSON.stringify({ type: "error", content: "Crashed" })],
      1,
    );
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("failed");
  });

  it("collects tool_call events in output log", async () => {
    const deps = createMockDeps([
      JSON.stringify({
        type: "tool_call",
        toolName: "read_file",
        status: "started",
      }),
      JSON.stringify({
        type: "tool_call",
        toolName: "read_file",
        status: "completed",
      }),
      JSON.stringify({ type: "result", content: "Done" }),
    ]);
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.outputLog.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onProgress for tool_call events", async () => {
    const deps = createMockDeps([
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        tool_call: {
          shellToolCall: { description: "Install dependencies" },
        },
      }),
      JSON.stringify({
        type: "result",
        result: "Done",
      }),
    ]);
    const onProgress = vi.fn();
    await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      onProgress,
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.stringContaining("Install dependencies"),
    );
  });

  it("handles empty output gracefully", async () => {
    const deps = createMockDeps([], 0);
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("completed");
  });
});
