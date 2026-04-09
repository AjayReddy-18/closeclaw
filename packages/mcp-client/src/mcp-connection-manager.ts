import { experimental_createMCPClient as sdkCreateMCPClient } from "@ai-sdk/mcp";
import type { McpServerConfig } from "./mcp-config-types.js";
import { createTransport as defaultCreateTransport } from "./mcp-transport-factory.js";

const TOOL_NAME_SEPARATOR = "__";
const CONNECTION_TIMEOUT_MS = 15_000;

export type McpConnectionStatus = "connected" | "failed" | "closed";

export interface McpConnectionResult {
  serverName: string;
  status: "connected" | "failed";
  toolCount: number;
  toolNames: string[];
  error: string | undefined;
}

interface McpConnection {
  serverName: string;
  status: McpConnectionStatus;
  toolCount: number;
  tools: Record<string, unknown>;
  client: { close: () => Promise<void> } | undefined;
  error: string | undefined;
}

export interface McpConnectionManager {
  connectAll: (configs: McpServerConfig[]) => Promise<McpConnectionResult[]>;
  getAllTools: () => Record<string, unknown>;
  getStatus: () => McpConnectionResult[];
  closeAll: () => Promise<void>;
}

export interface ConnectionManagerDeps {
  createMCPClient: typeof sdkCreateMCPClient;
  createTransport: typeof defaultCreateTransport;
}

function namespaceTool(serverName: string, toolName: string): string {
  return `${serverName}${TOOL_NAME_SEPARATOR}${toolName}`;
}

function namespaceTools(
  serverName: string,
  tools: Record<string, unknown>,
): Record<string, unknown> {
  const namespaced: Record<string, unknown> = {};
  for (const [name, tool] of Object.entries(tools)) {
    namespaced[namespaceTool(serverName, name)] = tool;
  }
  return namespaced;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Connection timed out after ${String(ms)}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function connectionToResult(conn: McpConnection): McpConnectionResult {
  return {
    serverName: conn.serverName,
    status: conn.status === "closed" ? "failed" : conn.status,
    toolCount: conn.toolCount,
    toolNames: Object.keys(conn.tools),
    error: conn.error,
  };
}

async function connectSingle(
  config: McpServerConfig,
  deps: ConnectionManagerDeps,
): Promise<McpConnection> {
  try {
    const transport = deps.createTransport(config);
    const client = await withTimeout(
      deps.createMCPClient({ transport }),
      CONNECTION_TIMEOUT_MS,
    );
    const rawTools = await client.tools();
    const tools = namespaceTools(config.name, rawTools);
    return {
      serverName: config.name,
      status: "connected",
      toolCount: Object.keys(rawTools).length,
      tools,
      client,
      error: undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      serverName: config.name,
      status: "failed",
      toolCount: 0,
      tools: {},
      client: undefined,
      error: message,
    };
  }
}

const DEFAULT_DEPS: ConnectionManagerDeps = {
  createMCPClient: sdkCreateMCPClient,
  createTransport: defaultCreateTransport,
};

export function createConnectionManager(
  deps: ConnectionManagerDeps = DEFAULT_DEPS,
): McpConnectionManager {
  const connections: McpConnection[] = [];

  async function connectAll(
    configs: McpServerConfig[],
  ): Promise<McpConnectionResult[]> {
    const results = await Promise.all(
      configs.map((c) => connectSingle(c, deps)),
    );
    connections.length = 0;
    connections.push(...results);
    return results.map(connectionToResult);
  }

  function getAllTools(): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const conn of connections) {
      if (conn.status === "connected") Object.assign(merged, conn.tools);
    }
    return merged;
  }

  function getStatus(): McpConnectionResult[] {
    return connections.map(connectionToResult);
  }

  async function closeAll(): Promise<void> {
    await Promise.all(
      connections
        .filter((c) => c.client !== undefined)
        .map(async (c) => {
          try {
            await c.client?.close();
          } catch {
            /* ignore close errors */
          }
          c.status = "closed";
        }),
    );
  }

  return { connectAll, getAllTools, getStatus, closeAll };
}
