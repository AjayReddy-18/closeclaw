export const TOOL_NAMES = [
  "datetime",
  "http_request",
  "shell_execute",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolConfig {
  enabled: boolean;
  allowedTools: ToolName[];
  maxCallDepth: number;
  timeoutMs: number;
}

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  enabled: false,
  allowedTools: [],
  maxCallDepth: 10,
  timeoutMs: 30_000,
};

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && TOOL_NAMES.includes(value as ToolName);
}

export function isValidToolConfig(value: unknown): value is ToolConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["enabled"] !== "boolean") return false;
  if (!Array.isArray(obj["allowedTools"])) return false;
  if (!obj["allowedTools"].every(isToolName)) return false;
  if (typeof obj["maxCallDepth"] !== "number") return false;
  if (obj["maxCallDepth"] < 1) return false;
  if (typeof obj["timeoutMs"] !== "number") return false;
  if (obj["timeoutMs"] < 1000) return false;
  return true;
}
