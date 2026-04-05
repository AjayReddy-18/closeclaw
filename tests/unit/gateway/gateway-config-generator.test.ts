import { describe, it, expect } from "vitest";
import { generateGatewayConfig } from "../../../packages/gateway/src/gateway-config-generator.js";

describe("generateGatewayConfig", () => {
  it("returns a config with default bind address and port", () => {
    const config = generateGatewayConfig();
    expect(config.bindAddress).toBe("127.0.0.1");
    expect(config.port).toBe(18790);
  });

  it("generates a 64-char hex auth token", () => {
    const config = generateGatewayConfig();
    expect(config.authToken).toHaveLength(64);
    expect(config.authToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique tokens across calls", () => {
    const a = generateGatewayConfig();
    const b = generateGatewayConfig();
    expect(a.authToken).not.toBe(b.authToken);
  });
});
