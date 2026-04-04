import { describe, it, expect } from "vitest";
import { isValidConfiguration } from "@closeclaw/shared-types";

describe("Configuration JSON Schema Contract", () => {
  it("matches documented example from data-model.md", () => {
    const documented = {
      version: "1.0.0",
      lastModified: "2026-04-05T14:30:00Z",
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
          enabled: true,
          dmPolicy: "pairing",
          createdAt: "2026-04-05T14:30:00Z",
        },
      },
      gateway: {
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
      },
    };
    expect(isValidConfiguration(documented)).toBe(true);
  });

  it("requires version field to be semver", () => {
    const config = {
      version: "v1",
      lastModified: "2026-04-05T14:30:00Z",
      channels: {},
      gateway: {
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "a".repeat(64),
      },
    };
    expect(isValidConfiguration(config)).toBe(false);
  });

  it("validates dual-platform configuration", () => {
    const config = {
      version: "1.0.0",
      lastModified: "2026-04-05T14:30:00Z",
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "123456:ABC-DEF",
          enabled: true,
          dmPolicy: "pairing",
          createdAt: "2026-04-05T14:30:00Z",
        },
        discord: {
          platform: "discord",
          botToken: "MTIzNDU2Nzg5.abc.xyz",
          enabled: true,
          dmPolicy: "allowlist",
          allowedSenders: ["user1"],
          createdAt: "2026-04-05T15:00:00Z",
        },
      },
      gateway: {
        bindAddress: "127.0.0.1",
        port: 18790,
        authToken: "a".repeat(64),
      },
    };
    expect(isValidConfiguration(config)).toBe(true);
  });
});
