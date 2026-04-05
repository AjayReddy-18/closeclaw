import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateText } from "ai";
import {
  createConversationStore,
  createMessageProcessor,
  AI_ERROR_MESSAGE,
  CLEAR_COMMAND,
  CLEAR_CONFIRMATION,
  EMPTY_RESPONSE_MESSAGE,
} from "@closeclaw/ai-agent";
import {
  BotPlatform,
  DEFAULT_TOOL_CONFIG,
  type AgentConfig,
} from "@closeclaw/shared-types";

describe("agent loop integration", () => {
  let config: AgentConfig;
  const mockGen = vi.mocked(generateText);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGen.mockResolvedValue({
      text: "mocked response",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    config = {
      provider: "ollama",
      model: "llama3.2",
      baseUrl: "http://localhost:11434",
      systemPrompt: "You are a test assistant.",
      maxContextTokens: 8192,
      tools: DEFAULT_TOOL_CONFIG,
    };
  });

  it("processes message and returns AI response", async () => {
    const store = createConversationStore();
    const processor = createMessageProcessor({
      agentConfig: config,
      conversationStore: store,
    });
    const response = await processor.processMessage(
      BotPlatform.TELEGRAM,
      "user1",
      "hello",
    );
    expect(response).toBe("mocked response");
    expect(store.size()).toBe(1);
  });

  it("includes prior user turns in follow-up generateText messages", async () => {
    const store = createConversationStore();
    const processor = createMessageProcessor({
      agentConfig: config,
      conversationStore: store,
    });
    await processor.processMessage(BotPlatform.TELEGRAM, "u2", "first");
    await processor.processMessage(BotPlatform.TELEGRAM, "u2", "second");
    const secondCall = mockGen.mock.calls[1]![0] as {
      messages: { role: string; content: string }[];
    };
    const userTexts = secondCall.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    expect(userTexts).toContain("first");
    expect(userTexts).toContain("second");
  });

  it("handles /clear then fresh context", async () => {
    const store = createConversationStore();
    const processor = createMessageProcessor({
      agentConfig: config,
      conversationStore: store,
    });
    await processor.processMessage(BotPlatform.TELEGRAM, "u3", "before");
    const clearReply = await processor.processMessage(
      BotPlatform.TELEGRAM,
      "u3",
      CLEAR_COMMAND,
    );
    expect(clearReply).toBe(CLEAR_CONFIRMATION);
    expect(store.get(BotPlatform.TELEGRAM, "u3")).toBeUndefined();
    mockGen.mockClear();
    await processor.processMessage(BotPlatform.TELEGRAM, "u3", "after");
    const firstAfterClear = mockGen.mock.calls[0]![0] as {
      messages: { role: string; content: string }[];
    };
    const userTexts = firstAfterClear.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    expect(userTexts).toEqual(["after"]);
  });

  it("uses empty response fallback", async () => {
    mockGen.mockResolvedValueOnce({
      text: "",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
    });
    const processor = createMessageProcessor({
      agentConfig: config,
      conversationStore: createConversationStore(),
    });
    const r = await processor.processMessage(BotPlatform.DISCORD, "e", "x");
    expect(r).toBe(EMPTY_RESPONSE_MESSAGE);
  });

  it("returns AI error message when generateText rejects", async () => {
    mockGen.mockRejectedValueOnce(new Error("provider down"));
    const processor = createMessageProcessor({
      agentConfig: config,
      conversationStore: createConversationStore(),
    });
    const r = await processor.processMessage(BotPlatform.TELEGRAM, "z", "x");
    expect(r).toBe(AI_ERROR_MESSAGE);
  });

  it("wires tools into generateText when tools are enabled", async () => {
    const withTools: AgentConfig = {
      ...config,
      tools: {
        enabled: true,
        allowedTools: ["datetime"],
        maxCallDepth: 3,
        timeoutMs: 30_000,
      },
    };
    const processor = createMessageProcessor({
      agentConfig: withTools,
      conversationStore: createConversationStore(),
    });
    await processor.processMessage(
      BotPlatform.TELEGRAM,
      "tooluser",
      "what time is it",
    );
    const call = mockGen.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.tools).toBeDefined();
    expect(call.maxSteps).toBe(3);
  });
});
