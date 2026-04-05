import type { BotPlatform } from "@closeclaw/shared-types";
import type {
  Conversation,
  ConversationStore,
  ConversationSummary,
} from "./conversation-types.js";
import { conversationKey } from "./conversation-types.js";
import { createConversationStore } from "./conversation-store.js";
import type { ConversationPersistence } from "./conversation-persistence.js";
import type { ConversationCompressor } from "./conversation-compressor.js";
import type { MemoryFlusher } from "./memory-flush.js";
import {
  conversationFromFile,
  conversationToFile,
  messageToFile,
} from "./persistence-serializer.js";

export interface PersistentConversationStore extends ConversationStore {
  saveToDisk(platform: BotPlatform, senderId: string): void;
}

export interface PersistentStoreOptions {
  persistence: ConversationPersistence;
  compressor?: ConversationCompressor;
  flusher?: MemoryFlusher;
}

export function createPersistentConversationStore(
  persistenceOrOpts: ConversationPersistence | PersistentStoreOptions,
): PersistentConversationStore {
  const opts = isPersistenceOnly(persistenceOrOpts)
    ? { persistence: persistenceOrOpts }
    : persistenceOrOpts;
  const { persistence, compressor, flusher } = opts;
  const inner = createConversationStore();
  const loaded = new Set<string>();

  function tryLoadFromDisk(
    platform: BotPlatform,
    senderId: string,
  ): Conversation | undefined {
    const key = conversationKey(platform, senderId);
    if (loaded.has(key)) return undefined;
    loaded.add(key);
    const data = persistence.load(platform, senderId);
    if (!data) return undefined;
    return conversationFromFile(data);
  }

  function hydrateInner(
    platform: BotPlatform, senderId: string, disk: Conversation,
  ): Conversation {
    const c = inner.getOrCreate(platform, senderId, disk.senderDisplayName);
    c.messages = disk.messages;
    c.compressedSummary = disk.compressedSummary;
    c.createdAt = disk.createdAt;
    c.lastActivityAt = disk.lastActivityAt;
    return c;
  }

  function getOrCreate(
    platform: BotPlatform, senderId: string, senderDisplayName?: string,
  ): Conversation {
    const disk = tryLoadFromDisk(platform, senderId);
    if (disk) return hydrateInner(platform, senderId, disk);
    return inner.getOrCreate(platform, senderId, senderDisplayName);
  }

  function get(p: BotPlatform, s: string): Conversation | undefined {
    return inner.get(p, s);
  }

  function clear(platform: BotPlatform, senderId: string): boolean {
    persistence.remove(platform, senderId);
    loaded.delete(conversationKey(platform, senderId));
    return inner.clear(platform, senderId);
  }

  function list(): ConversationSummary[] {
    return inner.list();
  }

  function pruneStale(maxAgeMs: number): number {
    const stale = findStaleKeys(maxAgeMs);
    for (const { platform, senderId } of stale) {
      persistence.remove(platform, senderId);
      loaded.delete(conversationKey(platform, senderId));
    }
    return inner.pruneStale(maxAgeMs);
  }

  function findStaleKeys(
    maxAgeMs: number,
  ): { platform: BotPlatform; senderId: string }[] {
    const cutoff = Date.now() - maxAgeMs;
    return inner.list()
      .filter((s) => s.lastActivityAt.getTime() < cutoff)
      .map((s) => ({ platform: s.platform, senderId: s.senderId }));
  }

  function size(): number {
    return inner.size();
  }

  function saveToDisk(platform: BotPlatform, senderId: string): void {
    const c = inner.get(platform, senderId);
    if (!c) return;
    persistence.save(platform, senderId, conversationToFile(c));
    maybeCompress(platform, senderId, c);
  }

  function maybeCompress(
    platform: BotPlatform, senderId: string, c: Conversation,
  ): void {
    if (!compressor || !compressor.shouldCompress(c.messages.length)) return;
    queueMicrotask(() => void runCompression(platform, senderId, c));
  }

  async function runCompression(
    platform: BotPlatform, senderId: string, c: Conversation,
  ): Promise<void> {
    try {
      if (flusher) await flushBeforeCompress(platform, senderId, c);
      await compressMessages(platform, senderId, c);
    } catch (err) {
      console.error("[ai-agent] Compression failed:", err);
    }
  }

  async function flushBeforeCompress(
    platform: BotPlatform, senderId: string, c: Conversation,
  ): Promise<void> {
    if (!flusher) return;
    const toCompress = c.messages.slice(0, -keepRecentCount(c));
    const fileMessages = toCompress.map(messageToFile);
    try {
      await flusher.flush(platform, senderId, fileMessages);
    } catch {
      void 0;
    }
  }

  function keepRecentCount(c: Conversation): number {
    return Math.min(c.messages.length, 20);
  }

  async function compressMessages(
    platform: BotPlatform, senderId: string, c: Conversation,
  ): Promise<void> {
    if (!compressor) return;
    const keep = keepRecentCount(c);
    const older = c.messages.slice(0, -keep);
    const fileMessages = older.map(messageToFile);
    const existing = c.compressedSummary?.text;
    const summary = await compressor.compress(fileMessages, existing);
    if (!summary) return;
    c.compressedSummary = {
      text: summary,
      messagesCompressed: older.length + (c.compressedSummary?.messagesCompressed ?? 0),
      compressedAt: new Date(),
    };
    c.messages = c.messages.slice(-keep);
    persistence.save(platform, senderId, conversationToFile(c));
  }

  return { getOrCreate, get, clear, list, pruneStale, size, saveToDisk };
}

function isPersistenceOnly(
  v: ConversationPersistence | PersistentStoreOptions,
): v is ConversationPersistence {
  return typeof (v as ConversationPersistence).load === "function";
}
