import { describe, it, expect, beforeEach } from "vitest";
import {
  clearDiscordClientInstances,
  discordClientInstances,
} from "../../__mocks__/discord-js.js";

describe("DiscordAdapter editMessage", () => {
  beforeEach(() => {
    clearDiscordClientInstances();
  });

  it("sendMessage returns SendResult with message id", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "tok" });
    const client = discordClientInstances().at(-1)!;
    client.isReady.mockReturnValue(true);
    const result = await adapter.sendMessage("u1", "hello");
    expect(result).toEqual({ messageId: "msg-001" });
  });

  it("sendMessage returns void when send returns no id", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "tok" });
    const client = discordClientInstances().at(-1)!;
    client.isReady.mockReturnValue(true);
    client.users.fetch.mockResolvedValueOnce({
      send: async () => undefined,
      dmChannel: null,
      createDM: async () => ({ sendTyping: () => {} }),
    });
    const result = await adapter.sendMessage("u1", "hi");
    expect(result).toBeUndefined();
  });

  it("editMessage edits an existing message and returns true", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "tok" });
    const client = discordClientInstances().at(-1)!;
    client.isReady.mockReturnValue(true);
    await adapter.sendMessage("u1", "original");
    const ok = await adapter.editMessage("u1", "msg-001", "updated");
    expect(ok).toBe(true);
  });

  it("editMessage returns false when message not tracked", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "tok" });
    const ok = await adapter.editMessage("u1", "unknown-id", "text");
    expect(ok).toBe(false);
  });

  it("editMessage returns false on edit error", async () => {
    const { DiscordAdapter } =
      await import("../../../packages/bot-adapters/src/discord-adapter.js");
    const adapter = new DiscordAdapter({ token: "tok" });
    const client = discordClientInstances().at(-1)!;
    client.isReady.mockReturnValue(true);
    client.users.fetch.mockResolvedValueOnce({
      send: async () => ({
        id: "msg-err",
        edit: async () => {
          throw new Error("Unknown Message");
        },
      }),
      dmChannel: null,
      createDM: async () => ({ sendTyping: () => {} }),
    });
    await adapter.sendMessage("u1", "original");
    const ok = await adapter.editMessage("u1", "msg-err", "updated");
    expect(ok).toBe(false);
  });
});
