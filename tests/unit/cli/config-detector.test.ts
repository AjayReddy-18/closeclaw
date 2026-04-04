import { describe, it, expect } from "vitest";
import type { Configuration } from "@closeclaw/shared-types";
import { detectConfigState } from "../../../packages/cli/src/config/config-detector.js";

describe("detectConfigState", () => {
  const baseConfig: Configuration = {
    version: "1.0.0",
    lastModified: "2026-04-05T14:30:00Z",
    channels: {},
    gateway: {
      bindAddress: "127.0.0.1",
      port: 18790,
      authToken: "a".repeat(64),
    },
  };

  it("detects first-time state when config is null", () => {
    const state = detectConfigState(null);
    expect(state.exists).toBe(false);
    expect(state.configuredPlatforms).toEqual([]);
    expect(state.availablePlatforms).toEqual(["telegram", "discord"]);
    expect(state.allPlatformsConfigured).toBe(false);
  });

  it("detects existing config with no channels", () => {
    const state = detectConfigState(baseConfig);
    expect(state.exists).toBe(true);
    expect(state.configuredPlatforms).toEqual([]);
    expect(state.availablePlatforms).toEqual(["telegram", "discord"]);
  });

  it("detects one configured platform", () => {
    const config: Configuration = {
      ...baseConfig,
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "123456:ABC",
          enabled: true,
          dmPolicy: "pairing",
          createdAt: "2026-04-05T14:30:00Z",
        },
      },
    };
    const state = detectConfigState(config);
    expect(state.configuredPlatforms).toEqual(["telegram"]);
    expect(state.availablePlatforms).toEqual(["discord"]);
    expect(state.allPlatformsConfigured).toBe(false);
  });

  it("detects all platforms configured", () => {
    const config: Configuration = {
      ...baseConfig,
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "123456:ABC",
          enabled: true,
          dmPolicy: "pairing",
          createdAt: "2026-04-05T14:30:00Z",
        },
        discord: {
          platform: "discord",
          botToken: "MTIzNDU2Nzg5.abc.xyz",
          enabled: true,
          dmPolicy: "open",
          createdAt: "2026-04-05T14:30:00Z",
        },
      },
    };
    const state = detectConfigState(config);
    expect(state.allPlatformsConfigured).toBe(true);
    expect(state.availablePlatforms).toEqual([]);
  });
});
