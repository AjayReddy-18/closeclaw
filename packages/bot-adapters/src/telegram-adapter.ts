import { Agent as HttpsAgent } from "node:https";
import { Resolver } from "node:dns";
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

function createPublicDnsAgent(): HttpsAgent {
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  return new HttpsAgent({
    keepAlive: true,
    lookup: (hostname, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      resolver.resolve4(hostname, (err, addresses) => {
        if (err) return callback(err);
        const all = typeof options === "object" && options !== null && "all" in options && options.all;
        if (all) {
          callback(null, addresses.map((a) => ({ address: a, family: 4 })) as never);
        } else {
          callback(null, addresses[0], 4);
        }
      });
    },
  });
}

export class TelegramAdapter implements BotAdapter {
  readonly platform = BotPlatform.TELEGRAM;
  private readonly bot: Bot;
  private handlers: MessageHandler[] = [];

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
    this.handlers.push(handler);
  }

  async sendMessage(senderId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(Number(senderId), text);
  }

  async sendTypingIndicator(senderId: string): Promise<void> {
    await this.bot.api.sendChatAction(Number(senderId), "typing");
  }
}
