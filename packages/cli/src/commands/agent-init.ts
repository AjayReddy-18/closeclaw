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
import type { ApprovalCallback } from "@closeclaw/ai-agent";
import {
  createParallelTasksTool,
  type OrchestrationPlanRef,
} from "@closeclaw/ai-agent";

export interface AgentInit {
  store: ReturnType<typeof createPersistentConversationStore>;
  processor: ReturnType<typeof createMessageProcessor>;
  mcpManager?: McpConnectionManager;
  pruneInterval: ReturnType<typeof setInterval>;
}

interface AgentInitDeps {
  mcpConfigPath: string;
}

export interface CursorProgressRef {
  send: (text: string) => void;
}

export interface CursorApprovalRef {
  ask: ApprovalCallback;
}

export interface OrchestrationRef {
  plan: { tasks: Array<{ label: string; prompt: string }> } | null;
}

export async function initAgent(
  config: Configuration,
  deps: AgentInitDeps,
  taskStore: Parameters<typeof createSchedulerTools>[0],
  schedulerRef: { current?: SchedulerAssembly },
  senderRef: { platform: string; senderId: string },
  adapters: BotAdapter[],
  progressRef: CursorProgressRef,
  approvalRef: CursorApprovalRef,
  orchestrationRef?: OrchestrationRef,
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
        (text) => progressRef.send(text),
        (rejected) => approvalRef.ask(rejected),
      )
    : {};
  if (cursorSetup) console.log("[cursor] Cursor CLI agent available");
  const planRef = orchestrationRef ?? { plan: null };
  const parallelTool = { parallel_tasks: createParallelTasksTool(planRef) };
  const extraTools = {
    ...schedTools,
    ...mcpTools.tools,
    ...cursorTools,
    ...parallelTool,
  };
  const mcpToolNames = Object.keys(mcpTools.tools);
  const assembly = assembleAgent(
    config.agent,
    extraTools,
    mcpToolNames,
    cursorSetup !== null,
    true,
  );
  adapters.forEach((a) =>
    a.onMessage((msg) => {
      senderRef.platform = a.platform;
      senderRef.senderId = msg.senderId;
    }),
  );
  console.log(
    `AI agent active: ${config.agent.provider}/${config.agent.model}`,
  );
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
