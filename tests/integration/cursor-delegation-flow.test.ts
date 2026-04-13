import { describe, it, expect, vi } from "vitest";
import {
  createCursorSessionManager,
  createSessionStore,
  type CursorSessionManagerDeps,
} from "@closeclaw/cursor-agent";

function createTestDeps(): CursorSessionManagerDeps {
  return {
    checkAvailability: vi.fn().mockResolvedValue({
      agentInstalled: true,
      ptyAvailable: true,
      available: true,
    }),
    runTrust: vi.fn().mockResolvedValue({
      sessionId: "cursor-chat-123",
      status: "completed",
      summary: "Fixed 5 lint errors in 3 files.",
      outputLog: [
        '{"type":"system","content":"Starting agent"}',
        '{"type":"assistant","content":"Analyzing files..."}',
        '{"type":"result","content":"Fixed 5 lint errors in 3 files."}',
      ],
    }),
    runInteractive: vi.fn().mockResolvedValue({
      sessionId: "cursor-chat-456",
      status: "completed",
      summary: "Refactored auth module.",
      outputLog: [],
    }),
    sessionStore: createSessionStore(),
  };
}

describe("cursor delegation end-to-end flow", () => {
  it("delegates a trust-mode task and receives result", async () => {
    const deps = createTestDeps();
    const manager = createCursorSessionManager(deps);
    const result = await manager.start({
      prompt: "Fix all lint errors in src/",
      projectDir: "/tmp/test-project",
      mode: "trust",
      platform: "telegram",
      senderId: "user-123",
      onProgress: vi.fn(),
    });
    expect(result.status).toBe("completed");
    expect(result.summary).toContain("lint errors");
    expect(deps.runTrust).toHaveBeenCalledOnce();
    expect(deps.runInteractive).not.toHaveBeenCalled();
  });

  it("delegates interactive-mode task to interactive runner", async () => {
    const deps = createTestDeps();
    const manager = createCursorSessionManager(deps);
    const result = await manager.start({
      prompt: "Refactor the auth module",
      projectDir: "/tmp/test-project",
      mode: "interactive",
      platform: "telegram",
      senderId: "user-123",
      onProgress: vi.fn(),
    });
    expect(result.status).toBe("completed");
    expect(deps.runInteractive).toHaveBeenCalledOnce();
    expect(deps.runTrust).not.toHaveBeenCalled();
  });

  it("saves session record after completion", async () => {
    const deps = createTestDeps();
    const manager = createCursorSessionManager(deps);
    await manager.start({
      prompt: "Fix lint",
      projectDir: "/tmp/proj",
      mode: "trust",
      platform: "telegram",
      senderId: "user-1",
      onProgress: vi.fn(),
    });
    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].prompt).toBe("Fix lint");
  });

  it("prevents concurrent sessions for same user", async () => {
    let resolveFirst: (v: unknown) => void;
    const longRunning = new Promise((r) => {
      resolveFirst = r;
    });
    const deps = createTestDeps();
    deps.runTrust = vi.fn().mockReturnValue(longRunning);
    const manager = createCursorSessionManager(deps);
    const firstPromise = manager.start({
      prompt: "task 1",
      projectDir: "/tmp",
      mode: "trust",
      platform: "telegram",
      senderId: "user-1",
      onProgress: vi.fn(),
    });
    await new Promise((r) => setTimeout(r, 10));
    const second = await manager.start({
      prompt: "task 2",
      projectDir: "/tmp",
      mode: "trust",
      platform: "telegram",
      senderId: "user-1",
      onProgress: vi.fn(),
    });
    expect(second.status).toBe("failed");
    expect(second.summary).toContain("already running");
    resolveFirst!({
      sessionId: "",
      status: "completed",
      summary: "done",
      outputLog: [],
    });
    await firstPromise;
  });

  it("allows sessions for different users in parallel", async () => {
    const deps = createTestDeps();
    const manager = createCursorSessionManager(deps);
    const [r1, r2] = await Promise.all([
      manager.start({
        prompt: "task A",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user-1",
        onProgress: vi.fn(),
      }),
      manager.start({
        prompt: "task B",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user-2",
        onProgress: vi.fn(),
      }),
    ]);
    expect(r1.status).toBe("completed");
    expect(r2.status).toBe("completed");
  });

  it("resumes a previous session from store", async () => {
    const deps = createTestDeps();
    const manager = createCursorSessionManager(deps);
    await manager.start({
      prompt: "Fix lint",
      projectDir: "/tmp/proj",
      mode: "trust",
      platform: "telegram",
      senderId: "user-1",
      onProgress: vi.fn(),
    });
    const result = await manager.resume(undefined, vi.fn());
    expect(result.status).toBe("completed");
  });
});
