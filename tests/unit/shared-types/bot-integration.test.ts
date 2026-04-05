import { describe, it, expect } from "vitest";
import {
  validateBotToken,
  isValidBotIntegration,
} from "@closeclaw/shared-types";

describe("validateBotToken", () => {
  describe("telegram", () => {
    it("accepts valid telegram token format", () => {
      expect(
        validateBotToken(
          "telegram",
          "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        ),
      ).toBe(true);
    });

    it("rejects token without colon separator", () => {
      expect(validateBotToken("telegram", "invalid-token")).toBe(false);
    });

    it("rejects empty token", () => {
      expect(validateBotToken("telegram", "")).toBe(false);
    });

    it("rejects token with spaces", () => {
      expect(validateBotToken("telegram", "123456: ABC")).toBe(false);
    });
  });

  describe("discord", () => {
    it("accepts non-empty discord token", () => {
      expect(validateBotToken("discord", "MTIzNDU2Nzg5.abc.xyz")).toBe(true);
    });

    it("rejects empty discord token", () => {
      expect(validateBotToken("discord", "")).toBe(false);
    });
  });
});

describe("isValidBotIntegration", () => {
  const validIntegration = {
    platform: "telegram",
    botToken: "123456:ABC-DEF",
    enabled: true,
    dmPolicy: "pairing",
    createdAt: "2026-04-05T14:30:00Z",
  };

  it("validates a correct bot integration", () => {
    expect(isValidBotIntegration(validIntegration)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidBotIntegration(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidBotIntegration("string")).toBe(false);
  });

  it("rejects invalid platform", () => {
    expect(
      isValidBotIntegration({ ...validIntegration, platform: "slack" }),
    ).toBe(false);
  });

  it("rejects non-string botToken", () => {
    expect(isValidBotIntegration({ ...validIntegration, botToken: 123 })).toBe(
      false,
    );
  });

  it("rejects non-boolean enabled", () => {
    expect(isValidBotIntegration({ ...validIntegration, enabled: "yes" })).toBe(
      false,
    );
  });

  it("rejects invalid dmPolicy", () => {
    expect(
      isValidBotIntegration({ ...validIntegration, dmPolicy: "block" }),
    ).toBe(false);
  });

  it("rejects invalid createdAt", () => {
    expect(
      isValidBotIntegration({ ...validIntegration, createdAt: "not-a-date" }),
    ).toBe(false);
  });

  it("requires allowedSenders when dmPolicy is allowlist", () => {
    expect(
      isValidBotIntegration({
        ...validIntegration,
        dmPolicy: "allowlist",
      }),
    ).toBe(false);
  });

  it("accepts allowedSenders when dmPolicy is allowlist", () => {
    expect(
      isValidBotIntegration({
        ...validIntegration,
        dmPolicy: "allowlist",
        allowedSenders: ["user123"],
      }),
    ).toBe(true);
  });

  it("rejects empty allowedSenders when dmPolicy is allowlist", () => {
    expect(
      isValidBotIntegration({
        ...validIntegration,
        dmPolicy: "allowlist",
        allowedSenders: [],
      }),
    ).toBe(false);
  });

  it("rejects non-array allowedSenders", () => {
    expect(
      isValidBotIntegration({
        ...validIntegration,
        allowedSenders: "not-array",
      }),
    ).toBe(false);
  });
});
