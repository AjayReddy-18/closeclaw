import type { McpServerConfigEntry } from "@closeclaw/mcp-client";

export interface McpAddDeps {
  configPath: string;
  serverExists: (configPath: string, name: string) => boolean;
  addServer: (
    configPath: string,
    name: string,
    entry: McpServerConfigEntry,
  ) => void;
  promptSelect: (opts: {
    message: string;
    choices: { value: string }[];
  }) => Promise<string>;
  promptInput: (opts: { message: string }) => Promise<string>;
  promptConfirm: (opts: { message: string }) => Promise<boolean>;
}

async function promptStdioDetails(
  deps: McpAddDeps,
): Promise<McpServerConfigEntry> {
  const command = await deps.promptInput({ message: "Command (e.g. npx):" });
  const argsRaw = await deps.promptInput({
    message: "Arguments (comma-separated, or empty):",
  });
  const args = argsRaw ? argsRaw.split(",").map((a) => a.trim()) : [];
  const envRaw = await deps.promptInput({
    message: "Env vars (KEY=VAL,KEY2=VAL2 or empty):",
  });
  const env = parseKeyValuePairs(envRaw);
  return { type: "stdio", command, args, env };
}

async function promptHttpDetails(
  deps: McpAddDeps,
): Promise<McpServerConfigEntry> {
  const url = await deps.promptInput({ message: "Server URL:" });
  const headersRaw = await deps.promptInput({
    message: "Headers (KEY=VAL,KEY2=VAL2 or empty):",
  });
  const headers = parseKeyValuePairs(headersRaw);
  return { type: "http", url, headers };
}

function parseKeyValuePairs(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  const result: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

export async function runMcpAdd(name: string, deps: McpAddDeps): Promise<void> {
  if (deps.serverExists(deps.configPath, name)) {
    const replace = await deps.promptConfirm({
      message: `Server "${name}" already exists. Replace?`,
    });
    if (!replace) {
      console.log("Cancelled.");
      return;
    }
  }
  const transportType = await deps.promptSelect({
    message: "Transport type:",
    choices: [{ value: "stdio" }, { value: "http" }],
  });
  const entry =
    transportType === "stdio"
      ? await promptStdioDetails(deps)
      : await promptHttpDetails(deps);
  deps.addServer(deps.configPath, name, entry);
  console.log(`Server "${name}" added.`);
}
