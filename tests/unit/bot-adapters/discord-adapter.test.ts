import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Events,
  clearDiscordClientInstances,
  discordClientInstances,
} from "../../__mocks__/discord-js.js";

describe("DiscordAdapter", () => {
  beforeEach(() => {
    clearDiscordClientInstances();
  });

  it("healthCheck calls login and resolves healthy with username", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "valid" });
    await expect(adapter.healthCheck()).resolves.toEqual({
      connected: true,
      botUsername: "discbot",
    });
    const c = discordClientInstances().at(-1);
    expect(c).toBeDefined();
    expect(c!.login).toHaveBeenCalledWith("valid");
  });

  it("healthCheck returns connected false when login fails with invalid token", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "bad" });
    const c = discordClientInstances().at(-1)!;
    c.login.mockReset();
    c.login.mockRejectedValueOnce(new Error("An invalid token was provided."));
    await expect(adapter.healthCheck()).resolves.toMatchObject({
      connected: false,
      error: expect.stringMatching(/invalid token/i) as string,
    });
  });

  it("connect uses login lifecycle and disconnect destroys client", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "t" });
    await adapter.connect();
    await adapter.disconnect();
    const c = discordClientInstances().at(-1)!;
    expect(c.login).toHaveBeenCalled();
    expect(c.destroy).toHaveBeenCalled();
  });

  it("onMessage delivers DM messages via MessageCreate handler", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "t" });
    const handler = vi.fn();
    adapter.onMessage(handler);
    const c = discordClientInstances().at(-1)!;
    const msgCall = c.on.mock.calls.find(
      (call) => call[0] === Events.MessageCreate,
    );
    expect(msgCall).toBeDefined();
    const route = msgCall![1] as (m: {
      author: {
        bot: boolean;
        id: string;
        displayName: string;
        username: string;
      };
      content: string;
      createdAt: Date;
      guild: null;
    }) => void;
    const createdAt = new Date("2026-04-05T12:00:00Z");
    route({
      author: {
        bot: false,
        id: "user-1",
        displayName: "Sam",
        username: "sam",
      },
      content: "ping",
      createdAt,
      guild: null,
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "discord",
        senderId: "user-1",
        text: "ping",
        timestamp: createdAt,
      }),
    );
  });

  it("sendMessage fetches user and sends DM text", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "t" });
    const c = discordClientInstances().at(-1)!;
    const send = vi.fn().mockResolvedValue(undefined);
    c.users.fetch.mockResolvedValue({ send });
    await adapter.sendMessage("snowflake-9", "reply text");
    expect(c.users.fetch).toHaveBeenCalledWith("snowflake-9");
    expect(send).toHaveBeenCalledWith("reply text");
  });
});
