import type { BotPlatform } from "@closeclaw/shared-types";
import type { ConversationFileMessage, PreferenceEntry } from "./persistence-types.js";

export interface MemoryFlusher {
  flush(
    platform: BotPlatform,
    senderId: string,
    messages: ConversationFileMessage[],
  ): Promise<PreferenceEntry[]>;
}
