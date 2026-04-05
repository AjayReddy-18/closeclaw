import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPreferenceStore } from "../../../packages/ai-agent/src/preference-store.js";
import { BotPlatform } from "@closeclaw/shared-types";

describe("createPreferenceStore", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `cc-test-pref-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no file exists", () => {
    const store = createPreferenceStore(dir);
    expect(store.load(BotPlatform.TELEGRAM, "999")).toBeNull();
  });

  it("saves and loads preferences", () => {
    const store = createPreferenceStore(dir);
    const data = {
      platform: "telegram",
      senderId: "42",
      preferences: [
        { key: "name", value: "Ajay", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      lastModifiedAt: "2026-01-01T00:00:00.000Z",
    };
    store.save(BotPlatform.TELEGRAM, "42", data);
    expect(store.load(BotPlatform.TELEGRAM, "42")).toEqual(data);
  });

  it("upsertPreference creates file if none exists", () => {
    const store = createPreferenceStore(dir);
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "tz", "IST");
    const loaded = store.load(BotPlatform.TELEGRAM, "1");
    expect(loaded?.preferences).toHaveLength(1);
    expect(loaded?.preferences[0].key).toBe("tz");
    expect(loaded?.preferences[0].value).toBe("IST");
  });

  it("upsertPreference updates existing key", () => {
    const store = createPreferenceStore(dir);
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "tz", "IST");
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "tz", "PST");
    const loaded = store.load(BotPlatform.TELEGRAM, "1");
    expect(loaded?.preferences).toHaveLength(1);
    expect(loaded?.preferences[0].value).toBe("PST");
  });

  it("upsertPreference adds new key alongside existing", () => {
    const store = createPreferenceStore(dir);
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "tz", "IST");
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "name", "Ajay");
    const loaded = store.load(BotPlatform.TELEGRAM, "1");
    expect(loaded?.preferences).toHaveLength(2);
  });

  it("removePreference returns true when key existed", () => {
    const store = createPreferenceStore(dir);
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "tz", "IST");
    expect(store.removePreference(BotPlatform.TELEGRAM, "1", "tz")).toBe(true);
    const loaded = store.load(BotPlatform.TELEGRAM, "1");
    expect(loaded?.preferences).toHaveLength(0);
  });

  it("removePreference returns false when key not found", () => {
    const store = createPreferenceStore(dir);
    store.upsertPreference(BotPlatform.TELEGRAM, "1", "tz", "IST");
    expect(store.removePreference(BotPlatform.TELEGRAM, "1", "nope")).toBe(
      false,
    );
  });

  it("removePreference returns false when no file exists", () => {
    const store = createPreferenceStore(dir);
    expect(store.removePreference(BotPlatform.TELEGRAM, "99", "x")).toBe(false);
  });

  it("returns null for corrupted JSON", () => {
    writeFileSync(join(dir, "telegram-bad.json"), "{{bad", "utf-8");
    const store = createPreferenceStore(dir);
    expect(store.load(BotPlatform.TELEGRAM, "bad")).toBeNull();
  });

  it("creates directory if it does not exist", () => {
    const nested = join(dir, "sub", "deep");
    const store = createPreferenceStore(nested);
    store.upsertPreference(BotPlatform.DISCORD, "1", "lang", "ts");
    expect(store.load(BotPlatform.DISCORD, "1")).not.toBeNull();
  });
});
