import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { readConfig } from "../../packages/cli/src/config/config-reader.js";
import { writeConfig } from "../../packages/cli/src/config/config-writer.js";
import { detectConfigState } from "../../packages/cli/src/config/config-detector.js";
import { runOnboard } from "../../packages/cli/src/commands/onboard.js";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import type { Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";

describe("onboard add-new config persistence", () => {
  let dir: string;
  let configPath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-persist-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    configPath = join(dir, "closeclaw.json");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("merges discord into existing telegram config on disk", async () => {
    const gateway = {
      bindAddress: "127.0.0.1",
      port: 18790,
      authToken: "a".repeat(64),
    };
    const initial: Configuration = {
      version: "0.1.0",
      lastModified: "2020-01-01T00:00:00.000Z",
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "123456789:Ab_cdefghijklmnop",
          enabled: true,
          dmPolicy: DmPolicy.PAIRING,
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      },
      gateway,
    };
    writeConfig(configPath, initial);

    const discordAdapter: BotAdapter = {
      platform: "discord",
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(() =>
        Promise.resolve({
          connected: true,
          botUsername: "d",
        } satisfies BotHealthResult),
      ),
      onMessage: vi.fn(),
      sendMessage: vi.fn(),
      sendTypingIndicator: vi.fn(),
    };

    await runOnboard({
      configPath,
      readConfig,
      writeConfig,
      detectConfig: detectConfigState,
      selectAction: async () => "add-integration",
      selectPlatform: async () => "discord",
      getInstructions: () => "",
      inputBotToken: async () => "discord-bot-token-value",
      selectDmPolicy: async () => DmPolicy.PAIRING,
      createAdapter: () => discordAdapter,
      checkHealth: vi.fn(async () => ({
        status: "healthy" as const,
        channels: {
          discord: { connected: true, botUsername: "d" },
        },
      })),
      generateGatewayConfig: () => gateway,
    });

    const loaded = readConfig(configPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.channels.telegram?.botToken).toBe(
      "123456789:Ab_cdefghijklmnop",
    );
    expect(loaded!.channels.discord?.botToken).toBe("discord-bot-token-value");
    expect(loaded!.channels.discord?.platform).toBe("discord");
    expect(loaded!.gateway).toEqual(gateway);
  });

  it("reset specific platform removes only that integration on disk", async () => {
    const gateway = {
      bindAddress: "127.0.0.1",
      port: 18790,
      authToken: "a".repeat(64),
    };
    const initial: Configuration = {
      version: "0.1.0",
      lastModified: "2020-01-01T00:00:00.000Z",
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "123456789:Ab_cdefghijklmnop",
          enabled: true,
          dmPolicy: DmPolicy.PAIRING,
          createdAt: "2020-01-01T00:00:00.000Z",
        },
        discord: {
          platform: "discord",
          botToken: "discord-existing-token",
          enabled: true,
          dmPolicy: DmPolicy.PAIRING,
          createdAt: "2020-02-01T00:00:00.000Z",
        },
      },
      gateway,
    };
    writeConfig(configPath, initial);

    const tgAdapter: BotAdapter = {
      platform: "telegram",
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(() =>
        Promise.resolve({
          connected: true,
          botUsername: "t",
        } satisfies BotHealthResult),
      ),
      onMessage: vi.fn(),
      sendMessage: vi.fn(),
      sendTypingIndicator: vi.fn(),
    };

    await runOnboard({
      configPath,
      readConfig,
      writeConfig,
      detectConfig: detectConfigState,
      selectAction: async () => "reset-configuration",
      selectResetScope: async () => "specific",
      selectPlatformToReset: async () => "telegram",
      confirmReset: async () => true,
      selectPlatform: async () => "telegram",
      getInstructions: () => "",
      inputBotToken: async () => "new-telegram-token",
      selectDmPolicy: async () => DmPolicy.PAIRING,
      createAdapter: () => tgAdapter,
      checkHealth: vi.fn(async () => ({
        status: "healthy" as const,
        channels: {
          telegram: { connected: true, botUsername: "t" },
        },
      })),
      generateGatewayConfig: () => gateway,
    });

    const loaded = readConfig(configPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.channels.discord?.botToken).toBe("discord-existing-token");
    expect(loaded!.channels.telegram?.botToken).toBe("new-telegram-token");
  });
});
