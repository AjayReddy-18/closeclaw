import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { readConfig } from "../../packages/cli/src/config/config-reader.js";
import { writeConfig } from "../../packages/cli/src/config/config-writer.js";
import { detectConfigState } from "../../packages/cli/src/config/config-detector.js";
import { runOnboard } from "../../packages/cli/src/commands/onboard.js";
import { checkHealth } from "@closeclaw/gateway";
import { isValidConfiguration } from "@closeclaw/shared-types";
import type { BotAdapter, BotHealthResult } from "@closeclaw/bot-adapters";

describe("first-time onboard flow", () => {
  let dir: string;
  let configPath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = join(tmpdir(), `closeclaw-onboard-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    configPath = join(dir, "closeclaw.json");
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("produces a valid configuration file using real config IO", async () => {
    const adapter: BotAdapter = {
      platform: "telegram",
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(() =>
        Promise.resolve({
          connected: true,
          botUsername: "livebot",
        } satisfies BotHealthResult),
      ),
      onMessage: vi.fn(),
    };

    await runOnboard({
      configPath,
      readConfig,
      writeConfig,
      detectConfig: detectConfigState,
      selectAction: async () => "add-integration",
      selectPlatform: async () => "telegram",
      getInstructions: () => "",
      inputBotToken: async () => "123456789:Ab_cdefghijklmnop",
      selectDmPolicy: async () => "pairing",
      createAdapter: () => adapter,
      checkHealth,
      generateGatewayConfig: () => ({
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "a".repeat(64),
      }),
    });

    const loaded = readConfig(configPath);
    expect(loaded).not.toBeNull();
    expect(isValidConfiguration(loaded)).toBe(true);
    expect(loaded!.channels.telegram?.enabled).toBe(true);
    expect(loaded!.channels.telegram?.dmPolicy).toBe("pairing");
    expect(loaded!.version).toBe("0.1.0");
  });

  it("creates no config file when user defers after instructions", async () => {
    const adapter: BotAdapter = {
      platform: "telegram",
      connect: vi.fn(),
      disconnect: vi.fn(),
      healthCheck: vi.fn(() =>
        Promise.resolve({
          connected: true,
          botUsername: "livebot",
        } satisfies BotHealthResult),
      ),
      onMessage: vi.fn(),
    };

    await runOnboard({
      configPath,
      readConfig,
      writeConfig,
      detectConfig: detectConfigState,
      selectAction: async () => "add-integration",
      selectPlatform: async () => "telegram",
      getInstructions: () => "Setup help text\n",
      confirmProceed: async () => false,
      inputBotToken: async () => "123456789:Ab_cdefghijklmnop",
      selectDmPolicy: async () => "pairing",
      createAdapter: () => adapter,
      checkHealth,
      generateGatewayConfig: () => ({
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "a".repeat(64),
      }),
    });

    expect(existsSync(configPath)).toBe(false);
  });
});
