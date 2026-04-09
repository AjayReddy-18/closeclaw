import type { BotPlatform } from "@closeclaw/shared-types";
import type { AgentConfig } from "@closeclaw/shared-types";
import type { ConversationStore } from "./conversation-types.js";

export type IntermediateResponseFn = (text: string) => Promise<void>;

export interface MessageProcessor {
  processMessage(
    platform: BotPlatform,
    senderId: string,
    text: string,
    senderDisplayName?: string,
    onIntermediateResponse?: IntermediateResponseFn,
  ): Promise<string>;
}

export interface MessageProcessorConfig {
  agentConfig: AgentConfig;
  conversationStore: ConversationStore;
}

export const CLEAR_COMMAND = "/clear";
export const CLEAR_CONFIRMATION = "Conversation cleared. Starting fresh!";
export const AI_ERROR_MESSAGE =
  "I'm having trouble thinking right now. Please try again in a moment.";
export const EMPTY_RESPONSE_MESSAGE =
  "I processed your message but have nothing to say.";
export const MAX_RETRIES = 3;
export const INITIAL_RETRY_DELAY_MS = 1000;
export const PROCESSING_ACK_DELAY_MS = 5000;
