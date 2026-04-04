import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import {
  runOnboard,
  type OnboardDeps,
} from "../../../packages/cli/src/commands/onboard.js";
import { ConfigReadError } from "../../../packages/cli/src/config/config-reader.js";

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

  it("prompts to start gateway and invokes runGatewayStart when confirmed", async () => {
    const runGatewayStart = vi.fn(async () => undefined);
    const deps = baseDeps({
      confirmStartGateway: vi.fn(async () => true),
      runGatewayStart,
    });
    await runOnboard(deps);
    expect(runGatewayStart).toHaveBeenCalledTimes(1);
    expect(runGatewayStart).toHaveBeenCalledWith(
      expect.objectContaining({ configPath: "/tmp/cfg.json" }),
    );
  });

  it("does not start gateway when post-onboard prompt is declined", async () => {
    const runGatewayStart = vi.fn();
    const deps = baseDeps({
      confirmStartGateway: vi.fn(async () => false),
      runGatewayStart,
    });
    await runOnboard(deps);
    expect(runGatewayStart).not.toHaveBeenCalled();
  });

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
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const deps = baseDeps({
        detectConfig: vi.fn(() => ({
          exists: true,
          configuredPlatforms: ["telegram", "discord"] as BotPlatform[],
          availablePlatforms: [],
          allPlatformsConfigured: true,
        })),
        selectAction: vi.fn(async () => "add-integration" as const),
      });
      await runOnboard(deps);
      expect(deps.selectAction).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "All platforms are already configured.",
      );
      expect(logSpy).toHaveBeenCalledWith(
        'To start over, choose "Reset configuration" when running closeclaw onboard.',
      );
      expect(deps.selectPlatform).not.toHaveBeenCalled();
      expect(deps.writeConfig).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("exits with code 1 when config read fails and reset is declined", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit:${String(code)}`);
    });
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const deps = baseDeps({
      readConfig: vi.fn(() => {
        throw new ConfigReadError("Malformed JSON in config: /tmp/cfg.json");
      }),
      confirmResetMalformedConfig: vi.fn(async () => false),
    });
    await expect(runOnboard(deps)).rejects.toThrow("exit:1");
    expect(vi.mocked(deps.readConfig)).toHaveBeenCalledTimes(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("removes config and continues after read error when reset is confirmed", async () => {
    let calls = 0;
    const unlink = vi.fn();
    const deps = baseDeps({
      readConfig: vi.fn(() => {
        calls += 1;
        if (calls === 1) {
          throw new ConfigReadError(
            "Invalid configuration schema: /tmp/cfg.json",
          );
        }
        return null;
      }),
      confirmResetMalformedConfig: vi.fn(async () => true),
      unlinkConfig: unlink,
    });
    await runOnboard(deps);
    expect(unlink).toHaveBeenCalledWith("/tmp/cfg.json");
    expect(vi.mocked(deps.readConfig)).toHaveBeenCalledTimes(2);
    expect(deps.writeConfig).toHaveBeenCalledTimes(1);
  });
});
