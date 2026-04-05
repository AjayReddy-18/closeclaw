import type { BotPlatform } from "@closeclaw/shared-types";

export interface ConversationFileData {
  platform: string;
  senderId: string;
  senderDisplayName?: string;
  compressedSummary?: {
    text: string;
    messagesCompressed: number;
    compressedAt: string;
  };
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    timestamp: string;
    toolCallId?: string;
    toolName?: string;
  }>;
  createdAt: string;
  lastActivityAt: string;
}

export interface PreferenceEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export interface PreferenceFileData {
  platform: string;
  senderId: string;
  preferences: PreferenceEntry[];
  lastModifiedAt: string;
}

export interface ConversationPersistence {
  load(platform: BotPlatform, senderId: string): ConversationFileData | null;

  save(
    platform: BotPlatform,
    senderId: string,
    data: ConversationFileData,
  ): void;

  remove(platform: BotPlatform, senderId: string): void;
}

export interface PreferenceStore {
  load(platform: BotPlatform, senderId: string): PreferenceFileData | null;

  save(platform: BotPlatform, senderId: string, data: PreferenceFileData): void;

  upsertPreference(
    platform: BotPlatform,
    senderId: string,
    key: string,
    value: string,
  ): void;

  removePreference(
    platform: BotPlatform,
    senderId: string,
    key: string,
  ): boolean;
}

export interface ConversationCompressor {
  shouldCompress(messageCount: number): boolean;

  compress(
    messages: ConversationFileData["messages"],
    existingSummary?: string,
  ): Promise<string>;
}

export interface MemoryFlusher {
  extractPreferences(
    messages: ConversationFileData["messages"],
  ): Promise<PreferenceEntry[]>;
}

export interface PreferenceExtractor {
  extractFromResponse(
    aiResponse: string,
    userMessage: string,
  ): PreferenceEntry[];
}
