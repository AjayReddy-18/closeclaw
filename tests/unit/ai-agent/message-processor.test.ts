import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateText } from "ai";
import {
  BotPlatform,
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOL_CONFIG,
  type AgentConfig,
} from "@closeclaw/shared-types";
import { createConversationStore } from "../../../packages/ai-agent/src/conversation-store.js";
import {
  createMessageProcessor,
  buildSenderIdentity,
} from "../../../packages/ai-agent/src/message-processor.js";
import {
  AI_ERROR_MESSAGE,
  CLEAR_COMMAND,
  CLEAR_CONFIRMATION,
  EMPTY_RESPONSE_MESSAGE,
} from "../../../packages/ai-agent/src/message-processor-types.js";

function baseConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    provider: "openai",
    model: "gpt-4",
    apiKey: "k",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
    tools: DEFAULT_TOOL_CONFIG,
    ...overrides,
  };
}

describe("createMessageProcessor", () => {
  let store: ReturnType<typeof createConversationStore>;
  const mockGen = vi.mocked(generateText);

  beforeEach(() => {
    store = createConversationStore();
    mockGen.mockClear();
    mockGen.mockResolvedValue({
      text: "mocked response",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it("processMessage returns AI response", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    const r = await p.processMessage(BotPlatform.TELEGRAM, "1", "hello");
    expect(r).toBe("mocked response");
  });

  it("processMessage appends to conversation history", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    await p.processMessage(BotPlatform.TELEGRAM, "hist", "one");
    await p.processMessage(BotPlatform.TELEGRAM, "hist", "two");
    const c = store.get(BotPlatform.TELEGRAM, "hist")!;
    const userMsgs = c.messages.filter((m) => m.role === "user");
    const asst = c.messages.filter((m) => m.role === "assistant");
    expect(userMsgs.map((m) => m.content)).toEqual(["one", "two"]);
    expect(asst).toHaveLength(2);
  });

  it("processMessage handles /clear command", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    await p.processMessage(BotPlatform.TELEGRAM, "clr", "hi");
    const r = await p.processMessage(
      BotPlatform.TELEGRAM,
      "clr",
      CLEAR_COMMAND,
    );
    expect(r).toBe(CLEAR_CONFIRMATION);
    expect(store.get(BotPlatform.TELEGRAM, "clr")).toBeUndefined();
  });

  it("processMessage returns fallback for empty AI response", async () => {
    mockGen.mockResolvedValueOnce({
      text: "",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
    });
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    const r = await p.processMessage(BotPlatform.TELEGRAM, "e", "x");
    expect(r).toBe(EMPTY_RESPONSE_MESSAGE);
  });

  it("processMessage returns error message when AI fails", async () => {
    mockGen.mockRejectedValueOnce(new Error("boom"));
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    const r = await p.processMessage(BotPlatform.TELEGRAM, "err", "x");
    expect(r).toBe(AI_ERROR_MESSAGE);
  });

  it("processMessage passes tools and stopWhen when tools enabled", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig({
        tools: {
          enabled: true,
          allowedTools: ["datetime"],
          maxCallDepth: 5,
          timeoutMs: 30_000,
        },
      }),
      conversationStore: store,
    });
    await p.processMessage(BotPlatform.TELEGRAM, "tools", "hi");
    const lastCall = mockGen.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastCall.tools).toBeDefined();
    expect(lastCall.stopWhen).toBeDefined();
  });

  it("processMessage omits tools when disabled or empty", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig({
        tools: {
          enabled: true,
          allowedTools: [],
          maxCallDepth: 10,
          timeoutMs: 30_000,
        },
      }),
      conversationStore: store,
    });
    await p.processMessage(BotPlatform.TELEGRAM, "no-tools", "x");
    let lastCall = mockGen.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastCall.tools).toBeUndefined();
    expect(lastCall.stopWhen).toBeUndefined();

    const p2 = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    await p2.processMessage(BotPlatform.TELEGRAM, "def", "y");
    lastCall = mockGen.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastCall.tools).toBeUndefined();
  });

  it("processMessage trims context when history is long", async () => {
    const maxTok = 1000;
    const p = createMessageProcessor({
      agentConfig: baseConfig({ maxContextTokens: maxTok }),
      conversationStore: store,
    });
    const long = "x".repeat(5000);
    await p.processMessage(BotPlatform.TELEGRAM, "trim", long);
    await p.processMessage(BotPlatform.TELEGRAM, "trim", "short");
    expect(mockGen).toHaveBeenCalled();
    const lastCall = mockGen.mock.calls.at(-1)![0];
    const msgs = lastCall.messages as { role: string; content: string }[];
    const userContents = msgs
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    expect(userContents.some((c) => c === long)).toBe(false);
    expect(userContents).toContain("short");
  });

  it("retries generateText on rate limit then succeeds", async () => {
    vi.useFakeTimers();
    mockGen
      .mockRejectedValueOnce(
        Object.assign(new Error("rate limit"), { status: 429 }),
      )
      .mockResolvedValueOnce({
        text: "after retry",
        toolCalls: [],
        toolResults: [],
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      });
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    const out = p.processMessage(BotPlatform.TELEGRAM, "rl", "hi");
    await vi.advanceTimersByTimeAsync(1000);
    const r = await out;
    expect(r).toBe("after retry");
    expect(mockGen).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("returns error after rate limit retries exhausted", async () => {
    vi.useFakeTimers();
    const err = Object.assign(new Error("rate limit"), { status: 429 });
    mockGen.mockImplementation(() => Promise.reject(err));
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    const out = p.processMessage(BotPlatform.TELEGRAM, "rl2", "hi");
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    const r = await out;
    expect(r).toBe(AI_ERROR_MESSAGE);
    expect(mockGen).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("does not retry non-rate-limit errors", async () => {
    mockGen.mockRejectedValueOnce(new Error("boom"));
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    const r = await p.processMessage(BotPlatform.TELEGRAM, "nr", "x");
    expect(r).toBe(AI_ERROR_MESSAGE);
    expect(mockGen).toHaveBeenCalledTimes(1);
  });

  it("processes message within half of maxContextTokens", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig({ maxContextTokens: 100 }),
      conversationStore: store,
    });
    const ok = "x".repeat(200);
    const r = await p.processMessage(BotPlatform.TELEGRAM, "len", ok);
    expect(r).toBe("mocked response");
    expect(mockGen).toHaveBeenCalled();
  });

  it("rejects message over half of maxContextTokens with friendly text", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig({ maxContextTokens: 100 }),
      conversationStore: store,
    });
    const tooLong = "x".repeat(201);
    const r = await p.processMessage(BotPlatform.TELEGRAM, "long", tooLong);
    expect(r).toBe(
      "Your message is too long. Please keep it under 200 characters.",
    );
    expect(mockGen).not.toHaveBeenCalled();
  });

  it("injects sender display name into system prompt", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    await p.processMessage(BotPlatform.TELEGRAM, "42", "hi", "Ajay");
    const call = mockGen.mock.calls[0][0];
    const msgs = call.messages as { role: string; content: string }[];
    const system = msgs.find((m) => m.role === "system")!;
    expect(system.content).toContain("Current user: Ajay");
    expect(system.content).toContain("platform: telegram");
    expect(system.content).toContain("id: 42");
  });

  it("falls back to senderId when senderDisplayName is absent", async () => {
    const p = createMessageProcessor({
      agentConfig: baseConfig(),
      conversationStore: store,
    });
    await p.processMessage(BotPlatform.DISCORD, "99", "hey");
    const call = mockGen.mock.calls[0][0];
    const msgs = call.messages as { role: string; content: string }[];
    const system = msgs.find((m) => m.role === "system")!;
    expect(system.content).toContain("Current user: 99");
    expect(system.content).toContain("platform: discord");
  });
});

describe("buildSenderIdentity", () => {
  it("uses display name when provided", () => {
    const result = buildSenderIdentity(BotPlatform.TELEGRAM, "123", "Ajay");
    expect(result).toContain("Current user: Ajay");
    expect(result).toContain("platform: telegram");
    expect(result).toContain("id: 123");
  });

  it("falls back to senderId when no display name", () => {
    const result = buildSenderIdentity(BotPlatform.DISCORD, "456");
    expect(result).toContain("Current user: 456");
    expect(result).toContain("platform: discord");
  });
});
