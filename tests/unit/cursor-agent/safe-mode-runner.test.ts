import { describe, it, expect, vi } from "vitest";
import { runSafeMode, type SafeModeRunnerDeps } from "@closeclaw/cursor-agent";

function createMockDeps(
  overrides: Partial<SafeModeRunnerDeps> = {},
): SafeModeRunnerDeps {
  let captureCallCount = 0;
  return {
    tmux: {
      createSession: vi.fn().mockResolvedValue(undefined),
      sendKeys: vi.fn().mockResolvedValue(undefined),
      capturePane: vi.fn().mockImplementation(async () => {
        captureCallCount++;
        if (captureCallCount >= 3) return "Task completed successfully.";
        return "Working on it...";
      }),
      killSession: vi.fn().mockResolvedValue(undefined),
      sessionExists: vi.fn().mockResolvedValue(true),
    },
    detectPrompt: vi.fn().mockReturnValue(null),
    isSessionDone: vi
      .fn()
      .mockImplementation((output: string) => output.includes("completed")),
    pollIntervalMs: 10,
    ...overrides,
  };
}

describe("runSafeMode", () => {
  it("creates a tmux session and sends the agent command", async () => {
    const deps = createMockDeps();
    await runSafeMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
      vi.fn().mockResolvedValue("accept"),
    );
    expect(deps.tmux.createSession).toHaveBeenCalledOnce();
    expect(deps.tmux.sendKeys).toHaveBeenCalled();
  });

  it("returns completed when session finishes", async () => {
    const deps = createMockDeps();
    const result = await runSafeMode(
      { prompt: "fix lint", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
      vi.fn().mockResolvedValue("accept"),
    );
    expect(result.status).toBe("completed");
  });

  it("detects permission prompt and forwards to user", async () => {
    let captureCount = 0;
    const deps = createMockDeps({
      tmux: {
        createSession: vi.fn().mockResolvedValue(undefined),
        sendKeys: vi.fn().mockResolvedValue(undefined),
        capturePane: vi.fn().mockImplementation(async () => {
          captureCount++;
          if (captureCount === 2) return "Accept  Deny";
          if (captureCount >= 4) return "Task completed successfully.";
          return "Working...";
        }),
        killSession: vi.fn().mockResolvedValue(undefined),
        sessionExists: vi.fn().mockResolvedValue(true),
      },
      detectPrompt: vi.fn().mockImplementation((output: string) => {
        if (output.includes("Accept")) {
          return { promptText: "Edit 3 files?", lineIndex: 0 };
        }
        return null;
      }),
      isSessionDone: vi
        .fn()
        .mockImplementation((output: string) => output.includes("completed")),
      pollIntervalMs: 10,
    });
    const onPermission = vi.fn().mockResolvedValue("accept");
    await runSafeMode(
      { prompt: "refactor", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
      onPermission,
    );
    expect(onPermission).toHaveBeenCalledWith("Edit 3 files?");
  });

  it("sends accept keystroke when user accepts", async () => {
    let captureCount = 0;
    const mockTmux = {
      createSession: vi.fn().mockResolvedValue(undefined),
      sendKeys: vi.fn().mockResolvedValue(undefined),
      capturePane: vi.fn().mockImplementation(async () => {
        captureCount++;
        if (captureCount === 2) return "Accept  Deny";
        if (captureCount >= 4) return "Task completed.";
        return "Working...";
      }),
      killSession: vi.fn().mockResolvedValue(undefined),
      sessionExists: vi.fn().mockResolvedValue(true),
    };
    const deps = createMockDeps({
      tmux: mockTmux,
      detectPrompt: vi.fn().mockImplementation((output: string) => {
        if (output.includes("Accept"))
          return { promptText: "Edit files?", lineIndex: 0 };
        return null;
      }),
      isSessionDone: vi
        .fn()
        .mockImplementation((output: string) => output.includes("completed")),
      pollIntervalMs: 10,
    });
    await runSafeMode(
      { prompt: "refactor", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      vi.fn(),
      vi.fn().mockResolvedValue("accept"),
    );
    const sendKeysCalls = mockTmux.sendKeys.mock.calls;
    const acceptCall = sendKeysCalls.find(
      (c: string[]) => c[1] === "y" || c[1] === "Y",
    );
    expect(acceptCall).toBeDefined();
  });

  it("kills tmux session on timeout", async () => {
    const deps = createMockDeps({
      tmux: {
        createSession: vi.fn().mockResolvedValue(undefined),
        sendKeys: vi.fn().mockResolvedValue(undefined),
        capturePane: vi.fn().mockResolvedValue("Still working..."),
        killSession: vi.fn().mockResolvedValue(undefined),
        sessionExists: vi.fn().mockResolvedValue(true),
      },
      isSessionDone: vi.fn().mockReturnValue(false),
      pollIntervalMs: 10,
    });
    const result = await runSafeMode(
      { prompt: "big task", projectDir: "/tmp/proj", timeoutMs: 100 },
      deps,
      vi.fn(),
      vi.fn().mockResolvedValue("deny"),
    );
    expect(result.status).toBe("timed_out");
    expect(deps.tmux.killSession).toHaveBeenCalled();
  });

  it("calls onProgress with output changes", async () => {
    let captureCount = 0;
    const deps = createMockDeps({
      tmux: {
        createSession: vi.fn().mockResolvedValue(undefined),
        sendKeys: vi.fn().mockResolvedValue(undefined),
        capturePane: vi.fn().mockImplementation(async () => {
          captureCount++;
          if (captureCount === 1) return "Step 1 done";
          if (captureCount === 2) return "Step 2 done";
          return "Task completed.";
        }),
        killSession: vi.fn().mockResolvedValue(undefined),
        sessionExists: vi.fn().mockResolvedValue(true),
      },
      isSessionDone: vi
        .fn()
        .mockImplementation((output: string) => output.includes("completed")),
      pollIntervalMs: 10,
    });
    const onProgress = vi.fn();
    await runSafeMode(
      { prompt: "task", projectDir: "/tmp/proj", timeoutMs: 5000 },
      deps,
      onProgress,
      vi.fn().mockResolvedValue("accept"),
    );
    expect(onProgress).toHaveBeenCalled();
  });
});
