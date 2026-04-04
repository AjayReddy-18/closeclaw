export interface GatewayConfig {
  bindAddress: string;
  port: number;
  authToken: string;
}

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

const MIN_PORT = 1024;
const MAX_PORT = 65535;
const MIN_AUTH_TOKEN_LENGTH = 32;

export function isValidGatewayConfig(value: unknown): value is GatewayConfig {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (typeof obj["bindAddress"] !== "string") return false;
  if (!IPV4_PATTERN.test(obj["bindAddress"])) return false;

  if (typeof obj["port"] !== "number") return false;
  if (!Number.isInteger(obj["port"])) return false;
  if (obj["port"] < MIN_PORT || obj["port"] > MAX_PORT) return false;

  if (typeof obj["authToken"] !== "string") return false;
  if (obj["authToken"].length < MIN_AUTH_TOKEN_LENGTH) return false;

  return true;
}
