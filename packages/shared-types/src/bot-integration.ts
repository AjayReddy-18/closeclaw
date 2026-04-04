import { type BotPlatform, isBotPlatform } from "./bot-platform.js";
import { DmPolicy, isDmPolicy } from "./dm-policy.js";

export interface BotIntegration {
  platform: BotPlatform;
  botToken: string;
  enabled: boolean;
  dmPolicy: DmPolicy;
  allowedSenders?: string[];
  createdAt: string;
}

const TELEGRAM_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;

function isValidTelegramToken(token: string): boolean {
  return TELEGRAM_TOKEN_PATTERN.test(token);
}

function isValidDiscordToken(token: string): boolean {
  return token.length > 0;
}

export function validateBotToken(
  platform: BotPlatform,
  token: string,
): boolean {
  if (platform === "telegram") {
    return isValidTelegramToken(token);
  }
  return isValidDiscordToken(token);
}

function isIso8601(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function isValidBotIntegration(
  value: unknown,
): value is BotIntegration {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (!isBotPlatform(obj["platform"])) return false;
  if (typeof obj["botToken"] !== "string") return false;
  if (typeof obj["enabled"] !== "boolean") return false;
  if (!isDmPolicy(obj["dmPolicy"])) return false;
  if (!isIso8601(obj["createdAt"])) return false;

  if (
    obj["dmPolicy"] === DmPolicy.ALLOWLIST &&
    (!Array.isArray(obj["allowedSenders"]) ||
      obj["allowedSenders"].length === 0)
  ) {
    return false;
  }

  if (
    obj["allowedSenders"] !== undefined &&
    !Array.isArray(obj["allowedSenders"])
  ) {
    return false;
  }

  return true;
}
