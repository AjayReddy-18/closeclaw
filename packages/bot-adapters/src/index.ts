export type {
  BotAdapter,
  BotHealthResult,
  IncomingMessage,
  MessageHandler,
  SendMessageOptions,
} from "./adapter.js";
export { TelegramAdapter } from "./telegram-adapter.js";
export { DiscordAdapter } from "./discord-adapter.js";
export { formatForTelegram, type FormatterResult } from "./formatter/index.js";
export { splitMessage, type MessageChunk } from "./formatter/index.js";
