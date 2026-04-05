import { describe, it, expect, beforeEach } from "vitest";
import { BotPlatform } from "@closeclaw/shared-types";
import { createConversationStore } from "../../../packages/ai-agent/src/conversation-store.js";

describe("createConversationStore", () => {
  let store: ReturnType<typeof createConversationStore>;

  beforeEach(() => {
    store = createConversationStore();
  });

  it("getOrCreate creates new conversation", () => {
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "u1", "Alice");
    expect(c.senderId).toBe("u1");
    expect(c.platform).toBe(BotPlatform.TELEGRAM);
    expect(c.senderDisplayName).toBe("Alice");
    expect(c.messages).toEqual([]);
    expect(store.size()).toBe(1);
  });

  it("getOrCreate returns existing conversation", () => {
    const a = store.getOrCreate(BotPlatform.TELEGRAM, "u1");
    const b = store.getOrCreate(BotPlatform.TELEGRAM, "u1");
    expect(a).toBe(b);
    expect(store.size()).toBe(1);
  });

  it("getOrCreate updates lastActivityAt", async () => {
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "u1");
    const t0 = c.lastActivityAt.getTime();
    await new Promise((r) => setTimeout(r, 15));
    store.getOrCreate(BotPlatform.TELEGRAM, "u1");
    expect(c.lastActivityAt.getTime()).toBeGreaterThan(t0);
  });

  it("getOrCreate updates senderDisplayName when provided", () => {
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "u1");
    store.getOrCreate(BotPlatform.TELEGRAM, "u1", "NewName");
    expect(c.senderDisplayName).toBe("NewName");
  });

  it("get returns undefined for unknown", () => {
    expect(store.get(BotPlatform.TELEGRAM, "x")).toBeUndefined();
  });

  it("clear removes conversation and returns true", () => {
    store.getOrCreate(BotPlatform.TELEGRAM, "u1");
    expect(store.clear(BotPlatform.TELEGRAM, "u1")).toBe(true);
    expect(store.get(BotPlatform.TELEGRAM, "u1")).toBeUndefined();
  });

  it("clear returns false for unknown", () => {
    expect(store.clear(BotPlatform.TELEGRAM, "nope")).toBe(false);
  });

  it("list returns summaries", () => {
    store.getOrCreate(BotPlatform.TELEGRAM, "a", "A");
    store.getOrCreate(BotPlatform.DISCORD, "b");
    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.senderId).sort()).toEqual(["a", "b"]);
  });

  it("list returns empty array when empty", () => {
    expect(store.list()).toEqual([]);
  });

  it("size returns correct count", () => {
    expect(store.size()).toBe(0);
    store.getOrCreate(BotPlatform.TELEGRAM, "1");
    store.getOrCreate(BotPlatform.TELEGRAM, "2");
    expect(store.size()).toBe(2);
  });

  it("pruneStale removes old conversations", () => {
    store.getOrCreate(BotPlatform.TELEGRAM, "old");
    const conv = store.get(BotPlatform.TELEGRAM, "old")!;
    conv.lastActivityAt = new Date(Date.now() - 60_000);
    const pruned = store.pruneStale(30_000);
    expect(pruned).toBe(1);
    expect(store.get(BotPlatform.TELEGRAM, "old")).toBeUndefined();
  });

  it("pruneStale preserves recent conversations", () => {
    store.getOrCreate(BotPlatform.TELEGRAM, "fresh");
    expect(store.pruneStale(3600_000)).toBe(0);
    expect(store.get(BotPlatform.TELEGRAM, "fresh")).toBeDefined();
  });

  it("isolates different senders", () => {
    const a = store.getOrCreate(BotPlatform.TELEGRAM, "a");
    const b = store.getOrCreate(BotPlatform.TELEGRAM, "b");
    expect(a).not.toBe(b);
    expect(store.size()).toBe(2);
  });
});
