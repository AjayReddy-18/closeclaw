import { describe, it, expect, vi } from "vitest";
import { formatPreferencesForContext } from "../../../packages/ai-agent/src/preference-injection.js";
import type { PreferenceStore } from "../../../packages/ai-agent/src/preference-store.js";
import { BotPlatform } from "@closeclaw/shared-types";

function mockStore(
  prefs: Array<{ key: string; value: string }>,
): PreferenceStore {
  return {
    load: vi.fn().mockReturnValue({
      platform: "telegram",
      senderId: "1",
      preferences: prefs.map((p) => ({
        ...p,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })),
      lastModifiedAt: "2026-01-01T00:00:00.000Z",
    }),
    save: vi.fn(),
    upsertPreference: vi.fn(),
    removePreference: vi.fn(),
  };
}

describe("formatPreferencesForContext", () => {
  it("returns empty string when no preferences exist", () => {
    const store: PreferenceStore = {
      load: vi.fn().mockReturnValue(null),
      save: vi.fn(),
      upsertPreference: vi.fn(),
      removePreference: vi.fn(),
    };
    const result = formatPreferencesForContext(
      store,
      BotPlatform.TELEGRAM,
      "1",
    );
    expect(result).toBe("");
  });

  it("returns empty string when preferences array is empty", () => {
    const store = mockStore([]);
    const result = formatPreferencesForContext(
      store,
      BotPlatform.TELEGRAM,
      "1",
    );
    expect(result).toBe("");
  });

  it("formats preferences as a readable block", () => {
    const store = mockStore([
      { key: "name", value: "Ajay" },
      { key: "timezone", value: "IST" },
    ]);
    const result = formatPreferencesForContext(
      store,
      BotPlatform.TELEGRAM,
      "1",
    );
    expect(result).toContain("name: Ajay");
    expect(result).toContain("timezone: IST");
    expect(result).toContain("User preferences:");
  });
});
