import { readFileSync, existsSync } from "node:fs";
import type { McpServerConfig } from "./mcp-config-types.js";
import {
  isValidMcpConfigFile,
  normalizeEntry,
  type McpConfigFile,
} from "./mcp-config-types.js";
import { interpolateRecord } from "./mcp-env-interpolator.js";

function readJsonFile(configPath: string): unknown | undefined {
  if (!existsSync(configPath)) return undefined;
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as unknown;
}

function applyEnvInterpolation(config: McpServerConfig): McpServerConfig {
  if (config.type === "http") {
    return { ...config, headers: interpolateRecord(config.headers) };
  }
  return { ...config, env: interpolateRecord(config.env) };
}

export function loadMcpConfig(configPath: string): McpServerConfig[] {
  let parsed: unknown;
  try {
    parsed = readJsonFile(configPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[mcp] Failed to read config: ${message}`);
    return [];
  }
  if (parsed === undefined) return [];
  if (!isValidMcpConfigFile(parsed)) {
    console.warn("[mcp] Invalid config format in " + configPath);
    return [];
  }
  const file = parsed as McpConfigFile;
  return Object.entries(file.mcpServers)
    .map(([name, entry]) => normalizeEntry(name, entry))
    .filter((config) => config.enabled)
    .map(applyEnvInterpolation);
}
