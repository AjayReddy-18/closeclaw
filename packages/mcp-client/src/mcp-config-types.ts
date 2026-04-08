export type McpTransportType = "stdio" | "http";

export interface StdioServerConfig {
  name: string;
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

export interface HttpServerConfig {
  name: string;
  type: "http";
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
}

export type McpServerConfig = StdioServerConfig | HttpServerConfig;

export interface StdioServerConfigEntry {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface HttpServerConfigEntry {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export type McpServerConfigEntry = StdioServerConfigEntry | HttpServerConfigEntry;

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfigEntry>;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function isValidStdioEntry(value: unknown): value is StdioServerConfigEntry {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj["type"] !== "stdio") return false;
  if (typeof obj["command"] !== "string" || obj["command"] === "") return false;
  if (obj["args"] !== undefined && !isStringArray(obj["args"])) return false;
  if (obj["env"] !== undefined && !isStringRecord(obj["env"])) return false;
  if (obj["enabled"] !== undefined && typeof obj["enabled"] !== "boolean") return false;
  return true;
}

export function isValidHttpEntry(value: unknown): value is HttpServerConfigEntry {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj["type"] !== "http") return false;
  if (typeof obj["url"] !== "string" || obj["url"] === "") return false;
  if (obj["headers"] !== undefined && !isStringRecord(obj["headers"])) return false;
  if (obj["enabled"] !== undefined && typeof obj["enabled"] !== "boolean") return false;
  return true;
}

export function isValidServerEntry(value: unknown): value is McpServerConfigEntry {
  return isValidStdioEntry(value) || isValidHttpEntry(value);
}

export function isValidMcpConfigFile(value: unknown): value is McpConfigFile {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["mcpServers"] !== "object" || obj["mcpServers"] === null) return false;
  const servers = obj["mcpServers"] as Record<string, unknown>;
  return Object.values(servers).every(isValidServerEntry);
}

function normalizeStdioEntry(name: string, entry: StdioServerConfigEntry): StdioServerConfig {
  return {
    name,
    type: "stdio",
    command: entry.command,
    args: entry.args ?? [],
    env: entry.env ?? {},
    enabled: entry.enabled ?? true,
  };
}

function normalizeHttpEntry(name: string, entry: HttpServerConfigEntry): HttpServerConfig {
  return {
    name,
    type: "http",
    url: entry.url,
    headers: entry.headers ?? {},
    enabled: entry.enabled ?? true,
  };
}

export function normalizeEntry(name: string, entry: McpServerConfigEntry): McpServerConfig {
  if (entry.type === "stdio") return normalizeStdioEntry(name, entry);
  return normalizeHttpEntry(name, entry);
}
