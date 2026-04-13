import { describe, it, expect, vi } from "vitest";
import {
  createCursorSessionManager,
  type CursorSessionManagerDeps,
} from "@closeclaw/cursor-agent";

function createMockDeps(
  overrides: Partial<CursorSessionManagerDeps> = {},
): CursorSessionManagerDeps {
  return {
    checkAvailability: vi.fn().mockResolvedValue({
      agentInstalled: true,
      tmuxInstalled: true,
      available: true,
    }),
    runTrust: vi.fn().mockResolvedValue({
      sessionId: "s1",
      status: "completed",
      summary: "Done",
      outputLog: [],
    }),
    runSafe: vi.fn().mockResolvedValue({
      sessionId: "s1",
      status: "completed",
      summary: "Done",
      outputLog: [],
    }),
    sessionStore: {
      save: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      getMostRecent: vi.fn().mockReturnValue(undefined),
      findByCursorChatId: vi.fn().mockReturnValue(undefined),
      prune: vi.fn(),
      toJSON: vi.fn().mockReturnValue("[]"),
      loadFromJSON: vi.fn(),
    },
    ...overrides,
  };
}

describe("createCursorSessionManager", () => {
  describe("start", () => {
    it("delegates to trust runner in trust mode", async () => {
      const deps = createMockDeps();
      const manager = createCursorSessionManager(deps);
      await manager.start({
        prompt: "fix lint",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user1",
        onProgress: vi.fn(),
        onPermission: vi.fn().mockResolvedValue("accept"),
      });
      expect(deps.runTrust).toHaveBeenCalledOnce();
      expect(deps.runSafe).not.toHaveBeenCalled();
    });

    it("delegates to safe runner in safe mode", async () => {
      const deps = createMockDeps();
      const manager = createCursorSessionManager(deps);
      await manager.start({
        prompt: "refactor auth",
        projectDir: "/tmp",
        mode: "safe",
        platform: "telegram",
        senderId: "user1",
        onProgress: vi.fn(),
        onPermission: vi.fn().mockResolvedValue("accept"),
      });
      expect(deps.runSafe).toHaveBeenCalledOnce();
      expect(deps.runTrust).not.toHaveBeenCalled();
    });

    it("rejects when cursor is not available", async () => {
      const deps = createMockDeps({
        checkAvailability: vi.fn().mockResolvedValue({
          agentInstalled: false,
          tmuxInstalled: true,
          available: false,
        }),
      });
      const manager = createCursorSessionManager(deps);
      const result = await manager.start({
        prompt: "fix",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user1",
        onProgress: vi.fn(),
        onPermission: vi.fn().mockResolvedValue("accept"),
      });
      expect(result.status).toBe("failed");
      expect(result.summary).toContain("not available");
    });

    it("rejects concurrent sessions for same user", async () => {
      let resolveFirst: (v: unknown) => void;
      const longRunning = new Promise((r) => {
        resolveFirst = r;
      });
      const deps = createMockDeps({
        runTrust: vi.fn().mockReturnValue(longRunning),
      });
      const manager = createCursorSessionManager(deps);
      const firstPromise = manager.start({
        prompt: "task 1",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user1",
        onProgress: vi.fn(),
        onPermission: vi.fn().mockResolvedValue("accept"),
      });
      await new Promise((r) => setTimeout(r, 10));
      const second = await manager.start({
        prompt: "task 2",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user1",
        onProgress: vi.fn(),
        onPermission: vi.fn().mockResolvedValue("accept"),
      });
      expect(second.status).toBe("failed");
      expect(second.summary).toContain("already running");
      resolveFirst!({
        sessionId: "s1",
        status: "completed",
        summary: "Done",
        outputLog: [],
      });
      await firstPromise;
    });

    it("saves session record to store", async () => {
      const deps = createMockDeps();
      const manager = createCursorSessionManager(deps);
      await manager.start({
        prompt: "fix lint",
        projectDir: "/tmp",
        mode: "trust",
        platform: "telegram",
        senderId: "user1",
        onProgress: vi.fn(),
        onPermission: vi.fn().mockResolvedValue("accept"),
      });
      expect(deps.sessionStore.save).toHaveBeenCalled();
    });
  });

  describe("getActive", () => {
    it("returns false when no session is active", () => {
      const deps = createMockDeps();
      const manager = createCursorSessionManager(deps);
      expect(manager.getActive("telegram", "user1")).toBe(false);
    });
  });

  describe("listSessions", () => {
    it("delegates to session store", () => {
      const deps = createMockDeps();
      const manager = createCursorSessionManager(deps);
      manager.listSessions();
      expect(deps.sessionStore.list).toHaveBeenCalled();
    });
  });
});
