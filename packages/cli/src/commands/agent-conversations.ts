import { homedir } from "node:os";
import { join } from "node:path";
import type { Configuration } from "@closeclaw/shared-types";
import { readConfig } from "../config/config-reader.js";

export interface AgentConversationsDeps {
  configPath: string;
  readConfig: (path: string) => Configuration | null;
  fetch: typeof fetch;
  log: (...args: unknown[]) => void;
}

type ConversationRow = {
  platform: string;
  senderId: string;
  senderDisplayName?: string;
  messageCount: number;
  lastActivityAt: string;
};

export function createAgentConversationsDeps(): AgentConversationsDeps {
  return {
    configPath: join(homedir(), ".closeclaw", "config.json"),
    readConfig,
    fetch: globalThis.fetch,
    log: console.log,
  };
}

export async function runAgentConversations(
  deps: AgentConversationsDeps,
): Promise<void> {
  const config = deps.readConfig(deps.configPath);
  if (!config) {
    deps.log("No configuration found. Run 'closeclaw onboard' first.");
    return;
  }
  const url = buildConversationsUrl(config);
  try {
    await fetchAndDisplay(deps, url, config.gateway.authToken);
  } catch {
    deps.log("Cannot connect to gateway. Is it running?");
  }
}

function buildConversationsUrl(config: Configuration): string {
  const g = config.gateway;
  return `http://${g.bindAddress}:${String(g.port)}/agent/conversations`;
}

async function fetchAndDisplay(
  deps: AgentConversationsDeps,
  url: string,
  authToken: string,
): Promise<void> {
  const response = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) {
    deps.log("Failed to fetch conversations:", response.statusText);
    return;
  }
  const conversations = (await response.json()) as ConversationRow[];
  if (conversations.length === 0) {
    deps.log("No active conversations.");
    return;
  }
  formatConversationTable(conversations, deps.log);
}

function formatConversationTable(
  conversations: ConversationRow[],
  log: (...args: unknown[]) => void,
): void {
  log("\nActive Conversations:");
  log("─".repeat(70));
  log("Platform    | Sender              | Messages | Last Activity");
  log("─".repeat(70));
  for (const c of conversations) {
    log(formatConversationRow(c));
  }
  log("─".repeat(70));
}

function formatConversationRow(c: ConversationRow): string {
  const sender = c.senderDisplayName ?? c.senderId;
  const time = new Date(c.lastActivityAt).toLocaleString();
  return `${c.platform.padEnd(12)}| ${sender.padEnd(20)}| ${String(c.messageCount).padEnd(9)}| ${time}`;
}
