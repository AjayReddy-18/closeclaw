import { describe, it, expect, vi } from "vitest";
import {
  createCursorAgentTool,
  type CursorAgentToolDeps,
} from "@closeclaw/ai-agent";

function createMockDeps(
  overrides: Partial<CursorAgentToolDeps> = {},
): CursorAgentToolDeps {
  return {
    sessionManager: {
      start: vi.fn().mockResolvedValue({
        sessionId: "s1",
        status: "completed",
        summary: "Fixed 3 lint errors",
        outputLog: [],
      }),
      cancel: vi.fn(),
      getActive: vi.fn().mockReturnValue(undefined),
      listSessions: vi.fn().mockReturnValue([]),
      resume: vi.fn(),
    },
    onProgress: vi.fn(),
    platform: "telegram",
    senderId: "user1",
    ...overrides,
  };
}

describe("createCursorAgentTool", () => {
  it("returns a tool with correct description", () => {
    const deps = createMockDeps();
    const t = createCursorAgentTool(deps);
    expect(t.description?.toLowerCase()).toContain("delegate");
  });

  it("calls session manager start with params", async () => {
    const deps = createMockDeps();
    const t = createCursorAgentTool(deps);
    const result = await t.execute({
      prompt: "fix lint errors",
      projectDir: "/tmp/proj",
      mode: "trust",
    });
    expect(deps.sessionManager.start).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "fix lint errors",
        projectDir: "/tmp/proj",
        mode: "trust",
      }),
    );
    expect(result).toContain("Fixed 3 lint errors");
  });

  it("defaults mode to interactive when not provided", async () => {
    const deps = createMockDeps();
    const t = createCursorAgentTool(deps);
    await t.execute({
      prompt: "refactor module",
      projectDir: "/tmp/proj",
      mode: undefined as unknown as "interactive",
    });
    expect(deps.sessionManager.start).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "interactive" }),
    );
  });

  it("returns failure message when task fails", async () => {
    const deps = createMockDeps({
      sessionManager: {
        start: vi.fn().mockResolvedValue({
          sessionId: "s1",
          status: "failed",
          summary: "Cursor CLI not available",
          outputLog: [],
        }),
        cancel: vi.fn(),
        getActive: vi.fn().mockReturnValue(undefined),
        listSessions: vi.fn().mockReturnValue([]),
        resume: vi.fn(),
      },
    });
    const t = createCursorAgentTool(deps);
    const result = await t.execute({
      prompt: "fix lint",
      projectDir: "/tmp/proj",
    });
    expect(result).toContain("failed");
  });
});
