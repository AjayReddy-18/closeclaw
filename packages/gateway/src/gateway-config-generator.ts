import { randomBytes } from "node:crypto";
import type { GatewayConfig } from "@closeclaw/shared-types";

export function generateGatewayConfig(): GatewayConfig {
  return {
    bindAddress: "127.0.0.1",
    port: 18790,
    authToken: randomBytes(32).toString("hex"),
  };
}
