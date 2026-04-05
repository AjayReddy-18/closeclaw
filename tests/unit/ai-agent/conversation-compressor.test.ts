import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateText } from "ai";
import {
  createConversationCompressor,
} from "../../../packages/ai-agent/src/conversation-compressor.js";
import type { ConversationFileMessage } from "../../../packages/ai-agent/src/persistence-types.js";

const mockGen = vi.mocked(generateText);

function msgs(n: number): ConversationFileMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: "user" as const,
    content: `msg-${String(i)}`,
    timestamp: new Date(i * 1000).toISOString(),
  }));
}

describe("createConversationCompressor", () => {
  beforeEach(() => {
    mockGen.mockClear();
    mockGen.mockResolvedValue({
      text: "mocked response",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it("shouldCompress returns false when under threshold", () => {
    const c = createConversationCompressor(50, 20);
    expect(c.shouldCompress(49)).toBe(false);
    expect(c.shouldCompress(50)).toBe(false);
  });

  it("shouldCompress returns true when over threshold", () => {
    const c = createConversationCompressor(50, 20);
    expect(c.shouldCompress(51)).toBe(true);
    expect(c.shouldCompress(100)).toBe(true);
  });

  it("compress generates a summary from AI", async () => {
    mockGen.mockResolvedValueOnce({
      text: "Summary of older messages.",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const c = createConversationCompressor(5, 2);
    const summary = await c.compress(msgs(10));
    expect(summary).toBe("Summary of older messages.");
    expect(mockGen).toHaveBeenCalled();
  });

  it("compress includes existing summary in prompt", async () => {
    mockGen.mockResolvedValueOnce({
      text: "Updated summary.",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const c = createConversationCompressor(5, 2);
    await c.compress(msgs(10), "Previous summary text.");
    const call = mockGen.mock.calls[0][0] as Record<string, unknown>;
    const messages = call.messages as Array<{ content: string }>;
    const content = messages.map((m) => m.content).join(" ");
    expect(content).toContain("Previous summary text.");
  });

  it("compress returns empty string when AI returns nothing", async () => {
    mockGen.mockResolvedValueOnce({
      text: "",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
    });
    const c = createConversationCompressor(5, 2);
    const summary = await c.compress(msgs(3));
    expect(summary).toBe("");
  });
});
