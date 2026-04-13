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

export interface SendResult {
  messageId: number | string;
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export interface BotAdapter {
  readonly platform: BotPlatform;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<BotHealthResult>;
  onMessage(handler: MessageHandler): void;
  onCallbackQuery?(handler: (query: CallbackQuery) => void): void;
  sendMessage(
    senderId: string,
    text: string,
    options?: SendMessageOptions,
  ): Promise<SendResult | void>;
  editMessage?(
    chatId: string,
    messageId: number | string,
    text: string,
    options?: SendMessageOptions,
  ): Promise<boolean>;
  sendMessageWithButtons?(
    senderId: string,
    text: string,
    buttons: InlineButton[][],
  ): Promise<void>;
  answerCallbackQuery?(queryId: string, text?: string): Promise<void>;
  sendTypingIndicator(senderId: string): Promise<void>;
}

export interface CallbackQuery {
  id: string;
  senderId: string;
  data: string;
}
