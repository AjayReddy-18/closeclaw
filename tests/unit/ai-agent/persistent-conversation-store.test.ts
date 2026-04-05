import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BotPlatform } from "@closeclaw/shared-types";
import { createPersistentConversationStore } from "../../../packages/ai-agent/src/persistent-conversation-store.js";
import { createConversationPersistence } from "../../../packages/ai-agent/src/conversation-persistence.js";

function makeTmpDir(): string {
  const d = join(tmpdir(), `cc-pcs-${Date.now()}-${Math.random()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

describe("createPersistentConversationStore", () => {
  let convDir: string;

  beforeEach(() => {
    convDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(convDir, { recursive: true, force: true });
  });

  it("getOrCreate returns a new conversation", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "1");
    expect(c.platform).toBe(BotPlatform.TELEGRAM);
    expect(c.senderId).toBe("1");
    expect(c.messages).toHaveLength(0);
  });

  it("getOrCreate loads from disk on first call", () => {
    const persistence = createConversationPersistence(convDir);
    persistence.save(BotPlatform.TELEGRAM, "1", {
      platform: "telegram",
      senderId: "1",
      messages: [
        { role: "user", content: "hi", timestamp: "2026-01-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      lastActivityAt: "2026-01-01T00:00:00.000Z",
    });
    const store = createPersistentConversationStore(persistence);
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "1");
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0].content).toBe("hi");
  });

  it("saveToDisk persists conversation data", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "1");
    c.messages.push({
      role: "user",
      content: "hello",
      timestamp: new Date(),
    });
    store.saveToDisk(BotPlatform.TELEGRAM, "1");
    const loaded = persistence.load(BotPlatform.TELEGRAM, "1");
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe("hello");
  });

  it("clear removes disk file", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    store.getOrCreate(BotPlatform.TELEGRAM, "1");
    store.saveToDisk(BotPlatform.TELEGRAM, "1");
    store.clear(BotPlatform.TELEGRAM, "1");
    expect(persistence.load(BotPlatform.TELEGRAM, "1")).toBeNull();
  });

  it("pruneStale removes disk files for stale conversations", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    const c = store.getOrCreate(BotPlatform.TELEGRAM, "1");
    store.saveToDisk(BotPlatform.TELEGRAM, "1");
    c.lastActivityAt = new Date(Date.now() - 999_999_999);
    const pruned = store.pruneStale(1000);
    expect(pruned).toBe(1);
    expect(persistence.load(BotPlatform.TELEGRAM, "1")).toBeNull();
  });

  it("get returns undefined for unknown sender", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    expect(store.get(BotPlatform.TELEGRAM, "nope")).toBeUndefined();
  });

  it("list returns summaries", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    store.getOrCreate(BotPlatform.TELEGRAM, "1");
    store.getOrCreate(BotPlatform.DISCORD, "2");
    expect(store.list()).toHaveLength(2);
  });

  it("size returns count", () => {
    const persistence = createConversationPersistence(convDir);
    const store = createPersistentConversationStore(persistence);
    store.getOrCreate(BotPlatform.TELEGRAM, "1");
    expect(store.size()).toBe(1);
  });
});
