import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  clearGrammyBotInstances,
  grammyBotInstances,
} from "../../__mocks__/grammy.js";

describe("TelegramAdapter", () => {
  beforeEach(() => {
    clearGrammyBotInstances();
  });

  it("healthCheck returns connected with username when getMe succeeds", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1);
    expect(bot).toBeDefined();
    bot!.api.getMe.mockResolvedValue({ username: "mybot" });
    await expect(adapter.healthCheck()).resolves.toEqual({
      connected: true,
      botUsername: "mybot",
    });
    expect(bot!.api.getMe).toHaveBeenCalled();
  });

  it("healthCheck returns connected false with error when getMe fails", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.getMe.mockRejectedValue(new Error("network down"));
    await expect(adapter.healthCheck()).resolves.toEqual({
      connected: false,
      error: "network down",
    });
  });

  it("connect starts polling and disconnect stops", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    await adapter.connect();
    await adapter.disconnect();
    const bot = grammyBotInstances().at(-1)!;
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(bot.stop).toHaveBeenCalledTimes(1);
  });

  it("onMessage registers handler that receives IncomingMessage for text", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const handler = vi.fn();
    adapter.onMessage(handler);
    const bot = grammyBotInstances().at(-1)!;
    const textCall = bot.on.mock.calls.find((c) => c[0] === "message:text");
    expect(textCall).toBeDefined();
    const route = textCall![1] as (ctx: {
      message: { text: string; date: number };
      from?: { id: number; first_name?: string; username?: string };
    }) => void;
    route({
      message: { text: "hello", date: 1_700_000_000 },
      from: { id: 99, first_name: "Pat" },
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "telegram",
        senderId: "99",
        text: "hello",
      }),
    );
  });

  it("sendMessage formats text and sends with HTML parse_mode", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.sendMessage.mockResolvedValue(undefined);
    await adapter.sendMessage("77", "**bold** text");
    expect(bot.api.sendMessage).toHaveBeenCalledWith(
      77,
      expect.stringContaining("<b>bold</b>"),
      { parse_mode: "HTML" },
    );
  });

  it("sendMessage falls back to plain text on API rejection", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.sendMessage
      .mockRejectedValueOnce(new Error("Bad Request: can't parse"))
      .mockResolvedValueOnce(undefined);
    await adapter.sendMessage("77", "**bold**");
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("emitText does nothing when no handler is registered", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    const textCall = bot.on.mock.calls.find((c) => c[0] === "message:text");
    expect(textCall).toBeDefined();
    const route = textCall![1] as (ctx: {
      message: { text: string; date: number };
      from?: { id: number };
    }) => void;
    expect(() =>
      route({
        message: { text: "no handler", date: 1_700_000_000 },
        from: { id: 1 },
      }),
    ).not.toThrow();
  });

  it("toIncoming falls back for context without text in message", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const handler = vi.fn();
    adapter.onMessage(handler);
    const bot = grammyBotInstances().at(-1)!;
    const textCall = bot.on.mock.calls.find((c) => c[0] === "message:text");
    const route = textCall![1] as (ctx: {
      message?: unknown;
      from?: unknown;
    }) => void;
    route({ message: undefined, from: undefined });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "telegram",
        senderId: "",
        text: "",
      }),
    );
  });

  it("formats sender with username when name is empty", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const handler = vi.fn();
    adapter.onMessage(handler);
    const bot = grammyBotInstances().at(-1)!;
    const textCall = bot.on.mock.calls.find((c) => c[0] === "message:text");
    const route = textCall![1] as (ctx: {
      message: { text: string; date: number };
      from?: { id: number; first_name?: string; username?: string };
    }) => void;
    route({
      message: { text: "hi", date: 1_700_000_000 },
      from: { id: 10, username: "jdoe" },
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        senderDisplayName: "jdoe",
      }),
    );
  });

  describe("sendTypingIndicator", () => {
    it("calls sendChatAction with typing", async () => {
      const { TelegramAdapter } =
        await import("../../../packages/bot-adapters/src/telegram-adapter.js");
      const adapter = new TelegramAdapter({ token: "1:a" });
      const bot = grammyBotInstances().at(-1)!;
      bot.api.sendChatAction.mockResolvedValue(true);
      await adapter.sendTypingIndicator("42");
      expect(bot.api.sendChatAction).toHaveBeenCalledWith(42, "typing");
    });
  });

  it("formats sender without from yields undefined displayName", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const handler = vi.fn();
    adapter.onMessage(handler);
    const bot = grammyBotInstances().at(-1)!;
    const textCall = bot.on.mock.calls.find((c) => c[0] === "message:text");
    const route = textCall![1] as (ctx: {
      message: { text: string; date: number };
      from?: undefined;
    }) => void;
    route({
      message: { text: "anon", date: 1_700_000_000 },
      from: undefined,
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: "",
        senderDisplayName: undefined,
      }),
    );
  });
});
