import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { BotPlatform, DmPolicy } from "@closeclaw/shared-types";
import { createGatewayServer } from "@closeclaw/gateway";
import {
  clearGrammyBotInstances,
  grammyBotInstances,
} from "../__mocks__/grammy.js";
import { readConfig } from "../../packages/cli/src/config/config-reader.js";
import { runGatewayStart } from "../../packages/cli/src/commands/gateway-start.js";

describe("gateway start DM pairing reply", () => {
  let dir: string;
  let configPath: string;
  let storePath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearGrammyBotInstances();
    dir = join(tmpdir(), `closeclaw-gws-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    configPath = join(dir, "config.json");
    storePath = join(dir, "pairing.json");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    writeFileSync(
      configPath,
      JSON.stringify({
        version: "0.1.0",
        lastModified: new Date().toISOString(),
        channels: {
          telegram: {
            platform: "telegram",
            botToken: "123456789:Ab_cdefghijklmnop",
            enabled: true,
            dmPolicy: DmPolicy.PAIRING,
            createdAt: new Date().toISOString(),
          },
        },
        gateway: {
          bindAddress: "127.0.0.1",
          port: 18910,
          authToken: "f".repeat(64),
        },
      }),
      "utf-8",
    );
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("replies with pairing code via Telegram adapter", async () => {
    const { TelegramAdapter } =
      await import("../../packages/bot-adapters/src/telegram-adapter.js");
    await runGatewayStart({
      configPath,
      pairingStorePath: storePath,
      readConfig,
      createAdapter: (platform, token) => {
        if (platform !== BotPlatform.TELEGRAM) {
          throw new Error("unexpected platform");
        }
        return new TelegramAdapter({ token });
      },
      createGatewayServer,
      waitForShutdown: async () => {
        const bot = grammyBotInstances().at(-1);
        expect(bot).toBeDefined();
        const textCall = bot!.on.mock.calls.find(
          (c) => c[0] === "message:text",
        );
        expect(textCall).toBeDefined();
        const route = textCall![1] as (ctx: {
          message: { text: string; date: number };
          from?: { id: number };
        }) => void;
        route({
          message: { text: "hi", date: 1_700_000_000 },
          from: { id: 4242 },
        });
        await new Promise<void>((r) => setImmediate(r));
      },
    });
    const bot = grammyBotInstances().at(-1)!;
    expect(bot.api.sendMessage).toHaveBeenCalled();
    const args = bot.api.sendMessage.mock.calls[0]!;
    expect(args[0]).toBe(4242);
    const body = args[1] as string;
    const m = body.match(
      /^Pairing code: ([0-9A-Z]{6})\nAsk the owner to run: closeclaw pairing approve \1$/,
    );
    expect(m).not.toBeNull();
  });
});
