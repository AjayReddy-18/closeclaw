import { Bot, InlineKeyboard, type Context } from "grammy";
import { BotPlatform } from "@closeclaw/shared-types";
import type {
  BotAdapter,
  BotHealthResult,
  CallbackQuery,
  IncomingMessage,
  InlineButton,
  MessageHandler,
  SendMessageOptions,
  SendResult,
} from "./adapter.js";
import { formatForTelegram } from "./formatter/markdown-to-telegram.js";
import { splitMessage } from "./formatter/message-splitter.js";
import { createPublicDnsAgent } from "./doh-resolver.js";

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMessageNotModified(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("message is not modified");
}

export class TelegramAdapter implements BotAdapter {
  readonly platform = BotPlatform.TELEGRAM;
  private readonly bot: Bot;
  private handlers: MessageHandler[] = [];
  private callbackHandlers: Array<(q: CallbackQuery) => void> = [];

  constructor(options: { token: string }) {
    const agent = createPublicDnsAgent();
    this.bot = new Bot(options.token, {
      client: { baseFetchConfig: { agent, compress: true } },
    });
    this.bot.catch((err) => {
      console.error("[telegram] Bot error:", err.error);
    });
    this.bot.on("message:text", (ctx) => {
      this.emitText(ctx);
    });
    this.bot.on("callback_query:data", (ctx) => {
      const q: CallbackQuery = {
        id: ctx.callbackQuery.id,
        senderId: String(ctx.callbackQuery.from.id),
        data: ctx.callbackQuery.data,
      };
      for (const h of this.callbackHandlers) h(q);
    });
  }

  private emitText(ctx: Context): void {
    const msg = this.toIncoming(ctx);
    for (const h of this.handlers) h(msg);
  }

  private toIncoming(ctx: Context): IncomingMessage {
    const msg = ctx.message;
    const from = ctx.from;
    if (!msg || !("text" in msg)) {
      return {
        platform: BotPlatform.TELEGRAM,
        senderId: "",
        text: "",
        timestamp: new Date(),
      };
    }
    return {
      platform: BotPlatform.TELEGRAM,
      senderId: from ? String(from.id) : "",
      senderDisplayName: this.formatSender(from),
      text: msg.text ?? "",
      timestamp: new Date(msg.date * 1000),
    };
  }

  private formatSender(from: Context["from"]): string | undefined {
    if (!from) return undefined;
    const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
    return name.length > 0 ? name : from.username;
  }

  async healthCheck(): Promise<BotHealthResult> {
    try {
      const me = await this.bot.api.getMe();
      return { connected: true, botUsername: me.username };
    } catch (e: unknown) {
      return { connected: false, error: errorMessage(e) };
    }
  }

  async connect(): Promise<void> {
    await this.bot.start();
  }
  async disconnect(): Promise<void> {
    try {
      await this.bot.stop();
    } catch {
      void 0;
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  onCallbackQuery(handler: (query: CallbackQuery) => void): void {
    this.callbackHandlers.push(handler);
  }

  async sendMessage(
    senderId: string,
    text: string,
    _options?: SendMessageOptions,
  ): Promise<SendResult | void> {
    const formatted = formatForTelegram(text);
    const chunks = splitMessage(formatted);
    let firstResult: SendResult | undefined;
    for (const chunk of chunks) {
      const result = await this.sendSingleChunk(
        senderId,
        chunk.text,
        chunk.parseMode,
      );
      if (!firstResult && result) firstResult = result;
    }
    return firstResult;
  }

  private async sendSingleChunk(
    senderId: string,
    text: string,
    parseMode: "HTML" | undefined,
  ): Promise<SendResult | undefined> {
    try {
      const msg = await this.bot.api.sendMessage(Number(senderId), text, {
        parse_mode: parseMode,
      });
      return msg?.message_id ? { messageId: msg.message_id } : undefined;
    } catch {
      const plain = stripHtmlTags(text);
      const msg = await this.bot.api.sendMessage(Number(senderId), plain);
      return msg?.message_id ? { messageId: msg.message_id } : undefined;
    }
  }

  async editMessage(
    chatId: string,
    messageId: number | string,
    text: string,
    _options?: SendMessageOptions,
  ): Promise<boolean> {
    const formatted = formatForTelegram(text);
    try {
      const opts: Record<string, string> = {};
      if (formatted.parseMode) opts.parse_mode = formatted.parseMode;
      await this.bot.api.editMessageText(
        Number(chatId),
        Number(messageId),
        formatted.text,
        opts,
      );
      return true;
    } catch (error: unknown) {
      if (isMessageNotModified(error)) return true;
      try {
        const plain = stripHtmlTags(formatted.text);
        await this.bot.api.editMessageText(
          Number(chatId),
          Number(messageId),
          plain,
        );
        return true;
      } catch {
        return false;
      }
    }
  }

  async sendMessageWithButtons(
    senderId: string,
    text: string,
    buttons: InlineButton[][],
  ): Promise<void> {
    const kb = new InlineKeyboard();
    for (const row of buttons) {
      for (const btn of row) kb.text(btn.text, btn.callbackData);
      kb.row();
    }
    await this.bot.api.sendMessage(Number(senderId), text, {
      reply_markup: kb,
    });
  }

  async answerCallbackQuery(queryId: string, text?: string): Promise<void> {
    await this.bot.api.answerCallbackQuery(queryId, { text });
  }

  async sendTypingIndicator(senderId: string): Promise<void> {
    await this.bot.api.sendChatAction(Number(senderId), "typing");
  }
}
