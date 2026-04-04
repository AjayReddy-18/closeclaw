import { describe, it, expect, vi, beforeEach } from "vitest";
import { select } from "@inquirer/prompts";
import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import { detectConfigState } from "../../../packages/cli/src/config/config-detector.js";
import {
  runOnboard,
  type OnboardDeps,
} from "../../../packages/cli/src/commands/onboard.js";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";

describe("platform availability for onboard", () => {
  beforeEach(() => {
    vi.mocked(select).mockReset();
  });

  it("when telegram is configured only discord remains available", () => {
    const config: Configuration = {
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
        port: 18790,
        authToken: "c".repeat(64),
      },
    };
    const state = detectConfigState(config);
    expect(state.availablePlatforms).toEqual(["discord"]);
    expect(state.allPlatformsConfigured).toBe(false);
  });

  it("when both platforms are configured none remain available", () => {
    const config: Configuration = {
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
        discord: {
          platform: "discord",
          botToken: "d",
          enabled: true,
          dmPolicy: DmPolicy.PAIRING,
          createdAt: new Date().toISOString(),
        },
      },
      gateway: {
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "c".repeat(64),
      },
    };
    const state = detectConfigState(config);
    expect(state.availablePlatforms).toEqual([]);
    expect(state.allPlatformsConfigured).toBe(true);
  });

  it("runOnboard logs all-configured when both platforms set", async () => {
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const adapter: BotAdapter = {
      platform: "telegram",
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(() =>
        Promise.resolve({
          connected: true,
          botUsername: "x",
        } satisfies BotHealthResult),
      ),
      onMessage: vi.fn(),
    };
    try {
      const deps: OnboardDeps = {
        configPath: "/x",
        readConfig: vi.fn(() => null),
        detectConfig: vi.fn(() => ({
          exists: true,
          configuredPlatforms: ["telegram", "discord"] as BotPlatform[],
          availablePlatforms: [],
          allPlatformsConfigured: true,
        })),
        writeConfig: vi.fn(),
        selectAction: vi.fn(async () => "add-integration" as const),
        selectPlatform: vi.fn(async () => "telegram"),
        getInstructions: vi.fn(() => ""),
        inputBotToken: vi.fn(async () => "t"),
        selectDmPolicy: vi.fn(async () => DmPolicy.PAIRING),
        createAdapter: vi.fn(() => adapter),
        checkHealth: vi.fn(async () => ({
          status: "healthy" as const,
          channels: {},
        })),
        generateGatewayConfig: vi.fn(() => ({
          bindAddress: "127.0.0.1",
          port: 1,
          authToken: "a".repeat(64),
        })),
      };
      await runOnboard(deps);
      expect(deps.selectAction).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "All platforms are already configured.",
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("selectPlatform with only discord skips inquirer select", async () => {
    const { selectPlatform } = await import(
      "../../../packages/cli/src/prompts/platform-select.js"
    );
    const result = await selectPlatform(["discord"]);
    expect(result).toBe("discord");
    expect(select).not.toHaveBeenCalled();
  });
});
