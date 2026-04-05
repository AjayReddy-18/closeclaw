import type { BotPlatform } from "@closeclaw/shared-types";

export type ConversationRole = "system" | "user" | "assistant" | "tool";

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  timestamp: Date;
  toolCallId?: string;
  toolName?: string;
}

export interface Conversation {
  platform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivityAt: Date;
}

export interface ConversationSummary {
  platform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
  messageCount: number;
  lastActivityAt: Date;
}

export interface ConversationStore {
  getOrCreate(
    platform: BotPlatform,
    senderId: string,
    senderDisplayName?: string,
  ): Conversation;

  get(platform: BotPlatform, senderId: string): Conversation | undefined;

  clear(platform: BotPlatform, senderId: string): boolean;

  list(): ConversationSummary[];

  pruneStale(maxAgeMs: number): number;

  size(): number;
}

export function conversationKey(
  platform: BotPlatform,
  senderId: string,
): string {
  return `${platform}:${senderId}`;
}
