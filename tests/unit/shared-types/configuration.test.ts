import { describe, it, expect } from "vitest";
import {
  DEFAULT_TOOL_CONFIG,
  isValidConfiguration,
} from "@closeclaw/shared-types";

describe("isValidConfiguration", () => {
  const validConfig = {
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
    },
    gateway: {
      bindAddress: "127.0.0.1",
      port: 18790,
      authToken: "a".repeat(64),
    },
  };

  it("validates a correct configuration", () => {
    expect(isValidConfiguration(validConfig)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidConfiguration(null)).toBe(false);
  });

  it("rejects invalid semver version", () => {
    expect(isValidConfiguration({ ...validConfig, version: "v1" })).toBe(false);
  });

  it("rejects invalid lastModified date", () => {
    expect(
      isValidConfiguration({ ...validConfig, lastModified: "not-a-date" }),
    ).toBe(false);
  });

  it("rejects non-object channels", () => {
    expect(isValidConfiguration({ ...validConfig, channels: "bad" })).toBe(
      false,
    );
  });

  it("rejects unknown platform key in channels", () => {
    expect(
      isValidConfiguration({
        ...validConfig,
        channels: {
          slack: validConfig.channels.telegram,
        },
      }),
    ).toBe(false);
  });

  it("rejects invalid bot integration in channels", () => {
    expect(
      isValidConfiguration({
        ...validConfig,
        channels: { telegram: { platform: "telegram" } },
      }),
    ).toBe(false);
  });

  it("rejects invalid gateway config", () => {
    expect(
      isValidConfiguration({
        ...validConfig,
        gateway: { bindAddress: "bad", port: 80, authToken: "short" },
      }),
    ).toBe(false);
  });

  it("validates config with empty channels", () => {
    expect(isValidConfiguration({ ...validConfig, channels: {} })).toBe(true);
  });

  it("validates config with multiple channels", () => {
    expect(
      isValidConfiguration({
        ...validConfig,
        channels: {
          telegram: validConfig.channels.telegram,
          discord: {
            ...validConfig.channels.telegram,
            platform: "discord",
            botToken: "MTIzNDU2Nzg5.abc.xyz",
          },
        },
      }),
    ).toBe(true);
  });

  it("validates config without agent (backward compat)", () => {
    expect(isValidConfiguration(validConfig)).toBe(true);
    expect(isValidConfiguration({ ...validConfig, agent: undefined })).toBe(
      true,
    );
  });

  it("validates config with valid agent", () => {
    expect(
      isValidConfiguration({
        ...validConfig,
        agent: {
          provider: "openai",
          model: "gpt-4",
          apiKey: "sk-test",
          systemPrompt: "You are helpful.",
          maxContextTokens: 8192,
          tools: DEFAULT_TOOL_CONFIG,
        },
      }),
    ).toBe(true);
  });

  it("rejects config with invalid agent", () => {
    expect(
      isValidConfiguration({
        ...validConfig,
        agent: {
          provider: "openai",
          model: "gpt-4",
          systemPrompt: "x",
          maxContextTokens: 1,
          tools: DEFAULT_TOOL_CONFIG,
        },
      }),
    ).toBe(false);
  });
});
