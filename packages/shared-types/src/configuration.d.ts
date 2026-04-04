import type { BotPlatform } from "./bot-platform.js";
import { type BotIntegration } from "./bot-integration.js";
import { type GatewayConfig } from "./gateway-config.js";
export interface Configuration {
  version: string;
  lastModified: string;
  channels: Partial<Record<BotPlatform, BotIntegration>>;
  gateway: GatewayConfig;
}
export declare function isValidConfiguration(
  value: unknown,
): value is Configuration;
//# sourceMappingURL=configuration.d.ts.map
