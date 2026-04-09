import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { McpServerConfig } from "./mcp-config-types.js";

export type StdioTransport = InstanceType<typeof StdioMCPTransport>;

export interface HttpTransportConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export type McpTransport = StdioTransport | HttpTransportConfig;

function createStdioTransport(
  config: McpServerConfig & { type: "stdio" },
): StdioTransport {
  return new StdioMCPTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env } as Record<string, string>,
  });
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : url + "/";
}

function createHttpTransport(
  config: McpServerConfig & { type: "http" },
): HttpTransportConfig {
  const headers =
    Object.keys(config.headers).length > 0 ? config.headers : undefined;
  return { type: "http", url: ensureTrailingSlash(config.url), headers };
}

export function createTransport(config: McpServerConfig): McpTransport {
  if (config.type === "stdio") return createStdioTransport(config);
  return createHttpTransport(config);
}
