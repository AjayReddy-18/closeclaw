import { Agent as HttpsAgent } from "node:https";
import { get as httpsGet } from "node:https";
import { Bot, type Context } from "grammy";
import { BotPlatform } from "@closeclaw/shared-types";
import type {
  BotAdapter,
  BotHealthResult,
  IncomingMessage,
  MessageHandler,
  SendMessageOptions,
} from "./adapter.js";
import { formatForTelegram } from "./formatter/markdown-to-telegram.js";
import { splitMessage } from "./formatter/message-splitter.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const dohCache = new Map<string, { ip: string; expiresAt: number }>();
const DOH_CACHE_TTL_MS = 120_000;

function resolveViaDoh(hostname: string): Promise<string> {
  const cached = dohCache.get(hostname);
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.ip);

  return new Promise((resolve, reject) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`;
    httpsGet(url, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(body) as {
            Answer?: Array<{ type: number; data: string }>;
          };
          const aRecord = json.Answer?.find((r) => r.type === 1);
          if (!aRecord) {
            reject(new Error(`DoH: no A record for ${hostname}`));
            return;
          }
          dohCache.set(hostname, {
            ip: aRecord.data,
            expiresAt: Date.now() + DOH_CACHE_TTL_MS,
          });
          resolve(aRecord.data);
        } catch {
          reject(new Error(`DoH: failed to parse response for ${hostname}`));
        }
      });
    }).on("error", (err) => reject(err));
  });
}

function createPublicDnsAgent(): HttpsAgent {
  return new HttpsAgent({
    keepAlive: true,
    lookup: (hostname, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      resolveViaDoh(hostname).then(
        (ip) => {
          const all =
            typeof options === "object" &&
            options !== null &&
            "all" in options &&
            options.all;
          if (all) {
            callback(null, [{ address: ip, family: 4 }] as never);
          } else {
            callback(null, ip, 4);
          }
        },
        (err) => callback(err),
      );
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

  async sendMessage(
    senderId: string,
    text: string,
    _options?: SendMessageOptions,
  ): Promise<void> {
    const formatted = formatForTelegram(text);
    const chunks = splitMessage(formatted);
    for (const chunk of chunks) {
      await this.sendSingleChunk(senderId, chunk.text, chunk.parseMode);
    }
  }

  private async sendSingleChunk(
    senderId: string,
    text: string,
    parseMode: "HTML" | undefined,
  ): Promise<void> {
    try {
      await this.bot.api.sendMessage(Number(senderId), text, {
        parse_mode: parseMode,
      });
    } catch {
      await this.bot.api.sendMessage(Number(senderId), text);
    }
  }

  async sendTypingIndicator(senderId: string): Promise<void> {
    await this.bot.api.sendChatAction(Number(senderId), "typing");
  }
}
