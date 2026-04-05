import type { BotPlatform } from "./bot-platform.js";
import {
  isValidBotIntegration,
  type BotIntegration,
} from "./bot-integration.js";
import { isValidGatewayConfig, type GatewayConfig } from "./gateway-config.js";
import { isBotPlatform } from "./bot-platform.js";
import type { AgentConfig } from "./agent-config.js";
import { isValidAgentConfig } from "./agent-config.js";

export interface Configuration {
  version: string;
  lastModified: string;
  channels: Partial<Record<BotPlatform, BotIntegration>>;
  gateway: GatewayConfig;
  agent?: AgentConfig;
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function isValidConfiguration(value: unknown): value is Configuration {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (typeof obj["version"] !== "string") return false;
  if (!SEMVER_PATTERN.test(obj["version"])) return false;

  if (typeof obj["lastModified"] !== "string") return false;
  if (isNaN(new Date(obj["lastModified"]).getTime())) return false;

  if (typeof obj["channels"] !== "object" || obj["channels"] === null) {
    return false;
  }

  const channels = obj["channels"] as Record<string, unknown>;
  for (const [key, integration] of Object.entries(channels)) {
    if (!isBotPlatform(key)) return false;
    if (!isValidBotIntegration(integration)) return false;
  }

  if (!isValidGatewayConfig(obj["gateway"])) return false;

  if (obj["agent"] !== undefined && !isValidAgentConfig(obj["agent"])) {
    return false;
  }

  return true;
}
