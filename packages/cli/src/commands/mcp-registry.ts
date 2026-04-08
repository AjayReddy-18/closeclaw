import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { select, input, confirm } from "@inquirer/prompts";
import {
  addServer,
  removeServer,
  listServers,
  serverExists,
  loadMcpConfig,
  createConnectionManager,
} from "@closeclaw/mcp-client";
import { runMcpAdd } from "./mcp-add.js";
import { runMcpRemove } from "./mcp-remove.js";
import { runMcpList } from "./mcp-list.js";
import { runMcpStatus } from "./mcp-status.js";

export interface McpDeps {
  configPath: string;
}

export function createMcpDeps(): McpDeps {
  return { configPath: join(homedir(), ".closeclaw", "mcp.json") };
}

export function registerMcpCommands(program: Command, deps: McpDeps): void {
  const mcp = program.command("mcp").description("Manage MCP servers");

  mcp
    .command("add")
    .argument("<name>", "Server name")
    .description("Add an MCP server configuration")
    .action(async (name: string) => {
      await runMcpAdd(name, {
        configPath: deps.configPath,
        serverExists,
        addServer,
        promptSelect: select,
        promptInput: input,
        promptConfirm: confirm,
      });
    });

  mcp
    .command("remove")
    .argument("<name>", "Server name to remove")
    .description("Remove an MCP server configuration")
    .action((name: string) => {
      runMcpRemove(name, { configPath: deps.configPath, removeServer });
    });

  mcp
    .command("list")
    .description("List all configured MCP servers")
    .action(() => {
      runMcpList({ configPath: deps.configPath, listServers });
    });

  mcp
    .command("status")
    .description("Check MCP server connection health")
    .action(async () => {
      await runMcpStatus({
        loadConfigs: () => listServers(deps.configPath),
        connectAndGetStatus: async () => {
          const configs = loadMcpConfig(deps.configPath);
          if (configs.length === 0) return [];
          const manager = createConnectionManager();
          const results = await manager.connectAll(configs);
          await manager.closeAll();
          return results;
        },
      });
    });
}
