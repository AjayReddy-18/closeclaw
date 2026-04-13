import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { BotPlatform } from "@closeclaw/shared-types";
import type {
  BotAdapter,
  BotHealthResult,
  IncomingMessage,
  MessageHandler,
  SendMessageOptions,
  SendResult,
} from "./adapter.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class DiscordAdapter implements BotAdapter {
  readonly platform = BotPlatform.DISCORD;
  private readonly client: Client;
  private readonly token: string;
  private handlers: MessageHandler[] = [];

  constructor(options: { token: string }) {
    this.token = options.token;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.client.on(Events.MessageCreate, (m) => {
      this.onDiscordMessage(m);
    });
  }

  private onDiscordMessage(message: Message): void {
    if (!this.isDmFromUser(message)) return;
    const msg = this.messageToIncoming(message);
    for (const h of this.handlers) h(msg);
  }

  private isDmFromUser(message: Message): boolean {
    if (message.author.bot) return false;
    return message.guild === null;
  }

  private messageToIncoming(message: Message): IncomingMessage {
    return {
      platform: BotPlatform.DISCORD,
      senderId: message.author.id,
      senderDisplayName: message.author.displayName ?? message.author.username,
      text: message.content,
      timestamp: message.createdAt,
    };
  }

  private whenClientReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client.isReady()) {
        resolve();
        return;
      }
      this.client.once(Events.ClientReady, () => resolve());
    });
  }

  private rejectAfter(ms: number, msg: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(msg)), ms);
    });
  }

  private async ensureLoggedIn(timeoutMs: number): Promise<void> {
    if (this.client.isReady()) return;
    const ready = this.whenClientReady();
    await this.client.login(this.token);
    await Promise.race([ready, this.rejectAfter(timeoutMs, "Ready timeout")]);
  }

  private okHealth(): BotHealthResult {
    const u = this.client.user;
    return { connected: true, botUsername: u?.username };
  }

  async healthCheck(): Promise<BotHealthResult> {
    if (this.client.isReady()) return this.okHealth();
    try {
      await this.ensureLoggedIn(10_000);
      return this.okHealth();
    } catch (e: unknown) {
      await this.safeDestroy();
      return { connected: false, error: errorMessage(e) };
    }
  }

  async connect(): Promise<void> {
    await this.ensureLoggedIn(10_000);
  }

  async disconnect(): Promise<void> {
    await this.safeDestroy();
  }

  private async safeDestroy(): Promise<void> {
    try {
      this.client.destroy();
    } catch {
      void 0;
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  private sentMessages = new Map<
    string,
    { edit: (text: string) => Promise<void> }
  >();

  async sendMessage(
    senderId: string,
    text: string,
    _options?: SendMessageOptions,
  ): Promise<SendResult | void> {
    const user = await this.client.users.fetch(senderId);
    const sent = await user.send(text);
    if (sent?.id) {
      this.sentMessages.set(String(sent.id), sent);
      return { messageId: sent.id };
    }
  }

  async editMessage(
    _chatId: string,
    messageId: number | string,
    text: string,
    _options?: SendMessageOptions,
  ): Promise<boolean> {
    const msg = this.sentMessages.get(String(messageId));
    if (!msg) return false;
    try {
      await msg.edit(text);
      return true;
    } catch {
      return false;
    }
  }

  async sendTypingIndicator(senderId: string): Promise<void> {
    const user = await this.client.users.fetch(senderId);
    const channel = user.dmChannel ?? (await user.createDM());
    await channel.sendTyping();
  }
}
