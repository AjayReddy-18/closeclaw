import { describe, it, expect } from "vitest";
import { isValidGatewayConfig } from "@closeclaw/shared-types";

describe("isValidGatewayConfig", () => {
  const validConfig = {
    bindAddress: "127.0.0.1",
    port: 18790,
    authToken: "a".repeat(64),
  };

  it("validates a correct gateway config", () => {
    expect(isValidGatewayConfig(validConfig)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidGatewayConfig(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidGatewayConfig("string")).toBe(false);
  });

  it("rejects invalid IPv4 bindAddress", () => {
    expect(
      isValidGatewayConfig({ ...validConfig, bindAddress: "not-an-ip" }),
    ).toBe(false);
  });

  it("rejects port below 1024", () => {
    expect(
      isValidGatewayConfig({ ...validConfig, port: 80 }),
    ).toBe(false);
  });

  it("rejects port above 65535", () => {
    expect(
      isValidGatewayConfig({ ...validConfig, port: 70000 }),
    ).toBe(false);
  });

  it("rejects non-integer port", () => {
    expect(
      isValidGatewayConfig({ ...validConfig, port: 18790.5 }),
    ).toBe(false);
  });

  it("rejects authToken shorter than 32 characters", () => {
    expect(
      isValidGatewayConfig({ ...validConfig, authToken: "short" }),
    ).toBe(false);
  });

  it("accepts authToken of exactly 32 characters", () => {
    expect(
      isValidGatewayConfig({ ...validConfig, authToken: "a".repeat(32) }),
    ).toBe(true);
  });
});
