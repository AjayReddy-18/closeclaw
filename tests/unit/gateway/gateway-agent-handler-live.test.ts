import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgentResponse, type ToolProgressRef } from "@closeclaw/gateway";
import { BotPlatform } from "@closeclaw/shared-types";

function createMockAdapter() {
  return {
    platform: BotPlatform.TELEGRAM,
    sendMessage: vi.fn().mockResolvedValue({ messageId: 100 }),
    editMessage: vi.fn().mockResolvedValue(true),
    sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
    healthCheck: vi.fn(),
  };
}

function createMockMsg(text = "hello") {
  return {
    platform: BotPlatform.TELEGRAM,
    senderId: "42",
    text,
    timestamp: new Date(),
    senderDisplayName: "TestUser",
  };
}

describe("runAgentResponse with LiveMessage", () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let progressRef: ToolProgressRef;

  beforeEach(() => {
    adapter = createMockAdapter();
    progressRef = { send: () => {} };
  });

  it("sends Thinking message then finalizes with response via edit", async () => {
    const processor = {
      processMessage: vi.fn().mockResolvedValue("Final answer"),
    };
    await runAgentResponse(adapter, processor, createMockMsg(), progressRef);
    const sendCalls = adapter.sendMessage.mock.calls;
    expect(sendCalls[0][1]).toBe("Thinking...");
    expect(adapter.editMessage).toHaveBeenCalledWith("42", 100, "Final answer");
  });

  it("intermediate callback routes through LiveMessage update not sendMessage", async () => {
    let capturedIntermediate: ((text: string) => Promise<void>) | undefined;
    const processor = {
      processMessage: vi.fn(
        async (
          _p: string,
          _s: string,
          _t: string,
          _d?: string,
          onIntermediate?: (text: string) => Promise<void>,
        ) => {
          capturedIntermediate = onIntermediate;
          if (onIntermediate) await onIntermediate("Let me check...");
          return "Done";
        },
      ),
    };
    await runAgentResponse(adapter, processor, createMockMsg(), progressRef);
    expect(capturedIntermediate).toBeDefined();
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
    expect(adapter.sendMessage).toHaveBeenCalledWith("42", "Thinking...");
    expect(adapter.editMessage).toHaveBeenCalledWith("42", 100, "Done");
  });

  it("cursor progress ref updates use editMessage", async () => {
    const processor = {
      processMessage: vi.fn().mockResolvedValue("Result"),
    };
    const responsePromise = runAgentResponse(
      adapter,
      processor,
      createMockMsg(),
      progressRef,
    );
    await new Promise((r) => setTimeout(r, 10));
    progressRef.send("Writing file...");
    await responsePromise;
    expect(adapter.editMessage).toHaveBeenCalled();
  });

  it("finalizes with error message on processing failure", async () => {
    const processor = {
      processMessage: vi.fn().mockRejectedValue(new Error("boom")),
    };
    await runAgentResponse(adapter, processor, createMockMsg(), progressRef);
    const editCalls = adapter.editMessage.mock.calls;
    const lastEdit = editCalls[editCalls.length - 1];
    expect(lastEdit[2]).toContain("trouble thinking");
  });

  it("falls back to sendMessage when editMessage is not available", async () => {
    const adapterNoEdit = {
      ...adapter,
      editMessage: undefined,
    };
    const processor = {
      processMessage: vi.fn().mockResolvedValue("Final answer"),
    };
    await runAgentResponse(
      adapterNoEdit,
      processor,
      createMockMsg(),
      progressRef,
    );
    const sendCalls = adapterNoEdit.sendMessage.mock.calls;
    expect(sendCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("no orphaned Thinking message after success", async () => {
    const processor = {
      processMessage: vi.fn().mockResolvedValue("Answer"),
    };
    await runAgentResponse(adapter, processor, createMockMsg(), progressRef);
    const editCalls = adapter.editMessage.mock.calls;
    const lastEditText = editCalls[editCalls.length - 1][2];
    expect(lastEditText).toBe("Answer");
  });
});
