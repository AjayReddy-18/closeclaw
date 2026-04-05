export interface GatewayConfig {
  bindAddress: string;
  port: number;
  authToken: string;
}
export declare function isValidGatewayConfig(
  value: unknown,
): value is GatewayConfig;
//# sourceMappingURL=gateway-config.d.ts.map
