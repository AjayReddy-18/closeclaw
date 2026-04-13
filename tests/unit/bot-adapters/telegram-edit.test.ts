import { describe, it, expect, beforeEach } from "vitest";
import {
  clearGrammyBotInstances,
  grammyBotInstances,
} from "../../__mocks__/grammy.js";

describe("TelegramAdapter editMessage", () => {
  beforeEach(() => {
    clearGrammyBotInstances();
  });

  it("sendMessage returns SendResult with messageId from first chunk", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.sendMessage.mockResolvedValue({ message_id: 42 });
    const result = await adapter.sendMessage("77", "hello");
    expect(result).toEqual({ messageId: 42 });
  });

  it("sendMessage returns void when api returns no message_id", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.sendMessage.mockResolvedValue(undefined);
    const result = await adapter.sendMessage("77", "hello");
    expect(result).toBeUndefined();
  });

  it("editMessage calls editMessageText and returns true on success", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.editMessageText.mockResolvedValue({});
    const ok = await adapter.editMessage("77", 42, "updated text");
    expect(ok).toBe(true);
    expect(bot.api.editMessageText).toHaveBeenCalledWith(
      77,
      42,
      "updated text",
      { parse_mode: "HTML" },
    );
  });

  it("editMessage formats markdown to HTML automatically", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.editMessageText.mockResolvedValue({});
    await adapter.editMessage("77", 42, "**bold** text");
    expect(bot.api.editMessageText).toHaveBeenCalledWith(
      77,
      42,
      expect.stringContaining("<b>bold</b>"),
      { parse_mode: "HTML" },
    );
  });

  it("editMessage returns true for 'message is not modified' error", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.editMessageText.mockRejectedValue(
      new Error("Bad Request: message is not modified"),
    );
    const ok = await adapter.editMessage("77", 42, "same text");
    expect(ok).toBe(true);
  });

  it("editMessage returns false for other errors", async () => {
    const { TelegramAdapter } =
      await import("../../../packages/bot-adapters/src/telegram-adapter.js");
    const adapter = new TelegramAdapter({ token: "1:a" });
    const bot = grammyBotInstances().at(-1)!;
    bot.api.editMessageText.mockRejectedValue(
      new Error("Bad Request: message to edit not found"),
    );
    const ok = await adapter.editMessage("77", 42, "text");
    expect(ok).toBe(false);
  });
});
