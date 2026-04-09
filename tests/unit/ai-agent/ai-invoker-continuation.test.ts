import { describe, it, expect, vi } from "vitest";
import { invokeModel } from "../../../packages/ai-agent/src/ai-invoker.js";

function makeConfig() {
  return {
    provider: "anthropic" as const,
    model: "claude-sonnet-4-6",
    systemPrompt: "",
    maxContextTokens: 8192,
    tools: {
      enabled: true,
      allowedTools: [],
      maxCallDepth: 10,
      timeoutMs: 30_000,
    },
  };
}

function makeConversation() {
  return {
    messages: [
      { role: "user" as const, content: "deploy it", timestamp: new Date() },
    ],
  };
}

function fakeResult(text: string, hasToolCalls: boolean) {
  return {
    text,
    steps: hasToolCalls
      ? [{ toolCalls: [{ toolName: "test" }], text }]
      : [{ text }],
    response: { messages: [] },
  };
}

describe("invokeModel continuation loop", () => {
  it("sends intermediate response via callback and continues", async () => {
    const onIntermediate = vi.fn().mockResolvedValue(undefined);
    const gen = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResult("Let me check the deploy folder.", true),
      )
      .mockResolvedValueOnce(
        fakeResult("Here are the deployed services: v1.0, v2.0.", true),
      );

    const conversation = makeConversation();
    const result = await invokeModel(
      conversation,
      gen as never,
      {} as never,
      makeConfig(),
      {},
      undefined,
      undefined,
      undefined,
      onIntermediate,
    );

    expect(gen).toHaveBeenCalledTimes(2);
    expect(onIntermediate).toHaveBeenCalledTimes(1);
    expect(onIntermediate).toHaveBeenCalledWith(
      "Let me check the deploy folder.",
    );
    expect(result).toBe("Here are the deployed services: v1.0, v2.0.");
  });

  it("does not continue when response is a complete answer", async () => {
    const onIntermediate = vi.fn();
    const gen = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResult("Here are all the services deployed in SIT.", true),
      );

    const conversation = makeConversation();
    const result = await invokeModel(
      conversation,
      gen as never,
      {} as never,
      makeConfig(),
      {},
      undefined,
      undefined,
      undefined,
      onIntermediate,
    );

    expect(gen).toHaveBeenCalledTimes(1);
    expect(onIntermediate).not.toHaveBeenCalled();
    expect(result).toBe("Here are all the services deployed in SIT.");
  });

  it("does not continue when there were no tool calls", async () => {
    const onIntermediate = vi.fn();
    const gen = vi
      .fn()
      .mockResolvedValueOnce(fakeResult("Let me check that for you.", false));

    const conversation = makeConversation();
    const result = await invokeModel(
      conversation,
      gen as never,
      {} as never,
      makeConfig(),
      {},
      undefined,
      undefined,
      undefined,
      onIntermediate,
    );

    expect(gen).toHaveBeenCalledTimes(1);
    expect(onIntermediate).not.toHaveBeenCalled();
    expect(result).toBe("Let me check that for you.");
  });

  it("stops after max continuation rounds", async () => {
    const onIntermediate = vi.fn().mockResolvedValue(undefined);
    const gen = vi
      .fn()
      .mockResolvedValue(fakeResult("Let me check more.", true));

    const conversation = makeConversation();
    await invokeModel(
      conversation,
      gen as never,
      {} as never,
      makeConfig(),
      {},
      undefined,
      undefined,
      undefined,
      onIntermediate,
    );

    expect(gen).toHaveBeenCalledTimes(4);
    expect(onIntermediate).toHaveBeenCalledTimes(3);
  });

  it("works without onIntermediate callback", async () => {
    const gen = vi
      .fn()
      .mockResolvedValueOnce(fakeResult("Let me search for that repo.", true))
      .mockResolvedValueOnce(
        fakeResult("Found it! Here are the results.", true),
      );

    const conversation = makeConversation();
    const result = await invokeModel(
      conversation,
      gen as never,
      {} as never,
      makeConfig(),
      {},
    );

    expect(gen).toHaveBeenCalledTimes(2);
    expect(result).toBe("Found it! Here are the results.");
  });

  it("injects continue nudge into conversation history", async () => {
    const gen = vi
      .fn()
      .mockResolvedValueOnce(fakeResult("Let me search for that repo.", true))
      .mockResolvedValueOnce(
        fakeResult("Found it! Here are the results.", true),
      );

    const conversation = makeConversation();
    await invokeModel(
      conversation,
      gen as never,
      {} as never,
      makeConfig(),
      {},
    );

    const nudge = conversation.messages.find(
      (m) => m.role === "user" && m.content.includes("Continue"),
    );
    expect(nudge).toBeDefined();
  });
});
