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

export interface BotAdapter {
  readonly platform: BotPlatform;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<BotHealthResult>;
  onMessage(handler: MessageHandler): void;
  sendMessage(senderId: string, text: string): Promise<void>;
}
