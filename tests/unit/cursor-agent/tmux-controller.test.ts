import { describe, it, expect, vi } from "vitest";
import {
  createTmuxController,
  type ShellExec,
} from "@closeclaw/cursor-agent";

function createMockShellExec(
  output = "",
): { exec: ShellExec; calls: string[][] } {
  const calls: string[][] = [];
  const exec: ShellExec = async (...args: string[]) => {
    calls.push(args);
    return output;
  };
  return { exec, calls };
}

describe("createTmuxController", () => {
  describe("createSession", () => {
    it("runs tmux new-session with correct args", async () => {
      const { exec, calls } = createMockShellExec();
      const ctrl = createTmuxController(exec);
      await ctrl.createSession("test-session", "/tmp/project");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("new-session");
      expect(calls[0]).toContain("test-session");
      expect(calls[0]).toContain("/tmp/project");
    });
  });

  describe("sendKeys", () => {
    it("runs tmux send-keys with correct args", async () => {
      const { exec, calls } = createMockShellExec();
      const ctrl = createTmuxController(exec);
      await ctrl.sendKeys("test-session", "y");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("send-keys");
      expect(calls[0]).toContain("test-session");
      expect(calls[0]).toContain("y");
    });
  });

  describe("capturePane", () => {
    it("returns captured output", async () => {
      const { exec } = createMockShellExec("line 1\nline 2\nline 3");
      const ctrl = createTmuxController(exec);
      const output = await ctrl.capturePane("test-session", 50);
      expect(output).toBe("line 1\nline 2\nline 3");
    });
  });

  describe("killSession", () => {
    it("runs tmux kill-session", async () => {
      const { exec, calls } = createMockShellExec();
      const ctrl = createTmuxController(exec);
      await ctrl.killSession("test-session");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("kill-session");
    });
  });

  describe("sessionExists", () => {
    it("returns true when session exists", async () => {
      const { exec } = createMockShellExec("test-session: 1 windows");
      const ctrl = createTmuxController(exec);
      const exists = await ctrl.sessionExists("test-session");
      expect(exists).toBe(true);
    });

    it("returns false when exec throws", async () => {
      const exec: ShellExec = async () => {
        throw new Error("no session");
      };
      const ctrl = createTmuxController(exec);
      const exists = await ctrl.sessionExists("nonexistent");
      expect(exists).toBe(false);
    });
  });
});
