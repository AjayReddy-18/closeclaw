import { describe, it, expect } from "vitest";
import {
  BotPlatform,
  BOT_PLATFORMS,
  isBotPlatform,
  DmPolicy,
  DM_POLICIES,
  isDmPolicy,
} from "@closeclaw/shared-types";

describe("BotPlatform", () => {
  it("defines telegram and discord values", () => {
    expect(BotPlatform.TELEGRAM).toBe("telegram");
    expect(BotPlatform.DISCORD).toBe("discord");
  });

  it("exports all platforms as a readonly array", () => {
    expect(BOT_PLATFORMS).toEqual(["telegram", "discord"]);
  });

  it("validates known platforms", () => {
    expect(isBotPlatform("telegram")).toBe(true);
    expect(isBotPlatform("discord")).toBe(true);
  });

  it("rejects unknown platforms", () => {
    expect(isBotPlatform("slack")).toBe(false);
    expect(isBotPlatform("")).toBe(false);
    expect(isBotPlatform(null)).toBe(false);
    expect(isBotPlatform(undefined)).toBe(false);
    expect(isBotPlatform(42)).toBe(false);
  });
});

describe("DmPolicy", () => {
  it("defines pairing, allowlist, and open values", () => {
    expect(DmPolicy.PAIRING).toBe("pairing");
    expect(DmPolicy.ALLOWLIST).toBe("allowlist");
    expect(DmPolicy.OPEN).toBe("open");
  });

  it("exports all policies as a readonly array", () => {
    expect(DM_POLICIES).toEqual(["pairing", "allowlist", "open"]);
  });

  it("validates known policies", () => {
    expect(isDmPolicy("pairing")).toBe(true);
    expect(isDmPolicy("allowlist")).toBe(true);
    expect(isDmPolicy("open")).toBe(true);
  });

  it("rejects unknown policies", () => {
    expect(isDmPolicy("block")).toBe(false);
    expect(isDmPolicy("")).toBe(false);
    expect(isDmPolicy(null)).toBe(false);
    expect(isDmPolicy(123)).toBe(false);
  });
});
