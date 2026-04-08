import type { ServerListEntry } from "@closeclaw/mcp-client";

export interface McpListDeps {
  configPath: string;
  listServers: (configPath: string) => ServerListEntry[];
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function runMcpList(deps: McpListDeps): void {
  const servers = deps.listServers(deps.configPath);
  if (servers.length === 0) {
    console.log("No MCP servers configured.");
    return;
  }
  const header =
    `${"Name".padEnd(18)}${"Type".padEnd(8)}` +
    `${"URL/Command".padEnd(42)}Enabled`;
  console.log(`\n${header}`);
  console.log("-".repeat(76));
  for (const s of servers) {
    const name = truncate(s.name, 16).padEnd(18);
    const type = s.type.padEnd(8);
    const detail = truncate(s.detail, 40).padEnd(42);
    const enabled = s.enabled ? "yes" : "no";
    console.log(`${name}${type}${detail}${enabled}`);
  }
  console.log(`\n${String(servers.length)} server(s) configured.`);
}
