import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createConversationPersistence } from "../../../packages/ai-agent/src/conversation-persistence.js";
import type { ConversationFileData } from "../../../packages/ai-agent/src/persistence-types.js";
import { BotPlatform } from "@closeclaw/shared-types";

function sampleFile(): ConversationFileData {
  return {
    platform: "telegram",
    senderId: "42",
    messages: [
      { role: "user", content: "hi", timestamp: "2026-01-01T00:00:00.000Z" },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("createConversationPersistence", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `cc-test-conv-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no file exists", () => {
    const store = createConversationPersistence(dir);
    expect(store.load(BotPlatform.TELEGRAM, "999")).toBeNull();
  });

  it("saves and loads a conversation", () => {
    const store = createConversationPersistence(dir);
    const data = sampleFile();
    store.save(BotPlatform.TELEGRAM, "42", data);
    const loaded = store.load(BotPlatform.TELEGRAM, "42");
    expect(loaded).toEqual(data);
  });

  it("overwrites existing file on save", () => {
    const store = createConversationPersistence(dir);
    store.save(BotPlatform.TELEGRAM, "42", sampleFile());
    const updated = { ...sampleFile(), senderId: "42", senderDisplayName: "A" };
    store.save(BotPlatform.TELEGRAM, "42", updated);
    expect(store.load(BotPlatform.TELEGRAM, "42")).toEqual(updated);
  });

  it("removes a conversation file", () => {
    const store = createConversationPersistence(dir);
    store.save(BotPlatform.TELEGRAM, "42", sampleFile());
    store.remove(BotPlatform.TELEGRAM, "42");
    expect(store.load(BotPlatform.TELEGRAM, "42")).toBeNull();
  });

  it("remove is safe when file does not exist", () => {
    const store = createConversationPersistence(dir);
    expect(() => store.remove(BotPlatform.TELEGRAM, "nope")).not.toThrow();
  });

  it("returns null for corrupted JSON", () => {
    const filePath = join(dir, "telegram-bad.json");
    writeFileSync(filePath, "not json {{{", "utf-8");
    const store = createConversationPersistence(dir);
    expect(store.load(BotPlatform.TELEGRAM, "bad")).toBeNull();
  });

  it("writes atomically via tmp rename", () => {
    const store = createConversationPersistence(dir);
    store.save(BotPlatform.TELEGRAM, "42", sampleFile());
    const raw = readFileSync(join(dir, "telegram-42.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(sampleFile());
  });

  it("creates directory if it does not exist", () => {
    const nested = join(dir, "sub", "deep");
    const store = createConversationPersistence(nested);
    store.save(BotPlatform.DISCORD, "1", sampleFile());
    expect(store.load(BotPlatform.DISCORD, "1")).toEqual(sampleFile());
  });
});
