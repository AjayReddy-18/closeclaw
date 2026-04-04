import { Bot, type Context } from "grammy";
import { BotPlatform } from "@closeclaw/shared-types";
import type {
  BotAdapter,
  BotHealthResult,
  IncomingMessage,
  MessageHandler,
} from "./adapter.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class TelegramAdapter implements BotAdapter {
  readonly platform = BotPlatform.TELEGRAM;
  private readonly bot: Bot;
  private handler?: MessageHandler;

  constructor(options: { token: string }) {
    this.bot = new Bot(options.token);
    this.bot.on("message:text", (ctx) => {
      this.emitText(ctx);
    });
  }

  private emitText(ctx: Context): void {
    const h = this.handler;
    if (!h) return;
    h(this.toIncoming(ctx));
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

  private formatSender(
    from: Context["from"],
  ): string | undefined {
    if (!from) return undefined;
    const name = [from.first_name, from.last_name]
      .filter(Boolean)
      .join(" ");
    if (name.length > 0) return name;
    return from.username;
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
    this.handler = handler;
  }
}
