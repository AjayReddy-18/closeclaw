import { describe, it, expect } from "vitest";

describe("persistence-serializer", () => {
  async function loadModule() {
    return import("../../../packages/ai-agent/src/persistence-serializer.js");
  }

  const baseMsg = {
    role: "user" as const,
    content: "hello",
    timestamp: new Date("2026-01-01T00:00:00Z"),
  };

  it("messageToFile and back preserves data", async () => {
    const { messageToFile, messageFromFile } = await loadModule();
    const file = messageToFile(baseMsg);
    expect(file.timestamp).toBe("2026-01-01T00:00:00.000Z");
    const restored = messageFromFile(file);
    expect(restored.content).toBe("hello");
    expect(restored.timestamp).toEqual(baseMsg.timestamp);
  });

  it("messageToFile includes toolCallId and toolName when present", async () => {
    const { messageToFile, messageFromFile } = await loadModule();
    const msg = { ...baseMsg, toolCallId: "tc1", toolName: "datetime" };
    const file = messageToFile(msg);
    expect(file.toolCallId).toBe("tc1");
    expect(file.toolName).toBe("datetime");
    const restored = messageFromFile(file);
    expect(restored.toolCallId).toBe("tc1");
  });

  it("summaryToFile and back preserves data", async () => {
    const { summaryToFile, summaryFromFile } = await loadModule();
    const summary = {
      text: "summary",
      messagesCompressed: 5,
      compressedAt: new Date("2026-02-01T00:00:00Z"),
    };
    const file = summaryToFile(summary);
    expect(file.compressedAt).toBe("2026-02-01T00:00:00.000Z");
    const restored = summaryFromFile(file);
    expect(restored.text).toBe("summary");
    expect(restored.messagesCompressed).toBe(5);
  });

  it("conversationToFile includes compressedSummary when present", async () => {
    const { conversationToFile, conversationFromFile } = await loadModule();
    const conv = {
      platform: "telegram",
      senderId: "1",
      senderDisplayName: "Ajay",
      messages: [baseMsg],
      compressedSummary: {
        text: "compressed",
        messagesCompressed: 3,
        compressedAt: new Date("2026-03-01T00:00:00Z"),
      },
      createdAt: new Date("2026-01-01"),
      lastActivityAt: new Date("2026-01-02"),
    };
    const file = conversationToFile(conv);
    expect(file.compressedSummary).toBeDefined();
    expect(file.senderDisplayName).toBe("Ajay");
    const restored = conversationFromFile(file);
    expect(restored.compressedSummary?.text).toBe("compressed");
  });

  it("conversationToFile omits optional fields when absent", async () => {
    const { conversationToFile, conversationFromFile } = await loadModule();
    const conv = {
      platform: "telegram",
      senderId: "1",
      messages: [baseMsg],
      createdAt: new Date("2026-01-01"),
      lastActivityAt: new Date("2026-01-02"),
    };
    const file = conversationToFile(conv);
    expect(file.compressedSummary).toBeUndefined();
    expect(file.senderDisplayName).toBeUndefined();
    const restored = conversationFromFile(file);
    expect(restored.senderDisplayName).toBeUndefined();
  });
});
