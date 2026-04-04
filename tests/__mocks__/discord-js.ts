import { vi } from "vitest";

export const Events = {
  ClientReady: "clientReady",
  MessageCreate: "messageCreate",
};

export const GatewayIntentBits = {
  Guilds: 1,
  DirectMessages: 2,
  MessageContent: 4,
};

export type DiscordClientInstance = {
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
  user: { username: string };
  destroy: ReturnType<typeof vi.fn>;
};

const clients: DiscordClientInstance[] = [];

export function discordClientInstances(): readonly DiscordClientInstance[] {
  return clients;
}

export function clearDiscordClientInstances(): void {
  clients.length = 0;
}

export class Client {
  readonly on: DiscordClientInstance["on"];
  readonly once: DiscordClientInstance["once"];
  readonly login: DiscordClientInstance["login"];
  readonly isReady: DiscordClientInstance["isReady"];
  readonly user: DiscordClientInstance["user"];
  readonly destroy: DiscordClientInstance["destroy"];

  constructor(_opts: unknown) {
    let readyCb: (() => void) | undefined;
    this.on = vi.fn();
    this.once = vi.fn((event: string, cb: () => void) => {
      if (event === Events.ClientReady) {
        readyCb = cb;
      }
    });
    this.login = vi.fn(async () => {
      queueMicrotask(() => {
        readyCb?.();
      });
    });
    this.isReady = vi.fn(() => false);
    this.user = { username: "discbot" };
    this.destroy = vi.fn();
    clients.push(this);
  }
}

export type Message = {
  author: { bot: boolean; id: string; displayName: string; username: string };
  content: string;
  createdAt: Date;
  guild: null;
};
