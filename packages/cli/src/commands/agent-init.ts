import type { BotAdapter } from "@closeclaw/bot-adapters";
import type {
  createPersistentConversationStore,
  createMessageProcessor,
} from "@closeclaw/ai-agent";
import {
  isValidAgentConfig,
  type Configuration,
} from "@closeclaw/shared-types";
import type { McpConnectionManager } from "@closeclaw/mcp-client";
import { connectMcpServers } from "./mcp-connect.js";
import { assembleAgent } from "./agent-assembly.js";
import {
  createSchedulerTools,
  type SchedulerAssembly,
} from "./scheduler-setup.js";
import { setupCursorAgent, buildCursorTools } from "./cursor-setup.js";

export interface AgentInit {
  store: ReturnType<typeof createPersistentConversationStore>;
  processor: ReturnType<typeof createMessageProcessor>;
  mcpManager?: McpConnectionManager;
  pruneInterval: ReturnType<typeof setInterval>;
}

interface AgentInitDeps {
  mcpConfigPath: string;
}

export async function initAgent(
  config: Configuration,
  deps: AgentInitDeps,
  taskStore: Parameters<typeof createSchedulerTools>[0],
  schedulerRef: { current?: SchedulerAssembly },
  senderRef: { platform: string; senderId: string },
  adapters: BotAdapter[],
): Promise<AgentInit | null> {
  if (!config.agent || !isValidAgentConfig(config.agent)) return null;
  const schedTools = createSchedulerTools(taskStore, schedulerRef, senderRef);
  const mcpTools = await connectMcpServers(deps.mcpConfigPath);
  const cursorSetup = await setupCursorAgent();
  const cursorTools = cursorSetup
    ? buildCursorTools(
        cursorSetup.sessionManager,
        senderRef.platform,
        senderRef.senderId,
        () => {},
        async () => "deny" as const,
      )
    : {};
  if (cursorSetup) console.log("[cursor] Cursor CLI agent available");
  const extraTools = { ...schedTools, ...mcpTools.tools, ...cursorTools };
  const mcpToolNames = Object.keys(mcpTools.tools);
  const assembly = assembleAgent(
    config.agent,
    extraTools,
    mcpToolNames,
    cursorSetup !== null,
  );
  adapters.forEach((a) =>
    a.onMessage((msg) => {
      senderRef.platform = a.platform;
      senderRef.senderId = msg.senderId;
    }),
  );
  console.log(`AI agent active: ${config.agent.provider}/${config.agent.model}`);
  const pruneInterval = setInterval(
    () => assembly.conversationStore.pruneStale(24 * 60 * 60 * 1000),
    60 * 60 * 1000,
  );
  return {
    store: assembly.conversationStore,
    processor: assembly.messageProcessor,
    mcpManager: mcpTools.manager,
    pruneInterval,
  };
}
