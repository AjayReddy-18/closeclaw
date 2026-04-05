import type { BotPlatform } from "@closeclaw/shared-types";
import type {
  Conversation,
  ConversationStore,
  ConversationSummary,
} from "./conversation-types.js";
import { conversationKey } from "./conversation-types.js";

export function createConversationStore(): ConversationStore {
  const conversations = new Map<string, Conversation>();

  function getOrCreate(
    platform: BotPlatform,
    senderId: string,
    senderDisplayName?: string,
  ): Conversation {
    const key = conversationKey(platform, senderId);
    const existing = conversations.get(key);
    if (existing) {
      existing.lastActivityAt = new Date();
      if (senderDisplayName) existing.senderDisplayName = senderDisplayName;
      return existing;
    }
    const now = new Date();
    const conversation: Conversation = {
      platform,
      senderId,
      senderDisplayName,
      messages: [],
      createdAt: now,
      lastActivityAt: now,
    };
    conversations.set(key, conversation);
    return conversation;
  }

  function get(
    platform: BotPlatform,
    senderId: string,
  ): Conversation | undefined {
    return conversations.get(conversationKey(platform, senderId));
  }

  function clear(platform: BotPlatform, senderId: string): boolean {
    return conversations.delete(conversationKey(platform, senderId));
  }

  function list(): ConversationSummary[] {
    return Array.from(conversations.values()).map(toSummary);
  }

  function toSummary(c: Conversation): ConversationSummary {
    return {
      platform: c.platform,
      senderId: c.senderId,
      senderDisplayName: c.senderDisplayName,
      messageCount: c.messages.length,
      lastActivityAt: c.lastActivityAt,
    };
  }

  function pruneStale(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;
    for (const [key, conv] of conversations) {
      if (conv.lastActivityAt.getTime() < cutoff) {
        conversations.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  function size(): number {
    return conversations.size;
  }

  return { getOrCreate, get, clear, list, pruneStale, size };
}
