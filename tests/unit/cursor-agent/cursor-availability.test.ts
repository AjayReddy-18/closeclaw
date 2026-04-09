import { describe, it, expect } from "vitest";
import {
  checkCursorAvailability,
  type ExecWhich,
} from "@closeclaw/cursor-agent";

function createMockExec(results: Record<string, boolean>): ExecWhich {
  return async (binary: string) => results[binary] ?? false;
}

describe("checkCursorAvailability", () => {
  it("returns available when agent and tmux are found", async () => {
    const exec = createMockExec({ agent: true, tmux: true });
    const result = await checkCursorAvailability(exec);
    expect(result.agentInstalled).toBe(true);
    expect(result.tmuxInstalled).toBe(true);
    expect(result.available).toBe(true);
  });

  it("returns unavailable when agent is missing", async () => {
    const exec = createMockExec({ agent: false, tmux: true });
    const result = await checkCursorAvailability(exec);
    expect(result.agentInstalled).toBe(false);
    expect(result.available).toBe(false);
  });

  it("returns unavailable when tmux is missing", async () => {
    const exec = createMockExec({ agent: true, tmux: false });
    const result = await checkCursorAvailability(exec);
    expect(result.tmuxInstalled).toBe(false);
    expect(result.available).toBe(false);
  });

  it("returns unavailable when both are missing", async () => {
    const exec = createMockExec({ agent: false, tmux: false });
    const result = await checkCursorAvailability(exec);
    expect(result.agentInstalled).toBe(false);
    expect(result.tmuxInstalled).toBe(false);
    expect(result.available).toBe(false);
  });

  it("handles exec throwing an error gracefully", async () => {
    const exec: ExecWhich = async () => {
      throw new Error("exec failed");
    };
    const result = await checkCursorAvailability(exec);
    expect(result.available).toBe(false);
  });
});
