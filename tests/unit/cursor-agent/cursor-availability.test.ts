import { describe, it, expect } from "vitest";
import {
  checkCursorAvailability,
  CURSOR_AGENT_BINARY,
  type ExecWhich,
} from "@closeclaw/cursor-agent";

function createMockExec(results: Record<string, boolean>): ExecWhich {
  return async (binary: string) => results[binary] ?? false;
}

describe("checkCursorAvailability", () => {
  it("returns available when cursor-agent found and pty loadable", async () => {
    const exec = createMockExec({ [CURSOR_AGENT_BINARY]: true });
    const result = await checkCursorAvailability(exec, () => true);
    expect(result.agentInstalled).toBe(true);
    expect(result.ptyAvailable).toBe(true);
    expect(result.available).toBe(true);
  });

  it("returns available but pty unavailable when node-pty missing", async () => {
    const exec = createMockExec({ [CURSOR_AGENT_BINARY]: true });
    const result = await checkCursorAvailability(exec, () => false);
    expect(result.agentInstalled).toBe(true);
    expect(result.ptyAvailable).toBe(false);
    expect(result.available).toBe(true);
  });

  it("returns unavailable when cursor-agent is missing", async () => {
    const exec = createMockExec({ [CURSOR_AGENT_BINARY]: false });
    const result = await checkCursorAvailability(exec, () => true);
    expect(result.agentInstalled).toBe(false);
    expect(result.available).toBe(false);
  });

  it("returns fully unavailable when both are missing", async () => {
    const exec = createMockExec({ [CURSOR_AGENT_BINARY]: false });
    const result = await checkCursorAvailability(exec, () => false);
    expect(result.agentInstalled).toBe(false);
    expect(result.ptyAvailable).toBe(false);
    expect(result.available).toBe(false);
  });

  it("handles exec throwing an error gracefully", async () => {
    const exec: ExecWhich = async () => {
      throw new Error("exec failed");
    };
    const result = await checkCursorAvailability(exec, () => false);
    expect(result.available).toBe(false);
  });
});
