import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSavePreferenceTool,
  createForgetPreferenceTool,
} from "../../../packages/ai-agent/src/tools/preference-tools.js";
import type { PreferenceStore } from "../../../packages/ai-agent/src/preference-store.js";
import { BotPlatform } from "@closeclaw/shared-types";

function mockPreferenceStore(): PreferenceStore {
  return {
    load: vi.fn().mockReturnValue(null),
    save: vi.fn(),
    upsertPreference: vi.fn(),
    removePreference: vi.fn().mockReturnValue(true),
  };
}

describe("createSavePreferenceTool", () => {
  let store: PreferenceStore;

  beforeEach(() => {
    store = mockPreferenceStore();
  });

  it("has the correct description", () => {
    const t = createSavePreferenceTool(store, BotPlatform.TELEGRAM, "1");
    expect(t.description).toContain("preference");
  });

  it("calls upsertPreference on execute", async () => {
    const t = createSavePreferenceTool(store, BotPlatform.TELEGRAM, "1");
    const result = await t.execute({ key: "name", value: "Ajay" }, {
      toolCallId: "tc1",
      messages: [],
    });
    expect(store.upsertPreference).toHaveBeenCalledWith(
      BotPlatform.TELEGRAM,
      "1",
      "name",
      "Ajay",
    );
    expect(result).toContain("Saved");
  });
});

describe("createForgetPreferenceTool", () => {
  let store: PreferenceStore;

  beforeEach(() => {
    store = mockPreferenceStore();
  });

  it("has the correct description", () => {
    const t = createForgetPreferenceTool(store, BotPlatform.TELEGRAM, "1");
    expect(t.description).toContain("forget");
  });

  it("calls removePreference on execute", async () => {
    const t = createForgetPreferenceTool(store, BotPlatform.TELEGRAM, "1");
    const result = await t.execute({ key: "tz" }, {
      toolCallId: "tc2",
      messages: [],
    });
    expect(store.removePreference).toHaveBeenCalledWith(
      BotPlatform.TELEGRAM,
      "1",
      "tz",
    );
    expect(result).toContain("Removed");
  });

  it("returns not-found message when key does not exist", async () => {
    (store.removePreference as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const t = createForgetPreferenceTool(store, BotPlatform.TELEGRAM, "1");
    const result = await t.execute({ key: "nope" }, {
      toolCallId: "tc3",
      messages: [],
    });
    expect(result).toContain("not found");
  });
});
