import { describe, it, expect, vi } from "vitest";
import {
  createCursorResumeTool,
  type CursorResumeToolDeps,
} from "@closeclaw/ai-agent";

function createMockDeps(
  overrides: Partial<CursorResumeToolDeps> = {},
): CursorResumeToolDeps {
  return {
    sessionManager: {
      resume: vi.fn().mockResolvedValue({
        sessionId: "s1",
        status: "completed",
        summary: "Resumed and finished",
        outputLog: [],
      }),
      listSessions: vi.fn().mockReturnValue([
        {
          id: "r1",
          cursorChatId: "chat-abc",
          projectDir: "/tmp",
          prompt: "fix lint",
          status: "completed",
          createdAt: "2026-04-09T00:00:00Z",
        },
      ]),
    },
    onProgress: vi.fn(),
    onPermission: vi.fn().mockResolvedValue("accept"),
    ...overrides,
  };
}

describe("createCursorResumeTool", () => {
  it("returns a tool with resume description", () => {
    const t = createCursorResumeTool(createMockDeps());
    expect(t.description?.toLowerCase()).toContain("resume");
  });

  it("resumes most recent when chatId is omitted", async () => {
    const deps = createMockDeps();
    const t = createCursorResumeTool(deps);
    const result = await t.execute({});
    expect(deps.sessionManager.resume).toHaveBeenCalledWith(
      undefined,
      expect.any(Function),
      expect.any(Function),
    );
    expect(result).toContain("Resumed and finished");
  });

  it("resumes specific chatId when provided", async () => {
    const deps = createMockDeps();
    const t = createCursorResumeTool(deps);
    await t.execute({ chatId: "chat-abc" });
    expect(deps.sessionManager.resume).toHaveBeenCalledWith(
      "chat-abc",
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("returns failure when no sessions exist", async () => {
    const deps = createMockDeps({
      sessionManager: {
        resume: vi.fn().mockResolvedValue({
          sessionId: "",
          status: "failed",
          summary: "No sessions to resume.",
          outputLog: [],
        }),
        listSessions: vi.fn().mockReturnValue([]),
      },
    });
    const t = createCursorResumeTool(deps);
    const result = await t.execute({});
    expect(result).toContain("failed");
  });
});
