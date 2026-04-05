import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateText } from "ai";
import { createMemoryFlusher } from "../../../packages/ai-agent/src/memory-flush.js";
import type { PreferenceStore } from "../../../packages/ai-agent/src/preference-store.js";
import type { ConversationFileMessage } from "../../../packages/ai-agent/src/persistence-types.js";
import { BotPlatform } from "@closeclaw/shared-types";

const mockGen = vi.mocked(generateText);

function mockPrefStore(): PreferenceStore {
  return {
    load: vi.fn().mockReturnValue(null),
    save: vi.fn(),
    upsertPreference: vi.fn(),
    removePreference: vi.fn(),
  };
}

function msgs(n: number): ConversationFileMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: "user" as const,
    content: `msg-${String(i)}`,
    timestamp: new Date(i * 1000).toISOString(),
  }));
}

describe("createMemoryFlusher", () => {
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

  it("extracts preferences from AI response and writes to store", async () => {
    const jsonResponse = JSON.stringify([
      { key: "name", value: "Ajay" },
      { key: "tz", value: "IST" },
    ]);
    mockGen.mockResolvedValueOnce({
      text: jsonResponse,
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const store = mockPrefStore();
    const flusher = createMemoryFlusher(store);
    const result = await flusher.flush(BotPlatform.TELEGRAM, "1", msgs(5));
    expect(result).toHaveLength(2);
    expect(store.upsertPreference).toHaveBeenCalledTimes(2);
    expect(store.upsertPreference).toHaveBeenCalledWith(
      BotPlatform.TELEGRAM,
      "1",
      "name",
      "Ajay",
    );
  });

  it("returns empty array when AI returns no preferences", async () => {
    mockGen.mockResolvedValueOnce({
      text: "[]",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
    });
    const store = mockPrefStore();
    const flusher = createMemoryFlusher(store);
    const result = await flusher.flush(BotPlatform.TELEGRAM, "1", msgs(3));
    expect(result).toHaveLength(0);
    expect(store.upsertPreference).not.toHaveBeenCalled();
  });

  it("returns empty array on AI error without blocking", async () => {
    mockGen.mockRejectedValueOnce(new Error("AI down"));
    const store = mockPrefStore();
    const flusher = createMemoryFlusher(store);
    const result = await flusher.flush(BotPlatform.TELEGRAM, "1", msgs(3));
    expect(result).toHaveLength(0);
  });

  it("handles malformed JSON from AI gracefully", async () => {
    mockGen.mockResolvedValueOnce({
      text: "not valid json {",
      toolCalls: [],
      toolResults: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const store = mockPrefStore();
    const flusher = createMemoryFlusher(store);
    const result = await flusher.flush(BotPlatform.TELEGRAM, "1", msgs(3));
    expect(result).toHaveLength(0);
  });
});
