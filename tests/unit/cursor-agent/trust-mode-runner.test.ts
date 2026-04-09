import { describe, it, expect, vi } from "vitest";
import {
  runTrustMode,
  type TrustModeRunnerDeps,
  type TaskResult,
} from "@closeclaw/cursor-agent";

function createMockDeps(
  overrides: Partial<TrustModeRunnerDeps> = {},
): TrustModeRunnerDeps {
  return {
    spawnAgent: vi.fn().mockResolvedValue({
      stdout: [],
      exitCode: 0,
    }),
    ...overrides,
  };
}

describe("runTrustMode", () => {
  it("spawns agent with correct arguments", async () => {
    const spawnAgent = vi.fn().mockResolvedValue({
      stdout: [
        JSON.stringify({ type: "result", content: "Task done" }),
      ],
      exitCode: 0,
    });
    const deps = createMockDeps({ spawnAgent });
    await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(spawnAgent).toHaveBeenCalledOnce();
    const call = spawnAgent.mock.calls[0];
    expect(call[0]).toContain("fix lint");
    expect(call[1]).toBe("/tmp/proj");
  });

  it("calls onProgress for assistant events", async () => {
    const spawnAgent = vi.fn().mockResolvedValue({
      stdout: [
        JSON.stringify({ type: "assistant", content: "Working on it" }),
        JSON.stringify({ type: "result", content: "Done" }),
      ],
      exitCode: 0,
    });
    const onProgress = vi.fn();
    const deps = createMockDeps({ spawnAgent });
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
    const spawnAgent = vi.fn().mockResolvedValue({
      stdout: [
        JSON.stringify({ type: "result", content: "All done" }),
      ],
      exitCode: 0,
    });
    const deps = createMockDeps({ spawnAgent });
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("completed");
    expect(result.summary).toContain("All done");
  });

  it("returns failed status on non-zero exit", async () => {
    const spawnAgent = vi.fn().mockResolvedValue({
      stdout: [
        JSON.stringify({ type: "error", content: "Crashed" }),
      ],
      exitCode: 1,
    });
    const deps = createMockDeps({ spawnAgent });
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("failed");
  });

  it("collects tool_call events in output log", async () => {
    const spawnAgent = vi.fn().mockResolvedValue({
      stdout: [
        JSON.stringify({ type: "tool_call", toolName: "read_file", status: "started" }),
        JSON.stringify({ type: "tool_call", toolName: "read_file", status: "completed" }),
        JSON.stringify({ type: "result", content: "Done" }),
      ],
      exitCode: 0,
    });
    const deps = createMockDeps({ spawnAgent });
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.outputLog.length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty output gracefully", async () => {
    const spawnAgent = vi.fn().mockResolvedValue({
      stdout: [],
      exitCode: 0,
    });
    const deps = createMockDeps({ spawnAgent });
    const result = await runTrustMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
    );
    expect(result.status).toBe("completed");
  });
});
