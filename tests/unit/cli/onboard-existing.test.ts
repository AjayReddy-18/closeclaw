import { describe, it, expect, vi, beforeEach } from "vitest";
import { select } from "@inquirer/prompts";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import {
  runOnboard,
  type OnboardDeps,
} from "../../../packages/cli/src/commands/onboard.js";

describe("runOnboard existing config", () => {
  const adapter: BotAdapter = {
    platform: "discord",
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(select).mockReset();
  });

  function baseDeps(over: Partial<OnboardDeps> = {}): OnboardDeps {
    const existingConfig: Configuration = {
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
        authToken: "b".repeat(64),
      },
    };
    return {
      configPath: "/tmp/cfg.json",
      readConfig: vi.fn((): Configuration | null => existingConfig),
      detectConfig: vi.fn(() => ({
        exists: true,
        configuredPlatforms: ["telegram"] as BotPlatform[],
        availablePlatforms: ["discord"] as BotPlatform[],
        allPlatformsConfigured: false,
      })),
      writeConfig: vi.fn(),
      selectAction: vi.fn(async () => "add-integration" as const),
      selectPlatform: vi.fn(async (): Promise<BotPlatform> => "discord"),
      getInstructions: vi.fn(() => ""),
      inputBotToken: vi.fn(async () => "discord-secret-token"),
      selectDmPolicy: vi.fn(async () => DmPolicy.PAIRING),
      createAdapter: vi.fn(() => adapter),
      checkHealth: vi.fn(async () => ({
        status: "healthy" as const,
        channels: {
          discord: { connected: true, botUsername: "x" },
        },
      })),
      generateGatewayConfig: vi.fn(() => ({
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "a".repeat(64),
      })),
      ...over,
    };
  }

  it("selectOnboardExistingAction shows add-new and reset choices", async () => {
    vi.mocked(select).mockResolvedValueOnce("add-integration");
    const { selectOnboardExistingAction } = await import(
      "../../../packages/cli/src/prompts/onboard-action-select.js"
    );
    await selectOnboardExistingAction();
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "What would you like to do?",
        choices: [
          { name: "Add new integration", value: "add-integration" },
          { name: "Reset configuration", value: "reset-configuration" },
        ],
      }),
    );
  });

  it("prompts add-new or reset when config exists", async () => {
    const deps = baseDeps();
    await runOnboard(deps);
    expect(deps.selectAction).toHaveBeenCalledTimes(1);
  });

  it("add path passes filtered platforms to selectPlatform", async () => {
    const deps = baseDeps();
    await runOnboard(deps);
    expect(deps.selectPlatform).toHaveBeenCalledWith(["discord"]);
  });

});
