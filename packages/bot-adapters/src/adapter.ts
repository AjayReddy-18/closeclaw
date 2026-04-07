import type { BotPlatform } from "@closeclaw/shared-types";

export interface BotHealthResult {
  connected: boolean;
  botUsername?: string;
  error?: string;
}

export interface IncomingMessage {
  platform: BotPlatform;
  senderId: string;
  senderDisplayName?: string;
  text: string;
  timestamp: Date;
}

export type MessageHandler = (message: IncomingMessage) => void;

export interface SendMessageOptions {
  parseMode?: "HTML";
}

export interface BotAdapter {
  readonly platform: BotPlatform;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<BotHealthResult>;
  onMessage(handler: MessageHandler): void;
  sendMessage(
    senderId: string,
    text: string,
    options?: SendMessageOptions,
  ): Promise<void>;
  sendTypingIndicator(senderId: string): Promise<void>;
}
