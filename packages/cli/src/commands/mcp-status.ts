import type { McpConnectionResult } from "@closeclaw/mcp-client";

export interface McpStatusDeps {
  loadConfigs: () => { name: string; type: string; enabled: boolean }[];
  connectAndGetStatus: () => Promise<McpConnectionResult[]>;
}

function statusIcon(status: string): string {
  if (status === "connected") return "ok";
  return "FAIL";
}

function displayResults(results: McpConnectionResult[]): void {
  if (results.length === 0) {
    console.log("No MCP servers configured.");
    return;
  }
  const header =
    `${"Name".padEnd(20)}${"Status".padEnd(10)}` + `${"Tools".padEnd(8)}Error`;
  console.log(`\n${header}`);
  console.log("-".repeat(70));
  for (const r of results) {
    const name = r.serverName.slice(0, 18).padEnd(20);
    const status = statusIcon(r.status).padEnd(10);
    const tools = String(r.toolCount).padEnd(8);
    const error = r.error ?? "";
    console.log(`${name}${status}${tools}${error}`);
  }
  const connected = results.filter((r) => r.status === "connected").length;
  console.log(
    `\n${String(connected)}/${String(results.length)} server(s) connected.`,
  );
}

export async function runMcpStatus(deps: McpStatusDeps): Promise<void> {
  console.log("Checking MCP server connections...");
  const results = await deps.connectAndGetStatus();
  displayResults(results);
}
