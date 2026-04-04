import { describe, it, expect, vi } from "vitest";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { Configuration } from "@closeclaw/shared-types";
import { DmPolicy } from "@closeclaw/shared-types";
import { runGatewayStart } from "../../../packages/cli/src/commands/gateway-start.js";

describe("runGatewayStart", () => {
  const sampleConfig: Configuration = {
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
      port: 18888,
      authToken: "a".repeat(64),
    },
  };

  it("errors when config is missing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runGatewayStart({
      configPath: "/nope.json",
      pairingStorePath: "/p.json",
      readConfig: () => null,
      createAdapter: vi.fn(),
      createGatewayServer: vi.fn(),
      waitForShutdown: async () => undefined,
    });
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("Run closeclaw onboard"),
    );
    err.mockRestore();
  });

  it("connects adapters, starts gateway, and stops on shutdown", async () => {
    const connect = vi.fn();
    const disconnect = vi.fn();
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    const adapter: BotAdapter = {
      platform: "telegram",
      connect,
      disconnect,
      healthCheck: vi.fn(),
      onMessage: vi.fn(),
      sendMessage: vi.fn(),
    };
    const createAdapter = vi.fn(() => adapter);
    const createGatewayServer = vi.fn(() => ({
      start,
      stop,
      address: () => ({ port: 1 }),
    }));
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/pair.json",
      readConfig: () => sampleConfig,
      createAdapter,
      createGatewayServer,
      waitForShutdown: async () => undefined,
    });
    expect(createAdapter).toHaveBeenCalledWith(
      "telegram",
      "123456789:Ab_cdefghijklmnop",
    );
    expect(connect).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
