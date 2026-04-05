import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BotPlatform } from "@closeclaw/shared-types";
import { createConversationPersistence } from "../../../packages/ai-agent/src/conversation-persistence.js";
import { createPersistentConversationStore } from "../../../packages/ai-agent/src/persistent-conversation-store.js";

function makeTmpDir(): string {
  const d = join(tmpdir(), `cc-int-${Date.now()}-${Math.random()}`);
  mkdirSync(d, { recursive: true });
  return d;
}

describe("persistence flow integration", () => {
  let convDir: string;

  beforeEach(() => {
    convDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(convDir, { recursive: true, force: true });
  });

  it("save → new store from same path → messages restored", () => {
    const persistence1 = createConversationPersistence(convDir);
    const store1 = createPersistentConversationStore(persistence1);
    const c = store1.getOrCreate(BotPlatform.TELEGRAM, "42", "Ajay");
    c.messages.push(
      { role: "user", content: "hello", timestamp: new Date() },
      { role: "assistant", content: "hi there", timestamp: new Date() },
    );
    store1.saveToDisk(BotPlatform.TELEGRAM, "42");

    const persistence2 = createConversationPersistence(convDir);
    const store2 = createPersistentConversationStore(persistence2);
    const restored = store2.getOrCreate(BotPlatform.TELEGRAM, "42");
    expect(restored.messages).toHaveLength(2);
    expect(restored.messages[0].content).toBe("hello");
    expect(restored.messages[1].content).toBe("hi there");
    expect(restored.senderDisplayName).toBe("Ajay");
  });

  it("clear persists — new store sees empty conversation", () => {
    const persistence1 = createConversationPersistence(convDir);
    const store1 = createPersistentConversationStore(persistence1);
    const c = store1.getOrCreate(BotPlatform.TELEGRAM, "42");
    c.messages.push({ role: "user", content: "bye", timestamp: new Date() });
    store1.saveToDisk(BotPlatform.TELEGRAM, "42");
    store1.clear(BotPlatform.TELEGRAM, "42");

    const persistence2 = createConversationPersistence(convDir);
    const store2 = createPersistentConversationStore(persistence2);
    const fresh = store2.getOrCreate(BotPlatform.TELEGRAM, "42");
    expect(fresh.messages).toHaveLength(0);
  });

  it("multiple senders restored independently", () => {
    const persistence1 = createConversationPersistence(convDir);
    const store1 = createPersistentConversationStore(persistence1);
    const a = store1.getOrCreate(BotPlatform.TELEGRAM, "1");
    const b = store1.getOrCreate(BotPlatform.DISCORD, "2");
    a.messages.push({ role: "user", content: "a-msg", timestamp: new Date() });
    b.messages.push({ role: "user", content: "b-msg", timestamp: new Date() });
    store1.saveToDisk(BotPlatform.TELEGRAM, "1");
    store1.saveToDisk(BotPlatform.DISCORD, "2");

    const persistence2 = createConversationPersistence(convDir);
    const store2 = createPersistentConversationStore(persistence2);
    expect(
      store2.getOrCreate(BotPlatform.TELEGRAM, "1").messages[0].content,
    ).toBe("a-msg");
    expect(
      store2.getOrCreate(BotPlatform.DISCORD, "2").messages[0].content,
    ).toBe("b-msg");
  });
});
