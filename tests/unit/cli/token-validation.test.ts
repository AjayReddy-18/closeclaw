import { describe, it, expect } from "vitest";
import { validateBotToken } from "@closeclaw/shared-types";
import type { BotPlatform } from "@closeclaw/shared-types";

describe("validateBotToken for CLI onboarding", () => {
  describe("telegram format", () => {
    it("accepts digit prefix colon alphanumeric secret", () => {
      expect(
        validateBotToken("telegram" as BotPlatform, "123456789:Ab_c-9xY"),
      ).toBe(true);
    });

    it("rejects token without colon", () => {
      expect(
        validateBotToken("telegram" as BotPlatform, "noColonHere"),
      ).toBe(false);
    });

    it("rejects empty telegram token", () => {
      expect(validateBotToken("telegram" as BotPlatform, "")).toBe(false);
    });
  });

  describe("discord format", () => {
    it("accepts non-empty discord token", () => {
      expect(
        validateBotToken("discord" as BotPlatform, "any.nonempty.value"),
      ).toBe(true);
    });

    it("rejects empty discord token", () => {
      expect(validateBotToken("discord" as BotPlatform, "")).toBe(false);
    });
  });
});
