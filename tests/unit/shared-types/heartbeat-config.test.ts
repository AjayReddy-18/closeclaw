import { describe, it, expect } from "vitest";
import { isValidHeartbeatConfig } from "@closeclaw/shared-types";

function validConfig() {
  return { enabled: true, every: "30m", target: "last" };
}

describe("isValidHeartbeatConfig", () => {
  it("accepts minimal valid config", () => {
    expect(isValidHeartbeatConfig(validConfig())).toBe(true);
  });

  it("accepts config with activeHours", () => {
    const c = {
      ...validConfig(),
      activeHours: { start: "09:00", end: "22:00" },
    };
    expect(isValidHeartbeatConfig(c)).toBe(true);
  });

  it("accepts config with timezone", () => {
    const c = { ...validConfig(), timezone: "America/New_York" };
    expect(isValidHeartbeatConfig(c)).toBe(true);
  });

  it("accepts target none", () => {
    const c = { ...validConfig(), target: "none" };
    expect(isValidHeartbeatConfig(c)).toBe(true);
  });

  it("accepts disabled config", () => {
    const c = { ...validConfig(), enabled: false };
    expect(isValidHeartbeatConfig(c)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidHeartbeatConfig(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidHeartbeatConfig("string")).toBe(false);
  });

  it("rejects missing enabled", () => {
    const c = { every: "30m", target: "last" };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("rejects non-boolean enabled", () => {
    const c = { ...validConfig(), enabled: "yes" };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("rejects missing every", () => {
    const c = { enabled: true, target: "last" };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("rejects invalid every format", () => {
    const c = { ...validConfig(), every: "thirty minutes" };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("rejects invalid target", () => {
    const c = { ...validConfig(), target: "all" };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("rejects invalid activeHours format", () => {
    const c = { ...validConfig(), activeHours: { start: "9am", end: "10pm" } };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("rejects non-string timezone", () => {
    const c = { ...validConfig(), timezone: 123 };
    expect(isValidHeartbeatConfig(c)).toBe(false);
  });

  it("accepts various duration units", () => {
    for (const every of ["10s", "5m", "2h", "1d"]) {
      expect(isValidHeartbeatConfig({ ...validConfig(), every })).toBe(true);
    }
  });
});
