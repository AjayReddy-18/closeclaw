import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { McpServerConfig } from "./mcp-config-types.js";

export type StdioTransport = InstanceType<typeof StdioMCPTransport>;

export interface SseTransportConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export type McpTransport = StdioTransport | SseTransportConfig;

function createStdioTransport(
  config: McpServerConfig & { type: "stdio" },
): StdioTransport {
  return new StdioMCPTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env } as Record<string, string>,
  });
}

function createSseTransport(
  config: McpServerConfig & { type: "http" },
): SseTransportConfig {
  const headers =
    Object.keys(config.headers).length > 0 ? config.headers : undefined;
  return { type: "sse", url: config.url, headers };
}

export function createTransport(config: McpServerConfig): McpTransport {
  if (config.type === "stdio") return createStdioTransport(config);
  return createSseTransport(config);
}
