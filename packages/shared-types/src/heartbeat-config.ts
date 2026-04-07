export interface ActiveHours {
  start: string;
  end: string;
}

export type HeartbeatTarget = "last" | "none";

export interface HeartbeatConfig {
  enabled: boolean;
  every: string;
  activeHours?: ActiveHours;
  timezone?: string;
  target: HeartbeatTarget;
}

export const DEFAULT_HEARTBEAT_INTERVAL = "30m";
export const DEFAULT_HEARTBEAT_TARGET: HeartbeatTarget = "last";

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const DURATION_PATTERN = /^\d+[smhd]$/;

function isValidActiveHours(value: unknown): value is ActiveHours {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["start"] !== "string") return false;
  if (typeof obj["end"] !== "string") return false;
  return TIME_PATTERN.test(obj["start"]) && TIME_PATTERN.test(obj["end"]);
}

export function isValidHeartbeatConfig(
  value: unknown,
): value is HeartbeatConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["enabled"] !== "boolean") return false;
  if (typeof obj["every"] !== "string") return false;
  if (!DURATION_PATTERN.test(obj["every"])) return false;
  if (obj["target"] !== "last" && obj["target"] !== "none") return false;
  if (obj["activeHours"] !== undefined) {
    if (!isValidActiveHours(obj["activeHours"])) return false;
  }
  if (obj["timezone"] !== undefined) {
    if (typeof obj["timezone"] !== "string") return false;
  }
  return true;
}
