import {
  loadMcpConfig,
  createConnectionManager,
  type McpConnectionManager,
  type McpConnectionResult,
} from "@closeclaw/mcp-client";

interface McpConnectResult {
  manager: McpConnectionManager;
  tools: Record<string, unknown>;
}

function logConnectionResults(results: McpConnectionResult[]): void {
  for (const result of results) {
    if (result.status === "connected") {
      console.log(
        `[mcp] ${result.serverName}: connected (${String(result.toolCount)} tools)`,
      );
    } else {
      console.warn(`[mcp] ${result.serverName}: failed — ${result.error}`);
    }
  }
}

export async function connectMcpServers(
  mcpConfigPath: string,
): Promise<McpConnectResult> {
  const configs = loadMcpConfig(mcpConfigPath);
  if (configs.length === 0) return { manager: createConnectionManager(), tools: {} };
  console.log(`[mcp] Connecting to ${String(configs.length)} server(s)...`);
  const manager = createConnectionManager();
  const results = await manager.connectAll(configs);
  logConnectionResults(results);
  const tools = manager.getAllTools();
  const toolCount = Object.keys(tools).length;
  if (toolCount > 0) {
    console.log(`[mcp] ${String(toolCount)} MCP tools available`);
  }
  return { manager, tools };
}
