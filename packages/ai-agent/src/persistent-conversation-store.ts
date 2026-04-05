import type { BotPlatform } from "@closeclaw/shared-types";
import type {
  Conversation,
  ConversationStore,
  ConversationSummary,
} from "./conversation-types.js";
import { conversationKey } from "./conversation-types.js";
import { createConversationStore } from "./conversation-store.js";
import type { ConversationPersistence } from "./conversation-persistence.js";
import {
  conversationFromFile,
  conversationToFile,
} from "./persistence-serializer.js";

export interface PersistentConversationStore extends ConversationStore {
  saveToDisk(platform: BotPlatform, senderId: string): void;
}

export function createPersistentConversationStore(
  persistence: ConversationPersistence,
): PersistentConversationStore {
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
    platform: BotPlatform,
    senderId: string,
    disk: Conversation,
  ): Conversation {
    const c = inner.getOrCreate(platform, senderId, disk.senderDisplayName);
    c.messages = disk.messages;
    c.compressedSummary = disk.compressedSummary;
    c.createdAt = disk.createdAt;
    c.lastActivityAt = disk.lastActivityAt;
    return c;
  }

  function getOrCreate(
    platform: BotPlatform,
    senderId: string,
    senderDisplayName?: string,
  ): Conversation {
    const disk = tryLoadFromDisk(platform, senderId);
    if (disk) return hydrateInner(platform, senderId, disk);
    return inner.getOrCreate(platform, senderId, senderDisplayName);
  }

  function get(
    platform: BotPlatform,
    senderId: string,
  ): Conversation | undefined {
    return inner.get(platform, senderId);
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
    return inner
      .list()
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
  }

  return { getOrCreate, get, clear, list, pruneStale, size, saveToDisk };
}
