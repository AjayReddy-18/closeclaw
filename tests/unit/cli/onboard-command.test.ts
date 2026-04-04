import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import {
  runOnboard,
  type OnboardDeps,
} from "../../../packages/cli/src/commands/onboard.js";

describe("runOnboard", () => {
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
      selectPlatform: vi.fn(async (): Promise<BotPlatform> => "telegram"),
      getInstructions: vi.fn(() => ""),
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

  it("runs health check before write and disconnects adapter", async () => {
    const deps = baseDeps();
    await runOnboard(deps);
    expect(deps.getInstructions).toHaveBeenCalledWith("telegram");
    expect(deps.createAdapter).toHaveBeenCalledWith(
      "telegram",
      "123456789:Ab_cdefghijklmnop",
    );
    expect(deps.checkHealth).toHaveBeenCalledWith([adapter]);
    expect(deps.writeConfig).toHaveBeenCalledTimes(1);
    expect(adapter.disconnect).toHaveBeenCalled();
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.version).toBe("0.1.0");
    expect(written.channels.telegram?.botToken).toBe(
      "123456789:Ab_cdefghijklmnop",
    );
    const h = vi.mocked(deps.checkHealth).mock.invocationCallOrder[0];
    const w = vi.mocked(deps.writeConfig).mock.invocationCallOrder[0];
    expect(h).toBeDefined();
    expect(w).toBeDefined();
    expect(h!).toBeLessThan(w!);
  });

  it("throws when health check fails and still disconnects", async () => {
    const deps = baseDeps({
      checkHealth: vi.fn(async () => ({
        status: "unhealthy" as const,
        channels: {
          telegram: { connected: false, error: "down" },
        },
      })),
    });
    await expect(runOnboard(deps)).rejects.toThrow(
      "Onboarding health check failed",
    );
    expect(deps.writeConfig).not.toHaveBeenCalled();
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it("skips persistence when allowlist policy has no senders", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const deps = baseDeps({
      selectDmPolicy: vi.fn(async () => DmPolicy.ALLOWLIST),
      inputAllowlistSenders: vi.fn(async () => []),
    });
    await runOnboard(deps);
    expect(deps.writeConfig).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("logs and returns when all platforms are configured", async () => {
    const logSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    try {
      const deps = baseDeps({
        detectConfig: vi.fn(() => ({
          exists: true,
          configuredPlatforms: ["telegram", "discord"] as BotPlatform[],
          availablePlatforms: [],
          allPlatformsConfigured: true,
        })),
      });
      await runOnboard(deps);
      expect(logSpy).toHaveBeenCalledWith(
        "All platforms are already configured.",
      );
      expect(deps.selectPlatform).not.toHaveBeenCalled();
      expect(deps.writeConfig).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
