import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";
import type { BotPlatform, Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import {
  runOnboard,
  type OnboardDeps,
} from "../../../packages/cli/src/commands/onboard.js";

describe("runOnboard reset configuration", () => {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function baseDeps(
    storedRef: { current: Configuration },
    over: Partial<OnboardDeps> = {},
  ): OnboardDeps {
    return {
      configPath: "/tmp/cfg.json",
      readConfig: vi.fn((): Configuration | null => storedRef.current),
      detectConfig: vi.fn((cfg: Configuration | null) => {
        if (cfg === null) {
          return {
            exists: false,
            configuredPlatforms: [] as BotPlatform[],
            availablePlatforms: ["telegram", "discord"] as BotPlatform[],
            allPlatformsConfigured: false,
          };
        }
        const configuredPlatforms = Object.keys(
          cfg.channels,
        ) as BotPlatform[];
        const all: BotPlatform[] = ["telegram", "discord"];
        const availablePlatforms = all.filter(
          (p) => !configuredPlatforms.includes(p),
        );
        return {
          exists: true,
          configuredPlatforms,
          availablePlatforms,
          allPlatformsConfigured: availablePlatforms.length === 0,
        };
      }),
      writeConfig: vi.fn((_path: string, c: Configuration) => {
        storedRef.current = c;
      }),
      selectAction: vi.fn(async () => "reset-configuration" as const),
      selectResetScope: vi.fn(async () => "all" as const),
      selectPlatformToReset: vi.fn(async (): Promise<BotPlatform> => "telegram"),
      confirmReset: vi.fn(async () => true),
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

  it("reset all confirms, clears channels, then runs first-time configure flow", async () => {
    const storedRef = {
      current: {
        version: "0.1.0",
        lastModified: new Date().toISOString(),
        channels: {
          telegram: {
            platform: "telegram" as const,
            botToken: "old-tg",
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
      } satisfies Configuration,
    };
    const deps = baseDeps(storedRef);
    await runOnboard(deps);
    expect(deps.confirmReset).toHaveBeenCalled();
    const afterReset = deps.writeConfig.mock.calls.find(
      (call) => Object.keys(call[1]!.channels).length === 0,
    );
    expect(afterReset).toBeDefined();
    expect(deps.selectPlatform).toHaveBeenCalledWith(["telegram", "discord"]);
    expect(storedRef.current.channels.discord?.botToken).toBe(
      "discord-secret-token",
    );
  });

  it("reset specific removes chosen platform and preserves the other", async () => {
    const storedRef = {
      current: {
        version: "0.1.0",
        lastModified: new Date().toISOString(),
        channels: {
          telegram: {
            platform: "telegram" as const,
            botToken: "tg-keep",
            enabled: true,
            dmPolicy: DmPolicy.PAIRING,
            createdAt: "2021-01-01T00:00:00.000Z",
          },
          discord: {
            platform: "discord" as const,
            botToken: "dc-preserve",
            enabled: true,
            dmPolicy: DmPolicy.PAIRING,
            createdAt: "2021-02-01T00:00:00.000Z",
          },
        },
        gateway: {
          bindAddress: "127.0.0.1",
          port: 18790,
          authToken: "b".repeat(64),
        },
      } satisfies Configuration,
    };
    const deps = baseDeps(storedRef, {
      selectResetScope: vi.fn(async () => "specific" as const),
      selectPlatform: vi.fn(async () => "telegram"),
      inputBotToken: vi.fn(async () => "new-tg-token"),
      createAdapter: vi.fn(() => tgAdapter),
      checkHealth: vi.fn(async () => ({
        status: "healthy" as const,
        channels: {
          telegram: { connected: true, botUsername: "t" },
        },
      })),
    });
    await runOnboard(deps);
    expect(deps.selectPlatformToReset).toHaveBeenCalledWith([
      "telegram",
      "discord",
    ]);
    const midWrite = deps.writeConfig.mock.calls.find(
      (call) => call[1]!.channels.telegram === undefined,
    );
    expect(midWrite?.[1]!.channels.discord?.botToken).toBe("dc-preserve");
    expect(storedRef.current.channels.discord?.botToken).toBe("dc-preserve");
    expect(storedRef.current.channels.telegram?.botToken).toBe("new-tg-token");
  });

  it("cancel on confirmation leaves config unchanged", async () => {
    const storedRef = {
      current: {
        version: "0.1.0",
        lastModified: new Date().toISOString(),
        channels: {
          telegram: {
            platform: "telegram" as const,
            botToken: "unchanged",
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
      } satisfies Configuration,
    };
    const snapshot = structuredClone(storedRef.current);
    const deps = baseDeps(storedRef, {
      confirmReset: vi.fn(async () => false),
    });
    await runOnboard(deps);
    expect(deps.writeConfig).not.toHaveBeenCalled();
    expect(storedRef.current).toEqual(snapshot);
    expect(deps.selectPlatform).not.toHaveBeenCalled();
  });
});
