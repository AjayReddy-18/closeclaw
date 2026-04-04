import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import {
  runOnboard,
  type OnboardDeps,
} from "../../../packages/cli/src/commands/onboard.js";

describe("runOnboard defer after instructions", () => {
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
    sendMessage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function baseDeps(over: Partial<OnboardDeps> = {}): OnboardDeps {
    return {
      configPath: "/tmp/cfg.json",
      readConfig: vi.fn((): Configuration | null => null),
      detectConfig: vi.fn(() => ({
        exists: false,
        configuredPlatforms: [],
        availablePlatforms: ["telegram", "discord"] as BotPlatform[],
        allPlatformsConfigured: false,
      })),
      writeConfig: vi.fn(),
      selectAction: vi.fn(async () => "add-integration" as const),
      selectPlatform: vi.fn(async (): Promise<BotPlatform> => "telegram"),
      getInstructions: vi.fn(() => "Follow these steps"),
      inputBotToken: vi.fn(async () => "123456789:Ab_cdefghijklmnop"),
      selectDmPolicy: vi.fn(async () => DmPolicy.PAIRING),
      createAdapter: vi.fn(() => adapter),
      checkHealth: vi.fn(async () => ({
        status: "healthy" as const,
        channels: {
          telegram: { connected: true, botUsername: "x" },
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

  it("defers: no token prompt, no write, logs comeback message", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const deps = baseDeps({
      confirmProceed: vi.fn(async () => false),
    });
    try {
      await runOnboard(deps);
      expect(deps.inputBotToken).not.toHaveBeenCalled();
      expect(deps.writeConfig).not.toHaveBeenCalled();
      expect(deps.confirmProceed).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith("Follow these steps");
      expect(logSpy).toHaveBeenCalledWith(
        "No problem! Run 'closeclaw onboard' when you're ready.",
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("proceeds: confirm true then token input runs", async () => {
    const deps = baseDeps({
      confirmProceed: vi.fn(async () => true),
    });
    await runOnboard(deps);
    expect(deps.confirmProceed).toHaveBeenCalledTimes(1);
    expect(deps.inputBotToken).toHaveBeenCalledWith("telegram");
    expect(deps.writeConfig).toHaveBeenCalledTimes(1);
  });
});
