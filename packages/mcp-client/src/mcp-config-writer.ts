import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { McpConfigFile, McpServerConfigEntry } from "./mcp-config-types.js";

function ensureDirectory(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readConfigFile(configPath: string): McpConfigFile {
  if (!existsSync(configPath)) return { mcpServers: {} };
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as McpConfigFile;
}

function writeConfigFile(configPath: string, config: McpConfigFile): void {
  ensureDirectory(configPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function serverExists(configPath: string, name: string): boolean {
  const config = readConfigFile(configPath);
  return name in config.mcpServers;
}

export function addServer(
  configPath: string,
  name: string,
  entry: McpServerConfigEntry,
): void {
  const config = readConfigFile(configPath);
  config.mcpServers[name] = entry;
  writeConfigFile(configPath, config);
}

export function removeServer(configPath: string, name: string): boolean {
  const config = readConfigFile(configPath);
  if (!(name in config.mcpServers)) return false;
  delete config.mcpServers[name];
  writeConfigFile(configPath, config);
  return true;
}

export interface ServerListEntry {
  name: string;
  type: string;
  detail: string;
  enabled: boolean;
}

function entryDetail(entry: McpServerConfigEntry): string {
  if (entry.type === "stdio") {
    const args = entry.args?.join(" ") ?? "";
    return `${entry.command} ${args}`.trim();
  }
  return entry.url;
}

export function listServers(configPath: string): ServerListEntry[] {
  const config = readConfigFile(configPath);
  return Object.entries(config.mcpServers).map(([name, entry]) => ({
    name,
    type: entry.type,
    detail: entryDetail(entry),
    enabled: entry.enabled ?? true,
  }));
}
