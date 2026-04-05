import { describe, it, expect } from "vitest";
import { AI_PROVIDERS, isAiProvider } from "@closeclaw/shared-types";

describe("AI_PROVIDERS", () => {
  it("has exactly 6 entries", () => {
    expect(AI_PROVIDERS).toHaveLength(6);
  });
});

describe("isAiProvider", () => {
  it.each(AI_PROVIDERS)("returns true for valid provider %s", (provider) => {
    expect(isAiProvider(provider)).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isAiProvider("azure")).toBe(false);
    expect(isAiProvider("")).toBe(false);
    expect(isAiProvider("OPENAI")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isAiProvider(null)).toBe(false);
    expect(isAiProvider(undefined)).toBe(false);
    expect(isAiProvider(1)).toBe(false);
    expect(isAiProvider({})).toBe(false);
    expect(isAiProvider([])).toBe(false);
  });
});
